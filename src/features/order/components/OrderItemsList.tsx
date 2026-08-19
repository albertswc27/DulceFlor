import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/domain/money";
import { computeUnitPriceCents } from "@/domain/pricing";
import { useOrderDraft, type DraftItem } from "@/features/order/state/OrderDraftContext";
import { getProduct } from "@/domain/catalog";
import { getImage } from "@/services/imageStore";
import { QuantityStepper } from "./QuantityStepper";

function DraftItemRow({ item }: { item: DraftItem }) {
  const { removeItem, setQuantity } = useOrderDraft();
  const product = getProduct(item.selection.productId);
  const isQuote = product?.pricingType === "quote";
  const unit = isQuote ? null : computeUnitPriceCents(item.selection);
  const c = item.customization;
  const referenceImage = c.referenceImageId ? getImage(c.referenceImageId) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-primary">
            {product?.name ?? item.selection.productId}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            <li>{c.size.label}</li>
            {c.flavor && <li>Sabor: {c.flavor.label}</li>}
            {c.filling && <li>Relleno: {c.filling.label}</li>}
            {c.toppings.length > 0 && (
              <li>Toppings: {c.toppings.map((t) => t.label).join(", ")}</li>
            )}
            {c.customToppingRequest && (
              <li>
                Topping solicitado: {c.customToppingRequest}{" "}
                <span className="text-warning">(a confirmar)</span>
              </li>
            )}
            {c.extras.length > 0 && (
              <li>Extras: {c.extras.map((e) => e.label).join(", ")}</li>
            )}
            {c.dedicationText && <li>Dedicatoria: “{c.dedicationText}”</li>}
            {c.designDescription && <li>Diseño: “{c.designDescription}”</li>}
            {c.notes && <li className="italic">“{c.notes}”</li>}
          </ul>
          {referenceImage && (
            <img
              src={referenceImage}
              alt={`Imagen de referencia de ${product?.name ?? "la tarta"}`}
              className="mt-2 h-16 w-16 rounded-lg border border-border object-cover"
            />
          )}
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
      <div className="mt-3 flex items-center justify-between gap-3">
        <QuantityStepper
          value={item.quantity}
          onChange={(q) => setQuantity(item.id, q)}
        />
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
  );
}

export function OrderItemsList() {
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
        <DraftItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}
