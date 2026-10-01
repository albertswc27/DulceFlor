/** Tipos del dominio de pedidos de Dulce Flor. */

export type CustomerType = "individual" | "business";

export type FulfillmentType = "pickup" | "delivery";

/**
 * Estados de un pedido. Dulce Flor pidió simplificarlos (20/09/2026) y los
 * redujo otra vez el 01/10/2026: en el panel solo quiere poder marcar DOS
 * cosas, «Tramitado» y «Finalizado». Los estados intermedios «en preparación»
 * y «listo» se retiraron porque nadie los mantenía al día.
 *
 * Los demás estados siguen existiendo, pero no se eligen a mano: «Pendiente»
 * y «Pendiente de presupuesto» son con los que NACE un pedido según cómo se
 * haya hecho, y «Cancelado» es una excepción. Se siguen mostrando cuando un
 * pedido está en ellos; lo que se recortó es la botonera.
 * Ver ORDER_STATUS_ACTIONS.
 *
 * Los identificadores se conservan (confirmed/completed) para no invalidar
 * los pedidos ya guardados en el navegador y en Supabase: solo cambian las
 * etiquetas. Los estados retirados se traducen al leer, ver normalizeOrderStatus.
 */
export type OrderStatus =
  | "pending"
  | "pending_quote"
  | "confirmed"
  | "completed"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  pending_quote: "Pendiente de presupuesto",
  confirmed: "Tramitado",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

/** Estados que existieron antes de la simplificación y a qué equivalen hoy. */
const LEGACY_ORDER_STATUS: Record<string, OrderStatus> = {
  in_preparation: "confirmed",
  ready: "confirmed",
};

/**
 * Traduce el estado guardado a uno de los vigentes. Un pedido escrito por una
 * versión anterior de la web (o por otra pestaña que aún no se ha recargado)
 * no debe aparecer sin etiqueta ni tumbar el panel.
 */
export function normalizeOrderStatus(status: string): OrderStatus {
  if (status in ORDER_STATUS_LABELS) return status as OrderStatus;
  return LEGACY_ORDER_STATUS[status] ?? "pending";
}

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
   * La clienta ha marcado la caja de transporte, que en las tartas es
   * obligatoria para poder continuar (Dulce Flor, 29/09/2026).
   *
   * Se guarda aunque su valor útil sea siempre `true`: deja constancia de que
   * se le enseñó y lo aceptó, y permite distinguir un pedido nuevo de uno
   * antiguo, de antes de que la caja se pidiera marcar.
   */
  boxAccepted?: boolean;
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
  /**
   * De dónde salió esa imagen. Importa por dos motivos: al obrador no le da
   * igual estar mirando la foto de una tarta que existe o una imagen inventada
   * por una máquina, y la normativa europea de IA obliga a que una imagen
   * generada artificialmente se identifique como tal allí donde se enseñe.
   * Ausente en los pedidos anteriores al generador: se asumen subidas.
   */
  referenceImageSource?: "cliente" | "ia";
  /**
   * Lo que el cliente escribió para generar la imagen. Se guarda porque es la
   * descripción de lo que de verdad quiere —más útil para el obrador que la
   * propia imagen— y porque ante una reclamación documenta qué se pidió.
   */
  aiPrompt?: string;
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
  /**
   * Suplemento por pedido urgente (menos de 3 días de margen). Se cobra una
   * vez por pedido y se muestra como línea propia: el cliente tiene que ver
   * por qué paga más. Ausente cuando el pedido llega con margen normal.
   */
  urgencySurchargeCents?: number;
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

  /**
   * true si al registrarse quedaban menos de 3 días para la fecha pedida
   * (antelación estándar): el pedido se acepta pero hay que confirmarlo por
   * WhatsApp cuanto antes. Se fija al crear el pedido y no se recalcula:
   * refleja la urgencia que había en ese momento. Ausente en pedidos antiguos
   * y en los que llegaron con margen.
   */
  urgent?: boolean;

  pricing: OrderPricing;

  /**
   * Señal (paga y señal) YA cobrada al registrar el pedido, en céntimos.
   * Es dinero realmente recibido, normalmente en el kiosk de tienda, y es un
   * importe FLEXIBLE que fija el equipo (no el 30 % automático de `pricing`).
   * Sirve para conocer lo que resta por cobrar al recoger:
   * ver `computeBalanceDueCents`. Ausente en los pedidos que no dejaron señal.
   */
  depositPaidCents?: number;

  /**
   * Solo pedidos de empresa: entrega en fuente de cristal reutilizable
   * (la fuente anterior puede recogerse en la siguiente entrega).
   */
  reusableTray?: boolean;

  status: OrderStatus;
  /** Origen del pedido: web pública o kiosk de tienda. */
  source: "web" | "kiosk";

  /**
   * Momento (ISO) en que se avisó al cliente de que su pedido está tramitado.
   * Con SMS se escribe SOLO cuando la pasarela ha confirmado el envío; con
   * WhatsApp, cuando se abrió la conversación con el mensaje preparado.
   * Ausente mientras no se haya avisado.
   */
  customerNotifiedAt?: string;

  /** Por dónde se le avisó. Ausente en pedidos avisados antes de existir el SMS. */
  customerNotifiedBy?: "sms" | "whatsapp";

  /**
   * El cliente ha pedido que no se le avise por SMS. Lo marca el equipo desde
   * el panel cuando alguien lo dice por teléfono o en el mostrador: el aviso
   * automático lo respeta y no envía nada.
   */
  smsOptOut?: boolean;
}
