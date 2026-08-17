import { describe, expect, it } from "vitest";
import {
  buildOrderItem,
  computeDeposit,
  computeOrderPricing,
  computeUnitPriceCents,
  getToppingPriceCents,
} from "./pricing";
import { getUnitBasePriceCents } from "./catalog";
import type { OrderItem } from "./types";

function makeItem(unitPriceCents: number, quantity = 1): OrderItem {
  return {
    id: "item-1",
    productId: "pastel-clasico",
    productName: "Pastel personalizado",
    customization: {
      size: { id: "4-6-1d", label: "4–6 personas · 1 disco (8 cm)" },
      toppings: [],
      extras: [],
    },
    quantity,
    unitPriceCents,
    totalCents: unitPriceCents * quantity,
  };
}

describe("paga y señal", () => {
  it("caso 1: pedido de 35 € no requiere señal", () => {
    const deposit = computeDeposit(3500);
    expect(deposit.depositRequired).toBe(false);
    expect(deposit.depositCents).toBe(0);
    expect(deposit.remainingCents).toBe(3500);
  });

  it("caso 2: pedido de exactamente 40 € no requiere señal", () => {
    const deposit = computeDeposit(4000);
    expect(deposit.depositRequired).toBe(false);
  });

  it("caso 3: pedido de 40,01 € requiere señal", () => {
    const deposit = computeDeposit(4001);
    expect(deposit.depositRequired).toBe(true);
  });

  it("caso 4: pedido de 60 € → señal 18 €, pendiente 42 €", () => {
    const deposit = computeDeposit(6000);
    expect(deposit.depositRequired).toBe(true);
    expect(deposit.depositCents).toBe(1800);
    expect(deposit.remainingCents).toBe(4200);
  });

  it("redondea la señal al céntimo (33,33 € → 10,00 €)", () => {
    const deposit = computeDeposit(4333);
    expect(deposit.depositCents).toBe(1300); // 4333 * 0.3 = 1299.9 → 1300
    expect(deposit.depositCents + deposit.remainingCents).toBe(4333);
  });
});

describe("toppings", () => {
  it("caso 5: 2 toppings suman 4 € extra", () => {
    const sinToppings = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "4-6-1d",
      flavorId: "chocolate",
      toppingIds: [],
      extraIds: [],
    });
    const conToppings = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "4-6-1d",
      flavorId: "chocolate",
      toppingIds: ["oreo", "kinder-bueno"],
      extraIds: [],
    });
    expect(sinToppings).toBe(2000);
    expect(conToppings).toBe(2400);
  });

  it("excepción de carta: suplemento 6 € en tres leches de 28–30 porciones", () => {
    expect(getToppingPriceCents("tres-leches", "5-6")).toBe(200);
    expect(getToppingPriceCents("tres-leches", "28-30")).toBe(600);
  });
});

describe("precios de catálogo (transcritos de las cartas)", () => {
  it("pastel clásico 4–6 personas / 1 disco = 20 €", () => {
    expect(getUnitBasePriceCents("pastel-clasico", "individual", "4-6-1d")).toBe(2000);
  });

  it("pastel buttercream 20–22 personas / 3 discos = 82 €", () => {
    expect(getUnitBasePriceCents("pastel-buttercream", "individual", "20-22-3d")).toBe(8200);
  });

  it("cheesecake pistacho particular grande = 43 €, empresa grande = 45 €", () => {
    expect(getUnitBasePriceCents("cheesecake", "individual", "14-16", "pistacho")).toBe(4300);
    expect(getUnitBasePriceCents("cheesecake", "business", "14-16", "pistacho")).toBe(4500);
  });

  it("tres leches particular 28–30 porciones = 59 €, empresa 8 porciones = 18 €", () => {
    expect(getUnitBasePriceCents("tres-leches", "individual", "28-30")).toBe(5900);
    expect(getUnitBasePriceCents("tres-leches", "business", "8")).toBe(1800);
  });

  it("combinaciones inexistentes devuelven null", () => {
    expect(getUnitBasePriceCents("pastel-clasico", "business", "4-6-1d")).toBeNull();
    expect(getUnitBasePriceCents("cheesecake", "individual", "4-6")).toBeNull(); // sin sabor
    expect(getUnitBasePriceCents("cheesecake", "individual", "4-6", "inexistente")).toBeNull();
  });
});

describe("cálculo completo del pedido", () => {
  it("suma subtotal + entrega y calcula señal sobre el total", () => {
    const pricing = computeOrderPricing([makeItem(5500)], 1000);
    expect(pricing.subtotalCents).toBe(5500);
    expect(pricing.totalCents).toBe(6500);
    expect(pricing.depositRequired).toBe(true);
    expect(pricing.depositCents).toBe(1950);
    expect(pricing.remainingCents).toBe(4550);
  });

  it("entrega 'a consultar' (null) no suma transporte", () => {
    const pricing = computeOrderPricing([makeItem(3500)], null);
    expect(pricing.deliveryFeeCents).toBeNull();
    expect(pricing.totalCents).toBe(3500);
    expect(pricing.depositRequired).toBe(false);
  });

  it("multiplica por cantidad", () => {
    const pricing = computeOrderPricing([makeItem(2000, 3)], 0);
    expect(pricing.subtotalCents).toBe(6000);
  });
});

describe("buildOrderItem", () => {
  it("construye el artículo con el precio calculado desde catálogo", () => {
    const item = buildOrderItem({
      id: "x",
      selection: {
        productId: "cheesecake",
        customerType: "individual",
        sizeId: "10-12",
        flavorId: "kinder-bueno",
        toppingIds: ["fresas"],
        extraIds: ["dedicatoria"],
      },
      customization: {
        size: { id: "10-12", label: "10–12 porciones aprox." },
        flavor: { id: "kinder-bueno", label: "Kinder Bueno" },
        toppings: [{ id: "fresas", label: "Fresas" }],
        extras: [{ id: "dedicatoria", label: "Dedicatoria", priceCents: 200 }],
        dedicationText: "Felicidades Laura",
      },
      quantity: 2,
    });
    // 2900 (kinder bueno mediano) + 200 topping + 200 dedicatoria = 3300
    expect(item?.unitPriceCents).toBe(3300);
    expect(item?.totalCents).toBe(6600);
  });
});
