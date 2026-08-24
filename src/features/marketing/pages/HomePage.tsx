import { Link } from "react-router-dom";
import {
  Building2,
  CakeSlice,
  CalendarClock,
  Heart,
  MessageCircle,
  PartyPopper,
  Recycle,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/domain/money";
import {
  CAKE_FILLINGS,
  CATEGORY_FAMILY,
  CHEESECAKE_FLAVORS,
  FAMILY_LABELS,
  SPONGE_FLAVORS,
  getProductsFor,
  type FamilyId,
} from "@/domain/catalog";
import {
  DELIVERY_ZONES,
  DEPOSIT_PERCENTAGE,
  DEPOSIT_THRESHOLD_CENTS,
  MIN_ORDER_LEAD_TIME_HOURS,
  PHONE_CALLS,
  PHONE_CALLS_DISPLAY,
  TOPPING_PRICE_CENTS,
} from "@/config/business";
import { CakeReferences } from "@/features/order/components/CakeReferences";
import {
  CLASSIC_CAKE_PHOTOS,
  GLASS_PHOTOS,
  SAVOURY_HERO_PHOTOS,
  type Photo,
} from "@/assets/photos";
import {
  getMinPriceCents,
  getScheduleRows,
  getSnackMinQuantity,
} from "../lib/catalogView";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import logo from "@/assets/logo-dulce-flor.jpeg";

/** Pedido mínimo de aperitivos: sale de los tramos del catálogo, no a mano. */
const SNACK_MIN_QUANTITY = getSnackMinQuantity("individual");

/** Precio más bajo de la tarta clásica, para el «desde» de la home. */
const CLASSIC_CAKE_FROM_CENTS = getMinPriceCents("pastel-clasico", "individual");

interface FamilyCard {
  id: FamilyId;
  photo: Photo;
  description: string;
  badge: string | null;
  badgeVariant: "accent" | "secondary" | "outline";
  cta: string;
}

/*
 * «¿Qué estás buscando?»: una tarjeta por familia de producto, con foto real y
 * un único CTA al configurador. El detalle de cada familia vive en la carta y
 * en el propio pedido, no en la home.
 * Datos derivados del catálogo — sin precios ni cifras escritos a mano.
 */
const FAMILY_CARDS: FamilyCard[] = [
  {
    id: "tartas",
    // Foto distinta de las 4 que muestra la galería de abajo, para no repetir.
    photo: CLASSIC_CAKE_PHOTOS[4],
    description:
      "Configúrala y conoce el precio al momento, o pídenos un diseño a medida.",
    badge:
      CLASSIC_CAKE_FROM_CENTS === null
        ? null
        : `desde ${formatEuros(CLASSIC_CAKE_FROM_CENTS)}`,
    badgeVariant: "accent",
    cta: "Configurar mi tarta",
  },
  {
    id: "aperitivos",
    photo: SAVOURY_HERO_PHOTOS[0],
    description:
      "Mini sándwiches, mini panes y bocaditos salados para eventos, con precio por cantidad.",
    badge: SNACK_MIN_QUANTITY === null ? null : `desde ${SNACK_MIN_QUANTITY} uds`,
    badgeVariant: "outline",
    cta: "Elegir aperitivos",
  },
  {
    id: "regalos",
    photo: GLASS_PHOTOS[0],
    description: "Cajas de desayuno y copas personalizadas con dedicatoria.",
    badge: "A consultar",
    badgeVariant: "secondary",
    cta: "Pedir presupuesto",
  },
];

const CATALOG_STATS = [
  { value: CHEESECAKE_FLAVORS.length, label: "sabores de cheesecake" },
  { value: SPONGE_FLAVORS.length, label: "bizcochos a elegir" },
  { value: CAKE_FILLINGS.length, label: "rellenos incluidos" },
] as const;

const STEPS = [
  {
    icon: CakeSlice,
    title: "Elige tu antojo",
    text: "Tartas, aperitivos salados o un regalo personalizado, para particulares y empresas.",
  },
  {
    icon: Sparkles,
    title: "Personalízalo",
    text: `Bizcocho, relleno incluido y los toppings que quieras (+${formatEuros(
      TOPPING_PRICE_CENTS
    )} cada uno). Las decoraciones especiales se presupuestan aparte.`,
  },
  {
    icon: CalendarClock,
    title: "Elige fecha y entrega",
    text: `Recogida en tienda o entrega a domicilio, con una antelación mínima de ${MIN_ORDER_LEAD_TIME_HOURS / 24} días.`,
  },
  {
    icon: MessageCircle,
    title: "Confírmalo por WhatsApp",
    text: `Te preparamos el resumen listo para enviar. Si el pedido supera ${formatEuros(
      DEPOSIT_THRESHOLD_CENTS
    )}, se abona una señal del ${DEPOSIT_PERCENTAGE}% por Bizum, transferencia o en tienda (sin pago online).`,
  },
] as const;

function deliveryFeeLabel(feeCents: number | null): string {
  if (feeCents === null) return "Envío según distancia";
  if (feeCents === 0) return "Gratis";
  return formatEuros(feeCents);
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-background-soft/70 to-background">
      {/* Detalles ornamentales sutiles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-secondary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-accent/15 blur-3xl"
      />
      <Heart
        aria-hidden="true"
        className="absolute left-[10%] top-24 h-6 w-6 -rotate-12 text-secondary/50"
        fill="currentColor"
      />
      <Heart
        aria-hidden="true"
        className="absolute right-[12%] top-40 h-4 w-4 rotate-12 text-accent/40"
        fill="currentColor"
      />
      <Heart
        aria-hidden="true"
        className="absolute bottom-14 left-[16%] hidden h-4 w-4 rotate-6 text-secondary/40 sm:block"
        fill="currentColor"
      />

      <div className="container relative flex flex-col items-center gap-6 py-16 text-center sm:py-24">
        <div className="animate-scale-in rounded-full bg-card p-2 shadow-lifted ring-1 ring-secondary/40">
          <img
            src={logo}
            alt="Logotipo de Dulce Flor Repostería Casera"
            width={160}
            height={160}
            className="h-32 w-32 rounded-full object-cover sm:h-40 sm:w-40"
          />
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <p className="eyebrow">Repostería Casera</p>
          <h1 className="mx-auto mt-2 max-w-2xl font-display text-4xl font-bold leading-tight text-primary sm:text-5xl">
            Hechos con pasión para endulzar tus mejores momentos
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Tartas de celebración, aperitivos para eventos y regalos
            personalizados en Santa Coloma de Gramenet. Hechos con amor para
            compartir momentos inolvidables.
          </p>
        </div>

        <div
          className="flex w-full max-w-md animate-fade-in-up flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center"
          style={{ animationDelay: "240ms" }}
        >
          <Button asChild size="xl" className="w-full sm:w-auto">
            <Link to="/pedido">Hacer pedido</Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
            <Link to="/carta">Ver la carta</Link>
          </Button>
        </div>

        <div
          className="ornament-divider mt-2 animate-fade-in"
          style={{ animationDelay: "360ms" }}
          aria-hidden="true"
        >
          <Heart className="h-4 w-4 fill-current" />
        </div>
      </div>
    </section>
  );
}

function ProductsSection() {
  return (
    <section className="container py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Sabores que enamoran"
          title="¿Qué estás buscando?"
          subtitle="Todo se prepara por encargo, con receta casera y mucho amor. Elige por dónde empezar."
        />
      </Reveal>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {FAMILY_CARDS.map((family, index) => (
          <Reveal key={family.id} delay={index * 0.08} className="h-full">
            <Link
              to="/pedido"
              className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`${FAMILY_LABELS[family.id]}: ${family.cta}`}
            >
              <Card className="flex h-full flex-col overflow-hidden transition-shadow duration-200 group-hover:shadow-lifted">
                <img
                  src={family.photo.src}
                  alt={family.photo.alt}
                  loading="lazy"
                  width={1200}
                  height={900}
                  className="aspect-[4/3] w-full object-cover"
                />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-xl leading-snug">
                      {FAMILY_LABELS[family.id]}
                    </CardTitle>
                    {family.badge && (
                      <Badge variant={family.badgeVariant} className="shrink-0">
                        {family.badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{family.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <p className="text-sm font-semibold text-primary underline-offset-4 group-hover:underline">
                    {family.cta} →
                  </p>
                </CardContent>
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>

      {/*
        Galería de tartas reales del obrador. No se convierte en una galería
        general «Nuestros trabajos»: las tarjetas de familia de arriba ya enseñan
        una foto real de cada línea (y son las mismas de FEATURED_WORK_PHOTOS),
        así que repetirlas alargaría la home sin aportar nada. Esta galería sigue
        cumpliendo una función concreta: enseñar qué acabado incluye el precio
        cerrado de la tarta clásica, el mismo mensaje que ve en el configurador.
      */}
      <Reveal className="mt-10">
        <CakeReferences
          photos={CLASSIC_CAKE_PHOTOS}
          title="Así son nuestras tartas"
          limit={4}
          description={
            <>
              Fotografías reales de tartas hechas en nuestro obrador, sin retoques ni
              imágenes de catálogo. Este acabado clásico —cobertura, cenefa de manga,
              drip y los toppings que elijas— es el que tiene precio cerrado en la web.
            </>
          }
        />
      </Reveal>

      <Reveal className="mt-10">
        <div className="vintage-frame bg-card px-6 py-6">
          <dl className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
            {CATALOG_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <dt className="order-2 text-sm text-muted-foreground">{stat.label}</dt>
                <dd className="order-1 font-display text-3xl font-bold text-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="bg-background-soft/50 py-16 sm:py-20">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Así de fácil"
            title="Tu pedido, a tu manera"
            subtitle="Configura tu pedido en unos minutos y confírmalo por WhatsApp."
          />
        </Reveal>

        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="h-full">
              <Reveal delay={index * 0.08} className="h-full">
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="font-script text-2xl text-accent" aria-hidden="true">
                        {index + 1}
                      </span>
                    </div>
                    <CardTitle className="pt-1 text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.text}</p>
                  </CardContent>
                </Card>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AudiencesSection() {
  /*
   * La carta de empresa incluye ahora 11 aperitivos salados: listarlos uno a uno
   * daría un párrafo interminable. Se nombran las tartas y especialidades y los
   * aperitivos se resumen con su número, todo derivado del catálogo.
   */
  const businessProducts = getProductsFor("business");
  const businessCakeNames = businessProducts
    .filter((product) => CATEGORY_FAMILY[product.category] === "tartas")
    .map((product) => product.name)
    .join(" · ");
  const businessSnackCount = businessProducts.filter(
    (product) => CATEGORY_FAMILY[product.category] === "aperitivos"
  ).length;

  return (
    <section className="container py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Para cada ocasión"
          title="Particulares y empresas"
          subtitle="Dos cartas pensadas para momentos distintos, con el mismo sabor casero."
        />
      </Reveal>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Reveal className="h-full">
          <Card className="flex h-full flex-col border-secondary/50">
            <CardHeader>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/25 text-primary">
                <PartyPopper className="h-6 w-6" aria-hidden="true" />
              </span>
              <CardTitle className="pt-2 text-xl">Para particulares</CardTitle>
              <CardDescription>
                Tartas para cumpleaños, aniversarios y toda clase de celebraciones:
                elige tamaño, bizcocho, relleno, toppings y dedicatoria, y recógela o
                recíbela el día señalado. También preparamos aperitivos salados para
                tus eventos y regalos personalizados.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-secondary/20 px-3.5 py-3">
                <Sparkles
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Dos formas de encargarla
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    La tarta clásica (con o sin buttercream) tiene precio al momento en
                    la web. La tarta personalizada y la de fondant se presupuestan a
                    medida: cuéntanos tu idea, adjunta una foto de referencia y te
                    confirmamos el precio por WhatsApp.
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/pedido">Hacer pedido</Link>
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.08} className="h-full">
          <Card className="flex h-full flex-col border-accent/40">
            <CardHeader>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <CardTitle className="pt-2 text-xl">Para empresas</CardTitle>
              <CardDescription>
                Precios pensados para empresas y restaurantes, con cartas específicas:{" "}
                {businessCakeNames}.
                {businessSnackCount > 0 && (
                  <>
                    {" "}
                    Y {businessSnackCount} aperitivos salados con precio por
                    cantidad para tus eventos.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-accent/10 px-3.5 py-3">
                <Recycle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Fuentes reutilizables
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Podemos preparar los productos en fuentes de cristal reutilizables:
                    en el siguiente pedido recogemos la fuente anterior y la sustituimos
                    por la nueva.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link to="/pedido">Hacer pedido</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link to="/carta">Ver precios de empresa</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="sobre" className="scroll-mt-24 bg-background-soft/50 py-16 sm:py-20">
      <div className="container max-w-3xl text-center">
        <Reveal>
          <div className="mx-auto w-fit rounded-full bg-card p-1.5 shadow-soft ring-1 ring-secondary/40">
            <img
              src={logo}
              alt=""
              loading="lazy"
              width={112}
              height={112}
              className="h-28 w-28 rounded-full object-cover"
            />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="eyebrow mt-6">Sobre Dulce Flor</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-primary sm:text-4xl">
            Receta casera con mucho amor
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Dulce Flor es un obrador de repostería casera en Santa Coloma de Gramenet.
            Preparamos cada tarta, cada bandeja de aperitivos y cada regalo por
            encargo, con sabor casero que encanta y el cariño de lo hecho a mano.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Grandes momentos, grandes sabores: cuéntanos qué celebras y lo endulzamos
            contigo.
          </p>
          <p className="mt-6 font-script text-3xl text-accent">
            Hechos con amor para compartir momentos inolvidables
          </p>
          <div className="mt-6">
            <Button asChild variant="outline" size="lg">
              <Link to="/carta">Descubrir la carta</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DeliverySection() {
  const scheduleRows = getScheduleRows();

  return (
    <section className="container py-16 sm:py-20">
      <Reveal>
        <SectionHeading
          eyebrow="Cuando lo necesites"
          title="Recogida y entrega"
          subtitle="Recoge tu pedido gratis en tienda o recíbelo en casa según tu zona."
        />
      </Reveal>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Reveal className="h-full">
          <Card className="h-full">
            <CardHeader>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success">
                <Store className="h-5 w-5" aria-hidden="true" />
              </span>
              <CardTitle className="pt-1 text-lg">Recogida en tienda</CardTitle>
              <CardDescription>
                Gratis, en nuestro obrador de Santa Coloma de Gramenet, en el horario
                que elijas al hacer el pedido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="success">Sin coste</Badge>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.08} className="h-full">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <CardTitle className="pt-1 text-lg">Entrega a domicilio</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {DELIVERY_ZONES.map((zone) => (
                  <li
                    key={zone.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="text-foreground/90">{zone.label}</span>
                    <span className="shrink-0 font-medium text-primary">
                      {deliveryFeeLabel(zone.feeCents)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-foreground/90">Fuera de estas zonas</span>
                  <span className="shrink-0 font-medium text-primary">
                    Envío según distancia
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.16} className="h-full md:col-span-2 lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <CardTitle className="pt-1 text-lg">Horario</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {scheduleRows.map((row) => (
                  <li
                    key={row.dayLabel}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="text-foreground/90">{row.dayLabel}</span>
                    <span
                      className={
                        row.closed
                          ? "text-muted-foreground"
                          : "font-medium text-primary"
                      }
                    >
                      {row.hoursLabel}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Pedidos con una antelación mínima de {MIN_ORDER_LEAD_TIME_HOURS / 24}{" "}
                días.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="bg-cocoa py-16 text-cocoa-foreground sm:py-20">
      <Reveal className="container text-center">
        <p className="font-script text-3xl text-secondary sm:text-4xl">
          Sabores que enamoran
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          ¿Preparamos tu próxima celebración?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-cocoa-foreground/70">
          Configura tu pedido en unos minutos y confírmalo por WhatsApp. Hechos con
          amor para compartir momentos inolvidables.
        </p>
        <Button asChild size="xl" variant="accent" className="mt-8">
          <Link to="/pedido">Hacer pedido</Link>
        </Button>
        {/* Alternativa para quien prefiere hablar: es otro número, distinto
            del de WhatsApp, y lo atiende otra persona del negocio. */}
        <p className="mt-5 text-sm text-cocoa-foreground/70">
          ¿Prefieres llamar? Marca el{" "}
          <a
            href={`tel:+${PHONE_CALLS}`}
            className="font-medium text-secondary underline underline-offset-4"
          >
            {PHONE_CALLS_DISPLAY}
          </a>
          .
        </p>
      </Reveal>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProductsSection />
      <HowItWorksSection />
      <AudiencesSection />
      <AboutSection />
      <DeliverySection />
      <FinalCtaSection />
    </>
  );
}
