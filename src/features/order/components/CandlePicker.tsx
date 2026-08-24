/**
 * Velas y bengalas, compartido por los configuradores de tarta (clásica,
 * personalizada y fondant).
 *
 * Las velas de número son cifras, no unidades sueltas: el cliente compone el
 * número que quiere ver sobre la tarta pulsando dígitos, y puede repetir el
 * mismo (22, 33) porque cada pulsación es una vela física distinta. Por eso el
 * orden importa y no se puede modelar como un contador: "25" y "52" son
 * pedidos distintos.
 *
 * Esa misma cifra puede montarse con velas normales o con bengalas, y el
 * acabado cambia el precio por unidad. Las bengalas sin número son un concepto
 * aparte, con su propio precio, así que van en su propia línea.
 *
 * Todos los importes salen de la configuración central: aquí nunca se escribe
 * un precio a mano.
 */
import { Cake, Delete, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CANDLE_UNIT_PRICE_CENTS,
  MAX_CANDLE_DIGITS,
  MAX_SPARKLERS,
  NUMBER_SPARKLER_PRICE_CENTS,
  PLAIN_SPARKLER_PRICE_CENTS,
} from "@/config/business";
import { formatEuros } from "@/domain/money";
import { normalizeCandleDigits, resolveCandleSelection } from "@/domain/pricing";
import type { CandleStyle } from "@/domain/types";
import { cn } from "@/lib/utils";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const STYLES: Array<{ id: CandleStyle; label: string; unitCents: number }> = [
  { id: "vela", label: "Vela", unitCents: CANDLE_UNIT_PRICE_CENTS },
  { id: "bengala", label: "Bengala", unitCents: NUMBER_SPARKLER_PRICE_CENTS },
];

interface CandlePickerProps {
  /** Cifra elegida, en el orden en que se lee sobre la tarta. */
  digits: string;
  /** Acabado de esa cifra: cambia el precio por unidad. */
  style: CandleStyle;
  /** Bengalas sin número. */
  sparklerQuantity: number;
  onDigitsChange: (digits: string) => void;
  onStyleChange: (style: CandleStyle) => void;
  onSparklerQuantityChange: (quantity: number) => void;
  className?: string;
}

export function CandlePicker({
  digits,
  style,
  sparklerQuantity,
  onDigitsChange,
  onStyleChange,
  onSparklerQuantityChange,
  className,
}: CandlePickerProps) {
  const safe = normalizeCandleDigits(digits);
  const selection = resolveCandleSelection({
    candleDigits: safe,
    candleStyle: style,
    sparklerQuantity,
  });
  const count = safe.length;
  const isFull = count >= MAX_CANDLE_DIGITS;
  const unitCents = selection.numbers?.unitCents ?? STYLES[0].unitCents;
  const sparklers = Math.min(MAX_SPARKLERS, Math.max(0, Math.floor(sparklerQuantity)));

  /**
   * Se quita la vela concreta que se pulsa, no la última: si pides 202 y te
   * sobra el primer 2, esperas que desaparezca ese.
   */
  const removeAt = (index: number) =>
    onDigitsChange(safe.slice(0, index) + safe.slice(index + 1));

  return (
    <fieldset className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <legend className="flex items-center gap-2 px-1 font-display text-base font-semibold text-primary">
        <Cake className="h-4 w-4 text-accent" aria-hidden="true" />
        Velas y bengalas
      </legend>

      {/* --- Cifra de números ------------------------------------------- */}
      <p className="mt-1 text-sm text-muted-foreground">
        Pulsa los números que quieres sobre la tarta, en orden. Puedes repetir
        uno (por ejemplo, 22).
      </p>

      <div
        className="mt-3 grid max-w-[19rem] grid-cols-5 gap-1.5 sm:max-w-[34rem] sm:grid-cols-10"
        role="group"
        aria-label="Números disponibles"
      >
        {DIGITS.map((digit) => {
          const used = safe.split("").filter((d) => d === digit).length;
          return (
            <button
              key={digit}
              type="button"
              onClick={() => !isFull && onDigitsChange(safe + digit)}
              disabled={isFull}
              aria-label={
                used > 0
                  ? `Añadir otro número ${digit}. Ya has elegido ${used}.`
                  : `Añadir el número ${digit}`
              }
              className={cn(
                "relative aspect-square rounded-lg border-2 font-display text-lg font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-40",
                used > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-blush/40"
              )}
            >
              {digit}
              {used > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                >
                  {used}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isFull && (
        <p className="mt-2 text-xs text-warning">
          Máximo {MAX_CANDLE_DIGITS} números. Quita alguno para cambiarlo.
        </p>
      )}

      {/* El acabado solo tiene sentido cuando ya hay una cifra que montar. */}
      {count > 0 && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Tu número:</span>
            <ol className="flex flex-wrap items-center gap-1.5">
              {safe.split("").map((digit, index) => (
                <li key={`${digit}-${index}`}>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    aria-label={`Quitar el número ${digit}, posición ${index + 1}`}
                    className="group flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-1.5 py-0.5 font-display text-base font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {digit}
                    <Delete
                      className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => onDigitsChange("")}
            >
              Quitar todos
            </Button>
          </div>

          <div className="mt-3" role="radiogroup" aria-label="Acabado de los números">
            <p className="mb-1.5 text-sm text-muted-foreground">¿Cómo las quieres?</p>
            <div className="grid max-w-md grid-cols-2 gap-2">
              {STYLES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={style === option.id}
                  onClick={() => onStyleChange(option.id)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2 text-left transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    style === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/60"
                  )}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatEuros(option.unitCents)} cada una
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p
            role="status"
            className="mt-2 flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="text-muted-foreground">
              {count} × {formatEuros(unitCents)}
            </span>
            <span className="font-display text-base font-semibold text-primary">
              {formatEuros(selection.numbers?.cents ?? 0)}
            </span>
          </p>
        </>
      )}

      {/* --- Bengalas sueltas ------------------------------------------- */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              Bengalas sin número
            </p>
            <p className="text-xs text-muted-foreground">
              {formatEuros(PLAIN_SPARKLER_PRICE_CENTS)} cada una
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar una bengala"
              disabled={sparklers <= 0}
              onClick={() => onSparklerQuantityChange(Math.max(0, sparklers - 1))}
            >
              <Minus />
            </Button>
            <span
              role="status"
              className="min-w-[2.5rem] text-center font-display text-lg font-semibold text-primary"
            >
              <span className="sr-only">Bengalas sin número: </span>
              {sparklers}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Añadir una bengala"
              disabled={sparklers >= MAX_SPARKLERS}
              onClick={() =>
                onSparklerQuantityChange(Math.min(MAX_SPARKLERS, sparklers + 1))
              }
            >
              <Plus />
            </Button>
          </div>
        </div>

        {selection.sparklers && (
          <p className="mt-2 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {selection.sparklers.quantity} ×{" "}
              {formatEuros(selection.sparklers.unitCents)}
            </span>
            <span className="font-display text-base font-semibold text-primary">
              {formatEuros(selection.sparklers.cents)}
            </span>
          </p>
        )}
      </div>

      {selection.totalCents === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Opcional. Si no quieres velas ni bengalas, deja este apartado como está.
        </p>
      )}
    </fieldset>
  );
}
