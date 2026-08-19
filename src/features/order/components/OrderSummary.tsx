/**
 * Resumen económico del pedido: subtotal, transporte, total y paga y señal.
 * Único origen de datos: derived.pricing del contexto (motor de dominio).
 */
import { Separator } from "@/components/ui/separator";
import { formatEuros } from "@/domain/money";
import { DEPOSIT_PERCENTAGE } from "@/config/business";
import { useOrderDraft } from "@/features/order/state/OrderDraftContext";
import { AnimatedPrice } from "./AnimatedPrice";

export function OrderSummary({ showDepositInfo = true }: { showDepositInfo?: boolean }) {
  const { state, derived } = useOrderDraft();
  const { pricing } = derived;
  const isDelivery = state.fulfillmentType === "delivery";

  return (
    <div className="space-y-3">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium">{formatEuros(pricing.subtotalCents)}</dd>
        </div>
        {isDelivery && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Entrega
              {derived.deliveryZoneLabel && (
                <span className="block text-xs">{derived.deliveryZoneLabel}</span>
              )}
            </dt>
            <dd className="font-medium">
              {state.address === null
                ? "—"
                : derived.needsDeliveryConsultation
                  ? "Según distancia"
                  : formatEuros(derived.deliveryFeeCents ?? 0)}
            </dd>
          </div>
        )}
        {state.fulfillmentType === "pickup" && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Recogida en tienda</dt>
            <dd className="font-medium text-success">Gratis</dd>
          </div>
        )}
      </dl>

      <Separator />

      <div className="flex items-center justify-between">
        <span className="font-display text-base font-semibold text-primary">
          {pricing.pendingQuote ? "TOTAL (parcial)" : "TOTAL"}
        </span>
        {pricing.pendingQuote && pricing.totalCents === 0 ? (
          <span className="font-display text-xl font-bold text-primary">
            A presupuestar
          </span>
        ) : (
          <AnimatedPrice cents={pricing.totalCents} className="text-2xl" />
        )}
      </div>

      {pricing.pendingQuote && (
        <p className="rounded-lg bg-secondary/15 px-3 py-2 text-xs text-foreground">
          Tu pedido incluye una <strong>tarta de fondant pendiente de presupuesto</strong>:
          su precio no está incluido en el total. Te enviaremos el presupuesto
          personalizado por WhatsApp.
        </p>
      )}

      {isDelivery && derived.needsDeliveryConsultation && state.address !== null && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          Tu dirección está fuera de nuestras zonas fijas: los gastos de envío se calculan
          según la distancia y te los confirmaremos por WhatsApp. El total mostrado no
          incluye el transporte.
        </p>
      )}

      {showDepositInfo &&
        (pricing.depositRequired ? (
          <div className="space-y-1 rounded-lg bg-secondary/15 px-3 py-2.5 text-sm">
            <p className="font-medium text-primary">
              Este pedido requiere una paga y señal del {DEPOSIT_PERCENTAGE}%.
            </p>
            <div className="flex justify-between text-muted-foreground">
              <span>Señal ({DEPOSIT_PERCENTAGE}%)</span>
              <span className="font-medium text-foreground">
                {formatEuros(pricing.depositCents)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pendiente al recoger/recibir</span>
              <span className="font-medium text-foreground">
                {formatEuros(pricing.remainingCents)}
              </span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Métodos: Bizum, transferencia o pago en tienda. Sin pago online.
            </p>
          </div>
        ) : (
          pricing.totalCents > 0 && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              El importe se abonará al recoger el pedido o recibir la entrega.
            </p>
          )
        ))}
    </div>
  );
}
