/*
 * Runtime de Willy Studio: interpreta el flujo (nodes + edges de React Flow) como
 * una máquina de estados y lo "camina" según lo que responde el usuario.
 *
 * Reglas de interpretación (genéricas, sin metadatos extra en los nodos):
 *  - Al ENTRAR a un nodo, el bot emite su mensaje (texto, o el título si no hay texto).
 *  - Aristas salientes:
 *      0  → nodo terminal (fin del flujo).
 *      1  → un solo camino. Si la arista tiene etiqueta, se muestra como botón;
 *           si no, el usuario escribe su respuesta (texto libre) y avanza.
 *      2+ → ramificación: cada etiqueta de arista es una opción (botón). El usuario
 *           toca una, o escribe un texto que haga match con una etiqueta.
 */

/** Normaliza para comparar: minúsculas, sin tildes, sin espacios sobrantes. */
export function normalize(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Aristas que salen de un nodo. */
export function outgoing(edges, nodeId) {
  return edges.filter((e) => e.source === nodeId);
}

/** Nodo de entrada: 'start' si existe; si no, el primero sin aristas entrantes. */
export function entryNode(nodes, edges) {
  if (!nodes.length) return null;
  if (nodes.some((n) => n.id === "start")) return "start";
  const targets = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !targets.has(n.id));
  return (root || nodes[0]).id;
}

/** Etiqueta legible de una arista (su label, o el título del nodo destino). */
export function edgeLabel(edge, nodes) {
  if (edge.label) return String(edge.label);
  const t = nodes.find((n) => n.id === edge.target);
  return t ? t.data?.title || t.id : edge.target;
}

/** Mensaje que muestra el bot al entrar a un nodo. */
export function nodeMessage(node) {
  if (!node) return "";
  const text = (node.data?.text || "").trim();
  return text || node.data?.title || node.id;
}

/**
 * Resuelve qué arista tomar desde `nodeId` dado un texto del usuario.
 *  - null       → el nodo es terminal (no hay salidas).
 *  - una arista → seguir esa.
 *  - undefined  → hay opciones pero el texto no hizo match (re-preguntar).
 */
export function matchEdge(edges, nodes, nodeId, text) {
  const outs = outgoing(edges, nodeId);
  if (outs.length === 0) return null;
  if (outs.length === 1) return outs[0];

  const n = normalize(text);
  if (!n) return undefined;

  // match exacto por etiqueta
  const exact = outs.find((e) => normalize(edgeLabel(e, nodes)) === n);
  if (exact) return exact;

  // match parcial (contiene / contenido en)
  const partial = outs.find((e) => {
    const lbl = normalize(edgeLabel(e, nodes));
    return lbl.includes(n) || n.includes(lbl);
  });
  return partial || undefined;
}
