import dagre from "dagre";
import { flujoData } from "./seedFlow";

export const NODE_W = 260;
export const NODE_H = 112;

/* Paleta de las conexiones sobre el lienzo oscuro. */
const EDGE = "#54545f";
const EDGE_DIM = "#3a3a44";
const LABEL_BG = "#16161a";
const LABEL_TEXT = "#a3a3ae";

/**
 * Auto-organiza los nodos con dagre (grafo jerárquico dirigido).
 * dir: "TB" (arriba→abajo) o "LR" (izquierda→derecha).
 * Devuelve una copia de `nodes` con `position` calculada.
 */
export function autoLayout(nodes, edges, dir = "TB") {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 60, ranksep: 105, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
    };
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
  const nodes = flujoData.nodes.map((n) => {
    const [title, ...rest] = n.label.split("\n");
    return {
      id: n.id,
      type: "card",
      position: { x: 0, y: 0 },
      data: { title, text: rest.join("\n"), group: n.group },
    };
  });

  const edges = flujoData.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label || undefined,
    ...edgeDecor(e.dashes),
  }));

  return { nodes: autoLayout(nodes, edges, dir), edges };
}

/** Estilo estándar para una arista nueva creada por el usuario en el lienzo. */
export function makeEdge(params) {
  return { ...params, ...edgeDecor(false) };
}
