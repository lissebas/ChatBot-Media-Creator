/*
 * Login con Cognito (Hosted UI) usando Authorization Code + PKCE.
 *
 * Sin dependencias y sin secreto en el cliente: el navegador genera un
 * verificador aleatorio, manda su hash a Cognito y solo él puede canjear el
 * código por los tokens. Estos viven en `sessionStorage` (mueren al cerrar la
 * pestaña), nunca en localStorage junto a los flujos.
 *
 * Si no hay configuración de Cognito (desarrollo local), el login se desactiva
 * entero y la app funciona igual que siempre.
 */

const DOMINIO = import.meta.env.VITE_COGNITO_DOMINIO || "";
const CLIENTE = import.meta.env.VITE_COGNITO_CLIENTE || "";
const REDIRECT = import.meta.env.VITE_URL_APP || `${window.location.origin}/`;

const CLAVE_VERIFICADOR = "cbc-pkce";
const CLAVE_SESION = "cbc-sesion";
const CLAVE_REINTENTO = "cbc-reintento";

export const authActivo = Boolean(DOMINIO && CLIENTE);

/* ── PKCE ── */

function aleatorio(bytes = 64) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function reto(verificador) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador));
  return b64url(new Uint8Array(hash));
}

/** Payload del id_token (solo para mostrar el correo; no es una validación). */
function leerToken(idToken) {
  try {
    const [, payload] = idToken.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/**
 * Reintenta el login desde cero UNA sola vez (un bucle de redirecciones sería
 * peor que el error). El segundo intento fallido sí se muestra.
 */
async function reintentarLogin(motivo) {
  if (sessionStorage.getItem(CLAVE_REINTENTO)) {
    sessionStorage.removeItem(CLAVE_REINTENTO);
    throw new Error(`No se pudo completar el login (${motivo}).`);
  }
  sessionStorage.setItem(CLAVE_REINTENTO, "1");
  await entrar();
  return new Promise(() => {});
}

/* ── Sesión ── */

function guardarSesion(tokens) {
  const datos = leerToken(tokens.id_token) || {};
  const sesion = {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    correo: datos.email || datos["cognito:username"] || "",
    expira: (datos.exp || 0) * 1000,
  };
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  return sesion;
}

export function sesion() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null");
    if (!s || !s.expira || s.expira < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export async function entrar() {
  const verificador = aleatorio();
  sessionStorage.setItem(CLAVE_VERIFICADOR, verificador);
  const q = new URLSearchParams({
    client_id: CLIENTE,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: REDIRECT,
    code_challenge_method: "S256",
    code_challenge: await reto(verificador),
  });
  window.location.replace(`${DOMINIO}/oauth2/authorize?${q}`);
}

export function salir() {
  sessionStorage.removeItem(CLAVE_SESION);
  sessionStorage.removeItem(CLAVE_VERIFICADOR);
  sessionStorage.removeItem(CLAVE_REINTENTO);
  if (!authActivo) return;
  const q = new URLSearchParams({ client_id: CLIENTE, logout_uri: REDIRECT });
  window.location.replace(`${DOMINIO}/logout?${q}`);
}

async function canjear(code, verificador) {
  const r = await fetch(`${DOMINIO}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENTE,
      code,
      redirect_uri: REDIRECT,
      code_verifier: verificador,
    }),
  });
  if (!r.ok) {
    // El motivo exacto viene en el cuerpo (invalid_grant, invalid_client…):
    // sin él, un 400 no dice nada y hay que adivinar.
    let detalle = "";
    try {
      const cuerpo = await r.json();
      detalle = cuerpo.error_description || cuerpo.error || "";
    } catch {
      detalle = (await r.text().catch(() => "")).slice(0, 200);
    }
    throw new Error(`Cognito ${r.status}${detalle ? `: ${detalle}` : ""} (redirect_uri: ${REDIRECT})`);
  }
  sessionStorage.removeItem(CLAVE_VERIFICADOR);
  return guardarSesion(await r.json());
}

/**
 * Resuelve la sesión antes de dibujar la app:
 *  - sin Cognito configurado → entra directo (desarrollo local);
 *  - de vuelta del Hosted UI (?code=) → canjea y limpia la URL;
 *  - con sesión válida → sigue;
 *  - si no → manda al login (y esta promesa no se resuelve: la página navega).
 */
export async function resolverSesion() {
  if (!authActivo) return { correo: "", local: true };

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    // La URL se limpia SIEMPRE: un código de Cognito es de un solo uso, así que
    // recargar con `?code=` en la barra garantiza un 400 la segunda vez.
    const verificador = sessionStorage.getItem(CLAVE_VERIFICADOR);
    window.history.replaceState({}, "", window.location.pathname);

    // Sin verificador (otra pestaña, sesión limpiada, vuelta atrás del navegador)
    // el canje no puede funcionar: se empieza el login de cero, una sola vez.
    if (!verificador) return reintentarLogin("se perdió el verificador PKCE");

    try {
      return await canjear(code, verificador);
    } catch (e) {
      if (/invalid_grant/i.test(String(e.message))) return reintentarLogin(e.message);
      throw e;
    }
  }
  if (params.get("error")) {
    throw new Error(`Cognito: ${params.get("error_description") || params.get("error")}`);
  }

  const actual = sesion();
  if (actual) {
    sessionStorage.removeItem(CLAVE_REINTENTO);
    return actual;
  }

  await entrar();
  return new Promise(() => {}); // la página está navegando al login
}
