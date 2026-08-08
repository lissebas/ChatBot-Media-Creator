/*
 * Espacio de trabajo: la lista de flujos del usuario, guardada en el navegador.
 *
 * Antes el editor guardaba un único flujo autoguardado; ahora la portada muestra
 * todos los que hayas creado, así que el almacenamiento es una colección:
 *   { flujos: [{ id, nombre, creado, actualizado, nodes, edges }], ultimo }
 *
 * El flujo autoguardado del modelo anterior se importa la primera vez para no
 * perder trabajo.
 */
import { migrateFlow } from "./transform";

const KEY = "chatbot-creator-workspace-v1";
const LEGACY_KEY = "chatbot-creator-flow-v2";

const vacio = () => ({ flujos: [], formularios: [], ultimo: null });

export function nuevoId() {
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function cargarEspacio() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // `formularios` (Flows) llegó después: los espacios antiguos no lo traen.
      if (Array.isArray(data.flujos)) return { ...vacio(), ...data };
    }
  } catch {
    /* ignora JSON corrupto */
  }

  // Migración: el flujo único del modelo anterior pasa a ser el primero de la lista.
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const viejo = JSON.parse(raw);
      if (Array.isArray(viejo.nodes) && Array.isArray(viejo.edges)) {
        const flujo = crearFlujo("Mi flujo", migrateFlow(viejo));
        const espacio = { ...vacio(), flujos: [flujo], ultimo: flujo.id };
        guardarEspacio(espacio);
        return espacio;
      }
    }
  } catch {
    /* si no se puede migrar, se empieza vacío */
  }

  return vacio();
}

export function guardarEspacio(espacio) {
  try {
    localStorage.setItem(KEY, JSON.stringify(espacio));
  } catch (e) {
    console.warn("[workspace] no se pudo guardar:", e);
  }
}

export function crearFlujo(nombre, flujo = { nodes: [], edges: [] }) {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    nombre: nombre || "Flujo sin nombre",
    creado: ahora,
    actualizado: ahora,
    nodes: flujo.nodes || [],
    edges: flujo.edges || [],
  };
}

/** Formulario nativo (WhatsApp Flow): pantallas en vez de nodos. */
export function crearFormulario(nombre, flow) {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    nombre: nombre || "Formulario sin nombre",
    creado: ahora,
    actualizado: ahora,
    version: flow?.version,
    pantallas: flow?.pantallas || [],
  };
}

/*
 * Las operaciones valen para las dos colecciones del espacio:
 *   tipo = "flujos" (conversaciones) | "formularios" (Flows).
 */

/** Inserta o actualiza un documento y devuelve el espacio nuevo (inmutable). */
export function guardarDoc(espacio, tipo, doc) {
  const lista = espacio[tipo] || [];
  const actualizado = { ...doc, actualizado: new Date().toISOString() };
  const existe = lista.some((d) => d.id === doc.id);
  return {
    ...espacio,
    ultimo: doc.id,
    [tipo]: existe ? lista.map((d) => (d.id === doc.id ? actualizado : d)) : [actualizado, ...lista],
  };
}

export function borrarDoc(espacio, tipo, id) {
  return {
    ...espacio,
    [tipo]: (espacio[tipo] || []).filter((d) => d.id !== id),
    ultimo: espacio.ultimo === id ? null : espacio.ultimo,
  };
}

export function duplicarDoc(espacio, tipo, id) {
  const lista = espacio[tipo] || [];
  const orig = lista.find((d) => d.id === id);
  if (!orig) return espacio;
  const copia = {
    ...orig,
    id: nuevoId(),
    nombre: `${orig.nombre} (copia)`,
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };
  return { ...espacio, [tipo]: [copia, ...lista] };
}

export function renombrarDoc(espacio, tipo, id, nombre) {
  return {
    ...espacio,
    [tipo]: (espacio[tipo] || []).map((d) =>
      d.id === id ? { ...d, nombre: nombre || d.nombre, actualizado: new Date().toISOString() } : d,
    ),
  };
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
