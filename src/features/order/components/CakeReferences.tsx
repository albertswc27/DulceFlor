/**
 * Referencias visuales REALES de Dulce Flor dentro del propio configurador:
 * el cliente ve qué acabado incluye el precio automático antes de confirmar.
 * Las fotos salen de src/assets/cakePhotos.ts (solo fotografías del obrador).
 */
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CLASSIC_CAKE_PHOTOS, type Photo as CakePhoto } from "@/assets/photos";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CakeReferencesProps {
  photos?: CakePhoto[];
  title?: string;
  description?: React.ReactNode;
  /** Nº de fotos visibles (el resto queda fuera para no alargar el paso). */
  limit?: number;
  /** Texto del pie que aparece bajo la parrilla. */
  footnote?: React.ReactNode;
  className?: string;
}

export function CakeReferences({
  photos = CLASSIC_CAKE_PHOTOS,
  title = "Así es nuestra tarta clásica",
  description,
  limit = 4,
  footnote,
  className,
}: CakeReferencesProps) {
  const visible = photos.slice(0, limit);
  const rest = photos.slice(limit);
  if (visible.length === 0) return null;

  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-2xl border border-secondary/40 bg-background-soft/50 p-4 sm:p-5",
        className
      )}
    >
      <h3 className="font-display text-base font-semibold text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ?? (
          <>
            Fotografías reales de nuestro obrador. Este es el acabado que incluye el
            precio: cobertura, cenefa de manga y los toppings que elijas. Cada tarta es
            artesanal, así que puede haber pequeñas variaciones.
          </>
        )}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {visible.map((photo) => (
          <li key={photo.src}>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label={`Ampliar foto: ${photo.caption}`}
                  className="group w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-card transition-shadow hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    width={1000}
                    height={1400}
                    className="aspect-[3/4] w-full bg-blush/30 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="block px-2 py-1.5 text-xs leading-snug text-muted-foreground">
                    {photo.caption}
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>{photo.caption}</DialogTitle>
                  <DialogDescription className="sr-only">{photo.alt}</DialogDescription>
                </DialogHeader>
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="max-h-[70vh] w-full rounded-lg object-contain"
                />
              </DialogContent>
            </Dialog>
          </li>
        ))}
      </ul>

      {rest.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="mt-3">
              <Images className="h-4 w-4" aria-hidden="true" />
              Ver más ejemplos ({rest.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                Todos son trabajos reales de Dulce Flor. Cada diseño tiene una
                complejidad distinta y su precio se confirma personalmente.
              </DialogDescription>
            </DialogHeader>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <li key={photo.src} className="overflow-hidden rounded-xl border border-border bg-card">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    width={1000}
                    height={1400}
                    className="aspect-[3/4] w-full bg-blush/30 object-cover"
                  />
                  <span className="block px-2 py-1.5 text-xs leading-snug text-muted-foreground">
                    {photo.caption}
                  </span>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}

      {footnote !== undefined ? (
        footnote && (
          <p className="mt-3 text-xs text-muted-foreground">{footnote}</p>
        )
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          ¿Buscas una decoración especial (dibujos, personajes, figuras)? Eso pertenece a
          la <strong>tarta personalizada</strong>, que presupuestamos a medida.
        </p>
      )}
    </section>
  );
}
