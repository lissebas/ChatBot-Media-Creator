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

**Editor** — lienzo oscuro con retícula de puntos, tarjetas suaves y cápsulas de
Inicio/Fin, al estilo de los constructores de flujos modernos.
- **Crear** un paso: arrástralo desde la paleta izquierda, o haz **clic derecho**
  sobre el lienzo y elígelo en el menú contextual (se crea donde apuntaste).
- **Conectar** pasos: arrastra desde el punto inferior de un nodo al superior de otro.
- **Editar** un paso o conexión: selecciónalo → panel derecho (título, texto, tipo
  de paso como chips de color, etiqueta de la conexión).
- **Clic derecho** sobre un nodo → duplicar o borrar; sobre una conexión → borrar.
- **Borrar**: selecciona y pulsa `Supr`/`Backspace`, o el botón del inspector.
- **Auto-organizar** (layout jerárquico automático), **Ajustar**, controles de zoom
  flotantes con porcentaje, minimapa y paleta plegable.
- **Exportar / Importar** el flujo como JSON. Además se **autoguarda** en el navegador.

**Simulador** (botón **▶ Probar**)
- Ejecuta el flujo como un chat: escribe o toca opciones y el bot avanza por el grafo.
- El **nodo activo se resalta** (pulso verde) en el lienzo y la vista se centra en él.
- Reglas: nodo sin salidas = fin; 1 salida sin etiqueta = espera texto libre;
  1 con etiqueta o varias = opciones (botones), con match por texto sin tildes.

## Tarjetas de Meta soportadas

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

## Estructura

| Archivo | Qué es |
|---|---|
| `docker-compose.yml`, `Dockerfile` | Entorno Docker (Node vive aquí, no en tu Mac). |
| `src/App.jsx` | App principal: lienzo, drag&drop, edición, guardar/cargar, simulador. |
| `src/components/FlowNode.jsx` | Nodo del lienzo: tarjeta o cápsula (Inicio / Fin). |
| `src/components/{Sidebar,Inspector,Toolbar}.jsx` | Paleta, editor de selección, barra. |
| `src/components/ContextMenu.jsx` | Menú de clic derecho (lienzo, nodo, conexión). |
| `src/components/ZoomControls.jsx` | Controles flotantes de zoom / encuadre. |
| `src/components/FieldForm.jsx` | Formulario que se dibuja solo desde la definición de la tarjeta. |
| `src/components/Simulator.jsx` | Panel de chat que ejecuta el flujo. |
| `src/flow/cardTypes.js` | **Catálogo de tarjetas de Meta**: campos, límites, salidas y JSON. |
| `src/index.css` | Tokens del tema oscuro (colores, radios, sombras). |
| `scripts/smoke.mjs` | Chequeo rápido: payloads, flujo semilla y runtime (`npm run smoke`). |
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
