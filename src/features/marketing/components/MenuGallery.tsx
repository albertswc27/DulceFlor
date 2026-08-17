import { ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface MenuImage {
  src: string;
  alt: string;
  caption: string;
}

/**
 * Galería de las cartas fotografiadas de Dulce Flor.
 * Cada carta se puede ampliar en un diálogo accesible.
 */
export function MenuGallery({ images }: { images: MenuImage[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <li key={image.src}>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={`Ampliar carta: ${image.caption}`}
                className="group block w-full overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow duration-200 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="block aspect-[3/4] overflow-hidden bg-cocoa">
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="flex min-h-11 items-center justify-center gap-1.5 px-2 py-2 text-center text-xs font-medium text-primary">
                  <ZoomIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {image.caption}
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{image.caption}</DialogTitle>
                <DialogDescription className="sr-only">{image.alt}</DialogDescription>
              </DialogHeader>
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                className="max-h-[70vh] w-full rounded-lg bg-cocoa object-contain"
              />
            </DialogContent>
          </Dialog>
        </li>
      ))}
    </ul>
  );
}
