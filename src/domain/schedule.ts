/**
 * Motor de disponibilidad horaria: combina el horario comercial con la
 * antelación mínima de pedido (ambos confirmados; ver config/business.ts).
 * La UI nunca debe leer BUSINESS_HOURS directamente: usar estas funciones.
 */
import {
  BUSINESS_HOURS,
  MIN_ORDER_LEAD_TIME_HOURS,
  SLOT_INTERVAL_MINUTES,
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

/** Primer instante seleccionable: ahora + antelación mínima. */
export function earliestAllowedDateTime(now: Date): Date {
  return new Date(now.getTime() + MIN_ORDER_LEAD_TIME_HOURS * 60 * 60 * 1000);
}

function slotDateTime(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * Horas seleccionables ("HH:MM") para una fecha, respetando ventanas del día
 * y antelación mínima. Incluye la hora de cierre como último slot.
 */
export function getAvailableSlotsForDate(date: Date, now: Date = new Date()): string[] {
  const earliest = earliestAllowedDateTime(now);
  const slots: string[] = [];
  for (const window of getWindowsForDate(date)) {
    const start = toMinutes(window.start);
    const end = toMinutes(window.end);
    for (let t = start; t <= end; t += SLOT_INTERVAL_MINUTES) {
      if (slotDateTime(date, t).getTime() >= earliest.getTime()) {
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

/**
 * Valida una combinación fecha ("yyyy-MM-dd") + hora ("HH:MM") elegida por el
 * cliente. Se usa tanto en la UI como al registrar el pedido.
 */
export function isRequestedSlotValid(
  requestedDate: string,
  requestedTime: string,
  now: Date = new Date()
): boolean {
  const [y, m, d] = requestedDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return false;
  return getAvailableSlotsForDate(date, now).includes(requestedTime);
}
