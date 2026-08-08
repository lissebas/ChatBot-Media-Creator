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
import { interpolar } from "../flow/validadores";

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

/**
 * Nodo de entrada: 'start', o un disparador externo, o el primero sin aristas
 * entrantes. Los comandos globales se descartan: no tienen entrada porque
 * interceptan desde cualquier punto, no porque sean el principio.
 */
export function entryNode(nodes, edges) {
  if (!nodes.length) return null;
  const inicio =
    nodes.find((n) => n.data?.card === "start") || nodes.find((n) => n.data?.card === "trigger");
  if (inicio) return inicio.id;
  const targets = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !targets.has(n.id) && n.data?.card !== "commands");
  return (root || nodes[0]).id;
}

/** Sustituye `{{variable}}` en todos los textos de unos props. */
export function conVariables(props, vars) {
  if (!props || !vars || !Object.keys(vars).length) return props;
  const mapear = (v) => {
    if (typeof v === "string") return interpolar(v, vars);
    if (Array.isArray(v)) return v.map(mapear);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapear(x)]));
    }
    return v;
  };
  return mapear(props);
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
 * Descripción de cómo se ve una tarjeta en el chat, independiente del nodo:
 * { kind, text, footer, header, link, cta, ... }. La usan tanto el simulador
 * como la vista previa del inspector.
 */
export function describeCard(cardKey, props = {}) {
  const card = getCard(cardKey);
  const p = props;

  // Encabezado de las tarjetas interactivas (texto o media).
  const header = p.header_type === "text" ? p.header_text : undefined;
  const headerMedia = ["image", "video", "document"].includes(p.header_type)
    ? { type: p.header_type, link: p.header_link, icon: card.icon }
    : undefined;

  // Inicio y Fin no emiten nada; las automatizaciones tampoco son un mensaje
  // (se pintan como nota técnica, no como burbuja).
  if (card.chat === false || card.tecnica) return null;

  switch (cardKey) {
    case "text":
    case "ask":
      return { kind: "text", text: p.body };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker":
      return {
        kind: "media",
        media: cardKey,
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
      return {
        kind: "cta",
        text: p.body,
        footer: p.footer,
        header,
        headerMedia,
        cta: p.display_text,
        url: p.url,
      };
    case "location_request":
      return { kind: "location_request", text: p.body, cta: "Enviar ubicación" };
    case "flow":
      return { kind: "cta", text: p.body, footer: p.footer, header, headerMedia, cta: p.flow_cta };
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
      return { kind: "text", text: p.body, footer: p.footer, header, headerMedia };
    case "list":
      return { kind: "text", text: p.body, footer: p.footer, header: p.header_text };
    default:
      return { kind: "text", text: card.nombre };
  }
}

/** Mensaje que emite un nodo al entrar en él (o null si no envía nada). */
export function nodeMessage(node) {
  if (!node) return null;
  return describeCard(node.data?.card, node.data?.props || {});
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
 *  "captura" → esperar a que escriba y VALIDAR lo que escriba (el motor decide).
 *  "decide"  → el motor elige la salida solo, sin preguntar nada.
 *  "options" → esperar a que el usuario toque un botón / fila.
 *  "action"  → esperar a que el usuario complete una acción nativa (ubicación,
 *              Flow, dirección): se muestra un botón para continuar.
 *  "text"    → esperar a que el usuario escriba (pregunta abierta).
 *  "auto"    → el mensaje se envía y la conversación sigue sola.
 *  "end"     → no hay a dónde ir.
 *
 * El orden importa: una tarjeta que espera texto puede tener varias salidas
 * (válido / no válido), y esas salidas NO son botones que se puedan tocar.
 */
export function stepMode(node, edges) {
  if (!node) return "end";
  const card = getCard(node.data?.card);
  if (node.data?.card === "end") return "end";
  if (card.espera === "texto") return "captura";
  if (card.decide) return "decide";
  if (nodeOptions(node, edges).length) return "options";
  if (!nextEdge(edges, node.id)) return "end";
  if (card.wait === "action") return "action";
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
