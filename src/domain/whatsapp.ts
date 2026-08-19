/**
 * Generación del mensaje de WhatsApp y del enlace wa.me.
 * La web NO envía el mensaje: registra el pedido, abre WhatsApp con el texto
 * preparado y es la persona usuaria quien lo envía.
 */
import { DEPOSIT_PERCENTAGE, WHATSAPP_PHONE } from "@/config/business";
import { formatEuros } from "./money";
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
  lines.push(
    onlyQuoteItems
      ? "SOLICITUD DE PRESUPUESTO — TARTA DE FONDANT"
      : "NUEVO PEDIDO DULCE FLOR"
  );
  lines.push("");
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
    lines.push(`Pedido: ${item.productName}${item.quantity > 1 ? ` x${item.quantity}` : ""}`);
    lines.push(`Tamaño: ${c.size.label}`);
    if (c.flavor) lines.push(`Sabor: ${c.flavor.label}`);
    if (c.filling) lines.push(`Relleno: ${c.filling.label}`);
    if (c.toppings.length > 0) {
      lines.push("Toppings:");
      for (const t of c.toppings) lines.push(`- ${t.label}`);
    }
    if (c.customToppingRequest) {
      lines.push(`Topping solicitado (a confirmar disponibilidad): ${c.customToppingRequest}`);
    }
    for (const extra of c.extras) {
      lines.push(`Extra: ${extra.label} (${formatEuros(extra.priceCents)})`);
    }
    if (c.dedicationText) lines.push(`Dedicatoria: "${c.dedicationText}"`);
    if (c.designDescription) lines.push(`Diseño: ${c.designDescription}`);
    if (c.notes) lines.push(`Indicaciones: ${c.notes}`);
    if (item.requiresQuote) lines.push("Precio: pendiente de presupuesto");
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

  if (order.pricing.pendingQuote) {
    // Solicitud con fondant sin presupuestar: nunca mostrar un total inexistente.
    if (order.pricing.subtotalCents > 0) {
      lines.push(`Subtotal (sin el fondant): ${formatEuros(order.pricing.subtotalCents)}`);
    }
    if (order.fulfillmentType === "delivery") {
      lines.push(
        order.pricing.deliveryFeeCents === null
          ? "Entrega: según distancia (a confirmar)"
          : `Entrega: ${formatEuros(order.pricing.deliveryFeeCents)}`
      );
    }
    lines.push("TOTAL: pendiente de presupuesto");
  } else {
    lines.push(`Subtotal: ${formatEuros(order.pricing.subtotalCents)}`);
    if (order.pricing.quotedPriceCents !== undefined) {
      lines.push(`Fondant (presupuesto): ${formatEuros(order.pricing.quotedPriceCents)}`);
    }
    if (order.fulfillmentType === "delivery") {
      lines.push(
        order.pricing.deliveryFeeCents === null
          ? "Entrega: según distancia (a confirmar)"
          : `Entrega: ${formatEuros(order.pricing.deliveryFeeCents)}`
      );
    }
    lines.push(`TOTAL: ${formatEuros(order.pricing.totalCents)}`);
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
