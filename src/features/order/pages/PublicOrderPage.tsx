/**
 * Ficha pública de un pedido: lo que abre el cliente desde el enlace del SMS.
 *
 * Sustituye al papel que hoy se entrega en el mostrador. Está pensada para
 * leerse en un móvil, de un vistazo y probablemente de camino a la tienda:
 * primero cuándo y dónde recoger, después cuánto queda por pagar, y al final
 * las condiciones. Sin login: lo que autoriza la consulta es el token del
 * enlace (ver services/publicOrder.ts).
 */
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  PackageSearch,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BUSINESS_ADDRESS_DISPLAY,
  BUSINESS_MAPS_URL,
  PHONE_CALLS,
  PHONE_CALLS_DISPLAY,
  PICKUP_CONDITIONS,
  WHATSAPP_PHONE,
  WHATSAPP_PHONE_DISPLAY,
} from "@/config/business";
import { formatEuros } from "@/domain/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/types";
import {
  fetchPublicOrder,
  type PublicOrderResult,
  type PublicOrderView,
} from "@/services/publicOrder";

/** Cómo se le explica al cliente el estado, en sus palabras y no en las nuestras. */
const STATUS_MESSAGE: Record<
  OrderStatus,
  { title: string; detail: string; tone: "ok" | "wait" }
> = {
  pending: {
    title: "Hemos recibido tu pedido",
    detail: "Dulce Flor lo está revisando y te confirmará los detalles enseguida.",
    tone: "wait",
  },
  pending_quote: {
    title: "Estamos preparando tu presupuesto",
    detail: "Tu pedido lleva algo a medida: te enviaremos el precio antes de confirmarlo.",
    tone: "wait",
  },
  confirmed: {
    title: "Tu pedido está confirmado",
    detail: "Ya está todo en marcha. Te esperamos el día y la hora que ves aquí abajo.",
    tone: "ok",
  },
  completed: {
    title: "Pedido entregado",
    detail: "Gracias por confiar en Dulce Flor. Esperamos que lo hayáis disfrutado.",
    tone: "ok",
  },
  cancelled: {
    title: "Pedido cancelado",
    detail: "Si crees que se trata de un error, escríbenos y lo revisamos.",
    tone: "wait",
  },
};

function DataRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: PublicOrderView }) {
  const isDelivery = order.fulfillmentType === "delivery";
  const status = STATUS_MESSAGE[order.status];
  const pendingQuote = order.totalCents === null;

  return (
    <>
      <div className="text-center">
        <span
          className={
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full " +
            (status.tone === "ok"
              ? "bg-success/15 text-success"
              : "bg-secondary/25 text-primary")
          }
        >
          {status.tone === "ok" ? (
            <CheckCircle2 className="h-9 w-9" />
          ) : (
            <Clock className="h-9 w-9" />
          )}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-primary">{status.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{status.detail}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline">Pedido {order.publicId}</Badge>
          <Badge variant={status.tone === "ok" ? "success" : "secondary"}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          {order.urgent && <Badge variant="warning">Urgente</Badge>}
        </div>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{isDelivery ? "Tu entrega" : "Tu recogida"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <DataRow icon={CalendarClock} label={isDelivery ? "Día de entrega" : "Día de recogida"}>
            {format(parseISO(order.requestedDate), "EEEE d 'de' MMMM 'de' yyyy", {
              locale: es,
            })}
          </DataRow>
          <DataRow icon={Clock} label="Hora">
            {order.requestedTime} h
          </DataRow>
          <DataRow icon={ShoppingBag} label="A nombre de">
            {order.customerName}
          </DataRow>
          {order.createdAt !== "" && (
            <DataRow icon={PackageSearch} label="Pedido realizado el">
              {format(parseISO(order.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </DataRow>
          )}
          {!isDelivery && (
            <div className="sm:col-span-2">
              <DataRow icon={Store} label="Dónde recogerlo">
                {BUSINESS_ADDRESS_DISPLAY}
                <a
                  href={BUSINESS_MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-sm font-normal text-accent underline-offset-4 hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  Ver cómo llegar
                </a>
              </DataRow>
            </div>
          )}
        </CardContent>
      </Card>

      {order.items.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Qué has pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {order.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.detail !== "" && (
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    )}
                  </div>
                  {item.quantity > 1 && (
                    <span className="shrink-0 text-sm text-muted-foreground">
                      &times; {item.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Importe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {pendingQuote ? (
            <p className="rounded-lg bg-secondary/15 px-3 py-2.5 text-foreground">
              Tu pedido incluye algo a medida y todavía estamos cerrando el presupuesto.
              Te lo confirmaremos antes de prepararlo.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total del pedido</span>
                <span className="font-display text-xl font-bold text-primary">
                  {formatEuros(order.totalCents ?? 0)}
                </span>
              </div>
              {order.depositPaidCents > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ya pagado (señal)</span>
                  <span className="font-medium text-success">
                    &minus; {formatEuros(order.depositPaidCents)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {isDelivery ? "Pendiente al recibir" : "Pendiente al recoger"}
                </span>
                <span className="font-display text-xl font-bold text-primary">
                  {order.balanceDueCents === null
                    ? "Por confirmar"
                    : formatEuros(order.balanceDueCents)}
                </span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Puedes pagar en efectivo, por Bizum o con transferencia. La web no
                realiza cobros.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Lo que hasta ahora se entregaba en papel al recoger. */}
      <Card className="mt-4 border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
            {isDelivery ? "Condiciones de entrega" : "Antes de llevártelo"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {PICKUP_CONDITIONS.map((condition) => (
              <li key={condition} className="flex gap-2">
                <span aria-hidden="true" className="text-warning">
                  &bull;
                </span>
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>¿Alguna duda?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Escríbenos indicando tu número de pedido <strong>{order.publicId}</strong> y te
            respondemos.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <a
                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
                  `Hola Dulce Flor, es sobre mi pedido ${order.publicId}.`
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp {WHATSAPP_PHONE_DISPLAY}
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href={`tel:+${PHONE_CALLS}`}>Llamar {PHONE_CALLS_DISPLAY}</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Mantiene la ficha fuera de los buscadores mientras está abierta.
 *
 * robots.txt ya la excluye, pero eso es una petición que un rastreador puede
 * ignorar y que no sirve de nada si alguien pega el enlace en una web pública.
 * La etiqueta `noindex` sí la respetan todos, y se quita al salir para no
 * despublicar el resto de la web al navegar a otra página.
 */
function useNoIndex() {
  React.useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = React.useState<PublicOrderResult | null>(null);
  useNoIndex();

  React.useEffect(() => {
    let alive = true;
    setResult(null);
    void fetchPublicOrder(token ?? "").then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  if (result === null) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <p className="animate-fade-in text-muted-foreground">Buscando tu pedido…</p>
      </div>
    );
  }

  if (result.state !== "ok") {
    const notFound = result.state === "not-found";
    return (
      <div className="container max-w-lg py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary">
          <PackageSearch className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-primary">
          {notFound ? "No encontramos este pedido" : "No podemos consultarlo ahora"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {notFound
            ? "Puede que el enlace esté incompleto o que haya caducado: por tu privacidad, estas fichas dejan de estar disponibles unas semanas después de la recogida. Escríbenos por WhatsApp con tu número de pedido y lo comprobamos."
            : result.message}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noreferrer">
              Escribir por WhatsApp
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Ir a la web</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-10 sm:py-14">
      <OrderCard order={result.order} />
      <div className="mt-8 text-center">
        <Button asChild variant="ghost">
          <Link to="/">Ver la web de Dulce Flor</Link>
        </Button>
      </div>
    </div>
  );
}
