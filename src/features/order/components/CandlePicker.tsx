/**
 * Selector de velas, compartido por los configuradores de tarta (clásica,
 * personalizada y fondant). El precio unitario sale de la configuración
 * central: aquí nunca se escribe un importe a mano.
 */
import { Cake, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CANDLE_UNIT_PRICE_CENTS, MAX_CANDLES } from "@/config/business";
import { formatEuros } from "@/domain/money";
import { cn } from "@/lib/utils";

interface CandlePickerProps {
  quantity: number;
  onChange: (quantity: number) => void;
  className?: string;
}

export function CandlePicker({ quantity, onChange, className }: CandlePickerProps) {
  const safe = Math.min(MAX_CANDLES, Math.max(0, Math.floor(quantity)));
  const subtotal = safe * CANDLE_UNIT_PRICE_CENTS;

  return (
    <fieldset className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <legend className="flex items-center gap-2 px-1 font-display text-base font-semibold text-primary">
        <Cake className="h-4 w-4 text-accent" aria-hidden="true" />
        Velas
      </legend>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatEuros(CANDLE_UNIT_PRICE_CENTS)} por vela
        </p>

        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Quitar una vela"
            disabled={safe <= 0}
            onClick={() => onChange(Math.max(0, safe - 1))}
          >
            <Minus />
          </Button>
          <span
            role="status"
            className="min-w-[3rem] text-center font-display text-lg font-semibold text-primary"
          >
            <span className="sr-only">Velas: </span>
            {safe}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Añadir una vela"
            disabled={safe >= MAX_CANDLES}
            onClick={() => onChange(Math.min(MAX_CANDLES, safe + 1))}
          >
            <Plus />
          </Button>
        </div>
      </div>

      {safe > 0 && (
        <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-sm">
          <span className="text-muted-foreground">
            {safe} {safe === 1 ? "vela" : "velas"} × {formatEuros(CANDLE_UNIT_PRICE_CENTS)}
          </span>
          <span className="font-display text-base font-semibold text-primary">
            {formatEuros(subtotal)}
          </span>
        </p>
      )}
    </fieldset>
  );
}
