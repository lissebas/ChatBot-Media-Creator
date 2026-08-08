/*
 * Flujo del bot de campo de G&S Legal ("Amaranta"), reconstruido como tarjetas
 * de la WhatsApp Cloud API.
 *
 * Origen: chatbot/app/bot_wa.py del proyecto GYS-Legal (wizard de informes de
 * asistencia jurídica). Allí el flujo es una lista de pasos que el motor recorre
 * por índice, insertando bloques según las respuestas; aquí queda desplegado
 * como grafo, que es como se ve y se edita en el lienzo.
 *
 * Los textos y los catálogos son los del bot; los ids de fila/botón son los que
 * el bot manda a Meta, para que el JSON generado sea el mismo.
 */

/* ── Catálogos (common/gys_common/config.py) ── */
const ASEGURADORAS = ["MAPFRE", "SOLIDARIA", "ZURICH", "HDI", "BOLIVAR", "ASISYA"];
const TIPOS_SERVICIO = ["TELEFONICA", "ABOGADO IN SITU", "AUDIENCIA DE CONCILIACION", "PRELIMINAR"];
const PRECONCEPTOS = [
  "REC TERCERO", "REC ASEGURADO", "REC POR DETERMINAR",
  "REC COMPARTIDA", "TERCERO EN FUGA", "HURTO",
];
const TIPOS_ACUERDO = [
  "VERBAL", "LEY 2251", "NINGUN ACUERDO", "CARTA DE INVITACION", "CONTRATO DE TRANSACCION",
];
// El bot pagina esta lista: 9 + OTRO en la primera página, el resto en la segunda
// (WhatsApp permite 10 filas por mensaje).
const ASEG_TERCERO_1 = [
  "ALLIANZ", "SBS", "SURA", "SEGUROS DEL ESTADO", "PREVISORA",
  "LIBERTY", "SHUBB", "MAPFRE", "BOLIVAR",
];
const ASEG_TERCERO_2 = [
  "AXA COLPATRIA", "EQUIDAD", "SOLIDARIA", "ZURICH", "HDI",
  "QUALITAS", "NO SUMINISTRA", "ASISYA",
];
// Título corto por el límite de 24 caracteres de las filas.
const RESULTADOS = [
  ["SITIO", "SITIO"],
  ["DESISTIMIENTO DE LESIONES", "DESIST. LESIONES"],
  ["PRELIMINAR LESIONES (LIBERACION)", "PRELIM. LESIONES"],
  ["PRELIMINAR HOMICIDIO (LIBERACION)", "PRELIM. HOMICIDIO"],
  ["ORIENTACION TELEFONICA", "ORIENTACION TELEFONICA"],
  ["AUDIENCIA DE CONCILIACION", "AUDIENCIA CONCIL."],
];
const ROLES = ["CONDUCTOR ASEGURADO", "CONDUCTOR TERCERO", "PEATÓN", "PASAJERO", "OTRO"];
const TIPOS_LESION = ["LEVE", "MODERADA", "GRAVE", "GRAVÍSIMA"];
const TIPOS_LIBERACION = [
  "DESIST. AUTENTICADO", "ORDEN JUDICIAL", "LIBERTAD CONDICIONAL", "HABEAS CORPUS", "OTRO",
];
const QUIEN_PAGA = ["ASEGURADORA", "ASEGURADO", "TERCERO", "SIN PAGO"];

/* ── Constructores de tarjeta ── */

/** Mensaje de texto que espera respuesta escrita. */
const pregunta = (id, title, body) => ({ id, card: "text", title, props: { body, wait_reply: true } });

/** Mensaje de texto informativo (el bot sigue solo). */
const aviso = (id, title, body) => ({ id, card: "text", title, props: { body } });

/** Paso de foto: el bot manda el texto y espera la imagen. */
const foto = (id, title, body) => ({ id, card: "text", title, props: { body, wait_reply: true } });

/** Lista interactiva con el encabezado/pie que usa `enviar_lista`. */
const lista = (id, title, body, seccion, rows) => ({
  id,
  card: "list",
  title,
  props: {
    header_text: "G&S Legal",
    body,
    footer: "Seleccione una opción",
    button: "Ver opciones",
    sections: [{ title: seccion.slice(0, 24), rows }],
  },
});

/** Botones de respuesta (máx. 3). */
const botones = (id, title, body, btns) => ({
  id,
  card: "buttons",
  title,
  props: { body, buttons: btns },
});

/** Filas a partir de un catálogo: el id es el texto completo, como en el bot. */
const filas = (arr) => arr.map((a) => ({ id: a, title: a.slice(0, 24) }));

const SI_NO = [
  { id: "si", title: "✅ SÍ" },
  { id: "no", title: "❌ NO" },
];

export const nodes = [
  { id: "start", card: "start", title: "Inicio", props: {} },

  /* ── Entrada: saludo y casos asignados ── */
  botones(
    "saludo",
    "Saludo · ¿casos asignados?",
    "👋 Hola *abogado*. Tienes *N* caso(s) asignado(s).\n\n¿Qué deseas hacer?",
    [
      { id: "ver_asignados", title: "Mis casos asignados" },
      { id: "nuevo_caso", title: "Nuevo caso" },
    ],
  ),
  lista(
    "casos_asignados",
    "Casos asignados",
    "Tus casos asignados — elige cuál completar:",
    "Casos por llenar",
    [
      { id: "caso:GYS-EJEMPLO1", title: "PXP236", description: "ABOGADO IN SITU · MAPFRE" },
      { id: "caso:GYS-EJEMPLO2", title: "KIH609", description: "TELEFONICA · SOLIDARIA" },
    ],
  ),
  aviso(
    "caso_precargado",
    "Caso asignado (pre-cargado)",
    "📋 *Caso asignado*\n\n• Placa: *PXP236*\n• N° asistencia: *123456*\n• Servicio: *ABOGADO IN SITU*\n• Aseguradora: *MAPFRE*\n\nYa tengo esos datos ✅ — completemos lo que falta 👇",
  ),
  aviso(
    "intro_1",
    "Presentación",
    "👋 Hola *abogado*.\n\nSoy *Amaranta*, el asistente de G&S Legal.\nVoy a guiarte para registrar el informe de asistencia jurídica paso a paso.\n\n⏱ *Tiempo estimado: 5 a 10 minutos.*",
  ),
  pregunta(
    "intro_2",
    "Checklist + comandos",
    "📋 *Antes de comenzar, ten a la mano:*\n\n• Número de asistencia y datos de la póliza\n• Datos completos del conductor asegurado\n• Datos del tercero (si aplica)\n• Fotos de los documentos: cédula, licencias\n• Fotos del vehículo (frente, laterales, trasera)\n• Hoja de asistencia firmada\n• Selfie en el lugar del siniestro\n\n📝 *Comandos útiles:*\n• Escribe *corregir* para volver al campo anterior\n• Escribe *reiniciar* para empezar de nuevo\n\nCuando estés listo, responde *listo* ✅",
  ),
  aviso("arranque", "Arranque", "¡Perfecto! Empecemos. 🚀"),

  /* ── Datos del caso ── */
  lista("aseguradora", "Aseguradora", "¿Cuál es la *aseguradora*?", "Aseguradoras", filas(ASEGURADORAS)),
  pregunta("no_asistencia", "N° de asistencia", "¿Cuál es el *número de asistencia*?"),
  pregunta("placa", "Placa del asegurado", "¿Cuál es la *placa del vehículo asegurado*?"),
  lista("tipo_servicio", "Tipo de servicio", "¿Cuál es el *tipo de servicio*?", "Tipo de servicio", filas(TIPOS_SERVICIO)),
  pregunta(
    "departamento",
    "Departamento",
    "¿En qué *departamento* ocurrió el siniestro?\n_(Ej: CUNDINAMARCA, ANTIOQUIA, VALLE DEL CAUCA, SANTANDER, ATLÁNTICO...)_",
  ),
  pregunta("ciudad", "Ciudad o municipio", "¿En qué *ciudad o municipio*?"),
  botones("fecha_siniestro", "Fecha del siniestro", "¿Cuál fue la *fecha del siniestro*?", [
    { id: "hoy", title: "📅 Hoy" },
    { id: "ayer", title: "📅 Ayer" },
    { id: "otra_fecha", title: "✏️ Otra fecha" },
  ]),
  pregunta(
    "fecha_manual",
    "Fecha escrita a mano",
    "✏️ Escribe la *fecha del siniestro* en formato DD/MM/AAAA\n_(Ej: 03/07/2026)_",
  ),
  pregunta("hora_siniestro", "Hora del siniestro", "¿A qué *hora* ocurrió? (HH:MM, 24h)"),
  pregunta("nombre_conductor", "Nombre del conductor", "¿Cuál es el *nombre completo del conductor*?"),
  pregunta("cc_conductor", "Cédula del conductor", "¿Cuál es la *cédula del conductor*?"),
  pregunta("tel_conductor", "Teléfono del conductor", "¿Cuál es el *teléfono del conductor*?"),
  botones(
    "mismo_conductor",
    "¿Titular = conductor?",
    "¿El *titular de la póliza* es el *mismo conductor*?",
    SI_NO,
  ),
  pregunta("nombre_asegurado", "Nombre del asegurado", "¿Cuál es el *nombre del titular de la póliza* (asegurado)?"),
  pregunta("cc_asegurado", "Cédula del asegurado", "¿Cuál es la *cédula del asegurado*?"),
  botones("hay_tercero", "¿Hay tercero?", "¿Hay *tercero* involucrado en el siniestro?", SI_NO),

  /* ── Tercero ── */
  pregunta("placa_tercero", "Placa del tercero", "¿Cuál es la *placa del vehículo del tercero*?"),
  pregunta("nombre_tercero", "Nombre del tercero", "¿Cuál es el *nombre del tercero*?"),
  pregunta("cc_tercero", "Cédula del tercero", "¿Cuál es la *cédula del tercero*?"),
  pregunta("tel_tercero", "Teléfono del tercero", "¿Cuál es el *teléfono del tercero*?"),
  lista(
    "aseg_tercero",
    "Aseguradora del tercero (1/2)",
    "¿Cuál es la *aseguradora del tercero*?",
    "Aseguradoras",
    [...filas(ASEG_TERCERO_1), { id: "OTRO", title: "OTRO" }],
  ),
  lista(
    "aseg_tercero_2",
    "Aseguradora del tercero (2/2)",
    "¿Cuál es la *aseguradora del tercero*?",
    "Más aseguradoras",
    filas(ASEG_TERCERO_2),
  ),
  foto(
    "foto_cedula_tercero",
    "📷 Cédula del tercero",
    "📷 Foto de la *cédula del tercero*.\nEscriba _omitir_ si no tiene.",
  ),

  /* ── Análisis del caso ── */
  pregunta("relato", "Relato del siniestro", "Escriba el *relato del siniestro* (tal como lo narró el conductor):"),
  lista("preconcepto", "Preconcepto", "¿Cuál es el *preconcepto de responsabilidad*?", "Preconcepto", filas(PRECONCEPTOS)),
  lista("tipo_acuerdo", "Tipo de acuerdo", "¿Cuál es el *tipo de acuerdo*?", "Tipo de acuerdo", filas(TIPOS_ACUERDO)),
  botones("posibilidad_recobro", "¿Posibilidad de recobro?", "¿Hay *posibilidad de recobro*?", SI_NO),
  pregunta(
    "concepto_responsabilidad",
    "Concepto de responsabilidad",
    "Indique el *concepto de responsabilidad* según su criterio jurídico:",
  ),
  botones("informe_transito", "¿Informe de tránsito?", "¿Hay *informe de tránsito* (comparendo/Policía)?", SI_NO),
  pregunta(
    "observaciones",
    "Observaciones",
    "¿Alguna *observación adicional*? (lesiones, testigos, vía...)\nSi no hay, responda _ninguna_.",
  ),
  lista(
    "resultado_servicio",
    "Resultado del servicio",
    "¿Cuál fue el *resultado del servicio*?",
    "Resultado",
    RESULTADOS.map(([id, title]) => ({ id, title })),
  ),

  /* ── Bifurcación: audiencia de conciliación ── */
  botones(
    "tipo_autorizacion",
    "Tipo de autorización",
    "¿Cuál es el *tipo de autorización* para la audiencia?",
    [
      { id: "ACOMPAÑAMIENTO", title: "ACOMPAÑAMIENTO" },
      { id: "CONVOCAR", title: "CONVOCAR" },
    ],
  ),

  /* ── Bifurcación: desistimiento de lesiones ── */
  lista("des_rol", "Rol en el accidente", "¿Cuál es el *rol en el accidente*?", "Rol en el accidente", filas(ROLES)),
  pregunta("des_num_lesionados", "N° de lesionados", "¿Cuántos *lesionados* hay?"),
  pregunta("des_les_nombre", "👤 Lesionado — nombre", "👤 *Lesionado 1/N* — ¿Nombre completo?"),
  pregunta("des_les_cc", "👤 Lesionado — cédula", "👤 *Lesionado 1/N* — ¿Cédula?"),
  pregunta("des_les_tel", "👤 Lesionado — teléfono", "👤 *Lesionado 1/N* — ¿Teléfono?"),
  foto(
    "des_doc_les",
    "📷 Doc. del lesionado",
    "📷 *Doc. lesionado 1/N* — Documento de identidad.\nEscriba _omitir_ si no tiene.",
  ),
  botones("des_embarazada", "¿Embarazada?", "¿El/la lesionado(a) está *embarazada*?", SI_NO),
  botones("des_obedece", "¿Obedece órdenes?", "¿El/la lesionado(a) *obedece órdenes*?", SI_NO),
  botones("des_orientado", "¿Está orientado(a)?", "¿El/la lesionado(a) *está orientado(a)*?", SI_NO),
  lista("des_tipo_lesion", "Tipo de lesión", "¿Cuál es el *tipo de lesión*?", "Tipo de lesión", filas(TIPOS_LESION)),
  pregunta("des_descripcion", "Descripción de lesiones", "Describa las *lesiones* en detalle:"),
  lista("des_tipo_acuerdo", "Tipo de acuerdo (lesiones)", "¿Cuál es el *tipo de acuerdo*?", "Tipo de acuerdo", filas(TIPOS_ACUERDO)),
  lista("des_quien_paga", "¿Quién paga?", "¿Quién *realiza el pago*?", "¿Quién realiza el pago?", filas(QUIEN_PAGA)),
  pregunta("des_valor", "Valor del acuerdo", "¿Cuál es el *valor del acuerdo*?\n_(Si es sin pago escriba 0)_"),
  foto("des_sarlaft", "📷 SARLAFT", "📷 *Docs indemnización 1/4* — SARLAFT.\nEscriba _omitir_ si no tiene."),
  foto("des_cert_bancaria", "📷 Certificación bancaria", "📷 *Docs indemnización 2/4* — Certificación bancaria.\nEscriba _omitir_ si no tiene."),
  foto("des_contrato", "📷 Contrato", "📷 *Docs indemnización 3/4* — Contrato.\nEscriba _omitir_ si no tiene."),
  foto("des_formato_1", "📷 Desistimiento 1/3", "📷 *Formato desistimiento 1/3*.\nEscriba _omitir_ si no tiene."),
  foto("des_formato_2", "📷 Desistimiento 2/3", "📷 *Formato desistimiento 2/3*.\nEscriba _omitir_ si no tiene."),
  foto("des_formato_3", "📷 Desistimiento 3/3", "📷 *Formato desistimiento 3/3*.\nEscriba _omitir_ si no tiene."),
  foto("des_firma", "✍️ Firma", "✍️ *Firma* del asegurado o conductor — envíe foto de la firma."),

  /* ── Bifurcación: preliminar lesiones ── */
  lista("pl_rol", "Rol en el accidente", "¿Cuál es el *rol en el accidente*?", "Rol en el accidente", filas(ROLES)),
  pregunta("pl_num_lesionados", "N° de lesionados", "¿Cuántos *lesionados* hay?"),
  pregunta("pl_les_nombre", "👤 Lesionado — nombre", "👤 *Lesionado 1/N* — ¿Nombre completo?"),
  pregunta("pl_les_cc", "👤 Lesionado — cédula", "👤 *Lesionado 1/N* — ¿Cédula?"),
  pregunta("pl_les_tel", "👤 Lesionado — teléfono", "👤 *Lesionado 1/N* — ¿Teléfono?"),
  foto("pl_doc_les", "📷 Doc. del lesionado", "📷 *Doc. lesionado 1/N* — Documento de identidad.\nEscriba _omitir_ si no tiene."),
  lista("pl_severidad", "Severidad de lesiones", "¿Cuál es la *severidad de las lesiones*?", "Severidad", filas(TIPOS_LESION)),
  lista("pl_tipo_liberacion", "Tipo de liberación", "¿Cuál es el *tipo de liberación*?", "Tipo de liberación", filas(TIPOS_LIBERACION)),
  foto("pl_ipat_1", "📷 IPAT 1/3", "📷 *IPAT 1/3*.\nEscriba _omitir_ si no tiene."),
  foto("pl_ipat_2", "📷 IPAT 2/3", "📷 *IPAT 2/3*.\nEscriba _omitir_ si no tiene."),
  foto("pl_ipat_3", "📷 IPAT 3/3", "📷 *IPAT 3/3*.\nEscriba _omitir_ si no tiene."),
  pregunta("pl_no_concilio", "¿Por qué no se concilió?", "¿Por qué *no se concilió en sitio*? Describa brevemente:"),
  foto(
    "pl_otros",
    "📷 Otros documentos",
    "📷 *Otros documentos* (desistimiento autenticado + factura grúa/patios si aplica).\nEscriba _omitir_ si no tiene.",
  ),

  /* ── Bifurcación: preliminar homicidio ── */
  lista("ph_rol", "Rol en el accidente", "¿Cuál es el *rol en el accidente*?", "Rol en el accidente", filas(ROLES)),
  pregunta("ph_num_fallecidos", "N° de fallecidos", "¿Cuántos *fallecidos* hay?"),
  pregunta("ph_fall_nombre", "👤 Fallecido — nombre", "👤 *Fallecido 1/N* — ¿Nombre completo?"),
  pregunta("ph_fall_cc", "👤 Fallecido — cédula", "👤 *Fallecido 1/N* — ¿Cédula?"),
  pregunta("ph_fall_tel", "👤 Fallecido — teléfono familiar", "👤 *Fallecido 1/N* — ¿Teléfono de familiar?"),
  foto("ph_doc_1", "📷 Doc. fallecido 1", "📷 *Doc. fallecido 1*.\nEscriba _omitir_ si no tiene."),
  foto("ph_doc_2", "📷 Doc. fallecido 2", "📷 *Doc. fallecido 2*.\nEscriba _omitir_ si no tiene."),
  foto("ph_ipat_1", "📷 IPAT 1/2", "📷 *IPAT 1/2*.\nEscriba _omitir_ si no tiene."),
  foto("ph_ipat_2", "📷 IPAT 2/2", "📷 *IPAT 2/2*.\nEscriba _omitir_ si no tiene."),
  foto("ph_firma", "✍️ Firma", "✍️ *Firma* del asegurado o conductor — envíe foto de la firma."),

  /* ── Documentos del asegurado ── */
  foto("foto_cedula_cond", "📷 Cédula del conductor", "📷 *Docs asegurado 1/3* — Foto de la *cédula del conductor*."),
  foto(
    "foto_lic_conduccion",
    "📷 Licencia de conducción",
    "📷 *Docs asegurado 2/3* — Foto de la *licencia de conducción*.\nEscriba _omitir_ si no tiene.",
  ),
  foto(
    "foto_lic_transito",
    "📷 Licencia de tránsito",
    "📷 *Docs asegurado 3/3* — Foto de la *licencia de tránsito*.\nEscriba _omitir_ si no tiene.",
  ),

  /* ── Posición final del vehículo ── */
  foto("foto_frente", "📷 Frente", "📷 *Posición final 1/4* — Foto FRENTE del vehículo asegurado."),
  foto("foto_lat_izq", "📷 Lateral izquierda", "📷 *Posición final 2/4* — Foto LATERAL IZQUIERDA."),
  foto("foto_lat_der", "📷 Lateral derecha", "📷 *Posición final 3/4* — Foto LATERAL DERECHA."),
  foto("foto_trasera", "📷 Trasera", "📷 *Posición final 4/4* — Foto TRASERA."),

  /* ── Evidencias ── */
  foto("foto_hoja_asistencia", "📷 Hoja de asistencia", "📷 *Evidencias 1/3* — Foto de la *hoja de asistencia* firmada."),
  foto("foto_selfi", "📷 Selfie del abogado", "📷 *Evidencias 2/3* — *Selfie* del abogado en el lugar del siniestro."),
  foto(
    "foto_pantallazo",
    "📷 Pantallazo de llamada",
    "📷 *Evidencias 3/3* — *Pantallazo de llamada*.\n_(Obligatorio en casos telefónicos; escriba omitir solo si NO es telefónico.)_",
  ),

  /* ── Fotos extra, resumen y cierre ── */
  botones("mas_fotos", "¿Más fotos?", "📷 ¿Desea cargar más fotos antes de generar el PDF?", [
    { id: "mas_fotos_si", title: "✅ Sí" },
    { id: "mas_fotos_no", title: "❌ No, continuar" },
  ]),
  pregunta(
    "cargar_fotos",
    "Carga libre de fotos",
    "📷 Envía *todas* las fotos que necesites (una por una o en álbum).\n\nCuando termines de cargar las fotos, escribe *Listo* ✅ para generar el PDF.",
  ),
  aviso(
    "resumen",
    "Resumen del informe",
    "📋 *Revisa el informe antes de generar el PDF:*\n\n• Asistencia #: *123456*\n• Aseguradora: *MAPFRE*\n• Placa: *PXP236*\n• Servicio: *ABOGADO IN SITU*\n• Fecha/Hora: *03/07/2026 14:30*\n• Lugar: *BOGOTÁ, CUNDINAMARCA*\n\n👤 *Conductor*\n• NOMBRE  CC 00000000\n• Tel: 3001234567\n\n📝 *Caso*\n• Preconcepto · Acuerdo · Resultado · Tercero",
  ),
  botones("confirmar", "Confirmar informe", "¿Los datos son correctos? Confirma para generar el PDF.", [
    { id: "confirmar_pdf", title: "✅ Generar PDF" },
    { id: "corregir", title: "✏️ Corregir" },
  ]),
  aviso("correccion", "Corrección", "↩️ Vamos a corregir el campo anterior:"),
  aviso("generando", "Generando PDF", "⏳ *Generando el PDF del informe...* Un momento."),
  {
    id: "pdf",
    card: "document",
    title: "📄 Informe en PDF",
    props: {
      link: "https://gys-legal.s4v8m0g3gj5k6.us-west-2.cs.amazonlightsail.com/api/pdf/GYS-PXP236",
      filename: "GYS-PXP236.pdf",
      caption: "📄 Asistencia #123456 · Placa PXP236 · MAPFRE",
    },
  },
  aviso(
    "final",
    "Cierre",
    "✅ *¡Todo listo!*\n\nEl informe *GYS-PXP236* fue generado y enviado a la firma.\nEl sistema Amaranta procesará el caso automáticamente.\n\nEscribe *nuevo* o *asistencia* para registrar otro caso.",
  ),
  { id: "fin", card: "end", title: "Fin", props: {} },

  /* ── Documentación de los comandos globales (nodo suelto, sin conexiones) ── */
  aviso(
    "comandos_globales",
    "Comandos globales",
    "Disponibles en cualquier paso:\n• *corregir* → vuelve al campo anterior\n• *reiniciar* / *nuevo* → empieza de cero\n• *mis casos* → lista de casos asignados\n\nLa sesión expira a las 23 h de inactividad (ventana de 24 h de Meta).",
  ),
];

/** Encadena una secuencia lineal de nodos con la salida por defecto. */
function cadena(ids) {
  return ids.slice(0, -1).map((from, i) => ({ from, to: ids[i + 1] }));
}

/** Abre una salida por cada fila/botón del nodo y las lleva todas al mismo paso. */
function abanico(from, salidas, to) {
  return salidas.map((s) => ({ from, out: s, to, label: s.length > 18 ? `${s.slice(0, 17)}…` : s }));
}

export const edges = [
  /* Entrada */
  { from: "start", to: "saludo" },
  { from: "saludo", out: "ver_asignados", to: "casos_asignados", label: "Mis casos asignados" },
  { from: "saludo", out: "nuevo_caso", to: "intro_1", label: "Nuevo caso" },
  { from: "casos_asignados", out: "caso:GYS-EJEMPLO1", to: "caso_precargado", label: "elige un caso" },
  { from: "casos_asignados", out: "caso:GYS-EJEMPLO2", to: "caso_precargado", label: "elige un caso" },
  { from: "caso_precargado", to: "aseguradora", label: "salta lo ya conocido", dashes: true },
  ...cadena(["intro_1", "intro_2", "arranque", "aseguradora"]),

  /* Datos del caso */
  ...abanico("aseguradora", ASEGURADORAS, "no_asistencia"),
  ...cadena(["no_asistencia", "placa", "tipo_servicio"]),
  ...abanico("tipo_servicio", TIPOS_SERVICIO, "departamento"),
  ...cadena(["departamento", "ciudad", "fecha_siniestro"]),
  { from: "fecha_siniestro", out: "hoy", to: "hora_siniestro", label: "Hoy" },
  { from: "fecha_siniestro", out: "ayer", to: "hora_siniestro", label: "Ayer" },
  { from: "fecha_siniestro", out: "otra_fecha", to: "fecha_manual", label: "Otra fecha" },
  { from: "fecha_manual", to: "hora_siniestro" },
  ...cadena(["hora_siniestro", "nombre_conductor", "cc_conductor", "tel_conductor", "mismo_conductor"]),
  { from: "mismo_conductor", out: "si", to: "hay_tercero", label: "SÍ (mismo conductor)" },
  { from: "mismo_conductor", out: "no", to: "nombre_asegurado", label: "NO" },
  ...cadena(["nombre_asegurado", "cc_asegurado", "hay_tercero"]),

  /* Tercero */
  { from: "hay_tercero", out: "si", to: "placa_tercero", label: "SÍ, hay tercero" },
  { from: "hay_tercero", out: "no", to: "relato", label: "Sin tercero" },
  ...cadena(["placa_tercero", "nombre_tercero", "cc_tercero", "tel_tercero", "aseg_tercero"]),
  ...abanico("aseg_tercero", ASEG_TERCERO_1, "foto_cedula_tercero"),
  { from: "aseg_tercero", out: "OTRO", to: "aseg_tercero_2", label: "OTRO → más opciones" },
  ...abanico("aseg_tercero_2", ASEG_TERCERO_2, "foto_cedula_tercero"),
  { from: "foto_cedula_tercero", to: "relato" },

  /* Análisis */
  { from: "relato", to: "preconcepto" },
  ...abanico("preconcepto", PRECONCEPTOS, "tipo_acuerdo"),
  ...abanico("tipo_acuerdo", TIPOS_ACUERDO, "posibilidad_recobro"),
  { from: "posibilidad_recobro", out: "si", to: "concepto_responsabilidad", label: "SÍ" },
  { from: "posibilidad_recobro", out: "no", to: "concepto_responsabilidad", label: "NO" },
  { from: "concepto_responsabilidad", to: "informe_transito" },
  { from: "informe_transito", out: "si", to: "observaciones", label: "SÍ" },
  { from: "informe_transito", out: "no", to: "observaciones", label: "NO" },
  { from: "observaciones", to: "resultado_servicio" },

  /* Bifurcación por resultado del servicio */
  { from: "resultado_servicio", out: "SITIO", to: "foto_cedula_cond", label: "SITIO" },
  { from: "resultado_servicio", out: "ORIENTACION TELEFONICA", to: "foto_cedula_cond", label: "ORIENTACIÓN TELEFÓNICA" },
  { from: "resultado_servicio", out: "AUDIENCIA DE CONCILIACION", to: "tipo_autorizacion", label: "AUDIENCIA" },
  { from: "resultado_servicio", out: "DESISTIMIENTO DE LESIONES", to: "des_rol", label: "DESISTIMIENTO" },
  { from: "resultado_servicio", out: "PRELIMINAR LESIONES (LIBERACION)", to: "pl_rol", label: "PRELIM. LESIONES" },
  { from: "resultado_servicio", out: "PRELIMINAR HOMICIDIO (LIBERACION)", to: "ph_rol", label: "PRELIM. HOMICIDIO" },

  /* Audiencia */
  { from: "tipo_autorizacion", out: "ACOMPAÑAMIENTO", to: "foto_cedula_cond", label: "ACOMPAÑAMIENTO" },
  { from: "tipo_autorizacion", out: "CONVOCAR", to: "foto_cedula_cond", label: "CONVOCAR" },

  /* Desistimiento de lesiones */
  ...abanico("des_rol", ROLES, "des_num_lesionados"),
  ...cadena(["des_num_lesionados", "des_les_nombre", "des_les_cc", "des_les_tel", "des_doc_les", "des_embarazada"]),
  { from: "des_embarazada", out: "si", to: "des_obedece", label: "SÍ" },
  { from: "des_embarazada", out: "no", to: "des_obedece", label: "NO" },
  { from: "des_obedece", out: "si", to: "des_orientado", label: "SÍ" },
  { from: "des_obedece", out: "no", to: "des_orientado", label: "NO" },
  { from: "des_orientado", out: "si", to: "des_tipo_lesion", label: "SÍ" },
  { from: "des_orientado", out: "no", to: "des_tipo_lesion", label: "NO" },
  ...abanico("des_tipo_lesion", TIPOS_LESION, "des_descripcion"),
  { from: "des_descripcion", to: "des_tipo_acuerdo" },
  ...abanico("des_tipo_acuerdo", TIPOS_ACUERDO, "des_quien_paga"),
  ...abanico("des_quien_paga", QUIEN_PAGA, "des_valor"),
  ...cadena([
    "des_valor", "des_sarlaft", "des_cert_bancaria", "des_contrato",
    "des_formato_1", "des_formato_2", "des_formato_3", "des_firma", "foto_cedula_cond",
  ]),

  /* Preliminar lesiones */
  ...abanico("pl_rol", ROLES, "pl_num_lesionados"),
  ...cadena(["pl_num_lesionados", "pl_les_nombre", "pl_les_cc", "pl_les_tel", "pl_doc_les", "pl_severidad"]),
  ...abanico("pl_severidad", TIPOS_LESION, "pl_tipo_liberacion"),
  ...abanico("pl_tipo_liberacion", TIPOS_LIBERACION, "pl_ipat_1"),
  ...cadena(["pl_ipat_1", "pl_ipat_2", "pl_ipat_3", "pl_no_concilio", "pl_otros", "foto_cedula_cond"]),

  /* Preliminar homicidio */
  ...abanico("ph_rol", ROLES, "ph_num_fallecidos"),
  ...cadena([
    "ph_num_fallecidos", "ph_fall_nombre", "ph_fall_cc", "ph_fall_tel",
    "ph_doc_1", "ph_doc_2", "ph_ipat_1", "ph_ipat_2", "ph_firma", "foto_cedula_cond",
  ]),

  /* Documentos, posición final y evidencias */
  ...cadena([
    "foto_cedula_cond", "foto_lic_conduccion", "foto_lic_transito",
    "foto_frente", "foto_lat_izq", "foto_lat_der", "foto_trasera",
    "foto_hoja_asistencia", "foto_selfi", "foto_pantallazo", "mas_fotos",
  ]),

  /* Fotos extra, resumen y cierre */
  { from: "mas_fotos", out: "mas_fotos_si", to: "cargar_fotos", label: "Sí" },
  { from: "mas_fotos", out: "mas_fotos_no", to: "resumen", label: "No, continuar" },
  { from: "cargar_fotos", to: "resumen", label: "escribe «Listo»" },
  { from: "resumen", to: "confirmar" },
  { from: "confirmar", out: "confirmar_pdf", to: "generando", label: "Generar PDF" },
  { from: "confirmar", out: "corregir", to: "correccion", label: "Corregir" },
  { from: "correccion", to: "resumen", label: "vuelve al resumen", dashes: true },
  ...cadena(["generando", "pdf", "final", "fin"]),
];

export default { nombre: "G&S Legal · informe de campo", nodes, edges };
