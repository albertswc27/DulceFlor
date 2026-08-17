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
  DialogDrawerContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatEuros } from "@/domain/money";
import {
  CATEGORY_LABELS,
  getProductsFor,
  getSizesFor,
  getUnitBasePriceCents,
  type CatalogProduct,
  type CategoryId,
} from "@/domain/catalog";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  type Order,
} from "@/domain/types";
import { useOrderDraft } from "@/features/order/state/OrderDraftContext";
import { ProductConfigurator } from "@/features/order/components/ProductConfigurator";
import { OrderItemsList } from "@/features/order/components/OrderItemsList";
import { OrderSummary } from "@/features/order/components/OrderSummary";
import { SlotPicker } from "@/features/order/components/SlotPicker";
import { submitOrder, type SubmitResult } from "@/features/order/services/submitOrder";
import { formatRequestedDay } from "@/features/admin/lib/adminUi";
import logo from "@/assets/logo-dulce-flor.jpeg";

const ALL_CATEGORIES: CategoryId[] = [
  "pasteles",
  "cheesecake",
  "tres-leches",
  "especialidades",
];

/** Precio "desde" de un producto, calculado siempre desde el catálogo. */
function minPriceCents(
  product: CatalogProduct,
  customerType: CustomerType
): number | null {
  let min: number | null = null;
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

  const [choosingType, setChoosingType] = React.useState(false);
  const [category, setCategory] = React.useState<CategoryId | null>(null);
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

  const products = state.customerType ? getProductsFor(state.customerType) : [];
  const categories = ALL_CATEGORIES.filter((c) => products.some((p) => p.category === c));
  const activeCategory =
    category && categories.includes(category) ? category : (categories[0] ?? null);
  const visibleProducts = products.filter((p) => p.category === activeCategory);

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
    setCategory(null);
    setConfiguring(null);
  }

  function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    let result: SubmitResult;
    try {
      result = submitOrder(state, derived, "kiosk");
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
    setSuccess(result.order);
  }

  function startNewOrder() {
    setSuccess(null);
    setChoosingType(false);
    setCategory(null);
    setConfiguring(null);
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

        <Button
          type="button"
          size="xl"
          className="w-full"
          disabled={submitting || state.items.length === 0}
          onClick={handleSubmit}
        >
          Registrar pedido · {formatEuros(derived.pricing.totalCents)}
        </Button>
      </div>
    );
  }

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
          {formatEuros(success.pricing.totalCents)}
        </p>
        {success.pricing.depositRequired && (
          <p className="mt-3 max-w-sm rounded-lg bg-secondary/15 px-4 py-2.5 text-sm text-foreground">
            Requiere señal de {formatEuros(success.pricing.depositCents)} (Bizum,
            transferencia o en tienda).
          </p>
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
            onClick={() => navigate(`/admin/pedidos/${success.id}`)}
          >
            Ver detalle
          </Button>
        </div>
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
            onClick={() => navigate("/admin/panel")}
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
              {/* Categorías grandes */}
              <div
                role="radiogroup"
                aria-label="Categorías de producto"
                className="mb-5 flex gap-2 overflow-x-auto pb-1"
              >
                {categories.map((cat) => {
                  const isActive = cat === activeCategory;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "h-14 shrink-0 rounded-xl border px-6 font-display text-lg font-semibold transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-soft"
                          : "border-border bg-card text-primary hover:border-secondary"
                      )}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>

              {/* Grid de productos */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProducts.map((product) => {
                  const from =
                    state.customerType && minPriceCents(product, state.customerType);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setConfiguring(product)}
                      className="group flex min-h-[10rem] flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span className="font-display text-xl font-bold text-primary">
                        {product.name}
                      </span>
                      <span className="mt-1 flex-1 text-sm leading-snug text-muted-foreground">
                        {product.description}
                      </span>
                      <span className="mt-4 flex items-center justify-between">
                        <span className="font-display text-lg font-semibold text-primary">
                          {typeof from === "number" ? `Desde ${formatEuros(from)}` : ""}
                        </span>
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/20 text-primary transition-transform group-hover:scale-110">
                          <Plus className="h-5 w-5" />
                        </span>
                      </span>
                    </button>
                  );
                })}
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
                {formatEuros(derived.pricing.totalCents)}
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
    </div>
  );
}
