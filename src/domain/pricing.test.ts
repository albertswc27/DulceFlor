import { describe, expect, it } from "vitest";
import {
  buildOrderItem,
  computeCandlesCents,
  computeDeposit,
  computeOrderPricing,
  computeUnitPriceCents,
  getToppingPriceCents,
} from "./pricing";
import {
  CAKE_FILLINGS,
  getProduct,
  getProductsFor,
  getSizesFor,
  getUnitBasePriceCents,
} from "./catalog";
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

describe("toppings (precio actualizado: 2,50 €)", () => {
  function priceWithToppings(toppingIds: string[]): number | null {
    return computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "4-6-1d",
      flavorId: "chocolate",
      toppingIds,
      extraIds: [],
    });
  }

  it("1 topping → +2,50 €", () => {
    expect(priceWithToppings([])).toBe(2000);
    expect(priceWithToppings(["oreo"])).toBe(2250);
  });

  it("2 toppings → +5,00 €", () => {
    expect(priceWithToppings(["oreo", "kinder-bueno"])).toBe(2500);
  });

  it("3 toppings → +7,50 €", () => {
    expect(priceWithToppings(["oreo", "kinder-bueno", "fresas"])).toBe(2750);
  });

  it("los toppings a 2,50 € pueden hacer superar el umbral de señal de 40 €", () => {
    // Pastel clásico 20-22 personas · 1 disco = 39 € → sin señal.
    // Con 1 topping (2,50 €) el total pasa a 41,50 € → señal del 30 %.
    const base = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "20-22-1d",
      flavorId: "chocolate",
      toppingIds: [],
      extraIds: [],
    })!;
    expect(computeDeposit(base).depositRequired).toBe(false);
    const conTopping = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "20-22-1d",
      flavorId: "chocolate",
      toppingIds: ["fresas"],
      extraIds: [],
    })!;
    expect(conTopping).toBe(4150);
    expect(computeDeposit(conTopping).depositRequired).toBe(true);
  });

  it("excepción de carta: suplemento 6 € en tres leches de 28–30 porciones", () => {
    expect(getToppingPriceCents("tres-leches", "5-6")).toBe(250);
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
    // 2900 (kinder bueno mediano) + 250 topping + 200 dedicatoria = 3350
    expect(item?.unitPriceCents).toBe(3350);
    expect(item?.totalCents).toBe(6700);
  });

  it("conserva el topping personalizado y la imagen de referencia en el artículo", () => {
    const item = buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        flavorId: "vainilla",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco (8 cm)" },
        flavor: { id: "vainilla", label: "Vainilla" },
        toppings: [],
        customToppingRequest: "Ferrero Rocher",
        extras: [],
        referenceImageId: "img-123",
      },
      quantity: 1,
    });
    expect(item?.customization.customToppingRequest).toBe("Ferrero Rocher");
    expect(item?.customization.referenceImageId).toBe("img-123");
    // El topping personalizado NO se cobra automáticamente.
    expect(item?.unitPriceCents).toBe(2000);
  });
});

describe("topping fuera de catálogo y extras pendientes", () => {
  function itemWith(customization: Partial<OrderItem["customization"]>): OrderItem {
    return buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        flavorId: "chocolate",
        toppingIds: ["oreo"],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco (8 cm)" },
        flavor: { id: "chocolate", label: "Chocolate" },
        toppings: [{ id: "oreo", label: "Oreo" }],
        extras: [],
        ...customization,
      },
      quantity: 1,
    })!;
  }

  it("un topping solicitado NO suma importe automáticamente", () => {
    const sinPeticion = itemWith({});
    const conPeticion = itemWith({ customToppingRequest: "Ferrero Rocher" });
    // 2000 base + 250 del topping de catálogo, en ambos casos.
    expect(sinPeticion.unitPriceCents).toBe(2250);
    expect(conPeticion.unitPriceCents).toBe(2250);
  });

  it("marca el pedido como pendiente de confirmar extras", () => {
    expect(computeOrderPricing([itemWith({})], 0).hasPendingExtras).toBeUndefined();
    expect(
      computeOrderPricing([itemWith({ customToppingRequest: "Ferrero Rocher" })], 0)
        .hasPendingExtras
    ).toBe(true);
    expect(
      computeOrderPricing([itemWith({ notes: "Dos sabores de bizcocho" })], 0)
        .hasPendingExtras
    ).toBe(true);
    expect(
      computeOrderPricing([itemWith({ referenceImageId: "img-1" })], 0).hasPendingExtras
    ).toBe(true);
  });

  it("con extras pendientes el total actual y la señal se siguen calculando", () => {
    const pricing = computeOrderPricing([makeItem(6000)], 0);
    expect(pricing.totalCents).toBe(6000);
    expect(pricing.depositRequired).toBe(true);
  });
});

describe("tartas a medida (personalizada y fondant)", () => {
  it("ambas son solo para particulares y sin precio automático", () => {
    for (const id of ["pastel-personalizado", "pastel-fondant"]) {
      const product = getProduct(id)!;
      expect(product.pricingType).toBe("quote");
      expect(product.availableFor).toEqual(["individual"]);
      expect(product.requiresReferenceImage).toBe(true);
    }
    const business = getProductsFor("business").map((p) => p.id);
    expect(business).not.toContain("pastel-personalizado");
    expect(business).not.toContain("pastel-fondant");
  });

  it("la tarta personalizada no obtiene precio automático", () => {
    const item = buildOrderItem({
      id: "c1",
      selection: {
        productId: "pastel-personalizado",
        customerType: "individual",
        sizeId: "10-12",
        flavorId: "vainilla",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "10-12", label: "10–12 personas (aprox.)" },
        toppings: [],
        extras: [],
        designDescription: "Tarta con dibujo de unicornio y colores pastel",
        referenceImageId: "img-ref",
      },
      quantity: 1,
    });
    expect(item?.requiresQuote).toBe(true);
    const pricing = computeOrderPricing([item!], 0);
    expect(pricing.pendingQuote).toBe(true);
    expect(pricing.depositRequired).toBe(false);
  });
});

describe("fondant (presupuesto manual)", () => {
  const fondantSelection = {
    productId: "pastel-fondant",
    customerType: "individual" as const,
    sizeId: "10-12",
    flavorId: "vainilla",
    toppingIds: [],
    extraIds: [],
  };
  const fondantCustomization = {
    size: { id: "10-12", label: "10–12 personas (aprox.)" },
    flavor: { id: "vainilla", label: "Vainilla" },
    toppings: [],
    extras: [],
    designDescription: "Tarta de dos pisos con flores moradas y topper dorado",
  };

  it("no obtiene precio automático: requiresQuote y sin importe", () => {
    const item = buildOrderItem({
      id: "f1",
      selection: fondantSelection,
      customization: fondantCustomization,
      quantity: 1,
    });
    expect(item?.requiresQuote).toBe(true);
    expect(item?.unitPriceCents).toBe(0);
  });

  it("un pedido con fondant queda pendiente de presupuesto y SIN señal", () => {
    const fondant = buildOrderItem({
      id: "f1",
      selection: fondantSelection,
      customization: fondantCustomization,
      quantity: 1,
    })!;
    const pricing = computeOrderPricing([fondant], 0);
    expect(pricing.pendingQuote).toBe(true);
    expect(pricing.subtotalCents).toBe(0);
    expect(pricing.depositRequired).toBe(false);
    expect(pricing.depositCents).toBe(0);
  });

  it("pedido mixto: subtotal solo de artículos con precio, sin señal hasta presupuestar", () => {
    const fondant = buildOrderItem({
      id: "f1",
      selection: fondantSelection,
      customization: fondantCustomization,
      quantity: 1,
    })!;
    const pricing = computeOrderPricing([fondant, makeItem(5500)], 0);
    expect(pricing.subtotalCents).toBe(5500);
    expect(pricing.pendingQuote).toBe(true);
    expect(pricing.depositRequired).toBe(false);
  });

  it("al introducir el presupuesto, el total y la señal se calculan con normalidad", () => {
    const fondant = buildOrderItem({
      id: "f1",
      selection: fondantSelection,
      customization: fondantCustomization,
      quantity: 1,
    })!;
    const pricing = computeOrderPricing([fondant], 0, 12000);
    expect(pricing.pendingQuote).toBe(false);
    expect(pricing.quotedPriceCents).toBe(12000);
    expect(pricing.totalCents).toBe(12000);
    expect(pricing.depositRequired).toBe(true);
    expect(pricing.depositCents).toBe(3600);
    expect(pricing.remainingCents).toBe(8400);
  });
});

describe("velas (1 € por unidad, confirmado 23/08/2026)", () => {
  function cakeWithCandles(candleQuantity: number | undefined) {
    return buildOrderItem({
      id: "v",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        flavorId: "chocolate",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco (8 cm)" },
        flavor: { id: "chocolate", label: "Chocolate" },
        toppings: [],
        extras: [],
        candleQuantity,
      },
      quantity: 1,
    })!;
  }

  it("0 velas no suman nada", () => {
    expect(computeCandlesCents(0)).toBe(0);
    expect(computeCandlesCents(undefined)).toBe(0);
    expect(cakeWithCandles(0).candlesCents).toBeUndefined();
    expect(cakeWithCandles(0).totalCents).toBe(2000);
  });

  it("1, 3 y 10 velas cuestan 1, 3 y 10 €", () => {
    expect(computeCandlesCents(1)).toBe(100);
    expect(computeCandlesCents(3)).toBe(300);
    expect(computeCandlesCents(10)).toBe(1000);
  });

  it("no acepta cantidades negativas ni decimales", () => {
    expect(computeCandlesCents(-5)).toBe(0);
    expect(computeCandlesCents(2.7)).toBe(200);
  });

  it("tarta + toppings + velas se suman correctamente", () => {
    // Base 39 € (20-22 personas, 1 disco) + 2 toppings (5 €) + 3 velas (3 €).
    const item = buildOrderItem({
      id: "v2",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "20-22-1d",
        flavorId: "chocolate",
        toppingIds: ["oreo", "fresas"],
        extraIds: [],
      },
      customization: {
        size: { id: "20-22-1d", label: "20–22 personas · 1 disco" },
        flavor: { id: "chocolate", label: "Chocolate" },
        toppings: [
          { id: "oreo", label: "Oreo" },
          { id: "fresas", label: "Fresas" },
        ],
        extras: [],
        candleQuantity: 3,
      },
      quantity: 1,
    })!;
    expect(item.unitPriceCents).toBe(4400); // 3900 + 500 de toppings
    expect(item.candlesCents).toBe(300);
    expect(item.totalCents).toBe(4700);
    const pricing = computeOrderPricing([item], 0);
    expect(pricing.subtotalCents).toBe(4700);
    expect(pricing.candlesCents).toBe(300);
  });

  it("las velas pueden hacer superar el umbral de señal de 40 €", () => {
    // 39 € de tarta: sin señal. Con 2 velas (2 €) el total llega a 41 €.
    const sinVelas = computeOrderPricing([cakeWithCandles(0)], 0);
    expect(sinVelas.depositRequired).toBe(false);
    const item = buildOrderItem({
      id: "v3",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "20-22-1d",
        flavorId: "chocolate",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "20-22-1d", label: "20–22 personas · 1 disco" },
        toppings: [],
        extras: [],
        candleQuantity: 2,
      },
      quantity: 1,
    })!;
    const pricing = computeOrderPricing([item], 0);
    expect(pricing.totalCents).toBe(4100);
    expect(pricing.depositRequired).toBe(true);
    expect(pricing.depositCents).toBe(1230);
  });

  it("en tartas a presupuestar las velas se cobran pero la tarta sigue pendiente", () => {
    const item = buildOrderItem({
      id: "v4",
      selection: {
        productId: "pastel-fondant",
        customerType: "individual",
        sizeId: "10-12-2d",
        flavorId: "vainilla",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "10-12-2d", label: "10–12 personas · 2 discos (13 cm)" },
        toppings: [],
        extras: [],
        designDescription: "Tarta de dos pisos forrada en fondant azul",
        candleQuantity: 3,
      },
      quantity: 1,
    })!;
    expect(item.requiresQuote).toBe(true);
    expect(item.unitPriceCents).toBe(0);
    expect(item.candlesCents).toBe(300);
    expect(item.totalCents).toBe(300); // solo las velas

    const pricing = computeOrderPricing([item], 0);
    expect(pricing.pendingQuote).toBe(true);
    expect(pricing.candlesCents).toBe(300);
    expect(pricing.subtotalCents).toBe(300);
    // No hay señal mientras la tarta esté sin presupuestar.
    expect(pricing.depositRequired).toBe(false);
  });
});

describe("tartas a medida: selección de discos", () => {
  it("personalizada y fondant ofrecen la matriz de personas × discos", () => {
    for (const id of ["pastel-personalizado", "pastel-fondant"]) {
      const sizes = getSizesFor(getProduct(id)!, "individual");
      // 4 rangos de personas × 3 alturas de disco.
      expect(sizes).toHaveLength(12);
      expect(sizes.map((s) => s.id)).toContain("10-12-2d");
      // Sin precio automático: los importes no se usan.
      expect(getProduct(id)!.pricingType).toBe("quote");
    }
  });

  it("los discos reutilizan las dimensiones ya confirmadas del catálogo", () => {
    const sizes = getSizesFor(getProduct("pastel-fondant")!, "individual");
    const size = sizes.find((s) => s.id === "4-6-3d")!;
    expect(size.servings).toBe("4–6 personas");
    expect(size.label).toContain("3 discos");
    expect(size.label).toContain("20");
  });
});

describe("relleno Bariloche", () => {
  it("el relleno se llama Bariloche conservando su id", () => {
    const bariloche = CAKE_FILLINGS.find((f) => f.id === "dulce-de-leche-chocolate");
    expect(bariloche?.label).toBe("Bariloche");
  });

  it("ningún relleno se llama ya «Dulce de leche con chocolate»", () => {
    expect(CAKE_FILLINGS.map((f) => f.label)).not.toContain(
      "Dulce de leche con chocolate"
    );
  });
});
