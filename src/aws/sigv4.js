/*
 * Llamadas firmadas a AWS desde el navegador, sin SDK.
 *
 * Dos pasos:
 *  1. Cognito Identity Pool cambia el id_token del usuario por credenciales
 *     temporales de AWS (access key, secret y token de sesión).
 *  2. Con ellas se firma la petición a la Lambda con SigV4, que es lo que exige
 *     una Function URL con AuthType AWS_IAM.
 *
 * Se hace a mano porque el SDK de AWS pesa cientos de KB y aquí solo hacen falta
 * dos llamadas JSON y un HMAC — que el navegador ya sabe hacer (WebCrypto).
 */

const REGION = import.meta.env.VITE_REGION || "us-west-2";
const POOL_IDENTIDADES = import.meta.env.VITE_IDENTITY_POOL || "";
const POOL_USUARIOS = import.meta.env.VITE_USER_POOL_ID || "";
const PROVEEDOR = `cognito-idp.${REGION}.amazonaws.com/${POOL_USUARIOS}`;
const IDENTITY_URL = `https://cognito-identity.${REGION}.amazonaws.com/`;

export const firmaDisponible = Boolean(POOL_IDENTIDADES && POOL_USUARIOS);

/* ── Utilidades de bytes/hex ── */

const codificar = (s) => new TextEncoder().encode(s);
const aHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(texto) {
  return aHex(await crypto.subtle.digest("SHA-256", codificar(texto)));
}

async function hmac(clave, mensaje) {
  const k = await crypto.subtle.importKey(
    "raw",
    typeof clave === "string" ? codificar(clave) : clave,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", k, codificar(mensaje));
}

/* ── Credenciales temporales ── */

let credenciales = null; // { accessKeyId, secretKey, sessionToken, expira }
let identityId = null;

async function llamarIdentity(accion, cuerpo) {
  const r = await fetch(IDENTITY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityService.${accion}`,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.message || `${accion} devolvió ${r.status}`);
  return datos;
}

/** Cambia el id_token por credenciales de AWS (se reutilizan hasta que caducan). */
export async function credencialesDe(idToken) {
  if (credenciales && credenciales.expira - 60_000 > Date.now()) return credenciales;

  const logins = { [PROVEEDOR]: idToken };
  if (!identityId) {
    const { IdentityId } = await llamarIdentity("GetId", {
      IdentityPoolId: POOL_IDENTIDADES,
      Logins: logins,
    });
    identityId = IdentityId;
  }
  const { Credentials } = await llamarIdentity("GetCredentialsForIdentity", {
    IdentityId: identityId,
    Logins: logins,
  });

  credenciales = {
    accessKeyId: Credentials.AccessKeyId,
    secretKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
    expira: Credentials.Expiration * 1000,
  };
  return credenciales;
}

/* ── Firma SigV4 ── */

/**
 * POST firmado a una Function URL de Lambda.
 * `host` no se pone a mano (el navegador lo prohíbe) pero SÍ se firma: el valor
 * que pone el navegador es el mismo que va en la firma.
 */
export async function postFirmado(url, cuerpo, cred, { idToken, servicio = "lambda" } = {}) {
  const u = new URL(url);
  const ahora = new Date();
  const amzDate = ahora.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20260808T053000Z
  const fecha = amzDate.slice(0, 8);
  const payload = JSON.stringify(cuerpo);
  const hashPayload = await sha256(payload);

  // El token de sesión solo se firma si existe: con credenciales permanentes,
  // mandarlo vacío hace que AWS rechace la petición.
  const cabeceras = {
    "content-type": "application/json",
    host: u.host,
    "x-amz-content-sha256": hashPayload,
    "x-amz-date": amzDate,
    ...(cred.sessionToken ? { "x-amz-security-token": cred.sessionToken } : {}),
  };
  const firmadas = Object.keys(cabeceras).sort();
  const canonicas = firmadas.map((k) => `${k}:${cabeceras[k]}\n`).join("");
  const listaFirmadas = firmadas.join(";");

  // Sin query string a propósito: todo va en el cuerpo. La canonicalización de
  // la query en SigV4 exige orden y codificación RFC3986, y `searchParams` no
  // cumple ninguna de las dos.
  const peticionCanonica = [
    "POST",
    u.pathname || "/",
    "",
    canonicas,
    listaFirmadas,
    hashPayload,
  ].join("\n");

  const alcance = `${fecha}/${REGION}/${servicio}/aws4_request`;
  const porFirmar = [
    "AWS4-HMAC-SHA256",
    amzDate,
    alcance,
    await sha256(peticionCanonica),
  ].join("\n");

  let clave = await hmac(`AWS4${cred.secretKey}`, fecha);
  clave = await hmac(clave, REGION);
  clave = await hmac(clave, servicio);
  clave = await hmac(clave, "aws4_request");
  const firma = aHex(await hmac(clave, porFirmar));

  const autorizacion =
    `AWS4-HMAC-SHA256 Credential=${cred.accessKeyId}/${alcance}, ` +
    `SignedHeaders=${listaFirmadas}, Signature=${firma}`;

  // `host` lo pone el navegador; el resto van explícitas. `x-id-token` viaja SIN
  // firmar (una cabecera de más no invalida la firma, que solo cubre las que
  // declara `SignedHeaders`): `authorization` la ocupa la firma de AWS, así que
  // el JWT de Cognito necesita su propia cabecera.
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-amz-content-sha256": hashPayload,
      "x-amz-date": amzDate,
      ...(cred.sessionToken ? { "x-amz-security-token": cred.sessionToken } : {}),
      authorization: autorizacion,
      ...(idToken ? { "x-id-token": idToken } : {}),
    },
    body: payload,
  });
}
