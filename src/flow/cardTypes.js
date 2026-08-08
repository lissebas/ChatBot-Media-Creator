/*
 * Catálogo de TARJETAS del editor: los mensajes de la WhatsApp Cloud API de Meta
 * y las automatizaciones que los rodean (validar, decidir, llamar a una API,
 * esperar, avisar a una persona).
 *
 * Este archivo es la única fuente de verdad del editor: de aquí salen la paleta,
 * el formulario del inspector, el dibujo de la tarjeta en el lienzo, las salidas
 * (handles) de cada nodo, la validación de límites y el JSON que Meta espera.
 * Añadir un tipo de paso nuevo = añadir una entrada aquí.
 *
 * Cada tarjeta declara:
 *   nombre, cat, icon, desc  → cómo se presenta en la paleta y en el lienzo.
 *   docs                     → enlace a la documentación oficial de Meta.
 *   fields                   → formulario (el inspector lo dibuja solo).
 *   outputs(props)           → salidas del nodo; cada una es un handle del lienzo.
 *   summary(props)           → resumen corto bajo el título de la tarjeta.
 *   payload(props)           → objeto `message` tal como lo pide la Cloud API,
 *                              o `null` si el paso no envía nada.
 *   extraErrors(props)       → validaciones que no son de campo (p. ej. 10 filas).
 *
 * Y, opcionalmente, cómo se comporta el paso (lo leen el simulador y el análisis):
 *   chat: false     → no aparece en el chat (Inicio y Fin).
 *   tecnica: true   → no es un mensaje: en el chat sale como nota técnica.
 *   espera: "texto" → espera a que el usuario escriba y decide con lo que escribe.
 *   decide: true    → el motor elige la salida solo, sin preguntar nada.
 *   entrada: true   → puede empezar un flujo (no es un paso inalcanzable).
 *   termina: true   → puede no tener salida (no es un callejón).
 *
 * REGLA de geometría que hay que respetar: si una tarjeta tiene UNA sola salida,
 * su id tiene que ser `next`. Con cualquier otro id el lienzo la dibuja como fila
 * de opción y las aristas guardadas como `next` se quedan sin dibujar.
 *
 * Referencia general:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/
 */
import { OPCIONES_REGLA, reglaUsa } from "./validadores";

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
    tab: "Meta",
    desc: "Tipos de mensaje reales de la WhatsApp Cloud API.",
    color: "#25d366",
  },
  flujo: {
    nombre: "Control de flujo",
    sigla: "FLUJO",
    tab: "Flujo",
    desc: "Marcan el recorrido del bot; no envían ningún mensaje.",
    color: "#12b76a",
  },
  automatizacion: {
    nombre: "Automatizaciones",
    sigla: "AUTO",
    tab: "Auto",
    desc: "Lo que pasa alrededor del mensaje: validar, decidir, llamar a una API, esperar y avisar.",
    color: "#818cf8",
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
  datos: { nombre: "Datos y respuestas", color: "#fbbf24", familia: "automatizacion" },
  logica: { nombre: "Lógica", color: "#f472b6", familia: "automatizacion" },
  integracion: { nombre: "Integraciones", color: "#818cf8", familia: "automatizacion" },
  tiempo: { nombre: "Tiempo", color: "#94a3b8", familia: "automatizacion" },
  personas: { nombre: "Personas", color: "#fb7185", familia: "automatizacion" },
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

/* ── Ayudas de las tarjetas de automatización ── */

/** Comparaciones de la tarjeta Condición. */
const OPERADORES = [
  { value: "igual", label: "es igual a" },
  { value: "distinto", label: "no es igual a" },
  { value: "contiene", label: "contiene" },
  { value: "empieza", label: "empieza por" },
  { value: "mayor", label: "es mayor que" },
  { value: "menor", label: "es menor que" },
  { value: "vacio", label: "está vacía" },
  { value: "no_vacio", label: "tiene algún valor" },
  { value: "regex", label: "coincide con la expresión" },
];

/** Lista de pares nombre/valor: cabeceras, parámetros, campos de un registro. */
const claveValor = (key, label, itemLabel) => ({
  key,
  label,
  type: "list",
  itemLabel,
  item: [
    { key: "clave", label: "Nombre", type: "text", required: true },
    { key: "valor", label: "Valor", type: "text", help: "Admite {{variable}}." },
  ],
});

/** De la respuesta de una API a variables del flujo. */
const MAPEO_FIELD = {
  key: "mapeo",
  label: "Guardar en variables",
  type: "list",
  itemLabel: "Campo",
  help: "Qué parte de la respuesta se guarda y con qué nombre.",
  item: [
    { key: "ruta", label: "Ruta en la respuesta", type: "text", required: true, placeholder: "data.cliente.id" },
    { key: "variable", label: "Variable", type: "text", required: true, max: 40 },
  ],
};

const DIAS_TEXTO = { lv: "L-V", ls: "L-S", todos: "todos los días", otro: "días propios" };

/** Resumen corto de una lista escrita a mano ("120 opciones"). */
const listaCorta = (bruto) => {
  const n = String(bruto ?? "").split(/[\n,;]+/).filter((s) => s.trim()).length;
  return n ? `${n} opciones` : "un catálogo vacío";
};

/** Una URL vale si empieza por http(s) o si la compone una variable. */
const urlValida = (valor) => {
  const v = txt(valor);
  if (!v || v.includes("{{") || /^https?:\/\//i.test(v)) return [];
  return ["La URL debe empezar por http:// o https:// (o venir de una {{variable}})."];
};

/** Avisa si un campo que debería ser JSON no lo es. */
const jsonValido = (valor, quien) => {
  const v = txt(valor);
  if (!v || v.includes("{{")) return [];
  try {
    JSON.parse(v);
    return [];
  } catch (e) {
    return [`${quien} no es JSON válido: ${e.message}`];
  }
};

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
    chat: false,
    entrada: true,
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
    chat: false,
    termina: true,
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

  /* ═══════════ Automatizaciones: lo que pasa alrededor del mensaje ═══════════
   *
   * Ninguna de estas tarjetas envía nada a Meta (salvo «Pregunta y valida», que
   * manda la pregunta): describen lo que hace el bot entre mensaje y mensaje.
   * Por eso casi todas devuelven `payload: () => null`.
   */

  /* ─────────────── Datos y respuestas ─────────────── */
  ask: {
    nombre: "Pregunta y valida",
    cat: "datos",
    icon: "✅",
    desc: "Pregunta algo, comprueba que la respuesta tenga el formato correcto y la guarda en una variable.",
    espera: "texto",
    fields: [
      { key: "body", label: "Pregunta", type: "textarea", max: 1024, rows: 3, required: true },
      {
        key: "variable",
        label: "Guardar la respuesta en",
        type: "text",
        max: 40,
        required: true,
        placeholder: "correo",
        help: "Luego se usa como {{correo}} en cualquier texto del flujo.",
      },
      { key: "regla", label: "La respuesta tiene que ser", type: "select", options: OPCIONES_REGLA, default: "texto" },
      {
        key: "min",
        label: "Mínimo",
        type: "text",
        showIf: (p) => reglaUsa(p.regla || "texto", "min"),
        help: "Admite {{variable}} y expresiones: «año actual - 18», «hoy - 30».",
      },
      { key: "max", label: "Máximo", type: "text", showIf: (p) => reglaUsa(p.regla || "texto", "max") },
      {
        key: "orden",
        label: "Cuando la fecha es ambigua",
        type: "select",
        options: [
          { value: "dmy", label: "03/04 es 3 de abril (día/mes)" },
          { value: "mdy", label: "03/04 es 4 de marzo (mes/día)" },
        ],
        default: "dmy",
        showIf: (p) => reglaUsa(p.regla, "orden"),
      },
      {
        key: "opciones",
        label: "Opciones válidas",
        type: "textarea",
        rows: 4,
        showIf: (p) => reglaUsa(p.regla, "opciones"),
        help: "Una por línea. El usuario también puede responder con el número.",
      },
      {
        key: "patron",
        label: "Expresión regular",
        type: "text",
        showIf: (p) => reglaUsa(p.regla, "patron"),
        placeholder: "^[A-Z]{3}\\d{3}$",
        help: "Admite {{variable}}: así el formato puede depender de algo capturado antes.",
      },
      {
        key: "error",
        label: "Qué responder si no vale",
        type: "textarea",
        rows: 2,
        max: 1024,
        help: "Si lo dejas vacío se usa el aviso propio de la regla.",
      },
      { key: "intentos", label: "Intentos antes de rendirse", type: "number", default: "2" },
      {
        key: "espera_min",
        label: "Minutos de espera (0 = sin límite)",
        type: "number",
        default: "0",
        help: "Con más de 0 aparece una salida para cuando el usuario no contesta.",
      },
    ],
    outputs: (p) => [
      { id: "ok", label: "Válido" },
      { id: "fail", label: "No válido" },
      ...(Number(p.espera_min) > 0 ? [{ id: "timeout", label: "Sin respuesta" }] : []),
    ],
    summary: (p) => txt(p.body),
    // Sí es un mensaje real: la pregunta se envía como texto.
    payload: (p) => (txt(p.body) ? { type: "text", text: { body: txt(p.body) } } : null),
  },

  vars: {
    nombre: "Asignar variables",
    cat: "datos",
    icon: "🏷",
    desc: "Guarda, copia o borra valores para usarlos más adelante.",
    tecnica: true,
    decide: true,
    fields: [
      {
        key: "asignaciones",
        label: "Asignaciones",
        type: "list",
        min: 1,
        max: 20,
        itemLabel: "Variable",
        item: [
          { key: "variable", label: "Variable", type: "text", required: true, max: 40 },
          {
            key: "origen",
            label: "Toma el valor de",
            type: "select",
            options: [
              { value: "fijo", label: "un valor fijo" },
              { value: "respuesta", label: "la última respuesta del usuario" },
              { value: "borrar", label: "(borrarla)" },
            ],
            default: "fijo",
          },
          {
            key: "valor",
            label: "Valor",
            type: "text",
            showIf: (i) => (i.origen || "fijo") === "fijo",
            help: "Admite {{otra_variable}}.",
          },
        ],
      },
    ],
    outputs: () => NEXT,
    summary: (p) =>
      (p.asignaciones || []).map((a) => a.variable).filter(Boolean).join(", ") || "Sin asignaciones",
    payload: () => null,
  },

  lookup: {
    nombre: "Buscar en catálogo",
    cat: "datos",
    icon: "🔎",
    desc: "Busca lo que escribió el usuario en una lista larga y distingue si acertó, si hay varios parecidos o si no hay nada.",
    tecnica: true,
    decide: true,
    fields: [
      { key: "entrada", label: "Texto a buscar", type: "text", required: true, default: "{{respuesta}}" },
      {
        key: "items",
        label: "Catálogo",
        type: "textarea",
        rows: 6,
        required: true,
        help: "Una opción por línea. Admite {{variable}} si la lista viene de una petición anterior.",
      },
      { key: "variable", label: "Guardar lo encontrado en", type: "text", required: true, max: 40 },
      { key: "candidatos", label: "Guardar los candidatos en", type: "text", max: 40, default: "candidatos" },
      { key: "umbral", label: "Parecido mínimo (0-100)", type: "number", default: "72" },
      { key: "max", label: "Máximo de candidatos", type: "number", default: "10" },
    ],
    outputs: () => [
      { id: "unico", label: "Encontrado" },
      { id: "varios", label: "Varios candidatos" },
      { id: "ninguno", label: "Sin coincidencia" },
    ],
    summary: (p) => `Busca «${txt(p.entrada) || "…"}» en ${listaCorta(p.items)}`,
    payload: () => null,
  },

  record: {
    nombre: "Guardar o leer datos",
    cat: "datos",
    icon: "🗄",
    desc: "Escribe o recupera un registro (un lead, una conversación, un pedido) en tu almacén.",
    tecnica: true,
    fields: [
      {
        key: "operacion",
        label: "Operación",
        type: "select",
        options: [
          { value: "guardar", label: "Guardar / actualizar" },
          { value: "leer", label: "Leer" },
          { value: "borrar", label: "Borrar" },
        ],
        default: "guardar",
      },
      { key: "coleccion", label: "Colección", type: "text", required: true, placeholder: "clientes" },
      { key: "clave", label: "Clave del registro", type: "text", required: true, default: "{{telefono}}" },
      {
        key: "campos",
        label: "Campos",
        type: "list",
        itemLabel: "Campo",
        showIf: (p) => (p.operacion || "guardar") === "guardar",
        item: [
          { key: "clave", label: "Campo", type: "text", required: true },
          { key: "valor", label: "Valor", type: "text", help: "Admite {{variable}}." },
        ],
      },
      {
        key: "variable",
        label: "Guardar el registro en",
        type: "text",
        max: 40,
        showIf: (p) => p.operacion === "leer",
      },
    ],
    outputs: (p) =>
      p.operacion === "leer"
        ? [
            { id: "ok", label: "Encontrado" },
            { id: "vacio", label: "No existe" },
            { id: "error", label: "Error" },
          ]
        : [
            { id: "ok", label: "Listo" },
            { id: "error", label: "Error" },
          ],
    summary: (p) => `${p.operacion || "guardar"} · ${txt(p.coleccion) || "colección"} · ${txt(p.clave)}`,
    payload: () => null,
  },

  /* ─────────────── Lógica ─────────────── */
  condition: {
    nombre: "Condición",
    cat: "logica",
    icon: "🔀",
    desc: "Reparte el flujo según el valor de las variables. Cada ruta es una salida.",
    tecnica: true,
    decide: true,
    fields: [
      {
        key: "rutas",
        label: "Rutas",
        type: "list",
        min: 1,
        max: 8,
        itemLabel: "Ruta",
        help: "Se evalúan en orden: gana la primera que se cumpla.",
        item: [
          { key: "id", label: "ID", type: "text", max: 64, auto: "ruta" },
          { key: "etiqueta", label: "Nombre de la ruta", type: "text", max: 40, required: true },
          {
            key: "modo",
            label: "Se cumple cuando",
            type: "select",
            options: [
              { value: "todas", label: "se cumplen todas" },
              { value: "alguna", label: "se cumple alguna" },
            ],
            default: "todas",
          },
          {
            key: "condiciones",
            label: "Condiciones",
            type: "list",
            min: 1,
            max: 6,
            itemLabel: "Condición",
            item: [
              { key: "variable", label: "Variable", type: "text", required: true, placeholder: "tipo_vehiculo" },
              { key: "operador", label: "Operador", type: "select", options: OPERADORES, default: "igual" },
              {
                key: "valor",
                label: "Valor",
                type: "text",
                showIf: (c) => !["vacio", "no_vacio"].includes(c.operador || "igual"),
              },
            ],
          },
        ],
      },
    ],
    outputs: (p) => [
      ...(p.rutas || []).map((r, i) => ({ id: r.id || `ruta_${i + 1}`, label: r.etiqueta || `Ruta ${i + 1}` })),
      { id: "else", label: "Si no" },
    ],
    summary: (p) =>
      (p.rutas || []).map((r) => r.etiqueta).filter(Boolean).join(" · ") || "Sin rutas",
    payload: () => null,
  },

  intent: {
    nombre: "Intención por palabras",
    cat: "logica",
    icon: "🧭",
    desc: "Escucha lo que escribe el usuario y lo manda por la intención que reconozca.",
    tecnica: true,
    espera: "texto",
    fields: [
      {
        key: "intenciones",
        label: "Intenciones",
        type: "list",
        min: 1,
        max: 12,
        itemLabel: "Intención",
        item: [
          { key: "id", label: "ID", type: "text", max: 64, auto: "int" },
          { key: "etiqueta", label: "Nombre", type: "text", max: 40, required: true, placeholder: "Cotizar" },
          {
            key: "palabras",
            label: "Palabras clave",
            type: "text",
            required: true,
            placeholder: "cotizar, precio, cuánto vale",
            help: "Separadas por comas. Basta con que aparezca una.",
          },
        ],
      },
      { key: "variable", label: "Guardar la intención en", type: "text", max: 40, default: "intencion" },
    ],
    outputs: (p) => [
      ...(p.intenciones || []).map((x, i) => ({ id: x.id || `int_${i + 1}`, label: x.etiqueta || `Intención ${i + 1}` })),
      { id: "sin_coincidencia", label: "No entendí" },
    ],
    summary: (p) => (p.intenciones || []).map((x) => x.etiqueta).filter(Boolean).join(" · ") || "Sin intenciones",
    payload: () => null,
  },

  commands: {
    nombre: "Comandos globales",
    cat: "logica",
    icon: "⌘",
    desc: "Palabras que funcionan en cualquier punto de la conversación: menú, reiniciar, hablar con un asesor.",
    tecnica: true,
    entrada: true,
    fields: [
      {
        key: "comandos",
        label: "Comandos",
        type: "list",
        min: 1,
        max: 8,
        itemLabel: "Comando",
        help: "Se revisan ANTES que las opciones del paso en el que esté el usuario.",
        item: [
          { key: "id", label: "ID", type: "text", max: 64, auto: "cmd" },
          { key: "etiqueta", label: "Nombre", type: "text", max: 40, required: true, placeholder: "Menú" },
          {
            key: "palabras",
            label: "Palabras clave",
            type: "text",
            required: true,
            placeholder: "menu, inicio, volver",
          },
        ],
      },
    ],
    outputs: (p) =>
      (p.comandos || []).map((c, i) => ({ id: c.id || `cmd_${i + 1}`, label: c.etiqueta || `Comando ${i + 1}` })),
    summary: (p) => (p.comandos || []).map((c) => c.etiqueta).filter(Boolean).join(" · ") || "Sin comandos",
    payload: () => null,
  },

  goto: {
    nombre: "Ir a un paso",
    cat: "logica",
    icon: "↪",
    desc: "Salta a otro paso del flujo sin dibujar una conexión que cruce todo el lienzo.",
    tecnica: true,
    decide: true,
    termina: true,
    fields: [
      {
        key: "paso",
        label: "Paso destino",
        type: "text",
        required: true,
        placeholder: "Menú principal",
        help: "El título del paso (o su id, que aparece al final de este panel).",
      },
    ],
    outputs: () => [],
    summary: (p) => (txt(p.paso) ? `→ ${txt(p.paso)}` : "Sin destino"),
    payload: () => null,
  },

  /* ─────────────── Integraciones ─────────────── */
  http: {
    nombre: "Petición HTTP",
    cat: "integracion",
    icon: "🌐",
    desc: "Llama a una API: manda datos, recoge la respuesta y la guarda en variables.",
    tecnica: true,
    fields: [
      {
        key: "metodo",
        label: "Método",
        type: "select",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m })),
        default: "GET",
      },
      {
        key: "url",
        label: "URL",
        type: "text",
        required: true,
        placeholder: "https://api.ejemplo.com/clientes/{{documento}}",
        help: "Admite {{variable}} en cualquier parte.",
      },
      claveValor("headers", "Cabeceras", "Cabecera"),
      claveValor("query", "Parámetros de la URL", "Parámetro"),
      {
        key: "cuerpo",
        label: "Cuerpo (JSON)",
        type: "textarea",
        rows: 5,
        showIf: (p) => (p.metodo || "GET") !== "GET",
        placeholder: '{ "nombre": "{{nombre}}" }',
      },
      {
        key: "auth",
        label: "Autenticación",
        type: "select",
        options: [
          { value: "ninguna", label: "Ninguna" },
          { value: "bearer", label: "Token Bearer" },
          { value: "basica", label: "Usuario y contraseña" },
          { value: "apikey", label: "Clave en una cabecera" },
        ],
        default: "ninguna",
      },
      {
        key: "auth_valor",
        label: "Credencial",
        type: "text",
        showIf: (p) => p.auth && p.auth !== "ninguna",
        help: "Guárdala en una variable de entorno y ponla aquí como {{variable}}: este JSON se exporta.",
      },
      {
        key: "auth_header",
        label: "Nombre de la cabecera",
        type: "text",
        default: "X-API-Key",
        showIf: (p) => p.auth === "apikey",
      },
      { key: "timeout", label: "Tiempo máximo (segundos)", type: "number", default: "10" },
      { key: "reintentos", label: "Reintentos si falla la red", type: "number", default: "0" },
      MAPEO_FIELD,
      {
        key: "ejemplo",
        label: "Respuesta de ejemplo",
        type: "textarea",
        rows: 5,
        help: "Solo para el simulador: con esto puedes probar el flujo sin llamar de verdad a la API.",
      },
    ],
    outputs: () => [
      { id: "ok", label: "Éxito" },
      { id: "error", label: "Error" },
    ],
    summary: (p) => `${p.metodo || "GET"} ${txt(p.url) || "sin URL"}`,
    extraErrors: (p) => [
      ...urlValida(p.url),
      ...jsonValido(p.cuerpo, "El cuerpo"),
      ...jsonValido(p.ejemplo, "La respuesta de ejemplo"),
    ],
    payload: () => null,
  },

  webhook: {
    nombre: "Esperar webhook",
    cat: "integracion",
    icon: "📥",
    desc: "Deja el flujo en pausa hasta que un sistema externo avise de que ya terminó.",
    tecnica: true,
    fields: [
      { key: "evento", label: "Nombre del evento", type: "text", required: true, placeholder: "cotizacion_lista" },
      {
        key: "correlacion",
        label: "Cómo se reconoce la conversación",
        type: "text",
        required: true,
        default: "{{telefono}}",
        help: "El sistema externo tiene que devolver este mismo valor para saber a quién responderle.",
      },
      MAPEO_FIELD,
      { key: "espera_min", label: "Minutos de espera", type: "number", default: "15" },
      { key: "ejemplo", label: "Carga de ejemplo", type: "textarea", rows: 4 },
    ],
    outputs: () => [
      { id: "recibido", label: "Recibido" },
      { id: "timeout", label: "Se agotó la espera" },
    ],
    summary: (p) => `Espera «${txt(p.evento) || "evento"}» ${p.espera_min || 15} min`,
    extraErrors: (p) => jsonValido(p.ejemplo, "La carga de ejemplo"),
    payload: () => null,
  },

  trigger: {
    nombre: "Disparador externo",
    cat: "integracion",
    icon: "⚡",
    desc: "Empieza el flujo cuando otro sistema llama a un endpoint tuyo, en vez de cuando escribe el usuario.",
    tecnica: true,
    entrada: true,
    fields: [
      { key: "evento", label: "Nombre del evento", type: "text", required: true, placeholder: "lead_nuevo" },
      {
        key: "metodo",
        label: "Método",
        type: "select",
        options: ["POST", "GET"].map((m) => ({ value: m, label: m })),
        default: "POST",
      },
      { key: "ruta", label: "Ruta sugerida", type: "text", default: "/hooks/lead_nuevo" },
      {
        key: "verificacion",
        label: "Cómo se comprueba quién llama",
        type: "select",
        options: [
          { value: "ninguna", label: "Nada (solo para pruebas)" },
          { value: "token", label: "Token secreto en la URL" },
          { value: "firma", label: "Firma HMAC del cuerpo" },
        ],
        default: "token",
      },
      MAPEO_FIELD,
    ],
    outputs: () => NEXT,
    summary: (p) => `${p.metodo || "POST"} ${txt(p.ruta) || "/hook"}`,
    payload: () => null,
  },

  poll: {
    nombre: "Sondear resultado",
    cat: "integracion",
    icon: "🔁",
    desc: "Pregunta cada cierto tiempo hasta que el resultado esté listo. Para cuando el aviso por webhook no es de fiar.",
    tecnica: true,
    fields: [
      { key: "url", label: "Qué se consulta", type: "text", required: true, placeholder: "https://api.ejemplo.com/tareas/{{id}}" },
      { key: "intervalo", label: "Cada cuántos segundos", type: "number", default: "60" },
      { key: "intentos", label: "Cuántas veces como máximo", type: "number", default: "5" },
      {
        key: "hasta",
        label: "Se considera listo cuando",
        type: "select",
        options: [
          { value: "respuesta", label: "haya respuesta" },
          { value: "estable", label: "el resultado deje de cambiar" },
          { value: "condicion", label: "se cumpla una condición" },
        ],
        default: "respuesta",
      },
      {
        key: "condicion",
        label: "Condición",
        type: "text",
        showIf: (p) => p.hasta === "condicion",
        placeholder: "estado == listo",
      },
      MAPEO_FIELD,
    ],
    outputs: () => [
      { id: "listo", label: "Listo" },
      { id: "agotado", label: "Se agotaron los intentos" },
    ],
    summary: (p) => `Cada ${p.intervalo || 60}s · hasta ${p.intentos || 5} veces`,
    extraErrors: (p) => urlValida(p.url),
    payload: () => null,
  },

  /* ─────────────── Tiempo ─────────────── */
  delay: {
    nombre: "Esperar",
    cat: "tiempo",
    icon: "⏳",
    desc: "Una pausa antes del siguiente paso, para que el bot no conteste de golpe.",
    tecnica: true,
    fields: [
      { key: "cantidad", label: "Cuánto", type: "number", default: "3" },
      {
        key: "unidad",
        label: "Unidad",
        type: "select",
        options: [
          { value: "segundos", label: "segundos" },
          { value: "minutos", label: "minutos" },
          { value: "horas", label: "horas" },
        ],
        default: "segundos",
      },
      { key: "motivo", label: "Motivo (nota para ti)", type: "text", max: 80 },
    ],
    outputs: () => NEXT,
    summary: (p) => `${p.cantidad || 3} ${p.unidad || "segundos"}`,
    payload: () => null,
  },

  schedule: {
    nombre: "Programar recordatorio",
    cat: "tiempo",
    icon: "🔔",
    desc: "Deja programados uno o varios mensajes de seguimiento y sigue con la conversación.",
    tecnica: true,
    fields: [
      {
        key: "envios",
        label: "Recordatorios",
        type: "list",
        min: 1,
        max: 5,
        itemLabel: "Recordatorio",
        item: [
          { key: "cantidad", label: "Dentro de", type: "number", default: "2" },
          {
            key: "unidad",
            label: "Unidad",
            type: "select",
            options: [
              { value: "minutos", label: "minutos" },
              { value: "horas", label: "horas" },
              { value: "dias", label: "días" },
            ],
            default: "horas",
          },
          {
            key: "plantilla",
            label: "Plantilla de Meta",
            type: "text",
            help: "Fuera de las 24 h desde el último mensaje del usuario, Meta SOLO deja enviar plantillas aprobadas.",
          },
          { key: "texto", label: "Texto (dentro de las 24 h)", type: "textarea", rows: 2, max: 1024 },
        ],
      },
      { key: "horario", label: "Enviar solo en horario de atención", type: "boolean", default: true },
      { key: "zona", label: "Zona horaria", type: "text", default: "America/Bogota", showIf: (p) => p.horario },
      { key: "apertura", label: "Desde", type: "text", default: "08:00", showIf: (p) => p.horario },
      { key: "cierre", label: "Hasta", type: "text", default: "17:00", showIf: (p) => p.horario },
      {
        key: "cancelar",
        label: "Cancelar si",
        type: "text",
        placeholder: "el usuario responde",
        help: "Sin esto, los recordatorios siguen saliendo aunque la conversación haya avanzado.",
      },
    ],
    outputs: () => [
      { id: "sigue", label: "Sigue el flujo" },
      { id: "al_vencer", label: "Al vencer el plazo" },
    ],
    summary: (p) => `${(p.envios || []).length} recordatorio(s)${p.horario ? " · en horario" : ""}`,
    payload: () => null,
  },

  hours: {
    nombre: "Horario de atención",
    cat: "tiempo",
    icon: "🕗",
    desc: "Separa lo que pasa dentro del horario de lo que pasa fuera.",
    tecnica: true,
    decide: true,
    fields: [
      { key: "zona", label: "Zona horaria", type: "text", default: "America/Bogota" },
      {
        key: "dias",
        label: "Días",
        type: "select",
        options: [
          { value: "lv", label: "De lunes a viernes" },
          { value: "ls", label: "De lunes a sábado" },
          { value: "todos", label: "Todos los días" },
          { value: "otro", label: "Otros…" },
        ],
        default: "lv",
      },
      {
        key: "dias_otros",
        label: "Qué días",
        type: "text",
        default: "L,M,X,J,V",
        showIf: (p) => p.dias === "otro",
        help: "Iniciales separadas por comas: L,M,X,J,V,S,D.",
      },
      { key: "apertura", label: "Abre a las", type: "text", default: "08:00" },
      { key: "cierre", label: "Cierra a las", type: "text", default: "17:00" },
      { key: "festivos", label: "Festivos", type: "textarea", rows: 3, help: "Una fecha por línea (AAAA-MM-DD)." },
    ],
    outputs: () => [
      { id: "abierto", label: "Abierto" },
      { id: "cerrado", label: "Cerrado" },
    ],
    summary: (p) => `${p.apertura || "08:00"}–${p.cierre || "17:00"} · ${DIAS_TEXTO[p.dias || "lv"] || "otros"}`,
    payload: () => null,
  },

  /* ─────────────── Personas ─────────────── */
  handoff: {
    nombre: "Pasar a un asesor",
    cat: "personas",
    icon: "🙋",
    desc: "Saca la conversación del bot y se la entrega a una persona, con el contexto ya recogido.",
    tecnica: true,
    fields: [
      { key: "equipo", label: "Equipo o especialidad", type: "text", placeholder: "cotizaciones" },
      {
        key: "prioridad",
        label: "Prioridad",
        type: "select",
        options: [
          { value: "normal", label: "Normal" },
          { value: "alta", label: "Alta" },
          { value: "baja", label: "Baja" },
        ],
        default: "normal",
      },
      {
        key: "modo",
        label: "Cómo se entrega",
        type: "select",
        options: [
          { value: "enlace", label: "El cliente escribe al asesor (enlace wa.me)" },
          { value: "notificar", label: "Se avisa al equipo" },
          { value: "asignar", label: "Se asigna en el CRM" },
        ],
        default: "enlace",
      },
      { key: "destino", label: "Número o destino", type: "text", placeholder: "573001234567" },
      {
        key: "contexto",
        label: "Contexto para el asesor",
        type: "textarea",
        rows: 4,
        default: "Cliente: {{nombre}}\nTeléfono: {{telefono}}\nMotivo: {{motivo}}",
        help: "Admite {{variable}}: es el mensaje que llega precargado.",
      },
      { key: "referencia", label: "Referencia", type: "text", default: "{{conversacion}}" },
    ],
    outputs: () => NEXT,
    summary: (p) => `${txt(p.equipo) || "asesor"} · ${p.prioridad || "normal"}`,
    payload: () => null,
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
