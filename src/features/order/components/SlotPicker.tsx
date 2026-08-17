/**
 * Selector de fecha y hora: solo ofrece fechas con al menos un slot válido
 * (horario comercial + antelación mínima), calculadas por el dominio.
 */
import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BUSINESS_HOURS, MIN_ORDER_LEAD_TIME_HOURS } from "@/config/business";
import { getAvailableSlotsForDate, isDateSelectable } from "@/domain/schedule";
import { cn } from "@/lib/utils";

const DAY_NAMES_PLURAL = [
  "domingos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábados",
];

/** Días cerrados derivados de la configuración (no textos a mano). */
const CLOSED_DAYS = Object.entries(BUSINESS_HOURS)
  .filter(([, windows]) => windows.length === 0)
  .map(([day]) => DAY_NAMES_PLURAL[Number(day)]);

const DAYS_TO_SHOW = 21;

interface SlotPickerProps {
  selectedDate: string | null; // "yyyy-MM-dd"
  selectedTime: string | null; // "HH:MM"
  onSelect: (date: string | null, time: string | null) => void;
}

interface DayOption {
  iso: string;
  date: Date;
}

export function SlotPicker({ selectedDate, selectedTime, onSelect }: SlotPickerProps) {
  // `now` fijo por montaje: suficiente para una sesión de compra.
  const [now] = React.useState(() => new Date());

  const days = React.useMemo<DayOption[]>(() => {
    const result: DayOption[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    // Busca hasta 60 días para reunir DAYS_TO_SHOW fechas seleccionables.
    for (let i = 0; i < 60 && result.length < DAYS_TO_SHOW; i++) {
      if (isDateSelectable(cursor, now)) {
        result.push({ iso: format(cursor, "yyyy-MM-dd"), date: new Date(cursor) });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [now]);

  const selectedDay = days.find((d) => d.iso === selectedDate) ?? null;
  const slots = selectedDay ? getAvailableSlotsForDate(selectedDay.date, now) : [];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 font-display text-base font-semibold text-primary">
          Elige el día
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Trabajamos con una antelación mínima de {MIN_ORDER_LEAD_TIME_HOURS / 24} días.
          {CLOSED_DAYS.length > 0 && ` Los ${CLOSED_DAYS.join(" y los ")} cerramos.`}
        </p>
        <div
          role="group"
          aria-label="Fecha de recogida o entrega"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {days.map((day) => {
            const isSelected = day.iso === selectedDate;
            return (
              <button
                key={day.iso}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(day.iso, null)}
                className={cn(
                  "flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card hover:border-secondary"
                )}
              >
                <span className="text-xs uppercase tracking-wide opacity-80">
                  {format(day.date, "EEE", { locale: es })}
                </span>
                <span className="font-display text-xl font-bold leading-tight">
                  {format(day.date, "d")}
                </span>
                <span className="text-xs opacity-80">
                  {format(day.date, "MMM", { locale: es })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div>
          <h3 className="mb-2 font-display text-base font-semibold text-primary">
            Elige la hora
          </h3>
          {slots.length === 0 ? (
            <p className="rounded-lg bg-background-soft px-4 py-3 text-sm text-muted-foreground">
              No quedan horas disponibles este día. Prueba con otra fecha.
            </p>
          ) : (
            <div
              role="group"
              aria-label="Hora"
              className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
            >
              {slots.map((slot) => {
                const isSelected = slot === selectedTime;
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(selectedDay.iso, slot)}
                    className={cn(
                      "min-h-[44px] rounded-lg border px-2 py-2 text-sm font-medium transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-soft"
                        : "border-border bg-card hover:border-secondary"
                    )}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
