/**
 * Este endpoint es el único del sistema que gasta dinero, así que lo que se
 * comprueba aquí no es tanto que funcione como que NO gaste cuando no debe:
 * sin sesión, con el cliente excluido, con un aviso ya enviado o con un
 * teléfono que no es un móvil. Cada uno de esos casos tiene que cortar ANTES
 * de llamar a la pasarela.
 *
 * La pasarela se sustituye por el modo `pruebas`, que no llama a nadie, y
 * Supabase por un doble configurable: así el circuito completo se recorre de
 * verdad sin tocar la base de datos real ni enviar un solo SMS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Lo que el doble de Supabase va a responder en cada prueba. */
interface EscenarioSupabase {
  usuario: { id: string } | null;
  pedido: Record<string, unknown> | null;
  errorLectura: boolean;
  errorActualizacion: boolean;
}

const escenario: EscenarioSupabase = {
  usuario: { id: "user-1" },
  pedido: null,
  errorLectura: false,
  errorActualizacion: false,
};

/** Lo que el endpoint ha intentado escribir, para poder comprobarlo. */
let actualizaciones: Array<Record<string, unknown>> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        escenario.usuario
          ? { data: { user: escenario.usuario }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            escenario.errorLectura
              ? { data: null, error: { message: "boom" } }
              : { data: escenario.pedido, error: null },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          actualizaciones.push(patch);
          return escenario.errorActualizacion ? { error: { message: "boom" } } : { error: null };
        },
      }),
    }),
  }),
}));

const { default: handler } = await import("./avisar-pedido");

/** Con forma de JWT (tres partes) para pasar el filtro barato previo. */
const JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJ1c2VyLTEifQ", "firma-de-mentira"].join(".");

const PEDIDO = {
  id: "11111111-2222-3333-4444-555555555555",
  public_id: "DF-2026-A1B2C",
  status: "confirmed",
  customer_name: "Ana Lopez",
  customer_phone: "600111222",
  requested_date: "2026-09-30",
  requested_time: "18:00",
  fulfillment_type: "pickup",
  payload: {},
  customer_notified_at: null,
  sms_opt_out: false,
  sms_sent_count: 0,
};

function peticion(body: unknown, { token = JWT }: { token?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  return new Request("https://dulceflorbcn.es/api/avisar-pedido", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function cuerpo(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  escenario.usuario = { id: "user-1" };
  escenario.pedido = { ...PEDIDO, payload: {} };
  escenario.errorLectura = false;
  escenario.errorActualizacion = false;
  actualizaciones = [];

  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_ANON_KEY = "clave-anon";
  process.env.PUBLIC_SITE_URL = "https://dulceflorbcn.es";
  process.env.SMS_PROVIDER = "pruebas";
  process.env.SMS_SENDER = "DulceFlor";
});

describe("quién puede llamar", () => {
  it("solo acepta POST", async () => {
    const res = await handler.fetch(
      new Request("https://dulceflorbcn.es/api/avisar-pedido", { method: "GET" })
    );
    expect(res.status).toBe(405);
  });

  it("sin cabecera de autorización no se envía nada", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }, { token: null }));
    expect(res.status).toBe(401);
    expect((await cuerpo(res)).error).toBe("sin_sesion");
  });

  it("descarta sin salir a la red lo que no tiene forma de JWT", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }, { token: "basura" }));
    expect(res.status).toBe(401);
    // No llega ni a preguntarle a Supabase: es lo que evita que miles de
    // peticiones con basura agoten el límite del servicio de autenticación
    // y dejen al equipo sin poder entrar al panel.
    expect(actualizaciones).toHaveLength(0);
  });

  it("con un token que Supabase rechaza, tampoco", async () => {
    escenario.usuario = null;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(401);
    expect((await cuerpo(res)).error).toBe("sesion_invalida");
    // Lo importante: no se ha llegado ni a preparar el enlace.
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("configuración incompleta", () => {
  it("sin Supabase configurado responde 500 diciendo qué falta", async () => {
    delete process.env.SUPABASE_URL;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(500);
    expect(String((await cuerpo(res)).message)).toContain("SUPABASE_URL");
  });

  it("sin PUBLIC_SITE_URL no se envía: el SMS quedaría sin enlace", async () => {
    delete process.env.PUBLIC_SITE_URL;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(500);
    expect(String((await cuerpo(res)).message)).toContain("PUBLIC_SITE_URL");
  });

  it("sin remitente configurado tampoco, y se detecta antes de tocar el enlace", async () => {
    delete process.env.SMS_SENDER;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(500);
    expect(String((await cuerpo(res)).message)).toContain("SMS_SENDER");
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("qué pedido", () => {
  it("sin orderId responde 400", async () => {
    const res = await handler.fetch(peticion({}));
    expect(res.status).toBe(400);
    expect((await cuerpo(res)).error).toBe("sin_pedido");
  });

  it("con un cuerpo que no es JSON responde 400 y no revienta", async () => {
    const res = await handler.fetch(
      new Request("https://dulceflorbcn.es/api/avisar-pedido", {
        method: "POST",
        headers: { Authorization: `Bearer ${JWT}`, "Content-Type": "application/json" },
        body: "{{{",
      })
    );
    expect(res.status).toBe(400);
  });

  it("si el pedido no existe responde 404", async () => {
    escenario.pedido = null;
    const res = await handler.fetch(peticion({ orderId: "otro" }));
    expect(res.status).toBe(404);
  });

  it("si la base de datos falla, lo dice como reintentable", async () => {
    escenario.errorLectura = true;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(502);
    expect((await cuerpo(res)).retriable).toBe(true);
  });
});

describe("todo lo que evita un gasto inútil", () => {
  it("respeta al cliente que ha pedido que no le avisen por SMS", async () => {
    escenario.pedido = { ...PEDIDO, sms_opt_out: true };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(409);
    expect((await cuerpo(res)).error).toBe("sin_sms");
    expect(actualizaciones).toHaveLength(0);
  });

  it("no avisa dos veces al mismo cliente", async () => {
    escenario.pedido = {
      ...PEDIDO,
      customer_notified_at: "2026-09-25T10:00:00.000Z",
      sms_sent_count: 1,
    };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(409);
    expect((await cuerpo(res)).error).toBe("ya_avisado");
    expect(actualizaciones).toHaveLength(0);
  });

  it("pero sí reenvía cuando se pide expresamente", async () => {
    escenario.pedido = {
      ...PEDIDO,
      customer_notified_at: "2026-09-25T10:00:00.000Z",
      sms_sent_count: 1,
    };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id, force: true }));
    expect(res.status).toBe(200);
    expect((await cuerpo(res)).ok).toBe(true);
  });

  it("no gasta un SMS en un teléfono fijo, y explica por qué", async () => {
    escenario.pedido = { ...PEDIDO, customer_phone: "931234567" };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(422);
    const body = await cuerpo(res);
    expect(body.error).toBe("telefono_invalido");
    expect(String(body.message)).toContain("móvil");
    expect(actualizaciones).toHaveLength(0);
  });

  it("si no se puede guardar el enlace, NO se envía el SMS", async () => {
    escenario.errorActualizacion = true;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(502);
    expect(String((await cuerpo(res)).message)).toContain("No se ha enviado");
  });
});

describe("topes que protegen la factura", () => {
  it("no pasa del tope de SMS por pedido ni pidiendo reenvío", async () => {
    escenario.pedido = {
      ...PEDIDO,
      customer_notified_at: "2026-09-01T10:00:00.000Z",
      sms_sent_count: 5,
    };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id, force: true }));
    expect(res.status).toBe(429);
    expect((await cuerpo(res)).error).toBe("tope_alcanzado");
    expect(actualizaciones).toHaveLength(0);
  });

  it("un reenvío inmediato se frena: es lo que convierte un bucle en una factura", async () => {
    escenario.pedido = {
      ...PEDIDO,
      customer_notified_at: new Date().toISOString(),
      sms_sent_count: 1,
    };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id, force: true }));
    expect(res.status).toBe(429);
    expect((await cuerpo(res)).error).toBe("demasiado_pronto");
    expect(actualizaciones).toHaveLength(0);
  });

  it("no envía a un país que no está en la lista permitida", async () => {
    // Un numero de tarificacion especial puede costar varios euros por
    // mensaje, y el telefono lo escribe quien rellena el formulario publico.
    escenario.pedido = { ...PEDIDO, customer_phone: "+8816 2233 4455" };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(422);
    expect((await cuerpo(res)).error).toBe("destino_no_permitido");
    expect(actualizaciones).toHaveLength(0);
  });

  it("el contador de envíos sube con cada aviso", async () => {
    escenario.pedido = { ...PEDIDO, sms_sent_count: 2 };
    await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(actualizaciones[0].sms_sent_count).toBe(3);
  });
});

describe("el envío correcto", () => {
  it("responde con el enlace, el coste y el momento del envío", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(200);
    const body = await cuerpo(res);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("pruebas");
    // Un aviso normal tiene que caber en un solo SMS facturado.
    expect(body.segments).toBe(1);
    expect(body.encoding).toBe("gsm7");
    // El token va tras la almohadilla: el fragmento no viaja al servidor, asi
    // que la llave del pedido no queda escrita en ningun registro de peticiones.
    expect(String(body.cardUrl)).toMatch(
      /^https:\/\/dulceflorbcn\.es\/mi-pedido#[2-9bcdfghjkmnpqrstvwxyz]{22}$/
    );
    expect(typeof body.sentAt).toBe("string");
  });

  it("es el SERVIDOR quien marca el aviso, no el navegador", async () => {
    // Si lo marcara el navegador, una tablet con la copia vieja del pedido
    // borraria la marca al subir la fila y saldria un segundo SMS pagado.
    await handler.fetch(peticion({ orderId: PEDIDO.id }));
    const guardado = actualizaciones[0];
    expect(typeof guardado.customer_notified_at).toBe("string");
    expect(guardado.customer_notified_by).toBe("sms");
  });

  it("guarda el HASH del token, nunca el token que viaja en el SMS", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    const body = await cuerpo(res);
    const token = String(body.cardUrl).split("#").pop()!;

    expect(actualizaciones).toHaveLength(1);
    const guardado = actualizaciones[0];
    const hash = String(guardado.card_token_hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Lo que se guarda no puede ser el token ni contenerlo.
    expect(hash).not.toContain(token);
    expect(JSON.stringify(guardado)).not.toContain(token);
  });

  it("el enlace caduca: se guarda una fecha futura", async () => {
    await handler.fetch(peticion({ orderId: PEDIDO.id }));
    const caduca = new Date(String(actualizaciones[0].card_expires_at)).getTime();
    expect(caduca).toBeGreaterThan(Date.now());
  });

  it("cada envío estrena token: dos avisos no comparten enlace", async () => {
    const primero = await cuerpo(await handler.fetch(peticion({ orderId: PEDIDO.id })));
    const segundo = await cuerpo(
      await handler.fetch(peticion({ orderId: PEDIDO.id, force: true }))
    );
    expect(primero.cardUrl).not.toBe(segundo.cardUrl);
    expect(actualizaciones[0].card_token_hash).not.toBe(actualizaciones[1].card_token_hash);
  });

  it("una entrega a domicilio también sale en un solo SMS", async () => {
    escenario.pedido = { ...PEDIDO, fulfillment_type: "delivery" };
    const body = await cuerpo(await handler.fetch(peticion({ orderId: PEDIDO.id })));
    expect(body.ok).toBe(true);
    expect(body.segments).toBe(1);
  });
});
