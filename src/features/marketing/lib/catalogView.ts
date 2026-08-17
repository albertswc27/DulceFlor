/**
 * Datos derivados del catálogo y la configuración para las páginas de marketing.
 * Aquí no hay ningún precio escrito a mano: todo se calcula desde
 * @/domain/catalog y @/config/business (única fuente de verdad).
 */
import {
  CHEESECAKE_PRICES,
  getProduct,
  getSizesFor,
  getUnitBasePriceCents,
  type CatalogProduct,
} from "@/domain/catalog";
import { BUSINESS_HOURS } from "@/config/business";
import type { CustomerType } from "@/domain/types";

/** Precio mínimo real de un producto para un tipo de cliente ("desde X"). */
export function getMinPriceCents(
  productId: string,
  customerType: CustomerType
): number | null {
  const product = getProduct(productId);
  if (!product) return null;

  if (product.id === "cheesecake") {
    const allPrices = Object.values(CHEESECAKE_PRICES).flatMap((entry) =>
      customerType === "business" ? entry.business : entry.individual
    );
    return allPrices.length > 0 ? Math.min(...allPrices) : null;
  }

  const sizes = getSizesFor(product, customerType);
  if (sizes.length === 0) return null;
  return Math.min(...sizes.map((size) => size.priceCents));
}

export interface CakeMatrixCell {
  sizeId: string;
  priceCents: number | null;
}

export interface CakeMatrix {
  /** Etiquetas de columna (número de discos). */
  columnLabels: string[];
  /** Filas: rango de personas + celdas de precio por discos. */
  rows: Array<{ tierLabel: string; cells: CakeMatrixCell[] }>;
}

/**
 * Reconstruye la matriz personas × discos de un pastel a partir de sus
 * tamaños del catálogo (etiquetas "rango · discos").
 */
export function buildCakeMatrix(
  product: CatalogProduct,
  customerType: CustomerType
): CakeMatrix {
  const sizes = getSizesFor(product, customerType);
  const columnLabels: string[] = [];
  const rowsMap = new Map<string, CakeMatrixCell[]>();

  for (const size of sizes) {
    const [tierLabel, discLabel] = size.label.split(" · ");
    if (!tierLabel || !discLabel) continue;
    if (!columnLabels.includes(discLabel)) columnLabels.push(discLabel);
    const cells = rowsMap.get(tierLabel) ?? [];
    cells.push({
      sizeId: size.id,
      priceCents: getUnitBasePriceCents(product.id, customerType, size.id),
    });
    rowsMap.set(tierLabel, cells);
  }

  return {
    columnLabels,
    rows: Array.from(rowsMap.entries()).map(([tierLabel, cells]) => ({
      tierLabel,
      cells,
    })),
  };
}

const DAY_NAMES: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

/** Semana en orden habitual en España (lunes primero). Clave = Date.getDay(). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export interface ScheduleRow {
  dayLabel: string;
  hoursLabel: string;
  closed: boolean;
}

/** Filas de horario legibles derivadas de BUSINESS_HOURS (provisional). */
export function getScheduleRows(): ScheduleRow[] {
  return WEEK_ORDER.map((day) => {
    const windows = BUSINESS_HOURS[day] ?? [];
    return {
      dayLabel: DAY_NAMES[day],
      closed: windows.length === 0,
      hoursLabel:
        windows.length === 0
          ? "Cerrado"
          : windows.map((w) => `${w.start}–${w.end}`).join(" y "),
    };
  });
}
