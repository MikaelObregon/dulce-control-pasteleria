import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  INITIAL_CASH_MOVEMENTS,
  INITIAL_ORDERS,
  INITIAL_RECIPES,
  INITIAL_SETTINGS,
  INITIAL_SUPPLIES,
} from '../data/seedData';
import {
  CashAndFundsSummary,
  calculateCashAndFundsSummary,
  calculateVariantCostBreakdown,
  normalizeToBaseUnit,
  VariantCostBreakdown,
} from '../services/calculations';
import {
  fetchCloudState,
  getSupabaseConfig,
  pushCloudState,
  saveSupabaseConfig,
} from '../services/supabaseSync';
import {
  AppSettings,
  CashMovement,
  Order,
  OrderPayment,
  OrderStatus,
  Recipe,
  RecipeIngredientLine,
  RecipeVariant,
  Supply,
} from '../types/domain';

const STORAGE_KEY = 'dulce_control_state_v2';

export interface PersistedState {
  settings: AppSettings;
  supplies: Supply[];
  recipes: Recipe[];
  orders: Order[];
  movements: CashMovement[];
}

export type CloudSyncStatus = 'local_only' | 'syncing' | 'synced' | 'error';

interface StoreContextValue {
  settings: AppSettings;
  supplies: Supply[];
  recipes: Recipe[];
  orders: Order[];
  movements: CashMovement[];
  cashSummary: CashAndFundsSummary;
  lastCascadeNotice: string | null;
  clearCascadeNotice: () => void;

  // Cloud Sync
  cloudStatus: CloudSyncStatus;
  cloudError: string | null;
  configureCloudSync: (url: string, anonKey: string) => Promise<{ ok: boolean; message: string }>;
  syncWithCloudNow: () => Promise<void>;

  // Helpers
  getVariantBreakdown: (recipeId: string, variantId: string) => VariantCostBreakdown | null;
  formatMoney: (value: number) => string;

  // Paso 1: Insumos
  upsertSupply: (
    supply: Omit<Supply, 'id' | 'baseUnit' | 'baseTotalQuantity' | 'lastUpdated'> & {
      id?: string;
    }
  ) => void;
  updateSupplyPriceQuick: (supplyId: string, newPrice: number) => void;
  adjustSupplyStock: (supplyId: string, newStockQuantity: number) => void;
  deleteSupply: (supplyId: string) => void;

  // Paso 2 & 3: Recetas, Tamaños y Precios
  upsertRecipe: (recipe: Recipe) => void;
  deleteRecipe: (recipeId: string) => void;
  updateRecipeBaseIngredients: (recipeId: string, ingredients: RecipeIngredientLine[]) => void;
  updateVariantCustomIngredients: (
    recipeId: string,
    variantId: string,
    customIngredients?: RecipeIngredientLine[]
  ) => void;
  upsertVariant: (recipeId: string, variant: RecipeVariant) => void;
  deleteVariant: (recipeId: string, variantId: string) => void;
  applyPricingToVariant: (
    recipeId: string,
    variantId: string,
    markupPercent: number,
    manualSalePrice?: number
  ) => void;

  // Paso 4: Agenda de Pedidos, Clientes y Deudas
  createOrder: (
    orderData: Omit<Order, 'id' | 'createdAt' | 'stockDeducted'>
  ) => void;
  updateOrder: (
    orderId: string,
    updatedData: Partial<Omit<Order, 'id' | 'createdAt'>>
  ) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  addOrderPayment: (orderId: string, payment: Omit<OrderPayment, 'id'>) => void;
  deleteOrderPayment: (orderId: string, paymentId: string) => void;
  deleteOrder: (orderId: string) => void;

  // Paso 5: Caja, Fondos y Gastos Operativos
  addCashMovement: (movement: Omit<CashMovement, 'id'>) => void;
  deleteCashMovement: (movementId: string) => void;

  // Configuración y Respaldos
  updateSettings: (partial: Partial<AppSettings>) => void;
  exportBackupJson: () => string;
  importBackupJson: (jsonStr: string) => { ok: boolean; message: string };
  resetDemoTransactions: () => void;
  resetAllToFactory: () => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.supplies && parsed.recipes && parsed.orders && parsed.movements) {
        return {
          settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
          supplies: parsed.supplies,
          recipes: parsed.recipes,
          orders: parsed.orders,
          movements: parsed.movements,
        };
      }
    }
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
  }
  return {
    settings: INITIAL_SETTINGS,
    supplies: INITIAL_SUPPLIES,
    recipes: INITIAL_RECIPES,
    orders: INITIAL_ORDERS,
    movements: INITIAL_CASH_MOVEMENTS,
  };
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [lastCascadeNotice, setLastCascadeNotice] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(() =>
    getSupabaseConfig() ? 'syncing' : 'local_only'
  );
  const [cloudError, setCloudError] = useState<string | null>(null);

  const isHydratingFromCloud = useRef(false);
  const hasCompletedInitialPull = useRef(false);

  // Save to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Error saving state to localStorage:', err);
    }
  }, [state]);

  const syncWithCloudNow = useCallback(async () => {
    const cfg = getSupabaseConfig();
    if (!cfg) {
      setCloudStatus('local_only');
      return;
    }

    setCloudStatus('syncing');
    setCloudError(null);
    const res = await fetchCloudState<PersistedState>();
    if (!res.ok) {
      setCloudStatus('error');
      setCloudError(res.error || 'No se pudo sincronizar con Supabase');
      return;
    }

    if (res.state && res.state.supplies && res.state.recipes) {
      isHydratingFromCloud.current = true;
      setState({
        settings: { ...INITIAL_SETTINGS, ...(res.state.settings || {}) },
        supplies: res.state.supplies,
        recipes: res.state.recipes,
        orders: res.state.orders || [],
        movements: res.state.movements || [],
      });
      hasCompletedInitialPull.current = true;
      setCloudStatus('synced');
      setTimeout(() => {
        isHydratingFromCloud.current = false;
      }, 100);
    } else {
      // Cloud table is empty -> push current local state to initialize cloud
      const pushRes = await pushCloudState(state);
      hasCompletedInitialPull.current = true;
      if (pushRes.ok) {
        setCloudStatus('synced');
      } else {
        setCloudStatus('error');
        setCloudError(pushRes.error || 'Error al subir datos iniciales a Supabase');
      }
    }
  }, [state]);

  // Initial pull from Supabase on mount
  useEffect(() => {
    if (getSupabaseConfig() && !hasCompletedInitialPull.current) {
      syncWithCloudNow();
    }
  }, [syncWithCloudNow]);

  // Automatic debounced push to Supabase whenever state changes
  useEffect(() => {
    if (!getSupabaseConfig()) return;
    if (!hasCompletedInitialPull.current || isHydratingFromCloud.current) return;

    setCloudStatus('syncing');
    const timer = setTimeout(async () => {
      const res = await pushCloudState(state);
      if (res.ok) {
        setCloudStatus('synced');
        setCloudError(null);
      } else {
        setCloudStatus('error');
        setCloudError(res.error || 'Error al sincronizar cambios');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [state]);

  const configureCloudSync: StoreContextValue['configureCloudSync'] = async (
    url,
    anonKey
  ) => {
    saveSupabaseConfig(url, anonKey);
    if (!url.trim() || !anonKey.trim()) {
      setCloudStatus('local_only');
      setCloudError(null);
      return { ok: true, message: 'Modo solo local activado.' };
    }

    setCloudStatus('syncing');
    const pullRes = await fetchCloudState<PersistedState>();
    if (!pullRes.ok) {
      setCloudStatus('error');
      setCloudError(pullRes.error || 'Error de conexión');
      return {
        ok: false,
        message: `No se pudo conectar: verifica que hayas ejecutado el script SQL en Supabase (${pullRes.error}).`,
      };
    }

    if (pullRes.state && pullRes.state.supplies && pullRes.state.recipes) {
      isHydratingFromCloud.current = true;
      setState(pullRes.state);
      hasCompletedInitialPull.current = true;
      setCloudStatus('synced');
      setTimeout(() => {
        isHydratingFromCloud.current = false;
      }, 100);
      return {
        ok: true,
        message: '¡Conectado a Supabase! Se descargaron tus datos desde la nube.',
      };
    }

    const pushRes = await pushCloudState(state);
    if (pushRes.ok) {
      hasCompletedInitialPull.current = true;
      setCloudStatus('synced');
      return {
        ok: true,
        message: '¡Conectado a Supabase! Tus recetas e insumos se guardaron en la nube.',
      };
    }

    setCloudStatus('error');
    setCloudError(pushRes.error || 'Error al subir');
    return {
      ok: false,
      message: `Error al guardar en la tabla: ${pushRes.error}`,
    };
  };

  const clearCascadeNotice = () => setLastCascadeNotice(null);

  const countAffectedRecipes = (supplyId: string, recipes: Recipe[]) => {
    let recipeCount = 0;
    let variantCount = 0;
    for (const r of recipes) {
      const inBase = r.baseIngredients.some((i) => i.supplyId === supplyId);
      const inPkg = r.variants.some(
        (v) =>
          v.packagingItems.some((p) => p.supplyId === supplyId) ||
          (v.customIngredients && v.customIngredients.some((ci) => ci.supplyId === supplyId))
      );
      if (inBase || inPkg) {
        recipeCount++;
        variantCount += r.variants.length;
      }
    }
    return { recipeCount, variantCount };
  };

  const upsertSupply: StoreContextValue['upsertSupply'] = (supplyInput) => {
    const { baseUnit, baseTotalQuantity } = normalizeToBaseUnit(
      supplyInput.purchaseAmount,
      supplyInput.purchaseUnit
    );
    const id = supplyInput.id || `sup-${Date.now()}`;
    const newSupply: Supply = {
      ...supplyInput,
      id,
      baseUnit,
      baseTotalQuantity,
      lastUpdated: new Date().toISOString(),
    };

    setState((prev) => {
      const exists = prev.supplies.some((s) => s.id === id);
      const nextSupplies = exists
        ? prev.supplies.map((s) => (s.id === id ? newSupply : s))
        : [newSupply, ...prev.supplies];

      const { recipeCount, variantCount } = countAffectedRecipes(id, prev.recipes);
      if (exists && recipeCount > 0) {
        setLastCascadeNotice(
          `¡Actualización inteligente aplicada! Al actualizar "${newSupply.name}", se recalcularon automáticamente ${recipeCount} receta(s) y ${variantCount} tamaños.`
        );
      }
      return { ...prev, supplies: nextSupplies };
    });
  };

  const updateSupplyPriceQuick: StoreContextValue['updateSupplyPriceQuick'] = (
    supplyId,
    newPrice
  ) => {
    if (newPrice < 0) return;
    setState((prev) => {
      const target = prev.supplies.find((s) => s.id === supplyId);
      if (!target) return prev;
      const nextSupplies = prev.supplies.map((s) =>
        s.id === supplyId
          ? { ...s, purchasePrice: newPrice, lastUpdated: new Date().toISOString() }
          : s
      );
      const { recipeCount, variantCount } = countAffectedRecipes(supplyId, prev.recipes);
      setLastCascadeNotice(
        recipeCount > 0
          ? `Precio de "${target.name}" actualizado. Se recalcularon al instante ${recipeCount} receta(s) y ${variantCount} formatos.`
          : `Precio de "${target.name}" actualizado.`
      );
      return { ...prev, supplies: nextSupplies };
    });
  };

  const adjustSupplyStock: StoreContextValue['adjustSupplyStock'] = (
    supplyId,
    newStockQuantity
  ) => {
    setState((prev) => ({
      ...prev,
      supplies: prev.supplies.map((s) =>
        s.id === supplyId ? { ...s, stockQuantity: Math.max(0, newStockQuantity) } : s
      ),
    }));
  };

  const deleteSupply: StoreContextValue['deleteSupply'] = (supplyId) => {
    setState((prev) => ({
      ...prev,
      supplies: prev.supplies.filter((s) => s.id !== supplyId),
    }));
  };

  const upsertRecipe: StoreContextValue['upsertRecipe'] = (recipe) => {
    setState((prev) => {
      const exists = prev.recipes.some((r) => r.id === recipe.id);
      return {
        ...prev,
        recipes: exists
          ? prev.recipes.map((r) => (r.id === recipe.id ? recipe : r))
          : [...prev.recipes, recipe],
      };
    });
  };

  const deleteRecipe: StoreContextValue['deleteRecipe'] = (recipeId) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((r) => r.id !== recipeId),
    }));
  };

  const updateRecipeBaseIngredients: StoreContextValue['updateRecipeBaseIngredients'] = (
    recipeId,
    ingredients
  ) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) =>
        r.id === recipeId ? { ...r, baseIngredients: ingredients } : r
      ),
    }));
  };

  const updateVariantCustomIngredients: StoreContextValue['updateVariantCustomIngredients'] = (
    recipeId,
    variantId,
    customIngredients
  ) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) => {
        if (r.id !== recipeId) return r;
        return {
          ...r,
          variants: r.variants.map((v) =>
            v.id === variantId
              ? {
                  ...v,
                  customIngredients:
                    customIngredients && customIngredients.length > 0
                      ? customIngredients
                      : undefined,
                }
              : v
          ),
        };
      }),
    }));
  };

  const upsertVariant: StoreContextValue['upsertVariant'] = (recipeId, variant) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) => {
        if (r.id !== recipeId) return r;
        const exists = r.variants.some((v) => v.id === variant.id);
        return {
          ...r,
          variants: exists
            ? r.variants.map((v) => (v.id === variant.id ? variant : v))
            : [...r.variants, variant],
        };
      }),
    }));
  };

  const deleteVariant: StoreContextValue['deleteVariant'] = (recipeId, variantId) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) =>
        r.id === recipeId
          ? { ...r, variants: r.variants.filter((v) => v.id !== variantId) }
          : r
      ),
    }));
  };

  const applyPricingToVariant: StoreContextValue['applyPricingToVariant'] = (
    recipeId,
    variantId,
    markupPercent,
    manualSalePrice
  ) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) => {
        if (r.id !== recipeId) return r;
        return {
          ...r,
          variants: r.variants.map((v) =>
            v.id === variantId
              ? {
                  ...v,
                  defaultMarkupPercent: markupPercent,
                  manualSalePrice:
                    manualSalePrice && manualSalePrice > 0 ? manualSalePrice : undefined,
                }
              : v
          ),
        };
      }),
    }));
  };

  const deductOrderStockFromSupplies = (
    order: Order,
    recipes: Recipe[],
    supplies: Supply[]
  ): Supply[] => {
    const usageMap = new Map<string, number>();

    for (const item of order.items) {
      const recipe = recipes.find((r) => r.id === item.recipeId);
      if (!recipe) continue;
      const variant = recipe.variants.find((v) => v.id === item.variantId);
      if (!variant) continue;

      const ingList =
        variant.customIngredients && variant.customIngredients.length > 0
          ? variant.customIngredients
          : recipe.baseIngredients.map((ing) => ({
              supplyId: ing.supplyId,
              quantity: ing.quantity * variant.scaleFactor,
            }));

      for (const ing of ingList) {
        const current = usageMap.get(ing.supplyId) || 0;
        usageMap.set(ing.supplyId, current + ing.quantity * item.quantity);
      }

      for (const pkg of variant.packagingItems) {
        const current = usageMap.get(pkg.supplyId) || 0;
        usageMap.set(pkg.supplyId, current + pkg.quantity * item.quantity);
      }
    }

    return supplies.map((sup) => {
      const used = usageMap.get(sup.id);
      if (!used) return sup;
      return {
        ...sup,
        stockQuantity: Math.max(0, Number((sup.stockQuantity - used).toFixed(2))),
      };
    });
  };

  const createOrder: StoreContextValue['createOrder'] = (orderData) => {
    setState((prev) => {
      const shouldDeduct =
        prev.settings.autoDeductStock &&
        (orderData.status === 'en_preparacion' ||
          orderData.status === 'listo' ||
          orderData.status === 'entregado');

      const newOrder: Order = {
        ...orderData,
        id: `ord-${Date.now()}`,
        createdAt: new Date().toISOString(),
        stockDeducted: shouldDeduct,
      };

      const nextSupplies = shouldDeduct
        ? deductOrderStockFromSupplies(newOrder, prev.recipes, prev.supplies)
        : prev.supplies;

      return {
        ...prev,
        supplies: nextSupplies,
        orders: [newOrder, ...prev.orders],
      };
    });
  };

  const updateOrder: StoreContextValue['updateOrder'] = (orderId, updatedData) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? { ...o, ...updatedData } : o)),
    }));
  };

  const updateOrderStatus: StoreContextValue['updateOrderStatus'] = (orderId, status) => {
    setState((prev) => {
      const target = prev.orders.find((o) => o.id === orderId);
      if (!target) return prev;

      const shouldDeductNow =
        prev.settings.autoDeductStock &&
        !target.stockDeducted &&
        (status === 'en_preparacion' || status === 'listo' || status === 'entregado');

      const nextSupplies = shouldDeductNow
        ? deductOrderStockFromSupplies(target, prev.recipes, prev.supplies)
        : prev.supplies;

      const nextOrders = prev.orders.map((o) =>
        o.id === orderId
          ? { ...o, status, stockDeducted: o.stockDeducted || shouldDeductNow }
          : o
      );

      return {
        ...prev,
        supplies: nextSupplies,
        orders: nextOrders,
      };
    });
  };

  const addOrderPayment: StoreContextValue['addOrderPayment'] = (orderId, payment) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              payments: [
                ...o.payments,
                {
                  ...payment,
                  id: `pay-${Date.now()}`,
                },
              ],
            }
          : o
      ),
    }));
  };

  const deleteOrderPayment: StoreContextValue['deleteOrderPayment'] = (
    orderId,
    paymentId
  ) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              payments: o.payments.filter((p) => p.id !== paymentId),
            }
          : o
      ),
    }));
  };

  const deleteOrder: StoreContextValue['deleteOrder'] = (orderId) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== orderId),
    }));
  };

  const addCashMovement: StoreContextValue['addCashMovement'] = (movement) => {
    setState((prev) => ({
      ...prev,
      movements: [
        {
          ...movement,
          id: `mov-${Date.now()}`,
        },
        ...prev.movements,
      ],
    }));
  };

  const deleteCashMovement: StoreContextValue['deleteCashMovement'] = (movementId) => {
    setState((prev) => ({
      ...prev,
      movements: prev.movements.filter((m) => m.id !== movementId),
    }));
  };

  const updateSettings: StoreContextValue['updateSettings'] = (partial) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
  };

  const exportBackupJson = () => {
    return JSON.stringify(state, null, 2);
  };

  const importBackupJson: StoreContextValue['importBackupJson'] = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr) as Partial<PersistedState>;
      if (!parsed.supplies || !parsed.recipes || !parsed.orders || !parsed.movements) {
        return {
          ok: false,
          message: 'El archivo no tiene el formato válido de DulceControl.',
        };
      }
      setState({
        settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
        supplies: parsed.supplies,
        recipes: parsed.recipes,
        orders: parsed.orders,
        movements: parsed.movements,
      });
      return { ok: true, message: 'Copia de seguridad restaurada con éxito.' };
    } catch {
      return { ok: false, message: 'Error al leer el archivo JSON de respaldo.' };
    }
  };

  const resetDemoTransactions = () => {
    setState((prev) => ({
      ...prev,
      supplies: prev.supplies.map((s) => ({ ...s, stockQuantity: 0 })),
      orders: [],
      movements: [],
    }));
  };

  const resetAllToFactory = () => {
    setState({
      settings: INITIAL_SETTINGS,
      supplies: INITIAL_SUPPLIES,
      recipes: INITIAL_RECIPES,
      orders: INITIAL_ORDERS,
      movements: INITIAL_CASH_MOVEMENTS,
    });
  };

  const getVariantBreakdown = (
    recipeId: string,
    variantId: string
  ): VariantCostBreakdown | null => {
    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) return null;
    const variant = recipe.variants.find((v) => v.id === variantId);
    if (!variant) return null;
    return calculateVariantCostBreakdown(recipe, variant, state.supplies);
  };

  const formatMoney = (value: number) => {
    const safeVal = Number.isFinite(value) ? value : 0;
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: state.settings.decimals,
      maximumFractionDigits: state.settings.decimals,
    }).format(safeVal);
    return `${state.settings.currencySymbol}${formatted}`;
  };

  const cashSummary = useMemo(
    () => calculateCashAndFundsSummary(state.orders, state.movements),
    [state.orders, state.movements]
  );

  return (
    <StoreContext.Provider
      value={{
        settings: state.settings,
        supplies: state.supplies,
        recipes: state.recipes,
        orders: state.orders,
        movements: state.movements,
        cashSummary,
        lastCascadeNotice,
        clearCascadeNotice,
        cloudStatus,
        cloudError,
        configureCloudSync,
        syncWithCloudNow,
        getVariantBreakdown,
        formatMoney,
        upsertSupply,
        updateSupplyPriceQuick,
        adjustSupplyStock,
        deleteSupply,
        upsertRecipe,
        deleteRecipe,
        updateRecipeBaseIngredients,
        updateVariantCustomIngredients,
        upsertVariant,
        deleteVariant,
        applyPricingToVariant,
        createOrder,
        updateOrder,
        updateOrderStatus,
        addOrderPayment,
        deleteOrderPayment,
        deleteOrder,
        addCashMovement,
        deleteCashMovement,
        updateSettings,
        exportBackupJson,
        importBackupJson,
        resetDemoTransactions,
        resetAllToFactory,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe usarse dentro de un StoreProvider');
  }
  return ctx;
}
