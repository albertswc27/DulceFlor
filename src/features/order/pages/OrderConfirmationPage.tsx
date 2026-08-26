/**
 * Confirmación tras registrar la solicitud. El pedido YA está guardado:
 * aunque WhatsApp no se abra o el usuario no envíe el mensaje, no se pierde.
 */
import * as React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DEPOSIT_PERCENTAGE,
  PHONE_CALLS,
  PHONE_CALLS_DISPLAY,
} from "@/config/business";
import { formatEuros } from "@/domain/money";
import { buildOrderWhatsAppMessage, buildWhatsAppUrl } from "@/domain/whatsapp";
import { orderRepository } from "@/services/orderRepository";

export default function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const locationState = useLocation().state as { whatsappOpened?: boolean } | null;
  const order = React.useMemo(
    () => (orderId ? orderRepository.getById(orderId) : undefined),
    [orderId]
  );

  if (!order) {
    return (
      <div className="container max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-primary">
          No encontramos este pedido
        </h1>
        <p className="mt-3 text-muted-foreground">
          Puede que el enlace haya caducado o que el pedido se registrara desde otro
          dispositivo. Si tienes dudas sobre tu solicitud, escríbenos por WhatsApp y la
          revisamos.
        </p>
        <Button asChild className="mt-6">
          <Link to="/pedido">Hacer un pedido</Link>
        </Button>
      </div>
    );
  }

  // El wizard pasa por state si logró abrir WhatsApp. Si se llega aquí por
  // enlace directo o recarga, no hay state: se asume que no hubo bloqueo.
  const whatsappBlocked = locationState?.whatsappOpened === false;

  const message = buildOrderWhatsAppMessage(order);
  const whatsappUrl = buildWhatsAppUrl(message);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Resumen copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar automáticamente. Selecciona y copia el texto.");
    }
  }

  return (
    <div className="container max-w-2xl py-10 sm:py-16">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-primary">
          {order.pricing.pendingQuote
            ? "Ya casi está: envíanos tu solicitud"
            : "Ya casi está: envíanos tu pedido"}
        </h1>
        {/* Sin backend, guardar el pedido NO lo hace llegar a Dulce Flor: lo
            que lo entrega es el mensaje de WhatsApp. Decir "registrada" a
            secas hacía creer que ya estaba hecho y la gente cerraba la
            pestaña sin enviarlo. */}
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Hemos guardado tu solicitud <strong>{order.publicId}</strong>. Para que llegue
          a Dulce Flor <strong>falta un último paso: enviarnos el resumen por
          WhatsApp</strong>. En cuanto lo recibamos, te confirmamos el pedido.
        </p>
        <Badge variant="warning" className="mt-3">
          Pendiente de enviar por WhatsApp
        </Badge>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Último paso: envíanos el resumen por WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* El wizard nos dice si consiguió abrir WhatsApp. Cuando el
              navegador lo bloqueó, hay que decirlo claramente: si no, el
              cliente cree que ya ha enviado el pedido y no pulsa nada. */}
          {whatsappBlocked ? (
            <p
              role="alert"
              className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning"
            >
              <strong>Tu navegador ha bloqueado la apertura de WhatsApp.</strong> No
              pasa nada: tu pedido <strong>ya está guardado</strong>. Pulsa «Abrir
              WhatsApp» aquí abajo para enviarnos el resumen.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Al enviar la solicitud se abre WhatsApp con el mensaje ya preparado; solo
              tienes que pulsar «Enviar». Si no se abrió, usa estos botones — tu pedido{" "}
              <strong>ya está guardado</strong> y no se pierde.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle />
                Abrir WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="lg" className="flex-1" onClick={copyMessage}>
              <Copy />
              Copiar resumen
            </Button>
          </div>
          <details className="rounded-lg border border-border bg-background-soft/50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-primary">
              Ver el mensaje que se enviará
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
              {message}
            </pre>
          </details>
          {/* En ordenador, wa.me abre WhatsApp Web, que pide sesión iniciada.
              Quien no la tenga ve un código QR y cree que la web falla. */}
          <p className="text-xs text-muted-foreground">
            ¿Se ha abierto WhatsApp Web pidiéndote escanear un código? Es que no tienes
            la sesión iniciada en este ordenador. Puedes iniciarla, abrir el enlace
            desde el móvil, o pulsar «Copiar resumen» y pegárnoslo en un mensaje.
          </p>

          {/* Los pedidos se gestionan por WhatsApp, pero quien atiende el
              teléfono es otra persona: se ofrece como alternativa, no como
              sustituto del mensaje. */}
          <p className="text-sm text-muted-foreground">
            ¿Prefieres hablarlo por teléfono? Llámanos al{" "}
            <a
              href={`tel:+${PHONE_CALLS}`}
              className="font-medium text-primary underline underline-offset-4"
            >
              {PHONE_CALLS_DISPLAY}
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Resumen económico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatEuros(order.pricing.subtotalCents)}</span>
          </div>
          {order.fulfillmentType === "delivery" && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entrega</span>
              <span>
                {order.pricing.deliveryFeeCents === null
                  ? "Según distancia (a confirmar)"
                  : formatEuros(order.pricing.deliveryFeeCents)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-display text-base font-bold text-primary">
            <span>
              {order.pricing.pendingQuote
                ? "TOTAL (parcial)"
                : order.pricing.hasPendingExtras
                  ? "TOTAL ACTUAL"
                  : "TOTAL"}
            </span>
            <span>
              {order.pricing.pendingQuote && order.pricing.totalCents === 0
                ? "Pendiente de presupuesto"
                : formatEuros(order.pricing.totalCents)}
            </span>
          </div>
          {order.pricing.pendingQuote && (
            <p className="rounded-lg bg-secondary/15 p-3 text-xs text-foreground">
              Tu solicitud incluye una <strong>tarta a medida</strong>: revisaremos el
              diseño y te enviaremos un presupuesto personalizado por WhatsApp antes de
              confirmar el pedido.
            </p>
          )}
          {order.pricing.hasPendingExtras && (
            <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning">
              Has pedido algo fuera de nuestras opciones estándar (un topping que no
              estaba en la lista, un cambio especial o una imagen de referencia).
              Revisaremos si afecta al precio y te{" "}
              <strong>confirmaremos el importe final por WhatsApp</strong>.
            </p>
          )}
          {order.pricing.depositRequired ? (
            <div className="rounded-lg bg-secondary/15 p-3 text-sm">
              <p className="font-medium text-primary">
                Para confirmar este pedido es necesaria una paga y señal del{" "}
                {DEPOSIT_PERCENTAGE}%.
              </p>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Señal ({DEPOSIT_PERCENTAGE}%)</span>
                <span>{formatEuros(order.pricing.depositCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendiente</span>
                <span>{formatEuros(order.pricing.remainingCents)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Métodos disponibles: Bizum, transferencia bancaria o pago presencial en
                tienda. La web no realiza cobros online.
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-success/10 p-3 text-xs text-success">
              El importe se abonará al recoger el pedido o recibir la entrega.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <Button asChild variant="ghost">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
