import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Flame,
  HelpCircle,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  calculateOrderFinancials,
  calculateVariantCostBreakdown,
  evaluateSpendingQuery,
} from '../../services/calculations';
import {
  CashMovementType,
  OperationalExpenseCategory,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
} from '../../types/domain';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string; nextStatus?: OrderStatus; nextLabel?: string }
> = {
  pendiente: {
    label: 'Pendiente',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
    nextStatus: 'en_preparacion',
    nextLabel: 'Pasar a Preparación',
  },
  en_preparacion: {
    label: 'En Preparación',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    nextStatus: 'listo',
    nextLabel: 'Marcar Listo',
  },
  listo: {
    label: 'Listo p/ Entregar',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    nextStatus: 'entregado',
    nextLabel: 'Marcar Entregado',
  },
  entregado: {
    label: 'Entregado',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
};

const EXPENSE_CATEGORY_LABELS: Record<OperationalExpenseCategory, string> = {
  limpieza: '🧼 Productos de Limpieza',
  descartables_film: '🧻 Papel Film / Aluminio / Mangas',
  delivery: '🛵 Delivery / Envíos',
  publicidad: '📣 Publicidad / Redes',
  servicios: '💡 Gas / Luz / Internet',
  otros: '📌 Otros Gastos Generales',
};

export const TodayAndCashView: React.FC = () => {
  const {
    orders,
    movements,
    recipes,
    supplies,
    settings,
    cashSummary,
    formatMoney,
    createOrder,
    updateOrder,
    updateOrderStatus,
    addOrderPayment,
    deleteOrderPayment,
    deleteOrder,
    addCashMovement,
    deleteCashMovement,
    resetDemoTransactions,
  } = useStore();

  const todayStr = new Date().toISOString().slice(0, 10);

  // Sub-section toggle: 'pedidos' vs 'movimientos'
  const [subView, setSubView] = useState<'pedidos' | 'movimientos'>('pedidos');
  const [orderFilter, setOrderFilter] = useState<
    'por_entregar' | 'con_deuda' | 'entregados' | 'todos'
  >('por_entregar');

  // Spending Assistant modal state
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [queryAmount, setQueryAmount] = useState('');

  // Create / Edit Order Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(todayStr);
  const [deliveryTime, setDeliveryTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('transferencia');
  const [draftItems, setDraftItems] = useState<
    Array<{
      recipeId: string;
      variantId: string;
      quantity: number;
      customUnitPrice: string;
    }>
  >([]);

  // Collect Payment & Manage Payments Modal
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('transferencia');
  const [payNote, setPayNote] = useState('');

  // Cash Movement Modal
  const [modalType, setModalType] = useState<CashMovementType | null>(null);
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [movCategory, setMovCategory] =
    useState<OperationalExpenseCategory>('descartables_film');
  const [movMethod, setMovMethod] = useState<PaymentMethod>('efectivo');
  const [counterRecipeId, setCounterRecipeId] = useState(recipes[0]?.id || '');
  const [counterVariantId, setCounterVariantId] = useState(
    recipes[0]?.variants[0]?.id || ''
  );
  const [counterQty, setCounterQty] = useState('1');

  const assistantVerdict = useMemo(() => {
    const val = Number(queryAmount) || 0;
    return evaluateSpendingQuery(val, cashSummary);
  }, [queryAmount, cashSummary]);

  const deliveredDebtOrders = useMemo(
    () => orders.filter((o) => calculateOrderFinancials(o).isDeliveredWithDebt),
    [orders]
  );

  const pendingBalanceOrders = useMemo(
    () =>
      orders.filter((o) => {
        const fin = calculateOrderFinancials(o);
        return o.status !== 'cancelado' && fin.balanceDue > 0.01;
      }),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) =>
      `${a.deliveryDate}T${a.deliveryTime}`.localeCompare(
        `${b.deliveryDate}T${b.deliveryTime}`
      )
    );
    return sorted.filter((o) => {
      const fin = calculateOrderFinancials(o);
      if (orderFilter === 'por_entregar') {
        return (
          o.status === 'pendiente' ||
          o.status === 'en_preparacion' ||
          o.status === 'listo'
        );
      }
      if (orderFilter === 'con_deuda') {
        return o.status !== 'cancelado' && fin.balanceDue > 0.01;
      }
      if (orderFilter === 'entregados') {
        return o.status === 'entregado';
      }
      return true;
    });
  }, [orders, orderFilter]);

  const openNewOrderModal = () => {
    const firstRec = recipes[0];
    const firstVar =
      firstRec?.variants.find((v) => v.format === 'mediana') || firstRec?.variants[0];
    setEditingOrderId(null);
    setClientName('');
    setClientPhone('');
    setDeliveryDate(todayStr);
    setDeliveryTime('17:00');
    setNotes('');
    setInitialDeposit('');
    setDepositMethod('transferencia');
    setDraftItems(
      firstRec && firstVar
        ? [
            {
              recipeId: firstRec.id,
              variantId: firstVar.id,
              quantity: 1,
              customUnitPrice: '',
            },
          ]
        : []
    );
    setIsOrderModalOpen(true);
  };

  const openEditOrderModal = (order: Order) => {
    setEditingOrderId(order.id);
    setClientName(order.clientName);
    setClientPhone(order.clientPhone);
    setDeliveryDate(order.deliveryDate);
    setDeliveryTime(order.deliveryTime);
    setNotes(order.notes || '');
    setInitialDeposit('');
    setDraftItems(
      order.items.map((item) => ({
        recipeId: item.recipeId,
        variantId: item.variantId,
        quantity: item.quantity,
        customUnitPrice: String(item.unitPriceSnapshot),
      }))
    );
    setIsOrderModalOpen(true);
  };

  const draftOrderTotals = useMemo(() => {
    let totalCost = 0;
    let totalPrice = 0;
    const resolvedItems: OrderItem[] = [];

    draftItems.forEach((line, idx) => {
      const rec = recipes.find((r) => r.id === line.recipeId);
      const vari = rec?.variants.find((v) => v.id === line.variantId);
      if (rec && vari) {
        const b = calculateVariantCostBreakdown(rec, vari, supplies);
        const qty = Math.max(1, Number(line.quantity) || 1);
        const customPriceVal =
          line.customUnitPrice.trim() !== '' && Number(line.customUnitPrice) > 0
            ? Number(line.customUnitPrice)
            : b.effectiveSalePrice;

        totalCost += b.totalProductionCost * qty;
        totalPrice += customPriceVal * qty;
        resolvedItems.push({
          id: `item-${Date.now()}-${idx}`,
          recipeId: rec.id,
          recipeName: rec.name,
          variantId: vari.id,
          variantName: vari.name,
          quantity: qty,
          unitCostSnapshot: b.totalProductionCost,
          unitPriceSnapshot: customPriceVal,
        });
      }
    });

    return {
      totalCost,
      totalPrice,
      expectedProfit: totalPrice - totalCost,
      resolvedItems,
    };
  }, [draftItems, recipes, supplies]);

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || draftOrderTotals.resolvedItems.length === 0) return;

    if (editingOrderId) {
      updateOrder(editingOrderId, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        deliveryDate,
        deliveryTime,
        items: draftOrderTotals.resolvedItems,
        notes: notes.trim(),
      });
    } else {
      const depositVal = Math.max(0, Number(initialDeposit) || 0);
      const payments =
        depositVal > 0
          ? [
              {
                id: `pay-${Date.now()}`,
                amount: depositVal,
                date: new Date().toISOString(),
                method: depositMethod,
                note:
                  depositVal >= draftOrderTotals.totalPrice
                    ? 'Pago total al encargar'
                    : 'Seña inicial',
              },
            ]
          : [];

      createOrder({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        deliveryDate,
        deliveryTime,
        status: 'pendiente',
        items: draftOrderTotals.resolvedItems,
        payments,
        notes: notes.trim(),
      });
    }

    setIsOrderModalOpen(false);
  };

  const openPaymentModal = (order: Order) => {
    const fin = calculateOrderFinancials(order);
    setPayingOrder(order);
    setPayAmount(fin.balanceDue > 0 ? String(fin.balanceDue) : '');
    setPayMethod('efectivo');
    setPayNote('Cobro de saldo');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingOrder) return;
    const val = Math.max(0, Number(payAmount) || 0);
    if (val <= 0) return;

    addOrderPayment(payingOrder.id, {
      amount: val,
      date: new Date().toISOString(),
      method: payMethod,
      note: payNote.trim() || 'Pago registrado',
    });
    setPayingOrder(null);
  };

  const openMovementModal = (type: CashMovementType) => {
    setModalType(type);
    setMovAmount('');
    setMovDesc('');
    setMovCategory('descartables_film');
    setMovMethod('efectivo');
    if (type === 'venta_mostrador' && recipes[0] && recipes[0].variants[0]) {
      const r = recipes[0];
      const v = r.variants[0];
      setCounterRecipeId(r.id);
      setCounterVariantId(v.id);
      setCounterQty('1');
      const b = calculateVariantCostBreakdown(r, v, supplies);
      setMovAmount(String(b.effectiveSalePrice));
      setMovDesc(`Venta mostrador: 1x ${r.name} (${v.name})`);
    }
  };

  const handleCounterProductChange = (recId: string, varId: string, qtyStr: string) => {
    const r = recipes.find((rec) => rec.id === recId);
    const v = r?.variants.find((vari) => vari.id === varId) || r?.variants[0];
    const qty = Math.max(1, Number(qtyStr) || 1);
    if (r && v) {
      const b = calculateVariantCostBreakdown(r, v, supplies);
      setMovAmount(String(b.effectiveSalePrice * qty));
      setMovDesc(`Venta mostrador: ${qty}x ${r.name} (${v.name})`);
    }
  };

  const handleSaveMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType) return;
    const amountVal = Math.max(0, Number(movAmount) || 0);
    if (amountVal <= 0) return;

    let replacementCostPortion: number | undefined = undefined;
    if (modalType === 'venta_mostrador') {
      const r = recipes.find((rec) => rec.id === counterRecipeId);
      const v = r?.variants.find((vari) => vari.id === counterVariantId);
      const qty = Math.max(1, Number(counterQty) || 1);
      if (r && v) {
        const b = calculateVariantCostBreakdown(r, v, supplies);
        replacementCostPortion = b.totalProductionCost * qty;
      } else {
        replacementCostPortion = amountVal * 0.48;
      }
    }

    addCashMovement({
      type: modalType,
      amount: amountVal,
      replacementCostPortion,
      category: modalType === 'gasto_operativo' ? movCategory : undefined,
      description:
        movDesc.trim() ||
        (modalType === 'gasto_operativo'
          ? EXPENSE_CATEGORY_LABELS[movCategory]
          : modalType === 'compra_insumos'
            ? 'Compra de reposición de insumos'
            : modalType === 'retiro_personal'
              ? 'Retiro personal de ganancias'
              : 'Movimiento de caja'),
      date: new Date().toISOString(),
      method: movMethod,
    });
    setModalType(null);
  };

  const buildWhatsAppLink = (order: Order, balanceDue: number) => {
    const cleanPhone = order.clientPhone.replace(/\D/g, '');
    if (!cleanPhone) return null;
    const itemsText = order.items
      .map((i) => `${i.quantity}x ${i.recipeName} (${i.variantName})`)
      .join(', ');
    const message =
      order.status === 'entregado' && balanceDue > 0
        ? `Hola ${order.clientName}! 👋 Te escribo de ${settings.businessName} para recordarte el saldo pendiente de ${formatMoney(balanceDue)} por tu pedido (${itemsText}). ¡Muchas gracias!`
        : `Hola ${order.clientName}! 👋 Te escribimos de ${settings.businessName} por tu pedido de ${itemsText} para el ${order.deliveryDate} a las ${order.deliveryTime}hs.${
            balanceDue > 0
              ? ` Saldo a abonar al retirar: ${formatMoney(balanceDue)}.`
              : ' (Pagado total).'
          }`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const unifiedFeed = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      title: string;
      subtitle: string;
      amount: number;
      isIncome: boolean;
      badge: string;
      badgeColor: string;
      canDelete: boolean;
    }> = [];

    for (const order of orders) {
      if (order.status === 'cancelado') continue;
      for (const pay of order.payments) {
        list.push({
          id: `ordpay-${pay.id}`,
          date: pay.date,
          title: `Cobro Pedido: ${order.clientName}`,
          subtitle: `${pay.note || 'Pago/Seña'} (${pay.method})`,
          amount: pay.amount,
          isIncome: true,
          badge: 'Ingreso Pedido',
          badgeColor: 'bg-emerald-100 text-emerald-800',
          canDelete: false,
        });
      }
    }

    for (const mov of movements) {
      if (mov.type === 'venta_mostrador') {
        list.push({
          id: mov.id,
          date: mov.date,
          title: mov.description,
          subtitle: `Separa ${formatMoney(mov.replacementCostPortion || 0)} a Reposición`,
          amount: mov.amount,
          isIncome: true,
          badge: 'Venta Mostrador',
          badgeColor: 'bg-emerald-100 text-emerald-800',
          canDelete: true,
        });
      } else if (mov.type === 'gasto_operativo') {
        list.push({
          id: mov.id,
          date: mov.date,
          title: mov.description,
          subtitle: mov.category
            ? EXPENSE_CATEGORY_LABELS[mov.category]
            : 'Gasto operativo',
          amount: mov.amount,
          isIncome: false,
          badge: 'Gasto Operativo',
          badgeColor: 'bg-orange-100 text-orange-900',
          canDelete: true,
        });
      } else if (mov.type === 'compra_insumos') {
        list.push({
          id: mov.id,
          date: mov.date,
          title: mov.description,
          subtitle: 'Pagado desde el Fondo de Reposición',
          amount: mov.amount,
          isIncome: false,
          badge: 'Reposición Mercadería',
          badgeColor: 'bg-amber-100 text-amber-900',
          canDelete: true,
        });
      } else if (mov.type === 'retiro_personal') {
        list.push({
          id: mov.id,
          date: mov.date,
          title: mov.description,
          subtitle: 'Descontado de tu Ganancia Libre',
          amount: mov.amount,
          isIncome: false,
          badge: 'Retiro Personal',
          badgeColor: 'bg-purple-100 text-purple-900',
          canDelete: true,
        });
      }
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, movements, formatMoney]);

  // Keep modal payingOrder synced with latest order state
  const livePayingOrder = useMemo(
    () => (payingOrder ? orders.find((o) => o.id === payingOrder.id) || null : null),
    [orders, payingOrder]
  );

  return (
    <div className="space-y-4 pb-12">
      {/* 1. PANEL PRINCIPAL: BOLSILLOS DE REPOSICIÓN VS GANANCIA + ASISTENTE */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-rose-950 rounded-3xl p-5 text-white shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-pink-300 block">
              Control de Fondos en Tiempo Real
            </span>
            <h1 className="text-xl font-black tracking-tight">
              Total en Caja: {formatMoney(cashSummary.totalCashBalance)}
            </h1>
          </div>
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-400 hover:bg-emerald-300 text-stone-950 text-xs font-black px-4 py-2.5 rounded-2xl shadow-md active:scale-98 transition cursor-pointer shrink-0"
          >
            <HelpCircle className="w-4 h-4 stroke-[2.5]" />
            ¿Qué puedo gastar hoy?
          </button>
        </div>

        {/* Los 2 Bolsillos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-500/15 border border-amber-400/40 rounded-2xl p-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Intocable (Mercadería)
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-200 mt-1">
              {formatMoney(cashSummary.untouchableReplacementFund)}
            </div>
            <p className="text-[10px] text-amber-100/80 mt-0.5">
              Reservado para reponer insumos
            </p>
          </div>

          <div className="bg-emerald-500/20 border border-emerald-400/50 rounded-2xl p-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Tu Ganancia Libre
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
              {formatMoney(Math.max(0, cashSummary.availableFreeProfit))}
            </div>
            <p className="text-[10px] text-emerald-100/80 mt-0.5">
              Limpia de costos y gastos ({formatMoney(cashSummary.operationalExpensesTotal)})
            </p>
          </div>
        </div>

        {/* 4 Botones Rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
          <button
            onClick={openNewOrderModal}
            className="flex items-center justify-center gap-1.5 bg-white text-stone-950 hover:bg-pink-50 font-extrabold text-xs py-3 px-3 rounded-2xl shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5] text-pink-700" />
            Agendar Pedido
          </button>
          <button
            onClick={() => openMovementModal('venta_mostrador')}
            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 px-3 rounded-2xl border border-white/15 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            Venta Rápida
          </button>
          <button
            onClick={() => openMovementModal('gasto_operativo')}
            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 px-3 rounded-2xl border border-white/15 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-orange-300" />
            Gasto (Film/Limp.)
          </button>
          <button
            onClick={() => openMovementModal('compra_insumos')}
            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 px-3 rounded-2xl border border-white/15 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
            Compra Insumos
          </button>
        </div>
      </div>

      {/* 2. ALERTA ROJA DE CLIENTES QUE RETIRARON Y DEBEN */}
      {deliveredDebtOrders.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-3xl p-4 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
            <h2 className="text-xs font-black uppercase tracking-wider text-red-900">
              Alerta de Saldos: Retiraron y deben dinero ({deliveredDebtOrders.length})
            </h2>
          </div>

          <div className="space-y-2">
            {deliveredDebtOrders.map((ord) => {
              const fin = calculateOrderFinancials(ord);
              const waUrl = buildWhatsAppLink(ord, fin.balanceDue);
              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl p-3.5 border border-red-200 flex items-center justify-between gap-2 flex-wrap"
                >
                  <div>
                    <p className="text-sm font-extrabold text-stone-900">{ord.clientName}</p>
                    <p className="text-xs text-stone-600">
                      {ord.items.map((i) => `${i.quantity}x ${i.recipeName}`).join(', ')}
                    </p>
                    <p className="text-xs font-black text-red-600 mt-0.5">
                      Falta cobrar: {formatMoney(fin.balanceDue)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold px-3 py-2 rounded-xl"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => openPaymentModal(ord)}
                      className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SWITCHER: AGENDA DE PEDIDOS VS MOVIMIENTOS */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-stone-200/75 rounded-2xl">
        <button
          onClick={() => setSubView('pedidos')}
          className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            subView === 'pedidos'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-pink-700" />
          Agenda de Pedidos ({orders.length})
        </button>
        <button
          onClick={() => setSubView('movimientos')}
          className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            subView === 'movimientos'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-700" />
          Movimientos de Caja ({unifiedFeed.length})
        </button>
      </div>

      {/* VISTA A: AGENDA DE PEDIDOS */}
      {subView === 'pedidos' && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setOrderFilter('por_entregar')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                orderFilter === 'por_entregar'
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              Por Entregar (
              {
                orders.filter(
                  (o) =>
                    o.status === 'pendiente' ||
                    o.status === 'en_preparacion' ||
                    o.status === 'listo'
                ).length
              }
              )
            </button>
            <button
              onClick={() => setOrderFilter('con_deuda')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                orderFilter === 'con_deuda'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-red-700 border border-red-200'
              }`}
            >
              Falta Pagar ({pendingBalanceOrders.length})
            </button>
            <button
              onClick={() => setOrderFilter('entregados')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                orderFilter === 'entregados'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              Entregados ({orders.filter((o) => o.status === 'entregado').length})
            </button>
            <button
              onClick={() => setOrderFilter('todos')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                orderFilter === 'todos'
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              Todos ({orders.length})
            </button>
          </div>

          {filteredOrders.map((order) => {
            const fin = calculateOrderFinancials(order);
            const st = STATUS_CONFIG[order.status];
            const waUrl = buildWhatsAppLink(order, fin.balanceDue);
            const isToday = order.deliveryDate === todayStr;
            const paidPercent =
              fin.totalPrice > 0
                ? Math.min(100, Math.round((fin.paidAmount / fin.totalPrice) * 100))
                : 0;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl p-4 border shadow-xs space-y-3 ${
                  fin.isDeliveredWithDebt
                    ? 'border-red-400 ring-1 ring-red-300'
                    : 'border-stone-200/90'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${st.badgeClass}`}
                      >
                        {st.label}
                      </span>
                      {isToday && order.status !== 'entregado' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          <Flame className="w-3 h-3" /> Para Hoy
                        </span>
                      )}
                      {fin.paymentStatus === 'pagado' && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ✓ Pagado Total
                        </span>
                      )}
                      {fin.isDeliveredWithDebt && (
                        <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                          ⚠️ Debe {formatMoney(fin.balanceDue)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-stone-900 mt-1.5 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-pink-700" />
                      {order.clientName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                        <Calendar className="w-3.5 h-3.5 text-pink-600" />
                        {order.deliveryDate}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                        <Clock className="w-3.5 h-3.5 text-pink-600" />
                        {order.deliveryTime} hs
                      </span>
                      {order.clientPhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {order.clientPhone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-stone-400 block">
                      Total Pedido
                    </span>
                    <span className="text-lg font-black text-stone-900">
                      {formatMoney(fin.totalPrice)}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold block">
                      Ganas: +{formatMoney(fin.expectedProfit)}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-[#FDFBF7] rounded-2xl p-3 space-y-1 border border-stone-200/80">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs text-stone-800"
                    >
                      <span className="font-semibold">
                        <strong>{item.quantity}x</strong> {item.recipeName}{' '}
                        <span className="text-stone-500">({item.variantName})</span>
                      </span>
                      <span className="font-bold">
                        {formatMoney(item.quantity * item.unitPriceSnapshot)}
                      </span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-[11px] text-stone-600 italic pt-1 border-t border-stone-200/70">
                      Nota: "{order.notes}"
                    </p>
                  )}
                </div>

                {/* Visual Payment Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-stone-600">
                      Pagado: <strong className="text-emerald-700">{formatMoney(fin.paidAmount)}</strong> ({paidPercent}%)
                    </span>
                    {fin.balanceDue > 0 ? (
                      <span className="font-bold text-amber-900">
                        Resta cobrar: {formatMoney(fin.balanceDue)}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-700">Saldo $0</span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${paidPercent}%` }}
                      className={`h-full transition-all ${
                        paidPercent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {st.nextStatus && (
                      <button
                        onClick={() => updateOrderStatus(order.id, st.nextStatus!)}
                        className="inline-flex items-center gap-1 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {st.nextLabel}
                      </button>
                    )}

                    <button
                      onClick={() => openPaymentModal(order)}
                      className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer ${
                        fin.balanceDue > 0
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {fin.balanceDue > 0
                        ? `Cobrar (${formatMoney(fin.balanceDue)})`
                        : 'Ver Pagos'}
                    </button>

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-2 rounded-xl"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditOrderModal(order)}
                      className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl cursor-pointer"
                      title="Editar pedido"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el pedido de "${order.clientName}"?`)) {
                          deleteOrder(order.id);
                        }
                      }}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                      title="Eliminar pedido"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-stone-300">
              <p className="text-stone-600 font-medium text-sm">
                No hay pedidos en este filtro.
              </p>
              <button
                onClick={openNewOrderModal}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-pink-800 bg-pink-50 px-4 py-2.5 rounded-2xl cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Agendar Nuevo Pedido
              </button>
            </div>
          )}
        </div>
      )}

      {/* VISTA B: HISTORIAL DE CAJA, GASTOS OPERATIVOS Y RETIROS */}
      {subView === 'movimientos' && (
        <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-stone-900">
              Ingresos, Gastos Operativos y Retiros
            </h3>
            <div className="flex gap-1.5">
              <button
                onClick={() => openMovementModal('retiro_personal')}
                className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" /> Retirar Ganancia
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Borrar los pedidos y movimientos de ejemplo para empezar tu caja en $0? (Tus recetas e insumos se conservan).'
                    )
                  ) {
                    resetDemoTransactions();
                  }
                }}
                className="text-xs font-semibold text-stone-500 hover:text-red-600 px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Limpiar Demo
              </button>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {unifiedFeed.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      item.isIncome
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {item.isIncome ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {item.date.slice(0, 10)}
                      </span>
                    </div>
                    <p className="font-bold text-stone-900 text-sm mt-0.5 truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-stone-500">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-sm font-black ${
                      item.isIncome ? 'text-emerald-700' : 'text-stone-900'
                    }`}
                  >
                    {item.isIncome ? '+' : '-'}
                    {formatMoney(item.amount)}
                  </span>
                  {item.canDelete && (
                    <button
                      onClick={() => {
                        if (window.confirm('¿Eliminar este movimiento?')) {
                          deleteCashMovement(item.id);
                        }
                      }}
                      className="p-1 text-stone-400 hover:text-red-600 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ASISTENTE "¿QUÉ PUEDO GASTAR Y QUÉ NO?" */}
      {isAssistantOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Asistente Financiero
                </span>
                <h2 className="text-lg font-black text-stone-900 mt-1">
                  ¿Qué puedo gastar y qué no?
                </h2>
              </div>
              <button
                onClick={() => setIsAssistantOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3">
                <span className="text-[10px] font-bold uppercase text-amber-900 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> NO TOCAR (Mercadería)
                </span>
                <span className="text-lg font-black text-amber-950 block mt-0.5">
                  {formatMoney(cashSummary.untouchableReplacementFund)}
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3">
                <span className="text-[10px] font-bold uppercase text-emerald-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> SÍ PUEDES GASTAR
                </span>
                <span className="text-lg font-black text-emerald-800 block mt-0.5">
                  {formatMoney(Math.max(0, cashSummary.availableFreeProfit))}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Escribe cuánto quieres retirar o gastar hoy ({settings.currencySymbol}):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                autoFocus
                value={queryAmount}
                onChange={(e) => setQueryAmount(e.target.value)}
                placeholder="Ej: 5000"
                className="w-full px-4 py-3 border-2 border-stone-300 rounded-2xl text-lg font-black text-stone-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div
              className={`rounded-2xl p-4 border-2 space-y-2 ${
                assistantVerdict.status === 'safe'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : assistantVerdict.status === 'warning'
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-red-50 border-red-500 text-red-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {assistantVerdict.status === 'safe' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                {assistantVerdict.status !== 'safe' && (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <h3 className="font-black text-sm">{assistantVerdict.title}</h3>
              </div>
              <p className="text-xs leading-relaxed">{assistantVerdict.message}</p>

              {assistantVerdict.status === 'danger' && (
                <div className="pt-2 border-t border-red-300 text-xs font-bold space-y-1">
                  <div className="flex justify-between text-red-800">
                    <span>Estarías tocando de la mercadería:</span>
                    <span>-{formatMoney(assistantVerdict.invadesReplacementFundBy)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-900">
                    <span>Máximo seguro que puedes gastar hoy:</span>
                    <span>{formatMoney(assistantVerdict.maxSafeAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAssistantOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-stone-300 text-stone-700 font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
              {Number(queryAmount) > 0 && assistantVerdict.status !== 'danger' && (
                <button
                  type="button"
                  onClick={() => {
                    addCashMovement({
                      type: 'retiro_personal',
                      amount: Number(queryAmount),
                      description: 'Retiro personal aprobado por el Asistente',
                      date: new Date().toISOString(),
                      method: 'efectivo',
                    });
                    setQueryAmount('');
                    setIsAssistantOpen(false);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Anotar Retiro de {formatMoney(Number(queryAmount))}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGENDAR O EDITAR PEDIDO */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-lg font-extrabold text-stone-900">
                {editingOrderId ? 'Editar Pedido' : 'Agendar Nuevo Pedido'}
              </h2>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej: 11 4567 8901"
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Fecha Entrega *
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Hora Entrega *
                  </label>
                  <input
                    type="time"
                    required
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Productos con opción de cambiar el precio de venta ahí mismo */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <label className="block text-xs font-bold text-stone-700">
                  Productos Encargados *
                </label>
                {draftItems.map((item, idx) => {
                  const selectedRec =
                    recipes.find((r) => r.id === item.recipeId) || recipes[0];
                  const selectedVar =
                    selectedRec?.variants.find((v) => v.id === item.variantId) ||
                    selectedRec?.variants[0];
                  const b =
                    selectedRec && selectedVar
                      ? calculateVariantCostBreakdown(selectedRec, selectedVar, supplies)
                      : null;

                  return (
                    <div
                      key={idx}
                      className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-2"
                    >
                      <div className="flex gap-2">
                        <select
                          value={item.recipeId}
                          onChange={(e) => {
                            const newRec = recipes.find((r) => r.id === e.target.value);
                            const next = [...draftItems];
                            next[idx] = {
                              ...next[idx],
                              recipeId: e.target.value,
                              variantId: newRec?.variants[0]?.id || '',
                              customUnitPrice: '',
                            };
                            setDraftItems(next);
                          }}
                          className="flex-1 bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                        >
                          {recipes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.emoji} {r.name}
                            </option>
                          ))}
                        </select>

                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftItems(draftItems.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-stone-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-stone-500 block">
                            Tamaño
                          </span>
                          <select
                            value={item.variantId}
                            onChange={(e) => {
                              const next = [...draftItems];
                              next[idx] = {
                                ...next[idx],
                                variantId: e.target.value,
                                customUnitPrice: '',
                              };
                              setDraftItems(next);
                            }}
                            className="w-full bg-white border border-stone-300 rounded-xl px-2 py-1.5 text-xs font-semibold"
                          >
                            {selectedRec?.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-[10px] font-bold text-stone-500 block">
                              Cantidad
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const next = [...draftItems];
                                next[idx] = {
                                  ...next[idx],
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                };
                                setDraftItems(next);
                              }}
                              className="w-full bg-white border border-stone-300 rounded-xl px-2 py-1.5 text-xs font-bold text-center"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-pink-700 block">
                              Precio c/u ({settings.currencySymbol})
                            </span>
                            <input
                              type="number"
                              step="any"
                              placeholder={b ? String(b.effectiveSalePrice) : '0'}
                              value={item.customUnitPrice}
                              onChange={(e) => {
                                const next = [...draftItems];
                                next[idx] = {
                                  ...next[idx],
                                  customUnitPrice: e.target.value,
                                };
                                setDraftItems(next);
                              }}
                              className="w-full bg-white border border-pink-300 rounded-xl px-2 py-1.5 text-xs font-extrabold text-pink-900"
                            />
                          </div>
                        </div>
                      </div>

                      {b && (
                        <div className="text-[11px] text-stone-500 flex justify-between">
                          <span>
                            Sugerido: <strong>{formatMoney(b.effectiveSalePrice)}</strong> (Costo:{' '}
                            {formatMoney(b.totalProductionCost)})
                          </span>
                          <span className="text-emerald-700 font-bold">
                            Ganas: +
                            {formatMoney(
                              ((item.customUnitPrice
                                ? Number(item.customUnitPrice)
                                : b.effectiveSalePrice) -
                                b.totalProductionCost) *
                                item.quantity
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    const firstRec = recipes[0];
                    if (firstRec && firstRec.variants[0]) {
                      setDraftItems([
                        ...draftItems,
                        {
                          recipeId: firstRec.id,
                          variantId: firstRec.variants[0].id,
                          quantity: 1,
                          customUnitPrice: '',
                        },
                      ]);
                    }
                  }}
                  className="w-full py-2 border border-dashed border-pink-300 rounded-2xl text-xs font-bold text-pink-800 bg-pink-50/50 cursor-pointer"
                >
                  + Agregar otro producto al pedido
                </button>
              </div>

              {/* Resumen del Pedido y Seña */}
              <div className="bg-stone-900 text-white rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-stone-300 block">
                      Total del Pedido:
                    </span>
                    <span className="text-xl font-black text-white">
                      {formatMoney(draftOrderTotals.totalPrice)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-300 block">
                      Tu Ganancia Limpia:
                    </span>
                    <span className="text-base font-black text-emerald-400">
                      +{formatMoney(draftOrderTotals.expectedProfit)}
                    </span>
                  </div>
                </div>

                {!editingOrderId && (
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/15">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-200 mb-1">
                        ¿Dejó Seña / Pago hoy?
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={initialDeposit}
                        onChange={(e) => setInitialDeposit(e.target.value)}
                        placeholder="0 (Sin seña)"
                        className="w-full px-3 py-1.5 bg-white text-stone-900 rounded-xl text-sm font-bold"
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setInitialDeposit(
                              String(Math.round(draftOrderTotals.totalPrice / 2))
                            )
                          }
                          className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded cursor-pointer"
                        >
                          50% Seña
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setInitialDeposit(String(draftOrderTotals.totalPrice))
                          }
                          className="text-[10px] font-bold bg-emerald-500 text-stone-950 px-2 py-0.5 rounded cursor-pointer"
                        >
                          100% Pagado
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-200 mb-1">
                        Medio de Pago
                      </label>
                      <select
                        value={depositMethod}
                        onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                        className="w-full px-2.5 py-1.5 bg-white text-stone-900 rounded-xl text-xs font-bold"
                      >
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="mercado_pago">Billetera / QR</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nota opcional (ej: Dedicatoria, sin canela...)"
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-pink-700 hover:bg-pink-800 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  {editingOrderId ? 'Guardar Cambios' : 'Guardar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR COBRO DE SALDO + VER / CORREGIR PAGOS ANTERIORES */}
      {livePayingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-extrabold text-stone-900">
                Pagos del Pedido — {livePayingOrder.clientName}
              </h2>
              <button
                onClick={() => setPayingOrder(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Historial de pagos de este pedido (con opción de borrar si hubo error) */}
            {livePayingOrder.payments.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                  Pagos / Señas ya registrados:
                </span>
                {livePayingOrder.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-emerald-800">
                        {formatMoney(p.amount)}
                      </span>{' '}
                      <span className="text-stone-500">
                        ({p.method}) — {p.note || 'Pago'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Anular este pago de ${formatMoney(p.amount)}?`
                          )
                        ) {
                          deleteOrderPayment(livePayingOrder.id, p.id);
                        }
                      }}
                      className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                      title="Borrar pago mal cargado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleConfirmPayment} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Sumar Nuevo Cobro ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  autoFocus
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Monto a cobrar"
                  className="w-full px-3.5 py-2.5 border border-emerald-400 rounded-xl text-base font-extrabold text-emerald-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Medio de Pago
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="mercado_pago">Billetera / QR</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nota
                  </label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingOrder(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  Registrar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR GASTO / VENTA MOSTRADOR / COMPRA INSUMOS */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-extrabold text-stone-900">
                {modalType === 'gasto_operativo' && 'Anotar Gasto Operativo Extra'}
                {modalType === 'compra_insumos' &&
                  'Anotar Compra de Mercadería (Reposición)'}
                {modalType === 'retiro_personal' && 'Anotar Retiro Personal de Ganancia'}
                {modalType === 'venta_mostrador' && 'Anotar Venta Rápida'}
              </h2>
              <button
                onClick={() => setModalType(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="space-y-3.5 mt-4">
              {modalType === 'venta_mostrador' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-2">
                  <label className="block text-xs font-bold text-emerald-900">
                    ¿Qué producto vendiste?
                  </label>
                  <select
                    value={counterRecipeId}
                    onChange={(e) => {
                      const rec = recipes.find((r) => r.id === e.target.value);
                      const vId = rec?.variants[0]?.id || '';
                      setCounterRecipeId(e.target.value);
                      setCounterVariantId(vId);
                      handleCounterProductChange(e.target.value, vId, counterQty);
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold"
                  >
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.emoji} {r.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      value={counterVariantId}
                      onChange={(e) => {
                        setCounterVariantId(e.target.value);
                        handleCounterProductChange(
                          counterRecipeId,
                          e.target.value,
                          counterQty
                        );
                      }}
                      className="flex-1 px-2.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold"
                    >
                      {recipes
                        .find((r) => r.id === counterRecipeId)
                        ?.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={counterQty}
                      onChange={(e) => {
                        setCounterQty(e.target.value);
                        handleCounterProductChange(
                          counterRecipeId,
                          counterVariantId,
                          e.target.value
                        );
                      }}
                      className="w-20 px-2 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                </div>
              )}

              {modalType === 'gasto_operativo' && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Tipo de Gasto
                  </label>
                  <select
                    value={movCategory}
                    onChange={(e) =>
                      setMovCategory(e.target.value as OperationalExpenseCategory)
                    }
                    className="w-full px-3 py-2.5 bg-orange-50 border border-orange-300 rounded-xl text-xs font-bold text-orange-950"
                  >
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Monto ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  placeholder="Ej: 3500"
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-base font-extrabold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Descripción *
                </label>
                <input
                  type="text"
                  required
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  placeholder="Ej: Papel film, detergente, compra de leches..."
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-stone-300 text-stone-700 font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
