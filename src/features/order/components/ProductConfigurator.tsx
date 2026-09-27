/**
 * Configurador de producto — reutilizado por el wizard público y el kiosk.
 * No calcula precios por su cuenta: todo pasa por src/domain/pricing.
 * Los productos "quote" (fondant) no muestran precio: solicitan presupuesto.
 */
import * as React from "react";
import { Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TOPPING_PRICE_CENTS } from "@/config/business";
import { formatEuros } from "@/domain/money";
import {
  getSizesFor,
  TOPPINGS,
  type CatalogOption,
  type CatalogProduct,
} from "@/domain/catalog";
import {
  resolveCandleSelection,
  computeUnitPriceBreakdown,
  getToppingPriceCents,
  type ItemSelection,
} from "@/domain/pricing";
import {
  customToppingSchema,
  dedicationSchema,
  designDescriptionSchema,
  freeTextSchema,
} from "@/domain/validation";
import type {
  CandleStyle,
  CustomerType,
  ItemCustomization,
} from "@/domain/types";
import {
  getImage,
  processImageDataUrl,
  saveImage,
  IMAGE_ERROR_MESSAGES,
} from "@/services/imageStore";
import type { CakeFinish } from "@/domain/aiPreview";
import {
  CHEESECAKE_PHOTOS,
  CUSTOM_CAKE_PHOTOS,
  FONDANT_CAKE_PHOTOS,
} from "@/assets/photos";
import { OptionCard } from "./OptionCard";
import { QuantityStepper } from "./QuantityStepper";
import { AnimatedPrice } from "./AnimatedPrice";
import { SizePicker } from "./SizePicker";
import { ReferenceImagePicker } from "./ReferenceImagePicker";
import { CakeReferences } from "./CakeReferences";
import { AiCakePreview } from "./AiCakePreview";
import { CandlePicker } from "./CandlePicker";
import { SnackConfigurator } from "./SnackConfigurator";
import { GiftRequestConfigurator } from "./GiftRequestConfigurator";

export interface ConfiguratorResult {
  selection: ItemSelection;
  customization: ItemCustomization;
  quantity: number;
}

/**
 * Estado de partida del configurador. Al editar un artículo que ya está en el
 * pedido se rellena con TODO lo que el cliente había elegido: volver atrás a
 * cambiar el sabor no puede costarle rehacer las velas, la dedicatoria ni la
 * imagen de referencia.
 */
export interface ConfiguratorInitial {
  sizeId?: string;
  flavorId?: string;
  fillingId?: string;
  toppingIds?: string[];
  extraIds?: string[];
  customToppingRequest?: string;
  dedicationText?: string;
  designDescription?: string;
  occasion?: string;
  notes?: string;
  quantity?: number;
  candleDigits?: string;
  candleStyle?: CandleStyle;
  sparklerQuantity?: number;
  referenceImageId?: string;
  referenceImageSource?: "cliente" | "ia";
  aiPrompt?: string;
}

/** Traduce un artículo del borrador al estado de partida del configurador. */
export function draftItemToInitial(item: {
  selection: ItemSelection;
  customization: ItemCustomization;
  quantity: number;
}): ConfiguratorInitial {
  const c = item.customization;
  return {
    sizeId: item.selection.sizeId,
    flavorId: item.selection.flavorId ?? c.flavor?.id,
    fillingId: item.selection.fillingId ?? c.filling?.id,
    toppingIds: c.toppings.map((t) => t.id),
    extraIds: c.extras.map((e) => e.id),
    customToppingRequest: c.customToppingRequest,
    dedicationText: c.dedicationText,
    designDescription: c.designDescription,
    occasion: c.occasion,
    notes: c.notes,
    quantity: item.quantity,
    candleDigits: c.candleDigits,
    candleStyle: c.candleStyle,
    sparklerQuantity: c.sparklerQuantity,
    referenceImageId: c.referenceImageId,
    referenceImageSource: c.referenceImageSource,
    aiPrompt: c.aiPrompt,
  };
}

interface ProductConfiguratorProps {
  product: CatalogProduct;
  customerType: CustomerType;
  onConfirm: (result: ConfiguratorResult) => void;
  confirmLabel?: string;
  /** Diseño más denso para pantallas de kiosk. */
  compact?: boolean;
  initial?: ConfiguratorInitial;
}

/**
 * Punto de entrada único del configurador (wizard público y kiosk).
 * Según el tipo de producto delega en el flujo correspondiente:
 * aperitivos por volumen, regalos a medida o tartas.
 */
export function ProductConfigurator(props: ProductConfiguratorProps) {
  if (props.product.quantityTiers) {
    return (
      <SnackConfigurator
        product={props.product}
        customerType={props.customerType}
        onConfirm={props.onConfirm}
        confirmLabel={props.confirmLabel}
        compact={props.compact}
        initial={props.initial}
      />
    );
  }
  if (props.product.giftType) {
    return (
      <GiftRequestConfigurator
        product={props.product}
        customerType={props.customerType}
        onConfirm={props.onConfirm}
        confirmLabel={props.confirmLabel}
        compact={props.compact}
        initial={props.initial}
      />
    );
  }
  return <CakeConfigurator {...props} />;
}

function CakeConfigurator({
  product,
  customerType,
  onConfirm,
  confirmLabel = "Añadir al pedido",
  compact = false,
  initial,
}: ProductConfiguratorProps) {
  const sizes = getSizesFor(product, customerType);
  const isQuote = product.pricingType === "quote";

  const [sizeId, setSizeId] = React.useState<string>(initial?.sizeId ?? "");
  const [flavorId, setFlavorId] = React.useState<string>(initial?.flavorId ?? "");
  const [fillingId, setFillingId] = React.useState<string>(initial?.fillingId ?? "");
  const [toppingIds, setToppingIds] = React.useState<string[]>(initial?.toppingIds ?? []);
  const [extraIds, setExtraIds] = React.useState<string[]>(initial?.extraIds ?? []);
  const [dedicationText, setDedicationText] = React.useState(initial?.dedicationText ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [quantity, setQuantity] = React.useState(initial?.quantity ?? 1);
  const [customToppingOpen, setCustomToppingOpen] = React.useState(
    Boolean(initial?.customToppingRequest)
  );
  const [customToppingText, setCustomToppingText] = React.useState(
    initial?.customToppingRequest ?? ""
  );
  const [designDescription, setDesignDescription] = React.useState(
    initial?.designDescription ?? ""
  );
  const [referenceImage, setReferenceImage] = React.useState<string | null>(() =>
    initial?.referenceImageId ? getImage(initial.referenceImageId) : null
  );
  /**
   * Id de la imagen que YA estaba guardada al abrir el configurador. Mientras
   * el cliente no cambie la foto se reutiliza tal cual: volver a guardarla
   * crearía una copia y dejaría la anterior huérfana en el almacén.
   */
  const [savedImageId, setSavedImageId] = React.useState<string | null>(
    initial?.referenceImageId ?? null
  );
  /**
   * De dónde salió la imagen. No es un detalle: una imagen generada por una
   * máquina tiene que identificarse como tal donde se enseñe, y el obrador
   * necesita saber si mira la foto de una tarta que existe o una idea.
   */
  const [imageSource, setImageSource] = React.useState<"cliente" | "ia">(
    initial?.referenceImageSource ?? "cliente"
  );
  const [aiPrompt, setAiPrompt] = React.useState(initial?.aiPrompt ?? "");
  // Las velas son de números: se guarda la cifra, y la cantidad de velas es
  // simplemente cuántos dígitos tiene. El acabado (vela o bengala) cambia el
  // precio por unidad, y las bengalas sueltas van aparte.
  const [candleDigits, setCandleDigits] = React.useState(initial?.candleDigits ?? "");
  const [candleStyle, setCandleStyle] = React.useState<CandleStyle>(
    initial?.candleStyle ?? "vela"
  );
  const [sparklerQuantity, setSparklerQuantity] = React.useState(
    initial?.sparklerQuantity ?? 0
  );
  const [error, setError] = React.useState<string | null>(null);

  // Al cambiar de producto se reinicia la selección. Con `initial` (edición de
  // un artículo ya añadido) se restaura TODO lo que el cliente había elegido,
  // no solo las primeras opciones.
  React.useEffect(() => {
    setSizeId(initial?.sizeId ?? "");
    setFlavorId(initial?.flavorId ?? "");
    setFillingId(initial?.fillingId ?? "");
    setToppingIds(initial?.toppingIds ?? []);
    setExtraIds(initial?.extraIds ?? []);
    setDedicationText(initial?.dedicationText ?? "");
    setNotes(initial?.notes ?? "");
    setQuantity(initial?.quantity ?? 1);
    setCustomToppingOpen(Boolean(initial?.customToppingRequest));
    setCustomToppingText(initial?.customToppingRequest ?? "");
    setDesignDescription(initial?.designDescription ?? "");
    setReferenceImage(
      initial?.referenceImageId ? getImage(initial.referenceImageId) : null
    );
    setSavedImageId(initial?.referenceImageId ?? null);
    setImageSource(initial?.referenceImageSource ?? "cliente");
    setAiPrompt(initial?.aiPrompt ?? "");
    setCandleDigits(initial?.candleDigits ?? "");
    setCandleStyle(initial?.candleStyle ?? "vela");
    setSparklerQuantity(initial?.sparklerQuantity ?? 0);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, customerType]);

  const needsFlavor = Boolean(product.flavors && product.flavors.length > 0);
  const needsFilling = Boolean(product.fillings && product.fillings.length > 0);
  const isCheesecake = product.id === "cheesecake";
  const isFondant = product.customCakeType === "fondant";
  /** Las solicitudes a medida exigen fotografía de referencia. */
  const imageRequired = Boolean(product.requiresReferenceImage);
  /** Solo las tartas clásicas por capas muestran las referencias del acabado. */
  const showClassicReferences =
    !isQuote && (product.id === "pastel-clasico" || product.id === "pastel-buttercream");

  const selection: ItemSelection = {
    productId: product.id,
    customerType,
    sizeId,
    flavorId: flavorId || undefined,
    fillingId: fillingId || undefined,
    toppingIds,
    extraIds,
  };

  const breakdown =
    !isQuote && sizeId && (!isCheesecake || flavorId)
      ? computeUnitPriceBreakdown(selection)
      : null;

  const toppingPriceCents = sizeId
    ? getToppingPriceCents(product.id, sizeId)
    : null;

  const dedicationSelected = extraIds.includes("dedicatoria");

  /**
   * El generador solo aparece donde tiene sentido: tartas por capas y de
   * fondant. En un cheesecake el aspecto lo decide el sabor, y en una caja
   * de desayuno no hay nada que imaginar.
   */
  const ACABADO_POR_PRODUCTO: Record<string, CakeFinish> = {
    "pastel-clasico": "nata",
    "pastel-buttercream": "buttercream",
    "pastel-fondant": "fondant",
    "pastel-personalizado": "buttercream",
  };
  const suggestedFinish = ACABADO_POR_PRODUCTO[product.id];
  const showAiPreview = suggestedFinish !== undefined;

  /**
   * Los sabores y rellenos sin suplemento son pocos, así que nombrarlos en el
   * encabezado ahorra recorrer las quince tarjetas para averiguar cuáles no
   * cuestan nada. Solo tiene sentido donde alguno SÍ lleva suplemento: en el
   * cheesecake (el sabor va en el precio) o en las tartas a presupuestar, la
   * lista sería «todos» y no diría nada.
   */
  function freeOptionLabels(options: CatalogOption[] | undefined): string[] {
    if (isQuote || !options?.some((o) => o.surchargeCents)) return [];
    return options.filter((o) => !o.surchargeCents).map((o) => o.label);
  }
  const freeFlavorLabels = freeOptionLabels(product.flavors);
  const freeFillingLabels = freeOptionLabels(product.fillings);
  const selectedFlavorLabel = product.flavors?.find((f) => f.id === flavorId)?.label;
  const selectedFillingLabel = product.fillings?.find((f) => f.id === fillingId)?.label;

  /** Velas y bengalas: precio conocido, también en las tartas a presupuestar. */
  const candles = { candleDigits, candleStyle, sparklerQuantity };
  const candleSelection = resolveCandleSelection(candles);
  const candlesCents = candleSelection.totalCents;
  /** Importe visible de la tarta configurada (sin contar las velas). */
  const cakeCents = breakdown ? breakdown.unitTotalCents * quantity : null;

  function toggleTopping(id: string) {
    setToppingIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleExtra(id: string) {
    setExtraIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  function handleConfirm() {
    if (!sizeId) {
      setError("Selecciona un tamaño.");
      return;
    }
    if (needsFlavor && !flavorId) {
      setError(isCheesecake ? "Selecciona un sabor." : "Selecciona el sabor del bizcocho.");
      return;
    }
    if (isQuote) {
      const parsed = designDescriptionSchema.safeParse(designDescription);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }
    if (dedicationSelected) {
      const parsed = dedicationSchema.safeParse(dedicationText);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
    }
    let customToppingRequest: string | undefined;
    if (customToppingOpen && customToppingText.trim()) {
      const parsed = customToppingSchema.safeParse(customToppingText);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      customToppingRequest = parsed.data;
    }
    const notesParsed = freeTextSchema.safeParse(notes);
    if (!notesParsed.success) {
      setError(notesParsed.error.issues[0].message);
      return;
    }
    if (imageRequired && !referenceImage) {
      setError(
        "Para preparar el presupuesto necesitamos una fotografía de referencia del diseño."
      );
      return;
    }
    if (!isQuote && !breakdown) {
      setError("Esta combinación no está disponible. Revisa tamaño y sabor.");
      return;
    }

    // La imagen se guarda en el almacén al confirmar; el artículo solo
    // referencia el id (nunca base64 dentro del pedido). Si es la misma que ya
    // estaba guardada (edición sin tocar la foto), se reutiliza su id.
    let referenceImageId: string | undefined;
    if (referenceImage) {
      if (savedImageId && getImage(savedImageId) === referenceImage) {
        referenceImageId = savedImageId;
      } else {
        const saved = saveImage(referenceImage);
        if (!saved.ok) {
          setError(IMAGE_ERROR_MESSAGES[saved.error]);
          return;
        }
        referenceImageId = saved.id;
      }
    }

    const size = sizes.find((s) => s.id === sizeId)!;
    const flavor = product.flavors?.find((f) => f.id === flavorId);
    const filling = product.fillings?.find((f) => f.id === fillingId);
    const customization: ItemCustomization = {
      size: { id: size.id, label: size.label },
      flavor: flavor ? { id: flavor.id, label: flavor.label } : undefined,
      filling: filling ? { id: filling.id, label: filling.label } : undefined,
      toppings: TOPPINGS.filter((t) => toppingIds.includes(t.id)).map((t) => ({
        id: t.id,
        label: t.label,
      })),
      customToppingRequest,
      extras: product.extras
        .filter((e) => extraIds.includes(e.id))
        .map((e) => ({ id: e.id, label: e.label, priceCents: e.priceCents })),
      dedicationText: dedicationSelected ? dedicationText.trim() : undefined,
      designDescription: isQuote ? designDescription.trim() : undefined,
      notes: notes.trim() || undefined,
      referenceImageSource: referenceImageId ? imageSource : undefined,
      aiPrompt: referenceImageId && imageSource === "ia" ? aiPrompt : undefined,
      candleDigits: candleDigits || undefined,
      candleStyle: candleDigits ? candleStyle : undefined,
      candleQuantity: candleDigits ? candleDigits.length : undefined,
      sparklerQuantity: sparklerQuantity > 0 ? sparklerQuantity : undefined,
      referenceImageId,
    };

    setError(null);
    onConfirm({ selection, customization, quantity });
  }

  const gridCols = compact
    ? "grid gap-2 sm:grid-cols-3"
    : "grid gap-2 sm:grid-cols-2";

  return (
    <div className="space-y-6">
      {isQuote && (
        <p className="flex items-start gap-2.5 rounded-xl bg-secondary/15 px-4 py-3 text-sm text-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span>
            {isFondant
              ? "Las tartas de fondant se presupuestan a mano según la complejidad del diseño."
              : "Las decoraciones especiales se presupuestan a mano según el trabajo que requieren."}{" "}
            Envíanos tu idea y una fotografía de referencia: Dulce Flor revisará el diseño
            y te <strong>confirmará el precio final por WhatsApp</strong>. Aquí no se
            muestra ningún precio.
          </span>
        </p>
      )}

      {/* Referencias del propio obrador: fondant y personalizadas tienen cada
          una sus fotos. Se muestran pocas y el resto se abre en un diálogo,
          para no convertir el configurador en una galería. */}
      {isQuote && (
        <CakeReferences
          photos={isFondant ? FONDANT_CAKE_PHOTOS : CUSTOM_CAKE_PHOTOS}
          title={
            isFondant
              ? "Algunos trabajos en fondant"
              : "Inspírate con nuestros trabajos"
          }
          description={
            isFondant
              ? "Ejemplos reales de tartas forradas y modeladas en fondant. Cada diseño tiene una complejidad distinta, así que el precio lo confirmamos personalmente."
              : "Ejemplos reales de decoraciones a medida. Cada diseño tiene una complejidad distinta, así que el precio lo confirmamos personalmente."
          }
          limit={3}
          footnote="Son ejemplos de trabajos anteriores. Más abajo puedes adjuntar tu propia imagen de referencia con la idea que tengas en mente."
        />
      )}

      {/* Referencias reales del acabado clásico */}
      {showClassicReferences && <CakeReferences />}

      {/* Las tartas de queso son un producto muy visual y el sabor cambia
          mucho el aspecto: enseñar ejemplos antes de elegir evita sorpresas. */}
      {isCheesecake && (
        <CakeReferences
          photos={CHEESECAKE_PHOTOS}
          title="Así son nuestras tartas de queso"
          description="Fotografías reales del obrador. El aspecto cambia según el sabor que elijas; la decoración de la foto es orientativa."
          limit={3}
          footnote="¿Quieres una decoración concreta o una imagen impresa encima? Elige el papel comestible más abajo o cuéntanoslo en los cambios especiales."
        />
      )}

      {/* Tamaño (selección visual) */}
      <fieldset>
        <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
          <span className="font-display text-base font-semibold text-primary">Tamaño</span>
          <span className="text-xs text-muted-foreground">Obligatorio</span>
        </legend>
        <SizePicker
          product={product}
          customerType={customerType}
          flavorId={flavorId || undefined}
          selectedSizeId={sizeId}
          onSelect={setSizeId}
        />
      </fieldset>

      {/* Sabor. En las tartas a presupuestar no se cobran suplementos: el
          precio entero se valora a mano, así que no se enseñan importes. */}
      {needsFlavor && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-primary">
              {isCheesecake ? "Sabor" : "Sabor del bizcocho"}
            </span>
            <span className="text-xs text-muted-foreground">
              {freeFlavorLabels.length > 0
                ? `${freeFlavorLabels.join(", ")} sin suplemento`
                : "Obligatorio"}
            </span>
          </legend>
          <div role="group" aria-label="Sabor" className={gridCols}>
            {product.flavors!.map((flavor) => (
              <OptionCard
                key={flavor.id}
                selected={flavorId === flavor.id}
                onSelect={() => setFlavorId(flavor.id)}
                title={flavor.label}
                price={
                  !isQuote && flavor.surchargeCents
                    ? `+${formatEuros(flavor.surchargeCents)}`
                    : undefined
                }
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Relleno */}
      {needsFilling && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-primary">Relleno</span>
            <span className="text-xs text-muted-foreground">
              {freeFillingLabels.length > 0
                ? `${freeFillingLabels.join(", ")} sin suplemento`
                : "Incluido en el precio"}
            </span>
          </legend>
          <div role="group" aria-label="Relleno" className={gridCols}>
            {product.fillings!.map((filling) => (
              <OptionCard
                key={filling.id}
                selected={fillingId === filling.id}
                onSelect={() => setFillingId(filling.id === fillingId ? "" : filling.id)}
                title={filling.label}
                subtitle={compact ? undefined : filling.description}
                price={
                  !isQuote && filling.surchargeCents
                    ? `+${formatEuros(filling.surchargeCents)}`
                    : undefined
                }
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Toppings */}
      {product.allowsToppings && (
        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-base font-semibold text-primary">Toppings</span>
            <span className="text-xs text-muted-foreground">
              +{formatEuros(toppingPriceCents ?? TOPPING_PRICE_CENTS)} cada uno
            </span>
          </legend>
          <div aria-label="Toppings" className={gridCols}>
            {TOPPINGS.map((topping) => (
              <OptionCard
                key={topping.id}
                role="checkbox"
                selected={toppingIds.includes(topping.id)}
                onSelect={() => toggleTopping(topping.id)}
                title={topping.label}
                price={
                  toppingIds.includes(topping.id) && toppingPriceCents !== null
                    ? `+${formatEuros(toppingPriceCents)}`
                    : undefined
                }
              />
            ))}
          </div>

          {/* Topping fuera de catálogo */}
          <div className="mt-3">
            {!customToppingOpen ? (
              <button
                type="button"
                onClick={() => setCustomToppingOpen(true)}
                className="text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                ¿No encuentras el topping que buscas? Solicitar otro topping
              </button>
            ) : (
              <div className="space-y-1.5 rounded-xl bg-background-soft/70 p-3">
                <Label htmlFor={`custom-topping-${product.id}`}>
                  ¿Qué topping te gustaría?
                </Label>
                <Input
                  id={`custom-topping-${product.id}`}
                  value={customToppingText}
                  onChange={(e) => setCustomToppingText(e.target.value)}
                  placeholder="Por ejemplo: Ferrero Rocher"
                  maxLength={80}
                />
                <p className="text-xs text-warning">
                  <strong>Precio pendiente de confirmación:</strong> al no estar en
                  nuestra lista, no se suma al total automáticamente. Dulce Flor revisará
                  la disponibilidad y te confirmará el suplemento por WhatsApp.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomToppingOpen(false);
                    setCustomToppingText("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </fieldset>
      )}

      {/* Extras */}
      {product.extras.length > 0 && (
        <fieldset>
          <legend className="mb-2 font-display text-base font-semibold text-primary">
            Extras
          </legend>
          <div className="grid gap-2">
            {product.extras.map((extra) => (
              <OptionCard
                key={extra.id}
                role="checkbox"
                selected={extraIds.includes(extra.id)}
                onSelect={() => toggleExtra(extra.id)}
                title={extra.label}
                subtitle={compact ? undefined : extra.description}
                price={`+${formatEuros(extra.priceCents)}`}
              />
            ))}
          </div>
          {dedicationSelected && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="dedicatoria">Texto de la dedicatoria</Label>
              <Input
                id="dedicatoria"
                value={dedicationText}
                onChange={(e) => setDedicationText(e.target.value)}
                placeholder='Por ejemplo: "Felicidades, Laura"'
                maxLength={120}
              />
            </div>
          )}
        </fieldset>
      )}

      {/* Descripción del diseño (fondant, obligatoria) */}
      {isQuote && (
        <div className="space-y-1.5">
          <Label htmlFor="diseno">Descripción del diseño</Label>
          <Textarea
            id="diseno"
            value={designDescription}
            onChange={(e) => setDesignDescription(e.target.value)}
            placeholder="Cuéntanos cómo la imaginas: temática, colores, pisos, figuras, texto…"
            maxLength={600}
          />
          <p className="text-xs text-muted-foreground">
            Obligatoria: nos ayuda a preparar el presupuesto.
          </p>
        </div>
      )}

      {/* Previsualización con IA. Solo en las tartas que se configuran con
          acabado: en un aperitivo o una caja de desayuno no pinta nada. */}
      {showAiPreview && (
        <AiCakePreview
          suggestedFinish={suggestedFinish}
          onAccept={async ({ image, summary }) => {
            // Pasa por el mismo aro que una foto subida: llega a 1024 px sin
            // comprimir y guardarla tal cual llenaría el almacenamiento del
            // navegador en tres pedidos.
            const procesada = await processImageDataUrl(image);
            if (!procesada.ok) {
              setError(IMAGE_ERROR_MESSAGES[procesada.error]);
              return;
            }
            setReferenceImage(procesada.dataUrl);
            setSavedImageId(null);
            setImageSource("ia");
            setAiPrompt(summary);
            setError(null);
          }}
        />
      )}

      {/* Imagen de referencia */}
      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-2 font-display text-base font-semibold text-primary">
          Imagen de referencia
          <span className="text-xs font-normal text-muted-foreground">
            {imageRequired ? "Obligatoria" : "Opcional"}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {imageRequired
            ? "Adjunta una fotografía del diseño que tienes en mente: es lo que nos permite valorar el trabajo y prepararte el presupuesto."
            : "¿Tienes una idea concreta? Adjunta una imagen de referencia y la utilizaremos para entender mejor cómo quieres tu tarta."}
        </p>
        <ReferenceImagePicker
          value={referenceImage}
          onChange={(valor) => {
            setReferenceImage(valor);
            setImageSource("cliente");
            setAiPrompt("");
          }}
        />
        {referenceImage && imageSource === "ia" && (
          <p className="rounded-lg bg-background-soft px-3 py-2 text-xs text-muted-foreground">
            La imagen que has elegido está{" "}
            <strong>generada con inteligencia artificial</strong> y es orientativa.
            Se guardará con tu pedido para que sepamos qué tienes en mente.
          </p>
        )}
        {!isQuote && referenceImage && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Las imágenes sirven como <strong>referencia</strong>. El precio mostrado
            corresponde a nuestro acabado clásico: si el diseño requiere una decoración
            especial, Dulce Flor te confirmará disponibilidad y precio por WhatsApp.
          </p>
        )}
      </div>

      {/* Velas: precio conocido incluso en las tartas a presupuestar */}
      <CandlePicker
        digits={candleDigits}
        style={candleStyle}
        sparklerQuantity={sparklerQuantity}
        onDigitsChange={setCandleDigits}
        onStyleChange={setCandleStyle}
        onSparklerQuantityChange={setSparklerQuantity}
      />

      {/* Texto libre */}
      <div className="space-y-1.5">
        <Label htmlFor="notas">
          {isQuote ? "Observaciones" : "¿Quieres algún cambio especial?"}
        </Label>
        <Textarea
          id="notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            isQuote
              ? "Alergias, fecha flexible, dudas…"
              : "Por ejemplo: dos sabores de bizcocho en la misma tarta, sin frutos secos…"
          }
          maxLength={500}
        />
        {!isQuote && (
          <p className="text-xs text-muted-foreground">
            Opcional. Escribe aquí cualquier cambio que no esté entre las opciones. Las
            modificaciones fuera de lo estándar <strong>pueden variar el precio</strong>:
            Dulce Flor lo revisará y te confirmará el importe final por WhatsApp.
          </p>
        )}
      </div>

      <Separator />

      {/* Cantidad + precio + confirmar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <QuantityStepper value={quantity} onChange={setQuantity} />
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {isQuote ? "Precio" : quantity > 1 ? `Precio (${quantity} uds.)` : "Precio"}
          </p>
          {isQuote ? (
            <div>
              <p className="font-display text-xl font-bold text-primary">
                Precio a consultar
              </p>
              {candlesCents > 0 && (
                <p className="text-sm text-muted-foreground">
                  + {formatEuros(candlesCents)} en velas y bengalas
                </p>
              )}
            </div>
          ) : breakdown ? (
            <>
              <AnimatedPrice cents={cakeCents! + candlesCents} className="text-2xl" />
              {/* La caja va dentro del precio, no como cargo aparte: se
                  menciona para que nadie crea que se la cobran al recoger. */}
              {breakdown.packagingCents > 0 && (
                <p className="text-xs text-muted-foreground">Caja incluida</p>
              )}
            </>
          ) : (
            <p className="max-w-[13rem] text-sm text-muted-foreground">
              {isCheesecake && !flavorId
                ? "Elige sabor y tamaño para ver el precio"
                : "Elige el tamaño para ver el precio"}
            </p>
          )}
        </div>
      </div>

      {!isQuote &&
        breakdown &&
        (breakdown.flavorCents > 0 ||
          breakdown.fillingCents > 0 ||
          breakdown.toppingsCents > 0 ||
          breakdown.extrasCents > 0 ||
          candlesCents > 0) && (
        <div className="rounded-lg bg-background-soft px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span>Base</span>
            <span>{formatEuros(breakdown.baseCents)}</span>
          </div>
          {breakdown.flavorCents > 0 && (
            <div className="flex justify-between">
              <span>Bizcocho ({selectedFlavorLabel})</span>
              <span>+{formatEuros(breakdown.flavorCents)}</span>
            </div>
          )}
          {breakdown.fillingCents > 0 && (
            <div className="flex justify-between">
              <span>Relleno ({selectedFillingLabel})</span>
              <span>+{formatEuros(breakdown.fillingCents)}</span>
            </div>
          )}
          {breakdown.toppingsCents > 0 && (
            <div className="flex justify-between">
              <span>Toppings ({toppingIds.length})</span>
              <span>+{formatEuros(breakdown.toppingsCents)}</span>
            </div>
          )}
          {breakdown.extrasCents > 0 && (
            <div className="flex justify-between">
              <span>Extras</span>
              <span>+{formatEuros(breakdown.extrasCents)}</span>
            </div>
          )}
          {candleSelection.numbers && (
            <div className="flex justify-between">
              <span>
                {candleSelection.numbers.style === "bengala" ? "Bengalas" : "Velas"} (
                {candleSelection.numbers.digits})
              </span>
              <span>+{formatEuros(candleSelection.numbers.cents)}</span>
            </div>
          )}
          {candleSelection.sparklers && (
            <div className="flex justify-between">
              <span>Bengalas sueltas ({candleSelection.sparklers.quantity})</span>
              <span>+{formatEuros(candleSelection.sparklers.cents)}</span>
            </div>
          )}
        </div>
      )}

      {/* Aviso de que el importe mostrado aún puede cambiar */}
      {!isQuote &&
        breakdown &&
        (customToppingText.trim() || notes.trim() || referenceImage) && (
          <p className="rounded-lg bg-warning/10 px-4 py-2 text-sm text-warning">
            Precio actual: {formatEuros(cakeCents! + candlesCents)} +
            modificaciones pendientes de confirmar por Dulce Flor.
          </p>
        )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Deshabilitado mientras falten las opciones obligatorias: así el botón
          no promete algo que aún no se puede añadir. */}
      <Button
        type="button"
        size="xl"
        className="w-full"
        disabled={!isQuote && !breakdown}
        onClick={handleConfirm}
      >
        {isQuote ? "Solicitar presupuesto" : confirmLabel}
        {!isQuote && breakdown && ` · ${formatEuros(cakeCents! + candlesCents)}`}
      </Button>
    </div>
  );
}
