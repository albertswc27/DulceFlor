/**
 * Envío del SMS de «pedido tramitado».
 *
 * Es el único punto del sistema que gasta dinero, así que todo aquí está
 * escrito para no gastarlo por error:
 *
 *  1. Exige el JWT de una sesión del panel y lo verifica CONTRA Supabase
 *     (no se fía de la firma en local): sin eso, este endpoint sería un botón
 *     público para vaciar el saldo de SMS de Dulce Flor.
 *  2. Lee el pedido con el token de quien llama, así que la seguridad por
 *     fila sigue mandando: la función no puede ver nada que la dueña no
 *     pudiera ver desde el panel.
 *  3. Comprueba ANTES de pagar que el teléfono es un móvil y que el cliente
 *     no ha pedido que no le avisen.
 *  4. No reenvía dos veces el mismo aviso salvo que se pida expresamente.
 *
 * El enlace de la ficha se crea aquí: se genera un token, se guarda su HASH
 * en la base de datos y el token en claro solo viaja dentro del SMS.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
// En las funciones de Vercel no existe el alias «@/»: es cosa de Vite y del
// tsconfig, y el empaquetador de la función no lo resuelve. Rutas relativas.
import { buildOrderStatusSms, measureSms, PHONE_PROBLEM_MESSAGES, toE164 } from "../src/domain/sms";
import { newOrderToken } from "../src/domain/orderId";
import { buildProvider } from "./_sms-providers";

export const config = { runtime: "nodejs", maxDuration: 15 };

/** Cuánto tiempo sirve datos el enlace del SMS desde que se envía. */
const CARD_LIFETIME_DAYS = 45;

/**
 * Tope de envíos por pedido, incluso pidiendo reenvío a mano. Es la red que
 * impide que una sesión olvidada en la tablet del mostrador —o un bucle
 * accidental— se coma el saldo y bombardee a un cliente. Cinco son de sobra:
 * el aviso, un par de reenvíos si algo falló, y margen.
 */
const MAX_SMS_POR_PEDIDO = Number(process.env.SMS_MAX_POR_PEDIDO ?? "5");

/** Espera mínima entre dos avisos del mismo pedido. */
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;

/**
 * Prefijos de país a los que se acepta enviar.
 *
 * El teléfono lo escribe quien rellena el formulario público, sin
 * autenticarse, y cada destino tiene un precio distinto: un número de
 * tarificación especial o por satélite puede costar varios euros por mensaje
 * en vez de cuatro céntimos. Se limita a lo que Dulce Flor usa de verdad.
 */
const PREFIJOS_PERMITIDOS = (process.env.SMS_PREFIJOS_PERMITIDOS ?? "+34")
  .split(",")
  .map((prefijo) => prefijo.trim())
  .filter(Boolean);

/**
 * ¿Tiene forma de JWT? Tres partes separadas por puntos y una longitud
 * razonable. Se mira ANTES de salir a la red: sin esto, cualquiera puede
 * lanzar miles de peticiones con basura en la cabecera y agotar el límite de
 * peticiones del servicio de autenticación, dejando al equipo sin poder
 * entrar en el panel justo cuando tiene pedidos que sacar.
 */
function pareceJwt(token: string): boolean {
  if (token.length < 40 || token.length > 4096) return false;
  const partes = token.split(".");
  return partes.length === 3 && partes.every((parte) => /^[A-Za-z0-9_-]+$/.test(parte));
}

interface Peticion {
  orderId?: unknown;
  /** true para reenviar un aviso ya enviado (lo pide la persona a mano). */
  force?: unknown;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Nada de esto debe quedarse en ninguna caché intermedia.
      "Cache-Control": "no-store",
    },
  });
}

function error(code: string, message: string, status: number, retriable = false): Response {
  return json({ ok: false, error: code, message, retriable }, status);
}

/** Fila que necesitamos del pedido. Se piden las columnas una a una: nunca
 *  un `select *`, que se traería el payload entero a un sitio donde no hace
 *  falta y acabaría en los registros si algo fallara. */
const COLUMNAS =
  "id, public_id, status, customer_name, customer_phone, requested_date, " +
  "requested_time, fulfillment_type, payload, customer_notified_at, " +
  "sms_opt_out, sms_sent_count";

interface FilaPedido {
  id: string;
  public_id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  requested_date: string;
  requested_time: string;
  fulfillment_type: string;
  payload: Record<string, unknown> | null;
  /** Columnas propias: el panel NO las pisa al subir la fila completa. */
  customer_notified_at: string | null;
  sms_opt_out: boolean | null;
  sms_sent_count: number | null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return error("metodo_no_permitido", "Este endpoint solo acepta POST.", 405);
    }

    const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim();
    const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY ?? "").trim();
    const siteUrl = (process.env.PUBLIC_SITE_URL ?? "").trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return error(
        "sin_configurar",
        "Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_ANON_KEY.",
        500
      );
    }
    if (!siteUrl) {
      return error(
        "sin_configurar",
        "Falta la variable de entorno PUBLIC_SITE_URL: sin ella el SMS no puede llevar el enlace de la ficha.",
        500
      );
    }

    // --- 1. ¿Quién llama? -------------------------------------------------
    const cabecera = request.headers.get("authorization") ?? "";
    const jwt = cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : "";
    if (!jwt || !pareceJwt(jwt)) {
      return error("sin_sesion", "Hace falta una sesión del panel para avisar al cliente.", 401);
    }

    // Cliente por petición, con la clave anon y el JWT de quien llama: todo
    // lo que haga a partir de aquí pasa por las mismas políticas que el panel.
    //
    // Ahí está la autorización, no solo la autenticación: desde
    // equipo-y-permisos.sql la política de lectura de `orders` exige
    // pertenecer a public.team_members. Alguien que se registre por su cuenta
    // queda autenticado pero no ve ningún pedido, así que aquí recibe un 404
    // y no se envía —ni se paga— ningún SMS. La lista del equipo es la única
    // fuente de verdad: no se duplica en una variable de entorno.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // getUser() pregunta al servidor de Supabase en vez de limitarse a
    // comprobar la firma: así una sesión cerrada o revocada deja de valer
    // inmediatamente. Son ~100 ms bien gastados antes de pagar un SMS.
    const { data: auth, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !auth?.user) {
      return error("sesion_invalida", "Tu sesión ha caducado. Vuelve a entrar en el panel.", 401);
    }

    // --- 2. Qué pedido ----------------------------------------------------
    let peticion: Peticion;
    try {
      peticion = (await request.json()) as Peticion;
    } catch {
      return error("json_invalido", "La petición no es un JSON válido.", 400);
    }
    const orderId = typeof peticion.orderId === "string" ? peticion.orderId.trim() : "";
    if (!orderId) {
      return error("sin_pedido", "No se ha indicado de qué pedido se trata.", 400);
    }
    const force = peticion.force === true;

    const { data: fila, error: readError } = await supabase
      .from("orders")
      .select(COLUMNAS)
      .eq("id", orderId)
      .maybeSingle<FilaPedido>();

    if (readError) {
      return error(
        "lectura_fallida",
        "No se ha podido leer el pedido en la base de datos.",
        502,
        true
      );
    }
    if (!fila) {
      return error("pedido_no_encontrado", "Ese pedido no está en la base de datos.", 404);
    }

    // --- 3. ¿Debemos enviar? ---------------------------------------------
    //
    // Las tres comprobaciones miran COLUMNAS, no el payload. El payload lo
    // reemplaza entero el panel cada vez que sube un pedido, así que una
    // tablet con una copia de hace diez minutos borraría estas marcas y el
    // sistema mandaría un segundo SMS pagado al mismo cliente.
    if (fila.sms_opt_out === true) {
      return error("sin_sms", "Este cliente ha pedido que no se le avise por SMS.", 409);
    }

    const enviadosAntes = fila.sms_sent_count ?? 0;
    if (enviadosAntes >= MAX_SMS_POR_PEDIDO) {
      return error(
        "tope_alcanzado",
        `Este pedido ya ha recibido ${enviadosAntes} SMS. No se envían más para no seguir cobrando envíos.`,
        429
      );
    }

    if (fila.customer_notified_at) {
      if (!force) {
        return error(
          "ya_avisado",
          "A este cliente ya se le avisó. Usa «volver a avisar» si quieres repetirlo.",
          409
        );
      }
      // Ni siquiera pidiendo reenvío se puede repetir al instante: es lo que
      // convierte un bucle accidental en una factura.
      const desdeElUltimo = Date.now() - new Date(fila.customer_notified_at).getTime();
      if (desdeElUltimo < ESPERA_ENTRE_ENVIOS_MS) {
        return error(
          "demasiado_pronto",
          "Acabas de avisar a este cliente. Espera un minuto antes de repetirlo.",
          429
        );
      }
    }

    const telefono = toE164(fila.customer_phone);
    if (!telefono.ok) {
      // 422: la petición es correcta, el dato del pedido no. Se responde
      // ANTES de llamar al proveedor, así que no se gasta nada.
      return error("telefono_invalido", PHONE_PROBLEM_MESSAGES[telefono.problem], 422);
    }
    if (!PREFIJOS_PERMITIDOS.some((prefijo) => telefono.e164.startsWith(prefijo))) {
      return error(
        "destino_no_permitido",
        `El teléfono del pedido es de un país al que no enviamos SMS (${telefono.e164.slice(
          0,
          4
        )}…). Avisa a este cliente por WhatsApp.`,
        422
      );
    }

    const setup = buildProvider(process.env);
    if (!setup.ok) return error("sin_configurar", setup.message, 500);

    // --- 4. El enlace -----------------------------------------------------
    // El token se genera aquí y solo se guarda su hash: la base de datos
    // nunca contiene la llave que abre la ficha.
    const token = newOrderToken();
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + CARD_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

    // El sello del aviso se escribe AQUÍ, en el mismo UPDATE que el enlace y
    // en columnas propias. Que lo escriba el servidor y no el navegador es lo
    // que hace que el freno anti-duplicado sea de fiar.
    const enviadoEn = new Date().toISOString();
    const { error: tokenError } = await supabase
      .from("orders")
      .update({
        card_token_hash: tokenHash,
        card_expires_at: expiresAt.toISOString(),
        customer_notified_at: enviadoEn,
        customer_notified_by: "sms",
        sms_sent_count: enviadosAntes + 1,
      })
      .eq("id", orderId);
    if (tokenError) {
      return error(
        "enlace_fallido",
        "No se ha podido preparar el enlace del pedido. No se ha enviado ningún SMS.",
        502,
        true
      );
    }

    // --- 5. El envío ------------------------------------------------------
    // El token va tras la almohadilla a propósito: el fragmento no viaja al
    // servidor, así que la llave del pedido no acaba en ningún registro.
    const cardUrl = `${siteUrl.replace(/\/+$/, "")}/mi-pedido#${token}`;
    const texto = buildOrderStatusSms(
      {
        publicId: fila.public_id,
        customerName: fila.customer_name,
        requestedDate: fila.requested_date,
        requestedTime: fila.requested_time,
        fulfillmentType: fila.fulfillment_type === "delivery" ? "delivery" : "pickup",
      },
      cardUrl
    );
    const coste = measureSms(texto);

    const resultado = await setup.provider.send({
      to: telefono.e164,
      text: texto,
      sender: setup.sender,
      reference: fila.public_id,
    });

    if (!resultado.ok) {
      return json(
        {
          ok: false,
          error: resultado.code,
          message: resultado.message,
          retriable: resultado.retriable,
        },
        // 502 si el fallo es del proveedor y puede reintentarse; 422 si el
        // problema es de datos o de cuenta y reintentar no arreglaría nada.
        resultado.retriable ? 502 : 422
      );
    }

    return json(
      {
        ok: true,
        cardUrl,
        segments: coste.segments,
        encoding: coste.encoding,
        provider: setup.provider.name,
        providerId: resultado.providerId,
        sentAt: enviadoEn,
      },
      200
    );
  },
};
