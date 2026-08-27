/**
 * Almacén de imágenes de referencia.
 *
 * Funciona en dos capas, igual que los pedidos (ver orderRepository):
 *
 *  1. **localStorage**, siempre. La imagen se procesa (redimensiona y
 *     comprime) y se guarda bajo su propia clave; el pedido solo referencia el
 *     id, nunca el base64. Es instantáneo y sirve sin conexión.
 *  2. **Supabase Storage**, cuando está configurado. Al registrar un pedido con
 *     imagen, esta se sube en segundo plano al bucket privado `order-references`
 *     para que el panel la vea desde cualquier dispositivo — que es justo lo
 *     que antes no pasaba: la foto se quedaba en el móvil del cliente.
 *
 * La subida va como el pedido: reintentable (cola en localStorage) y de mejor
 * esfuerzo. Solo el equipo, con sesión iniciada, puede descargar las imágenes
 * (política de Storage en supabase/schema.sql).
 */
import { newInternalId } from "@/domain/orderId";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const KEY_PREFIX = "dulce-flor:ref-image:";

/** Bucket de Storage donde viven las imágenes de referencia. */
const BUCKET = "order-references";
/** Ids de imágenes creadas que aún no se han subido al Storage. */
const PENDING_KEY = "dulce-flor:ref-images-pending";

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
 * Limpieza de huérfanas: elimina imágenes LOCALES no referenciadas por ningún
 * pedido ni por el borrador actual (p. ej. artículos quitados del carrito en
 * sesiones anteriores). No toca el Storage remoto: allí solo llegan imágenes de
 * pedidos ya registrados, y borrarlas exige sesión y se hace desde Supabase.
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

/* ------------------------------------------------------------------ */
/* Subida a Supabase Storage                                            */
/* ------------------------------------------------------------------ */

/** Ruta del archivo dentro del bucket. El id es un UUID, así que no colisiona. */
export function remoteImagePath(id: string): string {
  return `${id}.jpg`;
}

/**
 * Convierte un data URL (el formato en que guardamos la imagen procesada) en
 * un Blob subible. Las imágenes salen siempre como JPEG del procesado.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64 = ""] = dataUrl.split(",");
  // `||` (no `??`): un encabezado "data:;base64" captura "" y debe caer a jpeg.
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function readPendingUploads(): Set<string> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writePendingUploads(ids: Set<string>): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify([...ids]));
  } catch {
    // Sin espacio: la imagen ya está guardada en local; solo se pierde el
    // reintento de subida (y sigue en pie el aviso por WhatsApp).
  }
}

/**
 * Marca una imagen para subir al Storage. La llama el repositorio al registrar
 * un pedido con imagen: solo entonces la imagen es "real" (no un borrador).
 */
export function enqueueImageUpload(id: string): void {
  if (!id || !isSupabaseConfigured()) return;
  const pending = readPendingUploads();
  if (pending.has(id)) return;
  pending.add(id);
  writePendingUploads(pending);
}

/**
 * Sube una imagen concreta. Silenciosa a propósito: los reintentos los hace
 * flushImageUploads(). Un "ya existe" (reintento de algo que sí subió) cuenta
 * como éxito, igual que en la subida de pedidos.
 */
async function uploadOne(id: string): Promise<boolean> {
  const dataUrl = getImage(id);
  // Si la imagen ya no está en local, no hay nada que subir: se saca de la cola
  // para no reintentar eternamente algo imposible.
  if (!dataUrl) return true;
  const supabase = await getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remoteImagePath(id), dataUrlToBlob(dataUrl), {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (error && !/exist|dupl/i.test(error.message)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Saca un id de la cola releyendo el estado fresco (nunca sobre una copia vieja). */
function removePendingUpload(id: string): void {
  const pending = readPendingUploads();
  if (pending.delete(id)) writePendingUploads(pending);
}

/** Intenta subir todo lo pendiente. Sin Supabase o sin cola, no hace nada. */
export async function flushImageUploads(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // Copia de los ids al empezar; cada baja relee la cola fresca. Así, si otro
  // pedido encola una imagen durante un await, no se pierde al reescribir.
  const ids = [...readPendingUploads()];
  if (ids.length === 0) return;
  for (const id of ids) {
    if (await uploadOne(id)) removePendingUpload(id);
  }
}

/**
 * URL temporal firmada para que el panel muestre una imagen que no está en
 * este dispositivo. Requiere sesión iniciada (política de Storage). Devuelve
 * null si no hay Supabase, no hay sesión o la imagen no está subida.
 */
export async function getRemoteImageUrl(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(remoteImagePath(id), 60 * 60);
    return error ? null : (data?.signedUrl ?? null);
  } catch {
    return null;
  }
}
