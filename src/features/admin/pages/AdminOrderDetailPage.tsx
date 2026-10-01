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
  BellOff,
  Loader2,
  MessageCircle,
  PackageSearch,
  Phone,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DEPOSIT_PERCENTAGE } from "@/config/business";
import {
  computeBalanceDueCents,
  computeOverpaidCents,
  resolveCandleSelection,
  resolveItemSurcharges,
} from "@/domain/pricing";
import { formatEuros } from "@/domain/money";
import { getImage, getRemoteImageUrl } from "@/services/imageStore";
import { isSupabaseConfigured } from "@/services/supabase";
import { isSmsAvailable, sendOrderSms } from "@/services/smsNotifier";
import {
  buildOrderStatusSms,
  measureSms,
  PHONE_PROBLEM_MESSAGES,
  toE164,
} from "@/domain/sms";
import {
  buildCustomerNotificationMessage,
  buildOrderWhatsAppMessage,
  buildWhatsAppUrlForPhone,
} from "@/domain/whatsapp";
import {
  getPackagingCents,
  getProduct,
  resolveQuantityTier,
  type CatalogProduct,
} from "@/domain/catalog";
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
  ORDER_STATUS_ACTIONS,
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

/**
 * Miniatura de la imagen de referencia de un artículo, ampliable en diálogo.
 *
 * Primero mira el almacén local (instantáneo, sirve en el mismo dispositivo
 * donde se hizo el pedido). Si no está —el caso normal cuando el pedido lo
 * hizo un cliente desde su móvil— la descarga del Storage con una URL firmada,
 * que es lo que hace que la foto llegue de verdad al panel.
 */
function ReferenceImageThumb({
  imageId,
  productName,
  generatedByAi = false,
}: {
  imageId: string;
  productName: string;
  /** La imagen la generó la IA a partir de lo que describió el cliente. */
  generatedByAi?: boolean;
}) {
  const [src, setSrc] = React.useState<string | null>(() => getImage(imageId));
  // Solo hay que ir al servidor si no está en local y hay Storage configurado.
  const [loading, setLoading] = React.useState(
    () => getImage(imageId) === null && isSupabaseConfigured()
  );
  const alt = generatedByAi
    ? `Imagen orientativa generada con IA para ${productName}`
    : `Imagen de referencia de ${productName}`;
  const etiqueta = generatedByAi ? "Imagen generada con IA" : "Imagen de referencia";

  React.useEffect(() => {
    if (src || !isSupabaseConfigured()) return;
    let alive = true;
    setLoading(true);
    void getRemoteImageUrl(imageId).then((url) => {
      if (!alive) return;
      setSrc(url);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [imageId, src]);

  if (!src) {
    return (
      <li>
        <span className="text-foreground">{etiqueta}:</span>{" "}
        {loading ? "cargando imagen…" : "imagen no disponible"}
      </li>
    );
  }

  return (
    <li>
      <span className="text-foreground">{etiqueta}:</span>
      {/* Aviso explícito para quien va a hacer la tarta: esto no es la foto de
          una tarta que exista, es lo que una máquina imaginó con la
          descripción del cliente. */}
      {generatedByAi && (
        <span className="ml-1 text-xs text-warning">
          (no es una foto real; orientativa)
        </span>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`Ampliar ${alt.toLowerCase()}`}
            className="mt-1.5 block overflow-hidden rounded-lg border border-border bg-card shadow-card transition-shadow hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <img src={src} alt={alt} className="h-24 w-24 object-cover" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{etiqueta}</DialogTitle>
            <DialogDescription className="sr-only">{alt}</DialogDescription>
          </DialogHeader>
          <img
            src={src}
            alt={alt}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** Etiquetas de los regalos a medida (cajas de desayuno y copas). */
const GIFT_TYPE_LABELS: Record<NonNullable<CatalogProduct["giftType"]>, string> = {
  desayuno: "Caja de desayuno",
  copa: "Copa personalizada",
};

/** Línea "Etiqueta: valor" de la ficha de un artículo. */
function ItemLine({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={className}>
      <span className="text-foreground">{label}:</span> {children}
    </li>
  );
}

/** Notas libres e imagen de referencia: comunes a todos los tipos de artículo. */
function ItemNotesLines({ item }: { item: OrderItem }) {
  const c = item.customization;
  return (
    <>
      {c.notes && (
        <li className="italic">
          <span className="not-italic text-foreground">Notas:</span> “{c.notes}”
        </li>
      )}
      {c.aiPrompt && (
        <ItemLine label="Descripción para la IA">“{c.aiPrompt}”</ItemLine>
      )}
      {c.referenceImageId && (
        <ReferenceImageThumb
          imageId={c.referenceImageId}
          productName={item.productName}
          generatedByAi={c.referenceImageSource === "ia"}
        />
      )}
    </>
  );
}

/**
 * Aperitivo salado: la cantidad son unidades y el precio unitario sale del
 * tramo de volumen. No tiene tamaño, así que no se muestra.
 */
function SavouryItemDetails({
  item,
  product,
}: {
  item: OrderItem;
  product: CatalogProduct;
}) {
  const tier = resolveQuantityTier(product, item.quantity);
  return (
    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
      <ItemLine label="Cantidad">{item.quantity} unidades</ItemLine>
      <ItemLine label="Precio por unidad">
        {formatEuros(item.unitPriceCents)}
        {tier && (
          <span className="text-xs">
            {" "}
            (tarifa de {tier.minQuantity}
            {tier.open ? "+" : ""} uds)
          </span>
        )}
      </ItemLine>
      <ItemLine label="Subtotal">{formatEuros(item.totalCents)}</ItemLine>
      <ItemNotesLines item={item} />
    </ul>
  );
}

/**
 * Regalo a medida (caja de desayuno o copa): sin precio automático. La
 * dedicatoria se destaca porque es el corazón del encargo.
 */
function GiftItemDetails({ item }: { item: OrderItem }) {
  const c = item.customization;
  return (
    <>
      {c.dedicationText && (
        <div className="mt-3 rounded-lg border border-secondary/50 bg-secondary/15 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Dedicatoria
          </p>
          <p className="mt-0.5 font-display text-base font-semibold leading-snug text-primary">
            “{c.dedicationText}”
          </p>
        </div>
      )}
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {c.occasion && <ItemLine label="Ocasión">{c.occasion}</ItemLine>}
        {c.designDescription && (
          <ItemLine label="Qué quiere incluir">{c.designDescription}</ItemLine>
        )}
        <ItemNotesLines item={item} />
        <ItemLine label="Precio" className="text-destructive">
          pendiente de presupuesto
        </ItemLine>
      </ul>
    </>
  );
}

/** «+2,50 €» o «incluido», según lleve suplemento o no. */
function surchargeNote(cents: number): React.ReactNode {
  return cents > 0 ? (
    <span className="text-xs">(+{formatEuros(cents)})</span>
  ) : (
    <span className="text-xs">(incluido)</span>
  );
}

/** Tarta (clásica, personalizada o de fondant): ficha completa de siempre. */
function CakeItemDetails({ item }: { item: OrderItem }) {
  const c = item.customization;
  const surcharges = resolveItemSurcharges(item.productId, c);
  const product = getProduct(item.productId);
  const packagingCents = product ? getPackagingCents(product) : 0;
  return (
    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
      <ItemLine label="Tamaño">{c.size.label}</ItemLine>
      {c.flavor && (
        <ItemLine label="Sabor">
          {c.flavor.label} {surchargeNote(surcharges.flavorCents)}
        </ItemLine>
      )}
      {c.filling && (
        <ItemLine label="Relleno">
          {c.filling.label} {surchargeNote(surcharges.fillingCents)}
        </ItemLine>
      )}
      {/* La caja no se le cobra aparte al cliente, va dentro del precio: aquí
          se indica para poder cuadrar el gasto de cajas del obrador. */}
      {packagingCents > 0 && !item.requiresQuote && (
        <ItemLine label="Caja">
          {item.quantity > 1 ? `${item.quantity} uds · ` : ""}
          {formatEuros(packagingCents * item.quantity)}{" "}
          <span className="text-xs">(ya dentro del precio)</span>
        </ItemLine>
      )}
      {c.toppings.length > 0 && (
        <ItemLine label="Toppings">
          {c.toppings.map((t) => t.label).join(", ")}
        </ItemLine>
      )}
      {c.customToppingRequest && (
        <ItemLine label="Topping solicitado">
          {c.customToppingRequest}{" "}
          <span className="text-xs">(precio pendiente de confirmación)</span>
        </ItemLine>
      )}
      {c.designDescription && (
        <ItemLine label="Diseño">{c.designDescription}</ItemLine>
      )}
      {c.extras.map((extra) => (
        <ItemLine key={extra.id} label="Extra">
          {extra.label} (+{formatEuros(extra.priceCents)})
        </ItemLine>
      ))}
      {(() => {
        const { numbers, sparklers } = resolveCandleSelection(c);
        if (!numbers && !sparklers) return null;
        return (
          <>
            {numbers && (
              <ItemLine
                label={numbers.style === "bengala" ? "Bengalas de número" : "Velas de número"}
              >
                {/* La cifra es lo que hay que montar sobre la tarta: primero
                    y en grande, antes que el importe. */}
                {numbers.digits && (
                  <strong className="font-display text-base">{numbers.digits}</strong>
                )}{" "}
                {numbers.quantity} × {formatEuros(numbers.unitCents)} ={" "}
                <strong>{formatEuros(numbers.cents)}</strong>
              </ItemLine>
            )}
            {sparklers && (
              <ItemLine label="Bengalas sueltas">
                {sparklers.quantity} × {formatEuros(sparklers.unitCents)} ={" "}
                <strong>{formatEuros(sparklers.cents)}</strong>
              </ItemLine>
            )}
            {item.requiresQuote && (
              <ItemLine label="">
                <span className="text-xs">
                  Velas y bengalas aparte del presupuesto de la tarta.
                </span>
              </ItemLine>
            )}
          </>
        );
      })()}
      {c.dedicationText && (
        <ItemLine label="Dedicatoria">“{c.dedicationText}”</ItemLine>
      )}
      <ItemNotesLines item={item} />
    </ul>
  );
}

function OrderItemCard({ item }: { item: OrderItem }) {
  const product = getProduct(item.productId);
  // Tres fichas distintas: aperitivo por volumen, regalo a medida y tarta.
  const isSavoury = Boolean(product?.quantityTiers?.length);
  const giftType = product?.giftType;
  const kindLabel = isSavoury
    ? "Aperitivo salado"
    : giftType
      ? GIFT_TYPE_LABELS[giftType]
      : null;

  return (
    <div className="rounded-xl border border-border bg-background-soft/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          {kindLabel && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {kindLabel}
            </p>
          )}
          <p className="font-display font-semibold text-primary">
            {item.productName}
            {!isSavoury && item.quantity > 1 && (
              <span className="text-muted-foreground"> × {item.quantity}</span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {item.requiresQuote ? (
            <p className="font-display text-lg font-bold text-primary">A consultar</p>
          ) : (
            <>
              <p className="font-display text-lg font-bold text-primary">
                {formatEuros(item.totalCents)}
              </p>
              {item.quantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  {isSavoury
                    ? `${item.quantity} uds × ${formatEuros(item.unitPriceCents)}/ud`
                    : `${item.quantity} × ${formatEuros(item.unitPriceCents)}`}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {isSavoury && product ? (
        <SavouryItemDetails item={item} product={product} />
      ) : giftType ? (
        <GiftItemDetails item={item} />
      ) : (
        <CakeItemDetails item={item} />
      )}
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = React.useState<Order | null>(() =>
    orderId ? (orderRepository.getById(orderId) ?? null) : null
  );
  const [quoteInput, setQuoteInput] = React.useState("");
  /** Cancelar pide confirmación: es irreversible de hecho y se pulsa sin querer. */
  const [confirmandoCancelar, setConfirmandoCancelar] = React.useState(false);
  const [sendingSms, setSendingSms] = React.useState(false);
  /** Este despliegue puede enviar SMS (hay servidor y sesión que validar). */
  const smsAvailable = isSmsAvailable();
  // Se puede llegar aquí por enlace directo a un pedido que todavía no está
  // en este dispositivo (lo hizo un cliente desde su móvil): sincronizamos
  // antes de decir que no existe.
  const [buscando, setBuscando] = React.useState(!order);

  React.useEffect(() => {
    if (order || !orderId) return;
    let vivo = true;
    void orderRepository.sync().then(() => {
      if (!vivo) return;
      setOrder(orderRepository.getById(orderId) ?? null);
      setBuscando(false);
    });
    return () => {
      vivo = false;
    };
  }, [order, orderId]);

  if (!order && buscando) {
    return (
      <div className="mx-auto max-w-md py-10 text-center text-muted-foreground">
        Buscando el pedido…
      </div>
    );
  }

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

    // Tramitar es el momento en que el cliente espera noticias: el aviso sale
    // solo, sin depender de que alguien se acuerde de pulsar nada. Si no se
    // puede enviar (sin SMS configurado, cliente excluido, teléfono fijo), se
    // dice y queda el botón de WhatsApp de siempre.
    const debeAvisar =
      status === "confirmed" && !updated.customerNotifiedAt && !updated.smsOptOut;
    if (debeAvisar && smsAvailable) {
      toast.success("Pedido tramitado", { description: "Enviando el aviso por SMS…" });
      void enviarSms({ force: false });
      return;
    }
    if (debeAvisar) {
      toast.success("Pedido tramitado", {
        description: "Avisa al cliente con los datos de recogida.",
        action: { label: "Avisar", onClick: notifyCustomer },
      });
      return;
    }
    toast.success(`Estado actualizado: ${ORDER_STATUS_LABELS[status]}`);
  }

  /**
   * Pide a la función serverless que envíe el SMS.
   *
   * El pedido se marca como avisado SOLO si la pasarela confirma el envío: es
   * la diferencia entre que el panel diga la verdad y que diga «avisado»
   * mientras el cliente sigue sin saber nada.
   */
  async function enviarSms({ force }: { force: boolean }) {
    if (!order || sendingSms) return;
    setSendingSms(true);
    try {
      const resultado = await sendOrderSms(order.id, { force });
      if (resultado.ok) {
        const updated = orderRepository.markCustomerNotified(order.id, "sms");
        if (updated) setOrder(updated);
        toast.success("SMS enviado al cliente", {
          description:
            resultado.segments > 1
              ? `Se han facturado ${resultado.segments} SMS por la longitud del mensaje.`
              : "Ya puede consultar su ficha desde el enlace.",
        });
        return;
      }
      if (resultado.alreadySent) {
        toast.info("A este cliente ya se le avisó", {
          description: "Usa «volver a avisar» si de verdad quieres repetirlo.",
        });
        return;
      }
      toast.error("No se ha enviado el SMS", {
        description: `${resultado.message} Puedes avisar por WhatsApp.`,
        duration: 10000,
      });
    } finally {
      setSendingSms(false);
    }
  }

  function toggleSmsOptOut() {
    if (!order) return;
    const updated = orderRepository.setSmsOptOut(order.id, !order.smsOptOut);
    if (!updated) {
      toast.error("No se pudo guardar la preferencia del cliente.");
      return;
    }
    setOrder(updated);
    toast.success(
      updated.smsOptOut
        ? "Marcado: a este cliente no se le avisará por SMS."
        : "A este cliente se le volverá a avisar por SMS."
    );
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

  /**
   * Abre WhatsApp con el aviso ya escrito y deja constancia de que se avisó.
   * La ventana se abre DENTRO del gesto del usuario (sin `await` antes) o el
   * navegador la bloquearía como emergente.
   */
  function notifyCustomer() {
    if (!order) return;
    const url = buildWhatsAppUrlForPhone(
      order.customer.phone,
      buildCustomerNotificationMessage(order)
    );
    let opened: Window | null = null;
    try {
      opened = window.open(url, "_blank");
      if (opened) opened.opener = null;
    } catch {
      opened = null;
    }
    // Solo se da por avisado si WhatsApp llegó a abrirse. Marcarlo antes
    // hacía que el panel dijera «Cliente avisado» con el emergente bloqueado
    // y el cliente sin enterarse de nada.
    if (!opened) {
      toast.warning("El navegador ha bloqueado WhatsApp", {
        description: "Usa «Copiar aviso» y pégalo en el chat del cliente.",
      });
      return;
    }
    const updated = orderRepository.markCustomerNotified(order.id, "whatsapp");
    if (updated) setOrder(updated);
  }

  async function copyCustomerNotification() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(buildCustomerNotificationMessage(order));
      toast.success("Aviso copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el aviso en este navegador.");
    }
  }

  function handleQuoteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;
    const euros = Number(quoteInput.trim().replace(",", "."));
    if (!Number.isFinite(euros) || euros <= 0) {
      toast.error("Introduce un importe válido mayor que 0 €.");
      return;
    }
    const cents = Math.round(euros * 100);
    const updated = orderRepository.setQuotedPrice(order.id, cents);
    if (!updated) {
      toast.error("No se pudo guardar el presupuesto del pedido.");
      return;
    }
    setOrder(updated);
    setQuoteInput("");
    toast.success(`Presupuesto guardado: ${formatEuros(cents)}`);
  }

  const { pricing } = order;
  const isDelivery = order.fulfillmentType === "delivery";
  const quoteItem = order.items.find((item) => item.requiresQuote);
  const hasQuoteItems = quoteItem !== undefined;
  const isQuoted =
    hasQuoteItems && !pricing.pendingQuote && pricing.quotedPriceCents !== undefined;
  // Nombre real del artículo a presupuestar: tarta personalizada o de fondant,
  // caja de desayuno, copa… Nunca se habla solo de tartas.
  const quoteItemName = quoteItem?.productName ?? "solicitud a medida";
  // Modificaciones sobre una tarta CON precio: el total mostrado es "actual".
  const hasPendingExtras = Boolean(pricing.hasPendingExtras) && !pricing.pendingQuote;
  // subtotalCents ya incluye las velas: se separan para no contarlas dos veces.
  const candlesCents = pricing.candlesCents ?? 0;
  const productsCents = pricing.subtotalCents - candlesCents;
  // Señal ya cobrada (normalmente en el kiosk) y lo que resta por cobrar al
  // recoger. Cuando hay señal, esto sustituye a la sugerencia del 30 %: ya se
  // ha cobrado dinero, así que lo útil es saber cuánto queda.
  const depositPaidCents = order.depositPaidCents ?? 0;
  const balanceDueCents = computeBalanceDueCents(pricing, order.depositPaidCents);
  const overpaidCents = computeOverpaidCents(pricing, order.depositPaidCents);
  const customerNotification = buildCustomerNotificationMessage(order);
  // Se comprueba aquí, no al pulsar: si el cliente dejó un fijo hay que verlo
  // ANTES de tramitar, no descubrirlo cuando el envío ya ha fallado.
  const telefonoParaSms = toE164(order.customer.phone);
  const smsCost = measureSms(
    buildOrderStatusSms(
      {
        publicId: order.publicId,
        customerName: order.customer.name,
        requestedDate: order.requestedDate,
        requestedTime: order.requestedTime,
        fulfillmentType: order.fulfillmentType,
      },
      // Longitud representativa del enlace real: el token son 22 caracteres.
      `${window.location.origin}/mi-pedido/${"x".repeat(22)}`
    )
  );

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
          {order.urgent && <Badge variant="destructive">Urgente</Badge>}
          {order.customerNotifiedAt && <Badge variant="success">Cliente avisado</Badge>}
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
                {order.reusableTray && (
                  <DetailRow label="Fuente de cristal reutilizable">
                    Sí (recogemos la anterior en la siguiente entrega)
                  </DetailRow>
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
          {order.urgent && (
            <div
              role="alert"
              className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-4"
            >
              <Badge variant="destructive">PEDIDO URGENTE</Badge>
              <p className="mt-2 text-sm text-foreground">
                Se registró con menos de 3 días de margen, para el{" "}
                <strong>
                  {formatRequestedDay(order.requestedDate)} a las{" "}
                  {order.requestedTime} h
                </strong>
                . Confirma cuanto antes con el cliente (WhatsApp o teléfono) si
                da tiempo a prepararlo.
              </p>
            </div>
          )}

          {pricing.pendingQuote && (
            <div
              role="alert"
              className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-4"
            >
              <Badge variant="destructive">REQUIERE PRESUPUESTO MANUAL</Badge>
              <p className="mt-2 text-sm text-foreground">
                El pedido incluye una solicitud a medida sin precio automático (
                {quoteItemName}): hay que preparar el presupuesto y enviárselo al
                cliente por WhatsApp. Hasta entonces no hay total definitivo ni
                señal.
              </p>
            </div>
          )}

          {hasPendingExtras && (
            <div
              role="alert"
              className="rounded-xl border-2 border-warning/50 bg-warning/10 p-4"
            >
              <Badge variant="warning">
                REVISAR: MODIFICACIONES PENDIENTES DE CONFIRMAR
              </Badge>
              <p className="mt-2 text-sm text-foreground">
                El cliente ha pedido algo fuera de lo estándar sobre una tarta con
                precio cerrado: un topping que no está en la lista, un cambio
                escrito en las notas o una imagen de referencia. Revisa los
                artículos, decide si cambia el importe y confírmale el total final
                por WhatsApp.
              </p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Resumen económico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-2 text-sm">
                {pricing.pendingQuote ? (
                  productsCents > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">
                        Subtotal (sin lo pendiente de presupuesto)
                      </dt>
                      <dd className="font-medium">{formatEuros(productsCents)}</dd>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium">{formatEuros(productsCents)}</dd>
                  </div>
                )}
                {candlesCents > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Velas</dt>
                    <dd className="font-medium">{formatEuros(candlesCents)}</dd>
                  </div>
                )}
                {isQuoted && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">
                      Presupuesto a medida
                    </dt>
                    <dd className="font-medium">
                      {formatEuros(pricing.quotedPriceCents ?? 0)}
                    </dd>
                  </div>
                )}
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
                {(pricing.urgencySurchargeCents ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">
                      Suplemento por urgencia
                    </dt>
                    <dd className="font-medium">
                      {formatEuros(pricing.urgencySurchargeCents ?? 0)}
                    </dd>
                  </div>
                )}
              </dl>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-base font-semibold text-primary">
                  {hasPendingExtras ? "TOTAL ACTUAL" : "TOTAL"}
                </span>
                {pricing.pendingQuote ? (
                  <span className="text-right font-display text-lg font-bold text-destructive">
                    Pendiente de presupuesto
                  </span>
                ) : (
                  <span className="font-display text-2xl font-bold text-primary">
                    {formatEuros(pricing.totalCents)}
                  </span>
                )}
              </div>
              {hasPendingExtras && (
                <p className="text-right text-xs text-muted-foreground">
                  + modificaciones pendientes de confirmar
                </p>
              )}
              {isDelivery && pricing.deliveryFeeCents === null && (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  El total no incluye el transporte: la zona está fuera de tarifa
                  automática y debe confirmarse con el cliente.
                </p>
              )}
              {/* Ya se cobró una señal: mandan estas cifras, no la sugerencia
                  del 30 %, porque el dinero ya ha cambiado de manos. */}
              {depositPaidCents > 0 ? (
                <div className="space-y-1 rounded-lg bg-success/10 px-3 py-2.5 text-sm">
                  <p className="font-medium text-success">
                    Señal ya cobrada al registrar el pedido.
                  </p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Señal recibida</span>
                    <span className="font-medium text-foreground">
                      {formatEuros(depositPaidCents)}
                    </span>
                  </div>
                  {overpaidCents > 0 ? (
                    <div className="flex justify-between font-medium text-warning">
                      <span>Devolver al cliente</span>
                      <span>{formatEuros(overpaidCents)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pendiente al recoger</span>
                      <span className="font-medium text-foreground">
                        {balanceDueCents === null
                          ? "según presupuesto"
                          : formatEuros(balanceDueCents)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                !pricing.pendingQuote &&
                pricing.depositRequired && (
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
                )
              )}
            </CardContent>
          </Card>

          {hasQuoteItems && (
            <Card>
              <CardHeader>
                <CardTitle>Introducir presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleQuoteSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="presupuesto-a-medida">
                      Presupuesto de «{quoteItemName}» (euros)
                    </Label>
                    <Input
                      id="presupuesto-a-medida"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Ej.: 45,50"
                      value={quoteInput}
                      onChange={(e) => setQuoteInput(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={quoteInput.trim() === ""}
                  >
                    Guardar presupuesto
                  </Button>
                  {isQuoted && (
                    <p className="text-xs text-muted-foreground">
                      Presupuesto actual: {formatEuros(pricing.quotedPriceCents ?? 0)}.
                      Puedes introducir un importe nuevo para corregirlo.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

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
                {ORDER_STATUS_ACTIONS.map((status) => {
                  const isCurrent = order.status === status;
                  return (
                    <Button
                      key={status}
                      type="button"
                      variant={isCurrent ? "default" : "outline"}
                      /* Etiquetas como «Pendiente de presupuesto» no caben en
                         una línea dentro de la columna del panel: se deja que
                         el texto fluya en vez de desbordar la tarjeta. */
                      className="h-auto min-h-[2.75rem] w-full whitespace-normal px-3 py-2 text-center leading-snug"
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

              {/* Cancelar no es un estado más del recorrido, es una excepción,
                  y por eso no está entre los dos botones. Pero tiene que
                  seguir existiendo: sin esto un pedido anulado no se puede
                  marcar y seguiría contando en los totales del panel.
                  Dos pulsaciones a propósito: no se cancela sin querer. */}
              {order.status !== "cancelled" && (
                <div className="mt-4 border-t pt-3">
                  {confirmandoCancelar ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        ¿Seguro que quieres cancelarlo?
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setConfirmandoCancelar(false);
                          changeStatus("cancelled");
                        }}
                      >
                        Sí, cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmandoCancelar(false)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground underline underline-offset-4"
                      onClick={() => setConfirmandoCancelar(true)}
                    >
                      Cancelar este pedido
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aviso al cliente. El SMS sale solo al tramitar el pedido; esta
              tarjeta sirve para ver qué pasó, repetirlo y, si el SMS no es
              posible, recurrir a WhatsApp. */}
          <Card>
            <CardHeader>
              <CardTitle>Avisar al cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.customerNotifiedAt ? (
                <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                  Avisado el {formatCreatedAt(order.customerNotifiedAt)}
                  {order.customerNotifiedBy === "sms"
                    ? " por SMS"
                    : order.customerNotifiedBy === "whatsapp"
                      ? " por WhatsApp"
                      : ""}
                  .
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {smsAvailable && !order.smsOptOut
                    ? "Al marcar el pedido como Tramitado se envía solo un SMS con el enlace a su ficha. También puedes enviarlo desde aquí."
                    : "Prepara el mensaje de «pedido tramitado» con el número, la fecha, la hora, el importe y las condiciones de recogida."}
                </p>
              )}

              {/* Un teléfono fijo no recibe SMS. Mejor decirlo aquí que pagar
                  un envío que no llega y darlo por bueno. */}
              {!telefonoParaSms.ok && (
                <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{PHONE_PROBLEM_MESSAGES[telefonoParaSms.problem]}</span>
                </p>
              )}

              {order.smsOptOut && (
                <p className="flex items-start gap-2 rounded-lg bg-background-soft px-3 py-2 text-sm text-muted-foreground">
                  <BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Este cliente ha pedido que no se le avise por SMS. El aviso
                    automático lo respeta.
                  </span>
                </p>
              )}

              <div className="grid gap-2">
                {smsAvailable && (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={sendingSms || !telefonoParaSms.ok || order.smsOptOut}
                    onClick={() => void enviarSms({ force: Boolean(order.customerNotifiedAt) })}
                  >
                    {sendingSms ? <Loader2 className="animate-spin" /> : <Send />}
                    {sendingSms
                      ? "Enviando…"
                      : order.customerNotifiedAt
                        ? "Volver a enviar el SMS"
                        : "Enviar SMS ahora"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={smsAvailable ? "outline" : "default"}
                  className="w-full"
                  onClick={notifyCustomer}
                >
                  <MessageCircle />
                  {smsAvailable ? "Avisar por WhatsApp" : "Avisar por WhatsApp"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={copyCustomerNotification}
                >
                  <Copy />
                  Copiar aviso
                </Button>
              </div>

              {smsAvailable && (
                <>
                  <p className="text-xs text-muted-foreground">
                    El SMS son {smsCost.segments === 1 ? "unos" : ""}{" "}
                    {smsCost.segments === 1
                      ? "160 caracteres y se factura como 1 envío"
                      : `${smsCost.segments} envíos facturados (el texto no cabe en uno)`}
                    . El detalle completo va en el enlace, no en el mensaje.
                  </p>
                  <button
                    type="button"
                    onClick={toggleSmsOptOut}
                    className="text-left text-xs font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {order.smsOptOut
                      ? "Volver a avisar por SMS a este cliente"
                      : "Este cliente no quiere SMS"}
                  </button>
                </>
              )}

              <details className="rounded-lg border border-border bg-background-soft/50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-primary">
                  Ver el mensaje de WhatsApp
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
                  {customerNotification}
                </pre>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button type="button" variant="outline" className="w-full" onClick={copySummary}>
                <Copy />
                Copiar resumen interno
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
