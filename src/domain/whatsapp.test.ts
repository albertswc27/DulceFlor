/**
 * El mensaje de WhatsApp es lo que de verdad llega a Dulce Flor, así que sus
 * cifras de dinero no pueden ser ambiguas. Aquí se fija que la señal ya cobrada
 * manda sobre la sugerencia del 30 % (no aparecen dos "pendiente" a la vez).
 */
import { describe, expect, it } from "vitest";
import { buildOrderWhatsAppMessage } from "./whatsapp";
import type { Order } from "./types";

function orderWith(overrides: Partial<Order>): Order {
  return {
    id: "id-1",
    publicId: "DF-2026-TEST1",
    clientRequestId: "req-1",
    createdAt: "2026-09-01T10:00:00.000Z",
    customerType: "individual",
    customer: { name: "Ana", phone: "+34600000000" },
    items: [
      {
        id: "item-1",
        productId: "pastel-clasico",
        productName: "Tarta clásica Dulce Flor",
        quantity: 1,
        unitPriceCents: 10000,
        totalCents: 10000,
        customization: { size: { id: "20-22-1d", label: "20–22 personas" }, toppings: [], extras: [] },
      },
    ],
    fulfillmentType: "pickup",
    requestedDate: "2026-09-05",
    requestedTime: "11:00",
    pricing: {
      subtotalCents: 10000,
      deliveryFeeCents: 0,
      totalCents: 10000,
      depositRequired: true,
      depositCents: 3000,
      remainingCents: 7000,
    },
    status: "pending",
    source: "kiosk",
    ...overrides,
  };
}

describe("buildOrderWhatsAppMessage y la urgencia", () => {
  it("un pedido urgente lo grita en la cabecera del mensaje", () => {
    const msg = buildOrderWhatsAppMessage(orderWith({ urgent: true }));
    const lines = msg.split("\n");
    expect(lines[1]).toContain("PEDIDO URGENTE");
    expect(lines[1]).toContain("3 días");
  });

  it("un pedido con margen no menciona la urgencia", () => {
    const msg = buildOrderWhatsAppMessage(orderWith({}));
    expect(msg).not.toContain("URGENTE");
  });
});

describe("buildOrderWhatsAppMessage y la señal", () => {
  it("sin señal cobrada, sugiere la paga y señal del 30 %", () => {
    const msg = buildOrderWhatsAppMessage(orderWith({}));
    expect(msg).toContain("Paga y señal (30%)");
    expect(msg).not.toContain("Señal recibida");
  });

  it("con señal cobrada, muestra lo recibido y NO la sugerencia del 30 %", () => {
    // Total 100 €, señal cobrada 50 €: un solo "pendiente" coherente.
    const msg = buildOrderWhatsAppMessage(orderWith({ depositPaidCents: 5000 }));
    expect(msg).toContain("Señal recibida: 50,00");
    expect(msg).toContain("Pendiente al recoger: 50,00");
    expect(msg).not.toContain("Paga y señal (30%)");
    // No debe haber dos "Pendiente" contradictorios.
    expect(msg.match(/Pendiente/g)?.length).toBe(1);
  });

  it("si el presupuesto cerró por debajo de la señal, avisa de la devolución", () => {
    // Tarta ya presupuestada en 40 € pero con 60 € de señal cobrada antes.
    const msg = buildOrderWhatsAppMessage(
      orderWith({
        depositPaidCents: 6000,
        pricing: {
          subtotalCents: 0,
          deliveryFeeCents: 0,
          totalCents: 4000,
          depositRequired: false,
          depositCents: 0,
          remainingCents: 4000,
          quotedPriceCents: 4000,
        },
        items: [
          {
            id: "item-1",
            productId: "pastel-fondant",
            productName: "Tarta de fondant",
            quantity: 1,
            unitPriceCents: 0,
            totalCents: 0,
            requiresQuote: true,
            customization: { size: { id: "20-22-1d", label: "20–22 personas" }, toppings: [], extras: [] },
          },
        ],
      })
    );
    expect(msg).toContain("Señal recibida: 60,00");
    expect(msg).toContain("Devolver al cliente: 20,00");
  });
});
