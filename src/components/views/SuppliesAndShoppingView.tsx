import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  ChefHat,
  Copy,
  Minus,
  Package,
  Plus,
  Search,
  Wheat,
  X,
  XCircle,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { calculateSupplyUnitCost } from '../../services/calculations';
import { Supply } from '../../types/domain';
import { SuppliesView } from '../supplies/SuppliesView';

export const SuppliesAndShoppingView: React.FC = () => {
  const { recipes, supplies, settings, formatMoney, adjustSupplyStock, upsertSupply } =
    useStore();

  const [subTab, setSubTab] = useState<'stock' | 'precios'>('stock');
  const [stockFilter, setStockFilter] = useState<
    'todos' | 'alertas' | 'ingrediente' | 'envase'
  >('todos');
  const [search, setSearch] = useState('');
  const [copiedLowStock, setCopiedLowStock] = useState(false);

  // Quick manual stock edit state
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockInputVal, setStockInputVal] = useState<string>('');
  const [minAlertInputVal, setMinAlertInputVal] = useState<string>('');
  const [inputMode, setInputMode] = useState<'base' | 'packs'>('base');

  // 1. Global Stock Indicators
  const stockMetrics = useMemo(() => {
    let totalInventoryValue = 0;
    let optimalCount = 0;
    let lowCount = 0;
    let outOfStockCount = 0;

    for (const s of supplies) {
      const unitCost = calculateSupplyUnitCost(s);
      totalInventoryValue += Math.max(0, s.stockQuantity) * unitCost;

      if (s.stockQuantity <= 0) {
        outOfStockCount++;
      } else if (s.minStockAlert > 0 && s.stockQuantity <= s.minStockAlert) {
        lowCount++;
      } else {
        optimalCount++;
      }
    }

    return {
      totalInventoryValue,
      optimalCount,
      lowCount,
      outOfStockCount,
      alertsTotal: lowCount + outOfStockCount,
    };
  }, [supplies]);

  // 2. Recipe Production Capacity Indicator: How many of each cake/size can I make right now with current stock?
  const recipeCapacityIndicators = useMemo(() => {
    const suppliesMap = new Map<string, Supply>(supplies.map((s) => [s.id, s]));

    return recipes.map((recipe) => {
      const variantCapacities = recipe.variants.map((variant) => {
        const ingList =
          variant.customIngredients && variant.customIngredients.length > 0
            ? variant.customIngredients
            : recipe.baseIngredients.map((ing) => ({
                supplyId: ing.supplyId,
                quantity: ing.quantity * variant.scaleFactor,
              }));

        let maxMakeable = Infinity;
        let limitingSupplyName = '';
        const missingSupplies: string[] = [];

        // Check ingredients
        for (const ing of ingList) {
          if (ing.quantity <= 0) continue;
          const sup = suppliesMap.get(ing.supplyId);
          if (!sup) continue;
          const possible = Math.floor(sup.stockQuantity / ing.quantity);
          if (possible <= 0) {
            missingSupplies.push(sup.name);
          }
          if (possible < maxMakeable) {
            maxMakeable = possible;
            limitingSupplyName = sup.name;
          }
        }

        // Check packaging
        for (const pkg of variant.packagingItems) {
          if (pkg.quantity <= 0) continue;
          const sup = suppliesMap.get(pkg.supplyId);
          if (!sup) continue;
          const possible = Math.floor(sup.stockQuantity / pkg.quantity);
          if (possible <= 0) {
            missingSupplies.push(sup.name);
          }
          if (possible < maxMakeable) {
            maxMakeable = possible;
            limitingSupplyName = sup.name;
          }
        }

        const safeMax = Number.isFinite(maxMakeable) ? Math.max(0, maxMakeable) : 0;

        return {
          variantId: variant.id,
          variantName: variant.name,
          format: variant.format,
          maxMakeable: safeMax,
          limitingSupplyName,
          missingSupplies: Array.from(new Set(missingSupplies)),
        };
      });

      return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        emoji: recipe.emoji,
        variantCapacities,
      };
    });
  }, [recipes, supplies]);

  // Filtered supplies for stock cards
  const filteredSupplies = useMemo(() => {
    return supplies.filter((s) => {
      if (stockFilter === 'ingrediente' && s.category !== 'ingrediente') return false;
      if (stockFilter === 'envase' && s.category !== 'envase') return false;
      if (stockFilter === 'alertas') {
        const isAlert =
          s.stockQuantity <= 0 ||
          (s.minStockAlert > 0 && s.stockQuantity <= s.minStockAlert);
        if (!isAlert) return false;
      }
      if (search.trim()) {
        return s.name.toLowerCase().includes(search.trim().toLowerCase());
      }
      return true;
    });
  }, [supplies, stockFilter, search]);

  const openStockEditor = (supply: Supply) => {
    setEditingStockId(supply.id);
    setInputMode('base');
    setStockInputVal(String(supply.stockQuantity));
    setMinAlertInputVal(String(supply.minStockAlert));
  };

  const handleSaveManualStock = (supply: Supply) => {
    const rawStock = Math.max(0, Number(stockInputVal) || 0);
    const finalBaseStock =
      inputMode === 'packs'
        ? Number((rawStock * supply.baseTotalQuantity).toFixed(2))
        : rawStock;
    const nextMinAlert = Math.max(0, Number(minAlertInputVal) || 0);

    upsertSupply({
      id: supply.id,
      name: supply.name,
      category: supply.category,
      purchasePrice: supply.purchasePrice,
      purchaseAmount: supply.purchaseAmount,
      purchaseUnit: supply.purchaseUnit,
      stockQuantity: finalBaseStock,
      minStockAlert: nextMinAlert,
    });
    setEditingStockId(null);
  };

  const handleCopyLowStockList = () => {
    const alertItems = supplies.filter(
      (s) =>
        s.stockQuantity <= 0 ||
        (s.minStockAlert > 0 && s.stockQuantity <= s.minStockAlert)
    );
    const lines = [
      `🛒 *LISTA DE REPOSICIÓN DE STOCK — ${settings.businessName.toUpperCase()}*`,
      '',
      ...alertItems.map((s) => {
        const statusLabel = s.stockQuantity <= 0 ? '🔴 AGOTADO' : '🟡 QUEDA POCO';
        return `• ${statusLabel}: *${s.name}* (Quedan ${s.stockQuantity} ${s.baseUnit} / Mínimo ideal: ${s.minStockAlert} ${s.baseUnit})`;
      }),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedLowStock(true);
    setTimeout(() => setCopiedLowStock(false), 3000);
  };

  const getSupplyRecipesBadges = (supplyId: string) => {
    return recipes
      .filter(
        (r) =>
          r.baseIngredients.some((i) => i.supplyId === supplyId) ||
          r.variants.some(
            (v) =>
              v.packagingItems.some((p) => p.supplyId === supplyId) ||
              (v.customIngredients &&
                v.customIngredients.some((ci) => ci.supplyId === supplyId))
          )
      )
      .map((r) => `${r.emoji} ${r.name}`);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Switcher: Mi Stock y Alacena vs Precios de Insumos */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-200/80 rounded-2xl">
        <button
          onClick={() => setSubTab('stock')}
          className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            subTab === 'stock'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Boxes className="w-4 h-4 text-amber-700" />
          Mi Stock y Alacena ({supplies.length})
        </button>
        <button
          onClick={() => setSubTab('precios')}
          className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            subTab === 'precios'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Package className="w-4 h-4 text-pink-700" />
          Costos y Precios Paquetes
        </button>
      </div>

      {subTab === 'precios' ? (
        <SuppliesView />
      ) : (
        <div className="space-y-4">
          {/* 1. TABLERO DE INDICADORES DE STOCK */}
          <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 rounded-3xl p-5 text-white shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full mb-1.5">
                  <Boxes className="w-3.5 h-3.5" /> Control de Alacena e Indicadores
                </span>
                <h1 className="text-xl font-black tracking-tight">
                  Tu Stock de Ingredientes y Envases
                </h1>
                <p className="text-xs text-stone-300 mt-0.5">
                  Suma o resta lo que tienes en casa y mira para cuántas tortas te alcanza hoy.
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-2xl px-3.5 py-2 text-right">
                <span className="text-[10px] uppercase tracking-wider text-amber-200 font-bold block">
                  Dinero en Mercadería Guardada
                </span>
                <span className="text-lg font-black text-white">
                  {formatMoney(stockMetrics.totalInventoryValue)}
                </span>
              </div>
            </div>

            {/* Semáforo de Indicadores de Alacena */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setStockFilter('todos')}
                className="bg-emerald-500/20 border border-emerald-400/40 rounded-2xl p-3 text-left cursor-pointer"
              >
                <span className="text-[10px] font-extrabold uppercase text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Stock Bien
                </span>
                <span className="text-2xl font-black text-white block mt-0.5">
                  {stockMetrics.optimalCount}
                </span>
                <span className="text-[10px] text-emerald-100/80">Insumos cubiertos</span>
              </button>

              <button
                type="button"
                onClick={() => setStockFilter('alertas')}
                className="bg-amber-500/20 border border-amber-400/40 rounded-2xl p-3 text-left cursor-pointer"
              >
                <span className="text-[10px] font-extrabold uppercase text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Queda Poco
                </span>
                <span className="text-2xl font-black text-amber-200 block mt-0.5">
                  {stockMetrics.lowCount}
                </span>
                <span className="text-[10px] text-amber-100/80">En alerta mínima</span>
              </button>

              <button
                type="button"
                onClick={() => setStockFilter('alertas')}
                className="bg-red-500/25 border border-red-400/50 rounded-2xl p-3 text-left cursor-pointer"
              >
                <span className="text-[10px] font-extrabold uppercase text-red-300 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Agotados (0)
                </span>
                <span className="text-2xl font-black text-red-200 block mt-0.5">
                  {stockMetrics.outOfStockCount}
                </span>
                <span className="text-[10px] text-red-100/80">Sin existencias</span>
              </button>
            </div>

            {stockMetrics.alertsTotal > 0 && (
              <button
                type="button"
                onClick={handleCopyLowStockList}
                className="w-full py-2.5 px-4 bg-white text-stone-950 hover:bg-amber-50 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {copiedLowStock ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    ¡Lista de faltantes copiada para WhatsApp!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-700" />
                    Copiar los {stockMetrics.alertsTotal} insumos bajos/agotados para ir a comprar
                  </>
                )}
              </button>
            )}
          </div>

          {/* 2. INDICADOR DE CAPACIDAD POR RECETA: ¿CUÁNTAS TORTAS PUEDO HACER HOY CON MI STOCK? */}
          <div className="bg-white rounded-3xl p-4 border border-stone-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-2xl bg-pink-50 text-pink-700">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-stone-900">
                    ¿Cuántas Tortas puedes hacer hoy con tu Stock actual?
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Calculado en vivo cruzando tu alacena contra las recetas y envases de cada
                    tamaño
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {recipeCapacityIndicators.map((rc) => {
                const medianaCap =
                  rc.variantCapacities.find((v) => v.format === 'mediana') ||
                  rc.variantCapacities[0];
                const indCap = rc.variantCapacities.find(
                  (v) => v.format === 'individual'
                );
                const grandeCap = rc.variantCapacities.find(
                  (v) => v.format === 'grande'
                );

                const canMakeMediana = (medianaCap?.maxMakeable ?? 0) > 0;

                return (
                  <div
                    key={rc.recipeId}
                    className={`rounded-2xl p-3.5 border ${
                      canMakeMediana
                        ? 'bg-[#FDFBF7] border-stone-200/90'
                        : 'bg-red-50/60 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                        <span className="text-base">{rc.emoji}</span> {rc.recipeName}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          canMakeMediana
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {canMakeMediana ? 'Disponible' : 'Falta Stock'}
                      </span>
                    </div>

                    <div className="mt-2.5 space-y-1 text-xs">
                      {medianaCap && (
                        <div className="flex justify-between">
                          <span className="text-stone-600">🎂 Medianas:</span>
                          <strong
                            className={
                              medianaCap.maxMakeable > 0
                                ? 'text-emerald-700 font-black'
                                : 'text-red-600 font-black'
                            }
                          >
                            {medianaCap.maxMakeable} u.
                          </strong>
                        </div>
                      )}
                      {grandeCap && (
                        <div className="flex justify-between">
                          <span className="text-stone-600">👑 Grandes:</span>
                          <strong className="text-stone-900 font-bold">
                            {grandeCap.maxMakeable} u.
                          </strong>
                        </div>
                      )}
                      {indCap && (
                        <div className="flex justify-between">
                          <span className="text-stone-600">🥤 Individuales:</span>
                          <strong className="text-stone-900 font-bold">
                            {indCap.maxMakeable} u.
                          </strong>
                        </div>
                      )}
                    </div>

                    {medianaCap && (
                      <div className="mt-2 pt-2 border-t border-stone-200/70 text-[10px]">
                        {medianaCap.missingSupplies.length > 0 ? (
                          <span className="text-red-700 font-bold block truncate">
                            ⚠️ Falta: {medianaCap.missingSupplies.join(', ')}
                          </span>
                        ) : (
                          <span className="text-stone-500 block truncate">
                            Límite: <strong>{medianaCap.limitingSupplyName}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. BUSCADOR Y FILTROS DE STOCK */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar ingrediente o envase en tu alacena..."
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setStockFilter('todos')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  stockFilter === 'todos'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white text-stone-600 border border-stone-200'
                }`}
              >
                Todos ({supplies.length})
              </button>
              <button
                onClick={() => setStockFilter('alertas')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  stockFilter === 'alertas'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Por Comprar / Bajo Stock ({stockMetrics.alertsTotal})
              </button>
              <button
                onClick={() => setStockFilter('ingrediente')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  stockFilter === 'ingrediente'
                    ? 'bg-pink-700 text-white'
                    : 'bg-white text-stone-600 border border-stone-200'
                }`}
              >
                <Wheat className="w-3.5 h-3.5" />
                Ingredientes (
                {supplies.filter((s) => s.category === 'ingrediente').length})
              </button>
              <button
                onClick={() => setStockFilter('envase')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  stockFilter === 'envase'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-stone-600 border border-stone-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Envases ({supplies.filter((s) => s.category === 'envase').length})
              </button>
            </div>
          </div>

          {/* 4. LISTA DE INSUMOS CON INDICADORES VISUALES Y BOTONES RÁPIDOS DE STOCK */}
          <div className="space-y-3">
            {filteredSupplies.map((supply) => {
              const unitCost = calculateSupplyUnitCost(supply);
              const stockMonetaryValue = supply.stockQuantity * unitCost;
              const equivalentPackages =
                supply.baseTotalQuantity > 0
                  ? supply.stockQuantity / supply.baseTotalQuantity
                  : 0;

              const isOut = supply.stockQuantity <= 0;
              const isLow =
                !isOut &&
                supply.minStockAlert > 0 &&
                supply.stockQuantity <= supply.minStockAlert;

              const targetReference = Math.max(
                supply.minStockAlert * 2.5,
                supply.baseTotalQuantity * 2,
                1
              );
              const barPercent = Math.min(
                100,
                Math.round((supply.stockQuantity / targetReference) * 100)
              );

              const usedInRecipes = getSupplyRecipesBadges(supply.id);
              const isEditingThis = editingStockId === supply.id;

              return (
                <div
                  key={supply.id}
                  className={`bg-white rounded-3xl p-4 border shadow-xs space-y-3 transition ${
                    isOut
                      ? 'border-red-400 ring-1 ring-red-200'
                      : isLow
                        ? 'border-amber-400'
                        : 'border-stone-200/90'
                  }`}
                >
                  {/* Top Row: Name, Status Badge & Current Quantity */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            supply.category === 'ingrediente'
                              ? 'bg-pink-50 text-pink-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {supply.category === 'ingrediente' ? 'Ingrediente' : 'Envase'}
                        </span>

                        {isOut ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-600 text-white">
                            🔴 Agotado (0)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                            🟡 Queda Poco (Mín: {supply.minStockAlert}
                            {supply.baseUnit})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            🟢 En Stock
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-stone-900 mt-1 leading-snug">
                        {supply.name}
                      </h3>

                      {/* Recipes that use this supply */}
                      {usedInRecipes.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {usedInRecipes.map((badge) => (
                            <span
                              key={badge}
                              className="text-[10px] font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Big Quantity Display */}
                    <div className="text-right bg-[#FDFBF7] border border-stone-200/90 rounded-2xl px-3.5 py-2 shrink-0">
                      <span className="text-[10px] font-bold uppercase text-stone-400 block">
                        Tienes hoy
                      </span>
                      <span
                        className={`text-xl font-black block leading-tight ${
                          isOut
                            ? 'text-red-600'
                            : isLow
                              ? 'text-amber-700'
                              : 'text-stone-900'
                        }`}
                      >
                        {supply.stockQuantity.toLocaleString('es-AR')} {supply.baseUnit}
                      </span>
                      <span className="text-[11px] font-bold text-pink-700 block">
                        ≈ {equivalentPackages.toFixed(1)} paq/env.
                      </span>
                    </div>
                  </div>

                  {/* Level Bar + Monetary Value Indicator */}
                  <div className="space-y-1">
                    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${barPercent}%` }}
                        className={`h-full transition-all ${
                          isOut
                            ? 'bg-red-500'
                            : isLow
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>
                        1 envase compra ={' '}
                        <strong>
                          {supply.baseTotalQuantity} {supply.baseUnit}
                        </strong>{' '}
                        ({formatMoney(supply.purchasePrice)})
                      </span>
                      <span>
                        Valor guardado: <strong>{formatMoney(stockMonetaryValue)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Quick Stock Controls OR Inline Exact Editor */}
                  {isEditingThis ? (
                    <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-amber-950">
                          Ajustar cantidad exacta que tienes:
                        </span>
                        <div className="inline-flex bg-white p-0.5 rounded-lg border border-amber-300 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setInputMode('base');
                              setStockInputVal(String(supply.stockQuantity));
                            }}
                            className={`px-2 py-0.5 rounded-md cursor-pointer ${
                              inputMode === 'base'
                                ? 'bg-amber-600 text-white'
                                : 'text-stone-600'
                            }`}
                          >
                            En {supply.baseUnit}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInputMode('packs');
                              setStockInputVal(
                                String(
                                  Number(
                                    (
                                      supply.stockQuantity /
                                      Math.max(1, supply.baseTotalQuantity)
                                    ).toFixed(2)
                                  )
                                )
                              );
                            }}
                            className={`px-2 py-0.5 rounded-md cursor-pointer ${
                              inputMode === 'packs'
                                ? 'bg-amber-600 text-white'
                                : 'text-stone-600'
                            }`}
                          >
                            En Paquetes/Latas
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-1">
                            Cantidad Actual (
                            {inputMode === 'packs'
                              ? `Paquetes de ${supply.baseTotalQuantity}${supply.baseUnit}`
                              : supply.baseUnit}
                            )
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            autoFocus
                            value={stockInputVal}
                            onChange={(e) => setStockInputVal(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-amber-400 rounded-xl text-sm font-black"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-1">
                            Avisarme si baja de ({supply.baseUnit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={minAlertInputVal}
                            onChange={(e) => setMinAlertInputVal(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-sm font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingStockId(null)}
                          className="flex-1 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-700 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveManualStock(supply)}
                          className="flex-1 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-extrabold cursor-pointer"
                        >
                          Guardar Stock
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            adjustSupplyStock(
                              supply.id,
                              supply.stockQuantity - supply.baseTotalQuantity
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold cursor-pointer"
                          title="Restar 1 paquete/envase"
                        >
                          <Minus className="w-3.5 h-3.5" /> 1 Paq. ({supply.baseTotalQuantity}
                          {supply.baseUnit})
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            adjustSupplyStock(
                              supply.id,
                              supply.stockQuantity + supply.baseTotalQuantity
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-2xs cursor-pointer"
                          title="Sumar 1 paquete/envase recién comprado"
                        >
                          <Plus className="w-3.5 h-3.5" /> +1 Paq. ({supply.baseTotalQuantity}
                          {supply.baseUnit})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => openStockEditor(supply)}
                        className="text-xs font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl cursor-pointer"
                      >
                        Escribir cantidad exacta
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
