export type BaseUnit = 'g' | 'ml' | 'u';

export type PurchaseUnit = 'g' | 'kg' | 'ml' | 'l' | 'u' | 'docena' | 'pack';

export type SupplyCategory = 'ingrediente' | 'envase';

export interface Supply {
  id: string;
  name: string;
  category: SupplyCategory;
  /** ID de la torta a la que pertenece este insumo ('all' o undefined = uso general, o recipeId específico) */
  assignedRecipeId?: string;
  /** Precio total pagado por el paquete/envase comprado */
  purchasePrice: number;
  /** Cantidad que trae el paquete en la unidad de compra (ej: 1 kg, 395 g, 12 u) */
  purchaseAmount: number;
  purchaseUnit: PurchaseUnit;
  /** Unidad base normalizada para las recetas ('g', 'ml' o u') */
  baseUnit: BaseUnit;
  /** Cantidad total equivalente en unidad base (ej: 1 kg -> 1000 g) */
  baseTotalQuantity: number;
  /** Stock físico actual en unidad base (opcional) */
  stockQuantity: number;
  /** Alerta de stock mínimo en unidad base */
  minStockAlert: number;
  lastUpdated: string;
}

export type SizeFormat = 'chica' | 'mediana' | 'grande' | 'porcion' | 'individual';

export interface RecipeIngredientLine {
  supplyId: string;
  /** Cantidad en la unidad base del insumo (g, ml o u) */
  quantity: number;
  notes?: string;
}

export interface RecipePackagingLine {
  supplyId: string;
  /** Cantidad de envases/cajas/bandejas usadas en este tamaño */
  quantity: number;
}

export interface RecipeSpecialty {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  /** Si es la versión normal/clásica base (sin recargo extra) */
  isDefault?: boolean;
  /** Costo extra base de ingredientes especiales (se escala según el tamaño o se define por variante) */
  extraBaseCost: number;
  /** Precios de venta manuales guardados por tamaño (variantId -> precio final) */
  manualPricesByVariant?: Record<string, number>;
  /** Costo extra personalizado por tamaño (variantId -> costo extra) */
  extraCostByVariant?: Record<string, number>;
}

export interface RecipeVariant {
  id: string;
  name: string;
  format: SizeFormat;
  servingsLabel: string;
  /**
   * Factor multiplicador sobre el costo base de la torta.
   * Ej: Mediana = 1.0, Chica = 0.6, Grande = 1.6, Porción = 0.125, Individual = 0.15
   */
  scaleFactor: number;
  /**
   * Costo directo de elaboración/ingredientes para este tamaño si el usuario lo edita manualmente
   * sin usar la sección de recetas.
   */
  directIngredientsCost?: number;
  /**
   * Si el usuario desea definir cantidades personalizadas exactas para este tamaño
   * en lugar de usar scaleFactor sobre la receta base.
   */
  customIngredients?: RecipeIngredientLine[];
  /** Envases/packaging específicos para este formato */
  packagingItems: RecipePackagingLine[];
  /** Porcentaje de servicios (gas, luz, agua, horneado) sobre el costo de ingredientes */
  utilityPercent: number;
  /** Porcentaje de ganancia (Markup sobre costo total) deseado por defecto */
  defaultMarkupPercent: number;
  /** Precio de venta final fijado manualmente (opcional) */
  manualSalePrice?: number;
  /** Stock de unidades listas para vender de este tamaño (por especialidad: specialtyId -> cantidad) */
  readyStockBySpecialty?: Record<string, number>;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
  baseYieldLabel: string;
  baseIngredients: RecipeIngredientLine[];
  variants: RecipeVariant[];
  /** Variantes de sabor / con algo especial para esta torta (Normal vs Especiales) */
  specialties?: RecipeSpecialty[];
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercado_pago' | 'otro';

export interface OrderPayment {
  id: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
}

export interface OrderItem {
  id: string;
  recipeId: string;
  recipeName: string;
  variantId: string;
  variantName: string;
  specialtyId?: string;
  specialtyName?: string;
  quantity: number;
  /** Costo total unitario congelado al momento de crear el pedido */
  unitCostSnapshot: number;
  /** Precio de venta unitario congelado al momento de crear el pedido */
  unitPriceSnapshot: number;
}

export type OrderStatus =
  | 'pendiente'
  | 'en_preparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export interface Order {
  id: string;
  clientName: string;
  clientPhone: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // HH:mm
  status: OrderStatus;
  items: OrderItem[];
  payments: OrderPayment[];
  notes?: string;
  createdAt: string;
  stockDeducted?: boolean;
}

export type CashMovementType =
  | 'venta_mostrador'
  | 'compra_insumos'
  | 'gasto_operativo'
  | 'retiro_personal'
  | 'aporte_capital';

export type OperationalExpenseCategory =
  | 'limpieza'
  | 'descartables_film'
  | 'delivery'
  | 'publicidad'
  | 'servicios'
  | 'otros';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  /**
   * En 'venta_mostrador', qué parte del monto cobrado corresponde al costo de reposición
   * de mercadería para separarlo automáticamente.
   */
  replacementCostPortion?: number;
  category?: OperationalExpenseCategory;
  description: string;
  date: string;
  method?: PaymentMethod;
  relatedOrderId?: string;
}

export interface AppSettings {
  businessName: string;
  currencySymbol: string;
  decimals: 0 | 2;
  defaultUtilityPercent: number;
  defaultMarkupPercent: number;
  pinCode: string | null;
  pinEnabled: boolean;
  autoDeductStock: boolean;
}

