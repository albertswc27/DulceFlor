/**
 * Portada de una familia de productos dentro del paso de catálogo.
 *
 * Sustituye al banner ancho único que se usaba antes: una sola foto recortada
 * a franja no transmitía la variedad de lo que hace el obrador y quedaba
 * deslavada. Aquí se muestran varias piezas distintas en pequeño, que es
 * justo lo que pidió Dulce Flor (24/08/2026).
 *
 * Es decorativa y orientativa: no se puede pulsar ni abre nada, para no
 * competir con las tarjetas de producto, que son la acción real del paso.
 */
import type { Photo } from "@/assets/photos";
import { cn } from "@/lib/utils";

interface FamilyCoverProps {
  photos: Photo[];
  /** Frase corta bajo el mosaico. Si falta, no se pinta nada. */
  caption?: string;
  className?: string;
}

export function FamilyCover({ photos, caption, className }: FamilyCoverProps) {
  if (photos.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((photo) => (
          <li
            key={photo.src}
            className="overflow-hidden rounded-xl border border-border bg-blush/30 shadow-card"
          >
            <img
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              width={400}
              height={400}
              className="aspect-square w-full object-cover transition-transform duration-500 motion-safe:hover:scale-105"
            />
          </li>
        ))}
      </ul>
      {caption && (
        <p className="text-center text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
