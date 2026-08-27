/**
 * Kiosk de tienda (tablet táctil): registro rápido de pedidos por el equipo.
 * Reutiliza el borrador de pedido, el configurador y el motor de precios del
 * flujo público; solo cambia la ergonomía (botones grandes, panel lateral).
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  LogOut,
  PartyPopper,
  Plus,
  ShoppingBag,
  Store,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogDrawerContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatEuros, parseEurosToCents } from "@/domain/money";
import { computeBalanceDueCents } from "@/domain/pricing";
import {
  CATEGORY_FAMILY,
  CATEGORY_LABELS,
  FAMILY_LABELS,
  getMinimumQuantity,
  getProductsFor,
  getSizesFor,
  getUnitBasePriceCents,
  type CatalogProduct,
  type CategoryId,
  type FamilyId,
} from "@/domain/catalog";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  type Order,
} from "@/domain/types";
import { useAdminAuth } from "@/features/admin/state/AdminAuthContext";
import { lockKiosk, unlockKiosk, verifyPassword } from "@/services/auth";
import { useOrderDraft } from "@/features/order/state/OrderDraftContext";
import { OptionCard } from "@/features/order/components/OptionCard";
import { ProductThumb } from "@/features/order/components/ProductThumb";
import { ProductConfigurator } from "@/features/order/components/ProductConfigurator";
import { OrderItemsList } from "@/features/order/components/OrderItemsList";
import { OrderSummary } from "@/features/order/components/OrderSummary";
import { SlotPicker } from "@/features/order/components/SlotPicker";
import { submitOrder, type SubmitResult } from "@/features/order/services/submitOrder";
import { formatRequestedDay } from "@/features/admin/lib/adminUi";
import logo from "@/assets/logo-dulce-flor.jpeg";

/**
 * Orden de la carta dentro del kiosk. Las categorías que no aparezcan aquí se
 * muestran igualmente al final: así un producto nuevo del catálogo nunca queda
 * oculto por un descuido.
 */
const CATEGORY_ORDER: CategoryId[] = [
  "pasteles",
  "cheesecake",
  "tres-leches",
  "especialidades",
  "aperitivos-salados",
  "aperitivos-dulces",
  "desayunos",
  "copas",
];

const FAMILY_ORDER: FamilyId[] = ["tartas", "aperitivos", "regalos"];

/**
 * Precio "desde" de un producto, calculado siempre desde el catálogo.
 * En los aperitivos el precio no depende del tamaño sino del tramo de
 * cantidad: el más barato es el del tramo con más unidades (POR UNIDAD).
 */
function minPriceCents(
  product: CatalogProduct,
  customerType: CustomerType
): number | null {
  let min: number | null = null;
  if (product.quantityTiers?.length) {
    for (const tier of product.quantityTiers) {
      if (min === null || tier.unitPriceCents < min) min = tier.unitPriceCents;
    }
    return min;
  }
  for (const size of getSizesFor(product, customerType)) {
    if (product.id === "cheesecake" && product.flavors) {
      for (const flavor of product.flavors) {
        const price = getUnitBasePriceCents(product.id, customerType, size.id, flavor.id);
        if (price !== null && (min === null || price < min)) min = price;
      }
    } else {
      const price = getUnitBasePriceCents(product.id, customerType, size.id);
      if (price !== null && (min === null || price < min)) min = price;
    }
  }
  return min;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

export default function KioskPage() {
  const navigate = useNavigate();
  const draft = useOrderDraft();
  const { state, derived } = draft;
  const { session } = useAdminAuth();

  // Modo kiosk bloqueado: la tablet queda de cara al público. Salir del kiosk
  // (o abrir el detalle de un pedido) exige la contraseña de administración;
  // mientras tanto, el resto de rutas admin rebotan aquí (ver AdminLayout).
  React.useEffect(() => {
    lockKiosk();
  }, []);

  const [exitTarget, setExitTarget] = React.useState<string | null>(null);
  const [exitPassword, setExitPassword] = React.useState("");
  const [exitError, setExitError] = React.useState<string | null>(null);
  const [exitBusy, setExitBusy] = React.useState(false);

  async function handleExitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exitBusy || !exitTarget || !session) return;
    setExitBusy(true);
    setExitError(null);
    const result = await verifyPassword(session.username, exitPassword);
    if (!result.ok) {
      // El mensaje ya explica si es contraseña incorrecta o espera por
      // intentos fallidos: es justo aquí donde alguien probaría a adivinarla.
      setExitError(result.error ?? "Contraseña incorrecta.");
      setExitBusy(false);
      return;
    }
    unlockKiosk();
    navigate(exitTarget);
  }

  function openExitDialog(target: string) {
    setExitPassword("");
    setExitError(null);
    setExitBusy(false);
    setExitTarget(target);
  }

  const [choosingType, setChoosingType] = React.useState(false);
  const [configuring, setConfiguring] = React.useState<CatalogProduct | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<Order | null>(null);

  // Campos mínimos de cliente y dirección (se sincronizan con el borrador).
  const [name, setName] = React.useState(state.customer?.name ?? "");
  const [phone, setPhone] = React.useState(state.customer?.phone ?? "");
  const [companyName, setCompanyName] = React.useState(state.customer?.companyName ?? "");
  const [street, setStreet] = React.useState(state.address?.street ?? "");
  const [municipality, setMunicipality] = React.useState(state.address?.municipality ?? "");
  const [postalCode, setPostalCode] = React.useState(state.address?.postalCode ?? "");
  const [details, setDetails] = React.useState(state.address?.details ?? "");
  // Señal (paga y señal) flexible que el equipo cobra al registrar el pedido.
  // Texto en euros; se convierte a céntimos al enviar.
  const [depositEuros, setDepositEuros] = React.useState("");

  const products = state.customerType ? getProductsFor(state.customerType) : [];
  // Parrilla de tarjetas agrupada por familia (tartas, aperitivos, regalos):
  // con la carta salada el catálogo ya no es corto y las cabeceras evitan
  // tener que recorrer veinte tarjetas seguidas para encontrar una.
  const rank = (category: CategoryId) => {
    const index = CATEGORY_ORDER.indexOf(category);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  const orderedProducts = [...products].sort(
    (a, b) => rank(a.category) - rank(b.category)
  );
  const productGroups = FAMILY_ORDER.map((family) => ({
    family,
    products: orderedProducts.filter((p) => CATEGORY_FAMILY[p.category] === family),
  })).filter((group) => group.products.length > 0);

  // Recogida en tienda por defecto en el kiosk.
  React.useEffect(() => {
    if (state.customerType && !state.fulfillmentType) {
      draft.setFulfillment("pickup");
    }
  }, [state.customerType, state.fulfillmentType, draft]);

  // Sincroniza los datos de cliente con el borrador en cada cambio, de modo
  // que submitOrder siempre lea el estado actualizado del contexto.
  React.useEffect(() => {
    if (!state.customerType) return;
    draft.setCustomer({
      name,
      phone,
      companyName: state.customerType === "business" ? companyName : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, companyName, state.customerType]);

  React.useEffect(() => {
    if (state.fulfillmentType !== "delivery") return;
    const hasAny = Boolean(
      street.trim() || municipality.trim() || postalCode.trim() || details.trim()
    );
    draft.setAddress(
      hasAny
        ? {
            street,
            municipality,
            postalCode,
            details: details.trim() || undefined,
          }
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, municipality, postalCode, details, state.fulfillmentType]);

  function handleCustomerType(type: CustomerType) {
    if (state.customerType && state.customerType !== type && state.items.length > 0) {
      toast.info("Se ha vaciado el pedido: la carta de particulares y empresas es distinta.");
    }
    draft.setCustomerType(type);
    setChoosingType(false);
    setConfiguring(null);
  }

  function handleSubmit() {
    if (submitting) return;

    // Señal opcional: si el equipo ha escrito algo, tiene que ser un importe
    // válido y no puede superar el total ya conocido.
    let depositPaidCents: number | undefined;
    if (depositEuros.trim() !== "") {
      const cents = parseEurosToCents(depositEuros);
      if (cents === null) {
        toast.error("La señal no es un importe válido. Escribe algo como 20 o 20,50.");
        return;
      }
      if (!derived.pricing.pendingQuote && cents > derived.pricing.totalCents) {
        toast.error("La señal no puede superar el total del pedido.");
        return;
      }
      depositPaidCents = cents > 0 ? cents : undefined;
    }

    setSubmitting(true);
    let result: SubmitResult;
    try {
      result = submitOrder(state, derived, "kiosk", { depositPaidCents });
    } catch {
      toast.error(
        "No se pudo registrar el pedido en este dispositivo. Libera espacio de almacenamiento e inténtalo de nuevo."
      );
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    if (!result.ok) {
      result.errors.forEach((error) => toast.error(error));
      return;
    }
    setSheetOpen(false);
    setConfiguring(null);
    // Reinicia el borrador YA: genera un clientRequestId nuevo. Si se
    // conservara el antiguo, un pedido posterior reutilizaría la misma clave
    // idempotente y orderRepository.create() devolvería el pedido anterior,
    // perdiendo el nuevo en silencio.
    draft.reset();
    setName("");
    setPhone("");
    setCompanyName("");
    setStreet("");
    setMunicipality("");
    setPostalCode("");
    setDetails("");
    setDepositEuros("");
    setSuccess(result.order);
  }

  function startNewOrder() {
    setSuccess(null);
    setChoosingType(false);
    setConfiguring(null);
  }

  /**
   * Tarjeta de producto de la parrilla. Se invoca como función —no como
   * componente— para no remontar las tarjetas en cada render.
   */
  function renderProductCard(product: CatalogProduct) {
    // Productos "quote" (tarta personalizada o de fondant, caja de desayuno,
    // copa): sin precio automático — el mínimo del catálogo sería 0 € y no
    // debe mostrarse nunca. En el kiosk siguen disponibles: el equipo puede
    // registrar la solicitud a medida en tienda.
    const isQuoteProduct = product.pricingType === "quote";
    // Aperitivos: tarifa por volumen, el "desde" es un precio POR UNIDAD.
    const isPerUnit = Boolean(product.quantityTiers?.length);
    const from =
      !isQuoteProduct &&
      state.customerType &&
      minPriceCents(product, state.customerType);
    const sizesCount = state.customerType
      ? getSizesFor(product, state.customerType).length
      : 0;
    const facts: string[] = [];
    if (product.flavors?.length) {
      facts.push(
        `${product.flavors.length} ${
          product.id === "cheesecake" ? "sabores" : "bizcochos"
        }`
      );
    }
    if (product.fillings?.length) {
      facts.push(`${product.fillings.length} rellenos`);
    }
    if (sizesCount > 1) facts.push(`${sizesCount} tamaños`);
    if (isPerUnit) facts.push(`mínimo ${getMinimumQuantity(product)} uds`);
    if (product.allowsToppings) facts.push("admite toppings");
    return (
      <button
        key={product.id}
        type="button"
        onClick={() => setConfiguring(product)}
        className="group flex min-h-[15rem] flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-7"
      >
        <span className="flex items-start gap-4">
          <ProductThumb productId={product.id} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {CATEGORY_LABELS[product.category]}
            </span>
            <span className="mt-1.5 font-display text-2xl font-bold leading-tight text-primary">
              {product.name}
            </span>
          </span>
        </span>
        <span className="mt-2 flex-1 text-base leading-snug text-muted-foreground">
          {product.description}
        </span>
        {facts.length > 0 && (
          <span className="mt-4 flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <span
                key={fact}
                className="rounded-full bg-secondary/15 px-3 py-1 text-sm font-medium text-primary"
              >
                {fact}
              </span>
            ))}
          </span>
        )}
        <span className="mt-5 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-display text-2xl font-bold text-primary">
              {isQuoteProduct
                ? "Precio a consultar"
                : typeof from === "number"
                  ? `Desde ${formatEuros(from)}${isPerUnit ? "/ud" : ""}`
                  : ""}
            </span>
            {isQuoteProduct && (
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                Abre una solicitud de presupuesto: sin importe hasta confirmarlo
                con el cliente.
              </span>
            )}
            {isPerUnit && typeof from === "number" && (
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                El precio por unidad baja según la cantidad.
              </span>
            )}
          </span>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20 text-primary transition-transform group-hover:scale-110">
            <Plus className="h-6 w-6" />
          </span>
        </span>
      </button>
    );
  }

  /**
   * Sección de paga y señal (solo kiosk): un importe flexible que el equipo
   * cobra al registrar el pedido. Se muestra el resto que quedará por cobrar
   * al recoger, para que quede anotado y no haya sorpresas.
   */
  function renderDepositSection(prefix: string) {
    const trimmed = depositEuros.trim();
    const cents = trimmed === "" ? null : parseEurosToCents(depositEuros);
    const pending = derived.pricing.pendingQuote;
    const exceedsTotal =
      cents !== null && !pending && cents > derived.pricing.totalCents;
    const invalid = trimmed !== "" && (cents === null || exceedsTotal);
    const balance =
      cents !== null && cents > 0 && !invalid
        ? computeBalanceDueCents(derived.pricing, cents)
        : null;

    return (
      <section>
        <SectionHeading>Paga y señal (opcional)</SectionHeading>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-deposit`}>Importe que deja ahora el cliente</Label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              €
            </span>
            <Input
              id={`${prefix}-deposit`}
              value={depositEuros}
              onChange={(e) => setDepositEuros(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              className="pl-7"
              aria-invalid={invalid || undefined}
            />
          </div>
          {invalid ? (
            <p className="text-sm text-destructive">
              {exceedsTotal
                ? "La señal no puede superar el total del pedido."
                : "Escribe un importe válido, por ejemplo 20 o 20,50."}
            </p>
          ) : cents && cents > 0 ? (
            <p className="text-sm text-muted-foreground">
              {balance === null
                ? "El resto se calculará al cerrar el presupuesto."
                : `Pendiente al recoger: ${formatEuros(balance)}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Anota lo que el cliente paga ahora; el resto se cobra al recoger.
              Déjalo vacío si no deja señal.
            </p>
          )}
        </div>
      </section>
    );
  }

  /**
   * Panel del pedido (columna lateral en horizontal, drawer en vertical).
   * Se invoca como función —no como componente— para no perder el foco de
   * los inputs al re-renderizar. `prefix` evita ids duplicados.
   */
  function renderOrderPanel(prefix: string) {
    const isBusiness = state.customerType === "business";
    const isDelivery = state.fulfillmentType === "delivery";
    return (
      <div className="space-y-6">
        <section>
          <SectionHeading>Artículos</SectionHeading>
          <OrderItemsList />
        </section>

        <section>
          <SectionHeading>Modalidad</SectionHeading>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="lg"
              variant={state.fulfillmentType === "pickup" ? "default" : "outline"}
              onClick={() => draft.setFulfillment("pickup")}
            >
              <Store />
              Recogida
            </Button>
            <Button
              type="button"
              size="lg"
              variant={isDelivery ? "default" : "outline"}
              onClick={() => draft.setFulfillment("delivery")}
            >
              <Truck />
              Entrega
            </Button>
          </div>
          {isDelivery && (
            <div className="mt-3 grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}-street`}>Calle y número</Label>
                <Input
                  id={`${prefix}-street`}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${prefix}-municipality`}>Municipio</Label>
                  <Input
                    id={`${prefix}-municipality`}
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                    placeholder="Santa Coloma de Gramenet"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${prefix}-postal`}>Código postal</Label>
                  <Input
                    id={`${prefix}-postal`}
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="08921"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}-details`}>Piso, puerta… (opcional)</Label>
                <Input
                  id={`${prefix}-details`}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </section>

        {isBusiness && (
          <section>
            <SectionHeading>Fuente reutilizable</SectionHeading>
            <OptionCard
              role="checkbox"
              selected={state.reusableTray}
              onSelect={() => draft.setReusableTray(!state.reusableTray)}
              title="Entrega en fuente de cristal reutilizable"
              subtitle="Opcional. En el siguiente pedido podemos recoger la fuente anterior y sustituirla por la nueva."
            />
          </section>
        )}

        <section>
          <SectionHeading>Fecha y hora</SectionHeading>
          <SlotPicker
            selectedDate={state.requestedDate}
            selectedTime={state.requestedTime}
            onSelect={(date, time) => draft.setSlot(date, time)}
          />
        </section>

        <section>
          <SectionHeading>Datos del cliente</SectionHeading>
          <div className="grid gap-3">
            {isBusiness && (
              <div className="space-y-1.5">
                <Label htmlFor={`${prefix}-company`}>Nombre de la empresa</Label>
                <Input
                  id={`${prefix}-company`}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`${prefix}-name`}>Nombre del cliente</Label>
              <Input
                id={`${prefix}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${prefix}-phone`}>Teléfono</Label>
              <Input
                id={`${prefix}-phone`}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="600 000 000"
                autoComplete="off"
              />
            </div>
          </div>
        </section>

        <Separator />

        <OrderSummary />

        {derived.pricing.hasPendingExtras && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            Hay modificaciones pendientes de confirmar: el importe puede cambiar.
          </p>
        )}

        {renderDepositSection(prefix)}

        <Button
          type="button"
          size="xl"
          className="w-full"
          disabled={submitting || state.items.length === 0}
          onClick={handleSubmit}
        >
          {/* Con artículos a medida (tarta personalizada, caja de desayuno,
              copa) el total del dominio es parcial: nunca se muestra 0 €. */}
          Registrar pedido ·{" "}
          {derived.pricing.pendingQuote
            ? "a presupuestar"
            : formatEuros(derived.pricing.totalCents)}
        </Button>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Diálogo de salida protegida (compartido por éxito y pantalla normal) */
  /* ------------------------------------------------------------------ */
  const exitDialog = (
    <Dialog
      open={exitTarget !== null}
      onOpenChange={(open) => {
        if (!open) setExitTarget(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salida protegida</DialogTitle>
          <DialogDescription>
            El kiosk está bloqueado para que los clientes no puedan acceder al panel.
            Introduce la contraseña de administración para continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleExitSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kiosk-exit-password">
              Contraseña de {session?.displayName ?? "administración"}
            </Label>
            <Input
              id="kiosk-exit-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={exitPassword}
              onChange={(e) => setExitPassword(e.target.value)}
            />
          </div>
          {exitError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {exitError}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setExitTarget(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={exitBusy || !exitPassword}>
              Desbloquear
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  /* ------------------------------------------------------------------ */
  /* Pantalla de éxito                                                   */
  /* ------------------------------------------------------------------ */
  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-center">
        <span className="flex h-20 w-20 animate-scale-in items-center justify-center rounded-full bg-success/15 text-success">
          <PartyPopper className="h-10 w-10" />
        </span>
        <p className="eyebrow mt-6">Pedido registrado</p>
        <p className="mt-1 font-display text-5xl font-bold text-primary sm:text-6xl">
          {success.publicId}
        </p>
        <p className="mt-4 text-muted-foreground">
          {success.customer.name} · {formatRequestedDay(success.requestedDate)} ·{" "}
          {success.requestedTime} h
        </p>
        <p className="mt-1 font-display text-2xl font-bold text-primary">
          {success.pricing.pendingQuote
            ? "Pendiente de presupuesto"
            : formatEuros(success.pricing.totalCents)}
        </p>
        {success.depositPaidCents ? (
          <p className="mt-3 max-w-sm rounded-lg bg-success/10 px-4 py-2.5 text-sm text-foreground">
            Señal cobrada: <strong>{formatEuros(success.depositPaidCents)}</strong>.{" "}
            {(() => {
              const balance = computeBalanceDueCents(
                success.pricing,
                success.depositPaidCents
              );
              return balance === null
                ? "El resto se cobrará al cerrar el presupuesto."
                : `Pendiente al recoger: ${formatEuros(balance)}.`;
            })()}
          </p>
        ) : success.pricing.pendingQuote ? (
          <p className="mt-3 max-w-sm rounded-lg bg-secondary/15 px-4 py-2.5 text-sm text-foreground">
            Solicitud a medida: enviaremos el presupuesto por WhatsApp.
          </p>
        ) : (
          success.pricing.depositRequired && (
            <p className="mt-3 max-w-sm rounded-lg bg-secondary/15 px-4 py-2.5 text-sm text-foreground">
              Requiere señal de {formatEuros(success.pricing.depositCents)} (Bizum,
              transferencia o en tienda).
            </p>
          )
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="xl" onClick={startNewOrder}>
            <Plus />
            Nuevo pedido
          </Button>
          <Button
            type="button"
            size="xl"
            variant="outline"
            onClick={() => openExitDialog(`/admin/pedidos/${success.id}`)}
          >
            Ver detalle
          </Button>
        </div>
        {exitDialog}
      </div>
    );
  }

  const showTypeSelector = !state.customerType || choosingType;

  /* ------------------------------------------------------------------ */
  /* Pantalla principal del kiosk                                        */
  /* ------------------------------------------------------------------ */
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Cabecera fina */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="Logotipo de Dulce Flor"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full border border-secondary/40 object-cover"
            />
            <span className="truncate font-display text-base font-bold text-primary sm:text-lg">
              Kiosk · Nuevo pedido
            </span>
            {state.customerType && !choosingType && (
              <button
                type="button"
                onClick={() => setChoosingType(true)}
                aria-label={`Cambiar tipo de cliente (actual: ${CUSTOMER_TYPE_LABELS[state.customerType]})`}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-primary transition-colors hover:border-secondary"
              >
                {state.customerType === "business" ? (
                  <Building2 className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {CUSTOMER_TYPE_LABELS[state.customerType]}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  · cambiar
                </span>
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => openExitDialog("/admin/panel")}
          >
            <LogOut />
            Salir
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1fr_400px]">
        {/* Columna principal de selección */}
        <main className="min-w-0 pb-28 lg:pb-0">
          {showTypeSelector ? (
            <div className="mx-auto max-w-2xl pt-4 text-center sm:pt-10">
              <p className="eyebrow">Nuevo pedido</p>
              <h1 className="mt-1 font-display text-3xl font-bold text-primary">
                ¿Para quién es el pedido?
              </h1>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleCustomerType("individual")}
                  className="group flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary transition-transform group-hover:scale-110">
                    <User className="h-8 w-8" />
                  </span>
                  <span className="font-display text-2xl font-bold text-primary">
                    Particular
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomerType("business")}
                  className="group flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary transition-transform group-hover:scale-110">
                    <Building2 className="h-8 w-8" />
                  </span>
                  <span className="font-display text-2xl font-bold text-primary">
                    Empresa
                  </span>
                </button>
              </div>
              {state.customerType && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="mt-6"
                  onClick={() => setChoosingType(false)}
                >
                  <ArrowLeft />
                  Volver a la carta
                </Button>
              )}
            </div>
          ) : configuring && state.customerType ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => setConfiguring(null)}
                  aria-label="Volver a los productos"
                >
                  <ArrowLeft />
                </Button>
                <div className="min-w-0">
                  <h1 className="truncate font-display text-2xl font-bold text-primary">
                    {configuring.name}
                  </h1>
                  <p className="truncate text-sm text-muted-foreground">
                    {configuring.description}
                  </p>
                </div>
              </div>
              <Card>
                <CardContent className="pt-5">
                  <ProductConfigurator
                    product={configuring}
                    customerType={state.customerType}
                    compact
                    confirmLabel="Añadir"
                    onConfirm={({ selection, customization, quantity }) => {
                      const ok = draft.addConfiguredItem(selection, customization, quantity);
                      if (ok) {
                        toast.success(`${configuring.name} añadido al pedido`);
                        setConfiguring(null);
                      } else {
                        toast.error("No se pudo añadir: revisa la combinación elegida.");
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div>
              <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
                ¿Qué te apetece hoy?
              </h1>
              <p className="mt-1 text-muted-foreground">
                Toca un producto para personalizarlo.
              </p>

              {/* Parrilla de productos por familia, con tarjetas grandes que
                  aprovechan la pantalla táctil. */}
              <div className="mt-6 space-y-8">
                {productGroups.map((group) => (
                  <section key={group.family}>
                    {productGroups.length > 1 && (
                      <h2 className="mb-3 font-display text-xl font-bold text-primary">
                        {FAMILY_LABELS[group.family]}
                      </h2>
                    )}
                    <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                      {group.products.map((product) => renderProductCard(product))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Panel lateral fijo (horizontal / lg+) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-primary">
              <ShoppingBag className="h-5 w-5" />
              Pedido
            </h2>
            {state.customerType ? (
              renderOrderPanel("kiosk-desk")
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-background-soft/60 px-4 py-6 text-center text-sm text-muted-foreground">
                Elige primero el tipo de cliente.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Barra inferior con resumen expandible (vertical / < lg) */}
      {state.customerType && !showTypeSelector && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-1">
            <div className="min-w-0 px-1">
              <p className="text-xs text-muted-foreground">
                {state.items.length}{" "}
                {state.items.length === 1 ? "producto" : "productos"}
              </p>
              <p className="font-display text-2xl font-bold leading-tight text-primary">
                {derived.pricing.pendingQuote
                  ? "A presupuestar"
                  : formatEuros(derived.pricing.totalCents)}
              </p>
            </div>
            <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="xl">
                  <ShoppingBag />
                  Ver pedido
                </Button>
              </DialogTrigger>
              <DialogDrawerContent className="max-h-[92vh]">
                <DialogHeader>
                  <DialogTitle>Pedido</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto pb-2">
                  {renderOrderPanel("kiosk-mob")}
                </div>
              </DialogDrawerContent>
            </Dialog>
          </div>
        </div>
      )}
      {exitDialog}
    </div>
  );
}
