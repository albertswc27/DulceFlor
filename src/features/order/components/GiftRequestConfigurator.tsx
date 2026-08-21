/**
 * Solicitud de regalo personalizado (caja de desayuno / copa personalizada).
 * No tiene precio automático: genera una solicitud de presupuesto que Dulce
 * Flor responde por WhatsApp. Reutiliza el mismo modelo de artículo que el
 * resto del catálogo (requiresQuote) para no duplicar el sistema de pedidos.
 */
import * as React from "react";
import { Gift, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { CatalogProduct } from "@/domain/catalog";
import {
  designDescriptionSchema,
  freeTextSchema,
  giftDedicationSchema,
  occasionSchema,
} from "@/domain/validation";
import type { CustomerType, ItemCustomization } from "@/domain/types";
import { saveImage, IMAGE_ERROR_MESSAGES } from "@/services/imageStore";
import { BREAKFAST_PHOTOS, GLASS_PHOTOS } from "@/assets/photos";
import { CakeReferences } from "./CakeReferences";
import { ReferenceImagePicker } from "./ReferenceImagePicker";
import type { ConfiguratorResult } from "./ProductConfigurator";

interface GiftRequestConfiguratorProps {
  product: CatalogProduct;
  customerType: CustomerType;
  onConfirm: (result: ConfiguratorResult) => void;
  compact?: boolean;
}

/** Sugerencias de ocasión: solo ayudan a rellenar, no limitan el texto. */
const OCCASIONS = [
  "Cumpleaños",
  "Aniversario",
  "San Valentín",
  "Día de la Madre",
  "Felicitación",
  "Solo porque sí",
];

export function GiftRequestConfigurator({
  product,
  customerType,
  onConfirm,
  compact = false,
}: GiftRequestConfiguratorProps) {
  const isBreakfast = product.giftType === "desayuno";
  const photos = isBreakfast ? BREAKFAST_PHOTOS : GLASS_PHOTOS;

  const [occasion, setOccasion] = React.useState("");
  const [dedication, setDedication] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [referenceImage, setReferenceImage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOccasion("");
    setDedication("");
    setDescription("");
    setNotes("");
    setReferenceImage(null);
    setError(null);
  }, [product.id]);

  function handleConfirm() {
    const occasionParsed = occasionSchema.safeParse(occasion);
    if (!occasionParsed.success) {
      setError(occasionParsed.error.issues[0].message);
      return;
    }
    const descriptionParsed = designDescriptionSchema.safeParse(description);
    if (!descriptionParsed.success) {
      setError(descriptionParsed.error.issues[0].message);
      return;
    }
    const dedicationParsed = giftDedicationSchema.safeParse(dedication);
    if (!dedicationParsed.success) {
      setError(dedicationParsed.error.issues[0].message);
      return;
    }
    const notesParsed = freeTextSchema.safeParse(notes);
    if (!notesParsed.success) {
      setError(notesParsed.error.issues[0].message);
      return;
    }

    let referenceImageId: string | undefined;
    if (referenceImage) {
      const saved = saveImage(referenceImage);
      if (!saved.ok) {
        setError(IMAGE_ERROR_MESSAGES[saved.error]);
        return;
      }
      referenceImageId = saved.id;
    }

    const customization: ItemCustomization = {
      size: { id: "a-medida", label: "A medida" },
      toppings: [],
      extras: [],
      occasion: occasionParsed.data,
      dedicationText: dedicationParsed.data || undefined,
      designDescription: descriptionParsed.data,
      notes: notes.trim() || undefined,
      referenceImageId,
    };

    setError(null);
    onConfirm({
      selection: {
        productId: product.id,
        customerType,
        sizeId: "a-medida",
        toppingIds: [],
        extraIds: [],
      },
      customization,
      quantity: 1,
    });
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2.5 rounded-xl bg-secondary/15 px-4 py-3 text-sm text-foreground">
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span>
          Preparamos cada {isBreakfast ? "caja de desayuno" : "copa"} a medida, así que{" "}
          <strong>no hay un precio cerrado</strong>. Cuéntanos la ocasión y qué te
          gustaría, y Dulce Flor te confirmará las opciones y el precio por WhatsApp.
        </span>
      </p>

      {!compact && photos.length > 0 && (
        <CakeReferences
          photos={photos}
          title={isBreakfast ? "Así son nuestras cajas" : "Así son nuestras copas"}
          description="Fotografías reales de trabajos anteriores. Cada encargo se prepara según lo que nos pidas."
          limit={3}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ocasion">¿Cuál es la ocasión?</Label>
        <Input
          id="ocasion"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="Cumpleaños, aniversario, San Valentín…"
          maxLength={80}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {OCCASIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setOccasion(option)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descripcion-regalo">
          ¿Qué te gustaría que llevara?
        </Label>
        <Textarea
          id="descripcion-regalo"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isBreakfast
              ? "Cuéntanos qué te gustaría incluir, para quién es y si tiene alguna preferencia o alergia."
              : "Cuéntanos cómo la imaginas: sabores, colores, decoración, para quién es…"
          }
          maxLength={600}
        />
      </div>

      {/* La dedicatoria es el corazón del regalo */}
      <div className="space-y-1.5 rounded-2xl border border-secondary/40 bg-background-soft/50 p-4">
        <Label
          htmlFor="dedicatoria-regalo"
          className="flex items-center gap-2 font-display text-base font-semibold text-primary"
        >
          <Heart className="h-4 w-4 text-accent" aria-hidden="true" />
          Dedicatoria
        </Label>
        <p className="text-sm text-muted-foreground">
          Añade unas palabras para hacer el regalo todavía más personal.
        </p>
        <Textarea
          id="dedicatoria-regalo"
          value={dedication}
          onChange={(e) => setDedication(e.target.value)}
          placeholder="“Feliz aniversario. Gracias por compartir cada momento conmigo.”"
          maxLength={300}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. La escribiremos tal cual nos la dejes aquí.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-2 font-display text-base font-semibold text-primary">
          Imagen de referencia
          <span className="text-xs font-normal text-muted-foreground">Opcional</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Si has visto algo que te gusta, adjúntalo y nos servirá de inspiración.
        </p>
        <ReferenceImagePicker value={referenceImage} onChange={setReferenceImage} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notas-regalo">Observaciones</Label>
        <Textarea
          id="notas-regalo"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cualquier detalle que debamos tener en cuenta."
          maxLength={500}
        />
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Precio</p>
        <p className="font-display text-xl font-bold text-primary">Precio a consultar</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="button" size="xl" className="w-full" onClick={handleConfirm}>
        Solicitar presupuesto
      </Button>
    </div>
  );
}
