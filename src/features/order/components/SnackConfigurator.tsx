/**
 * Configurador de aperitivos con precio por volumen: se elige el pack
 * (15 / 25 / 50+ unidades) y el precio por unidad sale del tramo confirmado
 * por Dulce Flor. El cálculo vive en src/domain/pricing.
 */
import * as React from "react";
import { Check, Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatEuros } from "@/domain/money";
import { getMinimumQuantity, type CatalogProduct } from "@/domain/catalog";
import { computeUnitPriceCents } from "@/domain/pricing";
import { freeTextSchema } from "@/domain/validation";
import type { CustomerType, ItemCustomization } from "@/domain/types";
import { SAVOURY_PRODUCT_PHOTOS } from "@/assets/photos";
import { cn } from "@/lib/utils";
import { AnimatedPrice } from "./AnimatedPrice";
import type { ConfiguratorResult } from "./ProductConfigurator";

interface SnackConfiguratorProps {
  product: CatalogProduct;
  customerType: CustomerType;
  onConfirm: (result: ConfiguratorResult) => void;
  confirmLabel?: string;
  compact?: boolean;
}

/** Paso al subir/bajar unidades dentro del tramo abierto (50+). */
const STEP = 5;

export function SnackConfigurator({
  product,
  customerType,
  onConfirm,
  confirmLabel = "Añadir al pedido",
  compact = false,
}: SnackConfiguratorProps) {
  const reduced = useReducedMotion() ?? false;
  const tiers = product.quantityTiers ?? [];
  const minQuantity = getMinimumQuantity(product);
  const photo = SAVOURY_PRODUCT_PHOTOS[product.id];

  const [quantity, setQuantity] = React.useState<number>(minQuantity);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setQuantity(getMinimumQuantity(product));
    setNotes("");
    setError(null);
  }, [product]);

  const selection = {
    productId: product.id,
    customerType,
    sizeId: String(quantity),
    toppingIds: [],
    extraIds: [],
    quantity,
  };
  const unitPriceCents = computeUnitPriceCents(selection);
  const totalCents = unitPriceCents !== null ? unitPriceCents * quantity : null;

  /** El tramo abierto (50+) permite ajustar la cantidad exacta. */
  const openTier = tiers.find((t) => t.open);
  const isOpenTier = Boolean(openTier && quantity >= openTier.minQuantity);

  function handleConfirm() {
    const notesParsed = freeTextSchema.safeParse(notes);
    if (!notesParsed.success) {
      setError(notesParsed.error.issues[0].message);
      return;
    }
    if (unitPriceCents === null) {
      setError(`El pedido mínimo es de ${minQuantity} unidades.`);
      return;
    }
    const customization: ItemCustomization = {
      size: { id: String(quantity), label: `${quantity} unidades` },
      toppings: [],
      extras: [],
      notes: notes.trim() || undefined,
    };
    setError(null);
    onConfirm({ selection, customization, quantity });
  }

  return (
    <div className="space-y-6">
      {photo && !compact && (
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          width={1000}
          height={1000}
          className="aspect-[4/3] w-full rounded-2xl border border-border object-cover shadow-card"
        />
      )}

      <fieldset>
        <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
          <span className="font-display text-base font-semibold text-primary">
            ¿Cuántas unidades?
          </span>
          <span className="text-xs text-muted-foreground">
            Mínimo {minQuantity} uds.
          </span>
        </legend>
        <p className="mb-3 text-sm text-muted-foreground">
          Cuantas más unidades, menor es el precio por unidad.
        </p>

        <div role="group" aria-label="Cantidad" className="grid gap-2.5 sm:grid-cols-3">
          {tiers.map((tier) => {
            const selected = tier.open
              ? isOpenTier
              : quantity >= tier.minQuantity &&
                quantity < (tiers.find((t) => t.minQuantity > tier.minQuantity)?.minQuantity ?? Infinity);
            const tierTotal = tier.unitPriceCents * tier.minQuantity;
            return (
              <motion.button
                key={tier.id}
                type="button"
                aria-pressed={selected}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                onClick={() => setQuantity(tier.minQuantity)}
                className={cn(
                  "relative flex min-h-[48px] flex-col items-start rounded-2xl border bg-card px-4 py-3 text-left transition-all duration-200",
                  "hover:border-secondary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/[0.04] shadow-lifted ring-1 ring-primary/40"
                    : "border-border"
                )}
              >
                {selected && (
                  <span
                    aria-hidden
                    className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
                <span className="font-display text-lg font-bold text-primary">
                  {tier.open ? `${tier.minQuantity}+ uds` : `${tier.minQuantity} uds`}
                </span>
                <span className="mt-0.5 text-sm text-muted-foreground">
                  {formatEuros(tier.unitPriceCents)}/ud
                </span>
                {!tier.open && (
                  <span className="mt-1 text-sm font-medium text-foreground">
                    {formatEuros(tierTotal)}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Ajuste fino de la cantidad dentro del tramo abierto */}
        {isOpenTier && openTier && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background-soft/70 p-3">
            <span className="text-sm text-muted-foreground">
              Ajusta la cantidad exacta ({openTier.minQuantity} uds o más)
            </span>
            <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar unidades"
                disabled={quantity <= openTier.minQuantity}
                onClick={() => setQuantity((q) => Math.max(openTier.minQuantity, q - STEP))}
              >
                <Minus />
              </Button>
              <span
                role="status"
                className="min-w-[4rem] text-center font-display text-lg font-semibold text-primary"
              >
                <span className="sr-only">Cantidad: </span>
                {quantity} uds
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Añadir unidades"
                disabled={quantity >= 500}
                onClick={() => setQuantity((q) => Math.min(500, q + STEP))}
              >
                <Plus />
              </Button>
            </div>
          </div>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`notas-${product.id}`}>¿Alguna indicación?</Label>
        <Textarea
          id={`notas-${product.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Por ejemplo: sin cebolla, alergias, presentación en bandeja…"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Si pides algo fuera de lo habitual, Dulce Flor te confirmará si
          afecta al precio.
        </p>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {quantity} unidades
            {unitPriceCents !== null && ` · ${formatEuros(unitPriceCents)}/ud`}
          </p>
          {totalCents !== null ? (
            <AnimatedPrice cents={totalCents} className="text-2xl" />
          ) : (
            <p className="font-display text-lg text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="button" size="xl" className="w-full" onClick={handleConfirm}>
        {confirmLabel}
        {totalCents !== null && ` · ${formatEuros(totalCents)}`}
      </Button>
    </div>
  );
}
