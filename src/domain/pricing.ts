/**
 * Motor de cálculo del pedido — ÚNICA fuente de verdad para precios.
 * El configurador público, el kiosk y el panel admin deben usar estas
 * funciones; nunca duplicar cálculos en componentes.
 */
import {
  CANDLE_UNIT_PRICE_CENTS,
  DEPOSIT_PERCENTAGE,
  DEPOSIT_THRESHOLD_CENTS,
  MAX_CANDLES,
  MAX_CANDLE_DIGITS,
  MAX_SPARKLERS,
  NUMBER_SPARKLER_PRICE_CENTS,
  PLAIN_SPARKLER_PRICE_CENTS,
  TOPPING_PRICE_CENTS,
  URGENT_ORDER_SURCHARGE_CENTS,
} from "@/config/business";
import {
  getFillingSurchargeCents,
  getFlavorSurchargeCents,
  getPackagingCents,
  getProduct,
  getUnitBasePriceCents,
  resolveQuantityTier,
  TOPPINGS,
} from "./catalog";
import { formatEuros, percentOf } from "./money";
import type {
  CandleStyle,
  CustomerType,
  ItemCustomization,
  OrderItem,
  OrderPricing,
} from "./types";

/** Precio de un topping para un producto/tamaño (contempla la excepción de tres leches gigante). */
export function getToppingPriceCents(productId: string, sizeId: string): number {
  const product = getProduct(productId);
  const override = product?.toppingPriceOverridesBySizeId?.[sizeId];
  return override ?? TOPPING_PRICE_CENTS;
}

/** Solo cuentan los toppings que existen en el catálogo (ids desconocidos se ignoran). */
function countValidToppings(toppingIds: string[]): number {
  return toppingIds.filter((id) => TOPPINGS.some((t) => t.id === id)).length;
}

/** ¿El producto se presupuesta a mano (personalizada/fondant)? */
export function isQuoteProduct(productId: string): boolean {
  return getProduct(productId)?.pricingType === "quote";
}

/** Lo que el cliente puede poner sobre la tarta, con su precio ya resuelto. */
export interface CandleSelection {
  /** Cifra de números y su acabado. null si no ha pedido ninguna. */
  numbers: {
    digits: string;
    quantity: number;
    style: CandleStyle;
    unitCents: number;
    cents: number;
  } | null;
  /** Bengalas sueltas, sin número. null si no ha pedido ninguna. */
  sparklers: { quantity: number; unitCents: number; cents: number } | null;
  totalCents: number;
}

/**
 * Deja una cifra de velas en su forma canónica: solo dígitos, en orden y
 * dentro del tope. Cualquier otra cosa que llegue (texto pegado, datos
 * restaurados de storage) se descarta en lugar de propagarse.
 */
export function normalizeCandleDigits(digits: string | undefined): string {
  return (digits ?? "").replace(/\D/g, "").slice(0, MAX_CANDLE_DIGITS);
}

/**
 * Precio de una vela de número según su acabado: la bengala cuesta más que
 * la vela normal, y es lo único que cambia entre las dos.
 */
export function getNumberCandleUnitCents(style: CandleStyle | undefined): number {
  return style === "bengala" ? NUMBER_SPARKLER_PRICE_CENTS : CANDLE_UNIT_PRICE_CENTS;
}

/**
 * Cuántas velas de número lleva un artículo. La cifra manda cuando existe
 * (cada dígito es una vela); los pedidos guardados antes de las velas de
 * números solo tienen la cantidad y se siguen respetando.
 */
export function resolveCandleQuantity(
  customization: Pick<ItemCustomization, "candleDigits" | "candleQuantity">
): number {
  const digits = normalizeCandleDigits(customization.candleDigits);
  if (digits.length > 0) return digits.length;
  return Math.min(
    MAX_CANDLES,
    Math.max(0, Math.floor(customization.candleQuantity ?? 0))
  );
}

type CandleInput = Pick<
  ItemCustomization,
  "candleDigits" | "candleQuantity" | "candleStyle" | "sparklerQuantity"
>;

/**
 * Única fuente de verdad de las velas y bengalas de un artículo: qué lleva,
 * a qué precio unitario y cuánto suma. Todo lo demás (carrito, resumen,
 * WhatsApp, panel) deriva de aquí para no calcular importes por su cuenta.
 */
export function resolveCandleSelection(customization: CandleInput): CandleSelection {
  const numberQuantity = resolveCandleQuantity(customization);
  const style: CandleStyle = customization.candleStyle ?? "vela";
  const numberUnitCents = getNumberCandleUnitCents(style);

  const sparklerQuantity = Math.min(
    MAX_SPARKLERS,
    Math.max(0, Math.floor(customization.sparklerQuantity ?? 0))
  );

  const numbers =
    numberQuantity > 0
      ? {
          digits: normalizeCandleDigits(customization.candleDigits),
          quantity: numberQuantity,
          style,
          unitCents: numberUnitCents,
          cents: numberQuantity * numberUnitCents,
        }
      : null;

  const sparklers =
    sparklerQuantity > 0
      ? {
          quantity: sparklerQuantity,
          unitCents: PLAIN_SPARKLER_PRICE_CENTS,
          cents: sparklerQuantity * PLAIN_SPARKLER_PRICE_CENTS,
        }
      : null;

  return {
    numbers,
    sparklers,
    totalCents: (numbers?.cents ?? 0) + (sparklers?.cents ?? 0),
  };
}

/**
 * Importe de las velas y bengalas de un artículo. Se cobran por el artículo
 * (no se multiplican por la cantidad de tartas) y tienen precio conocido
 * incluso en los productos que se presupuestan a mano.
 */
export function computeCandlesCents(customization: CandleInput): number {
  return resolveCandleSelection(customization).totalCents;
}

/**
 * Cómo se nombran las velas y bengalas en carrito, WhatsApp y panel, para que
 * las tres superficies digan exactamente lo mismo. Devuelve una línea por
 * concepto, o un array vacío si el artículo no lleva nada.
 */
export function describeCandleLines(customization: CandleInput): string[] {
  const { numbers, sparklers } = resolveCandleSelection(customization);
  const lines: string[] = [];

  if (numbers) {
    const unit = numbers.quantity === 1 ? "ud" : "uds";
    const kind =
      numbers.style === "bengala" ? "Bengalas de número" : "Velas de número";
    // Los pedidos anteriores a las velas de números no guardan la cifra.
    const what = numbers.digits ? `número ${numbers.digits}` : `${numbers.quantity} ${unit}`;
    lines.push(
      `${kind}: ${what} — ${numbers.quantity} ${unit} × ${formatEuros(
        numbers.unitCents
      )} = ${formatEuros(numbers.cents)}`
    );
  }

  if (sparklers) {
    const unit = sparklers.quantity === 1 ? "bengala" : "bengalas";
    lines.push(
      `Bengalas sueltas: ${sparklers.quantity} ${unit} × ${formatEuros(
        sparklers.unitCents
      )} = ${formatEuros(sparklers.cents)}`
    );
  }

  return lines;
}

/**
 * ¿El artículo lleva peticiones que Dulce Flor debe revisar y que pueden
 * cambiar el importe? (topping fuera de catálogo, cambio especial escrito en
 * notas, o imagen de referencia sobre una tarta con precio automático).
 * Los artículos "quote" no cuentan: ya están pendientes de presupuesto.
 */
export function itemHasPendingExtras(item: OrderItem): boolean {
  if (item.requiresQuote) return false;
  const c = item.customization;
  return Boolean(
    c.customToppingRequest?.trim() ||
      c.notes?.trim() ||
      c.referenceImageId
  );
}

export interface ItemSelection {
  productId: string;
  customerType: CustomerType;
  sizeId: string;
  flavorId?: string;
  /**
   * Relleno elegido. Antes solo vivía en la personalización porque iba
   * incluido en el precio; desde que algunos rellenos llevan suplemento
   * forma parte del cálculo y tiene que viajar en la selección.
   */
  fillingId?: string;
  toppingIds: string[];
  extraIds: string[];
  /**
   * Solo productos con precio por volumen (aperitivos): número de unidades
   * pedidas, del que depende el precio unitario del tramo.
   */
  quantity?: number;
}

/**
 * Desglose del precio de una unidad. `baseCents` ya lleva dentro la caja de
 * transporte (ver getPackagingCents): es lo que el cliente ve como precio de
 * la tarta, y `packagingCents` se expone aparte solo para el panel.
 */
export interface UnitPriceBreakdown {
  baseCents: number;
  /** Parte de `baseCents` que corresponde a la caja. Informativo. */
  packagingCents: number;
  /** Suplemento del sabor de bizcocho elegido (0 si va incluido). */
  flavorCents: number;
  /** Suplemento del relleno elegido (0 si va incluido). */
  fillingCents: number;
  toppingsCents: number;
  extrasCents: number;
  unitTotalCents: number;
}

/**
 * Desglose reutilizable del precio unitario (base + sabor + relleno +
 * toppings + extras). Devuelve null si la combinación no existe en el
 * catálogo. Único sitio donde se suma un precio unitario: todo lo demás
 * (configurador, carrito, resumen, panel) deriva de aquí.
 */
export function computeUnitPriceBreakdown(
  selection: ItemSelection
): UnitPriceBreakdown | null {
  const product = getProduct(selection.productId);
  if (!product) return null;

  // Precio por volumen (aperitivos): el unitario sale del tramo de cantidad.
  if (product.quantityTiers) {
    const tier = resolveQuantityTier(product, selection.quantity ?? 0);
    if (!tier) return null;
    return {
      baseCents: tier.unitPriceCents,
      packagingCents: 0,
      flavorCents: 0,
      fillingCents: 0,
      toppingsCents: 0,
      extrasCents: 0,
      unitTotalCents: tier.unitPriceCents,
    };
  }

  const baseCents = getUnitBasePriceCents(
    selection.productId,
    selection.customerType,
    selection.sizeId,
    selection.flavorId
  );
  if (baseCents === null) return null;

  const flavorCents = getFlavorSurchargeCents(product, selection.flavorId);
  const fillingCents = getFillingSurchargeCents(product, selection.fillingId);
  const toppingsCents = product.allowsToppings
    ? countValidToppings(selection.toppingIds) *
      getToppingPriceCents(selection.productId, selection.sizeId)
    : 0;
  const extrasCents = selection.extraIds.reduce((sum, extraId) => {
    const extra = product.extras.find((e) => e.id === extraId);
    return sum + (extra?.priceCents ?? 0);
  }, 0);

  return {
    baseCents,
    packagingCents: getPackagingCents(product),
    flavorCents,
    fillingCents,
    toppingsCents,
    extrasCents,
    unitTotalCents:
      baseCents + flavorCents + fillingCents + toppingsCents + extrasCents,
  };
}

/**
 * Precio unitario de un artículo configurado.
 * Devuelve null si la combinación no existe en el catálogo.
 */
export function computeUnitPriceCents(selection: ItemSelection): number | null {
  return computeUnitPriceBreakdown(selection)?.unitTotalCents ?? null;
}

/**
 * Suplementos del sabor y el relleno de un artículo ya guardado, para poder
 * enseñarlos junto a su nombre («Vainilla», «Nutella +2,50 €») en el
 * carrito, el WhatsApp y el panel sin que cada superficie los recalcule.
 */
export function resolveItemSurcharges(
  productId: string,
  customization: Pick<ItemCustomization, "flavor" | "filling">
): { flavorCents: number; fillingCents: number } {
  const product = getProduct(productId);
  return {
    flavorCents: getFlavorSurchargeCents(product, customization.flavor?.id),
    fillingCents: getFillingSurchargeCents(product, customization.filling?.id),
  };
}

/**
 * Subtotal de los artículos: los productos «quote» no aportan precio de
 * tarta, pero sus velas sí, porque tienen precio conocido.
 */
export function computeItemsSubtotalCents(items: OrderItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum +
      (item.requiresQuote ? 0 : item.unitPriceCents * item.quantity) +
      (item.candlesCents ?? 0),
    0
  );
}

/** Importe total de las velas del pedido. */
export function computeOrderCandlesCents(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + (item.candlesCents ?? 0), 0);
}

/**
 * Cuánto del pedido corresponde a cajas de transporte. No se enseña al
 * cliente (va dentro del precio de cada tarta): es para que Dulce Flor sepa
 * cuántas cajas gasta un pedido cuando mire el detalle en el panel.
 */
export function computeOrderPackagingCents(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    if (item.requiresQuote) return sum;
    const product = getProduct(item.productId);
    if (!product) return sum;
    return sum + getPackagingCents(product) * item.quantity;
  }, 0);
}

/**
 * Suplemento por urgencia de un pedido. Se cobra una sola vez, no por
 * artículo: lo que cuesta es reorganizar el obrador, no cada tarta.
 */
export function computeUrgencySurchargeCents(urgent: boolean): number {
  return urgent ? URGENT_ORDER_SURCHARGE_CENTS : 0;
}

/**
 * Cálculo de la paga y señal.
 * Regla confirmada: se exige cuando el total SUPERA 40 € (no con 40,00 € exactos).
 */
export function computeDeposit(totalCents: number): {
  depositRequired: boolean;
  depositCents: number;
  remainingCents: number;
} {
  const depositRequired = totalCents > DEPOSIT_THRESHOLD_CENTS;
  const depositCents = depositRequired ? percentOf(totalCents, DEPOSIT_PERCENTAGE) : 0;
  return {
    depositRequired,
    depositCents,
    remainingCents: totalCents - depositCents,
  };
}

/**
 * Lo que queda por cobrar de un pedido cuando el cliente lo recoge, restando
 * la señal ya recibida (`depositPaidCents`, normalmente cobrada en el kiosk).
 *
 * Devuelve null cuando el total todavía no es definitivo (tarta a
 * presupuestar): en ese caso el resto no se puede calcular hasta cerrar el
 * presupuesto. Nunca devuelve un negativo: si se pagó de más, el resto es 0.
 */
export function computeBalanceDueCents(
  pricing: Pick<OrderPricing, "totalCents" | "pendingQuote">,
  depositPaidCents: number | undefined
): number | null {
  if (pricing.pendingQuote) return null;
  const paid = Math.max(0, Math.floor(depositPaidCents ?? 0));
  return Math.max(0, pricing.totalCents - paid);
}

/**
 * Dinero a DEVOLVER cuando la señal cobrada supera el total final. Normalmente
 * es 0: solo pasa si se cobró una señal sobre una tarta a presupuestar y el
 * presupuesto cerró por debajo. Devuelve 0 mientras el total no sea firme.
 */
export function computeOverpaidCents(
  pricing: Pick<OrderPricing, "totalCents" | "pendingQuote">,
  depositPaidCents: number | undefined
): number {
  if (pricing.pendingQuote) return 0;
  const paid = Math.max(0, Math.floor(depositPaidCents ?? 0));
  return Math.max(0, paid - pricing.totalCents);
}

/**
 * Cálculo completo del pedido.
 * - deliveryFeeCents null = fuera de zona automática (según distancia); el
 *   total se calcula sin transporte y la UI debe indicarlo claramente.
 * - Artículos "quote" (fondant): mientras no exista quotedPriceCents, el
 *   pedido queda pendingQuote (total parcial, SIN señal). Cuando
 *   administración introduce el presupuesto, se suma al total y la señal se
 *   calcula con normalidad.
 * - `urgent`: pedido para dentro de menos de 3 días. Suma el suplemento de
 *   urgencia al total, como línea propia y visible.
 */
export function computeOrderPricing(
  items: OrderItem[],
  deliveryFeeCents: number | null,
  quotedPriceCents?: number | null,
  urgent = false
): OrderPricing {
  const subtotalCents = computeItemsSubtotalCents(items);
  const hasQuoteItems = items.some((item) => item.requiresQuote);
  const quoted = hasQuoteItems ? (quotedPriceCents ?? null) : null;
  const pendingQuote = hasQuoteItems && quoted === null;
  const urgencySurchargeCents = computeUrgencySurchargeCents(urgent);

  const totalCents =
    subtotalCents + (deliveryFeeCents ?? 0) + (quoted ?? 0) + urgencySurchargeCents;
  const deposit = pendingQuote
    ? { depositRequired: false, depositCents: 0, remainingCents: totalCents }
    : computeDeposit(totalCents);

  return {
    subtotalCents,
    deliveryFeeCents,
    urgencySurchargeCents: urgencySurchargeCents || undefined,
    totalCents,
    depositRequired: deposit.depositRequired,
    depositCents: deposit.depositCents,
    remainingCents: deposit.remainingCents,
    pendingQuote: hasQuoteItems ? pendingQuote : undefined,
    quotedPriceCents: quoted ?? undefined,
    hasPendingExtras: items.some(itemHasPendingExtras) || undefined,
    candlesCents: computeOrderCandlesCents(items) || undefined,
  };
}

/** Construye un OrderItem a partir de una selección validada del configurador. */
export function buildOrderItem(params: {
  id: string;
  selection: ItemSelection;
  customization: ItemCustomization;
  quantity: number;
}): OrderItem | null {
  // Guarda defensiva: datos restaurados de storage podrían llegar malformados.
  if (!params?.selection?.productId || !params.customization?.size) return null;
  const product = getProduct(params.selection.productId);
  if (!product) return null;
  const quantity = Math.max(1, Math.floor(params.quantity));

  const candlesCents = computeCandlesCents(params.customization);

  // Personalizada/fondant: la tarta no tiene precio automático (los importes
  // quedan a 0 y requiresQuote obliga a la UI a mostrar "A consultar", nunca
  // 0 €), pero las velas sí tienen precio conocido y se contabilizan aparte.
  if (product.pricingType === "quote") {
    return {
      id: params.id,
      productId: product.id,
      productName: product.name,
      customization: params.customization,
      quantity,
      unitPriceCents: 0,
      candlesCents: candlesCents || undefined,
      totalCents: candlesCents,
      requiresQuote: true,
    };
  }

  // En productos por volumen la cantidad determina el precio unitario, así
  // que la selección debe llevarla siempre sincronizada. El relleno se toma
  // de la personalización cuando falta en la selección: los borradores
  // guardados antes de que los rellenos tuvieran suplemento no lo llevan.
  const selection: ItemSelection = {
    ...params.selection,
    fillingId: params.selection.fillingId ?? params.customization.filling?.id,
    ...(product.quantityTiers ? { quantity } : {}),
  };
  const unitPriceCents = computeUnitPriceCents(selection);
  if (unitPriceCents === null) return null;
  return {
    id: params.id,
    productId: product.id,
    productName: product.name,
    customization: params.customization,
    quantity,
    unitPriceCents,
    candlesCents: candlesCents || undefined,
    totalCents: unitPriceCents * quantity + candlesCents,
  };
}
