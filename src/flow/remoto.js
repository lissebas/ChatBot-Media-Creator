/*
 * Cliente del motor en AWS (Lambda con Function URL).
 *
 * Solo se delega lo que de verdad es cómputo y crece con el tamaño del flujo: el
 * auto-organizado (dagre) y el análisis del diagrama. Validar una tarjeta,
 * importar o guardar es tan barato que mandarlo por la red sería más lento.
 *
 * La Function URL exige AWS_IAM, así que cada llamada va firmada con SigV4 usando
 * credenciales temporales que el Identity Pool entrega a cambio del id_token. El
 * token viaja además en `x-id-token` para que la Lambda sepa QUIÉN pregunta.
 *
 * Si el motor no está configurado o falla, el editor sigue funcionando en local.
 */
import { sesion } from "../auth";
import { credencialesDe, firmaDisponible, postFirmado } from "../aws/sigv4";

const REGION = import.meta.env.VITE_REGION || "us-west-2";
const FUNCION = import.meta.env.VITE_MOTOR_NOMBRE || "";
// Se invoca la API `Invoke` de Lambda, no la Function URL: esta cuenta rechaza
// las credenciales temporales de Cognito en las Function URL, mientras que la
// API acepta exactamente las mismas credenciales.
const URL_MOTOR = FUNCION
  ? `https://lambda.${REGION}.amazonaws.com/2015-03-31/functions/${FUNCION}/invocations`
  : "";

export const motorActivo = Boolean(URL_MOTOR) && firmaDisponible;
/** Por debajo de esto, la ida y vuelta cuesta más que calcularlo en el navegador. */
export const MINIMO_REMOTO = 40;

async function llamar(op, datos) {
  const s = sesion();
  if (!s?.idToken) throw new Error("sin sesión");

  const t0 = performance.now();
  const cred = await credencialesDe(s.idToken);
  const r = await postFirmado(URL_MOTOR, { op, ...datos, __token: s.idToken }, cred);
  if (!r.ok) throw new Error(`El motor devolvió ${r.status}`);

  // `Invoke` devuelve lo que retorna el handler: {statusCode, headers, body}.
  const sobre = await r.json();
  const cuerpo = JSON.parse(sobre.body || "{}");
  if (sobre.statusCode >= 400) throw new Error(cuerpo.error || `El motor devolvió ${sobre.statusCode}`);
  return { ...cuerpo, red: Math.round(performance.now() - t0) };
}

/**
 * Auto-organizar en la nube. Manda solo id + tamaño + conexiones (unos 10 KB
 * para un flujo de 100 pasos, en vez de los ~130 KB del flujo entero).
 */
export async function layoutRemoto(nodes, edges, dir = "TB") {
  const { posiciones, ms, red } = await llamar("layout", {
    dir,
    nodes: nodes.map((n) => ({ id: n.id, w: n.width, h: n.height })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  });
  console.info(`[motor] layout: ${ms} ms de cálculo · ${red} ms con red`);
  return posiciones;
}

/** Revisión del flujo completo (pasos inalcanzables, callejones, salidas sueltas…). */
export async function analizarRemoto(nodes, edges) {
  const informe = await llamar("analizar", { nodes, edges });
  console.info(`[motor] análisis: ${informe.ms} ms de cálculo · ${informe.red} ms con red`);
  return informe;
}

/** Despierta la función al abrir un flujo grande, para que el primer uso no pague el arranque en frío. */
export function precalentar() {
  if (!motorActivo) return;
  llamar("ping", {}).catch(() => {});
}
