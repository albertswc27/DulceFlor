/**
 * Motor de disponibilidad horaria: combina el horario comercial con las
 * reglas de antelación (ver config/business.ts, confirmadas por el cliente):
 *
 *  - Se puede reservar con hasta MAX_ORDER_ADVANCE_MONTHS meses de antelación.
 *  - Con menos de STANDARD_ORDER_LEAD_TIME_HOURS (3 días) el pedido se acepta
 *    igualmente pero es URGENTE: debe confirmarse con la tienda por WhatsApp.
 *  - Incluso urgente, hace falta un mínimo de URGENT_MIN_LEAD_TIME_MINUTES.
 *
 * La UI nunca debe leer BUSINESS_HOURS directamente: usar estas funciones.
 */
import { addMonths } from "date-fns";
import {
  BUSINESS_HOURS,
  MAX_ORDER_ADVANCE_MONTHS,
  SLOT_INTERVAL_MINUTES,
  STANDARD_ORDER_LEAD_TIME_HOURS,
  URGENT_MIN_LEAD_TIME_MINUTES,
  type TimeWindow,
} from "@/config/business";

/** "HH:MM" → minutos desde medianoche. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getWindowsForDate(date: Date): TimeWindow[] {
  return BUSINESS_HOURS[date.getDay()] ?? [];
}

/** ¿La tienda abre ese día (independientemente de la antelación)? */
export function isOpenOn(date: Date): boolean {
  return getWindowsForDate(date).length > 0;
}

/**
 * Primer instante seleccionable: ahora + colchón mínimo. Los pedidos por
 * debajo de la antelación estándar ya no se bloquean (son urgentes).
 */
export function earliestAllowedDateTime(now: Date): Date {
  return new Date(now.getTime() + URGENT_MIN_LEAD_TIME_MINUTES * 60 * 1000);
}

/**
 * Umbral de urgencia: todo slot anterior a este instante es un pedido
 * urgente. Exactamente 3 días de antelación NO es urgente.
 */
export function urgencyThresholdDateTime(now: Date): Date {
  return new Date(now.getTime() + STANDARD_ORDER_LEAD_TIME_HOURS * 60 * 60 * 1000);
}

/**
 * Último instante seleccionable: el final del día que queda a
 * MAX_ORDER_ADVANCE_MONTHS meses vista (ese día entero aún se puede elegir).
 */
export function latestAllowedDateTime(now: Date): Date {
  const limit = addMonths(now, MAX_ORDER_ADVANCE_MONTHS);
  limit.setHours(23, 59, 59, 999);
  return limit;
}

function slotDateTime(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * Horas seleccionables ("HH:MM") para una fecha, respetando ventanas del día
 * y los límites de antelación. Incluye la hora de cierre como último slot.
 */
export function getAvailableSlotsForDate(date: Date, now: Date = new Date()): string[] {
  const earliest = earliestAllowedDateTime(now);
  const latest = latestAllowedDateTime(now);
  const slots: string[] = [];
  for (const window of getWindowsForDate(date)) {
    const start = toMinutes(window.start);
    const end = toMinutes(window.end);
    for (let t = start; t <= end; t += SLOT_INTERVAL_MINUTES) {
      const slot = slotDateTime(date, t).getTime();
      if (slot >= earliest.getTime() && slot <= latest.getTime()) {
        slots.push(toTimeString(t));
      }
    }
  }
  return slots;
}

/** ¿Tiene la fecha al menos un slot válido? */
export function isDateSelectable(date: Date, now: Date = new Date()): boolean {
  return getAvailableSlotsForDate(date, now).length > 0;
}

/**
 * ¿Es urgente ese slot? (menos de 3 días de antelación). Solo tiene sentido
 * sobre slots válidos; no comprueba horario ni límites.
 */
export function isSlotUrgent(date: Date, time: string, now: Date = new Date()): boolean {
  return (
    slotDateTime(date, toMinutes(time)).getTime() <
    urgencyThresholdDateTime(now).getTime()
  );
}

/**
 * ¿Ofrece la fecha algún slot urgente? Como los slots van en orden, basta
 * mirar el primero: si el más temprano no es urgente, ninguno lo es.
 */
export function isDateUrgent(date: Date, now: Date = new Date()): boolean {
  const slots = getAvailableSlotsForDate(date, now);
  return slots.length > 0 && isSlotUrgent(date, slots[0], now);
}

/**
 * ¿Son urgentes TODOS los slots de la fecha? En el día frontera (el umbral
 * de 72 h cae a media jornada) esto es false aunque isDateUrgent sea true:
 * las primeras horas son urgentes y las últimas no.
 */
export function isDateFullyUrgent(date: Date, now: Date = new Date()): boolean {
  const slots = getAvailableSlotsForDate(date, now);
  return slots.length > 0 && isSlotUrgent(date, slots[slots.length - 1], now);
}

export interface AvailableSlot {
  date: Date;
  time: string;
}

/**
 * Primer slot disponible a partir de ahora (busca hasta 60 días vista).
 * Devuelve null si no hay ninguno (no debería ocurrir salvo config vacía).
 */
export function findFirstAvailableSlot(now: Date = new Date()): AvailableSlot | null {
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const slots = getAvailableSlotsForDate(cursor, now);
    if (slots.length > 0) {
      return { date: new Date(cursor), time: slots[0] };
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** "yyyy-MM-dd" → Date local a medianoche, o null si no es una fecha. */
function parseIsoDate(isoDate: string): Date | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  // El constructor de Date "corrige" fechas imposibles (31/02 → 03/03): aquí
  // una fecha que no existe debe ser inválida, no convertirse en otra.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

/**
 * Valida una combinación fecha ("yyyy-MM-dd") + hora ("HH:MM") elegida por el
 * cliente. Se usa tanto en la UI como al registrar el pedido.
 */
export function isRequestedSlotValid(
  requestedDate: string,
  requestedTime: string,
  now: Date = new Date()
): boolean {
  const date = parseIsoDate(requestedDate);
  if (!date) return false;
  return getAvailableSlotsForDate(date, now).includes(requestedTime);
}

/**
 * ¿Es urgente la combinación elegida? (menos de 3 días de antelación).
 * Con una fecha ilegible devuelve false: la validez la decide
 * isRequestedSlotValid, no esta función.
 */
export function isRequestedSlotUrgent(
  requestedDate: string,
  requestedTime: string,
  now: Date = new Date()
): boolean {
  const date = parseIsoDate(requestedDate);
  if (!date) return false;
  return isSlotUrgent(date, requestedTime, now);
}
