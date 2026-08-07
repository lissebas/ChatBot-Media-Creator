import dagre from "dagre";
import { flujoData } from "./willyFlow";

export const NODE_W = 250;
export const NODE_H = 108;

/**
 * Auto-organiza los nodos con dagre (grafo jerárquico dirigido).
 * dir: "TB" (arriba→abajo) o "LR" (izquierda→derecha).
 * Devuelve una copia de `nodes` con `position` calculada.
 */
export function autoLayout(nodes, edges, dir = "TB") {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 55, ranksep: 90, marginx: 40, marginy: 40 });
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
    stroke: dashes ? "#94a3b8" : "#64748b",
    strokeWidth: 1.5,
    strokeDasharray: dashes ? "6 5" : undefined,
  };
}

/** Convierte el flujo-semilla (willyFlow) al formato de React Flow, ya organizado. */
export function buildInitialFlow(dir = "TB") {
  const nodes = flujoData.nodes.map((n) => {
    const [title, ...rest] = n.label.split("\n");
    return {
      id: n.id,
      type: "willy",
      position: { x: 0, y: 0 },
      data: { title, text: rest.join("\n"), group: n.group },
    };
  });

  const edges = flujoData.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label || undefined,
    type: "smoothstep",
    markerEnd: { type: "arrowclosed", width: 18, height: 18, color: e.dashes ? "#94a3b8" : "#64748b" },
    style: edgeStyle(e.dashes),
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
    labelStyle: { fontSize: 11, fill: "#475569" },
  }));

  return { nodes: autoLayout(nodes, edges, dir), edges };
}

/** Estilo estándar para una arista nueva creada por el usuario en el lienzo. */
export function makeEdge(params) {
  return {
    ...params,
    type: "smoothstep",
    markerEnd: { type: "arrowclosed", width: 18, height: 18, color: "#64748b" },
    style: edgeStyle(false),
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
    labelStyle: { fontSize: 11, fill: "#475569" },
  };
}
