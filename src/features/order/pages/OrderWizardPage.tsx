/**
 * Wizard de pedido público, mobile-first:
 * 1 Tipo de cliente → 2 Producto → 3 Personalización → 4 Entrega →
 * 5 Fecha y hora → 6 Tus datos → 7 Resumen y envío.
 * El resumen del pedido está siempre accesible (sidebar en desktop,
 * barra inferior + drawer en móvil).
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Building2, ReceiptText, ShoppingBag, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogDrawerContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DELIVERY_ZONES } from "@/config/business";
import { CATEGORY_LABELS, getProductsFor, type CatalogProduct } from "@/domain/catalog";
import { resolveDeliveryZone } from "@/domain/delivery";
import { isRequestedSlotValid } from "@/domain/schedule";
import { formatEuros } from "@/domain/money";
import { buildOrderWhatsAppMessage, buildWhatsAppUrl } from "@/domain/whatsapp";
import { addressSchema, customerSchema } from "@/domain/validation";
import type { CustomerType, FulfillmentType } from "@/domain/types";
import { useOrderDraft } from "@/features/order/state/OrderDraftContext";
import { ProductConfigurator } from "@/features/order/components/ProductConfigurator";
import { OrderItemsList } from "@/features/order/components/OrderItemsList";
import { OrderSummary } from "@/features/order/components/OrderSummary";
import { SlotPicker } from "@/features/order/components/SlotPicker";
import { OptionCard } from "@/features/order/components/OptionCard";
import { submitOrder } from "@/features/order/services/submitOrder";

type StepId =
  | "customer-type"
  | "product"
  | "configure"
  | "fulfillment"
  | "slot"
  | "contact"
  | "review";

const STEP_TITLES: Record<StepId, string> = {
  "customer-type": "¿Para quién es el pedido?",
  product: "Elige tu producto",
  configure: "Personalízalo",
  fulfillment: "Recogida o entrega",
  slot: "Fecha y hora",
  contact: "Tus datos",
  review: "Revisa tu pedido",
};

export default function OrderWizardPage() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const draft = useOrderDraft();
  const { state, derived } = draft;

  const [step, setStep] = React.useState<StepId>(
    state.customerType ? "product" : "customer-type"
  );
  const [configuringProduct, setConfiguringProduct] = React.useState<CatalogProduct | null>(
    null
  );
  const [contactErrors, setContactErrors] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // Campos controlados de contacto/dirección
  const [name, setName] = React.useState(state.customer?.name ?? "");
  const [phone, setPhone] = React.useState(state.customer?.phone ?? "");
  const [email, setEmail] = React.useState(state.customer?.email ?? "");
  const [companyName, setCompanyName] = React.useState(state.customer?.companyName ?? "");
  const [street, setStreet] = React.useState(state.address?.street ?? "");
  const [municipality, setMunicipality] = React.useState(state.address?.municipality ?? "");
  const [postalCode, setPostalCode] = React.useState(state.address?.postalCode ?? "");
  const [details, setDetails] = React.useState(state.address?.details ?? "");

  const products = state.customerType ? getProductsFor(state.customerType) : [];
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
    // Gestión de foco: al cambiar de paso, el título recibe el foco para que
    // los lectores de pantalla anuncien el nuevo contexto.
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Si el pedido se queda vacío en un paso posterior (p. ej. quitando el
  // último artículo desde el drawer), volvemos a la selección de producto.
  React.useEffect(() => {
    if (
      state.items.length === 0 &&
      ["fulfillment", "slot", "contact", "review"].includes(step)
    ) {
      setStep("product");
    }
  }, [state.items.length, step]);

  function goTo(next: StepId) {
    setStep(next);
  }

  function handleCustomerType(type: CustomerType) {
    if (state.customerType && state.customerType !== type && state.items.length > 0) {
      toast.info("Se ha vaciado el pedido porque la carta de particulares y empresas es distinta.");
    }
    draft.setCustomerType(type);
    goTo("product");
  }

  function handleFulfillment(type: FulfillmentType) {
    draft.setFulfillment(type);
    setContactErrors([]);
  }

  function saveAddressIfValid(): boolean {
    if (state.fulfillmentType !== "delivery") {
      setContactErrors([]);
      return true;
    }
    const parsed = addressSchema.safeParse({ street, municipality, postalCode, details });
    if (!parsed.success) {
      setContactErrors(parsed.error.issues.map((i) => i.message));
      return false;
    }
    draft.setAddress({
      street: street.trim(),
      municipality: municipality.trim(),
      postalCode: postalCode.trim(),
      details: details.trim() || undefined,
    });
    setContactErrors([]);
    return true;
  }

  function saveContactIfValid(): boolean {
    const parsed = customerSchema.safeParse({ name, phone, email, companyName });
    if (!parsed.success) {
      setContactErrors(parsed.error.issues.map((i) => i.message));
      return false;
    }
    draft.setCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      companyName: companyName.trim() || undefined,
    });
    setContactErrors([]);
    return true;
  }

  function handleSubmit() {
    setSubmitting(true);
    let result: ReturnType<typeof submitOrder>;
    try {
      result = submitOrder(state, derived, "web");
    } catch {
      // p. ej. localStorage lleno o bloqueado: el botón no debe quedar colgado.
      setSubmitting(false);
      toast.error(
        "No se pudo registrar el pedido en este dispositivo. Libera espacio de almacenamiento e inténtalo de nuevo."
      );
      return;
    }
    if (!result.ok) {
      setSubmitting(false);
      result.errors.forEach((e) => toast.error(e));
      // Si el problema es la fecha/hora (slot caducado), llevamos al paso de fecha.
      if (result.errors.some((e) => e.includes("fecha") || e.includes("hora"))) {
        goTo("slot");
      }
      return;
    }
    // 1) El pedido YA está guardado. 2) Abrimos WhatsApp con el mensaje
    // preparado dentro del gesto del usuario para evitar bloqueos de popup.
    const message = buildOrderWhatsAppMessage(result.order);
    const url = buildWhatsAppUrl(message);
    window.open(url, "_blank", "noopener");
    draft.reset();
    navigate(`/pedido/confirmacion/${result.order.id}`);
  }

  const stepOrder: StepId[] = [
    "customer-type",
    "product",
    "configure",
    "fulfillment",
    "slot",
    "contact",
    "review",
  ];
  const visibleStepIndex = stepOrder.indexOf(step);

  function back() {
    switch (step) {
      case "product":
        goTo("customer-type");
        break;
      case "configure":
        setConfiguringProduct(null);
        goTo("product");
        break;
      case "fulfillment":
        goTo("product");
        break;
      case "slot":
        goTo("fulfillment");
        break;
      case "contact":
        goTo("slot");
        break;
      case "review":
        goTo("contact");
        break;
      default:
        navigate("/");
    }
  }

  const canLeaveFulfillment =
    state.fulfillmentType === "pickup" ||
    (state.fulfillmentType === "delivery" &&
      street.trim() &&
      municipality.trim() &&
      /^\d{5}$/.test(postalCode.trim()));

  return (
    <div className="container max-w-5xl pb-32 pt-6 sm:pt-10 lg:pb-10">
      {/* Cabecera del wizard */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Volver">
          <ArrowLeft />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-accent">
            Paso {visibleStepIndex + 1} de {stepOrder.length}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-bold text-primary outline-none sm:text-3xl"
          >
            {STEP_TITLES[step]}
          </h1>
        </div>
      </div>

      {/* Barra de progreso */}
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={stepOrder.length}
        aria-valuenow={visibleStepIndex + 1}
        aria-label="Progreso del pedido"
        className="mb-8 h-1.5 overflow-hidden rounded-full bg-border"
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${((visibleStepIndex + 1) / stepOrder.length) * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.35, ease: "easeOut" }}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {step === "customer-type" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleCustomerType("individual")}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary transition-transform group-hover:scale-110">
                      <User className="h-8 w-8" />
                    </span>
                    <span className="font-display text-xl font-bold text-primary">Particular</span>
                    <span className="text-sm text-muted-foreground">
                      Tartas y dulces para cumpleaños, celebraciones y momentos especiales.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCustomerType("business")}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary transition-transform group-hover:scale-110">
                      <Building2 className="h-8 w-8" />
                    </span>
                    <span className="font-display text-xl font-bold text-primary">Empresa</span>
                    <span className="text-sm text-muted-foreground">
                      Precios pensados para empresas y restaurantes.
                    </span>
                  </button>
                </div>
              )}

              {step === "product" && (
                <div className="space-y-6">
                  {(["pasteles", "cheesecake", "tres-leches", "especialidades"] as const).map(
                    (category) => {
                      const catProducts = products.filter((p) => p.category === category);
                      if (catProducts.length === 0) return null;
                      return (
                        <div key={category}>
                          <h2 className="mb-3 font-display text-lg font-semibold text-primary">
                            {CATEGORY_LABELS[category]}
                          </h2>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {catProducts.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  setConfiguringProduct(product);
                                  goTo("configure");
                                }}
                                className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              >
                                <span className="font-display text-lg font-bold text-primary group-hover:text-primary/90">
                                  {product.name}
                                </span>
                                <span className="mt-1 flex-1 text-sm text-muted-foreground">
                                  {product.description}
                                </span>
                                <span className="mt-3 text-sm font-medium text-accent">
                                  Personalizar →
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}

                  {state.items.length > 0 && (
                    <div className="space-y-3 rounded-2xl bg-background-soft/70 p-4">
                      <h2 className="font-display text-lg font-semibold text-primary">
                        Tu pedido hasta ahora
                      </h2>
                      <OrderItemsList />
                      <Button size="lg" className="w-full" onClick={() => goTo("fulfillment")}>
                        Continuar · {formatEuros(derived.pricing.subtotalCents)}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {step === "configure" && configuringProduct && state.customerType && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">{configuringProduct.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {configuringProduct.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ProductConfigurator
                      product={configuringProduct}
                      customerType={state.customerType}
                      onConfirm={({ selection, customization, quantity }) => {
                        const ok = draft.addConfiguredItem(selection, customization, quantity);
                        if (ok) {
                          toast.success("Añadido al pedido");
                          setConfiguringProduct(null);
                          goTo("product");
                        } else {
                          toast.error("No se pudo añadir: revisa la combinación elegida.");
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {step === "fulfillment" && (
                <div className="space-y-5">
                  <div role="group" aria-label="Modalidad" className="grid gap-3 sm:grid-cols-2">
                    <OptionCard
                      selected={state.fulfillmentType === "pickup"}
                      onSelect={() => handleFulfillment("pickup")}
                      title="Recogida en tienda"
                      subtitle="Sin coste adicional"
                      price={formatEuros(0)}
                    />
                    <OptionCard
                      selected={state.fulfillmentType === "delivery"}
                      onSelect={() => handleFulfillment("delivery")}
                      title="Entrega a domicilio"
                      subtitle={`Según zona: ${DELIVERY_ZONES.map((z) =>
                        z.feeCents === null
                          ? `${z.label} a consultar`
                          : `${z.label} ${formatEuros(z.feeCents)}`
                      ).join(" · ")} · resto a consultar`}
                    />
                  </div>

                  {state.fulfillmentType === "delivery" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Dirección de entrega</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="street">Calle y número</Label>
                          <Input
                            id="street"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            autoComplete="street-address"
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="municipality">Municipio</Label>
                            <Input
                              id="municipality"
                              value={municipality}
                              onChange={(e) => setMunicipality(e.target.value)}
                              placeholder="Santa Coloma de Gramenet"
                              autoComplete="address-level2"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="postalCode">Código postal</Label>
                            <Input
                              id="postalCode"
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value)}
                              inputMode="numeric"
                              maxLength={5}
                              placeholder="08921"
                              autoComplete="postal-code"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="details">Piso, puerta, indicaciones (opcional)</Label>
                          <Input
                            id="details"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                          />
                        </div>

                        {/* Vista previa de la zona en cuanto hay CP o municipio */}
                        {(() => {
                          if (!/^\d{5}$/.test(postalCode.trim()) && !municipality.trim()) {
                            return null;
                          }
                          const preview = resolveDeliveryZone({ municipality, postalCode });
                          return preview.needsConsultation ? (
                            <p
                              role="status"
                              className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
                            >
                              Dirección fuera de nuestras zonas con tarifa automática:
                              consultaremos la disponibilidad de entrega y su coste por
                              WhatsApp.
                            </p>
                          ) : (
                            <p
                              role="status"
                              className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
                            >
                              Zona: {preview.zone?.label} · entrega{" "}
                              {preview.feeCents === 0
                                ? "gratuita"
                                : formatEuros(preview.feeCents ?? 0)}
                            </p>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {contactErrors.length > 0 && (
                    <ul role="alert" className="space-y-1 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {contactErrors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}

                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!canLeaveFulfillment}
                    onClick={() => {
                      if (saveAddressIfValid()) goTo("slot");
                    }}
                  >
                    Continuar
                  </Button>
                </div>
              )}

              {step === "slot" && (
                <div className="space-y-5">
                  <SlotPicker
                    selectedDate={state.requestedDate}
                    selectedTime={state.requestedTime}
                    onSelect={(date, time) => draft.setSlot(date, time)}
                  />
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={
                      !state.requestedDate ||
                      !state.requestedTime ||
                      !isRequestedSlotValid(state.requestedDate, state.requestedTime)
                    }
                    onClick={() => goTo("contact")}
                  >
                    Continuar
                  </Button>
                </div>
              )}

              {step === "contact" && (
                <div className="space-y-5">
                  <Card>
                    <CardContent className="grid gap-4 pt-5">
                      {state.customerType === "business" && (
                        <div className="space-y-1.5">
                          <Label htmlFor="companyName">Nombre de la empresa</Label>
                          <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            autoComplete="organization"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Nombre y apellidos</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="600 000 000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email (opcional)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {contactErrors.length > 0 && (
                    <ul role="alert" className="space-y-1 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {contactErrors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      if (saveContactIfValid()) goTo("review");
                    }}
                  >
                    Revisar pedido
                  </Button>
                </div>
              )}

              {step === "review" && (
                <div className="space-y-5">
                  <OrderItemsList />

                  <Card>
                    <CardHeader>
                      <CardTitle>Detalles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Modalidad: </span>
                        {state.fulfillmentType === "pickup"
                          ? "Recogida en tienda"
                          : "Entrega a domicilio"}
                      </p>
                      {state.fulfillmentType === "delivery" && state.address && (
                        <p>
                          <span className="text-muted-foreground">Dirección: </span>
                          {state.address.street}, {state.address.postalCode}{" "}
                          {state.address.municipality}
                        </p>
                      )}
                      <p>
                        <span className="text-muted-foreground">Fecha: </span>
                        {state.requestedDate} · {state.requestedTime}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Contacto: </span>
                        {state.customer?.name} · {state.customer?.phone}
                      </p>
                      {state.customer?.companyName && (
                        <p>
                          <span className="text-muted-foreground">Empresa: </span>
                          {state.customer.companyName}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Resumen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <OrderSummary />
                    </CardContent>
                  </Card>

                  <p className="text-xs text-muted-foreground">
                    Al enviar la solicitud se abrirá WhatsApp con el resumen preparado para
                    que nos lo envíes. El pedido queda pendiente de confirmación por Dulce
                    Flor.
                  </p>

                  <Button
                    size="xl"
                    className="w-full"
                    disabled={submitting || state.items.length === 0}
                    onClick={handleSubmit}
                  >
                    <ReceiptText />
                    Enviar solicitud de pedido
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Resumen fijo en desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Tu pedido
                </CardTitle>
              </CardHeader>
              <CardContent>
                {state.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Añade productos para ver el resumen.
                  </p>
                ) : (
                  <OrderSummary />
                )}
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Barra inferior móvil con total + drawer del resumen */}
      {state.items.length > 0 && step !== "review" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
          <div className="container flex max-w-5xl items-center justify-between gap-3 px-1">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex flex-col items-start rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-xs text-muted-foreground">
                    {state.items.length}{" "}
                    {state.items.length === 1 ? "producto" : "productos"} · ver resumen
                  </span>
                  <span className="font-display text-xl font-bold text-primary">
                    {formatEuros(derived.pricing.totalCents)}
                  </span>
                </button>
              </DialogTrigger>
              <DialogDrawerContent>
                <DialogHeader>
                  <DialogTitle>Tu pedido</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto">
                  <OrderItemsList />
                  <div className="mt-4">
                    <OrderSummary />
                  </div>
                </div>
              </DialogDrawerContent>
            </Dialog>
            {step === "product" && (
              <Button size="lg" onClick={() => goTo("fulfillment")}>
                Continuar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
