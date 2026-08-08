/*
 * Qué hace cada tarjeta de automatización cuando el flujo pasa por ella.
 *
 * Vive aparte del catálogo a propósito: `cardTypes.js` describe la tarjeta (cómo
 * se ve, qué campos tiene, qué salidas), y esto describe qué **decide**. Así el
 * catálogo lo puede leer el renderizador del servidor sin arrastrar la lógica.
 *
 * Todas las funciones son puras: reciben las variables y devuelven por dónde
 * seguir y qué variables quedan. El simulador no sabe de reglas, solo pregunta.
 *
 *   resolver(card, props, ctx) → {
 *     salida?     id de la salida por la que continuar,
 *     saltarA?    título o id de un paso al que saltar (tarjeta «Ir a»),
 *     vars?       variables que se escriben,
 *     nota?       línea técnica que se enseña en el chat,
 *     reintentar? true si hay que repetir el paso (validación fallida),
 *     mensaje?    texto que responde el bot al reintentar,
 *   }
 */
import { getCard } from "../flow/cardTypes";
import { coincidePalabras, coincidir } from "../flow/coincidencias";
import { interpolar, listaDe, normalizar, validarRespuesta } from "../flow/validadores";

/** Valor de una variable; admite escribir `{{otra}}` o una constante. */
const valorDe = (nombre, vars) => {
  const n = String(nombre ?? "").trim();
  if (!n) return "";
  if (n.includes("{{")) return interpolar(n, vars);
  return vars[n] ?? "";
};

const numero = (v, porDefecto) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : porDefecto;
};

/* ── Condiciones ── */

function cumple(cond, vars) {
  const izq = valorDe(cond.variable, vars);
  const der = interpolar(String(cond.valor ?? ""), vars);
  const a = normalizar(izq);
  const b = normalizar(der);

  switch (cond.operador || "igual") {
    case "distinto":
      return a !== b;
    case "contiene":
      return Boolean(b) && a.includes(b);
    case "empieza":
      return Boolean(b) && a.startsWith(b);
    case "mayor":
      return Number(izq) > Number(der);
    case "menor":
      return Number(izq) < Number(der);
    case "vacio":
      return !String(izq ?? "").trim();
    case "no_vacio":
      return Boolean(String(izq ?? "").trim());
    case "regex":
      try {
        return new RegExp(der, "i").test(String(izq ?? ""));
      } catch {
        return false;
      }
    default:
      return a === b;
  }
}

const rutaSeCumple = (ruta, vars) => {
  const cs = (ruta.condiciones || []).filter((c) => String(c.variable ?? "").trim());
  if (!cs.length) return false;
  return (ruta.modo || "todas") === "alguna"
    ? cs.some((c) => cumple(c, vars))
    : cs.every((c) => cumple(c, vars));
};

/* ── Horario ── */

const DIAS_PRESET = { lv: [1, 2, 3, 4, 5], ls: [1, 2, 3, 4, 5, 6], todos: [0, 1, 2, 3, 4, 5, 6] };
const INICIAL_A_DIA = { d: 0, l: 1, m: 2, x: 3, j: 4, v: 5, s: 6 };

/** Día de la semana y hora en la zona indicada, sin librerías de fechas. */
function ahoraEn(zona, momento = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zona || undefined,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(momento);
    const busca = (t) => partes.find((p) => p.type === t)?.value || "";
    const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      dia: dias[busca("weekday")] ?? momento.getDay(),
      minutos: Number(busca("hour")) * 60 + Number(busca("minute")),
      fecha: `${busca("year")}-${busca("month")}-${busca("day")}`,
    };
  } catch {
    // Zona horaria inválida: se usa la del navegador antes que fallar.
    return {
      dia: momento.getDay(),
      minutos: momento.getHours() * 60 + momento.getMinutes(),
      fecha: momento.toISOString().slice(0, 10),
    };
  }
}

const enMinutos = (hhmm, porDefecto) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : porDefecto;
};

function estaAbierto(props, momento) {
  const { dia, minutos, fecha } = ahoraEn(props.zona, momento);
  if (listaDe(props.festivos).includes(fecha)) return false;

  const dias =
    (props.dias || "lv") === "otro"
      ? listaDe(props.dias_otros).map((i) => INICIAL_A_DIA[normalizar(i)[0]]).filter((d) => d !== undefined)
      : DIAS_PRESET[props.dias || "lv"] || DIAS_PRESET.lv;
  if (!dias.includes(dia)) return false;

  const abre = enMinutos(props.apertura, 8 * 60);
  const cierra = enMinutos(props.cierre, 17 * 60);
  return minutos >= abre && minutos < cierra;
}

/* ══════════════════════════ Resolución ══════════════════════════ */

/**
 * ctx: { vars, texto, intentos, momento }
 * `texto` es lo último que escribió el usuario (solo en las tarjetas que esperan).
 */
export function resolver(cardKey, props = {}, ctx = {}) {
  const vars = ctx.vars || {};

  switch (cardKey) {
    /* Pregunta, valida y guarda. Es la tarjeta que sostiene todo lo demás. */
    case "ask": {
      const regla = props.regla || "texto";
      const r = validarRespuesta(regla, ctx.texto, props, vars);
      const destino = String(props.variable || "respuesta").trim();

      if (r.ok) {
        return {
          salida: "ok",
          vars: { [destino]: r.valor, respuesta: r.valor },
          nota: `${destino} = ${r.valor}`,
        };
      }
      const maximo = Math.max(1, numero(props.intentos, 2));
      const usados = (ctx.intentos || 0) + 1;
      if (usados < maximo) {
        return {
          reintentar: true,
          mensaje: interpolar(props.error, vars) || r.error,
          nota: `Intento ${usados} de ${maximo}: ${r.error}`,
        };
      }
      return { salida: "fail", nota: `Sin respuesta válida tras ${maximo} intentos` };
    }

    /* Clasifica lo que escribió el usuario por palabras clave. */
    case "intent": {
      const acierto = (props.intenciones || []).find((i) => coincidePalabras(ctx.texto, i.palabras));
      const destino = String(props.variable || "intencion").trim();
      if (!acierto) {
        return { salida: "sin_coincidencia", vars: { respuesta: ctx.texto }, nota: "No reconocí la intención" };
      }
      const i = (props.intenciones || []).indexOf(acierto);
      return {
        salida: acierto.id || `int_${i + 1}`,
        vars: { [destino]: acierto.etiqueta, respuesta: ctx.texto },
        nota: `Intención: ${acierto.etiqueta}`,
      };
    }

    /* Reparte por la primera ruta que se cumpla. */
    case "condition": {
      const rutas = props.rutas || [];
      const i = rutas.findIndex((r) => rutaSeCumple(r, vars));
      if (i < 0) return { salida: "else", nota: "Ninguna ruta se cumple" };
      return { salida: rutas[i].id || `ruta_${i + 1}`, nota: `Ruta: ${rutas[i].etiqueta || i + 1}` };
    }

    case "vars": {
      const nuevas = {};
      for (const a of props.asignaciones || []) {
        const nombre = String(a.variable || "").trim();
        if (!nombre) continue;
        if ((a.origen || "fijo") === "borrar") nuevas[nombre] = undefined;
        else if (a.origen === "respuesta") nuevas[nombre] = vars.respuesta ?? "";
        else nuevas[nombre] = interpolar(String(a.valor ?? ""), vars);
      }
      const listado = Object.keys(nuevas).join(", ");
      return { salida: "next", vars: nuevas, nota: listado ? `Guarda ${listado}` : "Sin asignaciones" };
    }

    case "lookup": {
      const texto = interpolar(String(props.entrada || ""), vars);
      const r = coincidir(texto, interpolar(String(props.items || ""), vars), {
        umbral: numero(props.umbral, 72) / 100,
        max: numero(props.max, 10),
      });
      const destino = String(props.variable || "encontrado").trim();
      const candidatos = String(props.candidatos || "candidatos").trim();
      return {
        salida: r.tipo,
        vars: { [destino]: r.valor ?? "", [candidatos]: r.opciones.join(", ") },
        nota:
          r.tipo === "unico"
            ? `Encontrado: ${r.valor}`
            : r.tipo === "varios"
              ? `${r.opciones.length} candidatos: ${r.opciones.slice(0, 4).join(", ")}…`
              : `Nada se parece a «${texto}»`,
      };
    }

    case "hours": {
      const abierto = estaAbierto(props, ctx.momento || new Date());
      return {
        salida: abierto ? "abierto" : "cerrado",
        vars: { horario: abierto ? "abierto" : "cerrado" },
        nota: abierto ? "Dentro del horario" : "Fuera del horario",
      };
    }

    case "goto":
      return { saltarA: interpolar(String(props.paso || ""), vars), nota: `Salta a «${props.paso || "?"}»` };

    default:
      return null; // no la resuelve el motor: decide quien esté probando
  }
}

/**
 * Comandos globales: se miran ANTES que las opciones del paso actual, así que
 * «menú» funciona en mitad de un formulario.
 * Devuelve { nodo, salida } del comando que coincida, o null.
 */
export function interceptar(nodes, texto) {
  for (const n of nodes) {
    if (n.data?.card !== "commands") continue;
    const comandos = n.data?.props?.comandos || [];
    const i = comandos.findIndex((c) => coincidePalabras(texto, c.palabras));
    if (i >= 0) {
      return { nodo: n.id, salida: comandos[i].id || `cmd_${i + 1}`, etiqueta: comandos[i].etiqueta };
    }
  }
  return null;
}

/** Busca un paso por título (lo normal) o por id, para la tarjeta «Ir a». */
export function buscarPaso(nodes, referencia) {
  const r = normalizar(referencia);
  if (!r) return null;
  const porId = nodes.find((n) => n.id === String(referencia).trim());
  if (porId) return porId.id;
  const porTitulo = nodes.find((n) => normalizar(n.data?.title) === r);
  return porTitulo ? porTitulo.id : null;
}

/** Línea que se enseña en el chat para un paso técnico. */
export function notaDe(cardKey, props = {}, vars = {}) {
  const card = getCard(cardKey);
  const resumen = interpolar(card.summary(props) || "", vars);
  return `${card.nombre}${resumen ? ` · ${resumen}` : ""}`;
}
