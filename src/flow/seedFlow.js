/*
 * Flujo SEMILLA de ChatBot Creator.
 *
 * Es un ejemplo genérico (bienvenida → menú → captura de datos → cierre) que se
 * carga la primera vez para que el lienzo no arranque vacío y se vea de qué es
 * capaz el editor. Después el editor guarda tus cambios en el navegador
 * (localStorage) y puedes exportar/importar el flujo como JSON, o pulsar
 * «Reiniciar» para volver a este ejemplo.
 *
 * Formato: `nodes` (id, group, label) y `edges` (from, to, label?, dashes?).
 * La primera línea del `label` es el título de la tarjeta; el resto, su texto.
 */

/**
 * Tipos de paso disponibles en la paleta.
 *  - `color`  acento de la tarjeta, del minimapa y de la paleta.
 *  - `pill`   se dibuja como cápsula compacta (solo el título), no como tarjeta.
 *  - `solid`  cápsula rellena en su color (el paso de entrada).
 */
export const GRUPOS = {
  inicio: { color: "#12b76a", nombre: "Inicio", pill: true, solid: true },
  mensaje: { color: "#38bdf8", nombre: "Mensaje" },
  opciones: { color: "#60a5fa", nombre: "Menú de opciones" },
  pregunta: { color: "#34d399", nombre: "Pregunta" },
  captura: { color: "#fb923c", nombre: "Captura de datos" },
  condicion: { color: "#2dd4bf", nombre: "Condición" },
  accion: { color: "#a78bfa", nombre: "Acción / integración" },
  seguimiento: { color: "#f472b6", nombre: "Seguimiento" },
  handoff: { color: "#818cf8", nombre: "Handoff a humano" },
  fin: { color: "#f87171", nombre: "Fin", pill: true },
  global: { color: "#c084fc", nombre: "Comandos globales" },
};

export const flujoData = {
  nodes: [
    // ── Entrada ──
    { id: "start", group: "inicio", label: "Inicio" },
    { id: "bienvenida", group: "mensaje", label: "Bienvenida\n¡Hola! Soy tu asistente virtual.\n¿En qué te puedo ayudar hoy?" },

    // ── Menú principal ──
    { id: "menu", group: "opciones", label: "MENÚ PRINCIPAL\n[Información] · [Dejar mis datos]\n[Hablar con una persona]" },

    // ── Comandos globales (desde cualquier paso) ──
    { id: "g_menu", group: "global", label: "«menú» → vuelve al menú principal" },
    { id: "g_humano", group: "global", label: "«asesor» → handoff a una persona\n(desde cualquier paso)" },

    // ── Rama: información ──
    { id: "info", group: "mensaje", label: "Responde la duda\n(horarios, precios, cobertura…)" },
    { id: "info_util", group: "pregunta", label: "¿Te sirvió esta respuesta?\n[Sí] · [No]" },

    // ── Rama: captura de datos ──
    { id: "pide_nombre", group: "captura", label: "¿Cuál es tu nombre?" },
    { id: "pide_correo", group: "captura", label: "¿Cuál es tu correo?" },
    { id: "valida_correo", group: "condicion", label: "¿El correo tiene formato válido?\n[Sí] · [No]" },
    { id: "reintento_correo", group: "captura", label: "Correo inválido\nEscríbelo de nuevo, por favor." },
    { id: "guarda_lead", group: "accion", label: "Guardar el contacto\n(llamada a tu API / CRM / hoja de cálculo)" },
    { id: "confirma", group: "mensaje", label: "Confirmación\n¡Listo! Te escribiremos muy pronto." },

    // ── Seguimiento ──
    { id: "recordatorio", group: "seguimiento", label: "Sin respuesta\nRecordatorio a las 2h / 24h\n(fin al segundo intento)" },

    // ── Salidas ──
    { id: "humano", group: "handoff", label: "Hablar con una persona\n(transfiere la conversación con el contexto)" },
    { id: "fin", group: "fin", label: "Fin\n¡Gracias por escribirnos!" },
  ],

  edges: [
    { from: "start", to: "bienvenida" },
    { from: "bienvenida", to: "menu" },

    // menú → ramas
    { from: "menu", to: "info", label: "Información" },
    { from: "menu", to: "pide_nombre", label: "Dejar mis datos" },
    { from: "menu", to: "humano", label: "Hablar con una persona" },
    { from: "menu", to: "recordatorio", label: "sin respuesta", dashes: true },

    // información
    { from: "info", to: "info_util" },
    { from: "info_util", to: "menu", label: "Sí" },
    { from: "info_util", to: "humano", label: "No" },

    // captura de datos
    { from: "pide_nombre", to: "pide_correo" },
    { from: "pide_correo", to: "valida_correo" },
    { from: "valida_correo", to: "guarda_lead", label: "Sí" },
    { from: "valida_correo", to: "reintento_correo", label: "No" },
    { from: "reintento_correo", to: "valida_correo" },
    { from: "guarda_lead", to: "confirma" },
    { from: "confirma", to: "fin" },

    // seguimiento
    { from: "recordatorio", to: "menu", label: "responde", dashes: true },
    { from: "recordatorio", to: "fin", label: "no responde", dashes: true },

    // comandos globales
    { from: "g_menu", to: "menu", dashes: true },
    { from: "g_humano", to: "humano", dashes: true },

    { from: "humano", to: "fin" },
  ],
};
