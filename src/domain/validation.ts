/**
 * Esquemas de validación (zod) compartidos por el configurador público,
 * el kiosk y el registro de pedidos. En una futura versión con backend,
 * estos mismos esquemas deben ejecutarse en servidor.
 */
import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Introduce un teléfono válido")
  .max(20, "Teléfono demasiado largo")
  .regex(/^[+]?[\d\s]{9,17}$/, "Introduce un teléfono válido (solo números, espacios y +)");

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Introduce tu nombre").max(80, "Nombre demasiado largo"),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .email("Introduce un email válido")
    .max(120)
    .optional()
    .or(z.literal("")),
  companyName: z.string().trim().max(120).optional().or(z.literal("")),
});

export const addressSchema = z.object({
  street: z
    .string()
    .trim()
    .min(5, "Introduce calle y número")
    .max(160, "Dirección demasiado larga"),
  municipality: z.string().trim().min(2, "Introduce el municipio").max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "El código postal debe tener 5 dígitos"),
  details: z.string().trim().max(160).optional().or(z.literal("")),
});

export const requestedSlotSchema = z.object({
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha"),
  requestedTime: z.string().regex(/^\d{2}:\d{2}$/, "Selecciona una hora"),
});

export const freeTextSchema = z.string().trim().max(500, "Máximo 500 caracteres");

export const dedicationSchema = z
  .string()
  .trim()
  .min(1, "Escribe el texto de la dedicatoria")
  .max(120, "Máximo 120 caracteres");

export const customToppingSchema = z
  .string()
  .trim()
  .min(2, "Escribe el topping que buscas")
  .max(80, "Máximo 80 caracteres");

export const designDescriptionSchema = z
  .string()
  .trim()
  .min(10, "Cuéntanos el diseño con un poco más de detalle (mínimo 10 caracteres)")
  .max(600, "Máximo 600 caracteres");
