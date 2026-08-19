/**
 * Selector de imagen de referencia: archivo o cámara del móvil, con preview,
 * cambio y eliminación. El procesado (redimensionado/compresión) ocurre aquí;
 * el guardado en el almacén se hace al añadir el artículo al pedido.
 */
import * as React from "react";
import { ImagePlus, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_ERROR_MESSAGES,
  processImageFile,
} from "@/services/imageStore";

interface ReferenceImagePickerProps {
  /** Data URL procesado, o null si no hay imagen. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function ReferenceImagePicker({ value, onChange }: ReferenceImagePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite volver a seleccionar el mismo archivo más tarde.
    event.target.value = "";
    if (!file) return;
    setError(null);
    setProcessing(true);
    const result = await processImageFile(file);
    setProcessing(false);
    if (!result.ok) {
      setError(IMAGE_ERROR_MESSAGES[result.error]);
      return;
    }
    onChange(result.dataUrl);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        aria-label="Seleccionar imagen de referencia"
        onChange={handleFile}
      />

      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt="Imagen de referencia seleccionada"
            className="h-28 w-28 shrink-0 rounded-xl border border-border object-cover shadow-card"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={processing}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCcw />
              Cambiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              <Trash2 />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className="w-full sm:w-auto"
        >
          {processing ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {processing ? "Procesando imagen…" : "Añadir imagen de referencia"}
        </Button>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        JPG, PNG o WebP · máx. 12 MB. La usaremos solo como referencia del diseño.
      </p>
    </div>
  );
}
