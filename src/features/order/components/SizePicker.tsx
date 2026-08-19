/**
 * Selección de tamaño 100% visual: cada opción se representa con una
 * ilustración de tarta (ancho = personas, altura = discos) para que cualquier
 * persona identifique el tamaño antes incluso de leer los números.
 *
 * - Pasteles (matriz personas × discos): dos pasos — «¿Para cuántas
 *   personas?» y «Elige la altura» — en lugar de 12 combinaciones numéricas.
 * - Resto de productos: tarjetas visuales por tamaño.
 * - Productos "quote" (fondant): sin precios, muestra «A consultar».
 */
import * as React from "react";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { formatEuros } from "@/domain/money";
import {
  buildCakeSizeId,
  CAKE_DISCS,
  CAKE_TIERS,
  getSizesFor,
  getUnitBasePriceCents,
  splitCakeSizeId,
  type CatalogProduct,
} from "@/domain/catalog";
import type { CustomerType } from "@/domain/types";
import { cn } from "@/lib/utils";
import { CakeIllustration } from "./CakeIllustration";

interface SizePickerProps {
  product: CatalogProduct;
  customerType: CustomerType;
  /** Necesario en cheesecakes para poder enseñar precios. */
  flavorId?: string;
  selectedSizeId: string;
  onSelect: (sizeId: string) => void;
}

/** Tarjeta visual de tamaño, con estado seleccionado accesible (no solo color). */
function SizeCard({
  selected,
  onSelect,
  illustration,
  title,
  subtitle,
  price,
  reduced,
}: {
  selected: boolean;
  onSelect: () => void;
  illustration: React.ReactNode;
  title: string;
  subtitle?: string;
  price?: string;
  reduced: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={cn(
        "relative flex min-h-[48px] flex-col items-center rounded-2xl border bg-card px-3 py-4 text-center transition-all duration-200",
        "hover:border-secondary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/[0.04] shadow-lifted ring-1 ring-primary/40"
          : "border-border"
      )}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
      <span className="w-24 sm:w-28">{illustration}</span>
      <span className="mt-2 font-display text-base font-semibold leading-tight text-primary">
        {title}
      </span>
      {subtitle && (
        <span className="mt-0.5 text-xs leading-snug text-muted-foreground">{subtitle}</span>
      )}
      {price && (
        <span className="mt-1.5 font-display text-lg font-bold text-primary">{price}</span>
      )}
    </motion.button>
  );
}

export function SizePicker({
  product,
  customerType,
  flavorId,
  selectedSizeId,
  onSelect,
}: SizePickerProps) {
  const reduced = useReducedMotion() ?? false;
  const sizes = getSizesFor(product, customerType);
  const isQuote = product.pricingType === "quote";
  const isCheesecake = product.id === "cheesecake";

  // ¿Este producto usa la matriz personas × discos de las cartas de pasteles?
  const isCakeMatrix =
    sizes.length > 0 && sizes.every((s) => splitCakeSizeId(s.id) !== null);

  /* ------------------------------------------------------------------ */
  /* Pasteles: dos pasos visuales (personas → altura)                    */
  /* ------------------------------------------------------------------ */
  const split = splitCakeSizeId(selectedSizeId);
  const [tierId, setTierId] = React.useState<string | null>(split?.tierId ?? null);

  React.useEffect(() => {
    // Reinicio al cambiar de producto.
    setTierId(splitCakeSizeId(selectedSizeId)?.tierId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  if (isCakeMatrix) {
    const selectedDiscId = split?.discId ?? null;
    return (
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            1 · ¿Para cuántas personas?
          </p>
          <div role="group" aria-label="Número de personas" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CAKE_TIERS.map((tier, index) => (
              <SizeCard
                key={tier.id}
                reduced={reduced}
                selected={tierId === tier.id}
                onSelect={() => {
                  setTierId(tier.id);
                  // Mantiene la altura elegida si ya la había.
                  if (selectedDiscId) {
                    onSelect(buildCakeSizeId(tier.id, selectedDiscId));
                  } else {
                    onSelect("");
                  }
                }}
                illustration={
                  <CakeIllustration tiers={1} scale={index as 0 | 1 | 2 | 3} />
                }
                title={tier.label}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">2 · Elige la altura</p>
          {!tierId && (
            <p className="mb-2 rounded-lg bg-background-soft px-3 py-2 text-sm text-muted-foreground">
              Elige primero para cuántas personas es la tarta y te enseñamos el precio de
              cada altura.
            </p>
          )}
          <div role="group" aria-label="Altura de la tarta" className="grid grid-cols-3 gap-2.5">
            {CAKE_DISCS.map((disc) => {
              const sizeId = tierId ? buildCakeSizeId(tierId, disc.id) : null;
              const price =
                sizeId && !isQuote
                  ? getUnitBasePriceCents(product.id, customerType, sizeId, flavorId)
                  : null;
              const tierIndex = Math.max(
                0,
                CAKE_TIERS.findIndex((t) => t.id === tierId)
              );
              return (
                <SizeCard
                  key={disc.id}
                  reduced={reduced}
                  selected={selectedSizeId === sizeId && sizeId !== null}
                  onSelect={() => {
                    if (sizeId) onSelect(sizeId);
                  }}
                  illustration={
                    <CakeIllustration
                      tiers={disc.discs as 1 | 2 | 3}
                      scale={(tierId ? tierIndex : 1) as 0 | 1 | 2 | 3}
                    />
                  }
                  title={`${disc.discs} ${disc.discs === 1 ? "disco" : "discos"}`}
                  subtitle={`${disc.heightCm} cm de altura`}
                  price={
                    isQuote
                      ? "A consultar"
                      : price !== null
                        ? formatEuros(price)
                        : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Resto de productos: una tarjeta visual por tamaño                   */
  /* ------------------------------------------------------------------ */
  const gridCols =
    sizes.length <= 3 ? "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4";

  return (
    <div>
      {isCheesecake && !flavorId && (
        <p className="mb-2 rounded-lg bg-background-soft px-3 py-2 text-sm text-muted-foreground">
          El precio del cheesecake depende del sabor: elige primero el sabor para ver los
          precios por tamaño.
        </p>
      )}
      <div role="group" aria-label="Tamaño" className={cn("grid gap-2.5", gridCols)}>
        {sizes.map((size, index) => {
          const price =
            !isQuote && (!isCheesecake || flavorId)
              ? getUnitBasePriceCents(product.id, customerType, size.id, flavorId)
              : null;
          const scale = Math.min(3, index) as 0 | 1 | 2 | 3;
          return (
            <SizeCard
              key={size.id}
              reduced={reduced}
              selected={selectedSizeId === size.id}
              onSelect={() => onSelect(size.id)}
              illustration={
                <CakeIllustration tiers={isQuote ? 2 : 1} scale={scale} />
              }
              title={size.servings}
              subtitle={isQuote ? "tamaño aproximado" : undefined}
              price={
                isQuote ? "A consultar" : price !== null ? formatEuros(price) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
