import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CakeSlice,
  Check,
  CheckCircle2,
  Copy,
  Minus,
  Package,
  Plus,
  Search,
  Star,
  Wheat,
  X,
  XCircle,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  calculateSupplyUnitCost,
  calculateVariantCostBreakdown,
} from '../../services/calculations';
import { Recipe, Supply } from '../../types/domain';
import { SuppliesView } from '../supplies/SuppliesView';

export const SuppliesAndShoppingView: React.FC = () => {
  const {
    recipes,
    supplies,
    settings,
    formatMoney,
    adjustSupplyStock,
    adjustVariantReadyStock,
    upsertSupply,
  } = useStore();

  const [subTab, setSubTab] = useState<'stock' | 'precios'>('stock');
  // Selector de Torta para ver el Stock separado por cada torta ('all' o recipe.id)
  const [selectedCakeFilter, setSelectedCakeFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<
    'todos' | 'alertas' | 'ingrediente' | 'envase'
  >('todos');
  const [search, setSearch] = useState('');
  const [copiedLowStock, setCopiedLowStock] = useState(false);

  // Quick manual stock edit state
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockInputVal, setStockInputVal] = useState<string>('');
  const [minAlertInputVal, setMinAlertInputVal] = useState<string>('');
  const [assignedCakeVal, setAssignedCakeVal] = useState<string>('all');
  const [inputMode, setInputMode] = useState<'base' | 'packs'>('base');

  // Helper: check if a supply belongs to a specific cake
  const doesSupplyBelongToRecipe = (supply: Supply, recipe: Recipe): boolean => {
    if (supply.assignedRecipeId && supply.assignedRecipeId !== 'all') {
      return supply.assignedRecipeId === recipe.id;
    }
    const inBase = recipe.baseIngredients.some((i) => i.supplyId === supply.id);
    const inPkg = recipe.variants.some(
      (v) =>
        v.packagingItems.some((p) => p.supplyId === supply.id) ||
        (v.customIngredients &&
          v.customIngredients.some((ci) => ci.supplyId === supply.id))
    );
    return inBase || inPkg;
  };

  // Supplies filtered by the active Cake tab first
  const cakeScopedSupplies = useMemo(() => {
    if (selectedCakeFilter === 'all') return supplies;
    const targetRecipe = recipes.find((r) => r.id === selectedCakeFilter);
    if (!targetRecipe) return supplies;
    return supplies.filter((s) => doesSupplyBelongToRecipe(s, targetRecipe));
  }, [supplies, recipes, selectedCakeFilter]);

  // 1. Stock Indicators for the selected Cake (or All)
  const stockMetrics = useMemo(() => {
    let totalInventoryValue = 0;
    let optimalCount = 0;
    let lowCount = 0;
    let outOfStockCount = 0;

    for (const s of cakeScopedSupplies) {
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
  }, [cakeScopedSupplies]);

  // 2. Ready Cakes Stock Summary (Tortas / Vasos ya listos en heladera por Torta y Especialidad)
  const readyCakesSummary = useMemo(() => {
    let totalReadyUnits = 0;
    let totalReadySaleValue = 0;

    const targetRecipes =
      selectedCakeFilter === 'all'
        ? recipes
        : recipes.filter((r) => r.id === selectedCakeFilter);

    for (const r of targetRecipes) {
      const specs =
        r.specialties && r.specialties.length > 0
          ? r.specialties
          : [
              {
                id: 'default',
                name: 'Clásica (Normal)',
                emoji: '✨',
                isDefault: true,
                extraBaseCost: 0,
              },
            ];
      for (const v of r.variants) {
        for (const sp of specs) {
          const qty = v.readyStockBySpecialty?.[sp.id] || 0;
          if (qty > 0) {
            totalReadyUnits += qty;
            const b = calculateVariantCostBreakdown(r, v, supplies, sp);
            totalReadySaleValue += qty * b.effectiveSalePrice;
          }
        }
      }
    }

    return { totalReadyUnits, totalReadySaleValue, targetRecipes };
  }, [recipes, supplies, selectedCakeFilter]);

  // Filtered supplies for stock cards
  const filteredSupplies = useMemo(() => {
    return cakeScopedSupplies.filter((s) => {
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
  }, [cakeScopedSupplies, stockFilter, search]);

  const openStockEditor = (supply: Supply) => {
    setEditingStockId(supply.id);
    setInputMode('base');
    setStockInputVal(String(supply.stockQuantity));
    setMinAlertInputVal(String(supply.minStockAlert));
    setAssignedCakeVal(supply.assignedRecipeId || 'all');
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
      assignedRecipeId: assignedCakeVal === 'all' ? undefined : assignedCakeVal,
      purchasePrice: supply.purchasePrice,
      purchaseAmount: supply.purchaseAmount,
      purchaseUnit: supply.purchaseUnit,
      stockQuantity: finalBaseStock,
      minStockAlert: nextMinAlert,
    });
    setEditingStockId(null);
  };

  const handleCopyLowStockList = () => {
    const activeCakeObj = recipes.find((r) => r.id === selectedCakeFilter);
    const titleScope = activeCakeObj
      ? `${activeCakeObj.emoji} ${activeCakeObj.name.toUpperCase()}`
      : settings.businessName.toUpperCase();

    const alertItems = cakeScopedSupplies.filter(
      (s) =>
        s.stockQuantity <= 0 ||
        (s.minStockAlert > 0 && s.stockQuantity <= s.minStockAlert)
    );
    const lines = [
      `🛒 *LISTA DE COMPRAS (${titleScope})*`,
      '',
      ...alertItems.map((s) => {
        const statusLabel = s.stockQuantity <= 0 ? '🔴 AGOTADO' : '🟡 QUEDA POCO';
        return `• ${statusLabel}: *${s.name}* (Tienes: ${s.stockQuantity} ${s.baseUnit} / Mínimo: ${s.minStockAlert} ${s.baseUnit})`;
      }),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedLowStock(true);
    setTimeout(() => setCopiedLowStock(false), 3000);
  };

  const getSupplyCakesBadges = (supply: Supply) => {
    if (supply.assignedRecipeId && supply.assignedRecipeId !== 'all') {
      const target = recipes.find((r) => r.id === supply.assignedRecipeId);
      return target ? [`${target.emoji} Exclusivo ${target.name}`] : [];
    }
    return recipes
      .filter((r) => doesSupplyBelongToRecipe(supply, r))
      .map((r) => `${r.emoji} ${r.name}`);
  };

  const selectedCakeObj = recipes.find((r) => r.id === selectedCakeFilter);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Switcher: Mi Stock por Torta vs Precios de Paquetes */}
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
          Stock por Torta y Alacena
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
          {/* SELECTOR DE TORTA PARA SEPARAR EL STOCK DE CADA TORTA */}
          <div className="bg-white rounded-3xl p-3.5 border border-stone-200/90 shadow-xs space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block px-1">
              🍰 Elige una Torta para ver su Stock Separado:
            </span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedCakeFilter('all')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                  selectedCakeFilter === 'all'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                📋 Todas las Tortas ({supplies.length})
              </button>

              {recipes.map((r) => {
                const isSelected = selectedCakeFilter === r.id;
                const countForCake = supplies.filter((s) =>
                  doesSupplyBelongToRecipe(s, r)
                ).length;

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedCakeFilter(r.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold shrink-0 transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-pink-700 text-white border-pink-700 shadow-sm'
                        : 'bg-[#FDFBF7] text-stone-800 border-stone-200 hover:border-pink-300'
                    }`}
                  >
                    <span className="text-base">{r.emoji}</span>
                    <span>{r.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-200/80 text-stone-600'
                      }`}
                    >
                      {countForCake}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. STOCK DE TORTAS Y VASOS LISTOS EN HELADERA (SEPARADO POR TORTA Y VERSIÓN NORMAL/ESPECIAL) */}
          <div className="bg-white rounded-3xl p-4 border border-stone-200/90 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-pink-50 text-pink-700">
                  <CakeSlice className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-stone-900">
                    🧊 Tortas y Porciones Listas en Heladera
                    {selectedCakeObj ? ` — ${selectedCakeObj.name}` : ''}
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Lleva el control separado de cuántas unidades tienes hechas hoy (Normal vs.
                    Especial).
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-1.5 text-right">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                  Listas p/ vender: {readyCakesSummary.totalReadyUnits} u.
                </span>
                <span className="text-sm font-black text-emerald-900">
                  Valor venta: {formatMoney(readyCakesSummary.totalReadySaleValue)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {readyCakesSummary.targetRecipes.map((recipe) => {
                const specs =
                  recipe.specialties && recipe.specialties.length > 0
                    ? recipe.specialties
                    : [
                        {
                          id: 'default',
                          name: 'Clásica (Normal)',
                          emoji: '✨',
                          isDefault: true,
                          extraBaseCost: 0,
                        },
                      ];

                return (
                  <div
                    key={recipe.id}
                    className="rounded-2xl border border-stone-200/90 bg-[#FDFBF7] p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-stone-200/70 pb-2">
                      <span className="text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                        <span className="text-lg">{recipe.emoji}</span> {recipe.name}
                      </span>
                      <span className="text-[11px] font-bold text-pink-700 bg-pink-50 px-2.5 py-0.5 rounded-full">
                        {specs.length} versión(es) · {recipe.variants.length} tamaños
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {specs.map((spec) => (
                        <div
                          key={spec.id}
                          className="bg-white rounded-2xl p-3 border border-stone-200/80 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1">
                              <span>{spec.emoji}</span> {spec.name}
                              {!spec.isDefault && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md ml-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                  Especial
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {recipe.variants.map((variant) => {
                              const readyQty =
                                variant.readyStockBySpecialty?.[spec.id] || 0;
                              const b = calculateVariantCostBreakdown(
                                recipe,
                                variant,
                                supplies,
                                spec
                              );

                              return (
                                <div
                                  key={`${spec.id}-${variant.id}`}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${
                                    readyQty > 0
                                      ? 'bg-emerald-50/70 border-emerald-300'
                                      : 'bg-stone-50/70 border-stone-200/70'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-stone-900 truncate">
                                      {variant.name}
                                    </p>
                                    <p className="text-[10px] text-stone-500">
                                      Venta: <strong>{formatMoney(b.effectiveSalePrice)}</strong>
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        adjustVariantReadyStock(
                                          recipe.id,
                                          variant.id,
                                          spec.id,
                                          readyQty - 1
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-stone-700 font-bold cursor-pointer"
                                      title="Restar 1 unidad lista"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span
                                      className={`min-w-[28px] text-center text-sm font-black ${
                                        readyQty > 0 ? 'text-emerald-800' : 'text-stone-400'
                                      }`}
                                    >
                                      {readyQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        adjustVariantReadyStock(
                                          recipe.id,
                                          variant.id,
                                          spec.id,
                                          readyQty + 1
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold cursor-pointer"
                                      title="Sumar 1 unidad lista"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. TABLERO DE INSUMOS Y ENVASES DE LA TORTA SELECCIONADA */}
          <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 rounded-3xl p-5 text-white shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full mb-1.5">
                  <Boxes className="w-3.5 h-3.5" />{' '}
                  {selectedCakeObj
                    ? `Alacena Exclusiva: ${selectedCakeObj.name}`
                    : 'Alacena General de Ingredientes y Envases'}
                </span>
                <h1 className="text-xl font-black tracking-tight">
                  {selectedCakeObj
                    ? `${selectedCakeObj.emoji} Insumos de ${selectedCakeObj.name}`
                    : 'Tu Stock de Ingredientes y Envases'}
                </h1>
                <p className="text-xs text-stone-300 mt-0.5">
                  {selectedCakeObj
                    ? `Aquí ves únicamente los ingredientes y envases asignados a ${selectedCakeObj.name}.`
                    : 'Suma o resta lo que tienes en casa o filtra arriba por cada torta.'}
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-2xl px-3.5 py-2 text-right">
                <span className="text-[10px] uppercase tracking-wider text-amber-200 font-bold block">
                  Dinero en Insumos{' '}
                  {selectedCakeObj ? `(${selectedCakeObj.name})` : 'Guardados'}
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
                    Copiar los {stockMetrics.alertsTotal} insumos faltantes
                    {selectedCakeObj ? ` de ${selectedCakeObj.name}` : ''} para ir a comprar
                  </>
                )}
              </button>
            )}
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
                Todos ({cakeScopedSupplies.length})
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
                {cakeScopedSupplies.filter((s) => s.category === 'ingrediente').length})
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
                Envases (
                {cakeScopedSupplies.filter((s) => s.category === 'envase').length})
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

              const cakeBadges = getSupplyCakesBadges(supply);
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

                      {/* Tortas que usan este insumo */}
                      {cakeBadges.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {cakeBadges.map((badge) => (
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
                          Ajustar Stock y Torta asignada:
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

                      <div>
                        <label className="block text-[10px] font-bold text-stone-600 mb-1">
                          ¿A qué torta pertenece este insumo?
                        </label>
                        <select
                          value={assignedCakeVal}
                          onChange={(e) => setAssignedCakeVal(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                        >
                          <option value="all">📋 Uso General / Compartido entre tortas</option>
                          {recipes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.emoji} Exclusivo para {r.name}
                            </option>
                          ))}
                        </select>
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
                        Editar Stock / Asignar Torta
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
