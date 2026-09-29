import { describe, expect, it } from "vitest";
import {
  buildOrderItem,
  computeBalanceDueCents,
  computeOverpaidCents,
  computeCandlesCents,
  describeCandleLines,
  getNumberCandleUnitCents,
  normalizeCandleDigits,
  resolveCandleSelection,
  resolveCandleQuantity,
  computeDeposit,
  computeOrderPackagingCents,
  computeOrderPricing,
  computeUnitPriceCents,
  getToppingPriceCents,
} from "./pricing";
import {
  CAKE_FILLINGS,
  getMenuBasePriceCents,
  getPackagingCents,
  getProduct,
  requiresBox,
  getProductsFor,
  getSizesFor,
  getUnitBasePriceCents,
} from "./catalog";
import {
  CAKE_BOX_PRICE_CENTS,
  CAKE_FILLING_SURCHARGE_CENTS,
  CANDLE_UNIT_PRICE_CENTS,
  EXTRAS,
  MAX_CANDLE_DIGITS,
  MAX_SPARKLERS,
  NUMBER_SPARKLER_PRICE_CENTS,
  PLAIN_SPARKLER_PRICE_CENTS,
  SPONGE_FLAVOR_SURCHARGE_CENTS,
  URGENT_ORDER_SURCHARGE_CENTS,
} from "@/config/business";
import { formatEuros } from "./money";
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

  // 20 € de carta + la caja, que desde el 20/09/2026 va dentro del precio.
  const BASE_4_6_1D = 2000 + CAKE_BOX_PRICE_CENTS;

  it("1 topping → +2,50 €", () => {
    expect(priceWithToppings([])).toBe(BASE_4_6_1D);
    expect(priceWithToppings(["oreo"])).toBe(BASE_4_6_1D + 250);
  });

  it("2 toppings → +5,00 €", () => {
    expect(priceWithToppings(["oreo", "kinder-bueno"])).toBe(BASE_4_6_1D + 500);
  });

  it("3 toppings → +7,50 €", () => {
    expect(priceWithToppings(["oreo", "kinder-bueno", "fresas"])).toBe(
      BASE_4_6_1D + 750
    );
  });

  it("los toppings a 2,50 € pueden hacer superar el umbral de señal de 40 €", () => {
    // Tarta clásica 10-12 personas · 2 discos = 38 € de carta. Con la caja
    // (0,99 €) son 38,99 €: por debajo del umbral, sin señal. Un topping la
    // lleva a 41,49 € y ya toca señal del 30 %.
    const sin = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "10-12-2d",
      flavorId: "chocolate",
      toppingIds: [],
      extraIds: [],
    })!;
    expect(sin).toBe(3800 + CAKE_BOX_PRICE_CENTS);
    expect(computeDeposit(sin).depositRequired).toBe(false);
    const conTopping = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "10-12-2d",
      flavorId: "chocolate",
      toppingIds: ["fresas"],
      extraIds: [],
    })!;
    expect(conTopping).toBe(3800 + CAKE_BOX_PRICE_CENTS + 250);
    expect(computeDeposit(conTopping).depositRequired).toBe(true);
  });

  it("la tarta de 39 € se queda en 39,99 € y NO pide señal", () => {
    // Justo por debajo del umbral («más de 40 €»). Está escrito porque es el
    // caso que se rompería si alguien volviera a subir la caja a 1,99 €.
    const tarta = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "20-22-1d",
      flavorId: "chocolate",
      toppingIds: [],
      extraIds: [],
    })!;
    expect(tarta).toBe(3900 + CAKE_BOX_PRICE_CENTS);
    expect(tarta).toBe(3999);
    expect(computeDeposit(tarta).depositRequired).toBe(false);
  });

  it("excepción de carta: suplemento 6 € en tres leches de 28–30 porciones", () => {
    expect(getToppingPriceCents("tres-leches", "5-6")).toBe(250);
    expect(getToppingPriceCents("tres-leches", "28-30")).toBe(600);
  });
});

describe("precios de catálogo (transcritos de las cartas)", () => {
  it("pastel clásico 4–6 personas / 1 disco = 20 €", () => {
    expect(getMenuBasePriceCents("pastel-clasico", "individual", "4-6-1d")).toBe(2000);
  });

  it("pastel buttercream 20–22 personas / 3 discos = 82 €", () => {
    expect(getMenuBasePriceCents("pastel-buttercream", "individual", "20-22-3d")).toBe(8200);
  });

  it("cheesecake pistacho particular grande = 43 €, empresa grande = 45 €", () => {
    expect(getMenuBasePriceCents("cheesecake", "individual", "14-16", "pistacho")).toBe(4300);
    expect(getMenuBasePriceCents("cheesecake", "business", "14-16", "pistacho")).toBe(4500);
  });

  it("tres leches particular 28–30 porciones = 59 €, empresa 8 porciones = 18 €", () => {
    expect(getMenuBasePriceCents("tres-leches", "individual", "28-30")).toBe(5900);
    expect(getMenuBasePriceCents("tres-leches", "business", "8")).toBe(1800);
  });

  it("combinaciones inexistentes devuelven null", () => {
    expect(getUnitBasePriceCents("pastel-clasico", "business", "4-6-1d")).toBeNull();
    expect(getUnitBasePriceCents("cheesecake", "individual", "4-6")).toBeNull(); // sin sabor
    expect(getUnitBasePriceCents("cheesecake", "individual", "4-6", "inexistente")).toBeNull();
  });
});

describe("caja de transporte (confirmada 20/09/2026)", () => {
  it("toda tarta con precio automático la lleva dentro del precio", () => {
    expect(getUnitBasePriceCents("pastel-clasico", "individual", "4-6-1d")).toBe(
      2000 + CAKE_BOX_PRICE_CENTS
    );
    expect(getUnitBasePriceCents("cheesecake", "individual", "14-16", "pistacho")).toBe(
      4300 + CAKE_BOX_PRICE_CENTS
    );
    expect(getUnitBasePriceCents("tres-leches", "business", "8")).toBe(
      1800 + CAKE_BOX_PRICE_CENTS
    );
  });

  it("los aperitivos no la llevan: van en bandeja", () => {
    const alfajores = getProduct("mini-alfajores")!;
    expect(getPackagingCents(alfajores)).toBe(0);
    const sandwich = getProduct("mini-sandwich-huevo")!;
    expect(getPackagingCents(sandwich)).toBe(0);
  });

  it("las tartas a presupuestar tampoco: la caja va dentro del presupuesto", () => {
    expect(getPackagingCents(getProduct("pastel-fondant")!)).toBe(0);
    expect(getPackagingCents(getProduct("pastel-personalizado")!)).toBe(0);
  });

  it("se cobra una caja por tarta, no una por pedido", () => {
    const item = buildOrderItem({
      id: "i",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        flavorId: "chocolate",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        toppings: [],
        extras: [],
      },
      quantity: 3,
    })!;
    expect(computeOrderPackagingCents([item])).toBe(CAKE_BOX_PRICE_CENTS * 3);
  });
});

describe("suplementos de bizcocho y relleno (confirmados 20/09/2026)", () => {
  const BASE = 2000 + CAKE_BOX_PRICE_CENTS;

  function price(flavorId: string, fillingId?: string): number | null {
    return computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "4-6-1d",
      flavorId,
      fillingId,
      toppingIds: [],
      extraIds: [],
    });
  }

  it("los tres bizcochos marcados por Dulce Flor no suman nada", () => {
    for (const id of ["chocolate", "vainilla", "tres-leches"]) {
      expect(price(id)).toBe(BASE);
    }
  });

  it("el resto de bizcochos suma 2,90 €", () => {
    for (const id of ["zanahoria", "red-velvet", "coco", "naranja", "marmoleado", "limon"]) {
      expect(price(id)).toBe(BASE + SPONGE_FLAVOR_SURCHARGE_CENTS);
    }
  });

  it("los tres rellenos marcados no suman nada", () => {
    for (const id of ["dulce-de-leche", "chocolate", "dulce-de-leche-chocolate"]) {
      expect(price("chocolate", id)).toBe(BASE);
    }
  });

  it("el resto de rellenos suma 2,50 €", () => {
    for (const id of ["nata-con-frutas", "mus-oreo", "nutella", "fresa", "mus-lotus", "mus-cafe"]) {
      expect(price("chocolate", id)).toBe(BASE + CAKE_FILLING_SURCHARGE_CENTS);
    }
  });

  it("bizcocho y relleno con suplemento se acumulan", () => {
    expect(price("limon", "nutella")).toBe(
      BASE + SPONGE_FLAVOR_SURCHARGE_CENTS + CAKE_FILLING_SURCHARGE_CENTS
    );
  });

  it("el sabor del cheesecake NO lleva suplemento: ya determina el precio", () => {
    const conSabor = computeUnitPriceCents({
      productId: "cheesecake",
      customerType: "individual",
      sizeId: "14-16",
      flavorId: "pistacho",
      toppingIds: [],
      extraIds: [],
    });
    expect(conSabor).toBe(4300 + CAKE_BOX_PRICE_CENTS);
  });

  it("las tartas a presupuestar no cobran suplementos: el precio va aparte", () => {
    const item = buildOrderItem({
      id: "i",
      selection: {
        productId: "pastel-fondant",
        customerType: "individual",
        sizeId: "4-6-1d",
        flavorId: "limon",
        fillingId: "nutella",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        flavor: { id: "limon", label: "Limón" },
        filling: { id: "nutella", label: "Nutella" },
        toppings: [],
        extras: [],
      },
      quantity: 1,
    })!;
    expect(item.requiresQuote).toBe(true);
    expect(item.unitPriceCents).toBe(0);
  });

  it("un borrador antiguo sin fillingId en la selección sigue cobrando el relleno", () => {
    // Los borradores guardados antes de que los rellenos tuvieran suplemento
    // solo llevan el relleno en la personalización: buildOrderItem lo rescata.
    const item = buildOrderItem({
      id: "i",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        flavorId: "chocolate",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        flavor: { id: "chocolate", label: "Chocolate" },
        filling: { id: "nutella", label: "Nutella" },
        toppings: [],
        extras: [],
      },
      quantity: 1,
    })!;
    expect(item.unitPriceCents).toBe(BASE + CAKE_FILLING_SURCHARGE_CENTS);
  });
});

describe("suplemento por pedido urgente (confirmado 20/09/2026: 5 €)", () => {
  it("un pedido con margen normal no lo lleva", () => {
    const pricing = computeOrderPricing([makeItem(2000)], 0, null, false);
    expect(pricing.urgencySurchargeCents).toBeUndefined();
    expect(pricing.totalCents).toBe(2000);
  });

  it("un pedido urgente suma 5 € al total, una sola vez", () => {
    const pricing = computeOrderPricing([makeItem(2000, 3)], 0, null, true);
    expect(pricing.urgencySurchargeCents).toBe(URGENT_ORDER_SURCHARGE_CENTS);
    expect(pricing.subtotalCents).toBe(6000);
    expect(pricing.totalCents).toBe(6000 + URGENT_ORDER_SURCHARGE_CENTS);
  });

  it("el suplemento cuenta para el umbral y el cálculo de la señal", () => {
    // 38 € de tarta no llegan al umbral de 40 €; con la urgencia, sí.
    const normal = computeOrderPricing([makeItem(3800)], 0, null, false);
    expect(normal.depositRequired).toBe(false);
    const urgente = computeOrderPricing([makeItem(3800)], 0, null, true);
    expect(urgente.totalCents).toBe(4300);
    expect(urgente.depositRequired).toBe(true);
    expect(urgente.depositCents).toBe(1290);
  });

  it("con tarta a presupuestar se suma igual, pero sigue sin calcularse señal", () => {
    const fondant: OrderItem = {
      ...makeItem(0),
      productId: "pastel-fondant",
      requiresQuote: true,
      totalCents: 0,
    };
    const pricing = computeOrderPricing([fondant], 0, null, true);
    expect(pricing.pendingQuote).toBe(true);
    expect(pricing.totalCents).toBe(URGENT_ORDER_SURCHARGE_CENTS);
    expect(pricing.depositRequired).toBe(false);
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
    // 2900 (kinder bueno mediano) + caja + 250 topping + 250 dedicatoria
    const unit = 2900 + CAKE_BOX_PRICE_CENTS + 250 + EXTRAS.DEDICATION_PRICE_CENTS;
    expect(item?.unitPriceCents).toBe(unit);
    expect(item?.totalCents).toBe(unit * 2);
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
    expect(item?.unitPriceCents).toBe(2000 + CAKE_BOX_PRICE_CENTS);
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
    // 2000 base + caja + 250 del topping de catálogo, en ambos casos.
    const unit = 2000 + CAKE_BOX_PRICE_CENTS + 250;
    expect(sinPeticion.unitPriceCents).toBe(unit);
    expect(conPeticion.unitPriceCents).toBe(unit);
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
    expect(computeCandlesCents({ candleQuantity: 0 })).toBe(0);
    expect(computeCandlesCents({})).toBe(0);
    expect(cakeWithCandles(0).candlesCents).toBeUndefined();
    expect(cakeWithCandles(0).totalCents).toBe(2000 + CAKE_BOX_PRICE_CENTS);
  });

  it("1, 3 y 10 velas cuestan 1, 3 y 10 €", () => {
    expect(computeCandlesCents({ candleQuantity: 1 })).toBe(100);
    expect(computeCandlesCents({ candleQuantity: 3 })).toBe(300);
    expect(computeCandlesCents({ candleQuantity: 10 })).toBe(1000);
  });

  it("no acepta cantidades negativas ni decimales", () => {
    expect(computeCandlesCents({ candleQuantity: -5 })).toBe(0);
    expect(computeCandlesCents({ candleQuantity: 2.7 })).toBe(200);
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
    // 3900 de carta + caja + 500 de toppings
    const unit = 3900 + CAKE_BOX_PRICE_CENTS + 500;
    expect(item.unitPriceCents).toBe(unit);
    expect(item.candlesCents).toBe(300);
    expect(item.totalCents).toBe(unit + 300);
    const pricing = computeOrderPricing([item], 0);
    expect(pricing.subtotalCents).toBe(unit + 300);
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
    expect(pricing.totalCents).toBe(3900 + CAKE_BOX_PRICE_CENTS + 200);
    expect(pricing.depositRequired).toBe(true);
    // Derivada del total, no escrita a mano: si cambia el precio de la caja
    // este test debe seguir comprobando la REGLA (el 30 %), no una cifra.
    expect(pricing.depositCents).toBe(Math.round(pricing.totalCents * 0.3));
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

describe("papel comestible en cheesecake (confirmado 24/08/2026)", () => {
  it("el cheesecake ofrece imagen con papel comestible", () => {
    const cheesecake = getProduct("cheesecake");
    const paper = cheesecake?.extras.find((e) => e.id === "papel-comestible");
    expect(paper).toBeDefined();
    expect(paper?.priceCents).toBe(EXTRAS.EDIBLE_PAPER_PRICE_CENTS);
  });

  it("sigue ofreciendo la dedicatoria, sin duplicar extras", () => {
    const ids = getProduct("cheesecake")?.extras.map((e) => e.id) ?? [];
    expect(ids).toContain("dedicatoria");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el papel comestible suma 7 € al cheesecake sin alterar la base", () => {
    const base = getUnitBasePriceCents(
      "cheesecake",
      "individual",
      "10-12",
      "kinder-bueno"
    )!;
    const item = buildOrderItem({
      id: "x",
      selection: {
        productId: "cheesecake",
        customerType: "individual",
        sizeId: "10-12",
        flavorId: "kinder-bueno",
        toppingIds: [],
        extraIds: ["papel-comestible"],
      },
      customization: {
        size: { id: "10-12", label: "10–12 porciones aprox." },
        flavor: { id: "kinder-bueno", label: "Kinder Bueno" },
        toppings: [],
        extras: [
          {
            id: "papel-comestible",
            label: "Imagen con papel comestible",
            priceCents: EXTRAS.EDIBLE_PAPER_PRICE_CENTS,
          },
        ],
      },
      quantity: 1,
    });
    expect(item?.unitPriceCents).toBe(base + EXTRAS.EDIBLE_PAPER_PRICE_CENTS);
  });
});

describe("velas de números (cifra elegida por el cliente)", () => {
  function cakeWithDigits(candleDigits: string) {
    return buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        filling: { id: "nata", label: "Nata" },
        toppings: [],
        extras: [],
        candleDigits,
      },
      quantity: 1,
    });
  }

  it("cada dígito es una vela: «25» son dos velas, 2,00 €", () => {
    const item = cakeWithDigits("25");
    expect(item?.candlesCents).toBe(2 * CANDLE_UNIT_PRICE_CENTS);
  });

  it("se puede repetir el mismo número: «22» sigue siendo dos velas", () => {
    expect(cakeWithDigits("22")?.candlesCents).toBe(2 * CANDLE_UNIT_PRICE_CENTS);
  });

  it("conserva el orden de la cifra: «25» y «52» no son el mismo pedido", () => {
    expect(cakeWithDigits("25")?.customization.candleDigits).toBe("25");
    expect(cakeWithDigits("52")?.customization.candleDigits).toBe("52");
  });

  it("sin cifra no hay velas ni importe", () => {
    expect(cakeWithDigits("")?.candlesCents).toBeUndefined();
  });

  it("descarta lo que no sean dígitos en lugar de propagarlo", () => {
    expect(normalizeCandleDigits("2a5")).toBe("25");
    expect(normalizeCandleDigits("  ")).toBe("");
    expect(normalizeCandleDigits(undefined)).toBe("");
  });

  it("recorta la cifra al tope, sin cobrar de más", () => {
    const largo = "1".repeat(MAX_CANDLE_DIGITS + 5);
    expect(normalizeCandleDigits(largo)).toHaveLength(MAX_CANDLE_DIGITS);
    expect(cakeWithDigits(largo)?.candlesCents).toBe(
      MAX_CANDLE_DIGITS * CANDLE_UNIT_PRICE_CENTS
    );
  });

  it("los pedidos guardados antes de las velas de números siguen valiendo", () => {
    expect(resolveCandleQuantity({ candleQuantity: 3 })).toBe(3);
    expect(describeCandleLines({ candleQuantity: 3 })[0]).toContain("3 uds");
  });

  it("la cifra manda sobre una cantidad heredada que no coincida", () => {
    expect(resolveCandleQuantity({ candleDigits: "100", candleQuantity: 9 })).toBe(3);
  });

  it("el panel y WhatsApp describen la cifra igual", () => {
    const [linea] = describeCandleLines({ candleDigits: "25" });
    expect(linea).toContain("Velas de número");
    expect(linea).toContain("número 25");
    expect(linea).toContain(formatEuros(2 * CANDLE_UNIT_PRICE_CENTS));
    expect(describeCandleLines({})).toEqual([]);
  });

  it("una tarta a presupuestar cobra solo las velas, sin inventar total", () => {
    const item = buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-fondant",
        customerType: "individual",
        sizeId: "4-6-1d",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        toppings: [],
        extras: [],
        candleDigits: "30",
        designDescription: "Tarta de fondant",
      },
      quantity: 1,
    });
    expect(item?.requiresQuote).toBe(true);
    expect(item?.unitPriceCents).toBe(0);
    expect(item?.totalCents).toBe(2 * CANDLE_UNIT_PRICE_CENTS);
  });
});

describe("bengalas (confirmado 24/08/2026)", () => {
  function cake(customization: Record<string, unknown>) {
    return buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "4-6-1d",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        filling: { id: "nata", label: "Nata" },
        toppings: [],
        extras: [],
        ...customization,
      },
      quantity: 1,
    });
  }

  it("la bengala de número cuesta 2 € y la vela 1 €", () => {
    expect(getNumberCandleUnitCents("vela")).toBe(CANDLE_UNIT_PRICE_CENTS);
    expect(getNumberCandleUnitCents("bengala")).toBe(NUMBER_SPARKLER_PRICE_CENTS);
    expect(NUMBER_SPARKLER_PRICE_CENTS).toBe(200);
  });

  it("sin acabado elegido se cobra como vela normal", () => {
    expect(getNumberCandleUnitCents(undefined)).toBe(CANDLE_UNIT_PRICE_CENTS);
    expect(cake({ candleDigits: "25" })?.candlesCents).toBe(200);
  });

  it("la misma cifra en bengala cuesta el doble", () => {
    const velas = cake({ candleDigits: "25", candleStyle: "vela" });
    const bengalas = cake({ candleDigits: "25", candleStyle: "bengala" });
    expect(velas?.candlesCents).toBe(2 * CANDLE_UNIT_PRICE_CENTS);
    expect(bengalas?.candlesCents).toBe(2 * NUMBER_SPARKLER_PRICE_CENTS);
  });

  it("la bengala suelta cuesta 1,80 € y no depende de la cifra", () => {
    expect(PLAIN_SPARKLER_PRICE_CENTS).toBe(180);
    expect(cake({ sparklerQuantity: 1 })?.candlesCents).toBe(180);
    expect(cake({ sparklerQuantity: 3 })?.candlesCents).toBe(540);
  });

  it("números y bengalas sueltas se suman como conceptos distintos", () => {
    const item = cake({
      candleDigits: "30",
      candleStyle: "bengala",
      sparklerQuantity: 2,
    });
    // 2 bengalas de número (4,00 €) + 2 bengalas sueltas (3,60 €)
    expect(item?.candlesCents).toBe(2 * 200 + 2 * 180);
  });

  it("el desglose separa cada concepto con su precio unitario", () => {
    const { numbers, sparklers, totalCents } = resolveCandleSelection({
      candleDigits: "18",
      candleStyle: "bengala",
      sparklerQuantity: 1,
    });
    expect(numbers).toMatchObject({ digits: "18", quantity: 2, style: "bengala", unitCents: 200, cents: 400 });
    expect(sparklers).toMatchObject({ quantity: 1, unitCents: 180, cents: 180 });
    expect(totalCents).toBe(580);
  });

  it("no acepta bengalas negativas ni decimales, y respeta el tope", () => {
    expect(cake({ sparklerQuantity: -4 })?.candlesCents).toBeUndefined();
    expect(cake({ sparklerQuantity: 2.9 })?.candlesCents).toBe(2 * PLAIN_SPARKLER_PRICE_CENTS);
    expect(cake({ sparklerQuantity: MAX_SPARKLERS + 10 })?.candlesCents).toBe(
      MAX_SPARKLERS * PLAIN_SPARKLER_PRICE_CENTS
    );
  });

  it("describe cada concepto en su propia línea", () => {
    const lineas = describeCandleLines({
      candleDigits: "40",
      candleStyle: "bengala",
      sparklerQuantity: 2,
    });
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toContain("Bengalas de número");
    expect(lineas[0]).toContain("número 40");
    expect(lineas[1]).toContain("Bengalas sueltas");
    expect(lineas[1]).toContain(formatEuros(2 * PLAIN_SPARKLER_PRICE_CENTS));
  });

  it("una tarta a presupuestar cobra las bengalas sin inventar el total", () => {
    const item = buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-fondant",
        customerType: "individual",
        sizeId: "4-6-1d",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "4-6-1d", label: "4–6 personas · 1 disco" },
        toppings: [],
        extras: [],
        candleDigits: "50",
        candleStyle: "bengala",
        sparklerQuantity: 1,
        designDescription: "Tarta de fondant",
      },
      quantity: 1,
    });
    expect(item?.requiresQuote).toBe(true);
    expect(item?.unitPriceCents).toBe(0);
    expect(item?.totalCents).toBe(2 * NUMBER_SPARKLER_PRICE_CENTS + PLAIN_SPARKLER_PRICE_CENTS);
  });

  it("las bengalas cuentan para la paga y señal como cualquier otro importe", () => {
    // 39 € de tarta + 3 bengalas de número (6 €) cruzan el umbral de 40 €.
    const item = buildOrderItem({
      id: "x",
      selection: {
        productId: "pastel-clasico",
        customerType: "individual",
        sizeId: "20-22-1d",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "20-22-1d", label: "20–22 personas · 1 disco" },
        filling: { id: "nata", label: "Nata" },
        toppings: [],
        extras: [],
        candleDigits: "100",
        candleStyle: "bengala",
      },
      quantity: 1,
    })!;
    const pricing = computeOrderPricing([item], 0);
    expect(pricing.candlesCents).toBe(3 * NUMBER_SPARKLER_PRICE_CENTS);
    expect(pricing.depositRequired).toBe(true);
  });
});

describe("resto por cobrar con señal (paga y señal flexible del kiosk)", () => {
  const base = { pendingQuote: undefined } as const;

  it("sin señal, el resto es el total entero", () => {
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, undefined)).toBe(4200);
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, 0)).toBe(4200);
  });

  it("con señal, resta lo ya cobrado", () => {
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, 2000)).toBe(2200);
  });

  it("una señal igual al total deja 0 por cobrar", () => {
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, 4200)).toBe(0);
  });

  it("nunca devuelve negativo aunque se pagara de más", () => {
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, 5000)).toBe(0);
  });

  it("ignora una señal negativa o con decimales imposibles", () => {
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, -100)).toBe(4200);
    expect(computeBalanceDueCents({ totalCents: 4200, ...base }, 19.9)).toBe(4200 - 19);
  });

  it("con tarta a presupuestar no se puede calcular el resto: null", () => {
    expect(
      computeBalanceDueCents({ totalCents: 300, pendingQuote: true }, 1000)
    ).toBe(null);
  });

  it("si se cobró de más (presupuesto cerró por debajo), hay que devolver", () => {
    // Señal de 100 € sobre una tarta que finalmente cuesta 60 €.
    const pricing = { totalCents: 6000, pendingQuote: undefined } as const;
    expect(computeBalanceDueCents(pricing, 10000)).toBe(0);
    expect(computeOverpaidCents(pricing, 10000)).toBe(4000);
  });

  it("sin sobrepago, la devolución es 0", () => {
    const pricing = { totalCents: 6000, pendingQuote: undefined } as const;
    expect(computeOverpaidCents(pricing, 2000)).toBe(0);
    expect(computeOverpaidCents(pricing, undefined)).toBe(0);
  });

  it("mientras el total no sea firme (pendingQuote) no se declara sobrepago", () => {
    expect(computeOverpaidCents({ totalCents: 300, pendingQuote: true }, 9000)).toBe(0);
  });
});

describe("extras actualizados el 20/09/2026", () => {
  it("dedicatoria 2,50 €, papel comestible 8 € y toppers 5 €", () => {
    const extras = getProduct("pastel-clasico")!.extras;
    const byId = Object.fromEntries(extras.map((e) => [e.id, e.priceCents]));
    expect(byId["dedicatoria"]).toBe(250);
    expect(byId["papel-comestible"]).toBe(800);
    expect(byId["toppers-6-figuras"]).toBe(500);
  });

  it("los toppers están en las tartas con precio, no en las de empresa a granel", () => {
    for (const id of ["pastel-clasico", "pastel-buttercream", "cheesecake", "tres-leches"]) {
      const ids = getProduct(id)!.extras.map((e) => e.id);
      expect(ids).toContain("toppers-6-figuras");
    }
  });

  it("elegir los tres extras suma 15,50 € al precio de la tarta", () => {
    const base = getUnitBasePriceCents("pastel-clasico", "individual", "4-6-1d")!;
    const conExtras = computeUnitPriceCents({
      productId: "pastel-clasico",
      customerType: "individual",
      sizeId: "4-6-1d",
      flavorId: "chocolate",
      toppingIds: [],
      extraIds: ["dedicatoria", "papel-comestible", "toppers-6-figuras"],
    });
    expect(conExtras).toBe(base + 250 + 800 + 500);
  });
});

describe("mini alfajores (confirmados 20/09/2026)", () => {
  const alfajores = getProduct("mini-alfajores")!;

  it("están en bocaditos dulces y para particulares y empresas", () => {
    expect(alfajores.category).toBe("aperitivos-dulces");
    expect(alfajores.availableFor).toEqual(["individual", "business"]);
  });

  it("25 unidades cuestan 12,50 € (0,50 €/ud)", () => {
    const unit = computeUnitPriceCents({
      productId: "mini-alfajores",
      customerType: "individual",
      sizeId: "25",
      toppingIds: [],
      extraIds: [],
      quantity: 25,
    });
    expect(unit).toBe(50);
    expect(unit! * 25).toBe(1250);
  });

  it("por debajo de 25 no hay tarifa: no se inventa un precio", () => {
    expect(
      computeUnitPriceCents({
        productId: "mini-alfajores",
        customerType: "individual",
        sizeId: "24",
        toppingIds: [],
        extraIds: [],
        quantity: 24,
      })
    ).toBeNull();
  });
});

describe("la caja de transporte (obligatoria, y sin precio a la vista)", () => {
  it("la llevan las tartas, también las que se presupuestan a mano", () => {
    // «Todo lo que sea tartas grandes igual que la personalizada.» En las de
    // presupuesto no suma importe aparte —va dentro de lo que se valora a
    // mano— pero la tarta sale en caja igual y hay que marcarla.
    for (const id of ["pastel-clasico", "pastel-buttercream", "pastel-fondant", "cheesecake"]) {
      const producto = getProduct(id)!;
      expect(requiresBox(producto)).toBe(true);
    }
  });

  it("NO la llevan los aperitivos ni lo que se vende por unidades", () => {
    // «En todo menos en los bocadillos pequeños»: van en bandeja.
    for (const id of ["mini-alfajores", "caja-desayuno"]) {
      const producto = getProduct(id);
      if (!producto) continue;
      expect(requiresBox(producto)).toBe(false);
    }
  });

  it("se cobra 0,99 € y va DENTRO del precio, nunca como línea aparte", () => {
    const producto = getProduct("pastel-clasico")!;
    expect(CAKE_BOX_PRICE_CENTS).toBe(99);
    expect(getPackagingCents(producto)).toBe(CAKE_BOX_PRICE_CENTS);

    const seleccion = {
      productId: "pastel-clasico",
      customerType: "individual" as const,
      sizeId: "10-12-2d",
      flavorId: "chocolate",
      toppingIds: [],
      extraIds: [],
    };
    // Lo que se enseña en la carta NO lleva caja; lo que se cobra, sí.
    expect(
      getMenuBasePriceCents("pastel-clasico", "individual", "10-12-2d", "chocolate")
    ).toBe(3800);
    expect(computeUnitPriceCents(seleccion)).toBe(3800 + CAKE_BOX_PRICE_CENTS);
  });

  it("en una tarta a presupuesto la caja no suma aparte", () => {
    // El precio entero lo pone Dulce Flor a mano y la caja ya va dentro:
    // sumarla aquí la cobraría dos veces.
    const fondant = getProduct("pastel-fondant")!;
    expect(requiresBox(fondant)).toBe(true);
    expect(getPackagingCents(fondant)).toBe(0);
  });
});
