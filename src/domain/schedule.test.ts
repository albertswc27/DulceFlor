import { describe, expect, it } from "vitest";
import {
  findFirstAvailableSlot,
  getAvailableSlotsForDate,
  isDateFullyUrgent,
  isDateSelectable,
  isDateUrgent,
  isOpenOn,
  isRequestedSlotUrgent,
  isRequestedSlotValid,
  isSlotUrgent,
} from "./schedule";

/**
 * Reglas confirmadas por Dulce Flor:
 *  - Horario 10:00–22:00 todos los días (17/08/2026).
 *  - Antelación estándar 3 días (17/08/2026), matizada el 29/08/2026: ya NO
 *    bloquea. Con menos margen el pedido se acepta como URGENTE (colchón
 *    mínimo de 60 minutos) y se confirma por WhatsApp.
 *  - Reserva con hasta 6 meses de antelación (29/08/2026).
 *
 * Referencia temporal fija: martes 2026-08-18 a las 18:00.
 *  - Colchón urgente: primer instante seleccionable hoy a las 19:00.
 *  - Umbral de urgencia (72 h): viernes 2026-08-21 a las 18:00.
 *  - Límite de reserva: jueves 2027-02-18 (día completo).
 */
const NOW = new Date(2026, 7, 18, 18, 0, 0);

describe("horario comercial (confirmado: 10:00–22:00 todos los días)", () => {
  it("abre todos los días de la semana", () => {
    for (let d = 0; d < 7; d++) {
      const date = new Date(2026, 7, 23 + d); // domingo 23 → sábado 29
      expect(isOpenOn(date)).toBe(true);
    }
  });

  it("un día con margen ofrece de 10:00 a 22:00 sin cortes", () => {
    const saturday = new Date(2026, 7, 22);
    const slots = getAvailableSlotsForDate(saturday, NOW);
    expect(slots[0]).toBe("10:00");
    expect(slots[slots.length - 1]).toBe("22:00");
    expect(slots).toContain("15:00"); // sin cierre de mediodía
    expect(slots).not.toContain("09:30");
    expect(slots).not.toContain("22:30");
  });
});

describe("pedidos urgentes (menos de 72 h, aceptados desde el 29/08/2026)", () => {
  it("las fechas dentro de las 72 h ahora SÍ son seleccionables", () => {
    expect(isDateSelectable(new Date(2026, 7, 18), NOW)).toBe(true); // hoy
    expect(isDateSelectable(new Date(2026, 7, 19), NOW)).toBe(true); // +1 día
    expect(isDateSelectable(new Date(2026, 7, 20), NOW)).toBe(true); // +2 días
  });

  it("hoy solo ofrece horas a partir del colchón de 60 minutos", () => {
    // NOW 18:00 + 60 min = 19:00 → primer slot 19:00.
    const today = new Date(2026, 7, 18);
    const slots = getAvailableSlotsForDate(today, NOW);
    expect(slots[0]).toBe("19:00");
    expect(slots).toContain("22:00");
    expect(slots).not.toContain("18:30");
  });

  it("si el colchón cae entre dos slots, redondea al siguiente", () => {
    // 18:10 + 60 min = 19:10 → primer slot 19:30.
    const now = new Date(2026, 7, 18, 18, 10, 0);
    const slots = getAvailableSlotsForDate(new Date(2026, 7, 18), now);
    expect(slots[0]).toBe("19:30");
  });

  it("el primer slot disponible es hoy mismo", () => {
    const first = findFirstAvailableSlot(NOW);
    expect(first).not.toBeNull();
    expect(first!.date.getDate()).toBe(18);
    expect(first!.time).toBe("19:00");
  });

  it("clasifica la urgencia por slot: antes del umbral sí, después no", () => {
    // El umbral (72 h) cae el viernes 21/08 a las 18:00.
    const friday = new Date(2026, 7, 21);
    expect(isSlotUrgent(friday, "17:30", NOW)).toBe(true);
    expect(isSlotUrgent(friday, "18:00", NOW)).toBe(false); // 72 h exactas: no urgente
    expect(isSlotUrgent(new Date(2026, 7, 19), "12:00", NOW)).toBe(true);
    expect(isSlotUrgent(new Date(2026, 7, 22), "10:00", NOW)).toBe(false);
  });

  it("marca como urgentes los días que ofrecen algún slot urgente", () => {
    expect(isDateUrgent(new Date(2026, 7, 18), NOW)).toBe(true); // hoy
    expect(isDateUrgent(new Date(2026, 7, 21), NOW)).toBe(true); // día mixto
    expect(isDateUrgent(new Date(2026, 7, 22), NOW)).toBe(false); // con margen
  });

  it("distingue el día frontera (mixto) de un día urgente entero", () => {
    // Viernes 21/08: urgente hasta las 17:30, con margen desde las 18:00.
    expect(isDateFullyUrgent(new Date(2026, 7, 21), NOW)).toBe(false);
    expect(isDateFullyUrgent(new Date(2026, 7, 19), NOW)).toBe(true);
    expect(isDateFullyUrgent(new Date(2026, 7, 22), NOW)).toBe(false);
  });

  it("clasifica la combinación fecha+hora elegida por el cliente", () => {
    expect(isRequestedSlotUrgent("2026-08-20", "12:00", NOW)).toBe(true);
    expect(isRequestedSlotUrgent("2026-08-22", "12:00", NOW)).toBe(false);
    expect(isRequestedSlotUrgent("fecha-mala", "12:00", NOW)).toBe(false);
  });
});

describe("horizonte máximo de reserva (6 meses)", () => {
  it("el día límite (18/02/2027) aún se puede elegir entero", () => {
    const limitDay = new Date(2027, 1, 18);
    const slots = getAvailableSlotsForDate(limitDay, NOW);
    expect(slots[0]).toBe("10:00");
    expect(slots[slots.length - 1]).toBe("22:00");
    expect(isRequestedSlotValid("2027-02-18", "22:00", NOW)).toBe(true);
  });

  it("más allá del límite no hay fechas seleccionables", () => {
    expect(isDateSelectable(new Date(2027, 1, 19), NOW)).toBe(false);
    expect(isRequestedSlotValid("2027-02-19", "12:00", NOW)).toBe(false);
    expect(isRequestedSlotValid("2027-06-01", "12:00", NOW)).toBe(false);
  });
});

describe("validación de slot solicitado", () => {
  it("acepta combinaciones válidas, con margen o urgentes", () => {
    expect(isRequestedSlotValid("2026-08-22", "10:30", NOW)).toBe(true);
    expect(isRequestedSlotValid("2026-08-22", "22:00", NOW)).toBe(true);
    expect(isRequestedSlotValid("2026-08-20", "12:00", NOW)).toBe(true); // urgente
    expect(isRequestedSlotValid("2026-08-18", "19:00", NOW)).toBe(true); // hoy
  });

  it("rechaza horas fuera de horario, sin colchón o mal formadas", () => {
    expect(isRequestedSlotValid("2026-08-22", "09:30", NOW)).toBe(false); // antes de abrir
    expect(isRequestedSlotValid("2026-08-22", "22:30", NOW)).toBe(false); // tras el cierre
    expect(isRequestedSlotValid("2026-08-18", "18:30", NOW)).toBe(false); // < 60 min
    expect(isRequestedSlotValid("2026-08-17", "12:00", NOW)).toBe(false); // pasado
    expect(isRequestedSlotValid("fecha-mala", "10:00", NOW)).toBe(false);
  });

  it("una fecha imposible no se «corrige» a otra: es inválida", () => {
    // new Date(2026, 8, 31) sería el 1 de octubre; aquí debe rechazarse.
    expect(isRequestedSlotValid("2026-09-31", "12:00", NOW)).toBe(false);
    expect(isRequestedSlotValid("2026-13-01", "12:00", NOW)).toBe(false);
    expect(isRequestedSlotUrgent("2026-09-31", "12:00", NOW)).toBe(false);
  });
});
