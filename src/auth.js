/*
 * Login con Cognito SIN salir de la app.
 *
 * Antes se redirigía al Hosted UI (esa pantalla gris de Amazon, en otro
 * dominio). Ahora el formulario es nuestro y se habla directamente con la API
 * de Cognito: el usuario nunca abandona dev.sebasgomezrubio.com.
 *
 * Flujos usados (todos son un POST JSON, sin SDK):
 *   InitiateAuth USER_PASSWORD_AUTH  → tokens
 *   RespondToAuthChallenge           → cambio de contraseña obligatorio
 *   InitiateAuth REFRESH_TOKEN_AUTH  → renovar sin volver a pedir la contraseña
 *
 * Los tokens viven en sessionStorage (mueren al cerrar la pestaña), nunca junto
 * a los flujos.
 */

const REGION = import.meta.env.VITE_REGION || "us-west-2";
const CLIENTE = import.meta.env.VITE_COGNITO_CLIENTE || "";
const API = `https://cognito-idp.${REGION}.amazonaws.com/`;

const CLAVE_SESION = "cbc-sesion";

export const authActivo = Boolean(CLIENTE);

/* ── Llamadas a Cognito ── */

async function cognito(accion, cuerpo) {
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${accion}`,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(mensajeLegible(datos));
    err.tipo = (datos.__type || "").split("#").pop();
    throw err;
  }
  return datos;
}

/** Traduce los errores de Cognito a algo que se pueda leer. */
function mensajeLegible(datos) {
  const tipo = (datos.__type || "").split("#").pop();
  switch (tipo) {
    case "NotAuthorizedException":
      return "Correo o contraseña incorrectos.";
    case "UserNotFoundException":
      return "No hay ninguna cuenta con ese correo.";
    case "PasswordResetRequiredException":
      return "Hay que restablecer la contraseña de esta cuenta.";
    case "TooManyRequestsException":
    case "LimitExceededException":
      return "Demasiados intentos. Espera un momento.";
    case "InvalidPasswordException":
      return "La contraseña no cumple los requisitos: 12 caracteres, con mayúscula, minúscula y número.";
    default:
      return datos.message || "No se pudo iniciar sesión.";
  }
}

/* ── Sesión ── */

function leerToken(idToken) {
  try {
    const [, carga] = idToken.split(".");
    return JSON.parse(atob(carga.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function sesionCruda() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null");
  } catch {
    return null;
  }
}

function guardar(resultado) {
  const datos = leerToken(resultado.IdToken);
  const nueva = {
    idToken: resultado.IdToken,
    accessToken: resultado.AccessToken,
    // Al renovar, Cognito no reenvía el refresh token: se conserva el anterior.
    refreshToken: resultado.RefreshToken || sesionCruda()?.refreshToken || "",
    correo: datos.email || datos["cognito:username"] || "",
    expira: (datos.exp || 0) * 1000,
  };
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify(nueva));
  return nueva;
}

/** Sesión válida, o null. */
export function sesion() {
  const s = sesionCruda();
  if (!s || !s.expira || s.expira < Date.now()) return null;
  return s;
}

export function salir() {
  sessionStorage.removeItem(CLAVE_SESION);
  window.location.reload();
}

/**
 * Entra con correo y contraseña. Si Cognito exige cambiarla (primer acceso),
 * devuelve el reto en vez de la sesión.
 */
export async function entrar(correo, contrasena) {
  const r = await cognito("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
  });
  if (r.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    return { reto: "nueva-contrasena", sesionReto: r.Session, correo };
  }
  if (!r.AuthenticationResult) throw new Error("Cognito no devolvió la sesión.");
  return { sesion: guardar(r.AuthenticationResult) };
}

/** Responde al cambio de contraseña obligatorio del primer acceso. */
export async function cambiarContrasena(correo, nueva, sesionReto) {
  const r = await cognito("RespondToAuthChallenge", {
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    ClientId: CLIENTE,
    Session: sesionReto,
    ChallengeResponses: { USERNAME: correo, NEW_PASSWORD: nueva },
  });
  if (!r.AuthenticationResult) throw new Error("No se pudo cambiar la contraseña.");
  return guardar(r.AuthenticationResult);
}

/** Renueva en silencio con el refresh token. */
async function renovar(refreshToken) {
  const r = await cognito("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  return r.AuthenticationResult ? guardar(r.AuthenticationResult) : null;
}

/**
 * Resuelve la sesión al arrancar: la reutiliza, la renueva sin molestar, o
 * devuelve null para que se muestre el formulario. Nunca redirige a otro sitio.
 */
export async function resolverSesion() {
  if (!authActivo) return { correo: "", local: true };

  const actual = sesion();
  if (actual) return actual;

  const cruda = sesionCruda();
  if (cruda?.refreshToken) {
    try {
      const renovada = await renovar(cruda.refreshToken);
      if (renovada) return renovada;
    } catch {
      /* el refresh caducó: se pedirá la contraseña */
    }
  }
  sessionStorage.removeItem(CLAVE_SESION);
  return null;
}
