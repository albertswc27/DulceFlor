/**
 * El pedido viaja a la base de datos partido en columnas (lo que el panel
 * filtra) y un JSON con el resto. Si esa traducción pierde algo por el camino,
 * el pedido llega mutilado a la tienda y nadie se entera hasta que falta un
 * topping. De ahí que se compruebe la ida y la vuelta completas.
 */
import { describe, expect, it } from "vitest";
import { fromRow, toRow, type OrderRow } from "./orderRepository";
import { newPublicOrderId } from "@/domain/orderId";
import type { Order } from "@/domain/types";

const PEDIDO: Order = {
  id: "11111111-2222-3333-4444-555555555555",
  publicId: "DF-2026-A1B2C",
  createdAt: "2026-08-26T10:00:00.000Z",
  status: "pending",
  clientRequestId: "req-1",
  source: "web",
  customerType: "individual",
  fulfillmentType: "delivery",
  requestedDate: "2026-09-01",
  requestedTime: "11:00",
  customer: {
    name: "Albert Cabezuelo",
    phone: "+34640389158",
    email: "albert@example.com",
  },
  address: {
    street: "C. Mayor 1",
    postalCode: "08921",
    municipality: "Santa Coloma de Gramenet",
  },
  items: [
    {
      id: "item-1",
      productId: "pastel-clasico",
      productName: "Tarta clásica Dulce Flor",
      quantity: 1,
      unitPriceCents: 3800,
      candlesCents: 400,
      totalCents: 4200,
      customization: {
        size: { id: "10-12-2d", label: "10–12 personas · 2 discos" },
        flavor: { id: "3-leches", label: "3 Leches" },
        filling: { id: "nata-frutas", label: "Nata con frutas" },
        toppings: [{ id: "fresas", label: "Fresas" }],
        extras: [{ id: "dedicatoria", label: "Dedicatoria", priceCents: 200 }],
        candleDigits: "25",
        candleStyle: "bengala",
        dedicationText: "Felicidades",
        notes: "Sin frutos secos",
      },
    },
  ],
  pricing: {
    subtotalCents: 4200,
    deliveryFeeCents: 500,
    totalCents: 4700,
    depositRequired: true,
    depositCents: 1410,
    remainingCents: 3290,
    candlesCents: 400,
  },
};

describe("traducción del pedido a la base de datos", () => {
  it("conserva el pedido entero en la ida y la vuelta", () => {
    expect(fromRow(toRow(PEDIDO))).toEqual(PEDIDO);
  });

  it("saca a columnas propias lo que el panel filtra y ordena", () => {
    const row = toRow(PEDIDO);
    expect(row.public_id).toBe(PEDIDO.publicId);
    expect(row.created_at).toBe(PEDIDO.createdAt);
    expect(row.status).toBe(PEDIDO.status);
    expect(row.requested_date).toBe(PEDIDO.requestedDate);
    expect(row.customer_name).toBe(PEDIDO.customer.name);
    expect(row.customer_phone).toBe(PEDIDO.customer.phone);
  });

  it("no pierde las opciones nuevas del catálogo, que van en el JSON", () => {
    const vuelta = fromRow(toRow(PEDIDO))!;
    const c = vuelta.items[0].customization;
    expect(c.candleDigits).toBe("25");
    expect(c.candleStyle).toBe("bengala");
    expect(c.toppings).toHaveLength(1);
    expect(vuelta.pricing.depositCents).toBe(1410);
    expect(vuelta.address?.postalCode).toBe("08921");
  });

  it("un pedido sin email no inventa una cadena vacía", () => {
    const sinEmail: Order = {
      ...PEDIDO,
      customer: { name: "Ana", phone: "+34600000000" },
    };
    expect(toRow(sinEmail).customer_email).toBeNull();
    expect(fromRow(toRow(sinEmail))?.customer.email).toBeUndefined();
  });

  it("descarta una fila corrupta en vez de tumbar el panel", () => {
    const rota = { ...toRow(PEDIDO), payload: { basura: true } } as unknown as OrderRow;
    expect(fromRow(rota)).toBeNull();
  });
});

describe("identificador público", () => {
  it("tiene el formato DF-AAAA-XXXXX", () => {
    expect(newPublicOrderId(2026)).toMatch(/^DF-2026-[0-9A-Z]{5}$/);
  });

  it("apenas se repite: el espacio es lo bastante grande", () => {
    // El identificador es aleatorio, así que exigir CERO colisiones sería
    // exigir algo que el diseño no promete: con 5.000 identificadores en un
    // espacio de 36^5 se espera una colisión una de cada cinco veces, y un
    // test así falla solo de vez en cuando (pasó).
    //
    // Lo que sí importa es que el espacio no se encoja. Con los cuatro
    // caracteres de la primera versión se esperaban ~7 repetidos aquí, así
    // que este margen distingue una versión de la otra sin ser caprichoso.
    const MUESTRA = 5000;
    const vistos = new Set<string>();
    for (let i = 0; i < MUESTRA; i += 1) vistos.add(newPublicOrderId(2026));
    expect(vistos.size).toBeGreaterThanOrEqual(MUESTRA - 5);
  });

  it("el año va por delante, así que el espacio se renueva cada enero", () => {
    expect(newPublicOrderId(2026).startsWith("DF-2026-")).toBe(true);
    expect(newPublicOrderId(2027).startsWith("DF-2027-")).toBe(true);
  });
});
