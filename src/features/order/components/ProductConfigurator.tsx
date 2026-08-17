/**
 * Configurador de producto — reutilizado por el wizard público y el kiosk.
 * No calcula precios por su cuenta: todo pasa por src/domain/pricing.
 */
import * as React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TOPPING_PRICE_CENTS } from "@/config/business";
import { formatEuros } from "@/domain/money";
import {
  getSizesFor,
  TOPPINGS,
  type CatalogProduct,
} from "@/domain/catalog";
import {
  computeUnitPriceBreakdown,
  getToppingPriceCents,
  type ItemSelection,
} from "@/domain/pricing";
import { dedicationSchema, freeTextSchema } from "@/domain/validation";
import type { CustomerType, ItemCustomization } from "@/domain/types";
import { OptionCard } from "./OptionCard";
import { QuantityStepper } from "./QuantityStepper";
import { AnimatedPrice } from "./AnimatedPrice";

export interface ConfiguratorResult {
  selection: ItemSelection;
  customization: ItemCustomization;
  quantity: number;
}

interface ProductConfiguratorProps {
  product: CatalogProduct;
  customerType: CustomerType;
  onConfirm: (result: ConfiguratorResult) => void;
  confirmLabel?: string;
  /** Diseño más denso para pantallas de kiosk. */
  compact?: boolean;
  initial?: Partial<{
    sizeId: string;
    flavorId: string;
    fillingId: string;
    toppingIds: string[];
    extraIds: string[];
    dedicationText: string;
    notes: string;
    quantity: number;
  }>;
}

export function ProductConfigurator({
  product,
  customerType,
  onConfirm,
  confirmLabel = "Añadir al pedido",
  compact = false,
  initial,
}: ProductConfiguratorProps) {
  const sizes = getSizesFor(product, customerType);

  const [sizeId, setSizeId] = React.useState<string>(initial?.sizeId ?? "");
  const [flavorId, setFlavorId] = React.useState<string>(initial?.flavorId ?? "");
  const [fillingId, setFillingId] = React.useState<string>(initial?.fillingId ?? "");
  const [toppingIds, setToppingIds] = React.useState<string[]>(initial?.toppingIds ?? []);
  const [extraIds, setExtraIds] = React.useState<string[]>(initial?.extraIds ?? []);
  const [dedicationText, setDedicationText] = React.useState(initial?.dedicationText ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [quantity, setQuantity] = React.useState(initial?.quantity ?? 1);
  const [error, setError] = React.useState<string | null>(null);

  // Al cambiar de producto se reinicia la selección (salvo edición inicial).
  React.useEffect(() => {
    setSizeId(initial?.sizeId ?? "");
    setFlavorId(initial?.flavorId ?? "");
    setFillingId(initial?.fillingId ?? "");
    setToppingIds(initial?.toppingIds ?? []);
    setExtraIds(initial?.extraIds ?? []);
    setDedicationText(initial?.dedicationText ?? "");
    setNotes(initial?.notes ?? "");
    setQuantity(initial?.quantity ?? 1);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, customerType]);

  const needsFlavor = Boolean(product.flavors && product.flavors.length > 0);
  const needsFilling = Boolean(product.fillings && product.fillings.length > 0);
  const isCheesecake = product.id === "cheesecake";

  const selection: ItemSelection = {
    productId: product.id,
    customerType,
    sizeId,
    flavorId: flavorId || undefined,
    toppingIds,
    extraIds,
  };

  const breakdown =
    sizeId && (!isCheesecake || flavorId)
      ? computeUnitPriceBreakdown(selection)
      : null;

  const toppingPriceCents = sizeId
    ? getToppingPriceCents(product.id, sizeId)
    : null;

  const dedicationSelected = extraIds.includes("dedicatoria");

  function toggleTopping(id: string) {
    setToppingIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleConfirm() {
    if (!sizeId) {
      setError("Selecciona un tamaño.");
      return;
    }
    if (needsFlavor && !flavorId) {
      setError(isCheesecake ? "Selecciona un sabor." : "Selecciona el sabor del bizcocho.");
      return;
    }
    if (dedicationSelected) {
      const parsed = dedicationSchema.safeParse(dedicationText);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }
    const notesParsed = freeTextSchema.safeParse(notes);
    if (!notesParsed.success) {
      setError(notesParsed.error.issues[0].message);
      return;
    }
    if (!breakdown) {
      setError("Esta combinación no está disponible. Revisa tamaño y sabor.");
      return;
    }

    const size = sizes.find((s) => s.id === sizeId)!;
    const flavor = product.flavors?.find((f) => f.id === flavorId);
    const filling = product.fillings?.find((f) => f.id === fillingId);
    const customization: ItemCustomization = {
      size: { id: size.id, label: size.label },
      flavor: flavor ? { id: flavor.id, label: flavor.label } : undefined,
      filling: filling ? { id: filling.id, label: filling.label } : undefined,
      toppings: TOPPINGS.filter((t) => toppingIds.includes(t.id)).map((t) => ({
        id: t.id,
        label: t.label,
      })),
      extras: product.extras
        .filter((e) => extraIds.includes(e.id))
        .map((e) => ({ id: e.id, label: e.label, priceCents: e.priceCents })),
      dedicationText: dedicationSelected ? dedicationText.trim() : undefined,
      notes: notes.trim() || undefined,
    };

    setError(null);
    onConfirm({ selection, customization, quantity });
  }

  const gridCols = compact
    ? "grid gap-2 sm:grid-cols-3"
    : "grid gap-2 sm:grid-cols-2";

  return (
    <div className="space-y-6">
      {/* Tamaño */}
      <fieldset>
        <legend className="mb-2 flex items-baseline justify-between gap-2 w-full">
          <span className="font-display text-base font-semibold text-primary">Tamaño</span>
          <span className="text-xs text-muted-foreground">Obligatorio</span>
        </legend>
        <div role="group" aria-label="Tamaño" className={gridCols}>
          {sizes.map((size) => {
            const price = isCheesecake
              ? flavorId
                ? computeUnitPriceBreakdown({
                    ...selection,
                    sizeId: size.id,
                    toppingIds: [],
                    extraIds: [],
                  })?.baseCents
                : undefined
              : size.priceCents;
            return (
              <OptionCard
                key={size.id}
                selected={sizeId === size.id}
                onSelect={() => setSizeId(size.id)}
                title={size.label}
                price={price !== undefined && price !== null ? formatEuros(price) : undefined}
              />
            );
          })}
        </div>
        {isCheesecake && !flavorId && (
          <p className="mt-2 text-sm text-muted-foreground">
            El precio del cheesecake depende del sabor: elige primero el sabor para ver los
            precios por tamaño.
          </p>
        )}
      </fieldset>

      {/* Sabor */}
      {needsFlavor && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-primary">
              {isCheesecake ? "Sabor" : "Sabor del bizcocho"}
            </span>
            <span className="text-xs text-muted-foreground">Obligatorio</span>
          </legend>
          <div role="group" aria-label="Sabor" className={gridCols}>
            {product.flavors!.map((flavor) => (
              <OptionCard
                key={flavor.id}
                selected={flavorId === flavor.id}
                onSelect={() => setFlavorId(flavor.id)}
                title={flavor.label}
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Relleno */}
      {needsFilling && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-primary">Relleno</span>
            <span className="text-xs text-muted-foreground">Incluido en el precio</span>
          </legend>
          <div role="group" aria-label="Relleno" className={gridCols}>
            {product.fillings!.map((filling) => (
              <OptionCard
                key={filling.id}
                selected={fillingId === filling.id}
                onSelect={() => setFillingId(filling.id === fillingId ? "" : filling.id)}
                title={filling.label}
                subtitle={compact ? undefined : filling.description}
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Toppings */}
      {product.allowsToppings && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-primary">Toppings</span>
            <span className="text-xs text-muted-foreground">
              +{formatEuros(toppingPriceCents ?? TOPPING_PRICE_CENTS)} cada uno
            </span>
          </legend>
          <div aria-label="Toppings" className={gridCols}>
            {TOPPINGS.map((topping) => (
              <OptionCard
                key={topping.id}
                role="checkbox"
                selected={toppingIds.includes(topping.id)}
                onSelect={() => toggleTopping(topping.id)}
                title={topping.label}
                price={
                  toppingIds.includes(topping.id) && toppingPriceCents !== null
                    ? `+${formatEuros(toppingPriceCents)}`
                    : undefined
                }
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Extras */}
      {product.extras.length > 0 && (
        <fieldset>
          <legend className="mb-2 font-display text-base font-semibold text-primary">
            Extras
          </legend>
          <div className="grid gap-2">
            {product.extras.map((extra) => (
              <OptionCard
                key={extra.id}
                role="checkbox"
                selected={extraIds.includes(extra.id)}
                onSelect={() => toggleExtra(extra.id)}
                title={extra.label}
                subtitle={compact ? undefined : extra.description}
                price={`+${formatEuros(extra.priceCents)}`}
              />
            ))}
          </div>
          {dedicationSelected && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="dedicatoria">Texto de la dedicatoria</Label>
              <Input
                id="dedicatoria"
                value={dedicationText}
                onChange={(e) => setDedicationText(e.target.value)}
                placeholder='Por ejemplo: "Felicidades, Laura"'
                maxLength={120}
              />
            </div>
          )}
        </fieldset>
      )}

      {/* Texto libre */}
      <div className="space-y-1.5">
        <Label htmlFor="notas">¿Alguna personalización especial?</Label>
        <Textarea
          id="notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cuéntanos cómo la imaginas: colores, decoración, temática…"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Este campo complementa las opciones anteriores, no las sustituye.
        </p>
      </div>

      <Separator />

      {/* Cantidad + precio + confirmar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <QuantityStepper value={quantity} onChange={setQuantity} />
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {quantity > 1 ? `Precio (${quantity} uds.)` : "Precio"}
          </p>
          {breakdown ? (
            <AnimatedPrice cents={breakdown.unitTotalCents * quantity} className="text-2xl" />
          ) : (
            <p className="font-display text-lg text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {breakdown && (breakdown.toppingsCents > 0 || breakdown.extrasCents > 0) && (
        <div className="rounded-lg bg-background-soft px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span>Base</span>
            <span>{formatEuros(breakdown.baseCents)}</span>
          </div>
          {breakdown.toppingsCents > 0 && (
            <div className="flex justify-between">
              <span>Toppings ({toppingIds.length})</span>
              <span>+{formatEuros(breakdown.toppingsCents)}</span>
            </div>
          )}
          {breakdown.extrasCents > 0 && (
            <div className="flex justify-between">
              <span>Extras</span>
              <span>+{formatEuros(breakdown.extrasCents)}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="button" size="xl" className="w-full" onClick={handleConfirm}>
        {confirmLabel}
        {breakdown && ` · ${formatEuros(breakdown.unitTotalCents * quantity)}`}
      </Button>
    </div>
  );
}
