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

describe("pedidos urgentes (menos de 3 días naturales, aceptados desde el 29/08/2026)", () => {
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

  it("agotado el día, el primer hueco salta al día (y mes) siguiente", () => {
    // Lunes 31/08 a las 22:30: ya no queda hora hoy. El selector se apoya en
    // esto para abrir el calendario en septiembre en vez de en un agosto
    // entero en gris.
    const lateLastDayOfMonth = new Date(2026, 7, 31, 22, 30, 0);
    const first = findFirstAvailableSlot(lateLastDayOfMonth);
    expect(first).not.toBeNull();
    expect(first!.date.getMonth()).toBe(8); // septiembre
    expect(first!.date.getDate()).toBe(1);
    expect(first!.time).toBe("10:00");
  });

  it("el umbral cae a MEDIANOCHE del tercer día, no a media jornada", () => {
    // NOW es el martes 18/08 a las 18:00. Con 3 días naturales el umbral es el
    // viernes 21/08 a las 00:00, así que el viernes entero ya tiene margen.
    expect(isSlotUrgent(new Date(2026, 7, 20), "21:30", NOW)).toBe(true);
    expect(isSlotUrgent(new Date(2026, 7, 21), "10:00", NOW)).toBe(false);
    expect(isSlotUrgent(new Date(2026, 7, 19), "12:00", NOW)).toBe(true);
    expect(isSlotUrgent(new Date(2026, 7, 22), "10:00", NOW)).toBe(false);
  });

  it("son urgentes hoy, mañana y pasado; el tercer día ya no", () => {
    // Es la regla tal como la dice Dulce Flor: «hasta el segundo día urgente,
    // el día 3 ya no es necesario».
    expect(isDateUrgent(new Date(2026, 7, 18), NOW)).toBe(true); // hoy
    expect(isDateUrgent(new Date(2026, 7, 19), NOW)).toBe(true); // mañana
    expect(isDateUrgent(new Date(2026, 7, 20), NOW)).toBe(true); // pasado
    expect(isDateUrgent(new Date(2026, 7, 21), NOW)).toBe(false); // tercer día
  });

  it("la HORA a la que se pide ya no cambia si el pedido es urgente", () => {
    // Esta era la queja de Dulce Flor, y tenía razón: con 72 h rodantes, pedir
    // el martes a las 9:00 para el viernes eran 73 h (sin recargo) y pedirlo
    // ese mismo martes a las 21:30 eran 62 h (con 5 € de recargo). El mismo
    // viernes, dos precios distintos según la hora. Imposible de explicar en
    // el mostrador.
    const viernes = new Date(2026, 7, 21);
    const martesTemprano = new Date(2026, 7, 18, 9, 0, 0);
    const martesTarde = new Date(2026, 7, 18, 21, 30, 0);
    expect(isDateUrgent(viernes, martesTemprano)).toBe(false);
    expect(isDateUrgent(viernes, martesTarde)).toBe(false);

    // Y al revés: el jueves es urgente se pida a la hora que se pida.
    const jueves = new Date(2026, 7, 20);
    expect(isDateUrgent(jueves, martesTemprano)).toBe(true);
    expect(isDateUrgent(jueves, martesTarde)).toBe(true);
  });

  it("ya no hay días a medias: o el día entero es urgente, o no lo es", () => {
    // isDateFullyUrgent existía porque el umbral de 72 h partía un día por la
    // mitad. Con días naturales coincide siempre con isDateUrgent, y SlotPicker
    // se apoya en eso para pintar cada día de un solo color.
    for (const dia of [18, 19, 20, 21, 22, 25, 31]) {
      const fecha = new Date(2026, 7, dia);
      expect(isDateFullyUrgent(fecha, NOW)).toBe(isDateUrgent(fecha, NOW));
    }
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
