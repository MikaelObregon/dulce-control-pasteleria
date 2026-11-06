import {
  BaseUnit,
  CashMovement,
  Order,
  PurchaseUnit,
  Recipe,
  RecipeIngredientLine,
  RecipeVariant,
  Supply,
} from '../types/domain';

export function normalizeToBaseUnit(
  amount: number,
  purchaseUnit: PurchaseUnit
): { baseUnit: BaseUnit; baseTotalQuantity: number } {
  const safeAmount = Math.max(0, Number(amount) || 0);
  switch (purchaseUnit) {
    case 'kg':
      return { baseUnit: 'g', baseTotalQuantity: safeAmount * 1000 };
    case 'g':
      return { baseUnit: 'g', baseTotalQuantity: safeAmount };
    case 'l':
      return { baseUnit: 'ml', baseTotalQuantity: safeAmount * 1000 };
    case 'ml':
      return { baseUnit: 'ml', baseTotalQuantity: safeAmount };
    case 'docena':
      return { baseUnit: 'u', baseTotalQuantity: safeAmount * 12 };
    case 'pack':
    case 'u':
    default:
      return { baseUnit: 'u', baseTotalQuantity: safeAmount };
  }
}

/**
 * Calcula el costo por 1 gramo, 1 mililitro o 1 unidad.
 */
export function calculateSupplyUnitCost(supply: Supply): number {
  if (!supply || supply.baseTotalQuantity <= 0) return 0;
  return supply.purchasePrice / supply.baseTotalQuantity;
}

export interface IngredientCostLine {
  supplyId: string;
  supplyName: string;
  baseUnit: BaseUnit;
  quantity: number;
  unitCost: number;
  subtotalCost: number;
  missingSupply: boolean;
}

export interface PackagingCostLine {
  supplyId: string;
  supplyName: string;
  quantity: number;
  unitCost: number;
  subtotalCost: number;
}

export interface VariantCostBreakdown {
  recipeId: string;
  recipeName: string;
  variantId: string;
  variantName: string;
  format: RecipeVariant['format'];
  ingredientLines: IngredientCostLine[];
  packagingLines: PackagingCostLine[];
  ingredientsCost: number;
  utilityPercent: number;
  utilityCost: number;
  packagingCost: number;
  totalProductionCost: number;
  defaultMarkupPercent: number;
  suggestedPriceExact: number;
  suggestedPriceRounded: number;
  effectiveSalePrice: number;
  netProfitPerUnit: number;
  actualMarkupPercent: number;
  actualMarginPercent: number;
}

/**
 * Redondeo comercial amigable (a múltiplos de 50 o 100 para precios altos, o entero para precios bajos)
 */
export function roundCommercialPrice(price: number): number {
  if (price <= 0) return 0;
  if (price < 50) return Math.ceil(price * 2) / 2;
  if (price < 500) return Math.ceil(price / 5) * 5;
  if (price < 5000) return Math.ceil(price / 50) * 50;
  return Math.ceil(price / 100) * 100;
}

export function calculateVariantCostBreakdown(
  recipe: Recipe,
  variant: RecipeVariant,
  supplies: Supply[]
): VariantCostBreakdown {
  const suppliesMap = new Map<string, Supply>(supplies.map((s) => [s.id, s]));

  const sourceIngredients: RecipeIngredientLine[] =
    variant.customIngredients && variant.customIngredients.length > 0
      ? variant.customIngredients
      : recipe.baseIngredients.map((line) => ({
          ...line,
          quantity: Number((line.quantity * variant.scaleFactor).toFixed(2)),
        }));

  const ingredientLines: IngredientCostLine[] = sourceIngredients.map((line) => {
    const supply = suppliesMap.get(line.supplyId);
    if (!supply) {
      return {
        supplyId: line.supplyId,
        supplyName: 'Insumo no encontrado',
        baseUnit: 'g',
        quantity: line.quantity,
        unitCost: 0,
        subtotalCost: 0,
        missingSupply: true,
      };
    }
    const unitCost = calculateSupplyUnitCost(supply);
    const subtotalCost = unitCost * line.quantity;
    return {
      supplyId: supply.id,
      supplyName: supply.name,
      baseUnit: supply.baseUnit,
      quantity: line.quantity,
      unitCost,
      subtotalCost,
      missingSupply: false,
    };
  });

  const packagingLines: PackagingCostLine[] = variant.packagingItems.map((pkg) => {
    const supply = suppliesMap.get(pkg.supplyId);
    if (!supply) {
      return {
        supplyId: pkg.supplyId,
        supplyName: 'Envase no encontrado',
        quantity: pkg.quantity,
        unitCost: 0,
        subtotalCost: 0,
      };
    }
    const unitCost = calculateSupplyUnitCost(supply);
    return {
      supplyId: supply.id,
      supplyName: supply.name,
      quantity: pkg.quantity,
      unitCost,
      subtotalCost: unitCost * pkg.quantity,
    };
  });

  const ingredientsCost = ingredientLines.reduce((acc, item) => acc + item.subtotalCost, 0);
  const utilityCost = ingredientsCost * (Math.max(0, variant.utilityPercent) / 100);
  const packagingCost = packagingLines.reduce((acc, item) => acc + item.subtotalCost, 0);
  const totalProductionCost = ingredientsCost + utilityCost + packagingCost;

  const suggestedPriceExact =
    totalProductionCost * (1 + Math.max(0, variant.defaultMarkupPercent) / 100);
  const suggestedPriceRounded = roundCommercialPrice(suggestedPriceExact);

  const effectiveSalePrice =
    variant.manualSalePrice && variant.manualSalePrice > 0
      ? variant.manualSalePrice
      : suggestedPriceRounded;

  const netProfitPerUnit = effectiveSalePrice - totalProductionCost;
  const actualMarkupPercent =
    totalProductionCost > 0 ? (netProfitPerUnit / totalProductionCost) * 100 : 0;
  const actualMarginPercent =
    effectiveSalePrice > 0 ? (netProfitPerUnit / effectiveSalePrice) * 100 : 0;

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    variantId: variant.id,
    variantName: variant.name,
    format: variant.format,
    ingredientLines,
    packagingLines,
    ingredientsCost,
    utilityPercent: variant.utilityPercent,
    utilityCost,
    packagingCost,
    totalProductionCost,
    defaultMarkupPercent: variant.defaultMarkupPercent,
    suggestedPriceExact,
    suggestedPriceRounded,
    effectiveSalePrice,
    netProfitPerUnit,
    actualMarkupPercent,
    actualMarginPercent,
  };
}

export interface PricingSimulationResult {
  totalCost: number;
  desiredPercent: number;
  mode: 'markup' | 'margin';
  suggestedPriceExact: number;
  suggestedPriceRounded: number;
  netProfitExact: number;
  netProfitRounded: number;
  effectiveMarkupPercent: number;
  effectiveMarginPercent: number;
}

export function simulatePricing(
  totalCost: number,
  desiredPercent: number,
  mode: 'markup' | 'margin' = 'markup'
): PricingSimulationResult {
  const safeCost = Math.max(0, totalCost);
  const safePct = Math.max(0, desiredPercent);

  let suggestedPriceExact = 0;
  if (mode === 'markup') {
    suggestedPriceExact = safeCost * (1 + safePct / 100);
  } else {
    // Margin mode: Price = Cost / (1 - Margin%)
    const clampedMargin = Math.min(95, safePct);
    suggestedPriceExact = safeCost / (1 - clampedMargin / 100);
  }

  const suggestedPriceRounded = roundCommercialPrice(suggestedPriceExact);
  const netProfitExact = suggestedPriceExact - safeCost;
  const netProfitRounded = suggestedPriceRounded - safeCost;

  const effectiveMarkupPercent =
    safeCost > 0 ? (netProfitRounded / safeCost) * 100 : 0;
  const effectiveMarginPercent =
    suggestedPriceRounded > 0 ? (netProfitRounded / suggestedPriceRounded) * 100 : 0;

  return {
    totalCost: safeCost,
    desiredPercent: safePct,
    mode,
    suggestedPriceExact,
    suggestedPriceRounded,
    netProfitExact,
    netProfitRounded,
    effectiveMarkupPercent,
    effectiveMarginPercent,
  };
}

export interface OrderFinancialSummary {
  totalPrice: number;
  totalCost: number;
  expectedProfit: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: 'pagado' | 'sena_parcial' | 'sin_pagar';
  /** Cliente ya retiró el producto pero dejó saldo sin pagar */
  isDeliveredWithDebt: boolean;
  /** De lo cobrado hasta ahora, cuánto va al Fondo Intocable de Reposición */
  collectedReplacementFund: number;
  /** De lo cobrado hasta ahora, cuánto es Ganancia Bruta Realizada */
  collectedGrossProfit: number;
}

export function calculateOrderFinancials(order: Order): OrderFinancialSummary {
  if (order.status === 'cancelado') {
    return {
      totalPrice: 0,
      totalCost: 0,
      expectedProfit: 0,
      paidAmount: 0,
      balanceDue: 0,
      paymentStatus: 'sin_pagar',
      isDeliveredWithDebt: false,
      collectedReplacementFund: 0,
      collectedGrossProfit: 0,
    };
  }

  const totalPrice = order.items.reduce(
    (acc, item) => acc + item.quantity * item.unitPriceSnapshot,
    0
  );
  const totalCost = order.items.reduce(
    (acc, item) => acc + item.quantity * item.unitCostSnapshot,
    0
  );
  const expectedProfit = Math.max(0, totalPrice - totalCost);

  const paidAmount = order.payments.reduce((acc, p) => acc + p.amount, 0);
  const balanceDue = Math.max(0, totalPrice - paidAmount);

  let paymentStatus: OrderFinancialSummary['paymentStatus'] = 'sin_pagar';
  if (paidAmount >= totalPrice && totalPrice > 0) {
    paymentStatus = 'pagado';
  } else if (paidAmount > 0) {
    paymentStatus = 'sena_parcial';
  }

  const isDeliveredWithDebt = order.status === 'entregado' && balanceDue > 0.01;

  // Regla Conservadora "Primero Reposición":
  // El dinero que entra de una seña o pago cubre PRIMERO el costo de los insumos/packaging.
  // Recién cuando lo cobrado supera el costo de producción, el excedente es ganancia.
  const collectedReplacementFund = Math.min(paidAmount, totalCost);
  const collectedGrossProfit = Math.max(0, paidAmount - totalCost);

  return {
    totalPrice,
    totalCost,
    expectedProfit,
    paidAmount,
    balanceDue,
    paymentStatus,
    isDeliveredWithDebt,
    collectedReplacementFund,
    collectedGrossProfit,
  };
}

export interface CashAndFundsSummary {
  /** Dinero total cobrado por pedidos (señas + pagos totales) */
  orderPaymentsTotal: number;
  /** Dinero total cobrado por ventas rápidas de mostrador */
  counterSalesTotal: number;
  /** Total de ingresos brutos que entraron a la caja */
  totalGrossIncome: number;

  /**
   * FONDO DE REPOSICIÓN (INTOCABLE PARA COMPRAR MERCADERÍA)
   * Todo el costo de producción de lo cobrado + aportes de capital - compras de insumos ya hechas
   */
  replacementCostAccrued: number;
  capitalInjectionsTotal: number;
  supplyPurchasesTotal: number;
  /** Dinero que DEBE estar guardado hoy en la caja para reponer mercadería */
  untouchableReplacementFund: number;

  /**
   * FONDO DE GANANCIA Y GASTOS OPERATIVOS
   */
  grossProfitFromSales: number;
  operationalExpensesTotal: number;
  /** Ganancia Neta del negocio después de pagar film, limpieza, delivery, publicidad */
  netBusinessProfit: number;
  personalWithdrawalsTotal: number;
  /** Saldo 100% libre en ganancias que el emprendedor PUEDE gastar o retirar sin tocar insumos */
  availableFreeProfit: number;

  /** Saldo total de dinero físico/cuentas que hay en la caja hoy */
  totalCashBalance: number;

  /** Deudas en la calle */
  deliveredDebtTotal: number;
  pendingOrdersBalanceTotal: number;
}

export function calculateCashAndFundsSummary(
  orders: Order[],
  movements: CashMovement[]
): CashAndFundsSummary {
  let orderPaymentsTotal = 0;
  let replacementFromOrders = 0;
  let grossProfitFromOrders = 0;
  let deliveredDebtTotal = 0;
  let pendingOrdersBalanceTotal = 0;

  for (const order of orders) {
    if (order.status === 'cancelado') continue;
    const fin = calculateOrderFinancials(order);
    orderPaymentsTotal += fin.paidAmount;
    replacementFromOrders += fin.collectedReplacementFund;
    grossProfitFromOrders += fin.collectedGrossProfit;

    if (fin.isDeliveredWithDebt) {
      deliveredDebtTotal += fin.balanceDue;
    } else if (fin.balanceDue > 0) {
      pendingOrdersBalanceTotal += fin.balanceDue;
    }
  }

  let counterSalesTotal = 0;
  let replacementFromCounter = 0;
  let grossProfitFromCounter = 0;
  let capitalInjectionsTotal = 0;
  let supplyPurchasesTotal = 0;
  let operationalExpensesTotal = 0;
  let personalWithdrawalsTotal = 0;

  for (const mov of movements) {
    switch (mov.type) {
      case 'venta_mostrador': {
        counterSalesTotal += mov.amount;
        const repCost = Math.min(
          mov.amount,
          mov.replacementCostPortion ?? mov.amount * 0.45
        );
        replacementFromCounter += repCost;
        grossProfitFromCounter += Math.max(0, mov.amount - repCost);
        break;
      }
      case 'aporte_capital':
        capitalInjectionsTotal += mov.amount;
        break;
      case 'compra_insumos':
        supplyPurchasesTotal += mov.amount;
        break;
      case 'gasto_operativo':
        operationalExpensesTotal += mov.amount;
        break;
      case 'retiro_personal':
        personalWithdrawalsTotal += mov.amount;
        break;
    }
  }

  const totalGrossIncome = orderPaymentsTotal + counterSalesTotal;
  const replacementCostAccrued = replacementFromOrders + replacementFromCounter;

  // El fondo de reposición acumulado menos lo que ya se reinvirtió comprando insumos
  const rawReplacementFund =
    replacementCostAccrued + capitalInjectionsTotal - supplyPurchasesTotal;
  const untouchableReplacementFund = Math.max(0, rawReplacementFund);

  // Si compró más insumos en efectivo de lo que había en el fondo de reposición,
  // ese adelanto reduce temporalmente la liquidez disponible en ganancia
  const replacementDeficit = rawReplacementFund < 0 ? Math.abs(rawReplacementFund) : 0;

  const grossProfitFromSales = grossProfitFromOrders + grossProfitFromCounter;
  const netBusinessProfit = grossProfitFromSales - operationalExpensesTotal;
  const availableFreeProfit =
    netBusinessProfit - personalWithdrawalsTotal - replacementDeficit;

  const totalCashBalance =
    totalGrossIncome +
    capitalInjectionsTotal -
    supplyPurchasesTotal -
    operationalExpensesTotal -
    personalWithdrawalsTotal;

  return {
    orderPaymentsTotal,
    counterSalesTotal,
    totalGrossIncome,
    replacementCostAccrued,
    capitalInjectionsTotal,
    supplyPurchasesTotal,
    untouchableReplacementFund,
    grossProfitFromSales,
    operationalExpensesTotal,
    netBusinessProfit,
    personalWithdrawalsTotal,
    availableFreeProfit,
    totalCashBalance,
    deliveredDebtTotal,
    pendingOrdersBalanceTotal,
  };
}

export interface SpendingAssistantVerdict {
  status: 'safe' | 'warning' | 'danger';
  title: string;
  message: string;
  maxSafeAmount: number;
  remainingFreeProfitAfter: number;
  invadesReplacementFundBy: number;
}

export function evaluateSpendingQuery(
  requestedAmount: number,
  summary: CashAndFundsSummary
): SpendingAssistantVerdict {
  const amount = Math.max(0, requestedAmount);
  const maxSafeAmount = Math.max(0, summary.availableFreeProfit);

  if (amount <= 0) {
    return {
      status: maxSafeAmount > 0 ? 'safe' : 'warning',
      title:
        maxSafeAmount > 0
          ? 'Tienes ganancias libres disponibles'
          : 'Sin ganancias libres por ahora',
      message:
        maxSafeAmount > 0
          ? 'Ingresa un monto arriba para simular si puedes hacer un retiro personal o gasto extra sin tocar el dinero de tu mercadería.'
          : 'Actualmente todo el dinero en caja corresponde al Fondo Intocable de Reposición de Insumos o ya fue utilizado en gastos operativos.',
      maxSafeAmount,
      remainingFreeProfitAfter: maxSafeAmount,
      invadesReplacementFundBy: 0,
    };
  }

  if (amount <= maxSafeAmount) {
    const remaining = maxSafeAmount - amount;
    const isTight = remaining < maxSafeAmount * 0.2;
    return {
      status: isTight ? 'warning' : 'safe',
      title: isTight
        ? '¡Sí puedes, pero quedarás con poco margen!'
        : '¡Adelante! Gasto 100% seguro',
      message: isTight
        ? 'El gasto sale de tu ganancia neta y NO toca el dinero de reposición de ingredientes, pero consumirá casi todo tu saldo libre actual.'
        : 'Este monto sale íntegramente de tu Ganancia Neta Libre. Tu Fondo de Reposición de mercadería sigue 100% protegido e intocable.',
      maxSafeAmount,
      remainingFreeProfitAfter: remaining,
      invadesReplacementFundBy: 0,
    };
  }

  const invasion = amount - maxSafeAmount;
  return {
    status: 'danger',
    title: '¡ALERTA! Estarías tocando plata de la mercadería',
    message:
      'No te alcanza con tu ganancia neta libre. Si haces este gasto hoy, estarás usando dinero del Fondo de Reposición y te faltará capital para volver a comprar ingredientes y envases.',
    maxSafeAmount,
    remainingFreeProfitAfter: 0,
    invadesReplacementFundBy: invasion,
  };
}

export function formatCurrency(
  value: number,
  currencySymbol = '$',
  decimals: 0 | 2 = 0
): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeVal);
  return `${currencySymbol}${formatted}`;
}

export function formatUnitCost(value: number, currencySymbol = '$'): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  if (safeVal === 0) return `${currencySymbol}0`;
  if (safeVal < 1) {
    return `${currencySymbol}${safeVal.toFixed(3)}`;
  }
  if (safeVal < 100) {
    return `${currencySymbol}${safeVal.toFixed(2)}`;
  }
  return `${currencySymbol}${Math.round(safeVal).toLocaleString('es-AR')}`;
}

