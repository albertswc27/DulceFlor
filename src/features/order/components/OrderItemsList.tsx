import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/domain/money";
import {
  computeUnitPriceCents,
  describeCandleLines,
  resolveItemSurcharges,
} from "@/domain/pricing";
import { useOrderDraft, type DraftItem } from "@/features/order/state/OrderDraftContext";
import { getProduct } from "@/domain/catalog";
import { getImage } from "@/services/imageStore";
import { QuantityStepper } from "./QuantityStepper";
import { ProductThumb } from "./ProductThumb";

/** Sufijo « +2,50 €» para las opciones que llevan suplemento (vacío si no). */
function surchargeSuffix(cents: number): string {
  return cents > 0 ? ` +${formatEuros(cents)}` : "";
}

function DraftItemRow({
  item,
  onEdit,
}: {
  item: DraftItem;
  onEdit?: (item: DraftItem) => void;
}) {
  const { removeItem, setQuantity } = useOrderDraft();
  const product = getProduct(item.selection.productId);
  const isQuote = product?.pricingType === "quote";
  const unit = isQuote ? null : computeUnitPriceCents(item.selection);
  const c = item.customization;
  const referenceImage = c.referenceImageId ? getImage(c.referenceImageId) : null;
  const surcharges = resolveItemSurcharges(item.selection.productId, c);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <ProductThumb
            productId={item.selection.productId}
            className="h-14 w-14 sm:h-16 sm:w-16"
          />
          <div className="min-w-0">
          <p className="font-display font-semibold text-primary">
            {product?.name ?? item.selection.productId}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            <li>{c.size.label}</li>
            {c.occasion && <li>Ocasión: {c.occasion}</li>}
            {c.flavor && (
              <li>
                Sabor: {c.flavor.label}
                {surchargeSuffix(surcharges.flavorCents)}
              </li>
            )}
            {c.filling && (
              <li>
                Relleno: {c.filling.label}
                {surchargeSuffix(surcharges.fillingCents)}
              </li>
            )}
            {c.toppings.length > 0 && (
              <li>Toppings: {c.toppings.map((t) => t.label).join(", ")}</li>
            )}
            {c.customToppingRequest && (
              <li>
                Topping solicitado: {c.customToppingRequest}
                <span className="block text-warning">
                  Precio pendiente de confirmación
                </span>
              </li>
            )}
            {c.extras.length > 0 && (
              <li>Extras: {c.extras.map((e) => e.label).join(", ")}</li>
            )}
            {describeCandleLines(c).map((line) => (
              <li key={line}>{line}</li>
            ))}
            {c.dedicationText && (
              <li className="text-foreground">Dedicatoria: “{c.dedicationText}”</li>
            )}
            {c.designDescription && <li>Diseño: “{c.designDescription}”</li>}
            {c.notes && (
              <li className="italic">
                “{c.notes}”
                {!isQuote && (
                  <span className="block not-italic text-warning">
                    Cambio especial: Dulce Flor confirmará si afecta al precio
                  </span>
                )}
              </li>
            )}
          </ul>
          {referenceImage && (
            <img
              src={referenceImage}
              alt={`Imagen de referencia de ${product?.name ?? "la tarta"}`}
              className="mt-2 h-16 w-16 rounded-lg border border-border object-cover"
            />
          )}
          </div>
        </div>
        <div className="text-right">
          {isQuote ? (
            <p className="max-w-[10rem] font-display text-base font-semibold text-primary">
              A consultar
              <span className="block text-xs font-normal text-muted-foreground">
                presupuesto personalizado
              </span>
            </p>
          ) : unit === null ? (
            <p className="max-w-[10rem] text-sm font-medium text-destructive">
              Combinación no disponible: quítala y vuelve a añadirla.
            </p>
          ) : (
            <>
              <p className="font-display text-lg font-bold text-primary">
                {formatEuros(unit * item.quantity)}
              </p>
              {item.quantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatEuros(unit)}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <QuantityStepper
          value={item.quantity}
          onChange={(q) => setQuantity(item.id, q)}
        />
        <div className="flex items-center gap-1">
          {/* Cambiar de idea sobre el sabor no debería costar rehacer el
              pedido: se reabre el configurador con todo lo ya elegido. */}
          {onEdit && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(item)}>
              <Pencil />
              Editar
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => removeItem(item.id)}
          >
            <Trash2 />
            Quitar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OrderItemsList({
  onEdit,
}: {
  /** Sin esta función la lista no ofrece editar (p. ej. en el drawer móvil). */
  onEdit?: (item: DraftItem) => void;
} = {}) {
  const { state } = useOrderDraft();
  if (state.items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-background-soft/60 px-4 py-6 text-center text-sm text-muted-foreground">
        Aún no has añadido ningún producto.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {state.items.map((item) => (
        <DraftItemRow key={item.id} item={item} onEdit={onEdit} />
      ))}
    </div>
  );
}
