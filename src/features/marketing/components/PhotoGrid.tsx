/**
 * Parrilla compacta de fotografías REALES del obrador para las páginas de
 * marketing (aperitivos, desayunos y copas).
 *
 * Existe además `CakeReferences` (@/features/order/components), que se reutiliza
 * tal cual en las galerías de TARTAS: incluye una nota fija sobre la tarta
 * personalizada, así que solo es correcta ahí. Para el resto de líneas usamos
 * esta parrilla, sin ningún texto que hable de tartas.
 *
 * Reglas: `loading="lazy"`, alt descriptivo del propio Photo y proporción fija
 * (aspect-square) para que no haya salto de maquetación.
 */
import type { Photo } from "@/assets/photos";
import { cn } from "@/lib/utils";

type ColumnCount = 2 | 3 | 4;

/** Clases literales: Tailwind no puede escanear nombres construidos al vuelo. */
const COLUMN_CLASSES: Record<ColumnCount, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

interface PhotoGridProps {
  photos: Photo[];
  /** Nº máximo de fotos visibles: pocas y bien elegidas. */
  limit?: number;
  /** Columnas a partir de `sm`. En móvil nunca pasa de 2. */
  columns?: ColumnCount;
  className?: string;
}

export function PhotoGrid({
  photos,
  limit,
  columns = 3,
  className,
}: PhotoGridProps) {
  const visible = typeof limit === "number" ? photos.slice(0, limit) : photos;
  if (visible.length === 0) return null;

  return (
    <ul className={cn("grid gap-2.5", COLUMN_CLASSES[columns], className)}>
      {visible.map((photo) => (
        <li
          key={photo.src}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
        >
          <img
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            width={1000}
            height={1000}
            className="aspect-square w-full bg-blush/30 object-cover"
          />
          <p className="px-2.5 py-2 text-xs leading-snug text-muted-foreground">
            {photo.caption}
          </p>
        </li>
      ))}
    </ul>
  );
}
