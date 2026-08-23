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
  TOPPING_PRICE_CENTS,
} from "@/config/business";
import {
  getProduct,
  getUnitBasePriceCents,
  resolveQuantityTier,
  TOPPINGS,
} from "./catalog";
import { percentOf } from "./money";
import type { CustomerType, ItemCustomization, OrderItem, OrderPricing } from "./types";

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

/**
 * Importe de las velas de un artículo. Las velas se cobran por el artículo
 * (no se multiplican por la cantidad de tartas) y tienen precio conocido
 * incluso en los productos que se presupuestan a mano.
 */
export function computeCandlesCents(candleQuantity: number | undefined): number {
  const quantity = Math.max(0, Math.floor(candleQuantity ?? 0));
  return Math.min(quantity, MAX_CANDLES) * CANDLE_UNIT_PRICE_CENTS;
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
  toppingIds: string[];
  extraIds: string[];
  /**
   * Solo productos con precio por volumen (aperitivos): número de unidades
   * pedidas, del que depende el precio unitario del tramo.
   */
  quantity?: number;
}

/**
 * Precio unitario de un artículo configurado (base + toppings + extras).
 * Devuelve null si la combinación no existe en el catálogo.
 */
export function computeUnitPriceCents(selection: ItemSelection): number | null {
  const product = getProduct(selection.productId);
  if (!product) return null;

  // Precio por volumen (aperitivos): el unitario sale del tramo de cantidad.
  if (product.quantityTiers) {
    const tier = resolveQuantityTier(product, selection.quantity ?? 0);
    return tier ? tier.unitPriceCents : null;
  }

  const base = getUnitBasePriceCents(
    selection.productId,
    selection.customerType,
    selection.sizeId,
    selection.flavorId
  );
  if (base === null) return null;

  const toppingPrice = getToppingPriceCents(selection.productId, selection.sizeId);
  const toppingsTotal = product.allowsToppings
    ? countValidToppings(selection.toppingIds) * toppingPrice
    : 0;

  const extrasTotal = selection.extraIds.reduce((sum, extraId) => {
    const extra = product.extras.find((e) => e.id === extraId);
    return sum + (extra?.priceCents ?? 0);
  }, 0);

  return base + toppingsTotal + extrasTotal;
}

/** Desglose reutilizable para pintar el resumen (base / toppings / extras). */
export interface UnitPriceBreakdown {
  baseCents: number;
  toppingsCents: number;
  extrasCents: number;
  unitTotalCents: number;
}

export function computeUnitPriceBreakdown(
  selection: ItemSelection
): UnitPriceBreakdown | null {
  const product = getProduct(selection.productId);
  if (!product) return null;
  if (product.quantityTiers) {
    const unit = computeUnitPriceCents(selection);
    if (unit === null) return null;
    return { baseCents: unit, toppingsCents: 0, extrasCents: 0, unitTotalCents: unit };
  }
  const base = getUnitBasePriceCents(
    selection.productId,
    selection.customerType,
    selection.sizeId,
    selection.flavorId
  );
  if (base === null) return null;
  const toppingsCents = product.allowsToppings
    ? countValidToppings(selection.toppingIds) *
      getToppingPriceCents(selection.productId, selection.sizeId)
    : 0;
  const extrasCents = selection.extraIds.reduce((sum, extraId) => {
    const extra = product.extras.find((e) => e.id === extraId);
    return sum + (extra?.priceCents ?? 0);
  }, 0);
  return {
    baseCents: base,
    toppingsCents,
    extrasCents,
    unitTotalCents: base + toppingsCents + extrasCents,
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
 * Cálculo completo del pedido.
 * - deliveryFeeCents null = fuera de zona automática (según distancia); el
 *   total se calcula sin transporte y la UI debe indicarlo claramente.
 * - Artículos "quote" (fondant): mientras no exista quotedPriceCents, el
 *   pedido queda pendingQuote (total parcial, SIN señal). Cuando
 *   administración introduce el presupuesto, se suma al total y la señal se
 *   calcula con normalidad.
 */
export function computeOrderPricing(
  items: OrderItem[],
  deliveryFeeCents: number | null,
  quotedPriceCents?: number | null
): OrderPricing {
  const subtotalCents = computeItemsSubtotalCents(items);
  const hasQuoteItems = items.some((item) => item.requiresQuote);
  const quoted = hasQuoteItems ? (quotedPriceCents ?? null) : null;
  const pendingQuote = hasQuoteItems && quoted === null;

  const totalCents = subtotalCents + (deliveryFeeCents ?? 0) + (quoted ?? 0);
  const deposit = pendingQuote
    ? { depositRequired: false, depositCents: 0, remainingCents: totalCents }
    : computeDeposit(totalCents);

  return {
    subtotalCents,
    deliveryFeeCents,
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

  const candlesCents = computeCandlesCents(params.customization.candleQuantity);

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
  // que la selección debe llevarla siempre sincronizada.
  const selection = product.quantityTiers
    ? { ...params.selection, quantity }
    : params.selection;
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
