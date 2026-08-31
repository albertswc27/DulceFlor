/**
 * Selector de fecha y hora en calendario mensual: se puede reservar con
 * meses de antelación (confirmado 29/08/2026) y también para dentro de menos
 * de 3 días, en cuyo caso el pedido es URGENTE y se avisa aquí mismo.
 * Qué días y horas se ofrecen lo decide el dominio (domain/schedule.ts).
 */
import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BUSINESS_HOURS,
  MAX_ORDER_ADVANCE_MONTHS,
  STANDARD_ORDER_LEAD_TIME_HOURS,
} from "@/config/business";
import {
  findFirstAvailableSlot,
  getAvailableSlotsForDate,
  isDateFullyUrgent,
  isDateSelectable,
  isDateUrgent,
  isRequestedSlotValid,
  isSlotUrgent,
  latestAllowedDateTime,
} from "@/domain/schedule";
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

const STANDARD_LEAD_DAYS = STANDARD_ORDER_LEAD_TIME_HOURS / 24;

interface SlotPickerProps {
  selectedDate: string | null; // "yyyy-MM-dd"
  selectedTime: string | null; // "HH:MM"
  onSelect: (date: string | null, time: string | null) => void;
  /**
   * Cambia el texto del aviso de urgencia: al público se le pide confirmar
   * por WhatsApp; en el kiosk es el propio equipo quien registra el pedido.
   */
  variant?: "public" | "kiosk";
}

/**
 * Aviso de pedido urgente, con el texto adecuado a quién lo está viendo y a
 * lo elegido. En el día frontera (solo las primeras horas son urgentes) no se
 * puede afirmar «quedan menos de 3 días» del día entero: se dice desde qué
 * hora hay margen normal.
 */
function UrgentNotice({
  variant,
  timeChosen,
  calmFromTime,
}: {
  variant: "public" | "kiosk";
  timeChosen: boolean;
  /** Primera hora del día elegido que ya NO es urgente (día frontera). */
  calmFromTime: string | null;
}) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      {!timeChosen && calmFromTime ? (
        <span>
          <strong>
            Este día, las horas anteriores a las {calmFromTime} son urgentes
          </strong>{" "}
          (quedan menos de {STANDARD_LEAD_DAYS} días para ellas).{" "}
          {variant === "public"
            ? "Si eliges una de esas horas, necesitaremos confirmarte por WhatsApp si llegamos a tiempo."
            : "Si eliges una de esas horas, el pedido quedará marcado como urgente en el panel."}
        </span>
      ) : (
        <span>
          <strong>
            {timeChosen ? "Pedido urgente" : "Fecha urgente"}: quedan menos de{" "}
            {STANDARD_LEAD_DAYS} días.
          </strong>{" "}
          {variant === "public"
            ? "Puedes pedirlo igualmente, pero necesitamos confirmarte por WhatsApp si llegamos a tiempo: envíanos el resumen en cuanto termines."
            : "Quedará marcado como urgente en el panel: confirma con el obrador que da tiempo antes de comprometerlo."}
        </span>
      )}
    </p>
  );
}

export function SlotPicker({
  selectedDate,
  selectedTime,
  onSelect,
  variant = "public",
}: SlotPickerProps) {
  // Un reloj VIVO, no fijo por montaje. Con la antelación de 72 h daba igual,
  // pero ahora se puede pedir para el mismo día y el kiosk deja este selector
  // montado horas: con un reloj congelado ofrecería horas ya pasadas que
  // submitOrder rechazaría después, sin salida a la vista.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const refresh = () => setNow(new Date());
    const id = window.setInterval(refresh, 60_000);
    // La tablet del kiosk pasa ratos dormida: al volver, el reloj al día.
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Poda la selección que el paso del tiempo (o un borrador restaurado de
  // otra sesión) haya dejado inválida: la hora desaparece de la rejilla y no
  // debe quedarse "elegida" en el borrador para estrellarse en submitOrder.
  React.useEffect(() => {
    if (!selectedDate) return;
    const day = parseISO(selectedDate);
    if (Number.isNaN(day.getTime()) || !isDateSelectable(day, now)) {
      onSelect(null, null);
      return;
    }
    if (selectedTime && !isRequestedSlotValid(selectedDate, selectedTime, now)) {
      onSelect(selectedDate, null);
    }
  }, [now, selectedDate, selectedTime, onSelect]);

  // El primer mes navegable es el del primer hueco libre, no el de hoy: la
  // noche del último día del mes ya no queda nada elegible en este mes y el
  // calendario se abriría entero en gris, sin pista de que hay que pulsar la
  // flecha para ver el siguiente.
  const firstMonth = startOfMonth(
    findFirstAvailableSlot(now)?.date ?? now
  );
  const lastMonth = startOfMonth(latestAllowedDateTime(now));

  const [month, setMonth] = React.useState<Date>(() => {
    // Arranca en el mes de la fecha ya elegida (si sigue dentro de los
    // límites); si no, en el del primer hueco disponible.
    if (selectedDate) {
      const chosen = startOfMonth(parseISO(selectedDate));
      if (chosen >= firstMonth && chosen <= lastMonth) return chosen;
    }
    return firstMonth;
  });

  // Con el reloj vivo, el mes visible puede quedarse fuera de los límites
  // (pasa la medianoche del día 1, o se agota el mes en curso): se recoloca
  // en vez de dejar a la vista un mes que ya no se puede elegir.
  const firstMonthTime = firstMonth.getTime();
  const lastMonthTime = lastMonth.getTime();
  React.useEffect(() => {
    setMonth((current) => {
      if (current.getTime() < firstMonthTime) return new Date(firstMonthTime);
      if (current.getTime() > lastMonthTime) return new Date(lastMonthTime);
      return current;
    });
  }, [firstMonthTime, lastMonthTime]);

  const canGoPrev = month > firstMonth;
  const canGoNext = month < lastMonth;

  const weeks = React.useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [month]);

  const selectedDay = selectedDate ? parseISO(selectedDate) : null;
  const slots = selectedDay ? getAvailableSlotsForDate(selectedDay, now) : [];
  // Como los slots van en orden, urgencia del primero = "hay alguna urgente".
  const dayHasUrgentSlots =
    selectedDay && slots.length > 0 && isSlotUrgent(selectedDay, slots[0], now);
  // Día frontera: primera hora con margen normal (null si todas son urgentes).
  const calmFromTime =
    selectedDay && dayHasUrgentSlots
      ? (slots.find((slot) => !isSlotUrgent(selectedDay, slot, now)) ?? null)
      : null;
  const showUrgentNotice =
    selectedDay && selectedTime
      ? isSlotUrgent(selectedDay, selectedTime, now)
      : Boolean(dayHasUrgentSlots);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 font-display text-base font-semibold text-primary">
          Elige el día
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Puedes reservar con hasta {MAX_ORDER_ADVANCE_MONTHS} meses de
          antelación. Recomendamos pedir con al menos {STANDARD_LEAD_DAYS} días:
          con menos margen el pedido es urgente.
          {CLOSED_DAYS.length > 0 && ` Los ${CLOSED_DAYS.join(" y los ")} cerramos.`}
        </p>

        {/* Cabecera de navegación por meses */}
        <div className="mb-2 flex items-center justify-between gap-2">
          {/* aria-disabled en vez de disabled: si el botón se deshabilitara
              bajo el foco de teclado, el foco caería al body. */}
          <button
            type="button"
            aria-label="Mes anterior"
            aria-disabled={!canGoPrev}
            onClick={() => {
              if (canGoPrev) setMonth((m) => addMonths(m, -1));
            }}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              canGoPrev ? "hover:border-secondary" : "cursor-default opacity-40"
            )}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p
            aria-live="polite"
            className="font-display text-lg font-bold capitalize text-primary"
          >
            {format(month, "MMMM yyyy", { locale: es })}
          </p>
          <button
            type="button"
            aria-label="Mes siguiente"
            aria-disabled={!canGoNext}
            onClick={() => {
              if (canGoNext) setMonth((m) => addMonths(m, 1));
            }}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              canGoNext ? "hover:border-secondary" : "cursor-default opacity-40"
            )}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Rejilla del mes */}
        <div role="group" aria-label="Fecha de recogida o entrega">
          <div className="grid grid-cols-7 gap-1">
            {weeks[0].map((day) => (
              <span
                key={day.toISOString()}
                aria-hidden="true"
                className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {format(day, "EEEEEE", { locale: es })}
              </span>
            ))}
          </div>
          <div className="mt-1 space-y-1">
            {weeks.map((week) => (
              <div key={week[0].toISOString()} className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  if (!isSameMonth(day, month)) {
                    // Hueco de otro mes: mantiene la cuadrícula alineada.
                    return <span key={day.toISOString()} aria-hidden="true" />;
                  }
                  const iso = format(day, "yyyy-MM-dd");
                  const selectable = isDateSelectable(day, now);
                  // Ámbar si tiene ALGUNA hora urgente; la etiqueta «urgente»
                  // solo si lo son TODAS (en el día frontera sería mentira).
                  const urgent = selectable && isDateUrgent(day, now);
                  const fullyUrgent = urgent && isDateFullyUrgent(day, now);
                  const isSelected = iso === selectedDate;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={!selectable}
                      aria-pressed={isSelected}
                      aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${
                        fullyUrgent
                          ? " (fecha urgente)"
                          : urgent
                            ? " (primeras horas urgentes)"
                            : ""
                      }`}
                      onClick={() => onSelect(iso, null)}
                      className={cn(
                        "relative flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-sm font-medium transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        !selectable && "cursor-default border-transparent text-muted-foreground/40",
                        selectable &&
                          !isSelected &&
                          (urgent
                            ? "border-warning/50 bg-warning/10 hover:border-warning"
                            : "border-border bg-card hover:border-secondary"),
                        isSelected &&
                          "border-primary bg-primary text-primary-foreground shadow-soft"
                      )}
                    >
                      <span className="font-display text-base font-bold leading-none">
                        {format(day, "d")}
                      </span>
                      {fullyUrgent && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 text-[0.6rem] font-semibold uppercase leading-none tracking-wide",
                            isSelected ? "text-primary-foreground/90" : "text-warning"
                          )}
                        >
                          urgente
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showUrgentNotice && (
        <UrgentNotice
          variant={variant}
          timeChosen={Boolean(selectedTime)}
          calmFromTime={calmFromTime}
        />
      )}

      {selectedDay && (
        <div>
          {/* La fecha va en el título: al hojear otros meses, el día elegido
              puede no estar a la vista y las horas deben decir de qué día son. */}
          <h3 className="mb-2 font-display text-base font-semibold text-primary">
            Elige la hora ·{" "}
            {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
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
                // En un día a caballo del umbral, solo las primeras horas son
                // urgentes: se marcan para que se vea dónde cambia la cosa.
                const urgent = isSlotUrgent(selectedDay, slot, now);
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${slot}${urgent ? " (hora urgente)" : ""}`}
                    onClick={() => onSelect(selectedDate, slot)}
                    className={cn(
                      "min-h-[44px] rounded-lg border px-2 py-2 text-sm font-medium transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-soft"
                        : urgent
                          ? "border-warning/50 bg-warning/10 hover:border-warning"
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
