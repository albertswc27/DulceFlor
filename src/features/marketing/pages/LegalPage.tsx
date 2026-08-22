/**
 * Aviso legal y política de privacidad.
 *
 * Todo el contenido describe el funcionamiento REAL de esta web: qué datos se
 * piden, para qué y dónde se guardan. No se incluyen cláusulas genéricas ni
 * datos que Dulce Flor no haya confirmado.
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BUSINESS_MAPS_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  WHATSAPP_PHONE,
  WHATSAPP_PHONE_DISPLAY,
} from "@/config/business";
import { LEGAL } from "@/config/legal";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-primary">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <div className="container max-w-3xl py-12 sm:py-16">
      <p className="eyebrow">Información legal</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-primary sm:text-4xl">
        Aviso legal y privacidad
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última actualización: {LEGAL.lastUpdated}.
      </p>

      <Section title="Titular del sitio web">
        <ul className="space-y-1">
          <li>
            <strong>Nombre comercial:</strong> {LEGAL.tradeName}
          </li>
          {LEGAL.holderName && (
            <li>
              <strong>Titular:</strong> {LEGAL.holderName}
            </li>
          )}
          {LEGAL.holderTaxId && (
            <li>
              <strong>NIF:</strong> {LEGAL.holderTaxId}
            </li>
          )}
          <li>
            <strong>Domicilio:</strong>{" "}
            <a
              href={BUSINESS_MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {LEGAL.address}
            </a>
          </li>
          <li>
            <strong>Contacto:</strong>{" "}
            <a
              href={`https://wa.me/${WHATSAPP_PHONE}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              WhatsApp {WHATSAPP_PHONE_DISPLAY}
            </a>{" "}
            ·{" "}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Instagram {INSTAGRAM_HANDLE}
            </a>
          </li>
        </ul>
        <p>
          Esta web es un escaparate y un formulario de solicitud de pedidos de
          repostería artesanal. No es una tienda con pago online.
        </p>
      </Section>

      <Section title="Cómo funcionan los pedidos">
        <p>
          Al completar el formulario se genera una <strong>solicitud</strong> de
          pedido con un identificador propio y se abre WhatsApp con el resumen
          preparado para que lo envíes. Enviar la solicitud{" "}
          <strong>no implica que el pedido esté aceptado</strong>: Dulce Flor lo
          revisa y lo confirma personalmente por WhatsApp, incluidos el precio
          final de cualquier petición especial y los gastos de envío fuera de las
          zonas con tarifa fija.
        </p>
        <p>
          Los precios mostrados incluyen los impuestos aplicables. La web no
          realiza cobros: la paga y señal, cuando corresponde, y el importe
          restante se abonan por Bizum, transferencia o en la tienda.
        </p>
      </Section>

      <Section title="Qué datos pedimos y para qué">
        <p>
          Solo se solicitan los datos necesarios para preparar y entregar el
          pedido:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Nombre y teléfono:</strong> para identificar el pedido y
            poder contactar contigo.
          </li>
          <li>
            <strong>Email</strong> (opcional): como vía de contacto alternativa.
          </li>
          <li>
            <strong>Dirección</strong>: solo si eliges entrega a domicilio, para
            calcular la zona y llevar el pedido.
          </li>
          <li>
            <strong>Nombre de empresa</strong>: solo en pedidos de empresa.
          </li>
          <li>
            <strong>Textos e imágenes que aportes</strong> (dedicatoria, notas,
            fotografía de referencia): para elaborar lo que has pedido.
          </li>
        </ul>
        <p>
          No se recogen datos con fines publicitarios ni se ceden a terceros. La
          conversación posterior se realiza a través de WhatsApp, cuyo uso se
          rige por las condiciones de su propio proveedor.
        </p>
      </Section>

      <Section title="Dónde se guardan">
        <p>
          En esta versión de la web, la solicitud de pedido y las imágenes que
          adjuntes se almacenan <strong>en el almacenamiento local de tu propio
          navegador</strong> y en el dispositivo de la tienda donde se registre
          el pedido; no se envían a ningún servidor externo. Puedes eliminarlos
          en cualquier momento borrando los datos de navegación.
        </p>
        <p>
          Cuando la web incorpore un servidor de pedidos, este apartado se
          actualizará indicando el proveedor y los plazos de conservación.
        </p>
      </Section>

      <Section title="Cookies y almacenamiento">
        <p>
          Esta web <strong>no utiliza cookies publicitarias, de analítica ni de
          seguimiento</strong>. Únicamente emplea almacenamiento técnico del
          navegador, imprescindible para que funcione el pedido: recordar el
          borrador mientras lo completas, guardar la solicitud generada y
          mantener la sesión iniciada en la zona de administración. Al ser
          estrictamente necesario, no requiere banner de consentimiento.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Puedes solicitar el acceso, la rectificación o la supresión de tus
          datos, así como la retirada de cualquier imagen que hayas enviado,
          escribiendo por WhatsApp al {WHATSAPP_PHONE_DISPLAY}. Si consideras que
          tus datos no se han tratado correctamente, puedes dirigirte a la
          Agencia Española de Protección de Datos.
        </p>
      </Section>

      <Section title="Propiedad intelectual">
        <p>
          Las fotografías de producto y el logotipo pertenecen a {LEGAL.tradeName}.
          Las imágenes que envíes como referencia se utilizarán únicamente para
          preparar tu pedido.
        </p>
      </Section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link to="/pedido">Hacer un pedido</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
