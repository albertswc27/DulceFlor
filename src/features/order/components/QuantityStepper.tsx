import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label = "Cantidad",
}: QuantityStepperProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Reducir ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus />
      </Button>
      <span
        role="status"
        className="min-w-[2.5rem] text-center font-display text-lg font-semibold text-primary"
      >
        <span className="sr-only">{label}: </span>
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Aumentar ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus />
      </Button>
    </div>
  );
}
