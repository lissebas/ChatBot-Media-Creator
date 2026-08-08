/*
 * Reglas de validación de lo que escribe el usuario.
 *
 * Son funciones puras —`valida(texto, opciones) → { ok, valor, error }`— sin
 * nada del navegador dentro, para que las use el simulador hoy y un backend
 * mañana sin cambiar una línea. Cada regla no solo dice si el texto vale:
 * devuelve el valor **normalizado** (el correo en minúsculas, la fecha en ISO,
 * el documento sin puntos), que es lo que se guarda en la variable.
 *
 * Los límites (`min`, `max`) admiten variables y expresiones de fecha, porque
 * "un año entre 1990 y el que viene" es una validación de verdad y no se puede
 * escribir con un número fijo.
 */

/** Quita tildes y pasa a minúsculas: para comparar, nunca para guardar. */
export const normalizar = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const AFIRMATIVOS = new Set(["si", "sí", "s", "claro", "ok", "vale", "dale", "acepto", "correcto", "1", "yes"]);
const NEGATIVOS = new Set(["no", "n", "nel", "negativo", "nunca", "2", "cancelar", "0"]);

const MESES = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

/* ── Interpolación y expresiones ── */

/** Sustituye `{{variable}}` por su valor. Lo que no existe se queda vacío. */
export function interpolar(texto, vars = {}) {
  if (typeof texto !== "string" || !texto.includes("{{")) return texto;
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, nombre) => {
    const v = vars[nombre];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Nombres de variable que aparecen en un texto (`{{correo}}` → `correo`). */
export function variablesDe(texto) {
  return [...String(texto ?? "").matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
}

/**
 * Resuelve un límite: un número, una variable, o una expresión de fecha.
 * Acepta `hoy`, `año actual`, `año actual + 1`, `hoy - 30 días`.
 */
export function resolverLimite(bruto, vars = {}, hoy = new Date()) {
  const crudo = interpolar(String(bruto ?? "").trim(), vars);
  if (!crudo) return undefined;

  const n = Number(crudo.replace(",", "."));
  if (Number.isFinite(n)) return n;

  const t = normalizar(crudo);
  const desplazamiento = /([+-])\s*(\d+)/.exec(t);
  const delta = desplazamiento ? Number(desplazamiento[2]) * (desplazamiento[1] === "-" ? -1 : 1) : 0;

  if (t.startsWith("ano actual") || t.startsWith("year")) return hoy.getFullYear() + delta;
  if (t.startsWith("hoy") || t.startsWith("today")) {
    const d = new Date(hoy);
    d.setDate(d.getDate() + delta);
    return iso(d);
  }
  return crudo;
}

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const numeroDe = (texto) => {
  // "1.250.000" y "1,250,000" son lo mismo; "12,5" es un decimal.
  const limpio = String(texto ?? "").replace(/[^\d,.-]/g, "");
  const sinMiles = limpio.replace(/\.(?=\d{3}\b)/g, "").replace(/,(?=\d{3}\b)/g, "");
  return Number(sinMiles.replace(",", "."));
};

const err = (mensaje) => ({ ok: false, error: mensaje });
const bien = (valor) => ({ ok: true, valor });

/**
 * Comprueba el rango cuando la regla lo declara. Devuelve un mensaje o null.
 * `unidad` solo sirve para redactar el aviso.
 */
function fueraDeRango(valor, op, vars, unidad = "") {
  const min = resolverLimite(op.min, vars);
  const max = resolverLimite(op.max, vars);
  if (min !== undefined && valor < min) return `Tiene que ser ${min}${unidad} o más.`;
  if (max !== undefined && valor > max) return `Tiene que ser ${max}${unidad} o menos.`;
  return null;
}

/* ══════════════════════════ Las reglas ══════════════════════════ */

/**
 * Cada regla declara:
 *   nombre   → cómo se llama en el desplegable del inspector.
 *   ejemplo  → qué se le enseña al usuario cuando se equivoca.
 *   usa      → qué campos extra tiene sentido pedir (`min`, `max`, `patron`…).
 *   valida   → (texto, opciones, vars) => { ok, valor } | { ok:false, error }
 */
export const REGLAS = {
  texto: {
    nombre: "Texto libre",
    ejemplo: "cualquier cosa",
    usa: ["min", "max"],
    valida: (texto, op = {}, vars = {}) => {
      const v = String(texto ?? "").trim();
      const min = resolverLimite(op.min, vars) ?? 1;
      const max = resolverLimite(op.max, vars);
      if (v.length < min) return err(`Escríbelo con al menos ${min} caracteres.`);
      if (max !== undefined && v.length > max) return err(`Como mucho ${max} caracteres.`);
      return bien(v);
    },
  },

  numero: {
    nombre: "Número",
    ejemplo: "1250000",
    usa: ["min", "max"],
    valida: (texto, op = {}, vars = {}) => {
      const n = numeroDe(texto);
      if (!Number.isFinite(n)) return err("Escribe solo el número.");
      const fuera = fueraDeRango(n, op, vars);
      return fuera ? err(fuera) : bien(n);
    },
  },

  entero: {
    nombre: "Número entero",
    ejemplo: "2026",
    usa: ["min", "max"],
    valida: (texto, op = {}, vars = {}) => {
      const n = numeroDe(texto);
      if (!Number.isInteger(n)) return err("Tiene que ser un número entero.");
      const fuera = fueraDeRango(n, op, vars);
      return fuera ? err(fuera) : bien(n);
    },
  },

  correo: {
    nombre: "Correo electrónico",
    ejemplo: "nombre@dominio.com",
    usa: [],
    valida: (texto) => {
      const v = String(texto ?? "").trim().toLowerCase();
      return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) ? bien(v) : err("Eso no parece un correo.");
    },
  },

  telefono: {
    nombre: "Teléfono",
    ejemplo: "+57 300 123 4567",
    usa: ["min", "max"],
    valida: (texto, op = {}, vars = {}) => {
      const bruto = String(texto ?? "").trim();
      const mas = bruto.startsWith("+");
      const digitos = bruto.replace(/\D/g, "");
      const min = resolverLimite(op.min, vars) ?? 7;
      const max = resolverLimite(op.max, vars) ?? 15;
      if (digitos.length < min || digitos.length > max) {
        return err(`El número debe tener entre ${min} y ${max} dígitos.`);
      }
      return bien(mas ? `+${digitos}` : digitos);
    },
  },

  documento: {
    nombre: "Documento de identidad",
    ejemplo: "1.020.304.050",
    usa: ["min", "max"],
    valida: (texto, op = {}, vars = {}) => {
      const digitos = String(texto ?? "").replace(/\D/g, "");
      const min = resolverLimite(op.min, vars) ?? 5;
      const max = resolverLimite(op.max, vars) ?? 12;
      if (digitos.length < min || digitos.length > max) {
        return err(`El documento debe tener entre ${min} y ${max} dígitos.`);
      }
      return bien(digitos);
    },
  },

  fecha: {
    nombre: "Fecha",
    ejemplo: "15/03/1990",
    usa: ["min", "max", "orden"],
    valida: (texto, op = {}, vars = {}) => {
      const f = parseFecha(texto, op.orden);
      if (!f) return err("No entendí la fecha. Escríbela como 15/03/1990.");
      const min = resolverLimite(op.min, vars);
      const max = resolverLimite(op.max, vars);
      if (min !== undefined && f < String(min)) return err(`Tiene que ser desde ${min}.`);
      if (max !== undefined && f > String(max)) return err(`Tiene que ser hasta ${max}.`);
      return bien(f);
    },
  },

  hora: {
    nombre: "Hora",
    ejemplo: "14:30",
    usa: [],
    valida: (texto) => {
      const t = normalizar(texto);
      const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?$/.exec(t);
      if (!m) return err("Escribe la hora como 14:30.");
      let h = Number(m[1]);
      const min = Number(m[2] || 0);
      const sufijo = (m[3] || "").replace(/\./g, "");
      if (sufijo.startsWith("p") && h < 12) h += 12;
      if (sufijo.startsWith("a") && h === 12) h = 0;
      if (h > 23 || min > 59) return err("Esa hora no existe.");
      return bien(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    },
  },

  url: {
    nombre: "Enlace (URL)",
    ejemplo: "https://ejemplo.com",
    usa: [],
    valida: (texto) => {
      const v = String(texto ?? "").trim();
      return /^https?:\/\/\S+\.\S+/i.test(v) ? bien(v) : err("El enlace debe empezar por https://");
    },
  },

  si_no: {
    nombre: "Sí o no",
    ejemplo: "sí",
    usa: [],
    valida: (texto) => {
      const t = normalizar(texto);
      if (AFIRMATIVOS.has(t) || t.startsWith("si ") || t.startsWith("acepto")) return bien("si");
      if (NEGATIVOS.has(t) || t.startsWith("no ")) return bien("no");
      return err("Responde sí o no.");
    },
  },

  opcion: {
    nombre: "Una de la lista",
    ejemplo: "una de las opciones",
    usa: ["opciones"],
    valida: (texto, op = {}) => {
      const lista = listaDe(op.opciones);
      if (!lista.length) return bien(String(texto ?? "").trim());
      const t = normalizar(texto);

      // "2" elige la segunda opción: es lo que la gente escribe en WhatsApp.
      const numerada = /^(\d{1,2})\b/.exec(t);
      if (numerada) {
        const i = Number(numerada[1]) - 1;
        if (lista[i]) return bien(lista[i]);
      }
      const exacta = lista.find((o) => normalizar(o) === t);
      if (exacta) return bien(exacta);
      const parcial = lista.filter((o) => normalizar(o).includes(t) || t.includes(normalizar(o)));
      if (parcial.length === 1) return bien(parcial[0]);
      return err(`Elige una: ${lista.join(", ")}.`);
    },
  },

  patron: {
    nombre: "Expresión regular propia",
    ejemplo: "ABC123",
    usa: ["patron"],
    valida: (texto, op = {}, vars = {}) => {
      const fuente = interpolar(String(op.patron || "").trim(), vars);
      if (!fuente) return bien(String(texto ?? "").trim());
      const v = String(texto ?? "").trim();
      let re;
      try {
        re = new RegExp(fuente, "i");
      } catch {
        return err("La expresión regular del paso no es válida.");
      }
      return re.test(v) ? bien(v.toUpperCase()) : err("El formato no es el esperado.");
    },
  },
};

export const CLAVES_REGLA = Object.keys(REGLAS);

/** Opciones para el desplegable del inspector. */
export const OPCIONES_REGLA = CLAVES_REGLA.map((value) => ({ value, label: REGLAS[value].nombre }));

/** ¿Esta regla usa este campo extra? (lo consultan los `showIf` del catálogo). */
export const reglaUsa = (regla, campo) => (REGLAS[regla]?.usa || []).includes(campo);

/** Valida un texto con la regla indicada. Nunca lanza. */
export function validarRespuesta(regla, texto, opciones = {}, vars = {}) {
  const r = REGLAS[regla] || REGLAS.texto;
  try {
    return r.valida(texto, opciones, vars);
  } catch (e) {
    return err(`No se pudo validar: ${e.message}`);
  }
}

/* ── Fechas ── */

/** Una lista escrita a mano: separada por saltos de línea o por comas. */
export function listaDe(bruto) {
  if (Array.isArray(bruto)) return bruto.map((x) => String(x).trim()).filter(Boolean);
  return String(bruto ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fecha en varios formatos → `AAAA-MM-DD`.
 *
 * Con tres números hay ambigüedad de verdad (03/04/2026 es marzo en EE. UU. y
 * abril aquí), así que la política es explícita: si el año va delante se lee
 * ISO, y si va detrás se lee día/mes salvo que `orden` diga lo contrario.
 */
export function parseFecha(texto, orden = "dmy") {
  const t = normalizar(texto);
  if (!t) return null;

  // "15 de marzo de 1990" / "15 mar 1990"
  const conMes = /(\d{1,2})\s*(?:de\s+)?([a-z]+)\.?\s*(?:de\s+)?(\d{4})/.exec(t);
  if (conMes) {
    const mes = MESES[conMes[2].slice(0, 4)] || MESES[conMes[2].slice(0, 3)];
    if (mes) return armar(Number(conMes[3]), mes, Number(conMes[1]));
  }

  const nums = t.match(/\d+/g);
  if (!nums || nums.length < 3) return null;
  const [a, b, c] = nums.map(Number);

  if (String(nums[0]).length === 4) return armar(a, b, c); // año delante → ISO
  return orden === "mdy" ? armar(c, a, b) : armar(c, b, a);
}

function armar(anio, mes, dia) {
  if (!anio || !mes || !dia || mes > 12 || dia > 31) return null;
  const d = new Date(anio, mes - 1, dia);
  // Rechaza el 31 de febrero: el Date lo desplazaría a marzo sin avisar.
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return iso(d);
}
