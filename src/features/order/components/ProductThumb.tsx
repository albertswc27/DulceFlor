/**
 * Miniatura de producto para las tarjetas del catálogo.
 *
 * Si Dulce Flor tiene una fotografía real de ese producto, se muestra; si no
 * (cheesecakes, tres leches, especialidades), se dibuja la ilustración de
 * marca. Nunca se enseña la foto de otro producto para «rellenar».
 */
import { getProductPhoto } from "@/assets/photos";
import { getProduct } from "@/domain/catalog";
import { cn } from "@/lib/utils";
import { CakeIllustration } from "./CakeIllustration";

interface ProductThumbProps {
  productId: string;
  /** Tamaño del cuadro. Por defecto, miniatura de listado. */
  size?: "sm" | "md";
  className?: string;
}

export function ProductThumb({ productId, size = "sm", className }: ProductThumbProps) {
  const photo = getProductPhoto(productId);
  const product = getProduct(productId);
  const box = size === "sm" ? "h-20 w-20" : "h-28 w-28";

  if (!photo) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background-soft/70 p-2",
          box,
          className
        )}
      >
        <CakeIllustration
          tiers={product?.category === "tres-leches" ? 1 : 2}
          scale={1}
          className="h-full w-auto"
        />
      </span>
    );
  }

  return (
    <img
      src={photo.src}
      alt={photo.alt}
      loading="lazy"
      width={320}
      height={320}
      className={cn(
        "shrink-0 rounded-xl border border-border object-cover shadow-card",
        box,
        className
      )}
    />
  );
}
