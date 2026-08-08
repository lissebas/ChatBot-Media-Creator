/*
 * Catálogo de componentes de WhatsApp Flows (Flow JSON).
 *
 * Un Flow es el formulario nativo que se abre dentro del chat: pantallas con
 * títulos, campos, selectores y un botón de pie. NO viaja en el mensaje — se
 * publica aparte y la tarjeta «Flow» solo lo referencia por `flow_id`.
 *
 * Este archivo describe cada componente igual que `cardTypes.js` describe las
 * tarjetas: campos del formulario, límites de Meta y cómo se serializa. De aquí
 * salen la paleta, el inspector, la vista previa y el JSON exportado.
 *
 * Referencia:
 * https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 * https://developers.facebook.com/docs/whatsapp/flows/reference/components
 */

/** Versión de Flow JSON por defecto (la vigente al escribir esto). */
export const VERSION_FLOW = "7.3";
export const VERSION_DATA_API = "3.0";

const t = (v) => (v ?? "").toString().trim();
const limpiar = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === "" || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
};

/** Campos comunes de los componentes que capturan un dato. */
const CAMPO_NAME = {
  key: "name",
  label: "Nombre del campo (name)",
  type: "text",
  required: true,
  help: "Identificador con el que llega el dato en la respuesta. Sin espacios.",
};

const OPCIONES = {
  key: "data-source",
  label: "Opciones",
  type: "list",
  min: 1,
  max: 20,
  itemLabel: "Opción",
  item: [
    { key: "title", label: "Título", type: "text", max: 30, required: true },
    { key: "id", label: "ID", type: "text", required: true, auto: "opt" },
    { key: "description", label: "Descripción", type: "text", max: 300 },
    { key: "metadata", label: "Metadato", type: "text", max: 20 },
  ],
};

const fuente = (arr) =>
  (arr || []).map((o, i) => limpiar({
    id: t(o.id) || `opt_${i + 1}`,
    title: t(o.title),
    description: t(o.description),
    metadata: t(o.metadata),
  }));

/* ══════════════════════════ Componentes ══════════════════════════ */

export const COMPONENTES = {
  TextHeading: {
    nombre: "Título",
    icon: "🔠",
    cat: "Texto",
    desc: "Titular de la pantalla.",
    fields: [{ key: "text", label: "Texto", type: "textarea", max: 80, required: true, rows: 2 }],
    toJSON: (p) => ({ type: "TextHeading", text: t(p.text) }),
  },

  TextSubheading: {
    nombre: "Subtítulo",
    icon: "🔡",
    cat: "Texto",
    desc: "Encabezado secundario, para agrupar campos.",
    fields: [{ key: "text", label: "Texto", type: "textarea", max: 80, required: true, rows: 2 }],
    toJSON: (p) => ({ type: "TextSubheading", text: t(p.text) }),
  },

  TextBody: {
    nombre: "Párrafo",
    icon: "📝",
    cat: "Texto",
    desc: "Texto normal.",
    fields: [
      { key: "text", label: "Texto", type: "textarea", max: 4096, required: true, rows: 4 },
      {
        key: "font-weight",
        label: "Estilo",
        type: "select",
        default: "normal",
        options: [
          { value: "normal", label: "Normal" },
          { value: "bold", label: "Negrita" },
          { value: "italic", label: "Cursiva" },
          { value: "bold_italic", label: "Negrita cursiva" },
        ],
      },
    ],
    toJSON: (p) =>
      limpiar({
        type: "TextBody",
        text: t(p.text),
        "font-weight": p["font-weight"] !== "normal" ? p["font-weight"] : undefined,
      }),
  },

  TextCaption: {
    nombre: "Nota al pie",
    icon: "🔽",
    cat: "Texto",
    desc: "Texto pequeño y secundario.",
    fields: [{ key: "text", label: "Texto", type: "textarea", max: 409, required: true, rows: 3 }],
    toJSON: (p) => ({ type: "TextCaption", text: t(p.text) }),
  },

  TextInput: {
    nombre: "Campo de texto",
    icon: "⌨️",
    cat: "Entrada",
    desc: "Una línea: nombre, cédula, correo, teléfono…",
    fields: [
      { key: "label", label: "Etiqueta", type: "text", max: 20, required: true },
      CAMPO_NAME,
      {
        key: "input-type",
        label: "Tipo de dato",
        type: "select",
        default: "text",
        options: [
          { value: "text", label: "Texto" },
          { value: "number", label: "Número" },
          { value: "email", label: "Correo" },
          { value: "phone", label: "Teléfono" },
          { value: "password", label: "Contraseña" },
          { value: "passcode", label: "Código" },
        ],
      },
      { key: "required", label: "Obligatorio", type: "boolean", default: true },
      { key: "helper-text", label: "Texto de ayuda", type: "text", max: 80 },
      { key: "min-chars", label: "Mínimo de caracteres", type: "number" },
      { key: "max-chars", label: "Máximo de caracteres", type: "number" },
      { key: "error-message", label: "Mensaje de error", type: "text", max: 30 },
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "TextInput",
        label: t(p.label),
        name: t(p.name),
        "input-type": p["input-type"] || "text",
        required: p.required ? true : undefined,
        "helper-text": t(p["helper-text"]),
        "min-chars": p["min-chars"] ? Number(p["min-chars"]) : undefined,
        "max-chars": p["max-chars"] ? Number(p["max-chars"]) : undefined,
        "error-message": t(p["error-message"]),
      }),
  },

  TextArea: {
    nombre: "Campo largo",
    icon: "📄",
    cat: "Entrada",
    desc: "Varias líneas: comentarios, descripciones…",
    fields: [
      { key: "label", label: "Etiqueta", type: "text", max: 20, required: true },
      CAMPO_NAME,
      { key: "required", label: "Obligatorio", type: "boolean" },
      { key: "helper-text", label: "Texto de ayuda", type: "text", max: 80 },
      { key: "max-length", label: "Máximo de caracteres", type: "number", default: "600" },
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "TextArea",
        label: t(p.label),
        name: t(p.name),
        required: p.required ? true : undefined,
        "helper-text": t(p["helper-text"]),
        "max-length": p["max-length"] ? Number(p["max-length"]) : undefined,
      }),
  },

  RadioButtonsGroup: {
    nombre: "Opción única",
    icon: "🔘",
    cat: "Selección",
    desc: "Lista donde se elige una sola opción.",
    fields: [
      { key: "label", label: "Etiqueta", type: "text", max: 30, required: true },
      CAMPO_NAME,
      { key: "description", label: "Descripción", type: "text", max: 300 },
      { key: "required", label: "Obligatorio", type: "boolean", default: true },
      OPCIONES,
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "RadioButtonsGroup",
        label: t(p.label),
        name: t(p.name),
        description: t(p.description),
        required: p.required ? true : undefined,
        "data-source": fuente(p["data-source"]),
      }),
  },

  CheckboxGroup: {
    nombre: "Opción múltiple",
    icon: "☑️",
    cat: "Selección",
    desc: "Lista donde se pueden elegir varias.",
    fields: [
      { key: "label", label: "Etiqueta", type: "text", max: 30, required: true },
      CAMPO_NAME,
      { key: "description", label: "Descripción", type: "text", max: 300 },
      { key: "required", label: "Obligatorio", type: "boolean" },
      { key: "min-selected-items", label: "Mínimo a elegir", type: "number" },
      { key: "max-selected-items", label: "Máximo a elegir", type: "number" },
      OPCIONES,
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "CheckboxGroup",
        label: t(p.label),
        name: t(p.name),
        description: t(p.description),
        required: p.required ? true : undefined,
        "min-selected-items": p["min-selected-items"] ? Number(p["min-selected-items"]) : undefined,
        "max-selected-items": p["max-selected-items"] ? Number(p["max-selected-items"]) : undefined,
        "data-source": fuente(p["data-source"]),
      }),
  },

  Dropdown: {
    nombre: "Desplegable",
    icon: "🔽",
    cat: "Selección",
    desc: "Selector compacto para listas largas.",
    fields: [
      { key: "label", label: "Etiqueta", type: "text", max: 20, required: true },
      CAMPO_NAME,
      { key: "required", label: "Obligatorio", type: "boolean", default: true },
      OPCIONES,
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "Dropdown",
        label: t(p.label),
        name: t(p.name),
        required: p.required ? true : undefined,
        "data-source": fuente(p["data-source"]),
      }),
  },

  DatePicker: {
    nombre: "Fecha",
    icon: "📅",
    cat: "Selección",
    desc: "Selector de fecha (YYYY-MM-DD).",
    fields: [
      { key: "label", label: "Etiqueta", type: "text", max: 40, required: true },
      CAMPO_NAME,
      { key: "required", label: "Obligatorio", type: "boolean", default: true },
      { key: "helper-text", label: "Texto de ayuda", type: "text", max: 80 },
      { key: "min-date", label: "Fecha mínima", type: "text", placeholder: "2026-01-01" },
      { key: "max-date", label: "Fecha máxima", type: "text", placeholder: "2026-12-31" },
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "DatePicker",
        label: t(p.label),
        name: t(p.name),
        required: p.required ? true : undefined,
        "helper-text": t(p["helper-text"]),
        "min-date": t(p["min-date"]),
        "max-date": t(p["max-date"]),
      }),
  },

  OptIn: {
    nombre: "Casilla de aceptación",
    icon: "✅",
    cat: "Selección",
    desc: "Consentimiento: términos, habeas data…",
    fields: [
      { key: "label", label: "Texto", type: "textarea", max: 120, required: true, rows: 2 },
      CAMPO_NAME,
      { key: "required", label: "Obligatorio", type: "boolean", default: true },
    ],
    entrada: true,
    toJSON: (p) =>
      limpiar({
        type: "OptIn",
        label: t(p.label),
        name: t(p.name),
        required: p.required ? true : undefined,
      }),
  },

  EmbeddedLink: {
    nombre: "Enlace",
    icon: "🔗",
    cat: "Texto",
    desc: "Abre una URL fuera del formulario.",
    fields: [
      { key: "text", label: "Texto del enlace", type: "text", max: 25, required: true },
      { key: "url", label: "URL", type: "url", required: true },
    ],
    toJSON: (p) => ({
      type: "EmbeddedLink",
      text: t(p.text),
      "on-click-action": { name: "open_url", url: t(p.url) },
    }),
  },

  Image: {
    nombre: "Imagen",
    icon: "🖼️",
    cat: "Texto",
    desc: "Imagen incrustada en base64 (máx. 3 por pantalla).",
    fields: [
      {
        key: "src",
        label: "Base64 de la imagen",
        type: "textarea",
        required: true,
        rows: 4,
        help: "Meta solo acepta base64 (sin el prefijo data:). JPEG o PNG, ~300 KB.",
      },
      { key: "alt-text", label: "Texto alternativo", type: "text", max: 80 },
      { key: "height", label: "Alto (px)", type: "number" },
      {
        key: "scale-type",
        label: "Ajuste",
        type: "select",
        default: "contain",
        options: [
          { value: "contain", label: "Contener" },
          { value: "cover", label: "Cubrir" },
        ],
      },
    ],
    toJSON: (p) =>
      limpiar({
        type: "Image",
        src: t(p.src),
        "alt-text": t(p["alt-text"]),
        height: p.height ? Number(p.height) : undefined,
        "scale-type": p["scale-type"] || undefined,
      }),
  },

  Footer: {
    nombre: "Botón de pie",
    icon: "⬇️",
    cat: "Navegación",
    desc: "Cierra la pantalla: navega a otra o termina el Flow.",
    unicoPorPantalla: true,
    fields: [
      { key: "label", label: "Texto del botón", type: "text", max: 35, required: true },
      {
        key: "accion",
        label: "Al pulsar",
        type: "select",
        default: "navigate",
        options: [
          { value: "navigate", label: "Ir a otra pantalla (navigate)" },
          { value: "complete", label: "Terminar el Flow (complete)" },
          { value: "data_exchange", label: "Consultar a tu endpoint (data_exchange)" },
        ],
      },
      {
        key: "next",
        label: "Pantalla destino",
        type: "select",
        showIf: (p) => (p.accion || "navigate") === "navigate",
        options: (ctx) => (ctx?.pantallas || []).map((s) => ({ value: s.id, label: s.id })),
      },
      { key: "left-caption", label: "Leyenda izquierda", type: "text", max: 15 },
      { key: "center-caption", label: "Leyenda centro", type: "text", max: 15 },
      { key: "right-caption", label: "Leyenda derecha", type: "text", max: 15 },
    ],
    // El payload lo calcula `construirFlowJson`, que sí conoce todas las pantallas.
    toJSON: (p) =>
      limpiar({
        type: "Footer",
        label: t(p.label),
        "left-caption": t(p["left-caption"]),
        "center-caption": t(p["center-caption"]),
        "right-caption": t(p["right-caption"]),
      }),
  },
};

export const COMPONENTE_KEYS = Object.keys(COMPONENTES);

export const COMPONENTES_POR_CAT = ["Texto", "Entrada", "Selección", "Navegación"].map((cat) => ({
  cat,
  items: COMPONENTE_KEYS.filter((k) => COMPONENTES[k].cat === cat).map((k) => ({ key: k, ...COMPONENTES[k] })),
}));

export function getComponente(tipo) {
  return COMPONENTES[tipo] || COMPONENTES.TextBody;
}

/* ══════════════════════════ Modelo del formulario ══════════════════════════ */

let contador = 0;
const uid = () => `c${Date.now().toString(36)}${(contador++).toString(36)}`;

/** Valores por defecto de un componente nuevo. */
export function nuevoComponente(tipo, nCampos = 0) {
  const def = getComponente(tipo);
  const props = {};
  for (const f of def.fields) {
    if (f.type === "list") props[f.key] = f.min ? [itemVacio(f)] : [];
    else if (f.default !== undefined) props[f.key] = f.default;
  }
  if (def.entrada) props.name = `campo_${nCampos + 1}`;
  if (tipo === "Footer") props.label = "Continuar";
  return { uid: uid(), tipo, props };
}

export function itemVacio(field) {
  const item = {};
  for (const f of field.item) item[f.key] = f.default ?? "";
  return item;
}

export function nuevaPantalla(n = 1) {
  return {
    id: `PANTALLA_${n}`,
    title: `Pantalla ${n}`,
    terminal: false,
    children: [],
  };
}

/** Componente nuevo con algunos valores ya puestos (sin perder los por defecto). */
export function componenteCon(tipo, props, nCampos = 0) {
  const c = nuevoComponente(tipo, nCampos);
  return { ...c, props: { ...c.props, ...props } };
}

/** Formulario de arranque: una pantalla válida y publicable desde el minuto cero. */
export function flujoNuevo() {
  const p = nuevaPantalla(1);
  p.children = [
    componenteCon("TextHeading", { text: "¿Cómo te ayudamos?" }),
    componenteCon("TextInput", { label: "Tu nombre", name: "nombre" }),
    componenteCon("Footer", { label: "Enviar", accion: "complete" }),
  ];
  p.terminal = true;
  return { version: VERSION_FLOW, pantallas: [p] };
}

/** Campos de entrada declarados en una pantalla. */
export function camposDe(pantalla) {
  return (pantalla.children || [])
    .filter((c) => getComponente(c.tipo).entrada && t(c.props?.name))
    .map((c) => t(c.props.name));
}

/* ══════════════════════════ Serialización ══════════════════════════ */

/**
 * Construye el Flow JSON completo.
 *
 * Encadena los datos entre pantallas: lo que se captura en una viaja en el
 * `payload` del `navigate` y se declara en el `data` de la siguiente, que es lo
 * que Meta exige para que el Flow compile y para que `complete` devuelva todo.
 */
export function construirFlowJson(flujo) {
  const pantallas = flujo.pantallas || [];
  const heredados = new Map(); // id de pantalla → campos que le llegan

  let acumulado = [];
  for (const p of pantallas) {
    heredados.set(p.id, [...acumulado]);
    acumulado = [...new Set([...acumulado, ...camposDe(p)])];
  }

  const screens = pantallas.map((p) => {
    const entran = heredados.get(p.id) || [];
    const propios = camposDe(p);
    const disponibles = [...new Set([...entran, ...propios])];

    const children = (p.children || []).map((c) => {
      const def = getComponente(c.tipo);
      const base = def.toJSON(c.props || {});
      if (c.tipo !== "Footer") return base;

      const accion = c.props?.accion || "navigate";
      const payload = Object.fromEntries(
        disponibles.map((n) => [n, propios.includes(n) ? `\${form.${n}}` : `\${data.${n}}`]),
      );
      const action =
        accion === "navigate"
          ? limpiar({
              name: "navigate",
              next: t(c.props?.next) ? { type: "screen", name: t(c.props.next) } : undefined,
              payload,
            })
          : { name: accion, payload };
      return { ...base, "on-click-action": action };
    });

    return limpiar({
      id: p.id,
      title: t(p.title) || undefined,
      terminal: p.terminal ? true : undefined,
      success: p.terminal ? true : undefined,
      data: entran.length
        ? Object.fromEntries(entran.map((n) => [n, { type: "string", __example__: "Ejemplo" }]))
        : undefined,
      layout: { type: "SingleColumnLayout", children },
    });
  });

  // routing_model: a qué pantallas puede saltar cada una.
  const routing = {};
  for (const p of pantallas) {
    const destinos = (p.children || [])
      .filter((c) => c.tipo === "Footer" && (c.props?.accion || "navigate") === "navigate")
      .map((c) => t(c.props?.next))
      .filter(Boolean);
    if (destinos.length) routing[p.id] = [...new Set(destinos)];
  }

  return limpiar({
    version: flujo.version || VERSION_FLOW,
    screens,
    routing_model: Object.keys(routing).length ? routing : undefined,
  });
}

/* ══════════════════════════ Validación ══════════════════════════ */

/** Revisa lo que Meta rechazaría al publicar. Devuelve una lista de avisos. */
export function validarFlow(flujo) {
  const avisos = [];
  const pantallas = flujo.pantallas || [];
  const ids = pantallas.map((p) => p.id);

  if (!pantallas.length) avisos.push("El formulario no tiene pantallas.");
  if (pantallas.length && !pantallas.some((p) => p.terminal)) {
    avisos.push("Ninguna pantalla está marcada como final (terminal).");
  }
  ids.forEach((id, i) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(id)) {
      avisos.push(`«${id}»: el id de pantalla debe ir en MAYÚSCULAS, sin espacios.`);
    }
    if (ids.indexOf(id) !== i) avisos.push(`Hay dos pantallas con el id «${id}».`);
  });

  for (const p of pantallas) {
    const hijos = p.children || [];
    if (!hijos.length) avisos.push(`«${p.id}»: la pantalla está vacía.`);
    if (hijos.length > 50) avisos.push(`«${p.id}»: ${hijos.length} componentes (máximo 50).`);

    const pies = hijos.filter((c) => c.tipo === "Footer");
    if (pies.length > 1) avisos.push(`«${p.id}»: solo puede haber un botón de pie.`);
    if (!pies.length) avisos.push(`«${p.id}»: falta el botón de pie (Footer).`);
    if (pies.length === 1 && hijos[hijos.length - 1].tipo !== "Footer") {
      avisos.push(`«${p.id}»: el botón de pie debe ser el último componente.`);
    }
    if (hijos.filter((c) => c.tipo === "Image").length > 3) {
      avisos.push(`«${p.id}»: máximo 3 imágenes por pantalla.`);
    }
    if (hijos.filter((c) => c.tipo === "EmbeddedLink").length > 2) {
      avisos.push(`«${p.id}»: máximo 2 enlaces por pantalla.`);
    }

    const nombres = [];
    for (const c of hijos) {
      const def = getComponente(c.tipo);
      for (const f of def.fields) {
        if (f.showIf && !f.showIf(c.props || {})) continue;
        const v = c.props?.[f.key];
        if (f.type === "list") {
          const arr = Array.isArray(v) ? v : [];
          if (f.min && arr.length < f.min) avisos.push(`«${p.id}» · ${def.nombre}: ${f.label} vacío.`);
          if (f.max && arr.length > f.max) {
            avisos.push(`«${p.id}» · ${def.nombre}: ${f.label} supera ${f.max}.`);
          }
          arr.forEach((it) => {
            for (const sub of f.item) {
              const sv = t(it[sub.key]);
              if (sub.required && !sv) avisos.push(`«${p.id}» · ${def.nombre}: falta ${sub.label} en una opción.`);
              if (sub.max && sv.length > sub.max) {
                avisos.push(`«${p.id}» · ${def.nombre}: ${sub.label} supera ${sub.max} caracteres.`);
              }
            }
          });
          continue;
        }
        const s = typeof v === "string" ? v.trim() : v;
        if (f.required && !s && s !== 0) avisos.push(`«${p.id}» · ${def.nombre}: falta ${f.label}.`);
        if (f.max && typeof s === "string" && s.length > f.max) {
          avisos.push(`«${p.id}» · ${def.nombre}: ${f.label} supera ${f.max} caracteres.`);
        }
      }
      if (def.entrada) {
        const n = t(c.props?.name);
        if (n && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) {
          avisos.push(`«${p.id}»: el nombre de campo «${n}» solo admite letras, números y _.`);
        }
        if (n && nombres.includes(n)) avisos.push(`«${p.id}»: el campo «${n}» está repetido.`);
        if (n) nombres.push(n);
      }
      if (c.tipo === "Footer" && c.props?.accion === "complete" && !p.terminal) {
        avisos.push(`«${p.id}»: termina el Flow (complete) pero no está marcada como pantalla final.`);
      }
      if (c.tipo === "Footer" && (c.props?.accion || "navigate") === "navigate") {
        const destino = t(c.props?.next);
        if (!destino) avisos.push(`«${p.id}»: el botón de pie no tiene pantalla destino.`);
        else if (!ids.includes(destino)) avisos.push(`«${p.id}»: la pantalla destino «${destino}» no existe.`);
        else if (destino === p.id) avisos.push(`«${p.id}»: el botón de pie apunta a su propia pantalla.`);
      }
    }
  }

  return avisos;
}
