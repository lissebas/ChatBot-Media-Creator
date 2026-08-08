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
import { buildInitialFlow } from "../src/flow/transform.js";
import { entryNode, nodeOptions, nextEdge, nodeMessage, stepMode } from "../src/sim/runtime.js";
import WaText, { sinFormato } from "../src/components/WaText.jsx";

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
