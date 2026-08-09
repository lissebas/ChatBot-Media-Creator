/*
 * Persistencia de los flujos en S3 — el MISMO bucket que sirve CloudFront, bajo
 * el prefijo `flujos/<sub>/`, donde `sub` sale del token verificado en la Lambda
 * (nunca lo elige el navegador) y una política de bucket impide que CloudFront
 * sirva ese prefijo por web. Cada cuenta ve solo lo suyo.
 *
 * El navegador manda: localStorage sigue siendo la copia de trabajo —abrir un
 * flujo es instantáneo, y sin conexión se puede seguir editando—, y la nube es
 * la copia duradera. Al entrar se reconcilian ambas por fecha; al guardar, la
 * subida va detrás del guardado local, agrupada, para no encadenar peticiones
 * mientras se escribe.
 */
import { invocar, motorActivo } from "./remoto";
import {
  cargarDocumento,
  cargarIndice,
  guardarDocumento,
  guardarIndice,
} from "./workspace";

export const nubeActiva = motorActivo;

/** Espera antes de subir: agrupa la ráfaga de autoguardados de una edición. */
const ESPERA = 2500;

const fecha = (meta) => new Date(meta?.actualizado || 0).getTime() || 0;

/** Solo metadatos: el índice de la nube no lleva nada del estado local. */
const limpio = (indice) =>
  indice.map(({ id, nombre, creado, actualizado, pasos, conexiones, cards }) => ({
    id,
    nombre,
    creado,
    actualizado,
    pasos,
    conexiones,
    cards,
  }));

/* ── Operaciones sueltas ── */

export const indiceNube = async () => (await invocar("indice", {})).indice || [];
export const leerNube = async (id, onProgreso) => (await invocar("leer", { id }, onProgreso)).doc || null;
const guardarEnNube = (id, doc, indice) => invocar("guardar", { id, doc, indice: limpio(indice) });
const borrarEnNube = (id, indice) => invocar("borrar", { id, indice: limpio(indice) });
const subirIndice = (indice) => invocar("indice-guardar", { indice: limpio(indice) });

/* ── Reconciliación al entrar ── */

/** Flujos cuyo cuerpo está en la nube pero no (o desfasado) en este navegador. */
const porDescargar = new Set();

export const necesitaDescarga = (id) => porDescargar.has(id);

/**
 * Cruza los dos índices. De cada flujo gana la versión con fecha más reciente;
 * lo que solo existe en un lado se conserva. Función pura: dice qué queda, qué
 * hay que subir y qué hay que bajar, sin tocar nada.
 */
export function combinarIndices(local, remoto) {
  const enRemoto = new Map(remoto.map((m) => [m.id, m]));
  const combinado = [];
  const subir = [];
  const bajar = [];

  for (const mio of local) {
    const suyo = enRemoto.get(mio.id);
    enRemoto.delete(mio.id);
    if (!suyo) {
      combinado.push(mio);
      subir.push(mio.id); // nunca ha llegado a la nube
    } else if (fecha(suyo) > fecha(mio)) {
      combinado.push(suyo);
      bajar.push(mio.id); // lo editaron en otro equipo
    } else {
      combinado.push(mio);
      if (fecha(mio) > fecha(suyo)) subir.push(mio.id);
    }
  }
  // Lo que solo está en la nube: aparece en la portada y se baja al abrirlo.
  for (const suyo of enRemoto.values()) {
    combinado.push(suyo);
    bajar.push(suyo.id);
  }

  combinado.sort((a, b) => fecha(b) - fecha(a));
  return { combinado, subir, bajar };
}

/**
 * Reconcilia lo de este navegador con lo guardado en S3 y deja el resultado en
 * localStorage. Devuelve el índice combinado, o null si la nube no está activa.
 */
export async function sincronizarIndice() {
  if (!nubeActiva) return null;

  const { combinado, subir, bajar } = combinarIndices(cargarIndice(), await indiceNube());
  guardarIndice(combinado);
  for (const id of bajar) porDescargar.add(id);
  // Las subidas pendientes van de fondo: la portada no espera por ellas.
  for (const id of subir) encolar(id);

  return combinado;
}

/**
 * Devuelve el cuerpo de un flujo, bajándolo de la nube si esta copia es la
 * buena. Si la descarga falla, se abre lo que haya en local.
 *
 * `avisar(etapa, pct)` va contando lo que pasa: bajar cientos de KB y luego
 * preparar cientos de pasos lleva su tiempo, y sin señal parece que se colgó.
 */
export async function documento(id, avisar = () => {}) {
  if (!porDescargar.has(id)) {
    avisar("abriendo", 0);
    const doc = cargarDocumento(id);
    avisar("listo", 100);
    return doc;
  }
  try {
    avisar("bajando", 0);
    const doc = await leerNube(id, (leidos, total) => {
      avisar("bajando", total ? Math.round((leidos / total) * 100) : 0);
    });
    avisar("preparando", 100);
    porDescargar.delete(id);
    if (!doc || !Array.isArray(doc.nodes)) return cargarDocumento(id);
    guardarDocumento(id, doc);
    const listo = cargarDocumento(id); // pasa por la carga normal: rellena dimensiones
    avisar("listo", 100);
    return listo;
  } catch (e) {
    console.warn("[nube] no se pudo descargar el flujo:", e);
    return cargarDocumento(id);
  }
}

/* ── Subida agrupada ── */

const pendientes = new Set(); // ids a subir
let temporizador = null;
let enVuelo = false;
let enCurso = null; // promesa del vaciado en marcha
const oyentes = new Set();

/** Estado de la sincronización: "subiendo" | "guardado" | "error" | null. */
let estado = null;

function anunciar(nuevo) {
  estado = nuevo;
  for (const f of oyentes) f(nuevo);
}

export function alSincronizar(fn) {
  oyentes.add(fn);
  fn(estado);
  return () => oyentes.delete(fn);
}

function encolar(id) {
  if (!nubeActiva) return;
  pendientes.add(id);
  clearTimeout(temporizador);
  temporizador = setTimeout(arrancar, ESPERA);
}

const arrancar = () => {
  enCurso = vaciar();
};

async function vaciar() {
  if (enVuelo || !pendientes.size) return;
  enVuelo = true;
  anunciar("subiendo");
  // Se copia y se limpia antes de empezar: lo que se edite durante la subida
  // vuelve a encolarse y se sube en la siguiente vuelta. El índice se lee AHORA
  // —no cuando se encoló— porque para entonces ya está escrito con los cambios.
  const lote = [...pendientes];
  pendientes.clear();
  const indice = cargarIndice();
  try {
    for (const id of lote) {
      const doc = cargarDocumento(id);
      if (doc.nodes.length || doc.edges.length) await guardarEnNube(id, doc, indice);
      else await subirIndice(indice); // flujo vacío: basta con el índice
    }
    anunciar("guardado");
  } catch (e) {
    console.warn("[nube] no se pudo guardar en S3:", e);
    for (const id of lote) pendientes.add(id); // se reintenta
    anunciar("error");
  } finally {
    enVuelo = false;
    if (pendientes.size) temporizador = setTimeout(arrancar, ESPERA);
  }
}

/** Un flujo cambió: súbelo (en un momento). */
export const sincronizar = (id) => encolar(id);

/** Solo cambió la portada (renombrar, reordenar): sube el índice y nada más. */
export function sincronizarSoloIndice(indice) {
  if (!nubeActiva) return;
  anunciar("subiendo");
  subirIndice(indice)
    .then(() => anunciar("guardado"))
    .catch((e) => {
      console.warn("[nube] no se pudo guardar el índice:", e);
      anunciar("error");
    });
}

/**
 * Borrar no se agrupa: no tiene sentido esperar por lo que ya no existe. Pero sí
 * espera a la subida que estuviera en marcha, que podría ser la de ESTE flujo:
 * si el borrado se adelantara, el cuerpo quedaría huérfano en S3.
 */
export function borrarEnLaNube(id, indice) {
  if (!nubeActiva) return;
  pendientes.delete(id);
  porDescargar.delete(id);
  Promise.resolve(enCurso)
    .catch(() => {})
    .then(() => borrarEnNube(id, indice))
    .catch((e) => console.warn("[nube] no se pudo borrar:", e));
}

/** Sube lo que quede pendiente antes de cerrar la pestaña. */
export function alCerrar() {
  if (pendientes.size) {
    clearTimeout(temporizador);
    arrancar();
  }
}
