/**
 * Aviso por SMS al cliente, visto desde el panel.
 *
 * Este módulo NO envía el SMS: pide a la función serverless que lo haga. Las
 * claves del proveedor viven solo allí, porque todo lo que está en src/ acaba
 * dentro del JavaScript que se descarga cualquiera que entre en la web, y el
 * repositorio además es público.
 *
 * Su otro trabajo es convertir cualquier desenlace —sin conexión, sesión
 * caducada, teléfono fijo, sin saldo— en algo que la persona del mostrador
 * pueda leer y entender sin llamar a nadie.
 */
import { getAccessToken } from "./auth";
import { isSupabaseConfigured } from "./supabase";

export interface SmsSentOk {
  ok: true;
  /** Enlace a la ficha que ha recibido el cliente. */
  cardUrl: string;
  /** SMS facturados (un texto largo o con tildes raras cuesta más de uno). */
  segments: number;
  sentAt: string;
}

export interface SmsSentError {
  ok: false;
  /** Código corto, para distinguir casos sin comparar textos. */
  code: string;
  /** Mensaje en español pensado para enseñarse tal cual. */
  message: string;
  /** true si tiene sentido volver a intentarlo dentro de un rato. */
  retriable: boolean;
  /** true cuando el aviso ya se había enviado antes (no es un fallo real). */
  alreadySent?: boolean;
}

export type SmsResult = SmsSentOk | SmsSentError;

/** ¿Puede este despliegue enviar SMS? Sin Supabase no hay sesión que validar. */
export function isSmsAvailable(): boolean {
  return isSupabaseConfigured();
}

interface RespuestaServidor {
  ok?: unknown;
  error?: unknown;
  message?: unknown;
  retriable?: unknown;
  cardUrl?: unknown;
  segments?: unknown;
  sentAt?: unknown;
}

/**
 * Pide el envío del aviso de «pedido tramitado».
 *
 * `force` solo lo usa el botón de reenviar: sin él, el servidor se niega a
 * avisar dos veces del mismo pedido. Es a propósito — un doble clic o un
 * reintento del navegador no pueden convertirse en dos SMS pagados y dos
 * avisos al mismo cliente.
 */
export async function sendOrderSms(
  orderId: string,
  options: { force?: boolean } = {}
): Promise<SmsResult> {
  if (!isSmsAvailable()) {
    return {
      ok: false,
      code: "sin_configurar",
      message:
        "Este despliegue no tiene activado el envío de SMS. Avisa al cliente por WhatsApp.",
      retriable: false,
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return {
      ok: false,
      code: "sin_sesion",
      message: "Tu sesión ha caducado. Vuelve a entrar en el panel e inténtalo otra vez.",
      retriable: false,
    };
  }

  let response: Response;
  try {
    response = await fetch("/api/avisar-pedido", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, force: options.force === true }),
    });
  } catch {
    return {
      ok: false,
      code: "sin_conexion",
      message: "No hay conexión con el servidor. El SMS no se ha enviado.",
      retriable: true,
    };
  }

  let body: RespuestaServidor;
  try {
    body = (await response.json()) as RespuestaServidor;
  } catch {
    // Un 404 con HTML suele significar que las funciones no están desplegadas.
    return {
      ok: false,
      code: "respuesta_ilegible",
      message:
        response.status === 404
          ? "El servidor de envíos no está disponible en este despliegue."
          : "El servidor ha respondido algo inesperado. El SMS puede no haberse enviado.",
      retriable: true,
    };
  }

  if (response.ok && body.ok === true) {
    return {
      ok: true,
      cardUrl: typeof body.cardUrl === "string" ? body.cardUrl : "",
      segments: typeof body.segments === "number" ? body.segments : 1,
      sentAt: typeof body.sentAt === "string" ? body.sentAt : new Date().toISOString(),
    };
  }

  const code = typeof body.error === "string" ? body.error : `http_${response.status}`;
  return {
    ok: false,
    code,
    message:
      typeof body.message === "string" && body.message
        ? body.message
        : "No se ha podido enviar el SMS.",
    retriable: body.retriable === true,
    alreadySent: code === "ya_avisado",
  };
}
