/*
 * Runtime de ChatBot Creator: interpreta el flujo (nodes + edges de React Flow)
 * como una máquina de estados y lo "camina" según lo que responde el usuario.
 *
 * Modelo de salidas:
 *  - Cada tarjeta declara sus salidas en `flow/cardTypes.js` (`outputs`). Una
 *    tarjeta de botones tiene una salida por botón; una lista, una por fila.
 *  - Las aristas guardan en `sourceHandle` la salida de la que parten, así que
 *    el simulador sabe exactamente a dónde lleva cada opción.
 *  - Los flujos importados del modelo antiguo no traen `sourceHandle`: para esos
 *    se sigue usando el match por etiqueta de la arista.
 */

import { cardOutputs, getCard } from "../flow/cardTypes";

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
  const inicio = nodes.find((n) => n.data?.card === "start");
  if (inicio) return inicio.id;
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

/** Nodo por id. */
export function nodeById(nodes, id) {
  return nodes.find((n) => n.id === id) || null;
}

/**
 * Contenido que muestra el simulador al entrar a un nodo:
 * { kind, text, caption, link, filename, cta, ... } según el tipo de tarjeta.
 */
export function nodeMessage(node) {
  if (!node) return null;
  const data = node.data || {};
  const card = getCard(data.card);
  const p = data.props || {};

  switch (data.card) {
    case "start":
      return null; // el inicio no emite mensaje
    case "end":
      return { kind: "end", text: data.title || "Fin" };
    case "text":
      return { kind: "text", text: p.body };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
      return {
        kind: "media",
        media: data.card,
        link: p.link,
        filename: p.filename,
        text: p.caption,
        icon: card.icon,
      };
    case "location":
      return {
        kind: "location",
        text: p.name || "Ubicación",
        sub: p.address || `${p.latitude || "?"}, ${p.longitude || "?"}`,
      };
    case "contacts":
      return { kind: "contact", text: p.formatted_name, sub: p.phone };
    case "reaction":
      return { kind: "reaction", text: p.emoji };
    case "template":
      return { kind: "text", text: `[plantilla: ${p.name || "sin nombre"}]` };
    case "cta_url":
      return { kind: "cta", text: p.body, footer: p.footer, cta: p.display_text, url: p.url };
    case "location_request":
      return { kind: "location_request", text: p.body, cta: "Enviar ubicación" };
    case "flow":
      return { kind: "cta", text: p.body, footer: p.footer, cta: p.flow_cta };
    case "call_permission_request":
      return { kind: "text", text: p.body, footer: "Solicitud de permiso de llamada" };
    case "address_message":
      return { kind: "cta", text: p.body, cta: "Ingresar dirección" };
    case "catalog_message":
      return { kind: "cta", text: p.body, footer: p.footer, cta: "Ver catálogo" };
    case "product":
      return { kind: "product", text: p.body, sub: p.product_retailer_id, footer: p.footer };
    case "product_list":
      return {
        kind: "product",
        text: p.body,
        sub: `${(p.sections || []).reduce((n, s) => n + (s.product_items || []).length, 0)} productos`,
        footer: p.footer,
      };
    case "buttons":
      return { kind: "text", text: p.body, footer: p.footer, header: p.header_text };
    case "list":
      return { kind: "text", text: p.body, footer: p.footer, header: p.header_text };
    default:
      return { kind: "text", text: data.title };
  }
}

/**
 * Opciones que puede tocar el usuario en el nodo actual.
 * Devuelve [{ id, label, edge }] — `edge` puede ser null si la salida aún no
 * está conectada a ningún paso.
 */
export function nodeOptions(node, edges) {
  if (!node) return [];
  const outs = cardOutputs(node.data || {});
  if (outs.length <= 1 && (!outs[0] || outs[0].id === "next")) return [];
  const salidas = outgoing(edges, node.id);
  return outs.map((o) => ({
    ...o,
    edge: salidas.find((e) => (e.sourceHandle || "next") === o.id) || null,
  }));
}

/** Arista por defecto ("next") de un nodo, si existe. */
export function nextEdge(edges, nodeId) {
  const outs = outgoing(edges, nodeId);
  return outs.find((e) => !e.sourceHandle || e.sourceHandle === "next") || outs[0] || null;
}

/**
 * Qué hace el simulador al llegar a un nodo:
 *  "options" → esperar a que el usuario toque un botón / fila.
 *  "action"  → esperar a que el usuario complete una acción nativa (ubicación,
 *              Flow, dirección): se muestra un botón para continuar.
 *  "text"    → esperar a que el usuario escriba (pregunta abierta).
 *  "auto"    → el mensaje se envía y la conversación sigue sola.
 *  "end"     → no hay a dónde ir.
 */
export function stepMode(node, edges) {
  if (!node) return "end";
  if (node.data?.card === "end") return "end";
  if (nodeOptions(node, edges).length) return "options";
  if (!nextEdge(edges, node.id)) return "end";
  if (getCard(node.data?.card).wait === "action") return "action";
  if (node.data?.card === "text" && node.data?.props?.wait_reply) return "text";
  return "auto";
}

/**
 * Resuelve qué arista tomar desde `nodeId` dado un texto escrito por el usuario.
 *  - null       → el nodo es terminal (no hay salidas).
 *  - una arista → seguir esa.
 *  - undefined  → hay opciones pero el texto no hizo match (re-preguntar).
 */
export function matchEdge(edges, nodes, nodeId, text) {
  const node = nodeById(nodes, nodeId);
  const opciones = nodeOptions(node, edges);

  if (opciones.length) {
    const n = normalize(text);
    if (!n) return undefined;
    const hit =
      opciones.find((o) => normalize(o.label) === n) ||
      opciones.find((o) => {
        const l = normalize(o.label);
        return l.includes(n) || n.includes(l);
      });
    return hit ? hit.edge || undefined : undefined;
  }

  const outs = outgoing(edges, nodeId);
  if (outs.length === 0) return null;
  if (outs.length === 1) return outs[0];

  // Flujo antiguo sin `sourceHandle`: match por etiqueta de la arista.
  const n = normalize(text);
  if (!n) return undefined;
  const exact = outs.find((e) => normalize(edgeLabel(e, nodes)) === n);
  if (exact) return exact;
  const partial = outs.find((e) => {
    const lbl = normalize(edgeLabel(e, nodes));
    return lbl.includes(n) || n.includes(lbl);
  });
  return partial || undefined;
}
