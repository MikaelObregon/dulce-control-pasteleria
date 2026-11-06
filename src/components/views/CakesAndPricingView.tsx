import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Edit3,
  Flame,
  Layers,
  Lock,
  Minus,
  Package,
  Percent,
  Plus,
  RotateCcw,
  Scale,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  calculateVariantCostBreakdown,
  formatUnitCost,
  simulatePricing,
} from '../../services/calculations';
import {
  Recipe,
  RecipeIngredientLine,
  RecipePackagingLine,
  RecipeVariant,
  SizeFormat,
} from '../../types/domain';

const FORMAT_LABELS: Record<SizeFormat, { label: string; icon: string }> = {
  individual: { label: 'Individual / Vaso', icon: '🥤' },
  porcion: { label: 'Porción', icon: '🍰' },
  chica: { label: 'Chica', icon: '🎂' },
  mediana: { label: 'Mediana', icon: '🎂' },
  grande: { label: 'Grande Familiar', icon: '👑' },
};

export const CakesAndPricingView: React.FC = () => {
  const {
    recipes,
    supplies,
    settings,
    formatMoney,
    applyPricingToVariant,
    updateRecipeBaseIngredients,
    updateVariantCustomIngredients,
    upsertVariant,
    deleteVariant,
    upsertRecipe,
  } = useStore();

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    recipes[0]?.id || 'recipe-tres-leches'
  );

  const activeRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) || recipes[0],
    [recipes, selectedRecipeId]
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    activeRecipe?.variants.find((v) => v.format === 'mediana')?.id ||
      activeRecipe?.variants[0]?.id ||
      ''
  );

  const activeVariant = useMemo(() => {
    if (!activeRecipe) return null;
    return (
      activeRecipe.variants.find((v) => v.id === selectedVariantId) ||
      activeRecipe.variants.find((v) => v.format === 'mediana') ||
      activeRecipe.variants[0] ||
      null
    );
  }, [activeRecipe, selectedVariantId]);

  const breakdown = useMemo(() => {
    if (!activeRecipe || !activeVariant) return null;
    return calculateVariantCostBreakdown(activeRecipe, activeVariant, supplies);
  }, [activeRecipe, activeVariant, supplies]);

  // Pricing interactive states
  const [desiredPercent, setDesiredPercent] = useState<number>(
    activeVariant?.defaultMarkupPercent ?? 100
  );
  const [customPriceInput, setCustomPriceInput] = useState<string>(
    activeVariant?.manualSalePrice ? String(activeVariant.manualSalePrice) : ''
  );
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [showRecipeDetails, setShowRecipeDetails] = useState(false);

  // Modals for editing recipe / custom variant ingredients / sizes / new product
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [editingMode, setEditingMode] = useState<'base' | 'variant_custom'>('base');
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredientLine[]>([]);

  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [vName, setVName] = useState('');
  const [vFormat, setVFormat] = useState<SizeFormat>('mediana');
  const [vServings, setVServings] = useState('');
  const [vScale, setVScale] = useState('1');
  const [vUtilityPct, setVUtilityPct] = useState('6');
  const [vPackaging, setVPackaging] = useState<RecipePackagingLine[]>([]);

  const [isNewRecipeModalOpen, setIsNewRecipeModalOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeEmoji, setNewRecipeEmoji] = useState('🍰');

  useEffect(() => {
    if (activeVariant) {
      setDesiredPercent(activeVariant.defaultMarkupPercent);
      setCustomPriceInput(
        activeVariant.manualSalePrice ? String(activeVariant.manualSalePrice) : ''
      );
    }
  }, [activeVariant]);

  const ingredientSupplies = useMemo(
    () => supplies.filter((s) => s.category === 'ingrediente'),
    [supplies]
  );
  const packagingSupplies = useMemo(
    () => supplies.filter((s) => s.category === 'envase'),
    [supplies]
  );

  const simulation = useMemo(() => {
    if (!breakdown) return null;
    return simulatePricing(breakdown.totalProductionCost, desiredPercent, 'markup');
  }, [breakdown, desiredPercent]);

  if (!activeRecipe || !activeVariant || !breakdown || !simulation) {
    return null;
  }

  // Suggested price based on desired % markup
  const suggestedPrice = simulation.suggestedPriceRounded;
  const suggestedProfit = suggestedPrice - breakdown.totalProductionCost;

  // User's custom price (if entered) vs suggested price
  const hasCustomPrice =
    customPriceInput.trim() !== '' && Number(customPriceInput) > 0;
  const finalActivePrice = hasCustomPrice
    ? Number(customPriceInput)
    : suggestedPrice;

  const finalNetProfit = finalActivePrice - breakdown.totalProductionCost;
  const finalMarkupPercent =
    breakdown.totalProductionCost > 0
      ? (finalNetProfit / breakdown.totalProductionCost) * 100
      : 0;
  const finalMarginPercent =
    finalActivePrice > 0 ? (finalNetProfit / finalActivePrice) * 100 : 0;
  const diffFromSuggested = finalActivePrice - suggestedPrice;
  const isLosingMoney = finalNetProfit <= 0;

  const stepAmount = suggestedPrice >= 2000 ? 500 : 100;

  const nudgeCustomPrice = (delta: number) => {
    const baseVal = hasCustomPrice ? Number(customPriceInput) : suggestedPrice;
    const nextVal = Math.max(0, baseVal + delta);
    setCustomPriceInput(String(nextVal));
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id);
    const defaultVar =
      recipe.variants.find((v) => v.format === 'mediana') || recipe.variants[0];
    if (defaultVar) setSelectedVariantId(defaultVar.id);
  };

  const handleSavePriceToCatalog = (useCustom: boolean) => {
    const manualVal =
      useCustom && customPriceInput && Number(customPriceInput) > 0
        ? Number(customPriceInput)
        : undefined;

    if (!useCustom) {
      setCustomPriceInput('');
    }

    applyPricingToVariant(
      activeRecipe.id,
      activeVariant.id,
      desiredPercent,
      manualVal
    );
    setSaveFeedback(
      manualVal
        ? `¡Precio guardado! "${activeVariant.name}" quedó en ${formatMoney(manualVal)}.`
        : `¡Precio sugerido guardado! "${activeVariant.name}" quedó en ${formatMoney(suggestedPrice)} (+${desiredPercent}%).`
    );
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  const handleCopyWhatsAppCatalog = () => {
    const lines: string[] = [
      `🍰 *LISTA DE PRECIOS — ${settings.businessName.toUpperCase()}* 🍰`,
      '',
    ];
    for (const r of recipes) {
      lines.push(`${r.emoji} *${r.name}*`);
      for (const v of r.variants) {
        const b = calculateVariantCostBreakdown(r, v, supplies);
        lines.push(
          `  • ${v.name} (${v.servingsLabel}): *${formatMoney(b.effectiveSalePrice)}*`
        );
      }
      lines.push('');
    }
    lines.push('📲 ¡Consúltanos disponibilidad para tu fecha!');

    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  const openIngredientsEditor = (mode: 'base' | 'variant_custom') => {
    setEditingMode(mode);
    if (mode === 'base') {
      setDraftIngredients(activeRecipe.baseIngredients.map((i) => ({ ...i })));
    } else {
      const currentList =
        activeVariant.customIngredients && activeVariant.customIngredients.length > 0
          ? activeVariant.customIngredients
          : activeRecipe.baseIngredients.map((i) => ({
              supplyId: i.supplyId,
              quantity: Number((i.quantity * activeVariant.scaleFactor).toFixed(1)),
            }));
      setDraftIngredients(currentList.map((i) => ({ ...i })));
    }
    setIsEditingBase(true);
  };

  const saveIngredientsModal = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = draftIngredients.filter((i) => i.supplyId && i.quantity > 0);
    if (editingMode === 'base') {
      updateRecipeBaseIngredients(activeRecipe.id, valid);
    } else {
      updateVariantCustomIngredients(activeRecipe.id, activeVariant.id, valid);
    }
    setIsEditingBase(false);
  };

  const openEditVariantModal = (variant?: RecipeVariant) => {
    if (variant) {
      setEditingVariantId(variant.id);
      setVName(variant.name);
      setVFormat(variant.format);
      setVServings(variant.servingsLabel);
      setVScale(String(variant.scaleFactor));
      setVUtilityPct(String(variant.utilityPercent));
      setVPackaging(variant.packagingItems.map((p) => ({ ...p })));
    } else {
      setEditingVariantId(null);
      setVName('');
      setVFormat('porcion');
      setVServings('1 porción');
      setVScale('0.125');
      setVUtilityPct(String(settings.defaultUtilityPercent));
      setVPackaging(
        packagingSupplies[0] ? [{ supplyId: packagingSupplies[0].id, quantity: 1 }] : []
      );
    }
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;
    const id = editingVariantId || `var-${Date.now()}`;
    const newVar: RecipeVariant = {
      id,
      name: vName.trim(),
      format: vFormat,
      servingsLabel: vServings.trim() || FORMAT_LABELS[vFormat].label,
      scaleFactor: Math.max(0.01, Number(vScale) || 1),
      customIngredients: activeVariant.customIngredients,
      packagingItems: vPackaging.filter((p) => p.supplyId && p.quantity > 0),
      utilityPercent: Math.max(0, Number(vUtilityPct) || 0),
      defaultMarkupPercent: desiredPercent,
      manualSalePrice: activeVariant.manualSalePrice,
    };
    upsertVariant(activeRecipe.id, newVar);
    setSelectedVariantId(id);
    setIsVariantModalOpen(false);
  };

  const handleCreateNewRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName.trim()) return;
    const newId = `recipe-${Date.now()}`;
    const defaultVarId = `var-${Date.now()}-med`;
    const newRecipe: Recipe = {
      id: newId,
      name: newRecipeName.trim(),
      description: 'Receta artesanal personalizada',
      emoji: newRecipeEmoji || '🍰',
      accentColor: 'pink',
      baseYieldLabel: 'Receta Base = 1 Torta Mediana (8 porciones)',
      baseIngredients: ingredientSupplies.slice(0, 3).map((s) => ({
        supplyId: s.id,
        quantity: s.baseUnit === 'u' ? 3 : 200,
      })),
      variants: [
        {
          id: defaultVarId,
          name: 'Mediana Estándar',
          format: 'mediana',
          servingsLabel: '8 porciones',
          scaleFactor: 1,
          packagingItems: packagingSupplies[0]
            ? [{ supplyId: packagingSupplies[0].id, quantity: 1 }]
            : [],
          utilityPercent: settings.defaultUtilityPercent,
          defaultMarkupPercent: settings.defaultMarkupPercent,
        },
      ],
    };
    upsertRecipe(newRecipe);
    setSelectedRecipeId(newId);
    setSelectedVariantId(defaultVarId);
    setIsNewRecipeModalOpen(false);
    setNewRecipeName('');
  };

  return (
    <div className="space-y-4 pb-12">
      {/* 1. ENCABEZADO CÁLIDO + BOTÓN WHATSAPP */}
      <div className="bg-gradient-to-r from-rose-800 via-pink-700 to-amber-700 rounded-3xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full mb-1.5">
              <ChefHat className="w-3.5 h-3.5" /> Catálogo + Costos + Calculadora
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Tus Tortas y Precios
            </h1>
            <p className="text-xs text-rose-100 mt-0.5">
              Compara el precio sugerido o pon tu propio precio manual y mira tu ganancia al
              instante.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyWhatsAppCatalog}
            className="inline-flex items-center gap-2 bg-white text-rose-900 hover:bg-rose-50 text-xs font-extrabold px-4 py-3 rounded-2xl shadow-sm active:scale-98 transition cursor-pointer shrink-0"
          >
            {copiedWhatsApp ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                ¡Copiado para WhatsApp!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-rose-700" />
                Copiar Lista p/ WhatsApp
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. TARJETAS DE PRODUCTOS (TRES LECHES, MARQUESAS, TORTA DE PIÑA) */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
        {recipes.map((recipe) => {
          const isSelected = recipe.id === activeRecipe.id;
          const prices = recipe.variants.map(
            (v) => calculateVariantCostBreakdown(recipe, v, supplies).effectiveSalePrice
          );
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);

          return (
            <button
              key={recipe.id}
              onClick={() => handleSelectRecipe(recipe)}
              className={`flex items-center gap-3 px-4 py-3 rounded-3xl border-2 text-left shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-stone-900 text-white border-stone-900 shadow-md scale-[1.01]'
                  : 'bg-white text-stone-800 border-stone-200/90 hover:border-pink-300 shadow-2xs'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                  isSelected ? 'bg-white/15' : 'bg-amber-50'
                }`}
              >
                {recipe.emoji}
              </div>
              <div>
                <p className="text-sm font-extrabold leading-tight whitespace-nowrap">
                  {recipe.name}
                </p>
                <p
                  className={`text-[11px] font-semibold mt-0.5 ${
                    isSelected ? 'text-amber-300' : 'text-pink-700'
                  }`}
                >
                  {formatMoney(minPrice)} a {formatMoney(maxPrice)}
                </p>
              </div>
            </button>
          );
        })}

        <button
          onClick={() => setIsNewRecipeModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-3xl border-2 border-dashed border-pink-300 bg-pink-50/60 text-pink-800 text-xs font-extrabold shrink-0 hover:bg-pink-100 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> + Otra Torta
        </button>
      </div>

      {/* 3. SELECTOR TÁCTIL DE TAMAÑO / FORMATO */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-pink-700" />
            Tamaño de {activeRecipe.name}:
          </span>
          <button
            onClick={() => openEditVariantModal(undefined)}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-pink-700 bg-pink-50 hover:bg-pink-100 px-3 py-1 rounded-full transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Tamaño
          </button>
        </div>

        <div className="flex sm:grid sm:grid-cols-5 gap-2 overflow-x-auto no-scrollbar pb-1">
          {activeRecipe.variants.map((variant) => {
            const vBreak = calculateVariantCostBreakdown(activeRecipe, variant, supplies);
            const isSelected = variant.id === activeVariant.id;
            const fmt = FORMAT_LABELS[variant.format];

            return (
              <button
                key={variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
                className={`min-w-[138px] sm:min-w-0 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-pink-700 text-white border-pink-700 shadow-md'
                    : 'bg-[#FDFBF7] text-stone-800 border-stone-200/90 hover:border-pink-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-base">{fmt.icon}</span>
                  {variant.manualSalePrice ? (
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-amber-300 text-stone-950'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      Fijo
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-bold ${
                        isSelected ? 'text-pink-200' : 'text-stone-400'
                      }`}
                    >
                      +{variant.defaultMarkupPercent}%
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs font-extrabold mt-1.5 truncate ${
                    isSelected ? 'text-white' : 'text-stone-900'
                  }`}
                >
                  {variant.name}
                </p>
                <p
                  className={`text-sm font-black mt-0.5 ${
                    isSelected ? 'text-amber-200' : 'text-emerald-700'
                  }`}
                >
                  {formatMoney(vBreak.effectiveSalePrice)}
                </p>
                <p
                  className={`text-[10px] font-medium ${
                    isSelected ? 'text-pink-100' : 'text-stone-500'
                  }`}
                >
                  Costo: {formatMoney(vBreak.totalProductionCost)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. TARJETA PRINCIPAL DE PRICING: SUGERIDO VS TU PRECIO + GANANCIA EN VIVO */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-sm space-y-5">
        {/* Resumen de los 3 costos de este tamaño */}
        <div className="bg-[#FDFBF7] border border-stone-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
              Costo de Hacer 1 {activeVariant.name} ({activeVariant.servingsLabel})
            </span>
            <div className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
              <span>
                🥛 Ingredientes: <strong>{formatMoney(breakdown.ingredientsCost)}</strong>
              </span>
              <span>
                📦 Packaging: <strong>{formatMoney(breakdown.packagingCost)}</strong>
              </span>
              <span>
                🔥 Gas/Luz ({breakdown.utilityPercent}%):{' '}
                <strong>{formatMoney(breakdown.utilityCost)}</strong>
              </span>
            </div>
          </div>

          <div className="bg-stone-900 text-white px-3.5 py-2 rounded-2xl text-right">
            <span className="text-[10px] uppercase tracking-wider text-stone-300 font-bold block">
              Costo Total
            </span>
            <span className="text-lg font-black text-amber-300">
              {formatMoney(breakdown.totalProductionCost)}
            </span>
          </div>
        </div>

        {/* Control Deslizable de % de Ganancia para el Sugerido */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-pink-700" />
              Porcentaje de Ganancia para el Precio Sugerido:
            </label>
            <span className="text-xs font-black text-pink-800 bg-pink-100 px-3 py-1 rounded-full">
              +{desiredPercent}% sobre costo
            </span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[50, 75, 100, 120, 150, 200].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setDesiredPercent(pct)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
                  desiredPercent === pct
                    ? 'bg-pink-700 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                +{pct}%
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="250"
              step="5"
              value={desiredPercent}
              onChange={(e) => setDesiredPercent(Number(e.target.value))}
              className="flex-1 accent-pink-700 h-2 bg-stone-200 rounded-lg cursor-pointer"
            />
            <div className="relative w-24 shrink-0">
              <input
                type="number"
                min="0"
                max="1000"
                value={desiredPercent}
                onChange={(e) =>
                  setDesiredPercent(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full pr-6 pl-2.5 py-1.5 border border-stone-300 rounded-xl text-sm font-black text-right"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                %
              </span>
            </div>
          </div>
        </div>

        {/* COMPARADOR LADO A LADO: 1) PRECIO SUGERIDO vs 2) TU PRECIO PERSONALIZADO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Opción 1: Precio Sugerido */}
          <div
            className={`rounded-3xl p-4 border-2 flex flex-col justify-between transition ${
              !hasCustomPrice
                ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                : 'bg-[#FDFBF7] text-stone-800 border-stone-200'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                    !hasCustomPrice ? 'text-amber-300' : 'text-stone-500'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> 1. Precio Sugerido (+{desiredPercent}%)
                </span>
                {!hasCustomPrice && (
                  <span className="text-[10px] font-black bg-emerald-400 text-stone-950 px-2.5 py-0.5 rounded-full">
                    ACTIVO
                  </span>
                )}
              </div>

              <div className="text-3xl font-black mt-2 tracking-tight">
                {formatMoney(suggestedPrice)}
              </div>

              <p
                className={`text-xs mt-1 font-semibold ${
                  !hasCustomPrice ? 'text-emerald-300' : 'text-emerald-700'
                }`}
              >
                Te deja libres: <strong>+{formatMoney(suggestedProfit)}</strong> por unidad
              </p>
            </div>

            {hasCustomPrice ? (
              <button
                type="button"
                onClick={() => handleSavePriceToCatalog(false)}
                className="mt-4 w-full py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Usar este Precio Sugerido
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSavePriceToCatalog(false)}
                className="mt-4 w-full py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Guardar % Sugerido en Lista
              </button>
            )}
          </div>

          {/* Opción 2: Tu Precio Manual con botones rápidos -/+ */}
          <div
            className={`rounded-3xl p-4 border-2 flex flex-col justify-between transition ${
              hasCustomPrice
                ? 'bg-pink-50/80 border-pink-600 shadow-md'
                : 'bg-white border-dashed border-stone-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-pink-800 flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5" /> 2. Pon otro Precio Manual vos
                </span>
                {hasCustomPrice && (
                  <span className="text-[10px] font-black bg-pink-700 text-white px-2.5 py-0.5 rounded-full">
                    TU PRECIO
                  </span>
                )}
              </div>

              {/* Input + Botones rápidos -/+ */}
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => nudgeCustomPrice(-stepAmount)}
                  className="h-11 px-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-extrabold text-xs flex items-center gap-0.5 shrink-0 cursor-pointer"
                  title={`Restar ${formatMoney(stepAmount)}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  {stepAmount}
                </button>

                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-black text-stone-400">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={customPriceInput}
                    onChange={(e) => setCustomPriceInput(e.target.value)}
                    placeholder={String(suggestedPrice)}
                    className="w-full pl-7 pr-7 py-2 bg-white border-2 border-pink-400 rounded-2xl text-lg font-black text-stone-900 text-center focus:outline-none focus:ring-2 focus:ring-pink-600"
                  />
                  {customPriceInput && (
                    <button
                      type="button"
                      onClick={() => setCustomPriceInput('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                      title="Limpiar precio manual"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => nudgeCustomPrice(stepAmount)}
                  className="h-11 px-2.5 rounded-2xl bg-pink-100 hover:bg-pink-200 text-pink-900 font-extrabold text-xs flex items-center gap-0.5 shrink-0 cursor-pointer"
                  title={`Sumar ${formatMoney(stepAmount)}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {stepAmount}
                </button>
              </div>

              <p className="text-[11px] text-stone-500 mt-1.5">
                Escribe un monto o toca <strong>-{stepAmount} / +{stepAmount}</strong> para ver
                cuánto ganas.
              </p>
            </div>

            {hasCustomPrice ? (
              <button
                type="button"
                onClick={() => handleSavePriceToCatalog(true)}
                className="mt-3 w-full py-2.5 rounded-2xl bg-pink-700 hover:bg-pink-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" /> Dejar Fijo mi Precio de{' '}
                {formatMoney(Number(customPriceInput))}
              </button>
            ) : (
              <div className="mt-3 py-2 text-center text-[11px] font-semibold text-stone-400 bg-stone-50 rounded-2xl">
                Escribe arriba para probar otro precio distinto
              </div>
            )}
          </div>
        </div>

        {saveFeedback && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-extrabold px-4 py-3 rounded-2xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            {saveFeedback}
          </div>
        )}

        {/* MEDIDOR DE GANANCIA LIMPIA Y DESGLOSE EN VIVO */}
        <div
          className={`rounded-3xl p-4 sm:p-5 border-2 space-y-3.5 ${
            isLosingMoney
              ? 'bg-red-50 border-red-400'
              : 'bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-50 border-emerald-400'
          }`}
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <span
                className={`text-[11px] font-extrabold uppercase tracking-wider block ${
                  isLosingMoney ? 'text-red-800' : 'text-emerald-900'
                }`}
              >
                {hasCustomPrice
                  ? `Ganancia vendiéndola a tu precio (${formatMoney(finalActivePrice)})`
                  : `Ganancia vendiéndola al sugerido (${formatMoney(finalActivePrice)})`}
              </span>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span
                  className={`text-3xl sm:text-4xl font-black tracking-tight ${
                    isLosingMoney ? 'text-red-700' : 'text-emerald-800'
                  }`}
                >
                  {finalNetProfit >= 0 ? '+' : ''}
                  {formatMoney(finalNetProfit)}
                </span>
                <span className="text-xs font-extrabold text-emerald-950">
                  limpios para tu bolsillo en cada venta
                </span>
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <span className="bg-white border border-emerald-300 text-emerald-950 text-xs font-extrabold px-3 py-1 rounded-full shadow-2xs">
                +{finalMarkupPercent.toFixed(0)}% s/ costo
              </span>
              <span className="bg-white border border-emerald-300 text-emerald-950 text-xs font-extrabold px-3 py-1 rounded-full shadow-2xs">
                {finalMarginPercent.toFixed(0)}% margen
              </span>
            </div>
          </div>

          {hasCustomPrice && (
            <div className="text-xs font-bold pt-2 border-t border-emerald-200/80">
              {isLosingMoney ? (
                <span className="text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  ¡Atención! Este precio es menor a tu costo de elaboración (
                  {formatMoney(breakdown.totalProductionCost)}). Perderías plata.
                </span>
              ) : diffFromSuggested > 0 ? (
                <span className="text-emerald-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  Con tu precio ganas <strong>+{formatMoney(diffFromSuggested)} más</strong> por
                  unidad que con el precio sugerido ({formatMoney(suggestedPrice)}).
                </span>
              ) : diffFromSuggested < 0 ? (
                <span className="text-amber-950">
                  Estás cobrando <strong>{formatMoney(Math.abs(diffFromSuggested))} menos</strong>{' '}
                  que el sugerido ({formatMoney(suggestedPrice)}), y te quedan{' '}
                  <strong>+{formatMoney(finalNetProfit)}</strong> de ganancia limpia.
                </span>
              ) : (
                <span className="text-emerald-900">
                  Tu precio manual coincide con el precio sugerido.
                </span>
              )}
            </div>
          )}

          {/* Barra Proporcional: Reposición vs Ganancia */}
          <div className="bg-white rounded-2xl p-3.5 border border-emerald-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs flex-wrap gap-1">
              <span className="inline-flex items-center gap-1 font-extrabold text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                Reposición Mercadería: {formatMoney(breakdown.totalProductionCost)}
              </span>
              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-800">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                Tu Ganancia Neta: {formatMoney(Math.max(0, finalNetProfit))}
              </span>
            </div>
            <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      10,
                      (breakdown.totalProductionCost / Math.max(1, finalActivePrice)) * 100
                    )
                  )}%`,
                }}
                className="bg-amber-500 h-full transition-all"
              />
              <div className="bg-emerald-500 h-full flex-1 transition-all" />
            </div>
          </div>

          {/* Tabla de Ganancias por Cantidad Vendida */}
          {!isLosingMoney && (
            <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
              {[5, 10, 20].map((qty) => (
                <div
                  key={qty}
                  className="bg-white rounded-2xl p-2.5 border border-emerald-200/80 shadow-2xs"
                >
                  <span className="text-[10px] font-extrabold uppercase text-stone-500 block">
                    Vendiendo {qty} u.
                  </span>
                  <span className="text-sm font-black text-emerald-800 mt-0.5 block">
                    +{formatMoney(finalNetProfit * qty)}
                  </span>
                  <span className="text-[10px] text-stone-400 block">
                    Total: {formatMoney(finalActivePrice * qty)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. DESPLEGABLE DE RECETA E INGREDIENTES (CON OPCIÓN DE PERSONALIZAR ESTE TAMAÑO) */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRecipeDetails(!showRecipeDetails)}
          className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-stone-50/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-pink-50 text-pink-700">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-stone-900">
                Receta, Gramos y Packaging de {activeVariant.name}
              </h3>
              <p className="text-xs text-stone-500">
                {activeVariant.customIngredients
                  ? 'Gramos personalizados para este tamaño'
                  : `Escala automática ${activeVariant.scaleFactor}x de la receta base`}{' '}
                · Toca para ver o editar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-extrabold text-pink-700 bg-pink-50 px-3 py-1.5 rounded-full">
            <span>{showRecipeDetails ? 'Ocultar' : 'Ver Receta'}</span>
            {showRecipeDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {showRecipeDetails && (
          <div className="p-4 pt-0 border-t border-stone-100 space-y-3">
            <div className="flex items-center justify-between gap-2 pt-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => openIngredientsEditor('base')}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-pink-50 hover:bg-pink-100 text-pink-800 px-3 py-2 rounded-xl cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar Receta Base
                </button>
                <button
                  type="button"
                  onClick={() => openIngredientsEditor('variant_custom')}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-purple-50 hover:bg-purple-100 text-purple-900 px-3 py-2 rounded-xl cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" /> Gramos solo p/ {activeVariant.name}
                </button>
                {activeVariant.customIngredients && (
                  <button
                    type="button"
                    onClick={() =>
                      updateVariantCustomIngredients(
                        activeRecipe.id,
                        activeVariant.id,
                        undefined
                      )
                    }
                    className="text-[11px] font-bold text-stone-500 underline px-2 cursor-pointer"
                  >
                    Volver a escala automática ({activeVariant.scaleFactor}x)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditVariantModal(activeVariant)}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-2 rounded-xl cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" /> Envases y % Luz/Gas
                </button>
                {activeRecipe.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el tamaño "${activeVariant.name}"?`)) {
                        deleteVariant(activeRecipe.id, activeVariant.id);
                      }
                    }}
                    className="p-2 text-stone-400 hover:text-red-600 rounded-lg cursor-pointer"
                    title="Eliminar este tamaño"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-stone-100">
              {breakdown.ingredientLines.map((line) => (
                <div
                  key={line.supplyId}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-800">{line.supplyName}</span>
                    <span className="text-stone-500 ml-1.5">
                      ({line.quantity.toLocaleString('es-AR')} {line.baseUnit} ×{' '}
                      {formatUnitCost(line.unitCost, settings.currencySymbol)}/{line.baseUnit})
                    </span>
                  </div>
                  <span className="font-bold text-stone-900">
                    {formatMoney(line.subtotalCost)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-1.5">
              {breakdown.packagingLines.map((pkg) => (
                <div
                  key={pkg.supplyId}
                  className="flex items-center justify-between text-xs bg-amber-50/70 text-amber-950 px-3 py-2 rounded-xl"
                >
                  <span>
                    📦 {pkg.quantity} u. × {pkg.supplyName}
                  </span>
                  <span className="font-bold">{formatMoney(pkg.subtotalCost)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs bg-orange-50/70 text-orange-950 px-3 py-2 rounded-xl">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-600" /> Servicios: Gas, Luz y Horno (
                  {breakdown.utilityPercent}%)
                </span>
                <span className="font-bold">{formatMoney(breakdown.utilityCost)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Edit Base or Custom Variant Ingredients */}
      {isEditingBase && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-base font-extrabold text-stone-900">
                  {editingMode === 'base'
                    ? `Receta Base: ${activeRecipe.name}`
                    : `Gramos Exclusivos para: ${activeVariant.name}`}
                </h2>
                <p className="text-xs text-stone-500">
                  {editingMode === 'base'
                    ? activeRecipe.baseYieldLabel
                    : 'Estos gramos se usarán únicamente en este tamaño'}
                </p>
              </div>
              <button
                onClick={() => setIsEditingBase(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveIngredientsModal} className="space-y-3 mt-4">
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {draftIngredients.map((line, idx) => {
                  const sup = supplies.find((s) => s.id === line.supplyId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-stone-50 p-2 rounded-2xl border border-stone-200"
                    >
                      <select
                        value={line.supplyId}
                        onChange={(e) => {
                          const next = [...draftIngredients];
                          next[idx] = { ...next[idx], supplyId: e.target.value };
                          setDraftIngredients(next);
                        }}
                        className="flex-1 bg-white border border-stone-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-stone-800"
                      >
                        {ingredientSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.baseUnit})
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 w-28">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          required
                          value={line.quantity}
                          onChange={(e) => {
                            const next = [...draftIngredients];
                            next[idx] = {
                              ...next[idx],
                              quantity: Number(e.target.value) || 0,
                            };
                            setDraftIngredients(next);
                          }}
                          className="w-full bg-white border border-stone-300 rounded-xl px-2 py-2 text-xs font-bold text-right"
                        />
                        <span className="text-xs font-bold text-stone-500 w-5">
                          {sup?.baseUnit || 'g'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setDraftIngredients(draftIngredients.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const firstSup = ingredientSupplies[0];
                  if (firstSup) {
                    setDraftIngredients([
                      ...draftIngredients,
                      { supplyId: firstSup.id, quantity: 100 },
                    ]);
                  }
                }}
                className="w-full py-2.5 border border-dashed border-pink-400 rounded-2xl text-xs font-bold text-pink-700 bg-pink-50/50 cursor-pointer"
              >
                + Agregar Ingrediente
              </button>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBase(false)}
                  className="flex-1 py-3 rounded-2xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-pink-700 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit / Add Size Variant */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-extrabold text-stone-900">
                {editingVariantId ? 'Configurar Tamaño' : 'Nuevo Tamaño'}
              </h2>
              <button
                onClick={() => setIsVariantModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Formato
                  </label>
                  <select
                    value={vFormat}
                    onChange={(e) => setVFormat(e.target.value as SizeFormat)}
                    className="w-full px-3 py-2.5 bg-stone-100 border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value="individual">Individual / Vaso</option>
                    <option value="porcion">Porción</option>
                    <option value="chica">Chica</option>
                    <option value="mediana">Mediana</option>
                    <option value="grande">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Proporción de Receta Base
                  </label>
                  <input
                    type="number"
                    step="0.005"
                    min="0.01"
                    required
                    value={vScale}
                    onChange={(e) => setVScale(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                  />
                  <span className="text-[10px] text-stone-500">
                    1 = Mediana, 0.125 = 1/8, 1.65 = Grande
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nombre del Tamaño *
                </label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="Ej: Mediana 20cm"
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Porciones que rinde
                  </label>
                  <input
                    type="text"
                    value={vServings}
                    onChange={(e) => setVServings(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    % Gas / Luz
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={vUtilityPct}
                    onChange={(e) => setVUtilityPct(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 space-y-2">
                <label className="block text-xs font-bold text-amber-900">
                  Packaging / Envases de este tamaño
                </label>
                {vPackaging.map((pkg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={pkg.supplyId}
                      onChange={(e) => {
                        const next = [...vPackaging];
                        next[idx] = { ...next[idx], supplyId: e.target.value };
                        setVPackaging(next);
                      }}
                      className="flex-1 bg-amber-50/60 border border-amber-300 rounded-lg px-2.5 py-2 text-xs font-semibold"
                    >
                      {packagingSupplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={pkg.quantity}
                      onChange={(e) => {
                        const next = [...vPackaging];
                        next[idx] = {
                          ...next[idx],
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        };
                        setVPackaging(next);
                      }}
                      className="w-16 bg-white border border-amber-300 rounded-lg px-2 py-2 text-xs font-bold text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setVPackaging(vPackaging.filter((_, i) => i !== idx))}
                      className="p-1 text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (packagingSupplies[0]) {
                      setVPackaging([
                        ...vPackaging,
                        { supplyId: packagingSupplies[0].id, quantity: 1 },
                      ]);
                    }
                  }}
                  className="w-full py-1.5 border border-dashed border-amber-400 rounded-lg text-xs font-bold text-amber-800 bg-amber-50/50 cursor-pointer"
                >
                  + Agregar Envase
                </button>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-pink-700 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  Guardar Tamaño
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Recipe */}
      {isNewRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-bold text-stone-900">Agregar Nueva Torta</h2>
              <button
                onClick={() => setIsNewRecipeModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNewRecipe} className="space-y-3.5 mt-4">
              <div className="flex gap-2.5">
                <div className="w-20">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Icono</label>
                  <input
                    type="text"
                    value={newRecipeEmoji}
                    onChange={(e) => setNewRecipeEmoji(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-center text-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    placeholder="Ej: Cheesecake de Frutos Rojos"
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewRecipeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-pink-700 text-white font-bold text-sm cursor-pointer"
                >
                  Crear Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
