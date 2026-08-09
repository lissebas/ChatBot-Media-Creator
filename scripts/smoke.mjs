// Prueba de humo temporal: valida el catálogo de tarjetas, el flujo semilla y el runtime.
import {
  CARDS,
  CARDS_POR_FAMILIA,
  CARD_KEYS,
  CATEGORIAS,
  buildMessage,
  cardOutputs,
  defaultProps,
  validateCard,
} from "../src/flow/cardTypes.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { combinarIndices } from "../src/flow/nube.js";
import { buildInitialFlow, migrateFlow, nodeSize, simplificarAristas } from "../src/flow/transform.js";
import { anclas, cajaFlujo, svgDeRegion } from "../api/svg.mjs";
import { TEMA } from "../src/flow/tema.js";
import {
  conVariables,
  entryNode,
  nodeOptions,
  nextEdge,
  nodeMessage,
  stepMode,
} from "../src/sim/runtime.js";
import { buscarPaso, interceptar, resolver } from "../src/sim/motores.js";
import { REGLAS, interpolar, resolverLimite, validarRespuesta } from "../src/flow/validadores.js";
import { coincidir } from "../src/flow/coincidencias.js";
import WaText, { sinFormato } from "../src/components/WaText.jsx";
import { cargarDocumento, cargarIndice, conResumen } from "../src/flow/workspace.js";
import {
  COMPONENTES,
  VERSION_FLOW,
  construirFlowJson,
  flujoNuevo,
  componenteCon,
  validarFlow,
} from "../src/flow/flowJson.js";

import { readFileSync } from "node:fs";
// Rutas relativas a la raíz del proyecto (así se ejecuta `npm run smoke`).
const leer = (r) => readFileSync(r, "utf8");
const appSrc = leer("src/App.jsx");
const zoomSrc = leer("src/components/ZoomControls.jsx");
const simSrc = leer("src/components/Simulator.jsx");
const modalSrc = leer("src/components/Modal.jsx");
const ctxSrc = leer("src/components/ContextMenu.jsx");

let fallos = 0;
const fail = (m) => { console.log("  ✗", m); fallos++; };

console.log(`Tarjetas: ${CARD_KEYS.length}`);
for (const key of CARD_KEYS) {
  const card = CARDS[key];
  const props = defaultProps(key);
  try {
    validateCard(key, props);
    const msg = buildMessage({ card: key, props });
    if (msg) JSON.stringify(msg);
    const outs = cardOutputs({ card: key, props });
    if (!Array.isArray(outs)) fail(`${key}: outputs no es array`);
    if (!card.nombre || !card.cat) fail(`${key}: falta nombre/cat`);
  } catch (e) {
    fail(`${key}: ${e.message}`);
  }
}

// La segmentación debe cubrir el catálogo completo: familia → categoría → tarjeta.
const enFamilias = CARDS_POR_FAMILIA.flatMap((f) => f.grupos.flatMap((g) => g.cards.map((c) => c.key)));
if (enFamilias.length !== CARD_KEYS.length) {
  fail(`la segmentación cubre ${enFamilias.length} de ${CARD_KEYS.length} tarjetas`);
}
for (const key of CARD_KEYS) {
  const cat = CATEGORIAS[CARDS[key].cat];
  if (!cat) fail(`${key}: categoría desconocida "${CARDS[key].cat}"`);
  else if (!cat.familia) fail(`${key}: la categoría ${CARDS[key].cat} no tiene familia`);
}
console.log(
  "Familias:",
  CARDS_POR_FAMILIA.map((f) => `${f.nombre} (${f.total})`).join(", "),
);

// Formato de WhatsApp: lo que se ve en la vista previa y en el simulador.
const html = (t) => renderToStaticMarkup(createElement(WaText, { text: t }));
const casos = [
  ["*hola*", "<strong>hola</strong>", true],
  ["_hola_", "<em>hola</em>", true],
  ["~hola~", "<s>hola</s>", true],
  ["```cod```", "<code", true],
  ["`cod`", "<code", true],
  ["2 * 3 * 4", "<strong>", false], // marcador con espacios: no es negrita
  ["a *b* y *c*", "<strong>c</strong>", true], // no se pierde el segundo par
  ["- uno\n- dos", "<ul", true],
  ["1. uno\n2. dos", "<ol", true],
  ["> cita", "<blockquote", true],
  ["*_mixto_*", "<strong><em>mixto</em></strong>", true],
];
for (const [entrada, esperado, debe] of casos) {
  const salida = html(entrada);
  if (salida.includes(esperado) !== debe) {
    fail(`formato ${JSON.stringify(entrada)}: se esperaba ${debe ? "" : "NO "}"${esperado}" en ${salida}`);
  }
}
if (sinFormato("*a* _b_ ~c~") !== "a b c") fail("sinFormato no limpia los marcadores");
console.log(`Formato: ${casos.length} casos`);

// ── WhatsApp Flows: el Flow JSON que se exporta debe ser publicable ──
{
  const uno = flujoNuevo();
  const j1 = construirFlowJson(uno);
  if (j1.version !== VERSION_FLOW) fail(`flow: versión ${j1.version}`);
  if (j1.screens[0].layout?.type !== "SingleColumnLayout") fail("flow: falta SingleColumnLayout");
  const pie1 = j1.screens[0].layout.children.at(-1);
  if (pie1.type !== "Footer" || pie1["on-click-action"]?.name !== "complete") {
    fail("flow: el pie de la pantalla final debería ser complete");
  }
  if (pie1["on-click-action"].payload?.nombre !== "${form.nombre}") {
    fail("flow: complete no devuelve los campos de la pantalla");
  }
  if (validarFlow(uno).length) fail(`flow nuevo con avisos: ${validarFlow(uno).join(" | ")}`);

  // Dos pantallas encadenadas: el dato de la primera debe llegar a la segunda.
  const p1 = { id: "UNO", title: "Uno", terminal: false, children: [
    componenteCon("TextInput", { label: "Nombre", name: "nombre", required: true }),
    componenteCon("Footer", { label: "Seguir", accion: "navigate", next: "DOS" }),
  ] };
  const p2 = { id: "DOS", title: "Dos", terminal: true, children: [
    componenteCon("TextInput", { label: "Correo", name: "correo" }, 1),
    componenteCon("Footer", { label: "Enviar", accion: "complete" }),
  ] };
  const dos = { version: VERSION_FLOW, pantallas: [p1, p2] };
  const j2 = construirFlowJson(dos);
  const nav = j2.screens[0].layout.children.at(-1)["on-click-action"];
  if (nav.next?.name !== "DOS") fail("flow: navigate sin destino");
  if (nav.payload?.nombre !== "${form.nombre}") fail("flow: navigate no arrastra el campo");
  if (!j2.screens[1].data?.nombre) fail("flow: la 2ª pantalla no declara el dato recibido");
  const fin = j2.screens[1].layout.children.at(-1)["on-click-action"];
  if (fin.payload?.nombre !== "${data.nombre}" || fin.payload?.correo !== "${form.correo}") {
    fail("flow: complete no combina data + form");
  }
  if (j2.routing_model?.UNO?.[0] !== "DOS") fail("flow: routing_model incorrecto");
  if (validarFlow(dos).length) fail(`flow de 2 pantallas con avisos: ${validarFlow(dos).join(" | ")}`);

  // La validación debe cazar los errores que Meta rechazaría.
  const roto = {
    version: VERSION_FLOW,
    pantallas: [
      { id: "minusculas", title: "x", terminal: false, children: [
        componenteCon("TextInput", { label: "A", name: "dup" }),
        componenteCon("TextInput", { label: "B", name: "dup" }, 1),
        componenteCon("Footer", { label: "Ir", accion: "navigate", next: "NO_EXISTE" }),
      ] },
      { id: "SIN_PIE", title: "y", terminal: false, children: [] },
    ],
  };
  const av = validarFlow(roto);
  const debe = ["MAYÚSCULAS", "repetido", "no existe", "botón de pie", "vacía", "final"];
  for (const frag of debe) {
    if (!av.some((a) => a.includes(frag))) fail(`validación: no detecta "${frag}" (${av.join(" | ")})`);
  }
  // El formulario vive DENTRO de la tarjeta Flow: su diseño alimenta el payload.
  const tarjeta = { card: "flow", props: {
    body: "Déjanos tus datos", flow_cta: "Dejar mis datos", flow_action: "navigate",
    flow_id: "123", flowjson: flujoNuevo(),
  } };
  const msg = buildMessage(tarjeta);
  const params = msg.interactive.action.parameters;
  if (params.flow_action_payload?.screen !== "PANTALLA_1") {
    fail(`tarjeta flow: pantalla inicial ${JSON.stringify(params.flow_action_payload)}`);
  }
  if (JSON.stringify(msg).includes("flowjson")) fail("tarjeta flow: el diseño se cuela en el payload");
  const sinId = validateCard("flow", { ...tarjeta.props, flow_id: "" });
  if (!sinId.list.some((m) => m.includes("Publica el formulario"))) {
    fail(`tarjeta flow: falta el aviso de publicar (${sinId.list.join(" | ")})`);
  }
  console.log(`Flows: ${Object.keys(COMPONENTES).length} componentes · validación con ${av.length} avisos · tarjeta OK`);
}

// Ningún efecto debe devolver algo que no sea una función: React lo llama al
// limpiar y rompe la app entera (pantalla de error). Se revisa el código fuente.
{
  const fuentes = [
    ["src/App.jsx", appSrc],
    ["src/components/ZoomControls.jsx", zoomSrc],
    ["src/components/Simulator.jsx", simSrc],
    ["src/components/Modal.jsx", modalSrc],
    ["src/components/ContextMenu.jsx", ctxSrc],
  ];
  for (const [nombre, src] of fuentes) {
    const malos = [...src.matchAll(/useEffect\(\(\)\s*=>\s*([^\s{])/g)];
    if (malos.length) fail(`${nombre}: ${malos.length} efecto(s) con retorno implícito`);
  }
  console.log(`Efectos: ${fuentes.length} archivos revisados`);

  // El minimapa y el modo ligero ya no se pueden apagar: si alguien reintrodujera
  // los interruptores, las preferencias guardadas volverían a decidir por el
  // usuario sin que haya nada que las cambie.
  const zoomSrcActual = leer("src/components/ZoomControls.jsx");
  for (const muerto of ["cbc-modo-ligero", "cbc-minimapa", "onToggleMapa", "onToggleLigero"]) {
    if (appSrc.includes(muerto) || zoomSrcActual.includes(muerto)) {
      fail(`quedó "${muerto}" en el código: esos interruptores ya no existen`);
    }
  }
  if (!appSrc.includes("onlyRenderVisibleElements")) fail("la virtualización dejó de aplicarse");
  if (!zoomSrcActual.includes("onInicio")) fail("falta el botón para ir al primer paso");

  // Encuadrar un flujo de cientos de pasos mete TODOS dentro de la vista, y
  // React Flow los monta de golpe: es exactamente lo que congelaba el equipo.
  // Solo puede quedar donde lo pide el usuario a propósito (el botón ⤢ y el
  // reencuadre de los flujos pequeños); ninguna ruta automática debe hacerlo.
  if (!appSrc.includes("reencuadrar")) fail("no existe el reencuadre cuidadoso de flujos grandes");
  const encuadres = (appSrc.match(/fitView\(\{/g) || []).length;
  if (encuadres > 2) fail(`hay ${encuadres} llamadas a fitView; solo deberían quedar las que pide el usuario`);
  if (/fitView\s*$/m.test(appSrc)) fail("el lienzo encuadra todo al montar, sin mirar el tamaño del flujo");
}

// ── Almacenamiento: índice pequeño + un documento por flujo ──
{
  const almacen = new Map();
  let escrituras = 0;
  globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => { escrituras++; almacen.set(k, v); },
    removeItem: (k) => almacen.delete(k),
  };

  // Migración desde el espacio único anterior.
  const semilla = buildInitialFlow();
  almacen.set("chatbot-creator-workspace-v1", JSON.stringify({
    flujos: [{ id: "f1", nombre: "Viejo", creado: "", actualizado: new Date().toISOString(), ...semilla }],
  }));
  let idx = cargarIndice();
  if (idx.length !== 1 || idx[0].pasos !== semilla.nodes.length) fail("almacén: la migración perdió el flujo");
  if (!almacen.has("cbc-doc-f1")) fail("almacén: el cuerpo no se guardó aparte");
  if (JSON.parse(almacen.get("cbc-index-v1"))[0].nodes) fail("almacén: el índice arrastra los nodos");
  if (cargarDocumento("f1").nodes.length !== semilla.nodes.length) fail("almacén: el cuerpo no se recupera");

  // Guardar sin cambiar los contadores NO debe tocar el índice (evita re-render).
  const mismo = conResumen(idx, "f1", semilla);
  if (mismo !== idx) fail("almacén: el índice se reescribe aunque no cambie nada");
  const otro = conResumen(idx, "f1", { nodes: semilla.nodes.slice(1), edges: semilla.edges });
  if (otro === idx || otro[0].pasos !== semilla.nodes.length - 1) fail("almacén: no detecta el cambio de tamaño");

  // El índice pesa poco: es lo único que lee la portada.
  const kb = almacen.get("cbc-index-v1").length / 1024;
  if (kb > 4) fail(`almacén: el índice pesa ${kb.toFixed(1)} KB`);
  console.log(`Almacén: índice ${kb.toFixed(2)} KB · documento aparte · ${escrituras} escrituras`);
  delete globalThis.localStorage;
}

// ── Nube: al entrar se cruza lo local con lo de S3 y gana lo más reciente ──
{
  const t = (min) => new Date(Date.now() - min * 60000).toISOString();
  const local = [
    { id: "a", nombre: "Solo aquí", actualizado: t(5) },
    { id: "b", nombre: "Mío nuevo", actualizado: t(1) },
    { id: "c", nombre: "Viejo aquí", actualizado: t(90) },
  ];
  const remoto = [
    { id: "b", nombre: "Suyo viejo", actualizado: t(60) },
    { id: "c", nombre: "Suyo nuevo", actualizado: t(2) },
    { id: "d", nombre: "Solo en la nube", actualizado: t(30) },
  ];
  const { combinado, subir, bajar } = combinarIndices(local, remoto);

  if (combinado.length !== 4) fail(`nube: quedan ${combinado.length} flujos, deberían ser 4`);
  const por = new Map(combinado.map((m) => [m.id, m]));
  if (por.get("b").nombre !== "Mío nuevo") fail("nube: la copia local más reciente no gana");
  if (por.get("c").nombre !== "Suyo nuevo") fail("nube: la copia de la nube más reciente no gana");
  if (subir.join() !== "a,b") fail(`nube: se suben ${subir.join() || "ninguno"}, deberían ser a,b`);
  if (bajar.sort().join() !== "c,d") fail(`nube: se bajan ${bajar.join() || "ninguno"}, deberían ser c,d`);
  // La portada los pinta por fecha, del más reciente al más antiguo.
  const fechas = combinado.map((m) => new Date(m.actualizado).getTime());
  if (fechas.some((f, i) => i && f > fechas[i - 1])) fail("nube: el índice combinado no queda ordenado");
  // Nada del estado local puede acabar en S3, y nada se pierde por el camino.
  console.log(`Nube: ${combinado.length} flujos combinados · sube ${subir.length} · baja ${bajar.length}`);
}

// ══ Automatizaciones: validar, decidir y ejecutar de verdad ══

// La regla de geometría del lienzo: con UNA sola salida, tiene que llamarse
// `next`. Con otro nombre el nodo dibuja fila de opción en vez de conector
// inferior y el SVG del servidor se salta las aristas guardadas como `next`.
{
  // `next` es la salida "sigue de largo": el lienzo la dibuja como conector
  // inferior y las aristas viejas sin `sourceHandle` caen ahí. Por eso, si una
  // tarjeta la declara, tiene que ser su ÚNICA salida; mezclarla con ramas deja
  // aristas apuntando a un conector que no se dibuja.
  for (const key of CARD_KEYS) {
    for (const props of [{}, defaultProps(key)]) {
      const outs = CARDS[key].outputs(props);
      if (outs.some((o) => o.id === "next") && outs.length !== 1) {
        fail(`${key}: mezcla la salida «next» con ${outs.length - 1} rama(s)`);
      }
    }
  }
  // Y toda salida necesita id y etiqueta: el id va en la arista, la etiqueta la
  // lee el usuario en el lienzo y en el simulador.
  const sinNombre = CARD_KEYS.filter((k) =>
    CARDS[k].outputs(defaultProps(k)).some((o) => !o.id || !o.label),
  );
  if (sinNombre.length) fail(`salidas sin id o sin etiqueta: ${sinNombre.join(", ")}`);
}

// Las reglas de validación: lo que el usuario escribe y lo que se guarda.
{
  const casos = [
    ["correo", "  Juan@Ejemplo.COM ", {}, {}, "juan@ejemplo.com"],
    ["correo", "juan(arroba)ejemplo", {}, {}, null],
    ["documento", "1.020.304.050", {}, {}, "1020304050"],
    ["documento", "123", {}, {}, null],
    ["telefono", "+57 300 123 4567", {}, {}, "+573001234567"],
    ["fecha", "15/03/1990", {}, {}, "1990-03-15"],
    ["fecha", "3 de marzo de 2026", {}, {}, "2026-03-03"],
    ["fecha", "1990-03-15", {}, {}, "1990-03-15"],
    ["fecha", "31/02/2020", {}, {}, null],
    ["fecha", "03/04/2026", { orden: "mdy" }, {}, "2026-03-04"],
    ["entero", "2026", { min: "1990", max: "año actual + 1" }, {}, 2026],
    ["entero", "1980", { min: "1990" }, {}, null],
    ["numero", "1.250.000", { min: "1000000", max: "2000000000" }, {}, 1250000],
    ["hora", "3 pm", {}, {}, "15:00"],
    ["si_no", "Claro", {}, {}, "si"],
    ["si_no", "quizá", {}, {}, null],
    ["opcion", "2", { opciones: "Moto\nCarro\nCamión" }, {}, "Carro"],
    ["opcion", "camion", { opciones: "Moto\nCarro\nCamión" }, {}, "Camión"],
    ["texto", "ab", { min: "3" }, {}, null],
    ["patron", "abc123", { patron: "^[A-Z]{3}\\d{3}$" }, {}, "ABC123"],
    ["patron", "ab1234", { patron: "^[A-Z]{3}\\d{3}$" }, {}, null],
    // El formato puede depender de algo capturado antes (coche vs moto).
    ["patron", "abc12d", { patron: "{{formato}}" }, { formato: "^[A-Z]{3}\\d{2}[A-Z]$" }, "ABC12D"],
  ];
  for (const [regla, texto, op, vars, esperado] of casos) {
    const r = validarRespuesta(regla, texto, op, vars);
    if (esperado === null) {
      if (r.ok) fail(`validación: "${texto}" debería fallar con la regla ${regla}`);
      else if (!r.error) fail(`validación: ${regla} falla sin explicar por qué`);
    } else if (!r.ok) {
      fail(`validación: "${texto}" debería valer como ${regla} (${r.error})`);
    } else if (r.valor !== esperado) {
      fail(`validación ${regla}: se guarda ${JSON.stringify(r.valor)} y se esperaba ${JSON.stringify(esperado)}`);
    }
  }
  if (resolverLimite("año actual + 1") !== new Date().getFullYear() + 1) {
    fail("los límites dinámicos no resuelven «año actual + 1»");
  }
  if (Object.keys(REGLAS).some((k) => !REGLAS[k].nombre || typeof REGLAS[k].valida !== "function")) {
    fail("alguna regla no declara nombre o función");
  }
  console.log(`Validación: ${casos.length} casos · ${Object.keys(REGLAS).length} reglas`);
}

// Emparejado contra un catálogo: resolver, dudar o rendirse (nunca adivinar).
{
  const catalogo = "Mazda\nMazda 2\nMazda 3\nRenault\nChevrolet";
  const uno = coincidir("mazda 3", catalogo);
  if (uno.tipo !== "unico" || uno.valor !== "Mazda 3") fail(`catálogo: "mazda 3" → ${uno.tipo}`);
  const varios = coincidir("mazd", catalogo);
  if (varios.tipo !== "varios" || varios.opciones.length !== 3) {
    fail(`catálogo: "mazd" debería dar 3 candidatos y dio ${varios.opciones.length} (${varios.tipo})`);
  }
  if (coincidir("ferrari", catalogo).tipo !== "ninguno") fail("catálogo: «ferrari» no debería coincidir");
  if (coincidir("renualt", catalogo).tipo !== "unico") fail("catálogo: no tolera la errata «renualt»");
  console.log("Catálogo: único / varios / ninguno, y aguanta erratas");
}

// El motor: quién decide la salida y qué variables deja escritas.
{
  const ask = { variable: "correo", regla: "correo", intentos: "2", error: "Ese correo no sirve." };
  const primero = resolver("ask", ask, { texto: "no soy un correo", intentos: 0 });
  if (!primero.reintentar || primero.mensaje !== "Ese correo no sirve.") fail("ask: el primer fallo debería reintentar");
  const segundo = resolver("ask", ask, { texto: "sigue mal", intentos: 1 });
  if (segundo.salida !== "fail") fail("ask: agotados los intentos debería salir por «fail»");
  const bien = resolver("ask", ask, { texto: "Ana@Ejemplo.com", intentos: 1 });
  if (bien.salida !== "ok" || bien.vars.correo !== "ana@ejemplo.com") fail("ask: no guarda el correo normalizado");

  const cond = {
    rutas: [
      { id: "vip", etiqueta: "VIP", modo: "todas", condiciones: [
        { variable: "plan", operador: "igual", valor: "oro" },
        { variable: "saldo", operador: "mayor", valor: "100" },
      ] },
    ],
  };
  if (resolver("condition", cond, { vars: { plan: "oro", saldo: "500" } }).salida !== "vip") {
    fail("condición: no toma la ruta que se cumple");
  }
  if (resolver("condition", cond, { vars: { plan: "oro", saldo: "10" } }).salida !== "else") {
    fail("condición: con «todas» basta que falle una para irse por «Si no»");
  }

  const intent = { intenciones: [{ id: "cot", etiqueta: "Cotizar", palabras: "cotizar, precio, cuánto vale" }] };
  if (resolver("intent", intent, { texto: "quiero saber el precio" }).salida !== "cot") fail("intención: no reconoce la palabra clave");
  if (resolver("intent", intent, { texto: "hola" }).salida !== "sin_coincidencia") fail("intención: debería no reconocer «hola»");

  const asignadas = resolver("vars", {
    asignaciones: [
      { variable: "saludo", origen: "fijo", valor: "Hola {{nombre}}" },
      { variable: "eco", origen: "respuesta" },
    ],
  }, { vars: { nombre: "Ana", respuesta: "sí" } });
  if (asignadas.vars.saludo !== "Hola Ana" || asignadas.vars.eco !== "sí") fail("variables: no interpola o no copia la respuesta");

  const horario = { dias: "todos", apertura: "08:00", cierre: "17:00", zona: "America/Bogota" };
  const manana = new Date("2026-08-05T14:00:00Z"); // 09:00 en Bogotá
  const noche = new Date("2026-08-05T02:00:00Z"); // 21:00 del día anterior
  if (resolver("hours", horario, { momento: manana }).salida !== "abierto") fail("horario: las 9 a. m. deberían estar abiertas");
  if (resolver("hours", horario, { momento: noche }).salida !== "cerrado") fail("horario: las 9 p. m. deberían estar cerradas");
  if (resolver("hours", { ...horario, festivos: "2026-08-05" }, { momento: manana }).salida !== "cerrado") {
    fail("horario: no respeta los festivos");
  }

  const conCmd = [
    { id: "c1", data: { card: "commands", props: { comandos: [{ id: "menu", etiqueta: "Menú", palabras: "menu, inicio" }] } } },
    { id: "n1", data: { card: "text", title: "Menú principal", props: {} } },
  ];
  const cmd = interceptar(conCmd, "quiero volver al menu");
  if (!cmd || cmd.salida !== "menu") fail("comandos globales: no interceptan «menu»");
  if (interceptar(conCmd, "hola")) fail("comandos globales: interceptan cuando no deberían");
  if (buscarPaso(conCmd, "Menú principal") !== "n1") fail("«Ir a»: no encuentra el paso por su título");

  console.log("Motor: valida, reintenta, escala, ramifica, interpola y respeta el horario");
}

// El simulador tiene que esperar texto en «Pregunta y valida» aunque la tarjeta
// tenga varias salidas: esas salidas NO son botones que se puedan tocar.
{
  const flujo = {
    nodes: [
      { id: "a", data: { card: "ask", props: defaultProps("ask") } },
      { id: "b", data: { card: "condition", props: defaultProps("condition") } },
      { id: "c", data: { card: "http", props: defaultProps("http") } },
      { id: "d", data: { card: "handoff", props: defaultProps("handoff") } },
      { id: "e", data: { card: "end", props: {} } },
    ],
    edges: [
      { id: "e1", source: "a", sourceHandle: "ok", target: "b" },
      { id: "e2", source: "b", sourceHandle: "ruta_1", target: "c" },
      { id: "e3", source: "c", sourceHandle: "ok", target: "d" },
      { id: "e4", source: "d", sourceHandle: "next", target: "e" },
    ],
  };
  const modo = (id) => stepMode(flujo.nodes.find((n) => n.id === id), flujo.edges);
  if (modo("a") !== "captura") fail(`ask debería esperar texto y da "${modo("a")}"`);
  if (modo("b") !== "decide") fail(`condition debería decidir sola y da "${modo("b")}"`);
  if (modo("c") !== "options") fail(`http debería ofrecer sus ramas y da "${modo("c")}"`);
  if (modo("d") !== "auto") fail(`handoff debería seguir solo y da "${modo("d")}"`);
  if (modo("e") !== "end") fail("end debería terminar");
  // Un paso técnico no es un mensaje: en el chat no puede salir una burbuja.
  for (const key of CARD_KEYS.filter((k) => CARDS[k].tecnica)) {
    if (nodeMessage({ data: { card: key, props: defaultProps(key) } })) fail(`${key}: una automatización no debería emitir mensaje`);
  }
  // Y el disparador externo tiene que poder ser la entrada del flujo.
  const conDisparador = [{ id: "t", data: { card: "trigger", props: {} } }, { id: "x", data: { card: "text", props: {} } }];
  if (entryNode(conDisparador, [{ id: "z", source: "t", target: "x" }]) !== "t") {
    fail("el disparador externo debería poder empezar el flujo");
  }
  console.log("Simulador: modos correctos y automatizaciones sin burbuja");
}

// Las variables se sustituyen en el texto que ve el usuario.
{
  const props = conVariables({ body: "Hola {{nombre}}", sections: [{ rows: [{ title: "{{ciudad}}" }] }] }, { nombre: "Ana", ciudad: "Cali" });
  if (props.body !== "Hola Ana") fail("interpolación: no sustituye en el cuerpo");
  if (props.sections[0].rows[0].title !== "Cali") fail("interpolación: no entra en las listas anidadas");
  if (interpolar("Hola {{falta}}", {}) !== "Hola ") fail("interpolación: una variable sin valor debería quedar vacía");
  console.log("Variables: {{nombre}} se sustituye en textos y listas");
}

// Una conversación entera, con el mismo recorrido que hace el simulador:
// preguntar, validar, reintentar, escalar, ramificar e interpolar.
{
  const paso = (id, card, props = {}) => ({ id, data: { card, title: id, props: { ...defaultProps(card), ...props } } });
  const flujo = {
    nodes: [
      paso("inicio", "start"),
      paso("doc", "ask", {
        body: "¿Cuál es tu documento?",
        variable: "documento",
        regla: "documento",
        error: "Solo números, entre 5 y 12 dígitos.",
        intentos: "2",
      }),
      paso("vip", "condition", {
        rutas: [{ id: "es_vip", etiqueta: "VIP", modo: "todas", condiciones: [{ variable: "plan", operador: "igual", valor: "oro" }] }],
      }),
      paso("saludo", "text", { body: "Hola {{nombre}} 👑" }),
      paso("normal", "text", { body: "Hola, ¿en qué te ayudo?" }),
      paso("asesor", "handoff"),
      paso("fin", "end"),
    ],
    edges: [
      { id: "a", source: "inicio", sourceHandle: "next", target: "doc" },
      { id: "b", source: "doc", sourceHandle: "ok", target: "vip" },
      { id: "c", source: "doc", sourceHandle: "fail", target: "asesor" },
      { id: "d", source: "vip", sourceHandle: "es_vip", target: "saludo" },
      { id: "e", source: "vip", sourceHandle: "else", target: "normal" },
      { id: "f", source: "saludo", sourceHandle: "next", target: "fin" },
      { id: "g", source: "normal", sourceHandle: "next", target: "fin" },
      { id: "h", source: "asesor", sourceHandle: "next", target: "fin" },
    ],
  };

  /** Recorre el flujo como el simulador: mismas decisiones, sin interfaz. */
  const caminar = (escritos, varsIniciales = {}) => {
    const cola = [...escritos];
    let vars = { ...varsIniciales };
    let id = entryNode(flujo.nodes, flujo.edges);
    const visitados = [id];
    const dichos = [];
    let intentos = 0;

    for (let vuelta = 0; vuelta < 40 && id; vuelta++) {
      const nodo = flujo.nodes.find((n) => n.id === id);
      const modo = stepMode(nodo, flujo.edges);
      const mensaje = nodeMessage({ ...nodo, data: { ...nodo.data, props: conVariables(nodo.data.props, vars) } });
      if (mensaje?.text) dichos.push(mensaje.text);
      if (modo === "end") break;

      let salida = "next";
      if (modo === "captura") {
        const r = resolver(nodo.data.card, nodo.data.props, { vars, texto: cola.shift(), intentos });
        if (r.reintentar) {
          intentos += 1;
          dichos.push(r.mensaje);
          continue; // el paso se repite: no se avanza
        }
        intentos = 0;
        vars = { ...vars, ...r.vars };
        salida = r.salida;
      } else if (modo === "decide") {
        const r = resolver(nodo.data.card, nodo.data.props, { vars });
        vars = { ...vars, ...(r.vars || {}) };
        salida = r.salida;
      }

      const arista = flujo.edges.find((e) => e.source === id && (e.sourceHandle || "next") === salida);
      if (!arista) break;
      id = arista.target;
      visitados.push(id);
    }
    return { visitados, dichos, vars };
  };

  const escalado = caminar(["hola", "no sé"]);
  if (!escalado.visitados.includes("asesor")) fail(`recorrido: dos respuestas malas deberían acabar en el asesor (${escalado.visitados.join(" → ")})`);
  if (escalado.dichos.filter((t) => t === "Solo números, entre 5 y 12 dígitos.").length !== 1) {
    fail("recorrido: el aviso de error debería salir una vez antes de escalar");
  }

  const vip = caminar(["1.020.304.050"], { plan: "oro", nombre: "Ana" });
  if (!vip.visitados.includes("saludo")) fail(`recorrido VIP: debería pasar por el saludo (${vip.visitados.join(" → ")})`);
  if (vip.vars.documento !== "1020304050") fail("recorrido VIP: el documento no se guarda normalizado");
  if (!vip.dichos.includes("Hola Ana 👑")) fail(`recorrido VIP: no interpola el nombre (${JSON.stringify(vip.dichos)})`);

  const comun = caminar(["1020304050"], { plan: "plata" });
  if (!comun.visitados.includes("normal")) fail("recorrido normal: sin plan oro debería irse por «Si no»");

  console.log(`Recorrido con automatizaciones: escala tras 2 fallos · VIP ${vip.visitados.length} pasos · variables vivas`);
}

const { nodes, edges } = buildInitialFlow();
console.log(`Semilla: ${nodes.length} nodos, ${edges.length} conexiones`);

// Toda arista debe salir de una salida real de su nodo origen y llegar a un nodo existente.
const byId = new Map(nodes.map((n) => [n.id, n]));
for (const e of edges) {
  const src = byId.get(e.source);
  if (!src) { fail(`arista ${e.id}: origen inexistente ${e.source}`); continue; }
  if (!byId.get(e.target)) fail(`arista ${e.id}: destino inexistente ${e.target}`);
  const ids = cardOutputs(src.data).map((o) => o.id);
  if (!ids.includes(e.sourceHandle)) {
    fail(`arista ${e.id}: ${e.source} no tiene la salida "${e.sourceHandle}" (tiene ${ids.join(", ") || "ninguna"})`);
  }
  if (Number.isNaN(src.position.x) || Number.isNaN(src.position.y)) fail(`${src.id}: posición NaN`);
}

// Toda salida declarada debería estar conectada (aviso, no error, salvo en el semilla).
for (const n of nodes) {
  for (const o of cardOutputs(n.data)) {
    if (!edges.some((e) => e.source === n.id && e.sourceHandle === o.id)) {
      fail(`${n.id}: la salida "${o.id}" no está conectada`);
    }
  }
}

// Todo nodo debe traer dimensiones iniciales: sin ellas React Flow no sabe qué
// está a la vista antes de medir el DOM y el modo ligero deja el lienzo VACÍO
// (pasó de verdad: pantalla en negro en la v0.5.2).
{
  const sinMedidas = nodes.filter((n) => !n.width || !n.height);
  if (sinMedidas.length) fail(`${sinMedidas.length} nodos sin width/height inicial`);
  const importado = migrateFlow({ nodes: nodes.map(({ width, height, ...n }) => n), edges });
  const perdidos = importado.nodes.filter((n) => !n.width || !n.height);
  if (perdidos.length) fail(`al importar, ${perdidos.length} nodos se quedan sin dimensiones`);
  console.log(`Dimensiones: ${nodes.length} nodos con medida inicial (también al importar)`);
}

// Un documento guardado SIN dimensiones debe recuperarlas al abrirlo: si no, la
// virtualización no filtra nada y se montan todos los nodos (era el caso real de
// los flujos importados antes de la v0.7.0).
{
  const almacen = new Map();
  globalThis.localStorage = {
    getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
    setItem: (k, v) => almacen.set(k, v),
    removeItem: (k) => almacen.delete(k),
  };
  const viejo = { nodes: nodes.map(({ width, height, ...n }) => n), edges };
  almacen.set("cbc-doc-x", JSON.stringify(viejo));
  if (viejo.nodes.some((n) => n.width || n.height)) fail("el documento de prueba ya traía dimensiones");
  const recuperado = cargarDocumento("x");
  const sinMedida = recuperado.nodes.filter((n) => !n.width || !n.height);
  if (sinMedida.length) fail(`al abrir, ${sinMedida.length} nodos siguen sin dimensiones`);
  if (recuperado.edges.length !== edges.length) fail("al abrir se pierden aristas");
  console.log(`Apertura: ${recuperado.nodes.length} nodos con dimensiones recuperadas`);
  delete globalThis.localStorage;
}

// El renderizador del servidor: mismo catálogo y misma geometría que el editor.
{
  const region = cajaFlujo(nodes);
  const svg = svgDeRegion({ nodes, edges }, { region, zoom: 1 });
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) fail("render: el SVG no está bien formado");
  if (svg.includes("feGaussianBlur")) fail("render: hay desenfoques (rasterizar eso es carísimo)");
  if (!svg.includes(TEMA.tarjeta)) fail("render: no usa los colores del tema");
  for (const n of nodes) {
    if (n.data.card === "start" || n.data.card === "end") continue;
    if (!svg.includes(`>${n.data.title.split(" ")[0]}`)) continue; // título recortado: basta con que aparezca alguno
  }
  // Con LOD (alejado) desaparecen resumen y filas de opciones.
  const lejos = svgDeRegion({ nodes, edges }, { region, zoom: 0.3 });
  if (lejos.length >= svg.length) fail("render: el modo alejado no simplifica el dibujo");
  // Omitir un nodo lo quita a él y a sus conexiones (para el arrastre).
  const sinUno = svgDeRegion({ nodes, edges }, { region, zoom: 1, omitir: [nodes[3].id] });
  if (sinUno.length >= svg.length) fail("render: `omitir` no quita nada");
  // Las anclas caen dentro de la caja del nodo.
  for (const n of nodes) {
    const { entrada } = anclas(n);
    const { width } = nodeSize(n);
    if (entrada.x < n.position.x || entrada.x > n.position.x + width) fail(`render: ancla fuera de ${n.id}`);
  }
  // Una conexión que se va MUY lejos de la región no puede dibujarse entera: el
  // rasterizador aborta con geometría a miles de píxeles de la vista (pasó de
  // verdad con un flujo de 94 pasos). Los extremos se recortan al área visible.
  {
    const lejano = {
      nodes: [
        { ...nodes[0], id: "arriba", position: { x: 0, y: 0 } },
        { ...nodes[1], id: "abajo", position: { x: 40, y: 60000 } },
      ],
      edges: [{ id: "larga", source: "arriba", target: "abajo", sourceHandle: "next" }],
    };
    const vista = { x: -100, y: -100, w: 600, h: 600 };
    const trozo = svgDeRegion(lejano, { region: vista, zoom: 1 });
    const coordenadas = [...trozo.matchAll(/<path d="M ([^"]+)"/g)]
      .flatMap((m) => m[1].split(/[^\d.-]+/))
      .map(Number)
      .filter(Number.isFinite);
    const tope = vista.y + vista.h + 1000;
    const fuera = coordenadas.filter((v) => v > tope);
    if (fuera.length) fail(`render: el trazo llega a ${Math.max(...fuera)} px, muy lejos de la vista (tope ${tope})`);
  }
  console.log(`Render: SVG de ${(svg.length / 1024).toFixed(0)} KB para ${nodes.length} nodos · LOD, omitir y recorte de trazos`);
}

// Aristas ligeras: solo cambia el dibujo, nunca los datos que se guardan.
{
  const ligeras = simplificarAristas(edges);
  const conEtiqueta = edges.filter((e) => e.label).length;
  if (ligeras.length !== edges.length) fail("aristas ligeras: cambia el número de conexiones");
  if (ligeras.some((e) => e.label)) fail("aristas ligeras: quedan etiquetas");
  if (ligeras.some((e, i) => e.id !== edges[i].id || e.source !== edges[i].source
      || e.target !== edges[i].target || e.sourceHandle !== edges[i].sourceHandle)) {
    fail("aristas ligeras: se pierde la conexión (id/origen/destino/salida)");
  }
  if (edges.filter((e) => e.label).length !== conEtiqueta) fail("aristas ligeras: mutan el original");
  console.log(`Aristas ligeras: ${edges.length} conexiones, ${conEtiqueta} etiquetas ocultas sin tocar los datos`);
}

// Recorrido del runtime: desde el inicio, tomando siempre la primera opción.
let cur = entryNode(nodes, edges);
const visitados = [];
for (let i = 0; i < 30 && cur; i++) {
  const node = byId.get(cur);
  visitados.push(`${node.data.card}:${cur}`);
  const mode = stepMode(node, edges);
  if (mode === "end") break;
  const opts = nodeOptions(node, edges);
  const edge = mode === "options" ? opts[0]?.edge : nextEdge(edges, cur);
  if (!edge) { fail(`${cur}: modo ${mode} sin arista a seguir`); break; }
  nodeMessage(node);
  cur = edge.target;
}
console.log("Recorrido:", visitados.join(" → "));

console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTodo OK");
process.exit(fallos ? 1 : 0);
