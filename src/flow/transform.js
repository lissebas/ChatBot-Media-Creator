import dagre from "dagre";
import { flujoData } from "./seedFlow";
import { cardOutputs, defaultProps, getCard } from "./cardTypes";

export const NODE_W = 268;
export const NODE_H = 120;

/* Paleta de las conexiones sobre el lienzo oscuro. */
const EDGE = "#54545f";
const EDGE_DIM = "#3a3a44";
const LABEL_BG = "#16161a";
const LABEL_TEXT = "#a3a3ae";

/** ¿Las salidas del nodo se dibujan como filas de opciones dentro de la tarjeta? */
export function hasOptionRows(data) {
  const outs = cardOutputs(data);
  return outs.length > 1 || (outs.length === 1 && outs[0].id !== "next");
}

/** Tamaño estimado de un nodo, para que el auto-layout no encime las tarjetas. */
export function nodeSize(node) {
  const card = getCard(node.data?.card);
  if (card.pill) return { width: 148, height: 46 };
  const outs = cardOutputs(node.data || {});
  const rows = hasOptionRows(node.data || {}) ? outs.length : 0;
  const resumen = card.summary(node.data?.props || {}) || "";
  const lineas = Math.min(3, Math.max(1, Math.ceil(resumen.length / 36)));
  return { width: NODE_W, height: 74 + lineas * 17 + rows * 30 };
}

/**
 * Auto-organiza los nodos con dagre (grafo jerárquico dirigido).
 * dir: "TB" (arriba→abajo) o "LR" (izquierda→derecha).
 * Devuelve una copia de `nodes` con `position` calculada.
 */
export function autoLayout(nodes, edges, dir = "TB") {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 62, ranksep: 110, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map();
  nodes.forEach((n) => {
    const s = nodeSize(n);
    sizes.set(n.id, s);
    g.setNode(n.id, s);
  });
  edges.forEach((e) => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    const s = sizes.get(n.id);
    return { ...n, position: { x: p.x - s.width / 2, y: p.y - s.height / 2 } };
  });
}

function edgeStyle(dashes) {
  return {
    stroke: dashes ? EDGE_DIM : EDGE,
    strokeWidth: 1.6,
    strokeDasharray: dashes ? "6 6" : undefined,
  };
}

/** Decoración común de las aristas (flecha + etiqueta), en tono oscuro. */
function edgeDecor(dashes) {
  return {
    type: "smoothstep",
    pathOptions: { borderRadius: 18 },
    markerEnd: {
      type: "arrowclosed",
      width: 16,
      height: 16,
      color: dashes ? EDGE_DIM : EDGE,
    },
    style: edgeStyle(dashes),
    labelBgPadding: [7, 4],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: LABEL_BG, stroke: "#2a2a31", fillOpacity: 1 },
    labelStyle: { fontSize: 11, fill: LABEL_TEXT, fontWeight: 500 },
  };
}

/** Convierte el flujo-semilla (seedFlow) al formato de React Flow, ya organizado. */
export function buildInitialFlow(dir = "TB") {
  const nodes = flujoData.nodes.map((n) => ({
    id: n.id,
    type: "card",
    position: { x: 0, y: 0 },
    data: { card: n.card, title: n.title, props: { ...defaultProps(n.card), ...n.props } },
  }));

  const edges = flujoData.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    sourceHandle: e.out || "next",
    label: e.label || undefined,
    ...edgeDecor(e.dashes),
  }));

  return { nodes: autoLayout(nodes, edges, dir), edges };
}

/** Estilo estándar para una arista nueva creada por el usuario en el lienzo. */
export function makeEdge(params) {
  return { ...params, ...edgeDecor(false) };
}

/* ── Compatibilidad con flujos guardados antes del modelo de tarjetas ── */

const GRUPO_A_CARD = {
  inicio: "start",
  fin: "end",
  mensaje: "text",
  pregunta: "buttons",
  opciones: "buttons",
  captura: "text",
  condicion: "buttons",
  accion: "text",
  seguimiento: "text",
  handoff: "text",
  global: "text",
};

/**
 * Normaliza un flujo importado: los nodos del modelo viejo ({title, text, group})
 * se convierten a tarjetas. Los flujos nuevos pasan intactos.
 */
export function migrateFlow(data) {
  const nodes = (data.nodes || []).map((n) => {
    const d = n.data || {};
    if (d.card) return { ...n, type: "card", data: { ...d, props: d.props || {} } };
    const card = GRUPO_A_CARD[d.group] || "text";
    const props = { ...defaultProps(card) };
    const body = d.text || d.title || "";
    if (card === "text") props.body = body;
    if (card === "buttons") props.body = body;
    return {
      ...n,
      type: "card",
      data: { card, title: d.title || n.id, props },
    };
  });
  return { nodes, edges: data.edges || [] };
}
