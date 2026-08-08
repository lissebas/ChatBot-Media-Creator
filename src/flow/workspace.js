/*
 * Espacio de trabajo: los flujos del usuario, guardados en el navegador.
 *
 * Almacenamiento partido en dos, porque un flujo real pesa cientos de KB:
 *   índice  → `cbc-index-v1`  : solo metadatos (nombre, fechas, contadores).
 *   cuerpo  → `cbc-doc-<id>`  : los nodos y aristas de ESE flujo.
 *
 * Así la portada abre leyendo unos pocos KB y, sobre todo, guardar un flujo no
 * reserializa los demás: antes cada autoguardado hacía `JSON.stringify` de todo
 * el espacio (varios cientos de KB) en el hilo principal — eso era el tirón.
 */
import { migrateFlow, nodeSize } from "./transform";

const IDX = "cbc-index-v1";
const DOC = (id) => `cbc-doc-${id}`;
const LEGACY_WS = "chatbot-creator-workspace-v1";
const LEGACY_FLOW = "chatbot-creator-flow-v2";

export function nuevoId() {
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Resumen que se guarda en el índice (lo que pinta la portada). */
function resumir(doc) {
  const nodes = doc.nodes || [];
  return {
    pasos: nodes.length,
    conexiones: (doc.edges || []).length,
    cards: [...new Set(nodes.map((n) => n.data?.card).filter(Boolean))].slice(0, 8),
  };
}

function leerJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function escribirJSON(key, valor) {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
    return true;
  } catch (e) {
    console.warn("[workspace] no se pudo guardar:", e);
    return false;
  }
}

/* ── Índice ── */

export function cargarIndice() {
  const idx = leerJSON(IDX);
  if (Array.isArray(idx)) return idx;
  return migrarDesdeVersionesAnteriores();
}

export function guardarIndice(indice) {
  escribirJSON(IDX, indice);
  return indice;
}

/** Migra el espacio único anterior (y antes de él, el flujo suelto autoguardado). */
function migrarDesdeVersionesAnteriores() {
  const viejo = leerJSON(LEGACY_WS);
  if (viejo && Array.isArray(viejo.flujos) && viejo.flujos.length) {
    const indice = viejo.flujos.map((f) => {
      guardarDocumento(f.id, { nodes: f.nodes || [], edges: f.edges || [] });
      return {
        id: f.id,
        nombre: f.nombre,
        creado: f.creado,
        actualizado: f.actualizado,
        ...resumir(f),
      };
    });
    return guardarIndice(indice);
  }

  const suelto = leerJSON(LEGACY_FLOW);
  if (suelto && Array.isArray(suelto.nodes) && Array.isArray(suelto.edges)) {
    const doc = migrateFlow(suelto);
    const meta = nuevoMeta("Mi flujo", doc);
    guardarDocumento(meta.id, doc);
    return guardarIndice([meta]);
  }

  return guardarIndice([]);
}

/* ── Documentos ── */

export function cargarDocumento(id) {
  const doc = leerJSON(DOC(id));
  if (!doc || !Array.isArray(doc.nodes)) return { nodes: [], edges: [] };

  // Sin `width`/`height` React Flow no sabe qué nodos están a la vista y la
  // virtualización no filtra NADA: se montan todos. Los documentos guardados
  // antes de que existieran esas dimensiones se completan aquí al abrirlos.
  const nodes = doc.nodes.map((n) => (n.width && n.height ? n : { ...nodeSize(n), ...n }));
  return { nodes, edges: doc.edges || [] };
}

export function guardarDocumento(id, doc) {
  return escribirJSON(DOC(id), { nodes: doc.nodes || [], edges: doc.edges || [] });
}

export function borrarDocumento(id) {
  try {
    localStorage.removeItem(DOC(id));
  } catch {
    /* si no se puede, no pasa nada: el índice ya no lo referencia */
  }
}

/* ── Operaciones sobre el índice (inmutables) ── */

export function nuevoMeta(nombre, doc = { nodes: [], edges: [] }) {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    nombre: nombre || "Flujo sin título",
    creado: ahora,
    actualizado: ahora,
    ...resumir(doc),
  };
}

/**
 * Refresca el resumen de un flujo en el índice. Devuelve el MISMO array si nada
 * cambió — así React no re-renderiza la app en cada autoguardado. La fecha solo
 * se refresca cada minuto, para no reescribir la portada mientras escribes.
 */
export function conResumen(indice, id, doc) {
  const meta = indice.find((m) => m.id === id);
  if (!meta) return indice;
  const r = resumir(doc);
  const igual = meta.pasos === r.pasos && meta.conexiones === r.conexiones;
  const reciente = Date.now() - new Date(meta.actualizado).getTime() < 60_000;
  if (igual && reciente) return indice;
  return indice.map((m) => (m.id === id ? { ...m, ...r, actualizado: new Date().toISOString() } : m));
}

export function conNombre(indice, id, nombre) {
  return indice.map((m) =>
    m.id === id ? { ...m, nombre: nombre || m.nombre, actualizado: new Date().toISOString() } : m,
  );
}

export function sinFlujo(indice, id) {
  return indice.filter((m) => m.id !== id);
}

/** «hace 5 min», «ayer», «12 mar» — para las tarjetas de la portada. */
export function haceCuanto(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}
