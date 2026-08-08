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
import { buildInitialFlow, simplificarAristas } from "../src/flow/transform.js";
import { entryNode, nodeOptions, nextEdge, nodeMessage, stepMode } from "../src/sim/runtime.js";
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
