/**
 * El borrador del pedido se guarda en el navegador y se vuelve a validar con
 * zod al restaurarlo. Y zod DESCARTA en silencio todo lo que no esté declarado
 * en el esquema.
 *
 * Eso ya ha costado dos fallos en este proyecto: las velas y las bengalas se
 * perdían al recargar la página, y nadie se enteró hasta que un cliente
 * reclamó. El comentario del esquema lo avisa, pero un comentario no falla.
 *
 * Este test sí: si alguien añade un campo a ItemCustomization y se olvida del
 * esquema, aquí se rompe y dice exactamente cuál falta.
 */
import { describe, expect, it } from "vitest";

import type { ItemCustomization } from "@/domain/types";

import { draftStateSchema } from "./OrderDraftContext";

/**
 * Una personalización con TODOS los campos puestos. Es a propósito absurda
 * —nadie pide una tarta así— porque lo que se comprueba es la forma, no el
 * pedido. Al declararla como ItemCustomization, TypeScript obliga a que los
 * nombres existan de verdad.
 */
const CUSTOMIZACION_COMPLETA: ItemCustomization = {
  size: { id: "10-12-2d", label: "10–12 personas · 2 discos" },
  flavor: { id: "chocolate", label: "Chocolate" },
  filling: { id: "dulce-de-leche", label: "Dulce de leche" },
  toppings: [{ id: "oreo", label: "Oreo" }],
  customToppingRequest: "Lacasitos, si podéis",
  extras: [{ id: "dedicatoria", label: "Dedicatoria", priceCents: 250 }],
  dedicationText: "Felicidades, Laura",
  designDescription: "Un unicornio en tonos pastel",
  occasion: "Cumpleaños",
  boxAccepted: true,
  candleQuantity: 2,
  candleDigits: "25",
  candleStyle: "vela",
  sparklerQuantity: 1,
  notes: "Sin frutos secos",
  referenceImageId: "img-1",
  referenceImageSource: "ia",
  aiPrompt: "Tarta de nata en tonos rosa palo",
};

function borradorCon(customization: ItemCustomization) {
  return {
    customerType: "individual",
    items: [
      {
        id: "art-1",
        selection: {
          productId: "pastel-clasico",
          customerType: "individual",
          sizeId: "10-12-2d",
          toppingIds: ["oreo"],
          extraIds: ["dedicatoria"],
        },
        customization,
        quantity: 1,
      },
    ],
    fulfillmentType: "pickup",
    address: null,
    requestedDate: "2026-10-05",
    requestedTime: "18:00",
    customer: null,
    reusableTray: false,
    clientRequestId: "req-1",
  };
}

describe("el borrador guardado no puede perder campos por el camino", () => {
  it("sobrevive TODO lo que se puede personalizar de una tarta", () => {
    const parsed = draftStateSchema.parse(borradorCon(CUSTOMIZACION_COMPLETA));

    const guardados = Object.keys(parsed.items[0].customization).sort();
    const esperados = Object.keys(CUSTOMIZACION_COMPLETA).sort();

    // Si esto falla, el nombre que sobra en `esperados` es el campo que zod
    // se está comiendo: añádelo a draftStateSchema en OrderDraftContext.tsx.
    expect(guardados).toEqual(esperados);
  });

  it("la caja marcada se recuerda al recargar la página", () => {
    // El caso concreto que pidió Dulce Flor: si la clienta marca la caja,
    // vuelve más tarde y edita la tarta, no se le puede pedir dos veces.
    const parsed = draftStateSchema.parse(borradorCon(CUSTOMIZACION_COMPLETA));
    expect(parsed.items[0].customization.boxAccepted).toBe(true);
  });

  it("un borrador antiguo, de antes de la caja, sigue siendo válido", () => {
    // Hay pedidos a medias en el navegador de gente que empezó ayer. Que el
    // campo sea opcional es lo que evita que se les borre el carrito entero.
    const { boxAccepted: _omitido, ...sinCaja } = CUSTOMIZACION_COMPLETA;
    const parsed = draftStateSchema.safeParse(borradorCon(sinCaja));
    expect(parsed.success).toBe(true);
  });
});
