/*
 * Catálogo de TARJETAS (tipos de mensaje) de la WhatsApp Cloud API de Meta.
 *
 * Este archivo es la única fuente de verdad del editor: de aquí salen la paleta,
 * el formulario del inspector, el dibujo de la tarjeta en el lienzo, las salidas
 * (handles) de cada nodo, la validación de límites y el JSON que Meta espera.
 * Añadir un tipo de mensaje nuevo = añadir una entrada aquí.
 *
 * Cada tarjeta declara:
 *   nombre, cat, icon, desc  → cómo se presenta en la paleta y en el lienzo.
 *   docs                     → enlace a la documentación oficial de Meta.
 *   fields                   → formulario (el inspector lo dibuja solo).
 *   outputs(props)           → salidas del nodo; cada una es un handle del lienzo.
 *   summary(props)           → resumen corto bajo el título de la tarjeta.
 *   payload(props)           → objeto `message` tal como lo pide la Cloud API.
 *   extraErrors(props)       → validaciones que no son de campo (p. ej. 10 filas).
 *
 * Referencia general:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/
 */

const DOCS = "https://developers.facebook.com/docs/whatsapp/cloud-api";

/**
 * Familias: el primer nivel de la segmentación. Casi todas las tarjetas son
 * mensajes reales de Meta ("Meta Cards"); solo Inicio y Fin son piezas del
 * editor que controlan el recorrido y no envían nada.
 */
export const FAMILIAS = {
  meta: {
    nombre: "Meta Cards",
    sigla: "META",
    desc: "Tipos de mensaje reales de la WhatsApp Cloud API.",
    color: "#25d366",
  },
  flujo: {
    nombre: "Control de flujo",
    sigla: "FLUJO",
    desc: "Marcan el recorrido del bot; no envían ningún mensaje.",
    color: "#12b76a",
  },
};

/** Categorías de la paleta (segundo nivel: dan color a las tarjetas del lienzo). */
export const CATEGORIAS = {
  flujo: { nombre: "Flujo", color: "#12b76a", familia: "flujo" },
  texto: { nombre: "Mensajes", color: "#38bdf8", familia: "meta" },
  media: { nombre: "Multimedia", color: "#fb923c", familia: "meta" },
  interactivo: { nombre: "Interactivos", color: "#60a5fa", familia: "meta" },
  comercio: { nombre: "Comercio", color: "#a78bfa", familia: "meta" },
  avanzado: { nombre: "Avanzados", color: "#2dd4bf", familia: "meta" },
};

/* ── Ayudas para construir el payload ── */

const txt = (v) => (v ?? "").trim();
/** Componente de texto opcional: `{ text }` solo si hay contenido. */
const optText = (v) => (txt(v) ? { text: txt(v) } : undefined);
/** Quita las claves `undefined` para que el JSON quede limpio. */
const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === "" || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
};

/** Header de los mensajes interactivos (texto o media, según `header_type`). */
function headerObject(p) {
  const t = p.header_type || "none";
  if (t === "none") return undefined;
  if (t === "text") return txt(p.header_text) ? { type: "text", text: txt(p.header_text) } : undefined;
  return txt(p.header_link) ? { type: t, [t]: { link: txt(p.header_link) } } : undefined;
}

const HEADER_FIELDS = [
  {
    key: "header_type",
    label: "Encabezado",
    type: "select",
    options: [
      { value: "none", label: "Sin encabezado" },
      { value: "text", label: "Texto" },
      { value: "image", label: "Imagen" },
      { value: "video", label: "Video" },
      { value: "document", label: "Documento" },
    ],
    default: "none",
  },
  { key: "header_text", label: "Texto del encabezado", type: "text", max: 60, showIf: (p) => p.header_type === "text" },
  {
    key: "header_link",
    label: "URL del archivo",
    type: "url",
    showIf: (p) => ["image", "video", "document"].includes(p.header_type),
  },
];

const FOOTER_FIELD = { key: "footer", label: "Pie de página", type: "text", max: 60 };

/** Salida única: el paso continúa al siguiente nodo. */
const NEXT = [{ id: "next", label: "Siguiente" }];

/* ══════════════════════════════ Catálogo ══════════════════════════════ */

export const CARDS = {
  /* ─────────────── Flujo (no son mensajes de Meta) ─────────────── */
  start: {
    nombre: "Inicio",
    cat: "flujo",
    icon: "▶",
    desc: "Punto de entrada de la conversación.",
    pill: true,
    solid: true,
    unique: true,
    fields: [],
    outputs: () => NEXT,
    summary: () => "",
    payload: () => null,
  },

  end: {
    nombre: "Fin",
    cat: "flujo",
    icon: "■",
    desc: "Cierra la conversación.",
    pill: true,
    fields: [],
    outputs: () => [],
    summary: () => "",
    payload: () => null,
  },

  /* ─────────────── Mensajes de texto ─────────────── */
  text: {
    nombre: "Texto",
    cat: "texto",
    icon: "💬",
    desc: "Mensaje de texto, con vista previa de enlaces opcional.",
    docs: `${DOCS}/messages/text-messages/`,
    fields: [
      { key: "body", label: "Texto", type: "textarea", max: 4096, required: true, rows: 5 },
      { key: "preview_url", label: "Mostrar vista previa del enlace", type: "boolean" },
      {
        key: "wait_reply",
        label: "Esperar la respuesta del usuario",
        type: "boolean",
        help: "Solo para el simulador: marca este paso como una pregunta abierta. No cambia el JSON.",
      },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "text",
      text: clean({ body: txt(p.body), preview_url: p.preview_url || undefined }),
    }),
  },

  reaction: {
    nombre: "Reacción",
    cat: "texto",
    icon: "❤️",
    desc: "Reacciona con un emoji a un mensaje anterior del usuario.",
    docs: `${DOCS}/messages/reaction-messages/`,
    fields: [
      { key: "emoji", label: "Emoji", type: "text", max: 8, required: true, placeholder: "👍" },
      {
        key: "message_id",
        label: "ID del mensaje (wamid)",
        type: "text",
        help: "Déjalo vacío para reaccionar al último mensaje del usuario en tiempo de ejecución.",
      },
    ],
    outputs: () => NEXT,
    summary: (p) => `Reacciona con ${txt(p.emoji) || "…"}`,
    payload: (p) => ({
      type: "reaction",
      reaction: clean({ message_id: txt(p.message_id) || "{{last_message_id}}", emoji: txt(p.emoji) }),
    }),
  },

  template: {
    nombre: "Plantilla",
    cat: "texto",
    icon: "🧩",
    desc: "Plantilla aprobada por Meta (obligatoria fuera de la ventana de 24 h).",
    docs: `${DOCS}/messages/template-messages/`,
    fields: [
      { key: "name", label: "Nombre de la plantilla", type: "text", required: true, placeholder: "hello_world" },
      { key: "language", label: "Idioma", type: "text", required: true, default: "es", placeholder: "es / es_MX / en_US" },
      {
        key: "params",
        label: "Parámetros del cuerpo",
        type: "list",
        max: 10,
        itemLabel: "Parámetro",
        item: [{ key: "text", label: "Valor", type: "text", required: true }],
        help: "Reemplazan a {{1}}, {{2}}… en el orden en que aparecen.",
      },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.name),
    payload: (p) => ({
      type: "template",
      template: clean({
        name: txt(p.name),
        language: { code: txt(p.language) || "es" },
        components: (p.params || []).length
          ? [{ type: "body", parameters: (p.params || []).map((x) => ({ type: "text", text: txt(x.text) })) }]
          : undefined,
      }),
    }),
  },

  /* ─────────────── Multimedia ─────────────── */
  image: {
    nombre: "Imagen",
    cat: "media",
    icon: "🖼️",
    desc: "Una imagen con texto opcional.",
    docs: `${DOCS}/messages/image-messages/`,
    fields: [
      { key: "link", label: "URL de la imagen", type: "url", required: true },
      { key: "caption", label: "Texto (caption)", type: "textarea", max: 1024, rows: 3 },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.caption) || txt(p.link),
    media: "image",
    payload: (p) => ({ type: "image", image: clean({ link: txt(p.link), caption: txt(p.caption) }) }),
  },

  video: {
    nombre: "Video",
    cat: "media",
    icon: "🎬",
    desc: "Un video con texto opcional.",
    docs: `${DOCS}/messages/video-messages/`,
    fields: [
      { key: "link", label: "URL del video", type: "url", required: true },
      { key: "caption", label: "Texto (caption)", type: "textarea", max: 1024, rows: 3 },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.caption) || txt(p.link),
    media: "video",
    payload: (p) => ({ type: "video", video: clean({ link: txt(p.link), caption: txt(p.caption) }) }),
  },

  audio: {
    nombre: "Audio",
    cat: "media",
    icon: "🎧",
    desc: "Un archivo de audio o nota de voz.",
    docs: `${DOCS}/messages/audio-messages/`,
    fields: [{ key: "link", label: "URL del audio", type: "url", required: true }],
    outputs: () => NEXT,
    summary: (p) => txt(p.link),
    media: "audio",
    payload: (p) => ({ type: "audio", audio: clean({ link: txt(p.link) }) }),
  },

  document: {
    nombre: "Documento",
    cat: "media",
    icon: "📄",
    desc: "Un archivo descargable (PDF, xlsx…).",
    docs: `${DOCS}/messages/document-messages/`,
    fields: [
      { key: "link", label: "URL del documento", type: "url", required: true },
      { key: "filename", label: "Nombre del archivo", type: "text", placeholder: "cotizacion.pdf" },
      { key: "caption", label: "Texto (caption)", type: "textarea", max: 1024, rows: 3 },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.filename) || txt(p.caption) || txt(p.link),
    media: "document",
    payload: (p) => ({
      type: "document",
      document: clean({ link: txt(p.link), filename: txt(p.filename), caption: txt(p.caption) }),
    }),
  },

  sticker: {
    nombre: "Sticker",
    cat: "media",
    icon: "🏷️",
    desc: "Sticker estático o animado (.webp).",
    docs: `${DOCS}/messages/sticker-messages/`,
    fields: [{ key: "link", label: "URL del sticker (.webp)", type: "url", required: true }],
    outputs: () => NEXT,
    summary: (p) => txt(p.link),
    media: "sticker",
    payload: (p) => ({ type: "sticker", sticker: clean({ link: txt(p.link) }) }),
  },

  location: {
    nombre: "Ubicación",
    cat: "media",
    icon: "📍",
    desc: "Envía unas coordenadas al usuario.",
    docs: `${DOCS}/messages/location-messages/`,
    fields: [
      { key: "latitude", label: "Latitud", type: "number", required: true, placeholder: "4.6533" },
      { key: "longitude", label: "Longitud", type: "number", required: true, placeholder: "-74.0836" },
      { key: "name", label: "Nombre del lugar", type: "text" },
      { key: "address", label: "Dirección", type: "text" },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.name) || `${txt(p.latitude)}, ${txt(p.longitude)}`,
    payload: (p) => ({
      type: "location",
      location: clean({
        latitude: txt(p.latitude),
        longitude: txt(p.longitude),
        name: txt(p.name),
        address: txt(p.address),
      }),
    }),
  },

  contacts: {
    nombre: "Contacto",
    cat: "media",
    icon: "👤",
    desc: "Tarjeta de contacto (vCard).",
    docs: `${DOCS}/messages/contacts-messages/`,
    fields: [
      { key: "formatted_name", label: "Nombre completo", type: "text", required: true },
      { key: "first_name", label: "Nombres", type: "text" },
      { key: "last_name", label: "Apellidos", type: "text" },
      { key: "phone", label: "Teléfono", type: "text", placeholder: "+57 300 000 0000" },
      { key: "email", label: "Correo", type: "text" },
      { key: "url", label: "Sitio web", type: "url" },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.formatted_name),
    payload: (p) => ({
      type: "contacts",
      contacts: [
        clean({
          name: clean({
            formatted_name: txt(p.formatted_name),
            first_name: txt(p.first_name),
            last_name: txt(p.last_name),
          }),
          phones: txt(p.phone) ? [{ phone: txt(p.phone) }] : undefined,
          emails: txt(p.email) ? [{ email: txt(p.email) }] : undefined,
          urls: txt(p.url) ? [{ url: txt(p.url) }] : undefined,
        }),
      ],
    }),
  },

  /* ─────────────── Interactivos ─────────────── */
  buttons: {
    nombre: "Botones de respuesta",
    cat: "interactivo",
    icon: "🔘",
    desc: "Hasta 3 respuestas rápidas. Cada botón es una salida del nodo.",
    docs: `${DOCS}/messages/interactive-reply-buttons-messages/`,
    fields: [
      ...HEADER_FIELDS,
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 },
      FOOTER_FIELD,
      {
        key: "buttons",
        label: "Botones",
        type: "list",
        min: 1,
        max: 3,
        itemLabel: "Botón",
        item: [
          { key: "title", label: "Texto", type: "text", max: 20, required: true },
          { key: "id", label: "ID", type: "text", max: 256, auto: "btn" },
        ],
      },
    ],
    outputs: (p) =>
      (p.buttons || []).map((b, i) => ({ id: b.id || `btn_${i + 1}`, label: b.title || `Botón ${i + 1}` })),
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "button",
        header: headerObject(p),
        body: optText(p.body),
        footer: optText(p.footer),
        action: {
          buttons: (p.buttons || []).map((b, i) => ({
            type: "reply",
            reply: { id: b.id || `btn_${i + 1}`, title: txt(b.title) },
          })),
        },
      }),
    }),
  },

  list: {
    nombre: "Lista de opciones",
    cat: "interactivo",
    icon: "☰",
    desc: "Menú desplegable: hasta 10 secciones y 10 filas en total.",
    docs: `${DOCS}/messages/interactive-list-messages/`,
    fields: [
      { key: "header_text", label: "Encabezado", type: "text", max: 60 },
      { key: "body", label: "Cuerpo", type: "textarea", max: 4096, required: true, rows: 4 },
      FOOTER_FIELD,
      { key: "button", label: "Texto del botón", type: "text", max: 20, required: true, default: "Ver opciones" },
      {
        key: "sections",
        label: "Secciones",
        type: "list",
        min: 1,
        max: 10,
        itemLabel: "Sección",
        item: [
          { key: "title", label: "Título", type: "text", max: 24, required: true },
          {
            key: "rows",
            label: "Filas",
            type: "list",
            min: 1,
            max: 10,
            itemLabel: "Fila",
            item: [
              { key: "title", label: "Título", type: "text", max: 24, required: true },
              { key: "description", label: "Descripción", type: "text", max: 72 },
              { key: "id", label: "ID", type: "text", max: 200, auto: "row" },
            ],
          },
        ],
      },
    ],
    outputs: (p) =>
      (p.sections || []).flatMap((s, si) =>
        (s.rows || []).map((r, ri) => ({
          id: r.id || `row_${si + 1}_${ri + 1}`,
          label: r.title || `Fila ${ri + 1}`,
        })),
      ),
    summary: (p) => txt(p.body),
    extraErrors: (p) => {
      const total = (p.sections || []).reduce((n, s) => n + (s.rows || []).length, 0);
      return total > 10 ? [`La lista tiene ${total} filas: Meta permite 10 como máximo en total.`] : [];
    },
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "list",
        header: txt(p.header_text) ? { type: "text", text: txt(p.header_text) } : undefined,
        body: optText(p.body),
        footer: optText(p.footer),
        action: {
          button: txt(p.button),
          sections: (p.sections || []).map((s, si) =>
            clean({
              title: txt(s.title),
              rows: (s.rows || []).map((r, ri) =>
                clean({
                  id: r.id || `row_${si + 1}_${ri + 1}`,
                  title: txt(r.title),
                  description: txt(r.description),
                }),
              ),
            }),
          ),
        },
      }),
    }),
  },

  cta_url: {
    nombre: "Botón con enlace",
    cat: "interactivo",
    icon: "🔗",
    desc: "Botón que abre una URL sin mostrar el enlace crudo.",
    docs: `${DOCS}/messages/interactive-cta-url-messages/`,
    fields: [
      ...HEADER_FIELDS,
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 },
      FOOTER_FIELD,
      { key: "display_text", label: "Texto del botón", type: "text", max: 20, required: true },
      { key: "url", label: "URL de destino", type: "url", required: true },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "cta_url",
        header: headerObject(p),
        body: optText(p.body),
        footer: optText(p.footer),
        action: {
          name: "cta_url",
          parameters: clean({ display_text: txt(p.display_text), url: txt(p.url) }),
        },
      }),
    }),
  },

  location_request: {
    nombre: "Pedir ubicación",
    cat: "interactivo",
    icon: "📌",
    desc: "Muestra un botón «Enviar ubicación» al usuario.",
    docs: `${DOCS}/messages/interactive-location-request-messages/`,
    wait: "action",
    fields: [{ key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 }],
    outputs: () => [{ id: "next", label: "Ubicación recibida" }],
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: {
        type: "location_request_message",
        body: { text: txt(p.body) },
        action: { name: "send_location" },
      },
    }),
  },

  flow: {
    nombre: "Flow",
    cat: "interactivo",
    icon: "🧾",
    desc: "Abre un WhatsApp Flow (formulario nativo dentro del chat).",
    docs: "https://developers.facebook.com/docs/whatsapp/flows/gettingstarted/sendingaflow",
    wait: "action",
    fields: [
      ...HEADER_FIELDS,
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 },
      FOOTER_FIELD,
      {
        key: "flow_id",
        label: "Flow ID",
        type: "text",
        help: "El que te da Meta al publicar el formulario. Basta con el ID o el name.",
      },
      { key: "flow_name", label: "Flow name", type: "text" },
      { key: "flow_cta", label: "Texto del botón", type: "text", max: 20, required: true },
      {
        key: "flow_action",
        label: "Acción",
        type: "select",
        options: [
          { value: "navigate", label: "navigate (abre una pantalla)" },
          { value: "data_exchange", label: "data_exchange (la define tu endpoint)" },
        ],
        default: "navigate",
      },
      {
        key: "screen",
        label: "Pantalla inicial",
        type: "text",
        showIf: (p) => (p.flow_action || "navigate") === "navigate",
        required: true,
        help: "Si diseñas el formulario aquí abajo, se rellena con su primera pantalla.",
      },
      { key: "flow_token", label: "Flow token", type: "text", help: "Opcional; por defecto «unused»." },
    ],
    outputs: () => [{ id: "next", label: "Flow completado" }],
    summary: (p) => txt(p.body),
    /** La tarjeta guarda el diseño del formulario en `flowjson`. */
    pantallas: (p) => p.flowjson?.pantallas || [],
    extraErrors: (p) =>
      !txt(p.flow_id) && !txt(p.flow_name)
        ? [
            (p.flowjson?.pantallas || []).length
              ? "Publica el formulario en Meta y pega aquí su Flow ID."
              : "Indica el Flow ID o el Flow name.",
          ]
        : [],
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "flow",
        header: headerObject(p),
        body: optText(p.body),
        footer: optText(p.footer),
        action: {
          name: "flow",
          parameters: clean({
            flow_message_version: "3",
            flow_token: txt(p.flow_token) || undefined,
            flow_id: txt(p.flow_id) || undefined,
            flow_name: txt(p.flow_name) || undefined,
            flow_cta: txt(p.flow_cta),
            flow_action: p.flow_action || "navigate",
            // Si el formulario se diseñó en la tarjeta, su primera pantalla es la inicial.
            flow_action_payload:
              (p.flow_action || "navigate") === "navigate" &&
              (txt(p.screen) || p.flowjson?.pantallas?.[0]?.id)
                ? { screen: txt(p.screen) || p.flowjson.pantallas[0].id }
                : undefined,
          }),
        },
      }),
    }),
  },

  call_permission_request: {
    nombre: "Permiso de llamada",
    cat: "interactivo",
    icon: "📞",
    desc: "Pide autorización al usuario para llamarlo por WhatsApp.",
    docs: `${DOCS}/messages/interactive-voice-call-messages/`,
    fields: [{ key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 }],
    outputs: () => [
      { id: "accept", label: "Acepta" },
      { id: "reject", label: "Rechaza" },
    ],
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: {
        type: "call_permission_request",
        body: { text: txt(p.body) },
        action: { name: "call_permission_request" },
      },
    }),
  },

  address_message: {
    nombre: "Pedir dirección",
    cat: "avanzado",
    icon: "🏠",
    desc: "Formulario nativo de dirección de entrega (solo India).",
    docs: `${DOCS}/messages/address-messages/`,
    wait: "action",
    fields: [
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 },
      { key: "country", label: "País (ISO)", type: "text", required: true, default: "IN", max: 2 },
    ],
    outputs: () => [{ id: "next", label: "Dirección recibida" }],
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: {
        type: "address_message",
        body: { text: txt(p.body) },
        action: { name: "address_message", parameters: { country: txt(p.country) || "IN" } },
      },
    }),
  },

  /* ─────────────── Comercio ─────────────── */
  catalog_message: {
    nombre: "Catálogo",
    cat: "comercio",
    icon: "🗂️",
    desc: "Muestra el catálogo completo del negocio.",
    docs: `${DOCS}/messages/interactive-catalog-messages/`,
    fields: [
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 4 },
      FOOTER_FIELD,
      { key: "thumbnail_product_retailer_id", label: "SKU de la miniatura", type: "text" },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "catalog_message",
        body: optText(p.body),
        footer: optText(p.footer),
        action: clean({
          name: "catalog_message",
          parameters: txt(p.thumbnail_product_retailer_id)
            ? { thumbnail_product_retailer_id: txt(p.thumbnail_product_retailer_id) }
            : undefined,
        }),
      }),
    }),
  },

  product: {
    nombre: "Producto",
    cat: "comercio",
    icon: "🛍️",
    desc: "Un producto del catálogo con su ficha.",
    docs: `${DOCS}/messages/interactive-single-product-messages/`,
    fields: [
      { key: "catalog_id", label: "Catalog ID", type: "text", required: true },
      { key: "product_retailer_id", label: "SKU del producto", type: "text", required: true },
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, rows: 3 },
      FOOTER_FIELD,
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.product_retailer_id),
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "product",
        body: optText(p.body),
        footer: optText(p.footer),
        action: clean({
          catalog_id: txt(p.catalog_id),
          product_retailer_id: txt(p.product_retailer_id),
        }),
      }),
    }),
  },

  product_list: {
    nombre: "Lista de productos",
    cat: "comercio",
    icon: "📦",
    desc: "Varios productos del catálogo agrupados en secciones.",
    docs: `${DOCS}/messages/interactive-multi-product-messages/`,
    fields: [
      { key: "header_text", label: "Encabezado", type: "text", max: 60, required: true },
      { key: "body", label: "Cuerpo", type: "textarea", max: 1024, required: true, rows: 3 },
      FOOTER_FIELD,
      { key: "catalog_id", label: "Catalog ID", type: "text", required: true },
      {
        key: "sections",
        label: "Secciones",
        type: "list",
        min: 1,
        max: 10,
        itemLabel: "Sección",
        item: [
          { key: "title", label: "Título", type: "text", max: 24, required: true },
          {
            key: "product_items",
            label: "Productos",
            type: "list",
            min: 1,
            max: 30,
            itemLabel: "Producto",
            item: [{ key: "product_retailer_id", label: "SKU", type: "text", required: true }],
          },
        ],
      },
    ],
    outputs: () => NEXT,
    summary: (p) => txt(p.body),
    payload: (p) => ({
      type: "interactive",
      interactive: clean({
        type: "product_list",
        header: { type: "text", text: txt(p.header_text) },
        body: optText(p.body),
        footer: optText(p.footer),
        action: {
          catalog_id: txt(p.catalog_id),
          sections: (p.sections || []).map((s) =>
            clean({
              title: txt(s.title),
              product_items: (s.product_items || []).map((i) => ({
                product_retailer_id: txt(i.product_retailer_id),
              })),
            }),
          ),
        },
      }),
    }),
  },
};

/* ══════════════════════════ Utilidades ══════════════════════════ */

export const CARD_KEYS = Object.keys(CARDS);

/** Tarjetas agrupadas por categoría, en el orden de `CATEGORIAS`. */
export const CARDS_POR_CATEGORIA = Object.entries(CATEGORIAS).map(([cat, meta]) => ({
  cat,
  ...meta,
  cards: CARD_KEYS.filter((k) => CARDS[k].cat === cat).map((k) => ({ key: k, ...CARDS[k] })),
}));

/**
 * Segmentación de dos niveles: familia → categorías → tarjetas.
 * Es lo que dibujan la paleta y el menú contextual.
 */
export const CARDS_POR_FAMILIA = Object.entries(FAMILIAS).map(([familia, meta]) => {
  const grupos = CARDS_POR_CATEGORIA.filter((g) => g.familia === familia);
  return {
    familia,
    ...meta,
    grupos,
    total: grupos.reduce((n, g) => n + g.cards.length, 0),
  };
});

export function getCard(key) {
  return CARDS[key] || CARDS.text;
}

export function cardCategoria(key) {
  return CATEGORIAS[getCard(key).cat] || CATEGORIAS.texto;
}

export function cardFamilia(key) {
  return FAMILIAS[cardCategoria(key).familia] || FAMILIAS.meta;
}

export function cardColor(key) {
  return cardCategoria(key).color;
}

/** Filtra tarjetas por texto (nombre, descripción o clave). */
export function buscarCards(texto) {
  const q = (texto || "").trim().toLowerCase();
  if (!q) return null;
  return new Set(
    CARD_KEYS.filter((k) => {
      const c = CARDS[k];
      return `${c.nombre} ${c.desc} ${k}`.toLowerCase().includes(q);
    }),
  );
}

/** Props por defecto de una tarjeta nueva (respeta `default` de cada campo). */
export function defaultProps(key) {
  const props = {};
  const walk = (fields, target) => {
    for (const f of fields) {
      if (f.type === "list") {
        target[f.key] = f.min ? [emptyItem(f)] : [];
      } else if (f.default !== undefined) {
        target[f.key] = f.default;
      }
    }
  };
  walk(getCard(key).fields, props);
  return props;
}

/** Item vacío de un campo de tipo lista (recursivo para listas anidadas). */
export function emptyItem(field) {
  const item = {};
  for (const f of field.item) {
    if (f.type === "list") item[f.key] = f.min ? [emptyItem(f)] : [];
    else if (f.default !== undefined) item[f.key] = f.default;
    else item[f.key] = "";
  }
  return item;
}

/** Campos visibles según el estado actual (respeta `showIf`). */
export function visibleFields(card, props) {
  return card.fields.filter((f) => !f.showIf || f.showIf(props));
}

/** Salidas (handles) del nodo. */
export function cardOutputs(data) {
  const card = getCard(data.card);
  const outs = card.outputs(data.props || {});
  return outs.length ? outs : [];
}

/**
 * Valida los props contra los límites de Meta.
 * Devuelve { errors: {campo: mensaje}, list: [mensajes] }.
 */
export function validateCard(cardKey, props = {}) {
  const card = getCard(cardKey);
  const errors = {};
  const list = [];

  const checkField = (f, values, path) => {
    if (f.showIf && !f.showIf(values)) return;
    const v = values[f.key];
    if (f.type === "list") {
      const arr = Array.isArray(v) ? v : [];
      if (f.min && arr.length < f.min) {
        list.push(`${f.label}: se necesita al menos ${f.min}.`);
      }
      if (f.max && arr.length > f.max) {
        list.push(`${f.label}: máximo ${f.max} (hay ${arr.length}).`);
      }
      arr.forEach((item, i) => f.item.forEach((sub) => checkField(sub, item, `${path}${f.key}[${i}].`)));
      return;
    }
    const s = typeof v === "string" ? v.trim() : v;
    if (f.required && (s === undefined || s === "" || s === null)) {
      errors[`${path}${f.key}`] = "Obligatorio";
      list.push(`${f.label}: obligatorio.`);
      return;
    }
    if (f.max && typeof s === "string" && s.length > f.max) {
      errors[`${path}${f.key}`] = `Máximo ${f.max} caracteres`;
      list.push(`${f.label}: ${s.length}/${f.max} caracteres.`);
    }
    if (f.type === "url" && typeof s === "string" && s && !/^https?:\/\//i.test(s)) {
      errors[`${path}${f.key}`] = "Debe empezar por http:// o https://";
      list.push(`${f.label}: la URL debe empezar por http:// o https://.`);
    }
  };

  card.fields.forEach((f) => checkField(f, props, ""));
  if (card.extraErrors) list.push(...card.extraErrors(props));

  return { errors, list, ok: list.length === 0 };
}

/**
 * Mensaje listo para `POST /<PHONE_NUMBER_ID>/messages`.
 * `to` es un marcador que reemplaza tu backend con el número real.
 */
export function buildMessage(data, to = "<WHATSAPP_USER_PHONE_NUMBER>") {
  const card = getCard(data.card);
  const body = card.payload(data.props || {});
  if (!body) return null;
  return { messaging_product: "whatsapp", recipient_type: "individual", to, ...body };
}
