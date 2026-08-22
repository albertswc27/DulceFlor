/**
 * FOTOGRAFÍAS REALES DE DULCE FLOR — única fuente de imágenes de producto.
 *
 * Todas proceden del propio obrador (facilitadas por el cliente) y están
 * clasificadas tras una AUDITORÍA VISUAL imagen por imagen: la categoría no
 * se deduce del nombre del archivo. Ver docs/assets-inventory.md.
 *
 * Organización en disco: src/assets/fotos/<categoria>/<nombre>.webp
 */

/* ---------------------------- Tartas ---------------------------- */
import tartaChocolateTrufa from "./fotos/tartas/tarta-clasica-chocolate-trufa-drip.webp";
import tartaNataDrip from "./fotos/tartas/tarta-clasica-nata-drip-chocolate.webp";
import tartaLotus from "./fotos/tartas/tarta-clasica-lotus-buttercream.webp";
import tartaCremaCafe from "./fotos/tartas/tarta-clasica-chocolate-crema-cafe.webp";
import tartaChocolateDedicatoria from "./fotos/tartas/tarta-clasica-chocolate-dedicatoria.webp";
import tartaMerengue from "./fotos/tartas/tarta-clasica-merengue-dedicatoria.webp";
import tartaDulceLeche from "./fotos/tartas/tarta-clasica-chocolate-dulce-de-leche.webp";
import tartaVintage from "./fotos/tartas/tarta-decoracion-vintage-turquesa.webp";

/* ---------------------- Aperitivos salados ---------------------- */
import surtidoSalados from "./fotos/aperitivos-salados/surtido-bocaditos-salados.webp";
import bandejaCatering from "./fotos/aperitivos-salados/bandeja-catering-mini-sandwiches-tequenos.webp";
import miniSandwichCerdo from "./fotos/aperitivos-salados/mini-sandwich-cerdo-caramelizado.webp";
import miniSandwichRoyal from "./fotos/aperitivos-salados/mini-sandwich-royal-pollo.webp";
import miniSandwichJamonTomateQueso from "./fotos/aperitivos-salados/mini-sandwich-jamon-tomate-queso.webp";
import miniSandwichHuevo from "./fotos/aperitivos-salados/mini-sandwich-huevo.webp";
import miniPanBacon from "./fotos/aperitivos-salados/mini-pan-bacon-espinaca.webp";
import miniPanPolloMelocoton from "./fotos/aperitivos-salados/mini-pan-pollo-melocoton.webp";
import miniPanJamonQueso from "./fotos/aperitivos-salados/mini-pan-jamon-dulce-queso.webp";
import miniPanSerrano from "./fotos/aperitivos-salados/mini-pan-jamon-serrano.webp";
import miniPanPolloMayonesa from "./fotos/aperitivos-salados/mini-pan-pollo-mayonesa.webp";
import miniPanFuet from "./fotos/aperitivos-salados/mini-pan-fuet.webp";
import miniPanCerdoBoniato from "./fotos/aperitivos-salados/mini-pan-cerdo-boniato.webp";
import miniPanCerdoCaramelizado from "./fotos/aperitivos-salados/mini-pan-cerdo-caramelizado.webp";
import miniSandwichTocino from "./fotos/aperitivos-salados/mini-sandwich-tocino-crujiente.webp";
import miniSandwichPolloMelocoton from "./fotos/aperitivos-salados/mini-sandwich-melocoton-pollo-jamon.webp";
import miniEmpanadasAtun from "./fotos/aperitivos-salados/mini-empanadas-atun.webp";
import miniEmpanadasCarne from "./fotos/aperitivos-salados/mini-empanadas-carne.webp";
import miniEmpanadasPollo from "./fotos/aperitivos-salados/mini-empanadas-pollo.webp";
import miniHamburguesaPollo from "./fotos/aperitivos-salados/mini-hamburguesa-pollo.webp";
import miniHamburguesaVacuno from "./fotos/aperitivos-salados/mini-hamburguesa-vacuno.webp";
import miniTequenosJamonQueso from "./fotos/aperitivos-salados/mini-tequenos-jamon-queso.webp";
import miniTequenosQueso from "./fotos/aperitivos-salados/mini-tequenos-queso.webp";

/* ----------------------- Aperitivos dulces ---------------------- */
import vasitosVitrina from "./fotos/aperitivos-dulces/vasitos-cheesecake-y-nata-vitrina.webp";
import cupcakesTopper from "./fotos/aperitivos-dulces/cupcakes-personalizados-topper.webp";

/* ------------------------- Desayunos ---------------------------- */
import cajaDesayunoBatidos from "./fotos/desayunos/caja-desayuno-batidos-bolleria.webp";
import cajaDesayunoCafes from "./fotos/desayunos/caja-desayuno-cafes-helados.webp";

/* --------------------------- Copas ------------------------------ */
import copasSetCuatro from "./fotos/copas/copas-personalizadas-set-cuatro-cajas.webp";
import copaMousseRosa from "./fotos/copas/copa-personalizada-mousse-rosa-caja.webp";
import copaCorazon from "./fotos/copas/copa-personalizada-corazon-fondant.webp";
import copaNataFresa from "./fotos/copas/copa-postre-nata-fresa-caja-regalo.webp";
import copasFresaChocolate from "./fotos/copas/copas-postre-fresa-y-chocolate-vertical.webp";
import copaCumpleanos from "./fotos/copas/copa-postre-cumpleanos-brownie.webp";

export interface Photo {
  src: string;
  /** Texto alternativo descriptivo (accesibilidad y SEO). */
  alt: string;
  /** Pie de foto breve. */
  caption: string;
}

/* ------------------------------------------------------------------ */
/* Tartas                                                              */
/* ------------------------------------------------------------------ */

/** Acabado clásico: lo que incluye el precio automático del configurador. */
export const CLASSIC_CAKE_PHOTOS: Photo[] = [
  {
    src: tartaChocolateTrufa,
    alt: "Tarta clásica de chocolate con cobertura de trufa, cenefa de manga y drip de chocolate",
    caption: "Chocolate con trufa y drip",
  },
  {
    src: tartaNataDrip,
    alt: "Tarta clásica cubierta de nata montada con drip de chocolate y corona de picos de manga",
    caption: "Nata con drip de chocolate",
  },
  {
    src: tartaLotus,
    alt: "Tarta clásica con crema de Lotus, cenefa de manga y galletas Lotus por encima",
    caption: "Crema de Lotus con galletas",
  },
  {
    src: tartaCremaCafe,
    alt: "Tarta clásica de chocolate con rosetones de crema de café y pepitas de chocolate",
    caption: "Crema de café y pepitas",
  },
  {
    src: tartaChocolateDedicatoria,
    alt: "Tarta clásica de chocolate con drip y dedicatoria de cumpleaños escrita sobre la tarta",
    caption: "Con dedicatoria escrita",
  },
  {
    src: tartaMerengue,
    alt: "Tarta clásica con merengue tostado a soplete y dedicatoria escrita con chocolate",
    caption: "Merengue tostado con dedicatoria",
  },
  {
    src: tartaDulceLeche,
    alt: "Tarta clásica de chocolate con ganache, cenefa de dulce de leche y fideos de chocolate",
    caption: "Chocolate con dulce de leche",
  },
];

/**
 * Decoración elaborada fuera del acabado clásico (se presupuesta a medida).
 * PENDIENTE: Dulce Flor no ha facilitado todavía ejemplos de fondant,
 * figuras modeladas ni tartas temáticas.
 */
export const CUSTOM_CAKE_PHOTOS: Photo[] = [
  {
    src: tartaVintage,
    alt: "Tarta con decoración vintage a manga en turquesa, con guirnaldas, lazos y perlas plateadas",
    caption: "Decoración vintage a medida",
  },
];

/* ------------------------------------------------------------------ */
/* Aperitivos                                                          */
/* ------------------------------------------------------------------ */

/** Foto de cada aperitivo salado con tarifa confirmada, por id de producto. */
export const SAVOURY_PRODUCT_PHOTOS: Record<string, Photo> = {
  "mini-sandwich-cerdo-caramelizado": {
    src: miniSandwichCerdo,
    alt: "Mini sándwich de pan de molde sin corteza relleno de cerdo caramelizado con tomate y lechuga",
    caption: "Mini sándwich de cerdo caramelizado",
  },
  "mini-sandwich-royal-pollo": {
    src: miniSandwichRoyal,
    alt: "Mini sándwich Royal de pollo en pan de molde sin corteza",
    caption: "Mini sándwich Royal de pollo",
  },
  "mini-sandwich-jamon-tomate-queso": {
    src: miniSandwichJamonTomateQueso,
    alt: "Mini sándwich de jamón dulce con tomate y queso en pan de molde sin corteza",
    caption: "Mini sándwich de jamón, tomate y queso",
  },
  "mini-sandwich-huevo": {
    src: miniSandwichHuevo,
    alt: "Mini sándwich de huevo en pan de molde sin corteza",
    caption: "Mini sándwich de huevo",
  },
  "mini-pan-bacon-espinaca": {
    src: miniPanBacon,
    alt: "Mini pan relleno de espinacas a la crema con bacon crujiente",
    caption: "Mini pan de bacon con espinaca",
  },
  "mini-pan-pollo-melocoton": {
    src: miniPanPolloMelocoton,
    alt: "Mini pan mixto relleno de pollo con melocotón",
    caption: "Mini pan mixto de pollo y melocotón",
  },
  "mini-pan-jamon-queso": {
    src: miniPanJamonQueso,
    alt: "Mini pan relleno de jamón dulce y queso",
    caption: "Mini pan de jamón dulce y queso",
  },
  "mini-pan-jamon-serrano": {
    src: miniPanSerrano,
    alt: "Mini pan relleno de jamón serrano con tomate",
    caption: "Mini pan de jamón serrano",
  },
  "mini-pan-pollo-mayonesa": {
    src: miniPanPolloMayonesa,
    alt: "Mini pan relleno de pollo con mayonesa de la casa",
    caption: "Mini pan de pollo con mayonesa",
  },
  "mini-pan-fuet": {
    // La foto muestra embutido curado en lonchas anchas con rúcula y tomate:
    // el alt describe lo que se ve, sin prometer un montaje distinto.
    src: miniPanFuet,
    alt: "Mini pan relleno de embutido curado en lonchas, con rúcula y tomate",
    caption: "Mini pan de fuet",
  },
  "mini-pan-cerdo-boniato": {
    src: miniPanCerdoBoniato,
    alt: "Mini panes rellenos de cerdo con boniato, cebolla morada y lechuga",
    caption: "Mini pan de cerdo y boniato",
  },
  "mini-pan-cerdo-caramelizado": {
    src: miniPanCerdoCaramelizado,
    alt: "Mini pan relleno de cerdo caramelizado con lechuga",
    caption: "Mini pan de cerdo caramelizado",
  },
  "mini-sandwich-tocino-crujiente": {
    src: miniSandwichTocino,
    alt: "Mini sándwich de pan de molde con tocino crujiente, queso en lonchas y tomate",
    caption: "Mini sándwich de tocino crujiente",
  },
  "mini-sandwich-pollo-melocoton-jamon": {
    src: miniSandwichPolloMelocoton,
    alt: "Mini sándwich de pan de molde con pollo, melocotón y jamón dulce",
    caption: "Mini sándwich de pollo, melocotón y jamón",
  },
  "mini-tequenos-jamon-queso": {
    src: miniTequenosJamonQueso,
    alt: "Mini tequeños crujientes rellenos de jamón y queso fundido",
    caption: "Mini tequeños de jamón y queso",
  },
  "mini-tequenos-queso": {
    src: miniTequenosQueso,
    alt: "Mini tequeños crujientes rellenos de queso fundido",
    caption: "Mini tequeños de queso",
  },
  "mini-empanadas-carne": {
    src: miniEmpanadasCarne,
    alt: "Mini empanadas de carne picada recién horneadas",
    caption: "Mini empanadas de carne",
  },
  "mini-empanadas-pollo": {
    src: miniEmpanadasPollo,
    alt: "Mini empanadas de pollo desmenuzado recién horneadas",
    caption: "Mini empanadas de pollo",
  },
  "mini-empanadas-atun": {
    src: miniEmpanadasAtun,
    alt: "Mini empanadas de atún recién horneadas",
    caption: "Mini empanadas de atún",
  },
  "mini-hamburguesa-vacuno": {
    src: miniHamburguesaVacuno,
    alt: "Mini hamburguesa de ternera con lechuga y tomate en pan de bollo",
    caption: "Mini hamburguesa de vacuno",
  },
  "mini-hamburguesa-pollo": {
    src: miniHamburguesaPollo,
    alt: "Mini hamburguesa de pollo a la plancha con lechuga y tomate en pan de bollo",
    caption: "Mini hamburguesa de pollo",
  },
};

/** Fotos de conjunto para presentar la categoría de aperitivos. */
export const SAVOURY_HERO_PHOTOS: Photo[] = [
  {
    src: surtidoSalados,
    alt: "Surtido de bocaditos salados de Dulce Flor: mini sándwiches, mini panes y rollitos",
    caption: "Surtido de bocaditos salados",
  },
  {
    src: bandejaCatering,
    alt: "Caja de catering de Dulce Flor con mini sándwiches y tequeños para eventos",
    caption: "Bandeja para eventos",
  },
];

/**
 * Aperitivos salados sin tarifa confirmada. Desde el 22/08/2026 la lista está
 * VACÍA: Dulce Flor ha facilitado el precio de todos los salados
 * fotografiados. Se mantiene el punto de extensión por si aparecen productos
 * nuevos antes que sus tarifas; la interfaz oculta el bloque si está vacía.
 */
export const OTHER_SAVOURY_PHOTOS: Photo[] = [];

/**
 * Aperitivos dulces: hay fotografías reales, pero el catálogo y las tarifas
 * están PENDIENTES de confirmación por Dulce Flor.
 */
export const SWEET_SNACK_PHOTOS: Photo[] = [
  {
    src: vasitosVitrina,
    alt: "Vasitos individuales de cheesecake con fresa y de nata con mermelada en la vitrina del obrador",
    caption: "Vasitos individuales",
  },
  {
    src: cupcakesTopper,
    alt: "Cupcakes personalizados con buttercream, sprinkles de colores y topper impreso a medida",
    caption: "Cupcakes personalizados",
  },
];

/* ------------------------------------------------------------------ */
/* Desayunos y regalos                                                 */
/* ------------------------------------------------------------------ */

export const BREAKFAST_PHOTOS: Photo[] = [
  {
    src: cajaDesayunoBatidos,
    alt: "Caja de desayuno de regalo con batidos, bollería y detalles, envuelta para regalar",
    caption: "Caja de desayuno para regalar",
  },
  {
    src: cajaDesayunoCafes,
    alt: "Caja de desayuno de regalo con cafés helados y dulces, presentada como regalo",
    caption: "Con cafés helados",
  },
];

export const GLASS_PHOTOS: Photo[] = [
  {
    src: copasSetCuatro,
    alt: "Set de cuatro copas de postre personalizadas presentadas en cajas de regalo con lazo",
    caption: "Copas personalizadas para regalar",
  },
  {
    src: copaMousseRosa,
    alt: "Copa de postre personalizada con mousse rosa, topper dorado y flores de azúcar, en caja de regalo",
    caption: "Con topper y flores de azúcar",
  },
  {
    src: copaCorazon,
    alt: "Copa de postre personalizada decorada con un corazón de fondant y una mariposa",
    caption: "Decoración a medida",
  },
  {
    src: copaCumpleanos,
    alt: "Copa de postre de cumpleaños con bizcocho de chocolate y decoración personalizada",
    caption: "Para cumpleaños",
  },
  {
    src: copaNataFresa,
    alt: "Copa de postre de nata y fresa presentada en caja de regalo con lazo",
    caption: "Postre en copa, listo para regalar",
  },
  {
    src: copasFresaChocolate,
    alt: "Dos copas de postre, una de nata con fresa y otra de chocolate con pepitas",
    caption: "Fresa y chocolate",
  },
];

/** Selección para la sección «Nuestros trabajos» de la home. */
export const FEATURED_WORK_PHOTOS: Photo[] = [
  CLASSIC_CAKE_PHOTOS[0],
  SAVOURY_HERO_PHOTOS[0],
  GLASS_PHOTOS[0],
  BREAKFAST_PHOTOS[0],
];

/**
 * Foto representativa de un producto para las tarjetas del catálogo.
 * Devuelve null cuando NO tenemos una fotografía real de ese producto
 * (cheesecakes, tres leches y especialidades): en ese caso la interfaz
 * dibuja la ilustración de marca en lugar de enseñar una foto que no
 * corresponde. Nunca se reutiliza la foto de otro producto.
 */
export function getProductPhoto(productId: string): Photo | null {
  const savoury = SAVOURY_PRODUCT_PHOTOS[productId];
  if (savoury) return savoury;

  switch (productId) {
    case "pastel-clasico":
      return CLASSIC_CAKE_PHOTOS[0];
    case "pastel-buttercream":
      return CLASSIC_CAKE_PHOTOS[2];
    case "pastel-personalizado":
    case "pastel-fondant":
      return CUSTOM_CAKE_PHOTOS[0];
    case "caja-desayuno":
      return BREAKFAST_PHOTOS[0];
    case "copa-personalizada":
      return GLASS_PHOTOS[0];
    default:
      return null;
  }
}

/** Foto de portada de cada familia, para encabezar su listado. */
export const FAMILY_COVER_PHOTOS: Record<string, Photo> = {
  tartas: CLASSIC_CAKE_PHOTOS[1],
  aperitivos: SAVOURY_HERO_PHOTOS[0],
  regalos: GLASS_PHOTOS[0],
};
