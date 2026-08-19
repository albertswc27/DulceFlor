/**
 * Almacén de imágenes de referencia (POC).
 *
 * Coherente con la persistencia actual (localStorage, sin backend): cada
 * imagen se guarda REDIMENSIONADA y comprimida bajo su propia clave, y los
 * pedidos solo referencian el id — nunca se incrusta el base64 dentro del
 * objeto del pedido. Al migrar a un backend real, esta interfaz se sustituye
 * por subida a storage (Supabase Storage, S3…) manteniendo los ids.
 *
 * Limitación documentada: las imágenes viven en el navegador donde se creó
 * el pedido (igual que los pedidos de la POC).
 */
import { newInternalId } from "@/domain/orderId";

const KEY_PREFIX = "dulce-flor:ref-image:";

/** Tipos aceptados desde el selector de archivos. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Tamaño máximo del archivo original que aceptamos procesar. */
export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB

/** Lado mayor tras el redimensionado. */
const MAX_DIMENSION_PX = 1280;
const JPEG_QUALITY = 0.82;

/** Tamaño máximo del data URL resultante que aceptamos almacenar. */
const MAX_STORED_DATA_URL_CHARS = 900 * 1024;

export type ImageError =
  | "unsupported-type"
  | "file-too-large"
  | "processing-failed"
  | "storage-full";

export const IMAGE_ERROR_MESSAGES: Record<ImageError, string> = {
  "unsupported-type": "Formato no compatible. Usa una imagen JPG, PNG o WebP.",
  "file-too-large": "La imagen es demasiado grande (máximo 12 MB).",
  "processing-failed": "No se pudo procesar la imagen. Prueba con otra fotografía.",
  "storage-full":
    "No queda espacio para guardar la imagen en este dispositivo. Puedes enviar el pedido sin imagen y mandárnosla por WhatsApp.",
};

/**
 * Redimensiona y comprime un archivo de imagen a un data URL JPEG razonable.
 */
export function processImageFile(
  file: File
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: ImageError }> {
  return new Promise((resolve) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      resolve({ ok: false, error: "unsupported-type" });
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      resolve({ ok: false, error: "file-too-large" });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("sin contexto 2d");
        // Fondo blanco para PNG con transparencia → JPEG.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        if (dataUrl.length > MAX_STORED_DATA_URL_CHARS) {
          resolve({ ok: false, error: "processing-failed" });
        } else {
          resolve({ ok: true, dataUrl });
        }
      } catch {
        resolve({ ok: false, error: "processing-failed" });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ ok: false, error: "processing-failed" });
    };
    img.src = objectUrl;
  });
}

/** Guarda un data URL ya procesado. Devuelve el id o un error de espacio. */
export function saveImage(
  dataUrl: string
): { ok: true; id: string } | { ok: false; error: ImageError } {
  const id = newInternalId();
  try {
    localStorage.setItem(`${KEY_PREFIX}${id}`, dataUrl);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "storage-full" };
  }
}

export function getImage(id: string): string | null {
  try {
    return localStorage.getItem(`${KEY_PREFIX}${id}`);
  } catch {
    return null;
  }
}

export function deleteImage(id: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${id}`);
  } catch {
    // sin almacenamiento disponible: nada que borrar
  }
}

/**
 * Limpieza de huérfanas: elimina imágenes no referenciadas por ningún pedido
 * ni por el borrador actual (p. ej. artículos quitados del carrito en
 * sesiones anteriores).
 */
export function pruneImagesExcept(referencedIds: Set<string>): void {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX) && !referencedIds.has(key.slice(KEY_PREFIX.length))) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => localStorage.removeItem(key));
  } catch {
    // sin almacenamiento disponible
  }
}
