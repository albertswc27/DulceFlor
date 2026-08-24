/**
 * Generación del mensaje de WhatsApp y del enlace wa.me.
 * La web NO envía el mensaje: registra el pedido, abre WhatsApp con el texto
 * preparado y es la persona usuaria quien lo envía.
 */
import { DEPOSIT_PERCENTAGE, WHATSAPP_PHONE } from "@/config/business";
import { getProduct } from "./catalog";
import { formatEuros } from "./money";
import { describeCandleLines } from "./pricing";
import {
  CUSTOMER_TYPE_LABELS,
  FULFILLMENT_LABELS,
  type Order,
} from "./types";

function formatDateHuman(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildOrderWhatsAppMessage(order: Order): string {
  const lines: string[] = [];
  const hasQuoteItems = order.items.some((item) => item.requiresQuote);
  const onlyQuoteItems = hasQuoteItems && order.items.every((item) => item.requiresQuote);
  const quoteItem = order.items.find((item) => item.requiresQuote);
  const quoteProduct = quoteItem ? getProduct(quoteItem.productId) : undefined;
  const isGiftRequest = Boolean(quoteProduct?.giftType);
  lines.push(
    onlyQuoteItems
      ? isGiftRequest
        ? "SOLICITUD DE REGALO PERSONALIZADO"
        : `SOLICITUD DE PRESUPUESTO — ${
            quoteItem?.productName.toUpperCase() ?? "TARTA A MEDIDA"
          }`
      : "NUEVO PEDIDO DULCE FLOR"
  );
  lines.push("");
  if (onlyQuoteItems && isGiftRequest) {
    lines.push(`Tipo: ${quoteItem!.productName}`);
    lines.push("");
  }
  lines.push(`Pedido: ${order.publicId}`);
  lines.push("");
  lines.push(`Cliente: ${order.customer.name}`);
  lines.push(`Teléfono: ${order.customer.phone}`);
  if (order.customer.email) lines.push(`Email: ${order.customer.email}`);
  lines.push(`Tipo: ${CUSTOMER_TYPE_LABELS[order.customerType]}`);
  if (order.customer.companyName) lines.push(`Empresa: ${order.customer.companyName}`);
  lines.push("");

  for (const item of order.items) {
    const c = item.customization;
    const product = getProduct(item.productId);
    const isTiered = Boolean(product?.quantityTiers);
    const isGift = Boolean(product?.giftType);

    if (isTiered) {
      lines.push(`Producto: ${item.productName}`);
      lines.push(`Cantidad: ${item.quantity} uds · ${formatEuros(item.unitPriceCents)}/ud`);
    } else if (isGift) {
      lines.push(`Producto: ${item.productName}`);
      if (c.occasion) lines.push(`Ocasión: ${c.occasion}`);
    } else {
      lines.push(
        `Pedido: ${item.productName}${item.quantity > 1 ? ` x${item.quantity}` : ""}`
      );
      lines.push(`Tamaño: ${c.size.label}`);
    }
    if (c.flavor) lines.push(`Sabor: ${c.flavor.label}`);
    if (c.filling) lines.push(`Relleno: ${c.filling.label}`);
    if (c.toppings.length > 0) {
      lines.push("Toppings:");
      for (const t of c.toppings) lines.push(`- ${t.label}`);
    }
    if (c.customToppingRequest) {
      lines.push(`Topping solicitado: ${c.customToppingRequest}`);
      lines.push("  (precio pendiente de confirmación)");
    }
    for (const extra of c.extras) {
      lines.push(`Extra: ${extra.label} (${formatEuros(extra.priceCents)})`);
    }
    for (const line of describeCandleLines(c)) lines.push(line);
    if (c.dedicationText) lines.push(`Dedicatoria: "${c.dedicationText}"`);
    if (c.designDescription) lines.push(`Diseño: ${c.designDescription}`);
    if (c.notes) lines.push(`Indicaciones: ${c.notes}`);
    if (item.requiresQuote) lines.push("Precio tarta: pendiente de presupuesto");
    if (c.referenceImageId) {
      lines.push(`Imagen de referencia adjunta al pedido ${order.publicId} (visible en el panel)`);
    }
    lines.push("");
  }

  if (order.customerType === "business" && order.reusableTray) {
    lines.push("Entrega en fuente de cristal reutilizable");
    lines.push("");
  }

  lines.push(`Modalidad: ${FULFILLMENT_LABELS[order.fulfillmentType]}`);
  if (order.fulfillmentType === "delivery" && order.address) {
    const a = order.address;
    lines.push(`Dirección: ${a.street}, ${a.postalCode} ${a.municipality}`);
    if (a.details) lines.push(`Detalles: ${a.details}`);
  }
  lines.push(`Fecha: ${formatDateHuman(order.requestedDate)}`);
  lines.push(`Hora: ${order.requestedTime}`);
  lines.push("");

  const candlesCents = order.pricing.candlesCents ?? 0;
  const productsCents = order.pricing.subtotalCents - candlesCents;

  if (order.pricing.pendingQuote) {
    // Solicitud sin presupuestar: nunca mostrar un total inexistente.
    if (productsCents > 0) {
      lines.push(`Subtotal de lo ya valorado: ${formatEuros(productsCents)}`);
    }
    if (candlesCents > 0) lines.push(`Velas: ${formatEuros(candlesCents)}`);
    if (order.fulfillmentType === "delivery") {
      lines.push(
        order.pricing.deliveryFeeCents === null
          ? "Entrega: según distancia (a confirmar)"
          : `Entrega: ${formatEuros(order.pricing.deliveryFeeCents)}`
      );
    }
    lines.push("PRECIO DE LA TARTA: pendiente de presupuesto");
  } else {
    lines.push(`Subtotal: ${formatEuros(productsCents)}`);
    if (candlesCents > 0) lines.push(`Velas: ${formatEuros(candlesCents)}`);
    if (order.pricing.quotedPriceCents !== undefined) {
      lines.push(`Presupuesto tarta a medida: ${formatEuros(order.pricing.quotedPriceCents)}`);
    }
    if (order.fulfillmentType === "delivery") {
      lines.push(
        order.pricing.deliveryFeeCents === null
          ? "Entrega: según distancia (a confirmar)"
          : `Entrega: ${formatEuros(order.pricing.deliveryFeeCents)}`
      );
    }
    lines.push(
      `${order.pricing.hasPendingExtras ? "TOTAL ACTUAL" : "TOTAL"}: ${formatEuros(
        order.pricing.totalCents
      )}`
    );
    if (order.pricing.hasPendingExtras) {
      lines.push("  + modificaciones pendientes de confirmar (ver indicaciones)");
    }
    if (order.pricing.depositRequired) {
      lines.push(
        `Paga y señal (${DEPOSIT_PERCENTAGE}%): ${formatEuros(order.pricing.depositCents)}`
      );
      lines.push(`Pendiente: ${formatEuros(order.pricing.remainingCents)}`);
    }
  }

  return lines.join("\n");
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}
