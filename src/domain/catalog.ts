/**
 * CATÁLOGO DE DULCE FLOR — transcripción fiel de las cartas fotografiadas.
 * Fuente de verdad: imágenes en src/assets/carta-*.jpeg (ver docs/assets-inventory.md).
 * Precios en céntimos. No añadir productos o precios que no aparezcan en las cartas.
 */
import type { CustomerType } from "./types";
import { EXTRAS } from "@/config/business";

export type CategoryId =
  | "pasteles"
  | "cheesecake"
  | "tres-leches"
  | "especialidades"
  | "aperitivos-salados"
  | "aperitivos-dulces"
  | "desayunos"
  | "copas";

/**
 * Familias de producto: agrupan categorías para la navegación principal
 * («¿Qué estás buscando?»), sin multiplicar secciones en la home.
 */
export type FamilyId = "tartas" | "aperitivos" | "regalos";

export const FAMILY_LABELS: Record<FamilyId, string> = {
  tartas: "Tartas",
  aperitivos: "Aperitivos",
  regalos: "Desayunos y regalos",
};

export const CATEGORY_FAMILY: Record<CategoryId, FamilyId> = {
  pasteles: "tartas",
  cheesecake: "tartas",
  "tres-leches": "tartas",
  especialidades: "tartas",
  "aperitivos-salados": "aperitivos",
  "aperitivos-dulces": "aperitivos",
  desayunos: "regalos",
  copas: "regalos",
};

export interface CatalogOption {
  id: string;
  label: string;
  description?: string;
}

/**
 * Tramo de precio por volumen (aperitivos): el precio por unidad baja al
 * subir la cantidad. Fuente: tarifas facilitadas por Dulce Flor (21/08/2026).
 */
export interface QuantityTier {
  id: string;
  /** Cantidad mínima del tramo. */
  minQuantity: number;
  /** Precio POR UNIDAD dentro del tramo. */
  unitPriceCents: number;
  /** true en el último tramo, abierto hacia arriba ("50+"). */
  open?: boolean;
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
   * "quote": sin precio automático (tartas personalizadas y de fondant) →
   * solicitud de presupuesto; la UI muestra "Precio a consultar", nunca 0 €.
   */
  pricingType?: "fixed" | "quote";
  /**
   * Subtipo de las tartas sin precio automático. Ambas comparten flujo,
   * modelo y lógica; solo cambia el texto que ve el cliente.
   */
  customCakeType?: "custom" | "fondant";
  /** Las solicitudes de presupuesto exigen fotografía de referencia. */
  requiresReferenceImage?: boolean;
  /**
   * Subtipo de los regalos sin precio automático (caja de desayuno / copa).
   * Comparten flujo y modelo con las tartas a medida.
   */
  giftType?: "desayuno" | "copa";
  /**
   * Precio por volumen: el importe unitario depende de la cantidad pedida
   * (aperitivos). Excluyente con `sizes`; la cantidad ES el nº de unidades.
   */
  quantityTiers?: QuantityTier[];
  /** Subgrupo dentro de la categoría, para agrupar listas largas. */
  group?: string;
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
  // El id se mantiene por compatibilidad con los pedidos ya guardados; solo
  // cambia el nombre comercial (antes «Dulce de leche con chocolate»).
  { id: "dulce-de-leche-chocolate", label: "Bariloche", description: "Dulce de leche combinado con suave crema de chocolate." },
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
  { id: "1d", discs: 1, heightCm: 8, label: "1 disco (8 cm)" },
  { id: "2d", discs: 2, heightCm: 13, label: "2 discos (13 cm)" },
  { id: "3d", discs: 3, heightCm: 20, label: "3 discos (20 cm)" },
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

/**
 * Misma matriz personas × discos que las tartas con precio, pero sin importes:
 * las tartas a medida se presupuestan a mano y el número de discos solo sirve
 * para que Dulce Flor valore la solicitud. Reutiliza CAKE_TIERS y CAKE_DISCS
 * para no duplicar tamaños ni dimensiones.
 */
function buildQuoteCakeSizes(): SizeOption[] {
  const sizes: SizeOption[] = [];
  CAKE_TIERS.forEach((tier) => {
    CAKE_DISCS.forEach((disc) => {
      sizes.push({
        id: `${tier.id}-${disc.id}`,
        label: `${tier.label} · ${disc.label}`,
        servings: tier.label,
        priceCents: 0, // nunca se muestra: pricingType "quote" → "A consultar"
      });
    });
  });
  return sizes;
}

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

/* ------------------------------------------------------------------ */
/* Aperitivos salados — tarifas confirmadas por Dulce Flor (21/08/2026) */
/* ------------------------------------------------------------------ */

/**
 * Construye los tramos de precio por volumen. Cada tramo es
 * [cantidad, precio unitario en céntimos]; el último queda abierto ("50+").
 * Los tramos NO son iguales en todos los productos (las empanadas empiezan
 * en 20 uds y los tequeños escalan en 30), así que se definen uno a uno.
 */
function buildTiers(...steps: Array<[number, number]>): QuantityTier[] {
  return steps.map(([quantity, unitPriceCents], index) => ({
    id: String(quantity),
    minQuantity: quantity,
    unitPriceCents,
    open: index === steps.length - 1,
  }));
}

interface SavourySpec {
  id: string;
  name: string;
  description: string;
  /** Subgrupo visible en la carta y el configurador. */
  group: string;
  /** [cantidad, precio unitario] por tramo, tal como los facilitó Dulce Flor. */
  tiers: Array<[number, number]>;
}

/**
 * Catálogo salado tal cual lo facilitó Dulce Flor por WhatsApp (21/08/2026).
 * NO alterar las tarifas ni los tramos: cada producto tiene los suyos.
 */
const SAVOURY_SNACKS: SavourySpec[] = [
  /* --- Mini sándwiches (pan de molde) --- */
  {
    group: "Mini sándwiches", id: "mini-sandwich-cerdo-caramelizado",
    name: "Mini sándwich de cerdo caramelizado",
    description: "Pan de molde con cerdo caramelizado.",
    tiers: [[15, 145], [25, 125], [50, 100]],
  },
  {
    group: "Mini sándwiches", id: "mini-sandwich-royal-pollo",
    name: "Mini sándwich Royal de pollo",
    description: "Nuestro clásico Royal de pollo en pan de molde.",
    tiers: [[15, 130], [25, 115], [50, 99]],
  },
  {
    group: "Mini sándwiches", id: "mini-sandwich-jamon-tomate-queso",
    name: "Mini sándwich de jamón dulce con tomate y queso",
    description: "Jamón dulce, tomate y queso en pan de molde.",
    tiers: [[15, 125], [25, 110], [50, 90]],
  },
  {
    group: "Mini sándwiches", id: "mini-sandwich-huevo",
    name: "Mini sándwich de huevo",
    description: "Relleno cremoso de huevo en pan de molde.",
    tiers: [[15, 120], [25, 110], [50, 90]],
  },
  {
    group: "Mini sándwiches", id: "mini-sandwich-tocino-crujiente",
    name: "Mini sándwich de tocino crujiente",
    description: "Tocino crujiente con queso en lonchas y tomate, en pan de molde.",
    tiers: [[15, 145], [25, 125], [50, 100]],
  },
  {
    group: "Mini sándwiches", id: "mini-sandwich-pollo-melocoton-jamon",
    name: "Mini sándwich de pollo, melocotón y jamón dulce",
    description: "Pollo, melocotón y jamón dulce en pan de molde.",
    tiers: [[15, 145], [25, 125], [50, 105]],
  },

  /* --- Mini panes (panecillo) --- */
  {
    group: "Mini panes", id: "mini-pan-bacon-espinaca",
    name: "Mini pan de bacon con espinaca",
    description: "Panecillo relleno de bacon y espinaca.",
    tiers: [[15, 135], [25, 120], [50, 100]],
  },
  {
    group: "Mini panes", id: "mini-pan-pollo-melocoton",
    name: "Mini pan mixto de pollo y melocotón",
    description: "Panecillo mixto de pollo con melocotón.",
    tiers: [[15, 135], [25, 120], [50, 100]],
  },
  {
    group: "Mini panes", id: "mini-pan-jamon-queso",
    name: "Mini pan de jamón dulce y queso",
    description: "Panecillo de jamón dulce y queso.",
    tiers: [[15, 125], [25, 115], [50, 99]],
  },
  {
    group: "Mini panes", id: "mini-pan-jamon-serrano",
    name: "Mini pan de jamón serrano",
    description: "Panecillo de jamón serrano.",
    tiers: [[15, 135], [25, 120], [50, 100]],
  },
  {
    group: "Mini panes", id: "mini-pan-pollo-mayonesa",
    name: "Mini pan de pollo con mayonesa de la casa",
    description: "Panecillo de pollo con nuestra mayonesa casera.",
    tiers: [[15, 125], [25, 115], [50, 99]],
  },
  {
    group: "Mini panes", id: "mini-pan-fuet",
    name: "Mini pan de fuet",
    description: "Panecillo de fuet.",
    tiers: [[15, 115], [25, 100], [50, 90]],
  },
  {
    group: "Mini panes", id: "mini-pan-cerdo-boniato",
    name: "Mini pan de cerdo y boniato",
    description: "Panecillo de cerdo con boniato.",
    tiers: [[15, 145], [25, 125], [50, 100]],
  },
  {
    group: "Mini panes", id: "mini-pan-cerdo-caramelizado",
    name: "Mini pan de cerdo caramelizado",
    description: "Panecillo de cerdo caramelizado.",
    tiers: [[15, 135], [25, 120], [50, 100]],
  },

  /* --- Tequeños (tramos 15 / 30 / 50) --- */
  {
    group: "Tequeños", id: "mini-tequenos-jamon-queso",
    name: "Mini tequeños de jamón y queso",
    description: "Rollitos crujientes rellenos de jamón y queso fundido.",
    tiers: [[15, 120], [30, 100], [50, 95]],
  },
  {
    group: "Tequeños", id: "mini-tequenos-queso",
    name: "Mini tequeños de queso",
    description: "Rollitos crujientes rellenos de queso fundido.",
    tiers: [[15, 110], [30, 99], [50, 90]],
  },

  /* --- Mini hamburguesas (tramos 15 / 30 / 50) --- */
  {
    group: "Mini hamburguesas", id: "mini-hamburguesa-vacuno",
    name: "Mini hamburguesa de vacuno",
    description: "Hamburguesa de ternera con lechuga y tomate en pan de bollo.",
    tiers: [[15, 150], [30, 125], [50, 100]],
  },
  {
    group: "Mini hamburguesas", id: "mini-hamburguesa-pollo",
    name: "Mini hamburguesa de pollo",
    description: "Pollo a la plancha con lechuga y tomate en pan de bollo.",
    tiers: [[15, 135], [30, 120], [50, 99]],
  },

  /* --- Empanadas (tramos 20 / 35 / 50) --- */
  {
    group: "Empanadas", id: "mini-empanadas-carne",
    name: "Mini empanadas de carne",
    description: "Empanadas individuales de carne picada, al horno.",
    tiers: [[20, 135], [35, 115], [50, 100]],
  },
  {
    group: "Empanadas", id: "mini-empanadas-pollo",
    name: "Mini empanadas de pollo",
    description: "Empanadas individuales de pollo desmenuzado, al horno.",
    tiers: [[20, 125], [35, 105], [50, 95]],
  },
  {
    group: "Empanadas", id: "mini-empanadas-atun",
    name: "Mini empanadas de atún",
    description: "Empanadas individuales de atún, al horno.",
    tiers: [[20, 120], [35, 105], [50, 95]],
  },
];

const SAVOURY_PRODUCTS: CatalogProduct[] = SAVOURY_SNACKS.map((snack) => ({
  id: snack.id,
  name: snack.name,
  category: "aperitivos-salados" as CategoryId,
  description: snack.description,
  availableFor: ["individual", "business"] as CustomerType[],
  quantityTiers: buildTiers(...snack.tiers),
  group: snack.group,
  sizes: {},
  allowsToppings: false,
  extras: [],
}));

/* ------------------------------------------------------------------ */
/* Desayunos y regalos personalizados — sin precio automático          */
/* ------------------------------------------------------------------ */

const GIFT_PRODUCTS: CatalogProduct[] = [
  {
    id: "caja-desayuno",
    name: "Caja de desayuno personalizada",
    category: "desayunos",
    description:
      "Convierte un desayuno en un regalo especial. Cuéntanos la ocasión y qué te gustaría incluir, y te confirmamos las opciones y el precio.",
    availableFor: ["individual"],
    pricingType: "quote",
    giftType: "desayuno",
    sizes: {},
    allowsToppings: false,
    extras: [],
  },
  {
    id: "copa-personalizada",
    name: "Copa personalizada",
    category: "copas",
    description:
      "Un detalle personalizado para regalar, celebrar o sorprender. Cuéntanos qué tienes en mente y prepararemos una propuesta para ti.",
    availableFor: ["individual"],
    pricingType: "quote",
    giftType: "copa",
    sizes: {},
    allowsToppings: false,
    extras: [],
  },
];

export const PRODUCTS: CatalogProduct[] = [
  {
    id: "pastel-clasico",
    name: "Tarta clásica Dulce Flor",
    category: "pasteles",
    description:
      "Nuestro acabado clásico por capas: elige tamaño, bizcocho, relleno y toppings, y conoce el precio al momento.",
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
    name: "Tarta clásica con buttercream",
    category: "pasteles",
    description:
      "Nuestro acabado clásico terminado con buttercream y cenefa de manga. Precio al momento.",
    availableFor: ["individual"],
    sizes: { individual: buildCakeSizes(BUTTERCREAM_CAKE_PRICES) },
    flavors: SPONGE_FLAVORS,
    fillings: CAKE_FILLINGS,
    allowsToppings: true,
    extras: [DEDICATION_EXTRA, EDIBLE_PAPER_EXTRA],
    menuImage: "carta-pasteles-buttercream-precios-particulares",
  },
  {
    id: "pastel-personalizado",
    name: "Tarta personalizada",
    category: "pasteles",
    description:
      "Decoración especial, dibujos, personajes o un diseño que hayas visto: envíanos tu idea con una fotografía de referencia y te confirmamos el precio por WhatsApp.",
    availableFor: ["individual"], // confirmado: solo particulares
    // Sin precio automático: la decoración especial se presupuesta a mano.
    pricingType: "quote",
    customCakeType: "custom",
    requiresReferenceImage: true,
    sizes: { individual: buildQuoteCakeSizes() },
    flavors: SPONGE_FLAVORS,
    fillings: CAKE_FILLINGS,
    allowsToppings: false,
    extras: [],
  },
  {
    id: "pastel-fondant",
    name: "Tarta de fondant",
    category: "pasteles",
    description:
      "Diseños especiales cubiertos de fondant. Cuéntanos tu idea y adjunta una imagen de referencia: prepararemos un presupuesto según la complejidad.",
    availableFor: ["individual"], // confirmado: solo particulares
    pricingType: "quote",
    customCakeType: "fondant",
    requiresReferenceImage: true,
    sizes: { individual: buildQuoteCakeSizes() },
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
    // El papel comestible también se hace sobre cheesecake (confirmado 24/08/2026).
    extras: [DEDICATION_EXTRA, EDIBLE_PAPER_EXTRA],
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
  ...SAVOURY_PRODUCTS,
  ...GIFT_PRODUCTS,
];

/* ------------------------------------------------------------------ */
/* Precio por volumen (aperitivos)                                     */
/* ------------------------------------------------------------------ */

/** Cantidades sugeridas en la UI (packs definidos por Dulce Flor). */
export function getTierQuantities(product: CatalogProduct): number[] {
  return (product.quantityTiers ?? []).map((t) => t.minQuantity);
}

/**
 * Tramo aplicable a una cantidad: el de mayor `minQuantity` que no la supere.
 * Por debajo del primer tramo no hay tarifa confirmada → null (nunca se
 * inventa un precio).
 */
export function resolveQuantityTier(
  product: CatalogProduct,
  quantity: number
): QuantityTier | null {
  const tiers = product.quantityTiers;
  if (!tiers || tiers.length === 0) return null;
  let match: QuantityTier | null = null;
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) match = tier;
  }
  return match;
}

/** Cantidad mínima que se puede pedir de un producto por tramos. */
export function getMinimumQuantity(product: CatalogProduct): number {
  const tiers = product.quantityTiers ?? [];
  return tiers.length > 0 ? tiers[0].minQuantity : 1;
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  pasteles: "Pasteles",
  cheesecake: "Cheesecakes",
  "tres-leches": "Tres Leches",
  especialidades: "Especialidades",
  "aperitivos-salados": "Salados",
  "aperitivos-dulces": "Dulces",
  desayunos: "Cajas de desayuno",
  copas: "Copas personalizadas",
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
