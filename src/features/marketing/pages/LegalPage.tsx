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
  PHONE_CALLS,
  PHONE_CALLS_DISPLAY,
  WHATSAPP_PHONE,
  WHATSAPP_PHONE_DISPLAY,
} from "@/config/business";
import { LEGAL } from "@/config/legal";
import { isSupabaseConfigured } from "@/services/supabase";

/** Hay base de datos compartida: cambia dónde se guardan los pedidos. */
const SHARED_DATABASE = isSupabaseConfigured();

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
            <a href={`tel:+${PHONE_CALLS}`} className="underline underline-offset-4">
              Teléfono {PHONE_CALLS_DISPLAY}
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
            <strong>Nombre y teléfono:</strong> para identificar el pedido,
            poder contactar contigo y enviarte el aviso de que está tramitado
            (por SMS o WhatsApp).
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
          No se recogen datos con fines publicitarios ni se venden ni se ceden a
          nadie para sus propios fines. Sí intervienen proveedores que trabajan
          por cuenta de Dulce Flor y siguiendo sus instrucciones (alojamiento de
          los pedidos y envío de los SMS), que se detallan más abajo. La
          conversación posterior se realiza a través de WhatsApp, cuyo uso se
          rige por las condiciones de su propio proveedor.
        </p>
      </Section>

      <Section title="Dónde se guardan">
        {/* Este texto describe lo que hace de verdad la web según esté o no
            conectada a la base de datos compartida. Si algún día se cambia de
            proveedor, hay que actualizarlo aquí. */}
        {SHARED_DATABASE ? (
          <>
            <p>
              Tu solicitud de pedido se guarda en una base de datos alojada por{" "}
              <strong>Supabase</strong>, que actúa como encargado del
              tratamiento por cuenta de Dulce Flor. Es lo que permite que el
              pedido llegue al obrador aunque lo hagas desde tu propio móvil.
            </p>
            <p>
              Solo el personal de Dulce Flor, tras iniciar sesión, puede
              consultar los pedidos: la base de datos rechaza cualquier lectura
              que no venga de una sesión autorizada.
            </p>
            <p>
              Las <strong>imágenes de referencia</strong> que adjuntes se guardan
              en un almacén privado del mismo proveedor, para que el obrador
              pueda verlas al preparar tu encargo. No son públicas: solo se
              pueden abrir desde una sesión del equipo y con un enlace temporal.
            </p>
            <p>
              Los pedidos se conservan mientras sean necesarios para gestionar
              el encargo y atender obligaciones legales o reclamaciones. Puedes
              pedir su supresión escribiendo por WhatsApp al{" "}
              {WHATSAPP_PHONE_DISPLAY}.
            </p>
          </>
        ) : (
          <>
            <p>
              En esta versión de la web, la solicitud de pedido y las imágenes
              que adjuntes se almacenan <strong>en el almacenamiento local de tu
              propio navegador</strong> y en el dispositivo de la tienda donde se
              registre el pedido; no se envían a ningún servidor externo. Puedes
              eliminarlos en cualquier momento borrando los datos de navegación.
            </p>
            <p>
              Cuando la web incorpore un servidor de pedidos, este apartado se
              actualizará indicando el proveedor y los plazos de conservación.
            </p>
          </>
        )}
      </Section>

      <Section title="Avisos por SMS sobre tu pedido">
        <p>
          Cuando damos tu pedido por tramitado, el sistema te envía un SMS al
          teléfono que nos indicaste. El mensaje lleva el nombre de la tienda, el
          número de pedido, el día y la hora de recogida o entrega, y un enlace a
          una ficha donde puedes consultar el detalle y las condiciones.
        </p>
        <p>
          <strong>Ese SMS no es publicidad</strong>: es una comunicación de
          servicio necesaria para gestionar el encargo que nos has hecho. Su base
          jurídica es el artículo 6.1.b del Reglamento (UE) 2016/679 —ejecución
          del contrato en el que eres parte—, así que no necesitamos tu
          consentimiento previo, y tampoco le resulta aplicable la prohibición
          del artículo 21 de la Ley 34/2002, que se refiere solo a las
          comunicaciones publicitarias o promocionales.
        </p>
        <p>
          No te enviaremos por SMS ofertas, promociones ni novedades. Si algún
          día quisiéramos hacerlo, te lo pediríamos antes y podrías negarte.
        </p>
        <p>
          El envío material lo realiza una empresa de mensajería SMS que actúa
          como <strong>encargada del tratamiento</strong> por cuenta de Dulce
          Flor, con contrato conforme al artículo 28 del Reglamento, y que solo
          recibe tu número y el texto del mensaje.
        </p>
        <p>
          <strong>El enlace de la ficha es privado y temporal.</strong> Solo
          funciona con la dirección exacta que recibes en el SMS, muestra
          únicamente lo necesario para recoger el pedido —nunca tu teléfono, tu
          dirección, tu dedicatoria ni las imágenes que hayas adjuntado— y deja
          de funcionar pasadas unas semanas. No está indexado en buscadores.
        </p>
        <p>
          Si prefieres que no te avisemos por SMS, dínoslo al hacer el pedido o
          por WhatsApp al {WHATSAPP_PHONE_DISPLAY}: lo anotamos y te avisaremos
          solo por WhatsApp o por teléfono. No recibir el SMS no afecta en nada a
          tu pedido.
        </p>
      </Section>

      <Section title="Imágenes generadas con inteligencia artificial">
        <p>
          Al configurar una tarta puedes pedir que una{" "}
          <strong>inteligencia artificial</strong> te enseñe una idea aproximada
          de cómo podría quedar. Esas imágenes las genera{" "}
          <strong>Google</strong> (modelo Gemini) por cuenta de Dulce Flor, como
          encargado del tratamiento y con contrato conforme al artículo 28 del
          Reglamento (UE) 2016/679.
        </p>
        <p>
          <strong>La imagen es orientativa y está generada por un ordenador</strong>,
          no es una fotografía de tu tarta ni el aspecto final garantizado. Se
          identifica como tal sobre la propia imagen, y para poder adjuntarla al
          pedido tienes que aceptarlo expresamente. La tarta real la hacemos a
          mano: el tono de los colores, la forma de las flores y los detalles
          varían.
        </p>
        <p>
          Qué se envía a Google: el acabado y los colores que eliges, y el texto
          corto que escribas describiendo el tema o los motivos. <strong>No se
          envía tu nombre, ni tu teléfono, ni la dedicatoria de la tarta</strong>:
          las tartas se generan con una placa en blanco y el texto lo escribimos
          nosotros después. Por eso te pedimos que en ese campo describas solo la
          decoración, sin datos personales.
        </p>
        <p>
          La base jurídica es tu propia petición en el marco de la preparación
          del pedido (artículo 6.1.b del Reglamento). Usar el generador es
          voluntario: puedes hacer el pedido sin él, o adjuntar una fotografía
          tuya de referencia.
        </p>
        <p>
          Google presta el servicio desde fuera del Espacio Económico Europeo, y
          la transferencia se ampara en las garantías de su contrato de
          tratamiento de datos. En el nivel contratado, Google{" "}
          <strong>no utiliza lo que se le envía para entrenar sus modelos</strong>;
          solo conserva los envíos un tiempo limitado para detectar usos
          abusivos.
        </p>
        <p>
          La imagen que elijas se guarda junto a tu pedido —igual que una
          fotografía de referencia— para que el obrador sepa qué tienes en mente,
          y se conserva el mismo tiempo que el pedido.
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
