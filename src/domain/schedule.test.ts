import { describe, expect, it } from "vitest";
import {
  findFirstAvailableSlot,
  getAvailableSlotsForDate,
  isDateSelectable,
  isOpenOn,
  isRequestedSlotValid,
} from "./schedule";

/**
 * Reglas confirmadas por Dulce Flor (17/08/2026):
 * horario 10:00–22:00 todos los días, antelación mínima 3 días (72 h).
 *
 * Referencia temporal fija: martes 2026-08-18 a las 18:00.
 * Con 72 h de antelación, el primer instante permitido es el viernes
 * 2026-08-21 a las 18:00.
 */
const NOW = new Date(2026, 7, 18, 18, 0, 0);

describe("horario comercial (confirmado: 10:00–22:00 todos los días)", () => {
  it("abre todos los días de la semana", () => {
    for (let d = 0; d < 7; d++) {
      const date = new Date(2026, 7, 23 + d); // domingo 23 → sábado 29
      expect(isOpenOn(date)).toBe(true);
    }
  });

  it("un día con antelación cumplida ofrece de 10:00 a 22:00 sin cortes", () => {
    const saturday = new Date(2026, 7, 22);
    const slots = getAvailableSlotsForDate(saturday, NOW);
    expect(slots[0]).toBe("10:00");
    expect(slots[slots.length - 1]).toBe("22:00");
    expect(slots).toContain("15:00"); // sin cierre de mediodía
    expect(slots).not.toContain("09:30");
    expect(slots).not.toContain("22:30");
  });
});

describe("antelación mínima de 72 h (confirmada: mínimo 3 días)", () => {
  it("una fecha con menos de 72 h no es seleccionable", () => {
    expect(isDateSelectable(new Date(2026, 7, 19), NOW)).toBe(false); // +1 día
    expect(isDateSelectable(new Date(2026, 7, 20), NOW)).toBe(false); // +2 días
  });

  it("el día del corte solo ofrece horas posteriores al corte", () => {
    // Viernes 21/08: el corte cae a las 18:00 → solo slots de 18:00 a 22:00.
    const friday = new Date(2026, 7, 21);
    const slots = getAvailableSlotsForDate(friday, NOW);
    expect(slots[0]).toBe("18:00");
    expect(slots).toContain("22:00");
    expect(slots).not.toContain("17:30");
    expect(slots).not.toContain("10:00");
  });

  it("primer slot disponible: viernes 21/08 a las 18:00", () => {
    const first = findFirstAvailableSlot(NOW);
    expect(first).not.toBeNull();
    expect(first!.date.getDate()).toBe(21);
    expect(first!.time).toBe("18:00");
  });

  it("si el corte cae entre dos slots, redondea al siguiente", () => {
    // Martes 18/08 a las 10:15 + 72 h → viernes 21/08 10:15 → primer slot 10:30.
    const now = new Date(2026, 7, 18, 10, 15, 0);
    const first = findFirstAvailableSlot(now);
    expect(first!.date.getDate()).toBe(21);
    expect(first!.time).toBe("10:30");
  });
});

describe("validación de slot solicitado", () => {
  it("acepta una combinación válida", () => {
    expect(isRequestedSlotValid("2026-08-22", "10:30", NOW)).toBe(true);
    expect(isRequestedSlotValid("2026-08-22", "22:00", NOW)).toBe(true);
  });

  it("rechaza horas fuera de horario y fechas dentro de la antelación", () => {
    expect(isRequestedSlotValid("2026-08-22", "09:30", NOW)).toBe(false); // antes de abrir
    expect(isRequestedSlotValid("2026-08-22", "22:30", NOW)).toBe(false); // tras el cierre
    expect(isRequestedSlotValid("2026-08-20", "12:00", NOW)).toBe(false); // < 72 h
    expect(isRequestedSlotValid("fecha-mala", "10:00", NOW)).toBe(false);
  });
});
