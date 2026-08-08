/*
 * Lambda de ChatBot Creator — se invoca por *Function URL* (sin API Gateway:
 * las Function URL no cuestan aparte, así todo cae en la capa gratuita).
 *
 * Rutas (por el campo `op` del cuerpo, para no necesitar enrutador):
 *   layout   → coloca los nodos con dagre y devuelve solo las posiciones.
 *   analizar → revisa el flujo entero: pasos inalcanzables, callejones sin
 *              salida, salidas sin conectar y tarjetas que Meta rechazaría.
 *
 * La autenticación se valida AQUÍ: la Function URL es pública (AuthType NONE),
 * así que cada petición trae el id_token de Cognito y se comprueba su firma
 * contra el JWKS del user pool. Sin librerías: Node 20 sabe importar un JWK.
 */
import { createPublicKey, verify } from "node:crypto";
import dagre from "dagre";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { cardOutputs, getCard, validateCard } from "../src/flow/cardTypes.js";

const REGION = process.env.AWS_REGION || "us-west-2";
const POOL = process.env.USER_POOL_ID || "";
const CLIENTE = process.env.CLIENT_ID || "";
const EMISOR = `https://cognito-idp.${REGION}.amazonaws.com/${POOL}`;

// La app llama al motor en /api, del MISMO origen (CloudFront enruta hacia la
// Lambda), así que no hay preflight ni cabeceras CORS que devolver. Para el
// entorno local, que sí cruza origen, se permite localhost.
const ORIGENES = (process.env.ORIGENES || "").split(",").filter(Boolean);

function cors(origen) {
  if (!origen || !ORIGENES.includes(origen)) return {};
  return {
    "access-control-allow-origin": origen,
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

const respuesta = (code, cuerpo, origen) => ({
  statusCode: code,
  headers: { "content-type": "application/json; charset=utf-8", ...cors(origen) },
  body: JSON.stringify(cuerpo),
});

/* ── Verificación del token (JWKS cacheado entre invocaciones) ── */

let jwks = null;

async function claves() {
  if (jwks) return jwks;
  const r = await fetch(`${EMISOR}/.well-known/jwks.json`);
  if (!r.ok) throw new Error(`no se pudo leer el JWKS (${r.status})`);
  const { keys } = await r.json();
  jwks = new Map(keys.map((k) => [k.kid, createPublicKey({ key: k, format: "jwk" })]));
  return jwks;
}

const desdeB64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function verificarToken(valor) {
  const token = (valor || "").replace(/^Bearer\s+/i, "").trim();
  const [cabecera, carga, firma] = token.split(".");
  if (!cabecera || !carga || !firma) throw new Error("token mal formado");

  const { kid, alg } = JSON.parse(desdeB64(cabecera).toString());
  if (alg !== "RS256") throw new Error(`algoritmo no admitido: ${alg}`);

  const clave = (await claves()).get(kid);
  if (!clave) throw new Error("el token no viene de este user pool");

  const ok = verify(
    "RSA-SHA256",
    Buffer.from(`${cabecera}.${carga}`),
    clave,
    desdeB64(firma),
  );
  if (!ok) throw new Error("firma inválida");

  const datos = JSON.parse(desdeB64(carga).toString());
  if (datos.iss !== EMISOR) throw new Error("emisor incorrecto");
  if (CLIENTE && datos.aud !== CLIENTE) throw new Error("token de otra aplicación");
  if ((datos.exp || 0) * 1000 < Date.now()) throw new Error("token caducado");
  return datos;
}

/* ── Almacenamiento de flujos ──────────────────────────────────────────────
 * Viven en el MISMO bucket que el sitio, bajo `flujos/<sub>/`, donde `sub` es
 * el identificador del usuario dentro del token de Cognito ya verificado. La
 * carpeta la decide el servidor, nunca el cliente: así un usuario no puede
 * pedir los flujos de otro por mucho que manipule la petición. La política del
 * bucket además impide que CloudFront sirva nada bajo `flujos/`.
 */
const BUCKET = process.env.BUCKET || "";
const s3 = new S3Client({});

const rutaIndice = (sub) => `flujos/${sub}/index.json`;
const rutaDoc = (sub, id) => `flujos/${sub}/${id}.json`;

/** Ids sanos: nada de `../` ni rutas absolutas. */
const idValido = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

async function leerJson(clave, porDefecto = null) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: clave }));
    return JSON.parse(await r.Body.transformToString());
  } catch (e) {
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return porDefecto;
    throw e;
  }
}

const escribirJson = (clave, valor) =>
  s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: clave,
    Body: JSON.stringify(valor),
    ContentType: "application/json; charset=utf-8",
  }));

/* ── Operaciones ── */

/**
 * Auto-organizar. El cliente manda solo lo imprescindible (id + tamaño y las
 * conexiones), no el flujo entero: unos 10 KB en vez de 190 KB.
 */
function layout({ nodes = [], edges = [], dir = "TB" }) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: dir, nodesep: 62, ranksep: 110, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: n.w || 268, height: n.h || 112 });
  for (const e of edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);

  dagre.layout(g);

  const posiciones = {};
  for (const n of nodes) {
    const p = g.node(n.id);
    posiciones[n.id] = { x: p.x - (n.w || 268) / 2, y: p.y - (n.h || 112) / 2 };
  }
  return { posiciones };
}

/** Revisión completa del flujo: lo que crece con el tamaño del diagrama. */
function analizar({ nodes = [], edges = [] }) {
  const porId = new Map(nodes.map((n) => [n.id, n]));
  const salientes = new Map(nodes.map((n) => [n.id, []]));
  const entrantes = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    salientes.get(e.source)?.push(e);
    entrantes.set(e.target, (entrantes.get(e.target) || 0) + 1);
  }

  const inicio =
    nodes.find((n) => n.data?.card === "start")?.id ||
    nodes.find((n) => !entrantes.get(n.id))?.id;

  // Alcanzables desde el inicio (BFS). Los disparadores externos y los comandos
  // globales también son raíces: se entra por ellos aunque nadie los apunte.
  const raices = nodes.filter((n) => getCard(n.data?.card).entrada).map((n) => n.id);
  const vistos = new Set();
  const cola = [...new Set([inicio, ...raices].filter(Boolean))];
  while (cola.length) {
    const id = cola.shift();
    if (vistos.has(id)) continue;
    vistos.add(id);
    for (const e of salientes.get(id) || []) cola.push(e.target);
  }

  const inalcanzables = nodes.filter((n) => !vistos.has(n.id)).map((n) => etiqueta(n));
  const callejones = nodes
    .filter((n) => !getCard(n.data?.card).termina && !(salientes.get(n.id) || []).length)
    .map((n) => etiqueta(n));

  const sueltas = [];
  for (const n of nodes) {
    const conectadas = new Set((salientes.get(n.id) || []).map((e) => e.sourceHandle || "next"));
    for (const o of cardOutputs(n.data || {})) {
      if (!conectadas.has(o.id)) sueltas.push(`${etiqueta(n)} → «${o.label}»`);
    }
  }

  const invalidas = [];
  for (const n of nodes) {
    const { list } = validateCard(n.data?.card, n.data?.props || {});
    for (const m of list) invalidas.push(`${etiqueta(n)}: ${m}`);
  }

  return {
    pasos: nodes.length,
    conexiones: edges.length,
    inicio: inicio ? etiqueta(porId.get(inicio)) : null,
    inalcanzables,
    callejones,
    sueltas,
    invalidas,
  };
}

const etiqueta = (n) =>
  n ? `${n.data?.title || n.id} (${getCard(n.data?.card).nombre})` : "—";

/* ── Entrada ── */

export async function handler(evento) {
  const cabeceras = evento.headers || {};
  const directa = Boolean(evento.op); // invocación por la API, no por Function URL
  const origen = cabeceras.origin || cabeceras.Origin;

  if (evento.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: cors(origen) };
  }

  let sub;
  try {
    // El token llega en `x-id-token`: `Authorization` la ocupa la firma SigV4 con
    // la que el navegador demuestra ante IAM que puede invocar esta función.
    // Doble puerta: IAM valida la firma (solo usuarios del Identity Pool) y aquí
    // se comprueba además de qué usuario de Cognito se trata.
    const datosToken = await verificarToken(
      evento.__token ||
      cabeceras["x-id-token"] || cabeceras["X-Id-Token"] ||
      cabeceras.authorization || cabeceras.Authorization,
    );
    sub = datosToken.sub;
    if (!sub) throw new Error("el token no identifica al usuario");
  } catch (e) {
    return respuesta(401, { error: `No autorizado: ${e.message}` }, origen);
  }

  // Dos formas de llegar aquí: por Function URL (el cuerpo viene como cadena) o
  // por la API `Invoke` de Lambda (el evento ES la petición). La segunda es la
  // que usa el navegador, porque las Function URL de esta cuenta rechazan las
  // credenciales temporales de Cognito.
  let cuerpo;
  try {
    cuerpo = evento.op ? evento : JSON.parse(evento.body || "{}");
  } catch {
    return respuesta(400, { error: "El cuerpo no es JSON válido" }, origen);
  }

  const t0 = Date.now();
  try {
    switch (cuerpo.op) {
      case "layout":
        return respuesta(200, { ...layout(cuerpo), ms: Date.now() - t0 }, origen);
      case "analizar":
        return respuesta(200, { ...analizar(cuerpo), ms: Date.now() - t0 }, origen);
      case "ping":
        return respuesta(200, { ok: true, ms: Date.now() - t0 }, origen);

      // ── Flujos del usuario ──
      case "indice":
        return respuesta(200, { indice: await leerJson(rutaIndice(sub), []), ms: Date.now() - t0 }, origen);

      case "leer": {
        if (!idValido(cuerpo.id)) return respuesta(400, { error: "id inválido" }, origen);
        const doc = await leerJson(rutaDoc(sub, cuerpo.id));
        if (!doc) return respuesta(404, { error: "ese flujo no existe" }, origen);
        return respuesta(200, { doc, ms: Date.now() - t0 }, origen);
      }

      case "guardar": {
        if (!idValido(cuerpo.id)) return respuesta(400, { error: "id inválido" }, origen);
        if (!cuerpo.doc || !Array.isArray(cuerpo.doc.nodes)) {
          return respuesta(400, { error: "el documento no tiene nodos" }, origen);
        }
        await escribirJson(rutaDoc(sub, cuerpo.id), {
          nodes: cuerpo.doc.nodes,
          edges: cuerpo.doc.edges || [],
        });
        if (cuerpo.indice) await escribirJson(rutaIndice(sub), cuerpo.indice);
        return respuesta(200, { ok: true, ms: Date.now() - t0 }, origen);
      }

      case "borrar": {
        if (!idValido(cuerpo.id)) return respuesta(400, { error: "id inválido" }, origen);
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: rutaDoc(sub, cuerpo.id) }));
        if (cuerpo.indice) await escribirJson(rutaIndice(sub), cuerpo.indice);
        return respuesta(200, { ok: true, ms: Date.now() - t0 }, origen);
      }

      case "indice-guardar":
        await escribirJson(rutaIndice(sub), cuerpo.indice || []);
        return respuesta(200, { ok: true, ms: Date.now() - t0 }, origen);
      default:
        return respuesta(400, { error: `Operación desconocida: ${cuerpo.op}` }, origen);
    }
  } catch (e) {
    console.error("[lambda]", e);
    return respuesta(500, { error: String(e.message || e) }, origen);
  }
}
