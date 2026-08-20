/**
 * Motor de cálculo del pedido — ÚNICA fuente de verdad para precios.
 * El configurador público, el kiosk y el panel admin deben usar estas
 * funciones; nunca duplicar cálculos en componentes.
 */
import {
  DEPOSIT_PERCENTAGE,
  DEPOSIT_THRESHOLD_CENTS,
  TOPPING_PRICE_CENTS,
} from "@/config/business";
import { getProduct, getUnitBasePriceCents, TOPPINGS } from "./catalog";
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
}

/**
 * Precio unitario de un artículo configurado (base + toppings + extras).
 * Devuelve null si la combinación no existe en el catálogo.
 */
export function computeUnitPriceCents(selection: ItemSelection): number | null {
  const product = getProduct(selection.productId);
  if (!product) return null;

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

/** Subtotal de los artículos con precio automático (los "quote" no suman). */
export function computeItemsSubtotalCents(items: OrderItem[]): number {
  return items.reduce(
    (sum, item) => (item.requiresQuote ? sum : sum + item.unitPriceCents * item.quantity),
    0
  );
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

  // Fondant: sin precio automático. Los importes quedan a 0 internamente,
  // pero requiresQuote obliga a la UI a mostrar "A consultar", nunca 0 €.
  if (product.pricingType === "quote") {
    return {
      id: params.id,
      productId: product.id,
      productName: product.name,
      customization: params.customization,
      quantity,
      unitPriceCents: 0,
      totalCents: 0,
      requiresQuote: true,
    };
  }

  const unitPriceCents = computeUnitPriceCents(params.selection);
  if (unitPriceCents === null) return null;
  return {
    id: params.id,
    productId: product.id,
    productName: product.name,
    customization: params.customization,
    quantity,
    unitPriceCents,
    totalCents: unitPriceCents * quantity,
  };
}
