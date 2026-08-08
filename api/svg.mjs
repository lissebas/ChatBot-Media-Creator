/*
 * Dibuja un flujo como SVG, reproduciendo lo que pinta `FlowNode.jsx` en el
 * navegador: cápsulas de Inicio/Fin, tarjetas con su cabecera de color, título,
 * resumen recortado y una fila por cada salida, más las conexiones.
 *
 * Reutiliza el catálogo (`cardTypes.js`) y `nodeSize` (`transform.js`), así que
 * la geometría del dibujo y la del editor son la misma por construcción.
 *
 * Sin sombras a propósito: en SVG serían `feGaussianBlur`, de lo más caro que
 * hay al rasterizar, multiplicado por cada tarjeta.
 */
import { cardColor, cardOutputs, getCard } from "../src/flow/cardTypes.js";
import { hasOptionRows, nodeSize } from "../src/flow/transform.js";
import { CAJA, TEMA } from "../src/flow/tema.js";
import { sinFormato } from "../src/components/WaText.jsx";

/**
 * Quita los emoji. resvg no dibuja fuentes de color (y la de Noto pesa 9,7 MB,
 * demasiado para el paquete), así que se irían como huecos en blanco: mejor
 * limpiarlos que dejar el texto descuadrado.
 */
const sinEmoji = (s) =>
  String(s ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const escapar = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Recorte por ancho aproximado (DejaVu ronda 0,55 em por carácter). */
function recortar(texto, anchoPx, tamano) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  const max = Math.floor(anchoPx / (tamano * 0.55));
  return t.length > max ? `${t.slice(0, Math.max(0, max - 1))}…` : t;
}

/** Reparte un texto en varias líneas, como el recorte a 3 líneas del lienzo. */
function lineas(texto, anchoPx, tamano, maxLineas) {
  const palabras = String(texto ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const porLinea = Math.floor(anchoPx / (tamano * 0.55));
  const out = [];
  let actual = "";
  for (const palabra of palabras) {
    if (!actual) actual = palabra;
    else if ((actual + " " + palabra).length <= porLinea) actual += ` ${palabra}`;
    else {
      out.push(actual);
      actual = palabra;
      if (out.length === maxLineas) break;
    }
  }
  if (actual && out.length < maxLineas) out.push(actual);
  if (out.length === maxLineas && palabras.join(" ").length > out.join(" ").length) {
    out[maxLineas - 1] = recortar(`${out[maxLineas - 1]}…`, anchoPx, tamano);
  }
  return out;
}

const texto = (x, y, contenido, { tamano = 12, color = TEMA.texto, peso = 400 } = {}) =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="${CAJA.fuente}" font-size="${tamano}"` +
  `${peso >= 600 ? ' font-weight="bold"' : ""}>${escapar(sinEmoji(contenido))}</text>`;

/** Anclas de conexión de un nodo: entrada arriba, salidas abajo o por fila. */
export function anclas(nodo) {
  const { width, height } = nodeSize(nodo);
  const { x, y } = nodo.position;
  const salidas = cardOutputs(nodo.data || {});
  const filas = hasOptionRows(nodo.data || {});

  const mapa = {};
  if (filas) {
    // Las filas se dibujan al final de la tarjeta, una debajo de otra.
    const base = y + height - CAJA.padding - salidas.length * CAJA.altoOpcion;
    salidas.forEach((o, i) => {
      mapa[o.id] = { x: x + width, y: base + i * CAJA.altoOpcion + CAJA.altoOpcion / 2 };
    });
  } else if (salidas.length) {
    mapa[salidas[0].id] = { x: x + width / 2, y: y + height };
  }
  return { entrada: { x: x + width / 2, y }, salidas: mapa };
}

/** Trazado en escalones con esquinas redondeadas, como el `smoothstep` del editor. */
function ruta(a, b) {
  const r = 14;
  if (Math.abs(a.x - b.x) < 2) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const medio = a.y + (b.y - a.y) / 2;
  const signo = b.x > a.x ? 1 : -1;
  const dv = Math.min(r, Math.abs(medio - a.y));
  const dh = Math.min(r, Math.abs(b.x - a.x) / 2);
  return (
    `M ${a.x} ${a.y} L ${a.x} ${medio - dv} Q ${a.x} ${medio} ${a.x + signo * dh} ${medio} ` +
    `L ${b.x - signo * dh} ${medio} Q ${b.x} ${medio} ${b.x} ${medio + dv} L ${b.x} ${b.y}`
  );
}

function dibujarNodo(nodo, { seleccion, lod }) {
  const card = getCard(nodo.data?.card);
  const props = nodo.data?.props || {};
  const color = cardColor(nodo.data?.card);
  const { width, height } = nodeSize(nodo);
  const { x, y } = nodo.position;
  const activo = seleccion === nodo.id;
  const borde = activo ? color : TEMA.borde;
  const partes = [];

  if (card.pill) {
    const relleno = card.solid ? color : TEMA.tarjeta;
    partes.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}"` +
        ` fill="${relleno}" stroke="${card.solid ? "none" : borde}" stroke-width="1"/>`,
    );
    partes.push(
      texto(x + 22, y + height / 2 + 5, nodo.data?.title || card.nombre, {
        tamano: 14,
        peso: 700,
        color: card.solid ? "#05231a" : TEMA.texto,
      }),
    );
    return partes.join("");
  }

  partes.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${CAJA.radio}"` +
      ` fill="${TEMA.tarjeta}" stroke="${borde}" stroke-width="${activo ? 1.5 : 1}"/>`,
  );

  const anchoTexto = width - CAJA.padding * 2;
  let cursor = y + CAJA.padding + 10;

  if (!lod) {
    partes.push(`<circle cx="${x + CAJA.padding + 3}" cy="${cursor - 4}" r="3.5" fill="${color}"/>`);
    partes.push(texto(x + CAJA.padding + 13, cursor, card.nombre, { tamano: CAJA.cabecera, color, peso: 600 }));
    cursor += 19;
  }

  partes.push(
    texto(x + CAJA.padding, cursor, recortar(nodo.data?.title || card.nombre, anchoTexto, CAJA.titulo), {
      tamano: CAJA.titulo,
      peso: 600,
    }),
  );
  cursor += 17;

  if (!lod) {
    for (const linea of lineas(sinFormato(card.summary(props)), anchoTexto, CAJA.resumen, 3)) {
      partes.push(texto(x + CAJA.padding, cursor, linea, { tamano: CAJA.resumen, color: TEMA.apagado }));
      cursor += 16;
    }

    const salidas = cardOutputs(nodo.data || {});
    if (hasOptionRows(nodo.data || {})) {
      const base = y + height - CAJA.padding - salidas.length * CAJA.altoOpcion;
      salidas.forEach((o, i) => {
        const fy = base + i * CAJA.altoOpcion;
        partes.push(
          `<rect x="${x + CAJA.padding}" y="${fy}" width="${anchoTexto}" height="${CAJA.altoOpcion - 5}"` +
            ` rx="${CAJA.radioOpcion}" fill="${TEMA.panel}" stroke="${TEMA.borde}"/>`,
        );
        partes.push(
          texto(x + CAJA.padding + 10, fy + 17, recortar(o.label, anchoTexto - 24, CAJA.opcion), {
            tamano: CAJA.opcion,
          }),
        );
        partes.push(
          `<circle cx="${x + width}" cy="${fy + (CAJA.altoOpcion - 5) / 2}" r="4"` +
            ` fill="${TEMA.lienzo}" stroke="${color}" stroke-width="2"/>`,
        );
      });
    }
  }
  return partes.join("");
}

/**
 * SVG de una región del flujo.
 * `region` va en coordenadas del flujo; `zoom` escala el resultado.
 */
export function svgDeRegion({ nodes, edges }, { region, zoom = 1, seleccion = null, omitir = [] } = {}) {
  const fuera = new Set(omitir);
  const porId = new Map(nodes.map((n) => [n.id, n]));
  const ancho = Math.round(region.w * zoom);
  const alto = Math.round(region.h * zoom);
  const lod = zoom < 0.5;

  const visible = (n) => {
    const { width, height } = nodeSize(n);
    return (
      n.position.x < region.x + region.w &&
      n.position.x + width > region.x &&
      n.position.y < region.y + region.h &&
      n.position.y + height > region.y
    );
  };

  const partes = [];
  for (const e of edges) {
    if (fuera.has(e.source) || fuera.has(e.target)) continue;
    const a = porId.get(e.source);
    const b = porId.get(e.target);
    if (!a || !b || (!visible(a) && !visible(b))) continue;
    const origen = anclas(a).salidas[e.sourceHandle || "next"] || anclas(a).salidas.next;
    if (!origen) continue;
    partes.push(
      `<path d="${ruta(origen, anclas(b).entrada)}" fill="none" stroke="${TEMA.arista}"` +
        ` stroke-width="1.6" marker-end="url(#flecha)"/>`,
    );
  }
  for (const n of nodes) {
    if (fuera.has(n.id) || !visible(n)) continue;
    partes.push(dibujarNodo(n, { seleccion, lod }));
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"` +
    ` viewBox="${region.x} ${region.y} ${region.w} ${region.h}">` +
    `<defs><marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"` +
    ` markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="${TEMA.arista}"/></marker></defs>` +
    partes.join("") +
    `</svg>`
  );
}

/** Extensión total del flujo, para encuadrar o para la vista general. */
export function cajaFlujo(nodes) {
  if (!nodes.length) return { x: 0, y: 0, w: 100, h: 100 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    const { width, height } = nodeSize(n);
    x0 = Math.min(x0, n.position.x);
    y0 = Math.min(y0, n.position.y);
    x1 = Math.max(x1, n.position.x + width);
    y1 = Math.max(y1, n.position.y + height);
  }
  const margen = 60;
  return { x: x0 - margen, y: y0 - margen, w: x1 - x0 + margen * 2, h: y1 - y0 + margen * 2 };
}
