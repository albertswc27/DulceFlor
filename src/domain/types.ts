/** Tipos del dominio de pedidos de Dulce Flor. */

export type CustomerType = "individual" | "business";

export type FulfillmentType = "pickup" | "delivery";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_preparation"
  | "ready"
  | "completed"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
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

/** Configuración elegida por el cliente para un artículo del pedido. */
export interface ItemCustomization {
  size: SelectedOption;
  /** Sabor (bizcocho en pasteles, sabor en cheesecakes). */
  flavor?: SelectedOption;
  /** Relleno (solo pasteles). */
  filling?: SelectedOption;
  toppings: SelectedOption[];
  extras: SelectedExtra[];
  /** Texto de la dedicatoria si se ha elegido el extra correspondiente. */
  dedicationText?: string;
  /** Personalización especial en texto libre. */
  notes?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  customization: ItemCustomization;
  quantity: number;
  /** Precio unitario = base + toppings + extras (en céntimos). */
  unitPriceCents: number;
  totalCents: number;
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

  status: OrderStatus;
  /** Origen del pedido: web pública o kiosk de tienda. */
  source: "web" | "kiosk";
}
