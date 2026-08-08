/*
 * Flujo SEMILLA de ChatBot Creator.
 *
 * Ejemplo genérico que se carga la primera vez para que el lienzo no arranque
 * vacío y se vea cómo se combinan las tarjetas de la WhatsApp Cloud API. Después
 * el editor guarda tus cambios en el navegador (localStorage); puedes exportar /
 * importar el flujo como JSON o pulsar «Reiniciar» para volver a este ejemplo.
 *
 * Formato:
 *   nodes: { id, card, title, props }        → `card` es una clave de CARDS.
 *   edges: { from, out?, to, label? }        → `out` es la salida del nodo origen
 *                                              (id de botón / fila). Por defecto "next".
 */
export const flujoData = {
  nodes: [
    {
      id: "start",
      card: "start",
      title: "Inicio",
      props: {},
    },
    {
      id: "bienvenida",
      card: "text",
      title: "Bienvenida",
      props: {
        body: "¡Hola! 👋 Soy tu asistente virtual. Estoy aquí para ayudarte.",
      },
    },
    {
      id: "menu",
      card: "buttons",
      title: "Menú principal",
      props: {
        body: "¿Qué te gustaría hacer?",
        footer: "Elige una opción",
        buttons: [
          { id: "btn_info", title: "Información" },
          { id: "btn_datos", title: "Dejar mis datos" },
          { id: "btn_humano", title: "Hablar con alguien" },
        ],
      },
    },
    {
      id: "info",
      card: "list",
      title: "Temas de información",
      props: {
        header_text: "Información",
        body: "Estos son los temas sobre los que puedo ayudarte:",
        button: "Ver temas",
        sections: [
          {
            title: "Temas frecuentes",
            rows: [
              { id: "row_horarios", title: "Horarios", description: "Cuándo atendemos" },
              { id: "row_precios", title: "Precios", description: "Planes y tarifas" },
              { id: "row_cobertura", title: "Cobertura", description: "Dónde tenemos servicio" },
            ],
          },
        ],
      },
    },
    {
      id: "horarios",
      card: "text",
      title: "Respuesta: horarios",
      props: { body: "Atendemos de lunes a viernes, de 8:00 a 18:00. 🕗" },
    },
    {
      id: "precios",
      card: "cta_url",
      title: "Respuesta: precios",
      props: {
        body: "Puedes ver todos los planes y tarifas en nuestra página.",
        footer: "Se abre en tu navegador",
        display_text: "Ver planes",
        url: "https://example.com/planes",
      },
    },
    {
      id: "cobertura",
      card: "image",
      title: "Respuesta: cobertura",
      props: {
        link: "https://example.com/mapa-cobertura.jpg",
        caption: "Este es nuestro mapa de cobertura actual.",
      },
    },
    {
      id: "pedir_ubicacion",
      card: "location_request",
      title: "Pedir ubicación",
      props: { body: "Compárteme tu ubicación y te digo si llegamos hasta allí." },
    },
    {
      id: "datos",
      card: "flow",
      title: "Formulario de contacto",
      props: {
        body: "Déjame tus datos y un asesor te contacta hoy mismo.",
        flow_id: "1234567890",
        flow_cta: "Dejar mis datos",
        flow_action: "navigate",
        screen: "CONTACT_FORM",
      },
    },
    {
      id: "gracias",
      card: "text",
      title: "Gracias",
      props: { body: "¡Listo! Recibimos tus datos, te escribimos muy pronto. 🙌" },
    },
    {
      id: "permiso_llamada",
      card: "call_permission_request",
      title: "Permiso para llamar",
      props: { body: "¿Nos autorizas a llamarte por WhatsApp para ayudarte mejor?" },
    },
    {
      id: "agente",
      card: "text",
      title: "Handoff a un asesor",
      props: { body: "Te comunico con un asesor humano. Un momento, por favor. 🧑‍💼" },
    },
    {
      id: "fin",
      card: "end",
      title: "Fin",
      props: {},
    },
  ],

  edges: [
    { from: "start", to: "bienvenida" },
    { from: "bienvenida", to: "menu" },

    { from: "menu", out: "btn_info", to: "info", label: "Información" },
    { from: "menu", out: "btn_datos", to: "datos", label: "Dejar mis datos" },
    { from: "menu", out: "btn_humano", to: "permiso_llamada", label: "Hablar con alguien" },

    { from: "info", out: "row_horarios", to: "horarios", label: "Horarios" },
    { from: "info", out: "row_precios", to: "precios", label: "Precios" },
    { from: "info", out: "row_cobertura", to: "cobertura", label: "Cobertura" },

    { from: "horarios", to: "fin" },
    { from: "precios", to: "fin" },
    { from: "cobertura", to: "pedir_ubicacion" },
    { from: "pedir_ubicacion", to: "fin" },

    { from: "datos", to: "gracias" },
    { from: "gracias", to: "fin" },

    { from: "permiso_llamada", out: "accept", to: "agente", label: "Acepta" },
    { from: "permiso_llamada", out: "reject", to: "fin", label: "Rechaza" },
    { from: "agente", to: "fin" },
  ],
};
