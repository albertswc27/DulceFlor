/**
 * Genera la imagen orientativa de una tarta.
 *
 * A diferencia del endpoint de los SMS, aquí NO hay sesión que validar: quien
 * llama es una clienta anónima que está configurando su tarta. Eso lo
 * convierte en el punto más expuesto del sistema, porque cada llamada cuesta
 * dinero y cualquiera puede hacerla.
 *
 * La contención es en tres puertas, todas en el servidor y todas antes de
 * llamar al proveedor:
 *
 *   1. por sesión de configuración → 2 imágenes (lo acordado con el negocio)
 *   2. por cliente y día           → para que uno solo no acapare
 *   3. por tienda y día            → TOPE DE GASTO DURO
 *
 * La tercera es la importante: pase lo que pase, el gasto del día está
 * acotado. Contar en el navegador no serviría de nada —se borra— y contar en
 * el pedido tampoco, porque el pedido aún no existe cuando esto se usa.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AI_PREVIEW_PROBLEM_MESSAGES,
  AI_SYSTEM_PROMPT,
  buildImagePrompt,
  buildRefinePrompt,
  describeAiPreview,
  MAX_DETAIL_LENGTH,
  validateAiPreviewOptions,
} from "../src/domain/aiPreview";
import { construirProveedorIa } from "./_ia-proveedores";

export const config = {
  runtime: "nodejs",
  // Generar una imagen tarda segundos: con los 15 s del resto de funciones,
  // Vercel cortaría la petición justo antes de recibirla y se habría pagado
  // igualmente.
  maxDuration: 60,
};

/** Imágenes por sesión de configuración. Lo fijó el negocio. */
const LIMITE_SESION = 2;
/** Por cliente y día: margen para configurar dos o tres tartas, no más. */
const LIMITE_CLIENTE = 6;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function error(code: string, message: string, status: number, retriable = false): Response {
  return json({ ok: false, error: code, message, retriable }, status);
}

function sha256(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/**
 * Clave de cliente a partir de la IP.
 *
 * NO se guarda la IP: se guarda un HMAC con una sal de servidor y con la
 * fecha dentro, así que la clave cambia cada día y no se puede volver de ella
 * al domicilio de nadie. Sirve para contar, que es lo único que hace falta.
 */
function claveCliente(request: Request, sal: string): string {
  const cabecera =
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const ip = cabecera.split(",")[0]?.trim() || "desconocida";
  const dia = new Date().toISOString().slice(0, 10);
  return `ip:${createHmac("sha256", sal).update(`${ip}|${dia}`).digest("hex").slice(0, 32)}`;
}

/**
 * Fotos de estilo, cacheadas mientras la función siga caliente.
 *
 * Se piden por URL a la propia web en vez de empaquetarlas con la función:
 * viven en `public/`, así que tienen ruta estable, no engordan el paquete y
 * se actualizan solas si algún día se cambian por otras mejores.
 */
const cacheReferencias = new Map<string, string[]>();

async function cargarReferencias(baseUrl: string, familia: string): Promise<string[]> {
  const cacheada = cacheReferencias.get(familia);
  if (cacheada) return cacheada;

  const descargas = await Promise.all(
    [1, 2, 3].map(async (n) => {
      try {
        const respuesta = await fetch(`${baseUrl}/referencias-ia/${familia}-${n}.jpg`);
        if (!respuesta.ok) return null;
        return Buffer.from(await respuesta.arrayBuffer()).toString("base64");
      } catch {
        return null;
      }
    })
  );
  const validas = descargas.filter((d): d is string => d !== null);
  if (validas.length > 0) cacheReferencias.set(familia, validas);
  return validas;
}

interface Peticion {
  sessionToken?: unknown;
  finish?: unknown;
  colourIds?: unknown;
  detail?: unknown;
  /** Texto del refinado. Si viene, se edita la imagen anterior. */
  refine?: unknown;
}

interface ResultadoPuerta {
  allowed: boolean;
  reason: string;
  session_used: number;
  resets_at: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return error("metodo_no_permitido", "Este endpoint solo acepta POST.", 405);
    }

    const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
    // Hace falta service_role: los contadores están cerrados a la clave
    // pública a propósito. Si `anon` pudiera tocarlos, cualquiera podría
    // gastar el cupo del día de la tienda con una llamada directa.
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    const siteUrl = (process.env.PUBLIC_SITE_URL ?? "").trim();
    const sal = (process.env.AI_IMAGE_IP_SALT ?? "").trim();

    if (!supabaseUrl || !serviceKey) {
      return error(
        "sin_configurar",
        "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.",
        500
      );
    }
    if (!siteUrl) {
      return error("sin_configurar", "Falta PUBLIC_SITE_URL.", 500);
    }
    if (!sal) {
      return error("sin_configurar", "Falta AI_IMAGE_IP_SALT.", 500);
    }

    let peticion: Peticion;
    try {
      peticion = (await request.json()) as Peticion;
    } catch {
      return error("json_invalido", "La petición no es un JSON válido.", 400);
    }

    const validacion = validateAiPreviewOptions(peticion);
    if (!validacion.ok) {
      return error(
        "opciones_invalidas",
        AI_PREVIEW_PROBLEM_MESSAGES[validacion.problem],
        422
      );
    }
    const opciones = validacion.options;

    const refine = typeof peticion.refine === "string" ? peticion.refine.trim() : "";
    if (refine.length > MAX_DETAIL_LENGTH) {
      return error(
        "opciones_invalidas",
        AI_PREVIEW_PROBLEM_MESSAGES["detalle-largo"],
        422
      );
    }
    if (refine) {
      // El texto del refinado pasa por el mismo filtro que el inicial.
      const revisionRefinado = validateAiPreviewOptions({
        finish: opciones.finish,
        colourIds: opciones.colourIds,
        detail: refine,
      });
      if (!revisionRefinado.ok) {
        return error(
          "opciones_invalidas",
          AI_PREVIEW_PROBLEM_MESSAGES[revisionRefinado.problem],
          422
        );
      }
    }

    const proveedor = construirProveedorIa(process.env);
    if (!proveedor.ok) return error("sin_configurar", proveedor.message, 500);

    // La sesión la emite el servidor en la primera llamada. El navegador la
    // devuelve en las siguientes, pero no puede inventarse una que le dé cupo
    // nuevo: cada token estrena contador, y el límite por cliente y día está
    // por encima justo para eso.
    const sessionToken =
      typeof peticion.sessionToken === "string" && peticion.sessionToken.length >= 16
        ? peticion.sessionToken
        : randomBytes(24).toString("base64url");
    const claveSesion = `sesion:${sha256(sessionToken).slice(0, 32)}`;
    const claveDia = `tienda:${new Date().toISOString().slice(0, 10)}`;

    const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: puerta, error: errorPuerta } = await supabase.rpc("ai_quota_gate", {
      p_session_key: claveSesion,
      p_ip_key: claveCliente(request, sal),
      p_day_key: claveDia,
      p_session_limit: LIMITE_SESION,
      p_ip_limit: LIMITE_CLIENTE,
      p_day_limit: Number(process.env.AI_IMAGE_DAY_LIMIT ?? "40"),
    });

    if (errorPuerta) {
      return error(
        "cupo_fallido",
        "No se ha podido comprobar el cupo de imágenes. Inténtalo en un momento.",
        502,
        true
      );
    }

    const resultado = (Array.isArray(puerta) ? puerta[0] : puerta) as ResultadoPuerta | null;
    if (!resultado?.allowed) {
      const motivo = resultado?.reason ?? "limite_sesion";
      const mensajes: Record<string, string> = {
        limite_sesion: `Has usado las ${LIMITE_SESION} imágenes de este pedido. Puedes seguir con la tarta o adjuntar una foto tuya de referencia.`,
        limite_cliente:
          "Has generado bastantes imágenes hoy. Prueba mañana o adjunta una foto de referencia.",
        limite_tienda:
          "Hoy se han generado ya muchas imágenes. Vuelve a probar mañana o adjunta una foto de referencia.",
      };
      return error(motivo, mensajes[motivo] ?? mensajes.limite_sesion, 429);
    }

    /** Devuelve el cupo consumido: no se le cobra al cliente lo que no se le dio. */
    const devolverCupo = async () => {
      try {
        await supabase.rpc("ai_quota_refund", { p_key: claveSesion });
      } catch {
        // Si falla, el cliente pierde una generación. Es preferible eso a
        // dejar la petición colgada por un error de contabilidad.
      }
    };

    const referencias = await cargarReferencias(siteUrl.replace(/\/+$/, ""), opciones.finish);
    if (referencias.length === 0) {
      await devolverCupo();
      return error(
        "sin_referencias",
        "No se han podido cargar las fotos de estilo. Inténtalo en un momento.",
        502,
        true
      );
    }

    // Al refinar se EDITA la imagen anterior en vez de generar otra distinta.
    let interaccionAnterior: string | undefined;
    if (refine) {
      const { data } = await supabase.rpc("ai_session_previous", {
        p_token_hash: claveSesion,
      });
      if (typeof data === "string" && data) interaccionAnterior = data;
    }

    const salida = await proveedor.proveedor.generar({
      sistema: AI_SYSTEM_PROMPT,
      texto: refine ? buildRefinePrompt(refine) : buildImagePrompt(opciones),
      referencias,
      interaccionAnterior,
    });

    if (!salida.ok) {
      await devolverCupo();
      return json(
        { ok: false, error: salida.code, message: salida.message, retriable: salida.retriable },
        salida.retriable ? 502 : 422
      );
    }

    if (salida.interaccionId) {
      try {
        await supabase.rpc("ai_session_remember", {
          p_token_hash: claveSesion,
          p_interaction_id: salida.interaccionId,
        });
      } catch {
        // Sin esto solo se pierde la posibilidad de editar: no es motivo para
        // tirar una imagen que ya está pagada y generada.
      }
    }

    // Limpieza perezosa de contadores viejos, de vez en cuando y sin bloquear.
    if (Math.random() < 0.02) void supabase.rpc("ai_quota_prune");

    return json(
      {
        ok: true,
        sessionToken,
        image: `data:image/jpeg;base64,${salida.base64}`,
        used: resultado.session_used,
        remaining: Math.max(0, LIMITE_SESION - resultado.session_used),
        summary: describeAiPreview(opciones),
        provider: proveedor.proveedor.name,
      },
      200
    );
  },
};
