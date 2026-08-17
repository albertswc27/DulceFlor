import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/domain/money";
import { computeUnitPriceCents } from "@/domain/pricing";
import { useOrderDraft, type DraftItem } from "@/features/order/state/OrderDraftContext";
import { getProduct } from "@/domain/catalog";
import { QuantityStepper } from "./QuantityStepper";

function DraftItemRow({ item }: { item: DraftItem }) {
  const { removeItem, setQuantity } = useOrderDraft();
  const unit = computeUnitPriceCents(item.selection);
  const product = getProduct(item.selection.productId);
  const c = item.customization;

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
            {c.extras.length > 0 && (
              <li>Extras: {c.extras.map((e) => e.label).join(", ")}</li>
            )}
            {c.dedicationText && <li>Dedicatoria: “{c.dedicationText}”</li>}
            {c.notes && <li className="italic">“{c.notes}”</li>}
          </ul>
        </div>
        <div className="text-right">
          {unit === null ? (
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
