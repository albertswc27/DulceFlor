/**
 * Detalle completo de un pedido: cliente, entrega, artículos con toda la
 * personalización, desglose económico y gestión del estado.
 */
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  MessageCircle,
  PackageSearch,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DEPOSIT_PERCENTAGE } from "@/config/business";
import { formatEuros } from "@/domain/money";
import { buildOrderWhatsAppMessage } from "@/domain/whatsapp";
import {
  CUSTOMER_TYPE_LABELS,
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/domain/types";
import { orderRepository } from "@/services/orderRepository";
import {
  ORDER_STATUS_SEQUENCE,
  STATUS_BADGE_VARIANT,
  formatCreatedAt,
  formatRequestedDay,
  waUrlForPhone,
} from "@/features/admin/lib/adminUi";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function OrderItemCard({ item }: { item: OrderItem }) {
  const c = item.customization;
  return (
    <div className="rounded-xl border border-border bg-background-soft/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display font-semibold text-primary">
          {item.productName}
          {item.quantity > 1 && (
            <span className="text-muted-foreground"> × {item.quantity}</span>
          )}
        </p>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold text-primary">
            {formatEuros(item.totalCents)}
          </p>
          {item.quantity > 1 && (
            <p className="text-xs text-muted-foreground">
              {item.quantity} × {formatEuros(item.unitPriceCents)}
            </p>
          )}
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        <li>
          <span className="text-foreground">Tamaño:</span> {c.size.label}
        </li>
        {c.flavor && (
          <li>
            <span className="text-foreground">Sabor:</span> {c.flavor.label}
          </li>
        )}
        {c.filling && (
          <li>
            <span className="text-foreground">Relleno:</span> {c.filling.label}{" "}
            <span className="text-xs">(incluido)</span>
          </li>
        )}
        {c.toppings.length > 0 && (
          <li>
            <span className="text-foreground">Toppings:</span>{" "}
            {c.toppings.map((t) => t.label).join(", ")}
          </li>
        )}
        {c.extras.map((extra) => (
          <li key={extra.id}>
            <span className="text-foreground">Extra:</span> {extra.label} (+
            {formatEuros(extra.priceCents)})
          </li>
        ))}
        {c.dedicationText && (
          <li>
            <span className="text-foreground">Dedicatoria:</span> “{c.dedicationText}”
          </li>
        )}
        {c.notes && (
          <li className="italic">
            <span className="not-italic text-foreground">Notas:</span> “{c.notes}”
          </li>
        )}
      </ul>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = React.useState<Order | null>(() =>
    orderId ? (orderRepository.getById(orderId) ?? null) : null
  );

  if (!order) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary">
          <PackageSearch className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-primary">
          Pedido no encontrado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el pedido se haya registrado en otro dispositivo o que el
          enlace no sea correcto.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/admin/pedidos">
            <ArrowLeft />
            Volver a pedidos
          </Link>
        </Button>
      </div>
    );
  }

  function changeStatus(status: OrderStatus) {
    if (!order || order.status === status) return;
    const updated = orderRepository.updateStatus(order.id, status);
    if (!updated) {
      toast.error("No se pudo actualizar el estado del pedido.");
      return;
    }
    setOrder(updated);
    toast.success(`Estado actualizado: ${ORDER_STATUS_LABELS[status]}`);
  }

  async function copySummary() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(buildOrderWhatsAppMessage(order));
      toast.success("Resumen copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el resumen en este navegador.");
    }
  }

  const { pricing } = order;
  const isDelivery = order.fulfillmentType === "delivery";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Volver a pedidos">
            <Link to="/admin/pedidos">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
              Pedido {order.publicId}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Creado el {formatCreatedAt(order.createdAt)} · origen{" "}
              {order.source === "kiosk" ? "kiosk de tienda" : "web"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{order.source === "kiosk" ? "Kiosk" : "Web"}</Badge>
          <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Columna principal */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <DetailRow label="Nombre">{order.customer.name}</DetailRow>
                {order.customer.companyName && (
                  <DetailRow label="Empresa">{order.customer.companyName}</DetailRow>
                )}
                <DetailRow label="Tipo de cliente">
                  {CUSTOMER_TYPE_LABELS[order.customerType]}
                </DetailRow>
                <DetailRow label="Teléfono">
                  <a
                    href={`tel:${order.customer.phone.replace(/\s/g, "")}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {order.customer.phone}
                  </a>
                </DetailRow>
                {order.customer.email && (
                  <DetailRow label="Email">
                    <a
                      href={`mailto:${order.customer.email}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {order.customer.email}
                    </a>
                  </DetailRow>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="secondary">
                  <a
                    href={waUrlForPhone(order.customer.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle />
                    WhatsApp al cliente
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`tel:${order.customer.phone.replace(/\s/g, "")}`}>
                    <Phone />
                    Llamar
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{FULFILLMENT_LABELS[order.fulfillmentType]}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                <DetailRow label="Fecha solicitada">
                  {formatRequestedDay(order.requestedDate)}
                </DetailRow>
                <DetailRow label="Hora solicitada">{order.requestedTime} h</DetailRow>
                {isDelivery && order.address && (
                  <>
                    <DetailRow label="Dirección">
                      {order.address.street}, {order.address.postalCode}{" "}
                      {order.address.municipality}
                    </DetailRow>
                    {order.address.details && (
                      <DetailRow label="Indicaciones">{order.address.details}</DetailRow>
                    )}
                    <DetailRow label="Zona de entrega">
                      {order.deliveryZoneLabel ??
                        "Fuera de zonas automáticas (a consultar)"}
                    </DetailRow>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Artículos ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <OrderItemCard key={item.id} item={item} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen económico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium">{formatEuros(pricing.subtotalCents)}</dd>
                </div>
                {isDelivery ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">
                      Entrega
                      {order.deliveryZoneLabel && (
                        <span className="block text-xs">{order.deliveryZoneLabel}</span>
                      )}
                    </dt>
                    <dd className="font-medium">
                      {pricing.deliveryFeeCents === null
                        ? "Según distancia (a confirmar)"
                        : formatEuros(pricing.deliveryFeeCents)}
                    </dd>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Recogida en tienda</dt>
                    <dd className="font-medium text-success">Gratis</dd>
                  </div>
                )}
              </dl>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-primary">
                  TOTAL
                </span>
                <span className="font-display text-2xl font-bold text-primary">
                  {formatEuros(pricing.totalCents)}
                </span>
              </div>
              {isDelivery && pricing.deliveryFeeCents === null && (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  El total no incluye el transporte: la zona está fuera de tarifa
                  automática y debe confirmarse con el cliente.
                </p>
              )}
              {pricing.depositRequired && (
                <div className="space-y-1 rounded-lg bg-secondary/15 px-3 py-2.5 text-sm">
                  <p className="font-medium text-primary">
                    Requiere paga y señal del {DEPOSIT_PERCENTAGE}%.
                  </p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Señal ({DEPOSIT_PERCENTAGE}%)</span>
                    <span className="font-medium text-foreground">
                      {formatEuros(pricing.depositCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pendiente</span>
                    <span className="font-medium text-foreground">
                      {formatEuros(pricing.remainingCents)}
                    </span>
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">
                    Bizum, transferencia o pago en tienda. Sin pago online.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                role="group"
                aria-label="Cambiar estado del pedido"
                className="grid grid-cols-2 gap-2"
              >
                {ORDER_STATUS_SEQUENCE.map((status) => {
                  const isCurrent = order.status === status;
                  return (
                    <Button
                      key={status}
                      type="button"
                      variant={isCurrent ? "default" : "outline"}
                      className="w-full"
                      aria-pressed={isCurrent}
                      disabled={isCurrent}
                      onClick={() => changeStatus(status)}
                    >
                      {ORDER_STATUS_LABELS[status]}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                El estado actual aparece resaltado. El cambio se guarda al instante.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button type="button" variant="outline" className="w-full" onClick={copySummary}>
                <Copy />
                Copiar resumen
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
