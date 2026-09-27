/**
 * El SMS se paga por unidad y llega a un cliente real: un número mal
 * normalizado es dinero tirado y un aviso que nadie recibe, y un acento
 * inesperado duplica la factura sin avisar. De ahí que ambas cosas se fijen
 * aquí con casos concretos.
 */
import { describe, expect, it } from "vitest";
import { buildOrderStatusSms, measureSms, toE164, toGsm7Friendly } from "./sms";

describe("toE164", () => {
  it("acepta el móvil tal como lo escribe la gente", () => {
    for (const raw of [
      "600111222",
      "600 111 222",
      "600-111-222",
      "+34 600 111 222",
      "0034600111222",
      "34600111222",
      "(+34) 600 11 12 22",
    ]) {
      expect(toE164(raw)).toEqual({
        ok: true,
        e164: "+34600111222",
        national: "600111222",
      });
    }
  });

  it("admite móviles que empiezan por 7", () => {
    expect(toE164("711222333")).toMatchObject({ ok: true, e164: "+34711222333" });
  });

  it("rechaza un fijo español: no recibe SMS y el envío se pagaría igual", () => {
    expect(toE164("931234567")).toEqual({ ok: false, problem: "no-es-movil" });
    expect(toE164("+34 912 345 678")).toEqual({ ok: false, problem: "no-es-movil" });
  });

  it("rechaza vacíos y longitudes imposibles", () => {
    expect(toE164("")).toEqual({ ok: false, problem: "vacio" });
    expect(toE164(undefined)).toEqual({ ok: false, problem: "vacio" });
    expect(toE164("sin dígitos")).toEqual({ ok: false, problem: "vacio" });
    expect(toE164("600111")).toEqual({ ok: false, problem: "demasiado-corto" });
    expect(toE164("+34600111222333444")).toEqual({ ok: false, problem: "demasiado-largo" });
  });

  it("un número extranjero con su prefijo pasa sin que le apliquemos reglas españolas", () => {
    // Portugal: 9 dígitos nacionales y prefijo 351. Sin el prefijo lo
    // tomaríamos por español; con él debe respetarse tal cual.
    expect(toE164("+351912345678")).toEqual({
      ok: true,
      e164: "+351912345678",
      national: "351912345678",
    });
  });

  it("nueve dígitos sin prefijo se asumen españoles", () => {
    expect(toE164("612345678")).toMatchObject({ ok: true, e164: "+34612345678" });
  });
});

describe("measureSms", () => {
  it("un texto corriente cabe en un SMS de 160", () => {
    const cost = measureSms("Dulce Flor: tu pedido DF-2026-A1B2C esta tramitado.");
    expect(cost.encoding).toBe("gsm7");
    expect(cost.segments).toBe(1);
    expect(cost.remaining).toBeGreaterThan(0);
  });

  it("160 caracteres son 1 SMS y 161 ya son 2", () => {
    expect(measureSms("a".repeat(160)).segments).toBe(1);
    expect(measureSms("a".repeat(161)).segments).toBe(2);
    // Al concatenar, cada trozo pierde 7 caracteres de cabecera: 153, no 160.
    expect(measureSms("a".repeat(306)).segments).toBe(2);
    expect(measureSms("a".repeat(307)).segments).toBe(3);
  });

  // Trampa cara y poco conocida: el alfabeto GSM-7 incluye é, è, à, ñ, ü, ö,
  // ¡ y ¿, pero NO incluye á, í, ó ni ú. Una sola de esas vocales convierte el
  // mensaje entero a Unicode y lo deja en 70 caracteres por SMS, es decir,
  // duplica la factura. Por eso el texto del aviso se redacta sin ellas.
  it("é, ñ, ü, ¡ y ¿ caben en GSM-7", () => {
    const cost = measureSms("¡Recogida el miércoles! Año, ñ, ü, é, à, ¿vale?");
    expect(cost.encoding).toBe("gsm7");
    expect(cost.offenders).toEqual([]);
  });

  it("á, í, ó y ú NO caben: cada una tira el mensaje a Unicode", () => {
    for (const vocal of ["á", "í", "ó", "ú"]) {
      const cost = measureSms(`Recogida el sab${vocal}do`);
      expect(cost.encoding).toBe("unicode");
      expect(cost.offenders).toContain(vocal);
    }
  });

  it("el mismo texto cuesta el doble solo por una tilde de más", () => {
    const seguro = measureSms("Recogida el 24 de septiembre. " + "a".repeat(100));
    const caro = measureSms("Recogida el 24 de septiembre. á" + "a".repeat(99));
    expect(seguro.segments).toBe(1);
    expect(caro.segments).toBe(2);
  });

  it("una emoji tira el mensaje a Unicode y lo deja en 70 caracteres", () => {
    const cost = measureSms("Tu tarta está lista 🎂");
    expect(cost.encoding).toBe("unicode");
    expect(cost.offenders).toContain("🎂");
    expect(cost.segments).toBe(1);
    expect(measureSms("🎂" + "a".repeat(80)).segments).toBe(2);
  });

  it("los caracteres extendidos ocupan dos: un texto con muchos [ ] se pasa antes", () => {
    expect(measureSms("[".repeat(80)).length).toBe(160);
    expect(measureSms("[".repeat(80)).segments).toBe(1);
    expect(measureSms("[".repeat(81)).segments).toBe(2);
  });

  it("nunca devuelve 0 segmentos, ni con el texto vacío", () => {
    expect(measureSms("").segments).toBe(1);
  });
});

describe("toGsm7Friendly", () => {
  it("cambia la tipografía elegante por su equivalente de teclado", () => {
    expect(toGsm7Friendly("“Hola” — es un ‘saludo’…")).toBe('"Hola" - es un \'saludo\'...');
  });

  it("lo que arregla deja de costar Unicode", () => {
    const original = "Pedido “DF-1” — listo…";
    expect(measureSms(original).encoding).toBe("unicode");
    expect(measureSms(toGsm7Friendly(original)).encoding).toBe("gsm7");
  });

  it("NO toca los acentos: el nombre del cliente se escribe bien", () => {
    expect(toGsm7Friendly("Andrés Muñoz")).toBe("Andrés Muñoz");
  });
});

describe("buildOrderStatusSms", () => {
  const PEDIDO = {
    publicId: "DF-2026-A1B2C",
    customerName: "Ana Lopez Ruiz",
    requestedDate: "2026-09-24",
    requestedTime: "18:00",
    fulfillmentType: "pickup" as const,
  };
  const URL = "https://dulceflorbcn.es/mi-pedido/bcdfghjkmnpqrstvwxyz2";

  it("dice lo imprescindible: quién, qué pedido, cuándo y dónde mirar", () => {
    const texto = buildOrderStatusSms(PEDIDO, URL);
    expect(texto).toContain("Ana");
    expect(texto).toContain("DF-2026-A1B2C");
    expect(texto).toContain("tramitado");
    expect(texto).toContain("24/09");
    expect(texto).toContain("18:00");
    expect(texto).toContain(URL);
  });

  // Este es el test que de verdad importa: si alguien reescribe el mensaje y
  // mete una tilde prohibida o se pasa de largo, la factura se duplica en
  // silencio. Que falle aquí es mucho más barato que descubrirlo en la factura.
  it("cabe en UN solo SMS y no se sale de GSM-7", () => {
    const coste = measureSms(buildOrderStatusSms(PEDIDO, URL));
    expect(coste.encoding).toBe("gsm7");
    expect(coste.offenders).toEqual([]);
    expect(coste.segments).toBe(1);
  });

  it("sigue cabiendo con un nombre largo y en entrega a domicilio", () => {
    const coste = measureSms(
      buildOrderStatusSms(
        {
          ...PEDIDO,
          customerName: "Maria del Carmen Fernandez de la Torre",
          fulfillmentType: "delivery",
        },
        URL
      )
    );
    expect(coste.segments).toBe(1);
  });

  it("habla de entrega cuando es a domicilio y de recogida cuando es en tienda", () => {
    expect(buildOrderStatusSms(PEDIDO, URL)).toContain("Recogida 24/09");
    expect(buildOrderStatusSms({ ...PEDIDO, fulfillmentType: "delivery" }, URL)).toContain(
      "Entrega 24/09"
    );
  });

  it("solo usa el nombre de pila: el apellido no aporta y ocupa", () => {
    expect(buildOrderStatusSms(PEDIDO, URL)).not.toContain("Lopez");
  });

  it("un nombre con tilde prohibida se escribe BIEN aunque cueste otro segmento", () => {
    // Preferimos escribir «Sofía» correctamente y pagar dos segmentos antes que
    // mandarle a alguien su nombre mal escrito para ahorrar un céntimo.
    const texto = buildOrderStatusSms({ ...PEDIDO, customerName: "Sofía Marín" }, URL);
    expect(texto).toContain("Sofía");
    expect(measureSms(texto).encoding).toBe("unicode");
  });
});

describe("margen del SMS frente a cambios de dominio", () => {
  // El enlace es la parte más larga del mensaje. El dominio es dulceflorbcn.es
  // (confirmado el 26/09/2026), pero aquí se prueba con el prefijo «www.»
  // incluido y con el nombre de pila más largo que admitimos: así queda margen
  // por si algún día se sirve desde el subdominio. Si deja de caber, que lo
  // diga este test y no la factura.
  it("cabe en un SMS con el dominio completo y un nombre de pila de 12 caracteres", () => {
    const texto = buildOrderStatusSms(
      {
        publicId: "DF-2026-A1B2C",
        customerName: "Inmaculada Concepcion",
        requestedDate: "2026-12-24",
        requestedTime: "20:30",
        fulfillmentType: "delivery",
      },
      "https://www.dulceflorbcn.es/mi-pedido#bcdfghjkmnpqrstvwxyz2"
    );
    const coste = measureSms(texto);
    expect(coste.segments).toBe(1);
    expect(coste.remaining).toBeGreaterThanOrEqual(10);
  });
});

describe("nombres que rompen el recorte", () => {
  const BASE = {
    publicId: "DF-2026-A1B2C",
    requestedDate: "2026-09-30",
    requestedTime: "18:00",
    fulfillmentType: "pickup" as const,
  };
  const URL = "https://www.dulceflorbcn.es/mi-pedido#bcdfghjkmnpqrstvwxyz2";

  it("un nombre con emoji no se parte por la mitad", () => {
    // Recortar con slice dejaria medio caracter —un sustituto suelto— y el
    // proveedor rechazaria el mensaje por «caracteres no validos»: el aviso no
    // saldria y nadie sabria por que. Se recorta por puntos de codigo.
    const texto = buildOrderStatusSms(
      { ...BASE, customerName: "Mariaisabel\u{1F382}Perez" },
      URL
    );
    const sueltos = [...texto].filter((c) => {
      const p = c.codePointAt(0)!;
      return p >= 0xd800 && p <= 0xdfff;
    });
    expect(sueltos).toEqual([]);
    expect(JSON.parse(JSON.stringify(texto))).toBe(texto);
  });

  it("aguanta un nombre de una sola letra", () => {
    const texto = buildOrderStatusSms({ ...BASE, customerName: "A" }, URL);
    expect(texto).toContain("A, pedido");
    expect(measureSms(texto).segments).toBe(1);
  });

  it("aguanta un nombre vacio sin dejar el mensaje ilegible", () => {
    const texto = buildOrderStatusSms({ ...BASE, customerName: "   " }, URL);
    expect(texto).toContain("DF-2026-A1B2C");
    expect(texto).toContain("tramitado");
    expect(measureSms(texto).segments).toBe(1);
  });
});
