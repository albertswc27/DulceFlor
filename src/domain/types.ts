/** Tipos del dominio de pedidos de Dulce Flor. */

export type CustomerType = "individual" | "business";

export type FulfillmentType = "pickup" | "delivery";

export type OrderStatus =
  | "pending"
  | "pending_quote"
  | "confirmed"
  | "in_preparation"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  pending_quote: "Pendiente de presupuesto",
  confirmed: "Confirmado",
  in_preparation: "En preparación",
  ready: "Listo",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Particular",
  business: "Empresa",
};

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  pickup: "Recogida en tienda",
  delivery: "Entrega a domicilio",
};

export interface SelectedOption {
  id: string;
  label: string;
}

export interface SelectedExtra extends SelectedOption {
  priceCents: number;
}

/** Acabado de las velas de número: cambia el precio por unidad. */
export type CandleStyle = "vela" | "bengala";

/** Configuración elegida por el cliente para un artículo del pedido. */
export interface ItemCustomization {
  size: SelectedOption;
  /** Sabor (bizcocho en pasteles, sabor en cheesecakes). */
  flavor?: SelectedOption;
  /** Relleno (solo pasteles). */
  filling?: SelectedOption;
  toppings: SelectedOption[];
  /**
   * Topping solicitado por el cliente que no está en el catálogo.
   * Dulce Flor confirmará disponibilidad; NO se cobra automáticamente.
   */
  customToppingRequest?: string;
  extras: SelectedExtra[];
  /** Texto de la dedicatoria si se ha elegido el extra correspondiente. */
  dedicationText?: string;
  /** Descripción del diseño (obligatoria en tartas y regalos a medida). */
  designDescription?: string;
  /** Ocasión del regalo (cajas de desayuno y copas personalizadas). */
  occasion?: string;
  /**
   * Velas para la tarta. Solo se guarda la cantidad: el precio unitario vive
   * en CANDLE_UNIT_PRICE_CENTS (única fuente de verdad).
   */
  candleQuantity?: number;
  /**
   * Velas de números en el orden en que se leen sobre la tarta ("25", "100").
   * Cuando existe, manda sobre candleQuantity: cada dígito es una vela. Los
   * pedidos antiguos solo tienen la cantidad y siguen calculándose igual.
   */
  candleDigits?: string;
  /**
   * Acabado de esos números: vela normal o bengala. Cambia el precio por
   * unidad, no la cifra. Sin valor se asume vela (pedidos anteriores).
   */
  candleStyle?: CandleStyle;
  /** Bengalas sueltas, sin número. Se cuentan y cobran aparte de la cifra. */
  sparklerQuantity?: number;
  /** Personalización especial en texto libre. */
  notes?: string;
  /** Imagen de referencia adjuntada por el cliente (id en el almacén de imágenes). */
  referenceImageId?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  customization: ItemCustomization;
  quantity: number;
  /** Precio unitario = base + toppings + extras (en céntimos). */
  unitPriceCents: number;
  /**
   * Importe de las velas de este artículo. Va aparte del precio unitario
   * porque las velas también tienen precio conocido en los productos que se
   * presupuestan a mano (fondant y personalizadas).
   */
  candlesCents?: number;
  /** unitPrice × cantidad + velas. En productos «quote» solo las velas. */
  totalCents: number;
  /**
   * true en productos sin precio automático (fondant): el importe se
   * presupuesta manualmente. unitPriceCents/totalCents valen 0 pero la UI
   * NUNCA debe mostrarlos como precio: debe mostrar "A consultar".
   */
  requiresQuote?: boolean;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  /** Solo pedidos de empresa. */
  companyName?: string;
}

export interface DeliveryAddress {
  street: string;
  municipality: string;
  postalCode: string;
  details?: string;
}

export interface OrderPricing {
  subtotalCents: number;
  /** null = zona fuera de cobertura automática ("consultar"). */
  deliveryFeeCents: number | null;
  totalCents: number;
  depositRequired: boolean;
  depositCents: number;
  remainingCents: number;
  /**
   * true cuando el pedido incluye artículos a presupuestar (tarta
   * personalizada o de fondant) y aún no hay presupuesto: el total es parcial
   * y NO se calcula señal.
   */
  pendingQuote?: boolean;
  /** Presupuesto introducido por administración para los artículos a medida. */
  quotedPriceCents?: number;
  /** Importe total de las velas del pedido (0 si no hay). */
  candlesCents?: number;
  /**
   * true cuando hay peticiones que Dulce Flor debe revisar y que pueden
   * modificar el importe: topping fuera de catálogo, nota con un cambio
   * especial o imagen de referencia sobre una tarta clásica. El total
   * mostrado es «actual», nunca definitivo.
   */
  hasPendingExtras?: boolean;
}

export interface Order {
  /** UUID interno. */
  id: string;
  /** Identificador legible, p. ej. DF-2026-0001. */
  publicId: string;
  /** Idempotencia: evita duplicados si el usuario reintenta el envío. */
  clientRequestId: string;
  createdAt: string; // ISO

  customerType: CustomerType;
  customer: CustomerInfo;

  items: OrderItem[];

  fulfillmentType: FulfillmentType;
  address?: DeliveryAddress;
  deliveryZoneId?: string;
  deliveryZoneLabel?: string;

  /** "yyyy-MM-dd" */
  requestedDate: string;
  /** "HH:MM" */
  requestedTime: string;

  pricing: OrderPricing;

  /**
   * Solo pedidos de empresa: entrega en fuente de cristal reutilizable
   * (la fuente anterior puede recogerse en la siguiente entrega).
   */
  reusableTray?: boolean;

  status: OrderStatus;
  /** Origen del pedido: web pública o kiosk de tienda. */
  source: "web" | "kiosk";
}
