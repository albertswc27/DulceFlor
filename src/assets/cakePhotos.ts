/**
 * Fotografías REALES de Dulce Flor (única fuente de referencias visuales).
 * Nada de imágenes de terceros ni generadas: solo fotos del propio obrador,
 * facilitadas por el cliente el 19/08/2026, e imágenes que adjunte la
 * persona que hace el pedido.
 *
 * Para añadir nuevas fotos: colócalas en src/assets/ con nombre descriptivo
 * en kebab-case (.webp) y añádelas a la lista correspondiente.
 */
import buttercreamLotus from "./tarta-clasica-buttercream-rosa-lotus.webp";
import chocolateDripDedicatoria from "./tarta-clasica-chocolate-drip-dedicatoria.webp";
import natacDripChocolate from "./tarta-clasica-nata-drip-chocolate.webp";
import merengueDedicatoria from "./tarta-clasica-merengue-tostado-dedicatoria.webp";
import chocolateTrufa from "./tarta-clasica-chocolate-trufa-drip.webp";
import chocolateCremaCafe from "./tarta-clasica-chocolate-crema-cafe.webp";
import chocolateDulceLeche from "./tarta-clasica-chocolate-dulce-de-leche.webp";
import personalizadaVintage from "./tarta-personalizada-decoracion-vintage.webp";

export interface CakePhoto {
  src: string;
  /** Texto alternativo descriptivo (accesibilidad y SEO). */
  alt: string;
  /** Pie de foto breve mostrado bajo la imagen. */
  caption: string;
}

/**
 * Acabado clásico de Dulce Flor: cobertura lisa, cenefas de manga, drip y
 * toppings. Es lo que incluye el precio automático del configurador.
 */
export const CLASSIC_CAKE_PHOTOS: CakePhoto[] = [
  {
    src: chocolateTrufa,
    alt: "Tarta clásica de chocolate con cobertura de trufa, cenefa de manga y drip de chocolate",
    caption: "Chocolate con trufa y drip",
  },
  {
    src: natacDripChocolate,
    alt: "Tarta clásica cubierta de nata montada con drip de chocolate y corona de picos de manga",
    caption: "Nata con drip de chocolate",
  },
  {
    src: buttercreamLotus,
    alt: "Tarta clásica con buttercream rosa, cenefa de manga y galletas Lotus como topping",
    caption: "Buttercream con topping de Lotus",
  },
  {
    src: chocolateCremaCafe,
    alt: "Tarta clásica de bizcocho de chocolate con crema de café, rosetones de manga y pepitas de chocolate",
    caption: "Crema de café y pepitas",
  },
  {
    src: chocolateDripDedicatoria,
    alt: "Tarta clásica de chocolate con drip, cenefa de manga y dedicatoria escrita sobre la tarta",
    caption: "Con dedicatoria escrita",
  },
  {
    src: merengueDedicatoria,
    alt: "Tarta clásica con merengue tostado a soplete y dedicatoria escrita con chocolate",
    caption: "Merengue tostado con dedicatoria",
  },
  {
    src: chocolateDulceLeche,
    alt: "Tarta clásica de chocolate con dulce de leche y fideos de chocolate",
    caption: "Chocolate con dulce de leche",
  },
];

/**
 * Ejemplos de decoración personalizada (fuera del acabado clásico): se
 * presupuestan a mano. Pendiente de recibir más ejemplos de Dulce Flor
 * (fondant, figuras modeladas, temáticas infantiles…).
 */
export const CUSTOM_CAKE_PHOTOS: CakePhoto[] = [
  {
    src: personalizadaVintage,
    alt: "Tarta con decoración vintage personalizada a manga en color turquesa con guirnaldas y perlas",
    caption: "Decoración vintage a medida",
  },
];
