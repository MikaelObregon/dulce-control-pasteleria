import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Check,
  ChefHat,
  Coins,
  Copy,
  Edit3,
  Layers,
  Lock,
  Minus,
  Percent,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  calculateVariantCostBreakdown,
  simulatePricing,
} from '../../services/calculations';
import {
  Recipe,
  RecipePackagingLine,
  RecipeSpecialty,
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
    upsertVariant,
    deleteVariant,
    upsertSpecialty,
    deleteSpecialty,
    upsertRecipe,
    deleteRecipe,
  } = useStore();

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    recipes[0]?.id || 'recipe-tres-leches'
  );

  const activeRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) || recipes[0],
    [recipes, selectedRecipeId]
  );

  const specialties = useMemo<RecipeSpecialty[]>(() => {
    if (activeRecipe?.specialties && activeRecipe.specialties.length > 0) {
      return activeRecipe.specialties;
    }
    return [
      {
        id: `${activeRecipe?.id || 'rec'}-spec-clasica`,
        name: 'Clásica (Normal)',
        emoji: '✨',
        description: 'Versión tradicional',
        isDefault: true,
        extraBaseCost: 0,
      },
    ];
  }, [activeRecipe]);

  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>(
    specialties[0]?.id || ''
  );

  const activeSpecialty = useMemo(
    () =>
      specialties.find((s) => s.id === selectedSpecialtyId) ||
      specialties.find((s) => s.isDefault) ||
      specialties[0],
    [specialties, selectedSpecialtyId]
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
    return calculateVariantCostBreakdown(
      activeRecipe,
      activeVariant,
      supplies,
      activeSpecialty
    );
  }, [activeRecipe, activeVariant, supplies, activeSpecialty]);

  // Pricing interactive states
  const [desiredPercent, setDesiredPercent] = useState<number>(
    activeVariant?.defaultMarkupPercent ?? 100
  );
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Modal: Edit / Add Size Variant
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [vName, setVName] = useState('');
  const [vFormat, setVFormat] = useState<SizeFormat>('mediana');
  const [vServings, setVServings] = useState('');
  const [vScale, setVScale] = useState('1');
  const [vDirectCost, setVDirectCost] = useState('');
  const [vUtilityPct, setVUtilityPct] = useState('6');
  const [vPackaging, setVPackaging] = useState<RecipePackagingLine[]>([]);

  // Modal: Edit / Add Specialty ("Normal" vs "Con Algo Especial")
  const [isSpecialtyModalOpen, setIsSpecialtyModalOpen] = useState(false);
  const [editingSpecialtyId, setEditingSpecialtyId] = useState<string | null>(null);
  const [specName, setSpecName] = useState('');
  const [specEmoji, setSpecEmoji] = useState('🍓');
  const [specDesc, setSpecDesc] = useState('');
  const [specExtraBaseCost, setSpecExtraBaseCost] = useState('');
  const [specCustomVariantExtraCost, setSpecCustomVariantExtraCost] = useState('');

  // Modal: New / Edit Recipe (Torta)
  const [isNewRecipeModalOpen, setIsNewRecipeModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeEmoji, setNewRecipeEmoji] = useState('🍰');
  const [newRecipeDescription, setNewRecipeDescription] = useState('');

  useEffect(() => {
    if (activeVariant) {
      setDesiredPercent(activeVariant.defaultMarkupPercent);
      const specManual =
        activeSpecialty && !activeSpecialty.isDefault
          ? activeSpecialty.manualPricesByVariant?.[activeVariant.id]
          : activeVariant.manualSalePrice;
      setCustomPriceInput(specManual ? String(specManual) : '');
    }
  }, [activeVariant, activeSpecialty]);

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
    const defaultSpec =
      (recipe.specialties || []).find((s) => s.isDefault) ||
      (recipe.specialties || [])[0];
    if (defaultSpec) setSelectedSpecialtyId(defaultSpec.id);
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
      manualVal,
      activeSpecialty?.id
    );

    const specLabel =
      activeSpecialty && !activeSpecialty.isDefault
        ? ` (${activeSpecialty.name})`
        : '';

    setSaveFeedback(
      manualVal
        ? `¡Precio guardado! "${activeVariant.name}${specLabel}" quedó en ${formatMoney(manualVal)}.`
        : `¡Precio sugerido guardado! "${activeVariant.name}${specLabel}" quedó en ${formatMoney(suggestedPrice)} (+${desiredPercent}%).`
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
      const rSpecs =
        r.specialties && r.specialties.length > 0
          ? r.specialties
          : [
              {
                id: 'default',
                name: 'Clásica',
                emoji: '✨',
                isDefault: true,
                extraBaseCost: 0,
              },
            ];

      for (const spec of rSpecs) {
        if (rSpecs.length > 1) {
          lines.push(`  ${spec.emoji} _${spec.name}:_`);
        }
        for (const v of r.variants) {
          const b = calculateVariantCostBreakdown(r, v, supplies, spec);
          lines.push(
            `    • ${v.name} (${v.servingsLabel}): *${formatMoney(b.effectiveSalePrice)}*`
          );
        }
      }
      lines.push('');
    }
    lines.push('📲 ¡Consúltanos disponibilidad para tu fecha!');

    navigator.clipboard?.writeText(lines.join('\n'));
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  // --- Size Variant Modal Handlers ---
  const openEditVariantModal = (variant?: RecipeVariant) => {
    if (variant) {
      const varBaseBreak = calculateVariantCostBreakdown(activeRecipe, variant, supplies);
      setEditingVariantId(variant.id);
      setVName(variant.name);
      setVFormat(variant.format);
      setVServings(variant.servingsLabel);
      setVScale(String(variant.scaleFactor));
      setVDirectCost(
        variant.directIngredientsCost !== undefined
          ? String(variant.directIngredientsCost)
          : String(Math.round(varBaseBreak.baseIngredientsCost))
      );
      setVUtilityPct(String(variant.utilityPercent));
      setVPackaging(variant.packagingItems.map((p) => ({ ...p })));
    } else {
      setEditingVariantId(null);
      setVName('');
      setVFormat('porcion');
      setVServings('1 porción');
      setVScale('0.125');
      setVDirectCost('1500');
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
    const existingVar = editingVariantId
      ? activeRecipe.variants.find((v) => v.id === editingVariantId)
      : undefined;
    const id = editingVariantId || `var-${Date.now()}`;
    const parsedDirectCost =
      vDirectCost.trim() !== '' && Number(vDirectCost) >= 0
        ? Number(vDirectCost)
        : undefined;

    const newVar: RecipeVariant = {
      id,
      name: vName.trim(),
      format: vFormat,
      servingsLabel: vServings.trim() || FORMAT_LABELS[vFormat].label,
      scaleFactor: Math.max(0.01, Number(vScale) || 1),
      directIngredientsCost: parsedDirectCost,
      customIngredients: existingVar ? existingVar.customIngredients : undefined,
      packagingItems: vPackaging.filter((p) => p.supplyId && p.quantity > 0),
      utilityPercent: Math.max(0, Number(vUtilityPct) || 0),
      defaultMarkupPercent: existingVar ? existingVar.defaultMarkupPercent : desiredPercent,
      manualSalePrice: existingVar ? existingVar.manualSalePrice : undefined,
      readyStockBySpecialty: existingVar ? existingVar.readyStockBySpecialty : undefined,
    };
    upsertVariant(activeRecipe.id, newVar);
    setSelectedVariantId(id);
    setIsVariantModalOpen(false);
    setSaveFeedback(
      editingVariantId
        ? `¡Tamaño "${newVar.name}" actualizado!`
        : `¡Nuevo tamaño "${newVar.name}" agregado!`
    );
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleDuplicateVariant = (variant: RecipeVariant) => {
    const newId = `var-${Date.now()}`;
    const duplicated: RecipeVariant = {
      ...variant,
      id: newId,
      name: `${variant.name} (Copia)`,
      packagingItems: variant.packagingItems.map((p) => ({ ...p })),
      customIngredients: variant.customIngredients
        ? variant.customIngredients.map((c) => ({ ...c }))
        : undefined,
    };
    upsertVariant(activeRecipe.id, duplicated);
    setSelectedVariantId(newId);
    setSaveFeedback(`¡Tamaño duplicado como "${duplicated.name}"!`);
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleDeleteVariantConfirm = (variant: RecipeVariant) => {
    if (activeRecipe.variants.length <= 1) {
      window.alert('Cada torta debe tener al menos 1 tamaño activo.');
      return;
    }
    if (
      window.confirm(
        `¿Seguro que deseas eliminar el tamaño "${variant.name}" de ${activeRecipe.name}?`
      )
    ) {
      const remaining = activeRecipe.variants.filter((v) => v.id !== variant.id);
      deleteVariant(activeRecipe.id, variant.id);
      if (selectedVariantId === variant.id && remaining[0]) {
        setSelectedVariantId(remaining[0].id);
      }
      setIsVariantModalOpen(false);
      setSaveFeedback(`Tamaño "${variant.name}" eliminado.`);
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  // --- Specialty ("Normal" vs "Con Algo Especial") Modal Handlers ---
  const openSpecialtyModal = (spec?: RecipeSpecialty) => {
    if (spec) {
      setEditingSpecialtyId(spec.id);
      setSpecName(spec.name);
      setSpecEmoji(spec.emoji || '🍓');
      setSpecDesc(spec.description || '');
      setSpecExtraBaseCost(String(spec.extraBaseCost || 0));
      const customForActiveVar = spec.extraCostByVariant?.[activeVariant.id];
      setSpecCustomVariantExtraCost(
        customForActiveVar !== undefined ? String(customForActiveVar) : ''
      );
    } else {
      setEditingSpecialtyId(null);
      setSpecName('');
      setSpecEmoji('🍓');
      setSpecDesc('');
      setSpecExtraBaseCost('1500');
      setSpecCustomVariantExtraCost('');
    }
    setIsSpecialtyModalOpen(true);
  };

  const handleSaveSpecialty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specName.trim()) return;
    const existing = editingSpecialtyId
      ? specialties.find((s) => s.id === editingSpecialtyId)
      : undefined;
    const id = editingSpecialtyId || `spec-${Date.now()}`;

    const nextExtraByVariant = { ...(existing?.extraCostByVariant || {}) };
    if (
      specCustomVariantExtraCost.trim() !== '' &&
      Number(specCustomVariantExtraCost) >= 0
    ) {
      nextExtraByVariant[activeVariant.id] = Number(specCustomVariantExtraCost);
    } else {
      delete nextExtraByVariant[activeVariant.id];
    }

    const newSpec: RecipeSpecialty = {
      id,
      name: specName.trim(),
      emoji: specEmoji || '🍓',
      description: specDesc.trim() || undefined,
      isDefault: existing?.isDefault || false,
      extraBaseCost: existing?.isDefault
        ? 0
        : Math.max(0, Number(specExtraBaseCost) || 0),
      manualPricesByVariant: existing?.manualPricesByVariant,
      extraCostByVariant: nextExtraByVariant,
    };

    upsertSpecialty(activeRecipe.id, newSpec);
    setSelectedSpecialtyId(id);
    setIsSpecialtyModalOpen(false);
    setSaveFeedback(
      editingSpecialtyId
        ? `¡Versión "${newSpec.name}" actualizada!`
        : `¡Nueva versión especial "${newSpec.name}" agregada!`
    );
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleDeleteSpecialtyConfirm = (spec: RecipeSpecialty) => {
    if (spec.isDefault) {
      window.alert('La versión Clásica (Normal) es la base de la torta y no se puede eliminar.');
      return;
    }
    if (
      window.confirm(
        `¿Eliminar la versión especial "${spec.name}" de ${activeRecipe.name}?`
      )
    ) {
      deleteSpecialty(activeRecipe.id, spec.id);
      const fallback = specialties.find((s) => s.isDefault) || specialties[0];
      if (fallback) setSelectedSpecialtyId(fallback.id);
      setIsSpecialtyModalOpen(false);
      setSaveFeedback(`Versión "${spec.name}" eliminada.`);
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  // --- Recipe (Torta) Modal Handlers ---
  const openRecipeModal = (recipeToEdit?: Recipe) => {
    if (recipeToEdit) {
      setEditingRecipeId(recipeToEdit.id);
      setNewRecipeName(recipeToEdit.name);
      setNewRecipeEmoji(recipeToEdit.emoji);
      setNewRecipeDescription(recipeToEdit.description);
    } else {
      setEditingRecipeId(null);
      setNewRecipeName('');
      setNewRecipeEmoji('🍰');
      setNewRecipeDescription('Torta artesanal');
    }
    setIsNewRecipeModalOpen(true);
  };

  const handleCreateNewRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName.trim()) return;

    if (editingRecipeId) {
      const target = recipes.find((r) => r.id === editingRecipeId);
      if (target) {
        upsertRecipe({
          ...target,
          name: newRecipeName.trim(),
          emoji: newRecipeEmoji || '🍰',
          description: newRecipeDescription.trim() || target.description,
        });
      }
      setIsNewRecipeModalOpen(false);
      setEditingRecipeId(null);
      return;
    }

    const newId = `recipe-${Date.now()}`;
    const defaultVarId = `var-${Date.now()}-med`;
    const defaultSpecId = `${newId}-spec-clasica`;
    const newRecipe: Recipe = {
      id: newId,
      name: newRecipeName.trim(),
      description: newRecipeDescription.trim() || 'Torta artesanal',
      emoji: newRecipeEmoji || '🍰',
      accentColor: 'pink',
      baseYieldLabel: '1 Torta Mediana (8 porciones)',
      baseIngredients: [],
      specialties: [
        {
          id: defaultSpecId,
          name: 'Clásica (Normal)',
          emoji: '✨',
          description: 'Versión tradicional',
          isDefault: true,
          extraBaseCost: 0,
        },
        {
          id: `${newId}-spec-especial`,
          name: 'Con Relleno / Topping Especial',
          emoji: '🍓',
          description: 'Con agregado especial',
          isDefault: false,
          extraBaseCost: 1500,
        },
      ],
      variants: [
        {
          id: defaultVarId,
          name: 'Mediana Estándar',
          format: 'mediana',
          servingsLabel: '8 porciones',
          scaleFactor: 1,
          directIngredientsCost: 6000,
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
    setSelectedSpecialtyId(defaultSpecId);
    setIsNewRecipeModalOpen(false);
    setNewRecipeName('');
  };

  const handleDeleteRecipeConfirm = (recipe: Recipe) => {
    if (recipes.length <= 1) {
      window.alert('Debes mantener al menos 1 torta en el catálogo.');
      return;
    }
    if (
      window.confirm(
        `¿Seguro que deseas eliminar la torta "${recipe.name}" y todos sus tamaños?`
      )
    ) {
      const remaining = recipes.filter((r) => r.id !== recipe.id);
      deleteRecipe(recipe.id);
      if (remaining[0]) {
        handleSelectRecipe(remaining[0]);
      }
      setIsNewRecipeModalOpen(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* 1. ENCABEZADO CÁLIDO + BOTÓN WHATSAPP */}
      <div className="bg-gradient-to-r from-rose-800 via-pink-700 to-amber-700 rounded-3xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full mb-1.5">
              <ChefHat className="w-3.5 h-3.5" /> Catálogo + Versiones Especiales + Precios
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Tus Tortas y Precios
            </h1>
            <p className="text-xs text-rose-100 mt-0.5">
              Elige entre la versión Normal o con Algo Especial, edita tamaños y mira tu
              ganancia limpia al instante.
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
          onClick={() => openRecipeModal(activeRecipe)}
          className="flex items-center gap-1.5 px-3.5 py-3 rounded-3xl border-2 border-stone-200 bg-white text-stone-700 text-xs font-extrabold shrink-0 hover:border-pink-300 transition cursor-pointer"
          title="Editar o eliminar esta torta"
        >
          <Edit3 className="w-3.5 h-3.5 text-pink-700" /> Editar Torta
        </button>

        <button
          onClick={() => openRecipeModal(undefined)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-3xl border-2 border-dashed border-pink-300 bg-pink-50/60 text-pink-800 text-xs font-extrabold shrink-0 hover:bg-pink-100 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> + Otra Torta
        </button>
      </div>

      {/* 2B. SELECTOR DE VERSIÓN: NORMAL VS CON ALGO ESPECIAL */}
      <div className="bg-gradient-to-r from-amber-50 via-rose-50/70 to-amber-50 rounded-3xl p-4 border border-amber-200/90 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-600 fill-amber-500" />
              Versión de {activeRecipe.name} (Normal o Con Algo Especial):
            </span>
            <p className="text-[11px] text-stone-600">
              Cambia entre la versión clásica o con rellenos/toppings especiales con su propio
              costo y precio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openSpecialtyModal(undefined)}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 rounded-full shadow-2xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> + Agregar Especial
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {specialties.map((spec) => {
            const isSelected = spec.id === activeSpecialty?.id;
            const specBreak = calculateVariantCostBreakdown(
              activeRecipe,
              activeVariant,
              supplies,
              spec
            );

            return (
              <div
                key={spec.id}
                onClick={() => setSelectedSpecialtyId(spec.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedSpecialtyId(spec.id);
                }}
                className={`min-w-[185px] p-3 rounded-2xl border-2 text-left transition-all cursor-pointer shrink-0 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                    : 'bg-white text-stone-800 border-amber-200 hover:border-amber-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-base">{spec.emoji}</span>
                    {spec.isDefault ? (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-emerald-400 text-stone-950'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        Base Normal
                      </span>
                    ) : (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-amber-400 text-stone-950'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        +{formatMoney(specBreak.specialtyExtraCost)} costo extra
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-extrabold mt-1.5 leading-snug">{spec.name}</p>
                  {spec.description && (
                    <p
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {spec.description}
                    </p>
                  )}
                  <p
                    className={`text-sm font-black mt-1 ${
                      isSelected ? 'text-amber-300' : 'text-pink-700'
                    }`}
                  >
                    {activeVariant.name}: {formatMoney(specBreak.effectiveSalePrice)}
                  </p>
                </div>

                {!spec.isDefault && (
                  <div
                    className={`flex items-center justify-end gap-1 mt-2 pt-1.5 border-t ${
                      isSelected ? 'border-white/15' : 'border-stone-100'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSpecialtyId(spec.id);
                        openSpecialtyModal(spec);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                        isSelected
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" /> Editar Extra
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSpecialtyConfirm(spec)}
                      className={`p-1 rounded-lg cursor-pointer ${
                        isSelected
                          ? 'bg-white/15 text-red-200 hover:bg-red-600 hover:text-white'
                          : 'bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-700'
                      }`}
                      title="Eliminar esta versión especial"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. SELECTOR TÁCTIL DE TAMAÑO / FORMATO */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-pink-700" />
            Tamaños de {activeRecipe.name} —{' '}
            <strong className="text-pink-700">{activeSpecialty?.name}</strong>:
          </span>
          <button
            onClick={() => openEditVariantModal(undefined)}
            className="inline-flex items-center gap-1 text-xs font-extrabold text-white bg-pink-700 hover:bg-pink-800 px-3.5 py-1.5 rounded-full shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> + Agregar Tamaño
          </button>
        </div>

        <div className="flex sm:grid sm:grid-cols-5 gap-2 overflow-x-auto no-scrollbar pb-1">
          {activeRecipe.variants.map((variant) => {
            const vBreak = calculateVariantCostBreakdown(
              activeRecipe,
              variant,
              supplies,
              activeSpecialty
            );
            const isSelected = variant.id === activeVariant.id;
            const fmt = FORMAT_LABELS[variant.format];
            const hasManualForThisSpec =
              activeSpecialty && !activeSpecialty.isDefault
                ? Boolean(activeSpecialty.manualPricesByVariant?.[variant.id])
                : Boolean(variant.manualSalePrice);

            return (
              <div
                key={variant.id}
                onClick={() => setSelectedVariantId(variant.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedVariantId(variant.id);
                }}
                className={`min-w-[148px] sm:min-w-0 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer shrink-0 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-pink-700 text-white border-pink-700 shadow-md'
                    : 'bg-[#FDFBF7] text-stone-800 border-stone-200/90 hover:border-pink-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base">{fmt.icon}</span>
                    <div className="flex items-center gap-1">
                      {hasManualForThisSpec ? (
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
                  </div>
                  <p
                    className={`text-xs font-extrabold mt-1.5 truncate ${
                      isSelected ? 'text-white' : 'text-stone-900'
                    }`}
                  >
                    {variant.name}
                  </p>
                  <p
                    className={`text-[10px] font-semibold truncate ${
                      isSelected ? 'text-pink-200' : 'text-stone-400'
                    }`}
                  >
                    {variant.servingsLabel}
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
                </div>

                {/* Botones rápidos de Editar y Eliminar en cada tarjeta de tamaño */}
                <div
                  className={`flex items-center justify-end gap-1 mt-2 pt-1.5 border-t ${
                    isSelected ? 'border-pink-500/50' : 'border-stone-200/70'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      openEditVariantModal(variant);
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                      isSelected
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : 'bg-stone-200/70 hover:bg-stone-300/80 text-stone-700'
                    }`}
                    title="Editar este tamaño"
                  >
                    <Edit3 className="w-3 h-3" /> Editar
                  </button>
                  {activeRecipe.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteVariantConfirm(variant)}
                      className={`p-1 rounded-lg transition cursor-pointer ${
                        isSelected
                          ? 'bg-white/15 hover:bg-red-500 text-pink-100 hover:text-white'
                          : 'bg-stone-200/60 hover:bg-red-100 text-stone-500 hover:text-red-700'
                      }`}
                      title="Eliminar este tamaño"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra de acciones directas del tamaño seleccionado */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-bold text-stone-700 pl-1">
            Seleccionado:{' '}
            <span className="font-extrabold text-pink-800">
              {activeVariant.name} ({activeSpecialty?.name})
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => openEditVariantModal(activeVariant)}
              className="inline-flex items-center gap-1 text-xs font-extrabold bg-white hover:bg-pink-50 text-stone-800 border border-stone-300 px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-pink-700" /> Editar Tamaño / Costo / Envases
            </button>
            {activeSpecialty && !activeSpecialty.isDefault && (
              <button
                type="button"
                onClick={() => openSpecialtyModal(activeSpecialty)}
                className="inline-flex items-center gap-1 text-xs font-extrabold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 text-amber-600" /> Editar Extra (
                {activeSpecialty.name})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDuplicateVariant(activeVariant)}
              className="inline-flex items-center gap-1 text-xs font-extrabold bg-white hover:bg-amber-50 text-stone-700 border border-stone-300 px-2.5 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
              title="Crear una copia de este tamaño"
            >
              <Copy className="w-3.5 h-3.5 text-amber-700" /> Duplicar
            </button>
            {activeRecipe.variants.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteVariantConfirm(activeVariant)}
                className="inline-flex items-center gap-1 text-xs font-extrabold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                title="Eliminar este tamaño"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. TARJETA PRINCIPAL DE PRICING: SUGERIDO VS TU PRECIO + GANANCIA EN VIVO */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-sm space-y-5">
        {/* Resumen de los costos de este tamaño y versión */}
        <div className="bg-[#FDFBF7] border border-stone-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 block">
              Costo de Hacer 1 {activeVariant.name} ·{' '}
              <strong className="text-pink-700">{activeSpecialty?.name}</strong>
            </span>
            <div className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
              <span>
                🥣 Base:{' '}
                <strong>{formatMoney(breakdown.baseIngredientsCost)}</strong>
              </span>
              {breakdown.specialtyExtraCost > 0 && (
                <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded-lg font-bold">
                  {activeSpecialty?.emoji} Extra Especial: +
                  {formatMoney(breakdown.specialtyExtraCost)}
                </span>
              )}
              <span>
                📦 Packaging: <strong>{formatMoney(breakdown.packagingCost)}</strong>
              </span>
              <span>
                🔥 Gas/Luz ({breakdown.utilityPercent}%):{' '}
                <strong>{formatMoney(breakdown.utilityCost)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEditVariantModal(activeVariant)}
              className="text-xs font-extrabold text-pink-700 bg-pink-50 hover:bg-pink-100 px-3 py-2 rounded-xl cursor-pointer"
            >
              Cambiar Costo
            </button>
            <div className="bg-stone-900 text-white px-3.5 py-2 rounded-2xl text-right">
              <span className="text-[10px] uppercase tracking-wider text-stone-300 font-bold block">
                Costo Total
              </span>
              <span className="text-lg font-black text-amber-300">
                {formatMoney(breakdown.totalProductionCost)}
              </span>
            </div>
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
                Este precio quedará guardado para{' '}
                <strong>
                  {activeVariant.name} ({activeSpecialty?.name})
                </strong>
                .
              </p>
            </div>

            {hasCustomPrice ? (
              <button
                type="button"
                onClick={() => handleSavePriceToCatalog(true)}
                className="mt-3 w-full py-2.5 rounded-2xl bg-pink-700 hover:bg-pink-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" /> Dejar Fijo en{' '}
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

      {/* Modal: Edit / Add Size Variant */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-extrabold text-stone-900">
                {editingVariantId ? 'Editar Tamaño y Costos' : 'Nuevo Tamaño'}
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
                    Porciones que rinde
                  </label>
                  <input
                    type="text"
                    value={vServings}
                    onChange={(e) => setVServings(e.target.value)}
                    placeholder="Ej: 8 porciones"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-semibold"
                  />
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
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-pink-800 mb-1">
                    Costo Base Ingredientes ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={vDirectCost}
                    onChange={(e) => setVDirectCost(e.target.value)}
                    placeholder="Ej: 5500"
                    className="w-full px-3 py-2 bg-pink-50/50 border border-pink-300 rounded-xl text-sm font-black text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    % Gas / Luz / Horno
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
                {editingVariantId && activeRecipe.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = activeRecipe.variants.find(
                        (v) => v.id === editingVariantId
                      );
                      if (target) handleDeleteVariantConfirm(target);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                )}
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

      {/* Modal: Edit / Add Specialty ("Con Algo Especial") */}
      {isSpecialtyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-extrabold text-stone-900">
                {editingSpecialtyId
                  ? 'Editar Versión Especial'
                  : `Nueva Versión Especial de ${activeRecipe.name}`}
              </h2>
              <button
                onClick={() => setIsSpecialtyModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpecialty} className="space-y-3.5 mt-4">
              <div className="flex gap-2.5">
                <div className="w-20">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Icono</label>
                  <input
                    type="text"
                    value={specEmoji}
                    onChange={(e) => setSpecEmoji(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-center text-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nombre de la Versión Especial *
                  </label>
                  <input
                    type="text"
                    required
                    value={specName}
                    onChange={(e) => setSpecName(e.target.value)}
                    placeholder="Ej: Con Dulce de Leche / Con Frutilla"
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Detalle de qué lleva extra (opcional)
                </label>
                <input
                  type="text"
                  value={specDesc}
                  onChange={(e) => setSpecDesc(e.target.value)}
                  placeholder="Ej: Relleno extra de dulce de leche o frutillas frescas"
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-3">
                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1">
                    Costo Extra en Torta Mediana ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={specExtraBaseCost}
                    onChange={(e) => setSpecExtraBaseCost(e.target.value)}
                    placeholder="Ej: 1500"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-black"
                  />
                  <span className="text-[10px] text-amber-900 mt-1 block">
                    Se adapta proporcionalmente a los demás tamaños (Vaso, Chica, Grande).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    O fijar Costo Extra exacto solo para {activeVariant.name} (opcional):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={specCustomVariantExtraCost}
                    onChange={(e) => setSpecCustomVariantExtraCost(e.target.value)}
                    placeholder="Dejar vacío para cálculo proporcional automático"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                {editingSpecialtyId && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = specialties.find((s) => s.id === editingSpecialtyId);
                      if (target) handleDeleteSpecialtyConfirm(target);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSpecialtyModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  Guardar Versión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New / Edit Recipe */}
      {isNewRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-bold text-stone-900">
                {editingRecipeId ? 'Editar Torta / Producto' : 'Agregar Nueva Torta'}
              </h2>
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

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Descripción corta
                </label>
                <input
                  type="text"
                  value={newRecipeDescription}
                  onChange={(e) => setNewRecipeDescription(e.target.value)}
                  placeholder="Ej: Bizcochuelo húmedo con crema..."
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                {editingRecipeId && recipes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = recipes.find((r) => r.id === editingRecipeId);
                      if (target) handleDeleteRecipeConfirm(target);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar Torta
                  </button>
                )}
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
                  {editingRecipeId ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
