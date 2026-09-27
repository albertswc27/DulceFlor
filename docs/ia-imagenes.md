# Generador de imágenes con IA

En el configurador de tartas, la clienta elige acabado y colores, escribe un
tema si quiere, y una IA le enseña **dos** ideas aproximadas. Si le gusta una,
se adjunta al pedido para que el obrador sepa qué tiene en mente.

---

## Lo primero: por qué esto es sobre todo un problema legal

Una imagen de una tarta generada por IA **no es un adorno**. Tiene tres
consecuencias jurídicas reales, y el diseño de la funcionalidad está construido
alrededor de ellas. Si alguien las «simplifica» en el futuro, esto deja de estar
protegido.

### 1. Hay que decir que es artificial, encima de cada imagen

El artículo 50.4 del Reglamento europeo de IA es aplicable **desde el 2 de
agosto de 2026**. Las directrices de la Comisión ponen como ejemplo expreso de
contenido que hay que declarar «una imagen de producto generada por IA que pueda
inducir a error sobre la apariencia real del producto». Una tarta fotorrealista
que no existe encaja de lleno.

Y no vale de cualquier manera: la Comisión **excluye expresamente** apoyarse en
los metadatos del proveedor, los iconos que hay que pulsar, los menús anidados y
los términos de uso. Tiene que verse sin hacer nada, **en cada imagen**.

Por eso la etiqueta «Imagen generada con IA · orientativa» va superpuesta sobre
la propia imagen, y se repite en el carrito, en el panel y en el WhatsApp que
recibe la tienda.

### 2. La casilla no es burocracia: es lo único que protege

En derecho de consumo español, una imagen enseñada antes de contratar puede
funcionar como **«muestra o modelo»** del pedido (art. 115 ter.1.b del
TRLGDCU), y entonces la tarta que no se le parece es *falta de conformidad*, con
tres años de responsabilidad. Una cláusula general de exoneración sería nula
(art. 86.1).

Lo que sí funciona es el art. 115 ter.5: **información específica sobre en qué va
a diferir + aceptación expresa y por separado**. De ahí la casilla, que:

- **no viene marcada** (si se premarca, deja de valer),
- dice en qué va a diferir concretamente (tono de los colores, forma de las
  flores, detalles),
- se vuelve a desmarcar con cada imagen nueva,
- y bloquea el botón de adjuntar hasta que se marca.

### 3. Formación del personal (art. 4 del Reglamento de IA)

Obligatorio desde febrero de 2025. Basta con la nota de una página que hay al
final de este documento, leída y firmada por quien atiende los pedidos.

> Régimen sancionador: en España todavía no está en vigor (el proyecto de ley
> sigue en enmiendas). Pero la **Agència Catalana del Consum** sí puede
> sancionar hoy las prácticas engañosas, de 10.001 a 100.000 €, y Santa Coloma
> está en su ámbito.

---

## Lo segundo: que la tarta se pueda hacer de verdad

El riesgo de producto número uno es que la IA genere una tarta preciosa de
estilo americano que el obrador no sabe ni puede reproducir. Tres mitigaciones,
por orden de eficacia:

1. **El texto libre NO decide la arquitectura de la tarta.** El acabado sale de
   una lista cerrada —nata, buttercream, fondant—, los colores de una paleta
   cerrada, y el texto libre solo modula tema y motivos, con tope de 120
   caracteres. Va al final del prompt y etiquetado como «decoración pedida por
   el cliente», de modo que no puede reescribir lo anterior.
2. **Tres fotos reales suyas en cada petición**, de la misma familia que ha
   elegido la clienta, como referencia de estilo. Salen de las que ya estaban en
   la web y viven en `public/referencias-ia/` (`node scripts/referencias-ia.cjs`
   las regenera si se cambian).
3. **La instrucción fija** pide explícitamente tarta artesanal, como mucho dos
   pisos bajos, y prohíbe las esculturas de azúcar y los acabados industriales.

Además, **la IA no escribe texto sobre la tarta**: se le pide una placa de
chocolate blanco en blanco. Los modelos escriben mal y corregirlo gastaría la
segunda generación — pero sobre todo, así la dedicatoria (que suele llevar el
nombre y la edad de un niño) **nunca sale hacia el proveedor**.

---

## Proveedor y coste

**Google Gemini 3.1 Flash Lite Image.**

| | Lite (el que usamos) | Estándar | Pro |
| --- | --- | --- | --- |
| Coste por imagen | ~2,9 c | ~5,9 c | ~11,8 c |
| Latencia | ~4 s | ~13 s | — |

Con 2 imágenes por pedido: **unos 6 céntimos por pedido**. Entre 1,50 € y 6 € al
mes en un escenario de 50 a 200 imágenes.

Se eligió por la referencia de estilo: es el único que documenta admitir varias
fotos de referencia en la misma petición, que es justo el requisito que hace que
lo generado se parezca a lo entregable.

**Hay que usar una clave con facturación activada.** En el nivel gratuito Google
usa lo enviado para mejorar sus productos y revisores humanos pueden leerlo.

Descartado Black Forest Labs pese a ser europea: su política dice que pueden
entrenar con los textos y las imágenes que se les envían, y aquí el texto lo
escribe un desconocido.

---

## Control de gasto

Quien llama es **anónimo**: es el punto más expuesto del sistema. Tres
contadores atómicos en Supabase, comprobados **antes** de llamar al proveedor y
devueltos si la generación falla:

| Puerta | Límite | Ventana |
| --- | --- | --- |
| Por sesión de configuración | 2 | 6 h |
| Por cliente y día | 6 | 24 h |
| **Por tienda y día** | **40** (`AI_IMAGE_DAY_LIMIT`) | 24 h |

La tercera es la que importa: pase lo que pase —un bot, un fallo nuestro, un
enlace compartido en un foro— el gasto del día está acotado. A 3 céntimos la
imagen, 40 son 1,20 €.

Contar en el navegador no serviría (se borra) y en el pedido tampoco, porque el
pedido todavía no existe cuando esto se usa.

De la IP **no se guarda nada**: se guarda un HMAC con una sal de servidor y la
fecha, así que la clave cambia cada día y no se puede volver de ella a nadie.

**Endurecimiento recomendado cuando haya tráfico real**, por orden de valor:

1. Regla de Firewall en Vercel: `/api/generar-imagen` + POST → rate limit por IP,
   8 peticiones cada 600 s. Se publica primero en modo «Log» un día, luego
   «Deny». El tráfico bloqueado ahí ni siquiera invoca la función.
2. Tope de gasto en la propia cuenta de Google.
3. BotID de Vercel dentro del handler, si aparecen bots.

---

## Variables de entorno

Ninguna con prefijo `VITE_`: el repositorio es público.

| Variable | Qué es |
| --- | --- |
| `IA_PROVEEDOR` | `gemini` o `pruebas` |
| `GEMINI_API_KEY` | Clave de Google AI Studio, **con facturación activada** |
| `IA_MODELO` | Opcional, `gemini-3.1-flash-lite-image` por defecto |
| `AI_IMAGE_IP_SALT` | Cadena larga al azar. Cambiarla reinicia los contadores del día |
| `AI_IMAGE_DAY_LIMIT` | Opcional, 40 por defecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo esta función la necesita: los contadores están cerrados a la clave pública |

Base de datos: `supabase/imagen-ia.sql`, después de los otros tres.

---

## Lo que falta confirmar con una llamada real

La forma exacta de la respuesta de la API de Gemini **no está verificada contra
el servicio real**. El código la lee buscando la imagen en el árbol JSON en vez
de por una ruta fija, precisamente para que un cambio de nombre de campo no
tumbe el generador, pero la primera llamada con clave real hay que mirarla.

Igual pasa con el identificador de interacción que permite editar la imagen: si
no llegara, el refinado generaría una imagen nueva en vez de modificar la
anterior. Funcionaría, pero peor.

Con `IA_PROVEEDOR=pruebas` todo lo demás —cupos, guardado, etiquetado, la
casilla, el pedido— se puede verificar sin clave y sin gastar.

---

## Nota para el personal (art. 4 del Reglamento de IA)

*Imprimir, leer y firmar. Es el documento que habría que enseñar en una
inspección.*

> **Qué hace la web.** Cuando una clienta configura una tarta, puede pedir que
> un programa de inteligencia artificial le enseñe una imagen de cómo podría
> quedar. Puede pedir hasta dos.
>
> **Qué NO es esa imagen.** No es una fotografía de una tarta que exista, ni de
> la que vamos a hacer. La ha dibujado un ordenador a partir de unas pocas
> indicaciones. La web se lo dice a la clienta y ella tiene que marcar una
> casilla aceptándolo antes de poder adjuntarla.
>
> **Qué llega al obrador.** La imagen aparece en el pedido marcada como
> «generada con IA», junto al texto de lo que pidió. Sirve para entender qué
> tiene en mente: colores, estilo, motivos. No es un plano a reproducir.
>
> **Qué hacer si no se puede hacer así.** Llamar o escribir a la clienta ANTES
> de preparar la tarta y acordar qué se hace. Es preferible una llamada de dos
> minutos a una discusión en el mostrador.
>
> **Qué responder si reclama que no se parece.** Que la imagen era orientativa,
> que lo aceptó al hacer el pedido, y ofrecer una solución. Nunca discutir sobre
> si «la máquina lo prometió»: la máquina no promete nada y así está escrito.
>
> Fecha: ____________  Firma: ____________
