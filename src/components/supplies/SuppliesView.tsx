import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  calculateSupplyUnitCost,
  formatUnitCost,
  normalizeToBaseUnit,
} from '../../services/calculations';
import { PurchaseUnit, Supply, SupplyCategory } from '../../types/domain';

export const SuppliesView: React.FC = () => {
  const {
    supplies,
    recipes,
    settings,
    formatMoney,
    upsertSupply,
    updateSupplyPriceQuick,
    deleteSupply,
    lastCascadeNotice,
    clearCascadeNotice,
  } = useStore();

  const [categoryFilter, setCategoryFilter] = useState<'todos' | SupplyCategory | 'bajo_stock'>('todos');
  const [search, setSearch] = useState('');

  // Quick price editing state
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickPriceValue, setQuickPriceValue] = useState<string>('');

  // Modal state for full create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplyId, setEditingSupplyId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SupplyCategory>('ingrediente');
  const [formPrice, setFormPrice] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formUnit, setFormUnit] = useState<PurchaseUnit>('kg');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('');

  const lowStockCount = useMemo(
    () => supplies.filter((s) => s.stockQuantity <= s.minStockAlert && s.minStockAlert > 0).length,
    [supplies]
  );

  const filteredSupplies = useMemo(() => {
    return supplies.filter((s) => {
      if (categoryFilter === 'ingrediente' && s.category !== 'ingrediente') return false;
      if (categoryFilter === 'envase' && s.category !== 'envase') return false;
      if (
        categoryFilter === 'bajo_stock' &&
        !(s.stockQuantity <= s.minStockAlert && s.minStockAlert > 0)
      ) {
        return false;
      }
      if (search.trim()) {
        return s.name.toLowerCase().includes(search.trim().toLowerCase());
      }
      return true;
    });
  }, [supplies, categoryFilter, search]);

  const openNewModal = (defaultCat: SupplyCategory = 'ingrediente') => {
    setEditingSupplyId(null);
    setFormName('');
    setFormCategory(defaultCat);
    setFormPrice('');
    setFormAmount(defaultCat === 'ingrediente' ? '1' : '10');
    setFormUnit(defaultCat === 'ingrediente' ? 'kg' : 'pack');
    setFormStock('0');
    setFormMinStock('0');
    setIsModalOpen(true);
  };

  const openEditModal = (supply: Supply) => {
    setEditingSupplyId(supply.id);
    setFormName(supply.name);
    setFormCategory(supply.category);
    setFormPrice(String(supply.purchasePrice));
    setFormAmount(String(supply.purchaseAmount));
    setFormUnit(supply.purchaseUnit);
    setFormStock(String(supply.stockQuantity));
    setFormMinStock(String(supply.minStockAlert));
    setIsModalOpen(true);
  };

  const handleSaveSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    const price = Math.max(0, Number(formPrice) || 0);
    const amount = Math.max(0.001, Number(formAmount) || 1);
    const stock = Math.max(0, Number(formStock) || 0);
    const minStock = Math.max(0, Number(formMinStock) || 0);

    upsertSupply({
      id: editingSupplyId || undefined,
      name: formName.trim(),
      category: formCategory,
      purchasePrice: price,
      purchaseAmount: amount,
      purchaseUnit: formUnit,
      stockQuantity: stock,
      minStockAlert: minStock,
    });
    setIsModalOpen(false);
  };

  const startQuickPriceEdit = (supply: Supply) => {
    setQuickEditId(supply.id);
    setQuickPriceValue(String(supply.purchasePrice));
  };

  const confirmQuickPriceEdit = (supplyId: string) => {
    const val = Number(quickPriceValue);
    if (!Number.isNaN(val) && val >= 0) {
      updateSupplyPriceQuick(supplyId, val);
    }
    setQuickEditId(null);
  };

  // Live preview inside modal
  const modalPreview = useMemo(() => {
    const price = Math.max(0, Number(formPrice) || 0);
    const amount = Math.max(0.001, Number(formAmount) || 1);
    const norm = normalizeToBaseUnit(amount, formUnit);
    const unitCost = norm.baseTotalQuantity > 0 ? price / norm.baseTotalQuantity : 0;
    return {
      ...norm,
      unitCost,
    };
  }, [formPrice, formAmount, formUnit]);

  const getRecipesUsingSupply = (supplyId: string) => {
    return recipes.filter(
      (r) =>
        r.baseIngredients.some((i) => i.supplyId === supplyId) ||
        r.variants.some((v) => v.packagingItems.some((p) => p.supplyId === supplyId))
    );
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-pink-700 via-rose-700 to-amber-700 rounded-2xl p-4 text-white shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full mb-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Paso 1 · Inventario Inteligente
            </span>
            <h1 className="text-xl font-bold leading-tight">Insumos y Packaging</h1>
            <p className="text-xs text-pink-100 mt-1">
              Carga el precio del paquete y la app calcula sola el costo por{' '}
              <strong>gramo, ml o unidad</strong>. Si actualizas un precio, todas tus recetas se
              recalculan al instante.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            onClick={() => openNewModal('ingrediente')}
            className="flex items-center justify-center gap-2 bg-white text-pink-800 font-semibold text-sm py-2.5 px-3 rounded-xl shadow-sm active:scale-98 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            + Ingrediente
          </button>
          <button
            onClick={() => openNewModal('envase')}
            className="flex items-center justify-center gap-2 bg-pink-900/50 hover:bg-pink-900/70 border border-white/25 text-white font-semibold text-sm py-2.5 px-3 rounded-xl active:scale-98 transition cursor-pointer"
          >
            <Package className="w-4 h-4" />
            + Envase / Caja
          </button>
        </div>
      </div>

      {/* Cascade Update Notification Banner */}
      {lastCascadeNotice && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                Recálculo en Cascada Completado
              </p>
              <p className="text-sm text-emerald-800 mt-0.5">{lastCascadeNotice}</p>
            </div>
          </div>
          <button
            onClick={clearCascadeNotice}
            className="text-emerald-600 hover:text-emerald-900 p-1 cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Category Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar harina, leche condensada, cajas..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
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
            onClick={() => setCategoryFilter('todos')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              categoryFilter === 'todos'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200'
            }`}
          >
            Todos ({supplies.length})
          </button>
          <button
            onClick={() => setCategoryFilter('ingrediente')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              categoryFilter === 'ingrediente'
                ? 'bg-pink-700 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200'
            }`}
          >
            <Wheat className="w-3.5 h-3.5" />
            Ingredientes ({supplies.filter((s) => s.category === 'ingrediente').length})
          </button>
          <button
            onClick={() => setCategoryFilter('envase')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              categoryFilter === 'envase'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-stone-600 border border-stone-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Envases ({supplies.filter((s) => s.category === 'envase').length})
          </button>
          {lowStockCount > 0 && (
            <button
              onClick={() => setCategoryFilter('bajo_stock')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                categoryFilter === 'bajo_stock'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Stock Bajo ({lowStockCount})
            </button>
          )}
        </div>
      </div>

      {/* Supplies List */}
      <div className="space-y-2.5">
        {filteredSupplies.map((supply) => {
          const unitCost = calculateSupplyUnitCost(supply);
          const usedIn = getRecipesUsingSupply(supply.id);
          const isLowStock =
            supply.minStockAlert > 0 && supply.stockQuantity <= supply.minStockAlert;
          const isQuickEditing = quickEditId === supply.id;

          return (
            <div
              key={supply.id}
              className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs hover:border-pink-200 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        supply.category === 'ingrediente'
                          ? 'bg-pink-50 text-pink-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {supply.category === 'ingrediente' ? 'Ingrediente' : 'Packaging'}
                    </span>
                    {isLowStock && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700">
                        <AlertTriangle className="w-3 h-3" /> Stock bajo ({supply.stockQuantity}
                        {supply.baseUnit})
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-stone-900 text-base mt-1 leading-snug">
                    {supply.name}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Envase de compra:{' '}
                    <span className="font-semibold text-stone-700">
                      {supply.purchaseAmount} {supply.purchaseUnit}
                    </span>{' '}
                    ({supply.baseTotalQuantity.toLocaleString('es-AR')} {supply.baseUnit})
                  </p>
                </div>

                {/* Calculated Cost per Base Unit Badge */}
                <div className="text-right bg-stone-50 border border-stone-200/80 rounded-xl px-3 py-1.5 shrink-0">
                  <span className="block text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                    Costo x {supply.baseUnit === 'u' ? 'unidad' : supply.baseUnit}
                  </span>
                  <span className="text-sm font-extrabold text-pink-700">
                    {formatUnitCost(unitCost, settings.currencySymbol)} / {supply.baseUnit}
                  </span>
                </div>
              </div>

              {/* Price & Quick Update Row */}
              <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap">
                {isQuickEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-semibold text-stone-600">Nuevo precio:</span>
                    <div className="relative flex-1 max-w-[150px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                        {settings.currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        autoFocus
                        value={quickPriceValue}
                        onChange={(e) => setQuickPriceValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmQuickPriceEdit(supply.id);
                          if (e.key === 'Escape') setQuickEditId(null);
                        }}
                        className="w-full pl-6 pr-2 py-1 text-sm font-bold border border-pink-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    </div>
                    <button
                      onClick={() => confirmQuickPriceEdit(supply.id)}
                      className="bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 cursor-pointer"
                      title="Guardar nuevo precio"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setQuickEditId(null)}
                      className="bg-stone-200 text-stone-700 p-1.5 rounded-lg hover:bg-stone-300 cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">Precio compra:</span>
                    <span className="text-sm font-bold text-stone-900">
                      {formatMoney(supply.purchasePrice)}
                    </span>
                    <button
                      onClick={() => startQuickPriceEdit(supply)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-pink-700 bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Cambiar precio
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  {usedIn.length > 0 && (
                    <span className="text-[11px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                      En {usedIn.length} receta{usedIn.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    onClick={() => openEditModal(supply)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer"
                    title="Editar insumo completo"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar "${supply.name}" del inventario de insumos?`
                        )
                      ) {
                        deleteSupply(supply.id);
                      }
                    }}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Eliminar insumo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredSupplies.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-stone-300">
            <p className="text-stone-600 font-medium text-sm">
              No se encontraron insumos con ese filtro.
            </p>
            <button
              onClick={() => openNewModal('ingrediente')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 bg-pink-50 px-3.5 py-2 rounded-xl"
            >
              <Plus className="w-4 h-4" /> Cargar nuevo insumo
            </button>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Supply */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-900">
                {editingSupplyId ? 'Editar Insumo / Envase' : 'Nuevo Insumo / Envase'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupply} className="space-y-4 mt-4">
              {/* Category Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setFormCategory('ingrediente');
                    if (!editingSupplyId) setFormUnit('kg');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    formCategory === 'ingrediente'
                      ? 'bg-white text-pink-700 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  🥛 Ingrediente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormCategory('envase');
                    if (!editingSupplyId) setFormUnit('pack');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    formCategory === 'envase'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  📦 Envase / Packaging
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nombre del {formCategory === 'ingrediente' ? 'ingrediente' : 'envase'} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formCategory === 'ingrediente'
                      ? 'Ej: Leche Condensada (Lata 395g)'
                      : 'Ej: Caja Torta Mediana 20cm'
                  }
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Precio del Paquete ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="Ej: 2400"
                    className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Cantidad que trae *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      required
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="Ej: 395"
                      className="w-full px-3 py-2.5 border border-stone-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <select
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value as PurchaseUnit)}
                      className="px-2.5 py-2.5 bg-stone-100 border border-stone-300 rounded-xl text-xs font-bold text-stone-800 focus:outline-none"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">Litros</option>
                      <option value="u">Unid.</option>
                      <option value="docena">Docena</option>
                      <option value="pack">Pack u.</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Automatic Calculation Preview Box */}
              <div className="bg-pink-50/80 border border-pink-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pink-800 block">
                    Cálculo Automático de la App
                  </span>
                  <span className="text-xs text-pink-700">
                    Equivale a{' '}
                    <strong>
                      {modalPreview.baseTotalQuantity.toLocaleString('es-AR')}{' '}
                      {modalPreview.baseUnit}
                    </strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-pink-700 block">Costo unitario:</span>
                  <span className="text-base font-extrabold text-pink-900">
                    {formatUnitCost(modalPreview.unitCost, settings.currencySymbol)} /{' '}
                    {modalPreview.baseUnit}
                  </span>
                </div>
              </div>

              {/* Optional Stock Control */}
              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs font-bold text-stone-600 mb-2">
                  Control de Stock Físico en Alacena (Opcional en {modalPreview.baseUnit})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">
                      Stock actual ({modalPreview.baseUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">
                      Avisar si baja de ({modalPreview.baseUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-pink-700 hover:bg-pink-800 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  Guardar y Recalcular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

