/** Utilidades monetarias. Todos los importes internos van en céntimos (enteros). */

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function formatEuros(cents: number): string {
  return formatter.format(cents / 100);
}

/** Redondeo al céntimo más cercano de un porcentaje sobre un importe. */
export function percentOf(cents: number, percentage: number): number {
  return Math.round((cents * percentage) / 100);
}
