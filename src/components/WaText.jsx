/*
 * Formato de WhatsApp (no Markdown estándar): lo que el usuario escribe en el
 * cuerpo de una tarjeta se ve con negrita, cursiva, tachado, monoespaciado,
 * listas y citas, igual que en el chat real.
 *
 *   *negrita*      _cursiva_      ~tachado~
 *   ```mono```     `mono`
 *   > cita         - viñeta       1. numerada
 *
 * Reglas que copia de WhatsApp:
 *  - el contenido entre marcadores no puede empezar ni terminar en espacio
 *    (`2 * 3 * 4` no es negrita);
 *  - un marcador suelto se queda tal cual;
 *  - dentro del monoespaciado no se aplica ningún otro formato.
 */

const INLINE = [
  { tag: "code", re: /```([\s\S]+?)```/, literal: true },
  { tag: "code", re: /`([^`\n]+)`/, literal: true },
  { tag: "strong", re: /\*([^*\n]+)\*/ },
  { tag: "em", re: /_([^_\n]+)_/ },
  { tag: "s", re: /~([^~\n]+)~/ },
];

/** Primera coincidencia cuyo contenido no tenga espacios en los bordes. */
function primeraValida(texto, re) {
  const r = new RegExp(re.source, "g");
  let m;
  while ((m = r.exec(texto))) {
    if (m[1] && m[1] === m[1].trim()) return m;
    r.lastIndex = m.index + 1; // marcador inválido: seguimos buscando
  }
  return null;
}

/** Convierte el formato en línea en nodos de React (recursivo). */
function enLinea(texto, k = "t") {
  const out = [];
  let resto = texto;
  let i = 0;

  while (resto) {
    let mejor = null;
    for (const regla of INLINE) {
      const m = primeraValida(resto, regla.re);
      if (m && (!mejor || m.index < mejor.m.index)) mejor = { regla, m };
    }
    if (!mejor) {
      out.push(resto);
      break;
    }
    const { regla, m } = mejor;
    if (m.index > 0) out.push(resto.slice(0, m.index));
    const Tag = regla.tag;
    const key = `${k}${i++}`;
    out.push(
      <Tag key={key} className={regla.tag === "code" ? "wa-code" : undefined}>
        {regla.literal ? m[1] : enLinea(m[1], `${key}-`)}
      </Tag>,
    );
    resto = resto.slice(m.index + m[0].length);
  }
  return out;
}

/** Agrupa las líneas en bloques: párrafo, cita, viñetas y lista numerada. */
function bloques(texto) {
  const lineas = String(texto ?? "").split("\n");
  const out = [];
  let actual = null;

  const cerrar = () => {
    if (actual) out.push(actual);
    actual = null;
  };
  /** Continúa el bloque abierto si es del mismo tipo; si no, abre uno nuevo. */
  const abrir = (tipo) => {
    if (actual?.tipo !== tipo) {
      cerrar();
      actual = { tipo, items: [] };
    }
    return actual;
  };

  for (const linea of lineas) {
    const cita = linea.match(/^>\s?(.*)$/);
    const vineta = linea.match(/^\s*[-*]\s+(.+)$/);
    const numerada = linea.match(/^\s*\d+[.)]\s+(.+)$/);

    if (cita) {
      abrir("cita").items.push(cita[1]);
    } else if (vineta) {
      abrir("ul").items.push(vineta[1]);
    } else if (numerada) {
      abrir("ol").items.push(numerada[1]);
    } else if (linea.trim() === "") {
      cerrar();
      out.push({ tipo: "hueco" });
    } else {
      abrir("p").items.push(linea);
    }
  }
  cerrar();
  return out;
}

/** Texto de WhatsApp con su formato aplicado. */
export default function WaText({ text, className = "" }) {
  if (!text) return null;

  return (
    <div className={`wa-md ${className}`.trim()}>
      {bloques(text).map((b, i) => {
        if (b.tipo === "hueco") return <div className="wa-md__gap" key={i} />;
        if (b.tipo === "ul" || b.tipo === "ol") {
          const Lista = b.tipo;
          return (
            <Lista className="wa-md__list" key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{enLinea(it, `${i}-${j}-`)}</li>
              ))}
            </Lista>
          );
        }
        if (b.tipo === "cita") {
          return (
            <blockquote className="wa-md__quote" key={i}>
              {b.items.map((it, j) => (
                <div key={j}>{enLinea(it, `${i}-${j}-`)}</div>
              ))}
            </blockquote>
          );
        }
        return (
          <p className="wa-md__p" key={i}>
            {b.items.map((it, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {enLinea(it, `${i}-${j}-`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Mismo texto sin los marcadores: para las tarjetas del lienzo. */
export function sinFormato(texto) {
  return String(texto ?? "")
    .replace(/```([\s\S]+?)```/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~([^~\n]+)~/g, "$1")
    .replace(/^\s*>\s?/gm, "");
}
