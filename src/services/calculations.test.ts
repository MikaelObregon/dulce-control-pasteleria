import { describe, expect, it } from 'vitest';
import {
  calculateCashAndFundsSummary,
  calculateOrderFinancials,
  calculateSupplyUnitCost,
  calculateVariantCostBreakdown,
  evaluateSpendingQuery,
  normalizeToBaseUnit,
  simulatePricing,
} from './calculations';
import { INITIAL_RECIPES, INITIAL_SUPPLIES } from '../data/seedData';
import { CashMovement, Order } from '../types/domain';

describe('DulceControl Domain Calculations', () => {
  it('normalizes package units to base units (g, ml, u) and computes unit cost', () => {
    const kgNorm = normalizeToBaseUnit(1.5, 'kg');
    expect(kgNorm).toEqual({ baseUnit: 'g', baseTotalQuantity: 1500 });

    const docNorm = normalizeToBaseUnit(2, 'docena');
    expect(docNorm).toEqual({ baseUnit: 'u', baseTotalQuantity: 24 });

    const condensedMilk = INITIAL_SUPPLIES.find(
      (s) => s.id === 'sup-leche-condensada'
    )!;
    const unitCost = calculateSupplyUnitCost(condensedMilk);
    expect(unitCost).toBeCloseTo(2400 / 395, 4);
  });

  it('recalculates recipe variants automatically when an ingredient price changes', () => {
    const tresLeches = INITIAL_RECIPES.find((r) => r.id === 'recipe-tres-leches')!;
    const mediana = tresLeches.variants.find((v) => v.format === 'mediana')!;
    const individual = tresLeches.variants.find((v) => v.format === 'individual')!;

    const beforeMediana = calculateVariantCostBreakdown(
      tresLeches,
      mediana,
      INITIAL_SUPPLIES
    );
    const beforeIndividual = calculateVariantCostBreakdown(
      tresLeches,
      individual,
      INITIAL_SUPPLIES
    );

    // Increase condensed milk price by +$1,000
    const updatedSupplies = INITIAL_SUPPLIES.map((s) =>
      s.id === 'sup-leche-condensada'
        ? { ...s, purchasePrice: s.purchasePrice + 1000 }
        : s
    );

    const afterMediana = calculateVariantCostBreakdown(
      tresLeches,
      mediana,
      updatedSupplies
    );
    const afterIndividual = calculateVariantCostBreakdown(
      tresLeches,
      individual,
      updatedSupplies
    );

    // Mediana uses 1 full can (395g) + 6% utility on ingredients
    expect(afterMediana.ingredientsCost - beforeMediana.ingredientsCost).toBeCloseTo(
      1000,
      2
    );
    expect(afterMediana.totalProductionCost).toBeGreaterThan(
      beforeMediana.totalProductionCost
    );
    expect(afterIndividual.totalProductionCost).toBeGreaterThan(
      beforeIndividual.totalProductionCost
    );
  });

  it('simulates pricing markup and net profit accurately', () => {
    const sim = simulatePricing(10000, 100, 'markup');
    expect(sim.suggestedPriceExact).toBe(20000);
    expect(sim.netProfitRounded).toBe(10000);
    expect(sim.effectiveMarkupPercent).toBe(100);
  });

  it('applies "Primero Reposición" rule on partial deposits and detects delivered debt', () => {
    const orderWithDeposit: Order = {
      id: 'ord-1',
      clientName: 'Cliente Seña',
      clientPhone: '123456',
      deliveryDate: '2026-11-02',
      deliveryTime: '18:00',
      status: 'entregado',
      items: [
        {
          id: 'i-1',
          recipeId: 'r-1',
          recipeName: 'Torta Tres Leches',
          variantId: 'v-1',
          variantName: 'Mediana',
          quantity: 1,
          unitCostSnapshot: 10000,
          unitPriceSnapshot: 20000,
        },
      ],
      payments: [
        {
          id: 'p-1',
          amount: 12000,
          date: '2026-11-02',
          method: 'efectivo',
        },
      ],
      createdAt: '2026-11-02',
    };

    const fin = calculateOrderFinancials(orderWithDeposit);
    expect(fin.totalPrice).toBe(20000);
    expect(fin.totalCost).toBe(10000);
    expect(fin.paidAmount).toBe(12000);
    expect(fin.balanceDue).toBe(8000);
    expect(fin.isDeliveredWithDebt).toBe(true);
    // First $10,000 covers Replacement Fund; remaining $2,000 is realized Gross Profit
    expect(fin.collectedReplacementFund).toBe(10000);
    expect(fin.collectedGrossProfit).toBe(2000);
  });

  it('separates Replacement Fund from Free Net Profit and evaluates spending safety', () => {
    const orders: Order[] = [
      {
        id: 'ord-paid',
        clientName: 'Ana',
        clientPhone: '',
        deliveryDate: '2026-11-02',
        deliveryTime: '15:00',
        status: 'entregado',
        items: [
          {
            id: 'i-1',
            recipeId: 'r-1',
            recipeName: 'Marquesa',
            variantId: 'v-1',
            variantName: 'Mediana',
            quantity: 1,
            unitCostSnapshot: 10000,
            unitPriceSnapshot: 22000,
          },
        ],
        payments: [
          {
            id: 'p-1',
            amount: 22000,
            date: '2026-11-02',
            method: 'efectivo',
          },
        ],
        createdAt: '2026-11-02',
      },
    ];

    const movements: CashMovement[] = [
      {
        id: 'm-1',
        type: 'gasto_operativo',
        amount: 2000,
        category: 'descartables_film',
        description: 'Papel film',
        date: '2026-11-02',
      },
    ];

    const summary = calculateCashAndFundsSummary(orders, movements);
    expect(summary.untouchableReplacementFund).toBe(10000);
    expect(summary.grossProfitFromSales).toBe(12000);
    expect(summary.operationalExpensesTotal).toBe(2000);
    expect(summary.availableFreeProfit).toBe(10000);
    expect(summary.totalCashBalance).toBe(20000);

    // Query spending $6,000 -> Safe (within $10,000 free profit)
    const safeCheck = evaluateSpendingQuery(6000, summary);
    expect(safeCheck.status).toBe('safe');
    expect(safeCheck.invadesReplacementFundBy).toBe(0);
    expect(safeCheck.remainingFreeProfitAfter).toBe(4000);

    // Query spending $14,000 -> Danger (invades untouchable replacement fund by $4,000!)
    const dangerCheck = evaluateSpendingQuery(14000, summary);
    expect(dangerCheck.status).toBe('danger');
    expect(dangerCheck.invadesReplacementFundBy).toBe(4000);
  });
});

