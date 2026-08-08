# ChatBot Creator

Plataforma **propia** (tipo Botpress, no Botpress) para **diseñar y simular** flujos
conversacionales: un lienzo de nodos/tarjetas conectados por flechas, que puedes
**crear, mover, conectar, editar y borrar**, y un **simulador de chat** que ejecuta el
flujo que diseñaste.

Stack: **React + React Flow** (Vite). **Todo corre en Docker** — no se instala nada
(Node, npm, dependencias) en tu Mac.

> La plataforma es **genérica**: sirve para cualquier bot. Trae un flujo de ejemplo
> (`src/flow/seedFlow.js`) para que el lienzo no arranque vacío; puedes borrarlo o
> reemplazarlo por el tuyo.

## Dónde está desplegado

Producción en AWS (us-west-2), como sitio estático con login:
**https://dev.sebasgomezrubio.com** — S3 privado + CloudFront + Cognito, sin
backend ni base de datos. El acceso es un formulario propio dentro de la app
(sin saltar al Hosted UI de Amazon). Detalles y despliegue en [`infra/`](./infra).

## Cómo correrlo (localhost)

Necesitas solo **Docker**.

```bash
docker compose up --build      # la 1ª vez (instala deps dentro del contenedor)
# luego abre  http://localhost:5174
```

Para apagarlo: `Ctrl+C`, y opcionalmente `docker compose down`.
Siguientes veces basta `docker compose up` (sin `--build`).
Si cambias `package.json` (nuevas dependencias): `docker compose up --build`.

## Qué puedes hacer

**Portada** — al abrir la app ves tus flujos, no un lienzo suelto.
- Tarjeta por flujo con sus pasos, conexiones, los tipos de tarjeta que usa y
  cuándo lo editaste; se abre con un clic.
- **Nuevo flujo** (lienzo en blanco), **Importar** un JSON, y por flujo:
  renombrar, duplicar y borrar (con confirmación propia, no la del navegador).
- Sección **Próximamente** con lo que viene: publicar en la Cloud API, webhooks
  entrantes, variables y contexto, analítica, plantillas de Meta e historial.
- Todo se guarda en el navegador (localStorage) con **un documento por flujo**:
  la portada solo lee un índice de metadatos (~0,2 KB) y el autoguardado escribe
  únicamente el flujo abierto, no los demás. Lo que tuvieras guardado antes se
  migra solo la primera vez.

**Editor** — lienzo oscuro con retícula de puntos, tarjetas suaves y cápsulas de
Inicio/Fin, al estilo de los constructores de flujos modernos.
- **Crear** un paso: arrástralo desde la paleta izquierda, o haz **clic derecho**
  sobre el lienzo y elígelo en el menú contextual (se crea donde apuntaste).
- **Conectar** pasos: arrastra desde el punto inferior de un nodo al superior de otro.
- **Editar** un paso o conexión: selecciónalo → panel derecho. El formulario es el
  de su tipo de tarjeta, con los límites de Meta y una **vista previa en vivo** —
  fija arriba del panel— que muestra cómo se verá el mensaje en WhatsApp mientras
  escribes (en las listas, el botón despliega sus filas como la hoja real).
- **Clic derecho** sobre un nodo → duplicar o borrar; sobre una conexión → borrar.
- **Borrar**: selecciona y pulsa `Supr`/`Backspace`, o el botón del inspector.
- **Auto-organizar** (layout jerárquico automático) — por encima de 40 pasos se
  calcula **en AWS**, no en tu equipo; si el motor no responde, se hace en local.
- **Analizar** — revisa el flujo entero en la nube: pasos inalcanzables,
  callejones sin salida, salidas sin conectar y tarjetas que Meta rechazaría.
- **Ajustar**, controles de zoom
  flotantes con porcentaje y paleta plegable.
- Dos **interruptores de rendimiento** en los controles del lienzo, ambos con la
  preferencia recordada:
  - **▣ Minimapa** — redibuja todos los nodos en cada movimiento de la vista;
    arranca apagado por encima de 60 pasos.
  - **⚡ Modo ligero** — monta **solo los nodos visibles** (en un flujo de 103
    pasos, ~25 en vez de 103: 76 % menos DOM), dibuja las aristas sin etiqueta y,
    al alejar el zoom, quita el texto de las tarjetas. Arranca activo por encima
    de 60 pasos u 80 conexiones. Solo cambia el dibujo: al guardar, exportar y
    simular está todo. Si algún día el lienzo se ve vacío, apágalo con ⚡.
- **Reiniciar** abre un diálogo con dos salidas: **vaciar el lienzo** o volver al
  **flujo de ejemplo**.
- **Exportar / Importar** el flujo como JSON. Además se **autoguarda** en el navegador.

**Formato de WhatsApp** — el cuerpo y el pie se renderizan de verdad, tanto en la
vista previa como en el simulador: `*negrita*`, `_cursiva_`, `~tachado~`,
`` ```monoespaciado``` ``, listas con `-` o `1.` y citas con `>`. Se respetan las
reglas del chat real (un marcador con espacios alrededor no formatea, y dentro
del monoespaciado no se aplica nada más) y las de Meta (el **encabezado** de las
tarjetas interactivas va sin formato). En el lienzo las tarjetas muestran el
texto limpio, sin marcadores.

**Simulador** (botón **▶ Probar**) — es un **emulador de WhatsApp**, no un chat
genérico: mismo fondo, mismas burbujas, misma hora dentro del mensaje.
- Los **botones van pegados a la burbuja**, como en el chat real: las respuestas
  rápidas se apilan bajo el mensaje y las listas abren su **hoja inferior** con
  secciones y filas. Nada de opciones sueltas al pie del panel.
- Los mensajes que no esperan respuesta **encadenan solos**, con indicador de
  «escribiendo…»; las tarjetas que sí esperan (botones, lista, Flow, ubicación)
  se quedan a la espera.
- El **nodo activo se resalta** en el lienzo y la vista se centra en él.
- Las salidas **sin conectar** se avisan al tocarlas, para detectar huecos del flujo.

## Tarjetas de Meta soportadas

El catálogo está segmentado en **dos niveles**: primero la **familia** y dentro de
ella la **categoría**.

| Familia | Qué es | Tarjetas |
|---|---|---|
| **Meta Cards** | Tipos de mensaje reales de la WhatsApp Cloud API. | 20 (Mensajes, Multimedia, Interactivos, Comercio, Avanzados) |
| **Control de flujo** | Piezas del editor que marcan el recorrido; no envían nada. | 2 (Inicio, Fin) |

La paleta lateral filtra por familia (**Todas · Meta · Flujo**), tiene buscador y
grupos plegables; el menú de clic derecho usa la misma segmentación; y el
inspector muestra la familia, la categoría y el `type` exacto de la API de cada
tarjeta.

Cada paso del lienzo **es un tipo de mensaje real de la WhatsApp Cloud API**. El
inspector dibuja el formulario propio de cada tarjeta, aplica los límites de Meta
(caracteres, número de botones, filas…) y muestra el **JSON exacto** que hay que
enviar a `POST /<PHONE_NUMBER_ID>/messages`.

| Categoría | Tarjeta | `type` de la API | Límites clave |
|---|---|---|---|
| Mensajes | Texto | `text` | cuerpo 4096 |
| Mensajes | Reacción | `reaction` | emoji + `message_id` |
| Mensajes | Plantilla | `template` | nombre + idioma + parámetros |
| Multimedia | Imagen | `image` | caption 1024 |
| Multimedia | Video | `video` | caption 1024 |
| Multimedia | Audio | `audio` | solo enlace |
| Multimedia | Documento | `document` | caption 1024 + filename |
| Multimedia | Sticker | `sticker` | `.webp` |
| Multimedia | Ubicación | `location` | lat + lon (+ nombre y dirección) |
| Multimedia | Contacto | `contacts` | vCard |
| Interactivos | Botones de respuesta | `interactive/button` | 3 botones, título 20, cuerpo 1024, pie 60 |
| Interactivos | Lista de opciones | `interactive/list` | 10 secciones, **10 filas en total**, fila 24 / desc. 72, botón 20 |
| Interactivos | Botón con enlace | `interactive/cta_url` | botón 20, cuerpo 1024 |
| Interactivos | Pedir ubicación | `interactive/location_request_message` | solo cuerpo |
| Interactivos | Flow | `interactive/flow` | `flow_id` o `flow_name`, CTA 20, pantalla inicial |
| Interactivos | Permiso de llamada | `interactive/call_permission_request` | acepta / rechaza |
| Avanzados | Pedir dirección | `interactive/address_message` | solo India |
| Comercio | Catálogo | `interactive/catalog_message` | SKU de miniatura |
| Comercio | Producto | `interactive/product` | `catalog_id` + SKU |
| Comercio | Lista de productos | `interactive/product_list` | secciones de SKUs |

Además, **Inicio** y **Fin** marcan la entrada y la salida del flujo (no son
mensajes de Meta). El catálogo completo, con sus campos y validaciones, vive en
`src/flow/cardTypes.js`: añadir un tipo nuevo es añadir una entrada ahí.

Cómo se ramifica el flujo: las tarjetas de **botones** y de **lista** exponen una
salida por cada botón o fila, con su propio conector a la derecha de la tarjeta,
así que el simulador sabe exactamente a qué paso lleva cada opción.

Referencia: [Cloud API · Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/).

## El formulario nativo vive en la tarjeta Flow

Un **WhatsApp Flow** es el formulario que se abre *dentro* del chat (el del pie
«Managed by …»). En la Cloud API son dos piezas —el mensaje que lo invoca y el
Flow JSON que define las pantallas—, pero para ti es **una sola tarjeta**:
seleccionas la tarjeta **Flow** en el lienzo y ahí mismo, en su inspector, está
el bloque **Formulario nativo**.

- **Diseñar las pantallas** abre el diseñador sobre el lienzo, sin salir del flujo:
  lista de pantallas, paleta de **14 componentes** (título, subtítulo, párrafo,
  nota, enlace, imagen, campo de texto, campo largo, opción única, opción
  múltiple, desplegable, fecha, casilla de aceptación y botón de pie) y la
  pantalla dibujada como la hoja nativa, donde seleccionas y reordenas tocando.
- **La vista previa de la tarjeta encadena las dos partes**: ves la burbuja con su
  botón y, al tocarlo, el formulario que se abriría.
- **Encadenado de datos automático**: lo capturado en una pantalla viaja en el
  `payload` del `navigate`, se declara en el `data` de la siguiente y vuelve
  entero en el `complete`, que es lo que Meta exige para que el Flow compile.
- **Validación local** de lo que Meta rechazaría: ids en MAYÚSCULAS, nombres de
  campo repetidos, pie ausente o que no cierra la pantalla, destinos de
  navegación inexistentes, `complete` en pantalla no terminal, límites de
  caracteres y topes por pantalla (50 componentes, 3 imágenes, 2 enlaces).
- **Exportar / copiar** el Flow JSON para publicarlo en Meta; luego pegas el
  `flow_id` que te devuelven en la misma tarjeta. La pantalla inicial se rellena
  sola con la primera del diseño.

Versión de Flow JSON por defecto: **7.3** (editable por tarjeta).

## Flujos de ejemplo

`examples/` **no se versiona** (está en `.gitignore`): los flujos se generan en
local con `npm run presets` y se cargan con **Importar**, desde la portada o
desde el editor.

| Archivo | Qué trae |
|---|---|
| `examples/gys-legal.json` | Bot de campo de **G&S Legal** («Amaranta»): wizard del informe de asistencia jurídica — 103 pasos, 182 conexiones, con sus bifurcaciones por resultado del servicio, tercero y titular de la póliza. |

La fuente vive en `src/flow/presets/` (catálogos, textos y salidas) y esa sí se
versiona: `npm run presets` reconstruye el JSON cuando lo necesites.

## Estructura

| Archivo | Qué es |
|---|---|
| `docker-compose.yml`, `Dockerfile` | Entorno Docker (Node vive aquí, no en tu Mac). |
| `src/App.jsx` | Portada + editor: lienzo, drag&drop, edición, guardar/cargar, simulador. |
| `src/components/Home.jsx` | Portada: tus flujos y lo que viene. |
| `src/components/Modal.jsx` | Diálogos de la app (confirmar, renombrar). |
| `src/flow/workspace.js` | Índice + documentos de los flujos en el navegador. |
| `src/flow/flowJson.js` | **Catálogo de componentes de Flows**: campos, límites y Flow JSON. |
| `src/components/FlowDesigner.jsx` | Diseñador de pantallas de la tarjeta Flow. |
| `src/components/FlowScreen.jsx` | Vista previa de una pantalla de Flow. |
| `src/components/FlowNode.jsx` | Nodo del lienzo: tarjeta o cápsula (Inicio / Fin). |
| `src/components/{Sidebar,Inspector,Toolbar}.jsx` | Paleta, editor de selección, barra. |
| `src/components/ContextMenu.jsx` | Menú de clic derecho (lienzo, nodo, conexión). |
| `src/components/ZoomControls.jsx` | Controles flotantes de zoom / encuadre. |
| `src/components/FieldForm.jsx` | Formulario que se dibuja solo desde la definición de la tarjeta. |
| `src/components/WhatsAppMessage.jsx` | Render fiel de una tarjeta en WhatsApp (simulador y vista previa). |
| `src/components/WaText.jsx` | Formato de WhatsApp (negrita, cursiva, listas, citas…). |
| `src/components/CardPreview.jsx` | Vista previa en vivo dentro del inspector. |
| `src/components/Simulator.jsx` | Emulador de WhatsApp que ejecuta el flujo. |
| `src/flow/cardTypes.js` | **Catálogo de tarjetas de Meta**: campos, límites, salidas y JSON. |
| `src/index.css` | Tokens del tema oscuro (colores, radios, sombras). |
| `src/flow/presets/` | Flujos reales reconstruidos como tarjetas (G&S Legal). |
| `scripts/smoke.mjs` | Chequeo rápido: payloads, flujo semilla y runtime (`npm run smoke`). |
| `scripts/gen-preset.mjs` | Genera los JSON de `examples/` (`npm run presets`). |
| `src/sim/runtime.js` | Motor que interpreta el grafo como máquina de estados. |
| `src/flow/seedFlow.js` | Flujo **semilla** de ejemplo + tipos de paso (`GRUPOS`). |
| `src/flow/transform.js` | Conversión a React Flow + auto-layout (dagre). |

## Roadmap

- ✅ **Fase 1** — Editor visual de flujos.
- ✅ **Fase 2** — Runtime + simulador de chat.
- ✅ **Fase 3** — Tarjetas de la WhatsApp Cloud API con su JSON y sus límites.
- ⏳ **Fase 4** — Backend que envía esos payloads y procesa los webhooks de Meta.

## Licencia

**Software propietario. Copyright © 2026 Johan Sebastián Gómez Rubio. Todos los derechos reservados.**

Este repositorio **no es open source**. Que el código esté visible en GitHub **no
otorga ningún derecho de uso**. Queda prohibido usar, ejecutar, desplegar, copiar,
modificar, redistribuir o integrar este código —total o parcialmente— sin una
**licencia comercial previa, por escrito y pagada** al titular.

Única excepción: leer el código para evaluación personal y no comercial, sin
ejecutarlo ni reutilizar ninguna parte de él.

¿Quieres usarlo? Escribe para cotizar una licencia: **gomezrubiosebas@gmail.com**

Detalle completo de las condiciones en [`LICENSE`](./LICENSE).
