import { describe, expect, it } from "vitest";
import {
  getMinimumQuantity,
  getProduct,
  getProductsFor,
  resolveQuantityTier,
  type CatalogProduct,
} from "./catalog";
import { buildOrderItem, computeOrderPricing, computeUnitPriceCents } from "./pricing";

/**
 * Tarifas confirmadas por Dulce Flor (WhatsApp, 21/08/2026), transcritas una
 * a una: [cantidad, precio unitario en céntimos]. OJO: los tramos NO son
 * iguales en todos los productos (empanadas 20/35/50, tequeños 15/30/50).
 */
const TARIFAS: Record<string, Array<[number, number]>> = {
  "mini-sandwich-cerdo-caramelizado": [[15, 145], [25, 125], [50, 100]],
  "mini-sandwich-royal-pollo": [[15, 130], [25, 115], [50, 99]],
  "mini-sandwich-jamon-tomate-queso": [[15, 125], [25, 110], [50, 90]],
  "mini-sandwich-huevo": [[15, 120], [25, 110], [50, 90]],
  "mini-sandwich-tocino-crujiente": [[15, 145], [25, 125], [50, 100]],
  "mini-sandwich-pollo-melocoton-jamon": [[15, 145], [25, 125], [50, 105]],
  "mini-pan-bacon-espinaca": [[15, 135], [25, 120], [50, 100]],
  "mini-pan-pollo-melocoton": [[15, 135], [25, 120], [50, 100]],
  "mini-pan-jamon-queso": [[15, 125], [25, 115], [50, 99]],
  "mini-pan-jamon-serrano": [[15, 135], [25, 120], [50, 100]],
  "mini-pan-pollo-mayonesa": [[15, 125], [25, 115], [50, 99]],
  "mini-pan-fuet": [[15, 115], [25, 100], [50, 90]],
  "mini-pan-cerdo-boniato": [[15, 145], [25, 125], [50, 100]],
  "mini-pan-cerdo-caramelizado": [[15, 135], [25, 120], [50, 100]],
  "mini-tequenos-jamon-queso": [[15, 120], [30, 100], [50, 95]],
  "mini-tequenos-queso": [[15, 110], [30, 99], [50, 90]],
  "mini-empanadas-carne": [[20, 135], [35, 115], [50, 100]],
  "mini-empanadas-pollo": [[20, 125], [35, 105], [50, 95]],
  "mini-empanadas-atun": [[20, 120], [35, 105], [50, 95]],
};

function unitPrice(productId: string, quantity: number): number | null {
  return computeUnitPriceCents({
    productId,
    customerType: "individual",
    sizeId: "",
    toppingIds: [],
    extraIds: [],
    quantity,
  });
}

function total(productId: string, quantity: number): number | null {
  const item = buildOrderItem({
    id: "t",
    selection: {
      productId,
      customerType: "individual",
      sizeId: String(quantity),
      toppingIds: [],
      extraIds: [],
    },
    customization: {
      size: { id: String(quantity), label: `${quantity} unidades` },
      toppings: [],
      extras: [],
    },
    quantity,
  });
  return item?.totalCents ?? null;
}

describe("aperitivos salados: tarifas por volumen", () => {
  it("los 19 productos del catálogo tienen exactamente las tarifas confirmadas", () => {
    expect(Object.keys(TARIFAS)).toHaveLength(19);
    for (const [id, tramos] of Object.entries(TARIFAS)) {
      const product = getProduct(id);
      expect(product, `falta el producto ${id}`).toBeDefined();
      // Los tramos del catálogo coinciden uno a uno con los confirmados.
      expect(
        product!.quantityTiers?.map((t) => [t.minQuantity, t.unitPriceCents]),
        `tramos de ${id}`
      ).toEqual(tramos);
      for (const [cantidad, precio] of tramos) {
        expect(unitPrice(id, cantidad), `${id} @${cantidad}`).toBe(precio);
      }
    }
  });

  it("los tramos que no empiezan en 15 se respetan (empanadas 20, tequeños 30)", () => {
    // Empanadas: mínimo 20 uds; por debajo no hay tarifa.
    expect(getMinimumQuantity(getProduct("mini-empanadas-carne")!)).toBe(20);
    expect(unitPrice("mini-empanadas-carne", 19)).toBeNull();
    expect(unitPrice("mini-empanadas-carne", 20)).toBe(135);
    expect(unitPrice("mini-empanadas-carne", 34)).toBe(135); // sigue en el tramo de 20
    expect(unitPrice("mini-empanadas-carne", 35)).toBe(115);
    // Tequeños: el tramo intermedio es 30, no 25.
    expect(unitPrice("mini-tequenos-queso", 25)).toBe(110); // aún tramo de 15
    expect(unitPrice("mini-tequenos-queso", 30)).toBe(99);
  });

  it("casos de ejemplo: cerdo caramelizado", () => {
    expect(total("mini-sandwich-cerdo-caramelizado", 15)).toBe(2175); // 21,75 €
    expect(total("mini-sandwich-cerdo-caramelizado", 25)).toBe(3125); // 31,25 €
    expect(total("mini-sandwich-cerdo-caramelizado", 50)).toBe(5000); // 50,00 €
  });

  it("casos de ejemplo: Royal de pollo", () => {
    expect(total("mini-sandwich-royal-pollo", 15)).toBe(1950); // 19,50 €
    expect(total("mini-sandwich-royal-pollo", 25)).toBe(2875); // 28,75 €
    expect(total("mini-sandwich-royal-pollo", 50)).toBe(4950); // 49,50 €
  });

  it("casos de ejemplo: fuet", () => {
    expect(total("mini-pan-fuet", 15)).toBe(1725); // 17,25 €
    expect(total("mini-pan-fuet", 25)).toBe(2500); // 25,00 €
    expect(total("mini-pan-fuet", 50)).toBe(4500); // 45,00 €
  });

  it("casos de ejemplo: cerdo y boniato", () => {
    expect(total("mini-pan-cerdo-boniato", 15)).toBe(2175);
    expect(total("mini-pan-cerdo-boniato", 25)).toBe(3125);
    expect(total("mini-pan-cerdo-boniato", 50)).toBe(5000);
  });

  it("cantidades intermedias aplican el tramo inferior, sin inventar tarifas", () => {
    // 18 uds → sigue en el tramo de 15; 30 → tramo de 25; 80 → tramo 50+.
    expect(unitPrice("mini-pan-fuet", 18)).toBe(115);
    expect(unitPrice("mini-pan-fuet", 30)).toBe(100);
    expect(unitPrice("mini-pan-fuet", 80)).toBe(90);
  });

  it("por debajo del pedido mínimo no hay precio (no se inventa)", () => {
    expect(unitPrice("mini-pan-fuet", 14)).toBeNull();
    expect(unitPrice("mini-pan-fuet", 0)).toBeNull();
    expect(total("mini-pan-fuet", 10)).toBeNull();
  });

  it("el pedido mínimo es de 15 unidades", () => {
    const product = getProduct("mini-pan-fuet")!;
    expect(getMinimumQuantity(product)).toBe(15);
    expect(resolveQuantityTier(product, 50)?.open).toBe(true);
  });

  it("los aperitivos están disponibles para particulares y empresas", () => {
    for (const id of Object.keys(TARIFAS)) {
      expect(getProduct(id)!.availableFor).toEqual(["individual", "business"]);
    }
  });

  it("el subtotal del pedido usa el precio del tramo", () => {
    const item = buildOrderItem({
      id: "a",
      selection: {
        productId: "mini-sandwich-huevo",
        customerType: "individual",
        sizeId: "25",
        toppingIds: [],
        extraIds: [],
      },
      customization: {
        size: { id: "25", label: "25 unidades" },
        toppings: [],
        extras: [],
      },
      quantity: 25,
    })!;
    const pricing = computeOrderPricing([item], 0);
    expect(pricing.subtotalCents).toBe(2750); // 25 × 1,10 €
    // 27,50 € no supera los 40 € → sin señal.
    expect(pricing.depositRequired).toBe(false);
  });
});

describe("desayunos y copas personalizadas", () => {
  const gifts: CatalogProduct[] = ["caja-desayuno", "copa-personalizada"].map(
    (id) => getProduct(id)!
  );

  it("existen y no tienen precio automático", () => {
    for (const product of gifts) {
      expect(product).toBeDefined();
      expect(product.pricingType).toBe("quote");
      expect(product.giftType).toBeTruthy();
    }
  });

  it("generan solicitud de presupuesto sin importe ni señal", () => {
    for (const product of gifts) {
      const item = buildOrderItem({
        id: "g",
        selection: {
          productId: product.id,
          customerType: "individual",
          sizeId: "unico",
          toppingIds: [],
          extraIds: [],
        },
        customization: {
          size: { id: "unico", label: "A medida" },
          toppings: [],
          extras: [],
          dedicationText: "Feliz aniversario",
        },
        quantity: 1,
      })!;
      expect(item.requiresQuote).toBe(true);
      const pricing = computeOrderPricing([item], 0);
      expect(pricing.pendingQuote).toBe(true);
      expect(pricing.totalCents).toBe(0);
      expect(pricing.depositRequired).toBe(false);
      // La dedicatoria se conserva en el artículo persistido.
      expect(item.customization.dedicationText).toBe("Feliz aniversario");
    }
  });

  it("los regalos personalizados no aparecen en el catálogo de empresas", () => {
    const business = getProductsFor("business").map((p) => p.id);
    expect(business).not.toContain("caja-desayuno");
    expect(business).not.toContain("copa-personalizada");
  });
});
