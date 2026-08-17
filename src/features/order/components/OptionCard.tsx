import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta seleccionable accesible usada en el configurador y el kiosk.
 * Semántica: botón conmutable (aria-pressed) — navegable con Tab, coherente
 * con su comportamiento real. `role` solo cambia la forma del indicador
 * visual (círculo tipo radio o cuadrado tipo checkbox). Área táctil ≥48 px.
 */
interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  price?: string;
  disabled?: boolean;
  /** Solo apariencia del indicador: "radio" (círculo) o "checkbox" (cuadrado). */
  role?: "radio" | "checkbox";
  className?: string;
  children?: React.ReactNode;
}

export function OptionCard({
  selected,
  onSelect,
  title,
  subtitle,
  price,
  disabled,
  role = "radio",
  className,
  children,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-[48px] w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all duration-200",
        "hover:border-secondary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/[0.04] shadow-card ring-1 ring-primary/40"
          : "border-border",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          role === "checkbox" && "rounded-md",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background group-hover:border-secondary"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium leading-snug text-foreground">{title}</span>
        {subtitle && (
          <span className="text-sm leading-snug text-muted-foreground">{subtitle}</span>
        )}
        {children}
      </span>
      {price && (
        <span className="shrink-0 font-display text-base font-semibold text-primary">
          {price}
        </span>
      )}
    </button>
  );
}
