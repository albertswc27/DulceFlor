/**
 * Generación del mensaje de WhatsApp y del enlace wa.me.
 * La web NO envía el mensaje: registra el pedido, abre WhatsApp con el texto
 * preparado y es la persona usuaria quien lo envía.
 */
import {
  DEPOSIT_PERCENTAGE,
  PICKUP_CONDITIONS,
  STANDARD_ORDER_LEAD_TIME_HOURS,
  WHATSAPP_PHONE,
} from "@/config/business";
import { getProduct } from "./catalog";
import { formatEuros } from "./money";
import {
  computeBalanceDueCents,
  computeOverpaidCents,
  describeCandleLines,
  resolveItemSurcharges,
} from "./pricing";
import {
  CUSTOMER_TYPE_LABELS,
  FULFILLMENT_LABELS,
  type Order,
} from "./types";

/** « (+2,50 €)» para las opciones con suplemento; cadena vacía si no lleva. */
function suffixFor(cents: number): string {
  return cents > 0 ? ` (+${formatEuros(cents)})` : "";
}

/** "2026-09-25" → "25/09/2026". Formato corto para el aviso al cliente. */
function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

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
  // La urgencia va arriba del todo: este mensaje es el aviso que recibe la
  // tienda, y un pedido con menos de 3 días no puede pasar desapercibido.
  if (order.urgent) {
    lines.push(
      `🔴 PEDIDO URGENTE: menos de ${
        STANDARD_ORDER_LEAD_TIME_HOURS / 24
      } días de antelación. Pendiente de que Dulce Flor confirme si puede prepararlo.`
    );
  }
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
    const surcharges = resolveItemSurcharges(item.productId, c);
    if (c.flavor) {
      lines.push(`Sabor: ${c.flavor.label}${suffixFor(surcharges.flavorCents)}`);
    }
    if (c.filling) {
      lines.push(`Relleno: ${c.filling.label}${suffixFor(surcharges.fillingCents)}`);
    }
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
    if (c.aiPrompt) lines.push(`Descripción para la IA: ${c.aiPrompt}`);
    if (c.referenceImageId) {
      lines.push(
        c.referenceImageSource === "ia"
          ? `Imagen ORIENTATIVA generada con IA, adjunta al pedido ${order.publicId} (visible en el panel). No es la foto de una tarta real.`
          : `Imagen de referencia adjunta al pedido ${order.publicId} (visible en el panel)`
      );
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
  const urgencyCents = order.pricing.urgencySurchargeCents ?? 0;
  const hasPaidDeposit = (order.depositPaidCents ?? 0) > 0;

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
    if (urgencyCents > 0) {
      lines.push(`Suplemento por urgencia: ${formatEuros(urgencyCents)}`);
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
    if (urgencyCents > 0) {
      lines.push(`Suplemento por urgencia: ${formatEuros(urgencyCents)}`);
    }
    lines.push(
      `${order.pricing.hasPendingExtras ? "TOTAL ACTUAL" : "TOTAL"}: ${formatEuros(
        order.pricing.totalCents
      )}`
    );
    if (order.pricing.hasPendingExtras) {
      lines.push("  + modificaciones pendientes de confirmar (ver indicaciones)");
    }
    // La sugerencia del 30 % solo tiene sentido si NO se ha cobrado ya una
    // señal; si hay señal recibida, mandan las cifras reales de abajo (igual
    // que hace el panel), para no dar dos "pendiente" contradictorios.
    if (order.pricing.depositRequired && !hasPaidDeposit) {
      lines.push(
        `Paga y señal (${DEPOSIT_PERCENTAGE}%): ${formatEuros(order.pricing.depositCents)}`
      );
      lines.push(`Pendiente: ${formatEuros(order.pricing.remainingCents)}`);
    }
  }

  // Señal ya cobrada (normalmente en tienda): es dinero recibido, así que va
  // después del total, con lo que resta por cobrar al recoger.
  if (hasPaidDeposit) {
    lines.push("");
    lines.push(`Señal recibida: ${formatEuros(order.depositPaidCents!)}`);
    const balance = computeBalanceDueCents(order.pricing, order.depositPaidCents);
    const overpaid = computeOverpaidCents(order.pricing, order.depositPaidCents);
    if (balance === null) {
      lines.push("Pendiente al recoger: se calculará con el presupuesto");
    } else if (overpaid > 0) {
      lines.push(`Devolver al cliente: ${formatEuros(overpaid)}`);
    } else {
      lines.push(`Pendiente al recoger: ${formatEuros(balance)}`);
    }
  }

  return lines.join("\n");
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

/**
 * Normaliza un teléfono para wa.me: solo dígitos, sin el prefijo
 * internacional "00" (wa.me no lo admite) y, si quedan 9 dígitos, se asume
 * prefijo de España.
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `34${digits}`;
  return digits;
}

/** Enlace wa.me hacia un cliente, opcionalmente con el mensaje ya escrito. */
export function buildWhatsAppUrlForPhone(phone: string, message?: string): string {
  const base = `https://wa.me/${normalizePhoneForWhatsApp(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Aviso que recibe el CLIENTE cuando Dulce Flor tramita su pedido.
 *
 * Es un mensaje distinto del resumen interno: aquí no van ni el desglose de
 * la tarta ni los datos de gestión, solo lo que la persona necesita para
 * recoger —número, día, hora e importe— y las condiciones de recogida que
 * hasta ahora se entregaban en papel.
 *
 * La web no lo envía sola: abre WhatsApp con el texto preparado y lo manda
 * quien está en el mostrador (ver AdminOrderDetailPage).
 */
export function buildCustomerNotificationMessage(order: Order): string {
  const lines: string[] = [];
  const firstName = order.customer.name.trim().split(/\s+/)[0];

  lines.push(`Dulce Flor · Pedido ${order.publicId}`);
  lines.push("");
  lines.push(`Hola ${firstName}, tu pedido ha sido tramitado correctamente.`);
  lines.push("");
  lines.push(
    order.fulfillmentType === "delivery"
      ? `Fecha de entrega: ${formatDateShort(order.requestedDate)}`
      : `Fecha de recogida: ${formatDateShort(order.requestedDate)}`
  );
  lines.push(`Hora: ${order.requestedTime}`);

  // Con una tarta a presupuestar el total todavía no es firme: prometer un
  // importe aquí sería desmentirlo después.
  if (order.pricing.pendingQuote) {
    lines.push("Total: pendiente de presupuesto, te lo confirmamos por aquí");
  } else {
    lines.push(`Total: ${formatEuros(order.pricing.totalCents)}`);
    const paid = order.depositPaidCents ?? 0;
    if (paid > 0) {
      const balance = computeBalanceDueCents(order.pricing, order.depositPaidCents);
      const overpaid = computeOverpaidCents(order.pricing, order.depositPaidCents);
      lines.push(`Señal ya pagada: ${formatEuros(paid)}`);
      if (overpaid > 0) {
        lines.push(`Te devolvemos: ${formatEuros(overpaid)}`);
      } else if (balance !== null) {
        lines.push(`Pendiente al recoger: ${formatEuros(balance)}`);
      }
    }
  }

  if (order.fulfillmentType === "delivery" && order.address) {
    lines.push("");
    lines.push(
      `Dirección de entrega: ${order.address.street}, ${order.address.postalCode} ${order.address.municipality}`
    );
  }

  lines.push("");
  lines.push(
    order.fulfillmentType === "delivery"
      ? "CONDICIONES DE ENTREGA"
      : "CONDICIONES DE RECOGIDA"
  );
  for (const condition of PICKUP_CONDITIONS) lines.push(`- ${condition}`);
  lines.push("");
  lines.push("¡Gracias por confiar en Dulce Flor!");

  return lines.join("\n");
}
