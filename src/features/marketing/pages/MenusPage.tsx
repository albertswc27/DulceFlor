import * as React from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatEuros } from "@/domain/money";
import {
  CAKE_FILLINGS,
  CATEGORY_LABELS,
  CHEESECAKE_FLAVORS,
  CHEESECAKE_SIZES_BUSINESS,
  CHEESECAKE_SIZES_INDIVIDUAL,
  SPONGE_FLAVORS,
  TOPPINGS,
  getProduct,
  getProductsFor,
  getSizesFor,
  getUnitBasePriceCents,
  type CatalogProduct,
  type QuantityTier,
} from "@/domain/catalog";
import {
  DEPOSIT_PERCENTAGE,
  DEPOSIT_THRESHOLD_CENTS,
  MIN_ORDER_LEAD_TIME_HOURS,
  TOPPING_PRICE_CENTS,
  WHATSAPP_PHONE,
} from "@/config/business";
import type { CustomerType } from "@/domain/types";
import {
  BREAKFAST_PHOTOS,
  GLASS_PHOTOS,
  OTHER_SAVOURY_PHOTOS,
  SAVOURY_HERO_PHOTOS,
  SAVOURY_PRODUCT_PHOTOS,
  SWEET_SNACK_PHOTOS,
  type Photo,
} from "@/assets/photos";
import {
  buildCakeMatrix,
  getGiftProducts,
  getSnackMinQuantity,
  getSnackProducts,
} from "../lib/catalogView";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { PhotoGrid } from "../components/PhotoGrid";

function priceOrDash(cents: number | null): string {
  return cents === null ? "—" : formatEuros(cents);
}

/** Enlace a WhatsApp con el texto ya preparado (la persona decide si lo envía). */
function whatsAppUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
}

/** Conmutador Particulares / Empresas accesible. */
function CustomerTypeSwitch({
  mode,
  onChange,
}: {
  mode: CustomerType;
  onChange: (mode: CustomerType) => void;
}) {
  const options: Array<{ value: CustomerType; label: string }> = [
    { value: "individual", label: "Particulares" },
    { value: "business", label: "Empresas" },
  ];

  return (
    <div
      role="group"
      aria-label="Elegir carta según tipo de cliente"
      className="mx-auto flex w-full max-w-md rounded-xl border border-border bg-card p-1 shadow-soft"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-12 flex-1 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-base",
            mode === option.value
              ? "bg-primary text-primary-foreground shadow-soft"
              : "text-foreground/70 hover:bg-primary/5 hover:text-primary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Matriz personas × discos de un pastel, desde el catálogo. */
function CakePriceCard({ productId }: { productId: string }) {
  const product = getProduct(productId);
  if (!product) return null;
  const matrix = buildCakeMatrix(product, "individual");

  return (
    <Card className="h-full min-w-0">
      <CardHeader>
        <CardTitle className="text-xl">{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[430px] text-sm">
            <caption className="sr-only">
              Precios de {product.name} según número de personas y de discos
            </caption>
            <thead>
              <tr className="border-b border-border bg-blush/40 text-left">
                <th scope="col" className="px-4 py-3 font-display font-semibold text-primary">
                  Tamaño
                </th>
                {matrix.columnLabels.map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-4 py-3 font-display font-semibold text-primary"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrix.rows.map((row) => (
                <tr key={row.tierLabel}>
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-medium text-foreground/90"
                  >
                    {row.tierLabel}
                  </th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.sizeId}
                      className="px-4 py-3 font-medium tabular-nums text-primary"
                    >
                      {priceOrDash(cell.priceCents)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground sm:hidden">
          Desliza la tabla para ver todos los tamaños.
        </p>
      </CardContent>
    </Card>
  );
}

/** Tabla de cheesecakes: sabores × tamaños, según tipo de cliente. */
function CheesecakeTable({ customerType }: { customerType: CustomerType }) {
  const sizes =
    customerType === "business"
      ? CHEESECAKE_SIZES_BUSINESS
      : CHEESECAKE_SIZES_INDIVIDUAL;

  return (
    <div className="w-full min-w-0">
      <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">
          Precios de cheesecakes por sabor y tamaño (
          {customerType === "business" ? "empresas" : "particulares"})
        </caption>
        <thead>
          <tr className="border-b border-border bg-blush/40 text-left">
            <th scope="col" className="px-4 py-3 font-display font-semibold text-primary">
              Sabor
            </th>
            {sizes.map((size) => (
              <th
                key={size.id}
                scope="col"
                className="px-4 py-3 font-display font-semibold text-primary"
              >
                {size.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {CHEESECAKE_FLAVORS.map((flavor) => (
            <tr key={flavor.id}>
              <th
                scope="row"
                className="px-4 py-3 text-left font-medium text-foreground/90"
              >
                {flavor.label}
              </th>
              {sizes.map((size) => (
                <td
                  key={size.id}
                  className="px-4 py-3 font-medium tabular-nums text-primary"
                >
                  {priceOrDash(
                    getUnitBasePriceCents("cheesecake", customerType, size.id, flavor.id)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground sm:hidden">
        Desliza la tabla para ver todos los tamaños.
      </p>
    </div>
  );
}

/** Lista tamaño → precio de un producto, desde el catálogo. */
function SizePriceList({
  productId,
  customerType,
}: {
  productId: string;
  customerType: CustomerType;
}) {
  const product = getProduct(productId);
  if (!product) return null;
  const sizes = getSizesFor(product, customerType);

  return (
    <ul className="divide-y divide-border">
      {sizes.map((size) => (
        <li key={size.id} className="flex items-center justify-between gap-4 py-3">
          <span className="text-foreground/90">{size.label}</span>
          <span className="font-display font-semibold tabular-nums text-primary">
            {priceOrDash(
              getUnitBasePriceCents(product.id, customerType, size.id)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Notas de suplemento de topping específicas por tamaño (p. ej. tres leches gigante). */
function ToppingOverrideNotes({
  productId,
  customerType,
}: {
  productId: string;
  customerType: CustomerType;
}) {
  const product = getProduct(productId);
  if (!product?.toppingPriceOverridesBySizeId) return null;
  const sizes = getSizesFor(product, customerType);

  const notes = Object.entries(product.toppingPriceOverridesBySizeId)
    .map(([sizeId, cents]) => {
      const size = sizes.find((s) => s.id === sizeId);
      return size ? { sizeLabel: size.label, cents } : null;
    })
    .filter((note): note is { sizeLabel: string; cents: number } => note !== null);

  if (notes.length === 0) return null;

  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Toppings: +{formatEuros(TOPPING_PRICE_CENTS)} por topping
      {notes.map(
        (note) =>
          `; en el tamaño de ${note.sizeLabel} el suplemento es de ${formatEuros(
            note.cents
          )}`
      )}
      .
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Aperitivos                                                          */
/* ------------------------------------------------------------------ */

/**
 * Muestra variada de lo que también sale del obrador. Son 7 fotos: se enseñan
 * 4, una de cada tipo, para no convertir el bloque en un muro de imágenes.
 */
const OTHER_SAVOURY_SAMPLE: Photo[] = OTHER_SAVOURY_PHOTOS.slice(0, 4);

/**
 * Tramos de precio por volumen tal y como los ve el cliente en el pedido
 * ("15 uds", "25 uds", "50+ uds"). Los importes salen de `quantityTiers`.
 */
function SnackTierList({ tiers }: { tiers: QuantityTier[] }) {
  if (tiers.length === 0) return null;
  return (
    <ul className="divide-y divide-border text-sm">
      {tiers.map((tier) => (
        <li key={tier.id} className="flex items-center justify-between gap-3 py-2">
          <span className="text-foreground/90">
            {tier.open ? `${tier.minQuantity}+ uds` : `${tier.minQuantity} uds`}
          </span>
          <span className="font-medium tabular-nums text-primary">
            {formatEuros(tier.unitPriceCents)}/ud
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Ficha compacta de un aperitivo salado con tarifa (móvil primero). */
function SnackCard({ product }: { product: CatalogProduct }) {
  const photo = SAVOURY_PRODUCT_PHOTOS[product.id];

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {photo && (
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          width={1200}
          height={900}
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto p-4 pt-2">
        <SnackTierList tiers={product.quantityTiers ?? []} />
      </CardContent>
    </Card>
  );
}

type SnackTab = "salados" | "dulces";

/** Conmutador Salados / Dulces, con el mismo patrón que el de tipo de cliente. */
function SnackTabs({
  tab,
  onChange,
}: {
  tab: SnackTab;
  onChange: (tab: SnackTab) => void;
}) {
  const options: Array<{ value: SnackTab; label: string }> = [
    { value: "salados", label: CATEGORY_LABELS["aperitivos-salados"] },
    { value: "dulces", label: CATEGORY_LABELS["aperitivos-dulces"] },
  ];

  return (
    <div
      role="group"
      aria-label="Tipo de aperitivo"
      className="flex w-full max-w-xs rounded-xl border border-border bg-card p-1 shadow-soft"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={tab === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-11 flex-1 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            tab === option.value
              ? "bg-primary text-primary-foreground shadow-soft"
              : "text-foreground/70 hover:bg-primary/5 hover:text-primary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SavourySnacksPanel({ customerType }: { customerType: CustomerType }) {
  const products = getSnackProducts(customerType);
  const minQuantity = getSnackMinQuantity(customerType);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-background-soft/70 px-4 py-3">
        {minQuantity !== null && (
          <Badge variant="secondary">Pedido mínimo {minQuantity} uds</Badge>
        )}
        <p className="text-sm text-muted-foreground">
          El precio por unidad baja según la cantidad que pidas de cada variedad.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id}>
            <SnackCard product={product} />
          </li>
        ))}
      </ul>

      {/* Solo si queda algún salado sin tarifa confirmada. */}
      {OTHER_SAVOURY_SAMPLE.length > 0 && (
        <div className="rounded-2xl border border-secondary/40 bg-background-soft/50 p-4 sm:p-5">
          <h3 className="font-display text-base font-semibold text-primary">
            También preparamos
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mini empanadas, tequeños y mini hamburguesas hechos en el obrador.
            Todavía no están en carta con precio: consúltanos por WhatsApp y te
            pasamos presupuesto según la cantidad.
          </p>
          <PhotoGrid photos={OTHER_SAVOURY_SAMPLE} columns={4} className="mt-3" />
          <Button asChild variant="outline" size="lg" className="mt-4 w-full sm:w-auto">
            <a
              href={whatsAppUrl(
                "Hola Dulce Flor, quería consultar precio de empanadas, tequeños o mini hamburguesas."
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              Consultar por WhatsApp
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function SweetSnacksPanel() {
  return (
    <div className="space-y-4">
      <PhotoGrid photos={SWEET_SNACK_PHOTOS} columns={2} />
      <div className="rounded-2xl border border-secondary/40 bg-background-soft/50 p-4 sm:p-5">
        <p className="text-sm text-foreground/90">
          Preparamos también bocaditos dulces: vasitos individuales, cupcakes
          personalizados… Todavía no tenemos cerrada su carta, así que no
          aparecen aquí con precio.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Cuéntanos qué necesitas y para cuánta gente, y te pasamos propuesta y
          precio.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-4 w-full sm:w-auto">
          <a
            href={whatsAppUrl(
              "Hola Dulce Flor, quería consultar por los bocaditos dulces (vasitos, cupcakes…)."
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            Consúltanos por WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

/** Aperitivos: salados con tarifa por volumen y dulces a consultar. */
function AperitivosSection({ customerType }: { customerType: CustomerType }) {
  const [tab, setTab] = React.useState<SnackTab>("salados");
  const hasSavoury = getSnackProducts(customerType).length > 0;
  if (!hasSavoury) return null;

  return (
    <section className="space-y-6">
      <SectionHeading
        align="left"
        eyebrow="Para tus eventos"
        title="Aperitivos"
        subtitle="Bocaditos salados con precio por cantidad y bocaditos dulces para rematar la mesa."
      />

      <PhotoGrid photos={SAVOURY_HERO_PHOTOS} columns={2} />

      <SnackTabs tab={tab} onChange={setTab} />

      <div key={tab} className="animate-fade-in">
        {tab === "salados" ? (
          <SavourySnacksPanel customerType={customerType} />
        ) : (
          <SweetSnacksPanel />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Desayunos y regalos personalizados                                  */
/* ------------------------------------------------------------------ */

/** Fotos reales por tipo de regalo (el catálogo pone nombre y descripción). */
const GIFT_PHOTOS: Record<NonNullable<CatalogProduct["giftType"]>, Photo[]> = {
  desayuno: BREAKFAST_PHOTOS,
  copa: GLASS_PHOTOS,
};

function GiftsSection({ customerType }: { customerType: CustomerType }) {
  const gifts = getGiftProducts(customerType);
  if (gifts.length === 0) return null;

  return (
    <section className="space-y-6">
      <SectionHeading
        align="left"
        eyebrow="Para regalar"
        title="Desayunos y regalos personalizados"
        subtitle="Cajas de desayuno y copas preparadas a medida, con la dedicatoria que nos digas."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {gifts.map((product) => {
          const photos = product.giftType ? GIFT_PHOTOS[product.giftType] : [];
          const isGlass = product.giftType === "copa";
          return (
            <Card key={product.id} className="flex h-full flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    A consultar
                  </Badge>
                </div>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-4">
                <PhotoGrid
                  photos={photos}
                  columns={isGlass ? 3 : 2}
                  limit={isGlass ? 3 : 2}
                />
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link to="/pedido">Solicitar presupuesto</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Estos regalos no tienen precio en carta: cuéntanos la ocasión y la
        dedicatoria al solicitarlos y te confirmamos las opciones y el precio por
        WhatsApp.
      </p>
    </section>
  );
}

function IndividualMenu() {
  const classicCake = getProduct("pastel-clasico");
  const tresLeches = getProduct("tres-leches");
  // Productos sin precio automático (tarta personalizada y de fondant): sus
  // nombres y descripciones salen del catálogo, nunca escritos a mano.
  const quoteCakes = getProductsFor("individual").filter(
    (product) => product.pricingType === "quote"
  );

  return (
    <div className="space-y-14">
      {/* Tartas con precio cerrado en carta */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Para compartir"
          title="Tartas clásicas"
          subtitle={`Elige tamaño y número de discos. El bizcocho (${SPONGE_FLAVORS.length} sabores) y el relleno (${CAKE_FILLINGS.length} opciones) van incluidos en el precio.`}
        />
        <div className="grid gap-6 xl:grid-cols-2">
          <CakePriceCard productId="pastel-clasico" />
          <CakePriceCard productId="pastel-buttercream" />
        </div>
      </section>

      {/* Tartas a medida: sin precio en carta, se presupuestan a mano */}
      {quoteCakes.length > 0 && (
        <section className="space-y-6">
          <SectionHeading
            align="left"
            eyebrow="A medida"
            title="Tartas personalizadas y de fondant"
            subtitle="Las decoraciones especiales no tienen precio en carta: se presupuestan según el diseño y la complejidad."
          />
          <div className="grid gap-5 md:grid-cols-2">
            {quoteCakes.map((product) => (
              <Card key={product.id} className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <Badge variant="secondary" className="shrink-0">
                      A consultar
                    </Badge>
                  </div>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Cuéntanos tu idea al hacer el pedido y adjunta una imagen de referencia:
            te confirmamos el presupuesto por WhatsApp antes de ponernos a ello.
          </p>
        </section>
      )}

      {/* Cheesecakes */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Cremosos"
          title="Cheesecakes"
          subtitle={`${CHEESECAKE_FLAVORS.length} sabores de receta casera. El precio depende del sabor y del tamaño.`}
        />
        <CheesecakeTable customerType="individual" />
      </section>

      {/* Tres leches */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Un clásico"
          title="Tarta Tres Leches"
          subtitle={tresLeches?.description}
        />
        <Card>
          <CardContent className="pt-5">
            <SizePriceList productId="tres-leches" customerType="individual" />
            <ToppingOverrideNotes productId="tres-leches" customerType="individual" />
          </CardContent>
        </Card>
      </section>

      {/* Rellenos */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Incluidos en el precio"
          title="Rellenos de pasteles"
          subtitle={`Elige uno de nuestros ${CAKE_FILLINGS.length} rellenos, sin coste adicional.`}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAKE_FILLINGS.map((filling) => (
            <li key={filling.id}>
              <Card className="h-full">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{filling.label}</CardTitle>
                  {filling.description && (
                    <CardDescription>{filling.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Personalización */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Hazlo único"
          title="Personalización"
          subtitle="Bizcochos, toppings y extras para rematar el acabado clásico de tu tarta."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">
                Sabores de bizcocho ({SPONGE_FLAVORS.length})
              </CardTitle>
              <CardDescription>Incluidos en el precio del pastel.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {SPONGE_FLAVORS.map((flavor) => (
                  <li key={flavor.id}>
                    <Badge variant="secondary">{flavor.label}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Toppings y extras</CardTitle>
              </div>
              <CardDescription>
                Cada topping añade {formatEuros(TOPPING_PRICE_CENTS)} al precio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {TOPPINGS.map((topping) => (
                  <li key={topping.id}>
                    <Badge variant="accent">
                      {topping.label} +{formatEuros(TOPPING_PRICE_CENTS)}
                    </Badge>
                  </li>
                ))}
              </ul>
              {classicCake && classicCake.extras.length > 0 && (
                <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
                  {classicCake.extras.map((extra) => (
                    <li
                      key={extra.id}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <span className="text-foreground/90">{extra.label}</span>
                      <span className="shrink-0 font-medium tabular-nums text-primary">
                        +{formatEuros(extra.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                La disponibilidad de cada extra depende del producto elegido.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Aperitivos y regalos van tras el bloque de tartas, sin tocarlo. */}
      <AperitivosSection customerType="individual" />

      <GiftsSection customerType="individual" />
    </div>
  );
}

function BusinessMenu() {
  const specialties = getProductsFor("business").filter(
    (product) => product.category === "especialidades"
  );
  const tresLeches = getProduct("tres-leches");

  return (
    <div className="space-y-14">
      <p className="mx-auto max-w-2xl text-center text-base text-muted-foreground sm:text-lg">
        Precios pensados para empresas y restaurantes, con cartas específicas y
        formatos listos para servir.
      </p>

      {/* Cheesecakes empresas */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Para tu negocio"
          title="Cheesecakes"
          subtitle={`${CHEESECAKE_FLAVORS.length} sabores de receta casera con precios para empresas.`}
        />
        <CheesecakeTable customerType="business" />
      </section>

      {/* Tres leches empresas */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Un clásico"
          title="Tarta Tres Leches"
          subtitle={tresLeches?.description}
        />
        <Card>
          <CardContent className="pt-5">
            <SizePriceList productId="tres-leches" customerType="business" />
          </CardContent>
        </Card>
      </section>

      {/* Especialidades */}
      <section className="space-y-6">
        <SectionHeading
          align="left"
          eyebrow="Solo para empresas"
          title="Especialidades"
          subtitle="Dulces caseros en formato para negocios."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {specialties.map((product) => (
            <Card key={product.id} className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <SizePriceList productId={product.id} customerType="business" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Los aperitivos salados están disponibles también para empresas. */}
      <AperitivosSection customerType="business" />
    </div>
  );
}

export default function MenusPage() {
  const [mode, setMode] = React.useState<CustomerType>("individual");
  const snackMinQuantity = getSnackMinQuantity(mode);

  return (
    <>
      <header className="bg-gradient-to-b from-background-soft/70 to-background py-12 sm:py-16">
        <div className="container text-center">
          <p className="eyebrow">Nuestra carta</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-primary sm:text-5xl">
            Sabores y precios
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
            Tartas, aperitivos y regalos personalizados. Todos los precios provienen
            de nuestras cartas oficiales. Elige la carta que te corresponde:
          </p>
          <div className="mt-8">
            <CustomerTypeSwitch mode={mode} onChange={setMode} />
          </div>
        </div>
      </header>

      <div key={mode} className="container animate-fade-in pb-4 pt-8">
        {mode === "individual" ? <IndividualMenu /> : <BusinessMenu />}
      </div>

      {/* Condiciones */}
      <div className="container py-10">
        <Card className="border-warning/30 bg-blush/30">
          <CardHeader>
            <CardTitle className="text-lg">Bueno saberlo</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90">
              <li>
                Pedidos con una antelación mínima de {MIN_ORDER_LEAD_TIME_HOURS / 24}{" "}
                días.
              </li>
              <li>
                Si el pedido supera {formatEuros(DEPOSIT_THRESHOLD_CENTS)}, se abona
                una señal del {DEPOSIT_PERCENTAGE}% por Bizum, transferencia o en
                tienda. Sin pago online.
              </li>
              <li>
                Recogida gratis en tienda; entrega a domicilio según zona (ver
                condiciones al hacer el pedido).
              </li>
              {snackMinQuantity !== null && (
                <li>
                  Los aperitivos salados se piden desde {snackMinQuantity} unidades
                  por variedad, y el precio por unidad baja al aumentar la cantidad.
                </li>
              )}
              <li>
                Las tartas personalizadas y de fondant, las cajas de desayuno y las
                copas no tienen precio en carta: se presupuestan a medida y se
                confirman por WhatsApp.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* CTA final */}
      <section className="container py-12">
        <Reveal>
          <div className="vintage-frame bg-card px-6 py-10 text-center sm:px-10">
            <p className="font-script text-3xl text-accent">
              Grandes momentos, grandes sabores
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-primary sm:text-3xl">
              ¿Ya sabes cuál es tu favorito?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
              Configura tu pedido con tus sabores y personalización, y confírmalo por
              WhatsApp.
            </p>
            <Button asChild size="xl" className="mt-6">
              <Link to="/pedido">Hacer pedido</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
