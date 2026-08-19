/**
 * CATÁLOGO DE DULCE FLOR — transcripción fiel de las cartas fotografiadas.
 * Fuente de verdad: imágenes en src/assets/carta-*.jpeg (ver docs/assets-inventory.md).
 * Precios en céntimos. No añadir productos o precios que no aparezcan en las cartas.
 */
import type { CustomerType } from "./types";
import { EXTRAS } from "@/config/business";

export type CategoryId = "pasteles" | "cheesecake" | "tres-leches" | "especialidades";

export interface CatalogOption {
  id: string;
  label: string;
  description?: string;
}

export interface SizeOption {
  id: string;
  label: string;
  /** Descripción corta de a cuántas personas/porciones corresponde. */
  servings: string;
  priceCents: number;
}

export interface ExtraOption extends CatalogOption {
  priceCents: number;
  /** El extra de dedicatoria requiere texto. */
  requiresText?: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  availableFor: CustomerType[];
  /**
   * "fixed" (por defecto): precio automático desde el catálogo.
   * "quote": sin precio automático (fondant) → solicitud de presupuesto;
   * la UI muestra "Precio personalizado / A consultar", nunca 0 €.
   */
  pricingType?: "fixed" | "quote";
  /** Tamaños (con precio base) por tipo de cliente. */
  sizes: Partial<Record<CustomerType, SizeOption[]>>;
  /**
   * Sabores. En cheesecakes el sabor determina el precio (ver
   * CHEESECAKE_PRICES); en pasteles no altera el precio.
   */
  flavors?: CatalogOption[];
  /** Rellenos (solo pasteles), incluidos en el precio. */
  fillings?: CatalogOption[];
  /** Si admite toppings (+2 € cada uno por regla general). */
  allowsToppings: boolean;
  /**
   * Excepción documentada en carta: el tamaño gigante de tres leches
   * tiene suplemento de 6 € en lugar de 2 €.
   */
  toppingPriceOverridesBySizeId?: Record<string, number>;
  extras: ExtraOption[];
  /** Imagen de carta asociada (para la sección de cartas). */
  menuImage?: string;
}

/* ------------------------------------------------------------------ */
/* Opciones compartidas                                                */
/* ------------------------------------------------------------------ */

/** Sabores de bizcocho (cartas de pasteles, "biscochos"). */
export const SPONGE_FLAVORS: CatalogOption[] = [
  { id: "chocolate", label: "Chocolate" },
  { id: "vainilla", label: "Vainilla" },
  { id: "zanahoria", label: "Zanahoria" },
  { id: "red-velvet", label: "Red Velvet" },
  { id: "coco", label: "Coco" },
  { id: "naranja", label: "Naranja" },
  { id: "marmoleado", label: "Marmoleado" },
  { id: "tres-leches", label: "3 Leches" },
  { id: "limon", label: "Limón" },
];

/** Rellenos de pasteles (carta de rellenos, incluidos en el precio). */
export const CAKE_FILLINGS: CatalogOption[] = [
  { id: "dulce-de-leche", label: "Dulce de leche", description: "Clásico y cremoso, con el auténtico sabor del dulce de leche." },
  { id: "nata-con-frutas", label: "Nata con frutas", description: "Suave nata montada con trozos de frutas frescas." },
  { id: "dulce-de-leche-chocolate", label: "Dulce de leche con chocolate", description: "Dulce de leche combinado con suave crema de chocolate." },
  { id: "chocolate", label: "Chocolate", description: "Relleno cremoso de chocolate." },
  { id: "mus-oreo", label: "Mus de Oreo", description: "Mousse de queso con galletas Oreo." },
  { id: "nutella", label: "Nutella", description: "Crema de avellanas con el inconfundible sabor Nutella." },
  { id: "fresa", label: "Fresa", description: "Suave crema con trocitos de fresa natural." },
  { id: "mus-lotus", label: "Mus de Lotus", description: "Mousse de queso con crema Lotus y crujiente de galleta." },
  { id: "mus-cafe", label: "Mus de café", description: "Mousse de café con un toque suave y aromático." },
];

/**
 * Lista de toppings confirmada (17/08/2026), derivada de los ingredientes de
 * las cartas (suplementos: "añade fresas, dulce de leche y otros extras").
 * Precio: regla confirmada +2 €/topping.
 */
export const TOPPINGS: CatalogOption[] = [
  { id: "fresas", label: "Fresas" },
  { id: "dulce-de-leche", label: "Dulce de leche" },
  { id: "oreo", label: "Oreo" },
  { id: "kinder-bueno", label: "Kinder Bueno" },
  { id: "lotus", label: "Lotus" },
  { id: "nutella", label: "Nutella" },
  { id: "frutos-rojos", label: "Frutos rojos" },
  { id: "chocolate", label: "Chocolate" },
];

const DEDICATION_EXTRA: ExtraOption = {
  id: "dedicatoria",
  label: "Dedicatoria o mensaje especial",
  description: "Frase escrita sobre la tarta.",
  priceCents: EXTRAS.DEDICATION_PRICE_CENTS,
  requiresText: true,
};

const EDIBLE_PAPER_EXTRA: ExtraOption = {
  id: "papel-comestible",
  label: "Imagen con papel comestible",
  description: "Haz tu tarta aún más especial con una imagen impresa comestible.",
  priceCents: EXTRAS.EDIBLE_PAPER_PRICE_CENTS,
};

/* ------------------------------------------------------------------ */
/* Pasteles (matriz personas × discos) — solo particulares en cartas   */
/* ------------------------------------------------------------------ */

/** Rangos de personas de las cartas de pasteles (fuente: cartas fotografiadas). */
export const CAKE_TIERS = [
  { id: "4-6", label: "4–6 personas", minPeople: 4, maxPeople: 6 },
  { id: "10-12", label: "10–12 personas", minPeople: 10, maxPeople: 12 },
  { id: "16-18", label: "16–18 personas", minPeople: 16, maxPeople: 18 },
  { id: "20-22", label: "20–22 personas", minPeople: 20, maxPeople: 22 },
] as const;

/** Alturas de las cartas: nº de discos y altura en cm. */
export const CAKE_DISCS = [
  { id: "1d", discs: 1, heightCm: 8, label: "1 disco (8 cm)" },
  { id: "2d", discs: 2, heightCm: 13, label: "2 discos (13 cm)" },
  { id: "3d", discs: 3, heightCm: 20, label: "3 discos (20 cm)" },
] as const;

/** Compone/descompone el id de tamaño de pastel (`<tier>-<disc>`). */
export function buildCakeSizeId(tierId: string, discId: string): string {
  return `${tierId}-${discId}`;
}

export function splitCakeSizeId(
  sizeId: string
): { tierId: string; discId: string } | null {
  const match = sizeId.match(/^(.+)-([123]d)$/);
  if (!match) return null;
  return { tierId: match[1], discId: match[2] };
}

/** Precios carta "pasteles" clásicos: fila = rango personas, col = discos. */
const CLASSIC_CAKE_PRICES: number[][] = [
  [2000, 3000, 3900],
  [2800, 3800, 4900],
  [3400, 4800, 6800],
  [3900, 5800, 7800],
];

/** Precios carta "pasteles con buttercream". */
const BUTTERCREAM_CAKE_PRICES: number[][] = [
  [2200, 3200, 4300],
  [3000, 4000, 5300],
  [3600, 5000, 7200],
  [4100, 6000, 8200],
];

function buildCakeSizes(prices: number[][]): SizeOption[] {
  const sizes: SizeOption[] = [];
  CAKE_TIERS.forEach((tier, ti) => {
    CAKE_DISCS.forEach((disc, di) => {
      sizes.push({
        id: `${tier.id}-${disc.id}`,
        label: `${tier.label} · ${disc.label}`,
        servings: tier.label,
        priceCents: prices[ti][di],
      });
    });
  });
  return sizes;
}

/* ------------------------------------------------------------------ */
/* Cheesecakes (el sabor determina el precio)                          */
/* ------------------------------------------------------------------ */

export const CHEESECAKE_SIZES_INDIVIDUAL = [
  { id: "4-6", label: "4–6 porciones aprox." },
  { id: "10-12", label: "10–12 porciones aprox." },
  { id: "14-16", label: "14–16 porciones aprox." },
] as const;

export const CHEESECAKE_SIZES_BUSINESS = [
  { id: "8", label: "8 porciones aprox." },
  { id: "10-12", label: "10–12 porciones aprox." },
  { id: "14-16", label: "14–16 porciones aprox." },
] as const;

/** [tamaño pequeño, mediano, grande] por sabor y tipo de cliente. */
export const CHEESECAKE_PRICES: Record<
  string,
  { label: string; individual: [number, number, number]; business: [number, number, number] }
> = {
  maracuya: { label: "Maracuyá", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  oreo: { label: "Oreo", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  lotus: { label: "Lotus", individual: [1900, 2900, 3900], business: [2300, 3400, 4300] },
  baylis: { label: "Baylis", individual: [1800, 2800, 3800], business: [2000, 3000, 3700] },
  fresa: { label: "Fresa", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  "pantera-rosa": { label: "Pantera Rosa", individual: [1900, 2900, 3900], business: [2000, 3000, 3700] },
  chocolate: { label: "Chocolate", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  "dulce-de-leche": { label: "Dulce de leche", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  "kinder-bueno": { label: "Kinder Bueno", individual: [1900, 2900, 3900], business: [2300, 3400, 4300] },
  pistacho: { label: "Pistacho", individual: [2100, 3200, 4300], business: [2400, 3600, 4500] },
  "frutos-rojos": { label: "Frutos rojos", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  mango: { label: "Mango", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
  melocoton: { label: "Melocotón", individual: [1800, 2800, 3800], business: [1900, 2800, 3500] },
};

export const CHEESECAKE_FLAVORS: CatalogOption[] = Object.entries(CHEESECAKE_PRICES).map(
  ([id, { label }]) => ({ id, label })
);

/* ------------------------------------------------------------------ */
/* Productos                                                           */
/* ------------------------------------------------------------------ */

export const PRODUCTS: CatalogProduct[] = [
  {
    id: "pastel-clasico",
    name: "Pastel personalizado",
    category: "pasteles",
    description:
      "Nuestro pastel casero por capas: elige tamaño, bizcocho y relleno, y personalízalo a tu gusto.",
    availableFor: ["individual"],
    sizes: { individual: buildCakeSizes(CLASSIC_CAKE_PRICES) },
    flavors: SPONGE_FLAVORS,
    fillings: CAKE_FILLINGS,
    allowsToppings: true,
    extras: [DEDICATION_EXTRA, EDIBLE_PAPER_EXTRA],
    menuImage: "carta-pasteles-clasicos-precios-particulares",
  },
  {
    id: "pastel-buttercream",
    name: "Pastel con buttercream",
    category: "pasteles",
    description:
      "Pastel por capas acabado con buttercream, ideal para decoraciones personalizadas.",
    availableFor: ["individual"],
    sizes: { individual: buildCakeSizes(BUTTERCREAM_CAKE_PRICES) },
    flavors: SPONGE_FLAVORS,
    fillings: CAKE_FILLINGS,
    allowsToppings: true,
    extras: [DEDICATION_EXTRA, EDIBLE_PAPER_EXTRA],
    menuImage: "carta-pasteles-buttercream-precios-particulares",
  },
  {
    id: "pastel-fondant",
    name: "Tarta de fondant personalizada",
    category: "pasteles",
    description:
      "¿Tienes un diseño especial en mente? Cuéntanos tu idea y adjunta una imagen de referencia: prepararemos un presupuesto personalizado según la complejidad del diseño.",
    availableFor: ["individual"],
    // Sin precio automático: los diseños de fondant se presupuestan a mano.
    pricingType: "quote",
    sizes: {
      individual: CAKE_TIERS.map((tier) => ({
        id: tier.id,
        label: `${tier.label} (aprox.)`,
        servings: tier.label,
        priceCents: 0, // nunca se muestra: pricingType "quote" → "A consultar"
      })),
    },
    flavors: SPONGE_FLAVORS,
    fillings: CAKE_FILLINGS,
    allowsToppings: false,
    extras: [],
  },
  {
    id: "cheesecake",
    name: "Cheesecake",
    category: "cheesecake",
    description:
      "Cheesecakes cremosos de receta casera en 13 sabores. El precio depende del sabor y el tamaño.",
    availableFor: ["individual", "business"],
    sizes: {
      // Los precios reales dependen del sabor: se resuelven en getUnitBasePriceCents.
      individual: CHEESECAKE_SIZES_INDIVIDUAL.map((s) => ({
        ...s,
        servings: s.label,
        priceCents: 0,
      })),
      business: CHEESECAKE_SIZES_BUSINESS.map((s) => ({
        ...s,
        servings: s.label,
        priceCents: 0,
      })),
    },
    flavors: CHEESECAKE_FLAVORS,
    allowsToppings: true,
    extras: [DEDICATION_EXTRA],
    menuImage: "carta-cheesecake-precios-particulares",
  },
  {
    id: "tres-leches",
    name: "Tarta Tres Leches",
    category: "tres-leches",
    description: "Un clásico que nunca falla: bizcocho bañado en tres leches.",
    availableFor: ["individual", "business"],
    sizes: {
      individual: [
        { id: "5-6", label: "5–6 porciones", servings: "5–6 porciones", priceCents: 1900 },
        { id: "8-10", label: "8–10 porciones", servings: "8–10 porciones", priceCents: 2500 },
        { id: "12-14", label: "12–14 porciones", servings: "12–14 porciones", priceCents: 3000 },
        { id: "28-30", label: "28–30 porciones", servings: "28–30 porciones", priceCents: 5900 },
      ],
      business: [
        { id: "8", label: "8 porciones aprox.", servings: "8 porciones", priceCents: 1800 },
        { id: "10-12", label: "10–12 porciones aprox.", servings: "10–12 porciones", priceCents: 2600 },
        { id: "14-16", label: "14–16 porciones aprox.", servings: "14–16 porciones", priceCents: 3300 },
      ],
    },
    allowsToppings: true,
    // Carta: suplemento 2 € en todos los tamaños, 6 € en el de 28–30 porciones.
    toppingPriceOverridesBySizeId: { "28-30": 600 },
    extras: [DEDICATION_EXTRA, EDIBLE_PAPER_EXTRA],
    menuImage: "carta-tres-leches-precios-particulares",
  },
  {
    id: "pudin-casero",
    name: "Pudín casero",
    category: "especialidades",
    description: "Pudín casero tradicional.",
    availableFor: ["business"],
    sizes: {
      business: [
        { id: "10-12", label: "10–12 porciones aprox.", servings: "10–12 porciones", priceCents: 3300 },
      ],
    },
    allowsToppings: false,
    extras: [DEDICATION_EXTRA],
    menuImage: "carta-tres-leches-y-tortas-precios-empresas",
  },
  {
    id: "torta-chocolate",
    name: "Torta de chocolate",
    category: "especialidades",
    description: "Torta de chocolate para grandes ocasiones.",
    availableFor: ["business"],
    sizes: {
      business: [
        { id: "16-18", label: "16–18 porciones aprox.", servings: "16–18 porciones", priceCents: 3900 },
      ],
    },
    allowsToppings: false,
    extras: [DEDICATION_EXTRA],
    menuImage: "carta-tres-leches-y-tortas-precios-empresas",
  },
  {
    id: "torta-helada",
    name: "Torta helada",
    category: "especialidades",
    description: "Torta helada, perfecta para los días especiales.",
    availableFor: ["business"],
    sizes: {
      business: [
        { id: "16-18", label: "16–18 porciones aprox.", servings: "16–18 porciones", priceCents: 3800 },
      ],
    },
    allowsToppings: false,
    extras: [DEDICATION_EXTRA],
    menuImage: "carta-tres-leches-y-tortas-precios-empresas",
  },
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  pasteles: "Pasteles",
  cheesecake: "Cheesecakes",
  "tres-leches": "Tres Leches",
  especialidades: "Especialidades",
};

/* ------------------------------------------------------------------ */
/* Acceso al catálogo                                                  */
/* ------------------------------------------------------------------ */

export function getProduct(productId: string): CatalogProduct | undefined {
  return PRODUCTS.find((p) => p.id === productId);
}

export function getProductsFor(customerType: CustomerType): CatalogProduct[] {
  return PRODUCTS.filter((p) => p.availableFor.includes(customerType));
}

export function getSizesFor(
  product: CatalogProduct,
  customerType: CustomerType
): SizeOption[] {
  return product.sizes[customerType] ?? [];
}

/**
 * Precio base de una unidad (sin toppings ni extras).
 * En cheesecakes el precio depende de sabor + tamaño + tipo de cliente;
 * en el resto de productos, del tamaño + tipo de cliente.
 * Devuelve null si la combinación no existe en las cartas.
 */
export function getUnitBasePriceCents(
  productId: string,
  customerType: CustomerType,
  sizeId: string,
  flavorId?: string
): number | null {
  const product = getProduct(productId);
  if (!product) return null;
  const sizes = getSizesFor(product, customerType);
  const sizeIndex = sizes.findIndex((s) => s.id === sizeId);
  if (sizeIndex === -1) return null;

  if (product.id === "cheesecake") {
    if (!flavorId) return null;
    const entry = CHEESECAKE_PRICES[flavorId];
    if (!entry) return null;
    const prices = customerType === "business" ? entry.business : entry.individual;
    return prices[sizeIndex] ?? null;
  }

  return sizes[sizeIndex].priceCents;
}
