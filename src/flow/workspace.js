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

const vacio = () => ({ flujos: [], ultimo: null });

export function nuevoId() {
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function cargarEspacio() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.flujos)) return data;
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
        const espacio = { flujos: [flujo], ultimo: flujo.id };
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

/** Inserta o actualiza un flujo y devuelve el espacio nuevo (inmutable). */
export function guardarFlujo(espacio, flujo) {
  const actualizado = { ...flujo, actualizado: new Date().toISOString() };
  const existe = espacio.flujos.some((f) => f.id === flujo.id);
  return {
    ...espacio,
    ultimo: flujo.id,
    flujos: existe
      ? espacio.flujos.map((f) => (f.id === flujo.id ? actualizado : f))
      : [actualizado, ...espacio.flujos],
  };
}

export function borrarFlujo(espacio, id) {
  return {
    ...espacio,
    flujos: espacio.flujos.filter((f) => f.id !== id),
    ultimo: espacio.ultimo === id ? null : espacio.ultimo,
  };
}

export function duplicarFlujo(espacio, id) {
  const orig = espacio.flujos.find((f) => f.id === id);
  if (!orig) return espacio;
  const copia = crearFlujo(`${orig.nombre} (copia)`, { nodes: orig.nodes, edges: orig.edges });
  return { ...espacio, flujos: [copia, ...espacio.flujos] };
}

export function renombrarFlujo(espacio, id, nombre) {
  return {
    ...espacio,
    flujos: espacio.flujos.map((f) =>
      f.id === id ? { ...f, nombre: nombre || f.nombre, actualizado: new Date().toISOString() } : f,
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
