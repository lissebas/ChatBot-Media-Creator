/*
 * Tokens del tema, en JavaScript.
 *
 * Los mismos valores que `src/index.css` y `src/App.css`, pero legibles desde
 * código: el renderizador del servidor dibuja las tarjetas con ESTAS constantes,
 * así que si el tema cambia aquí, el navegador y la imagen no se separan.
 */
export const TEMA = {
  lienzo: "#0e0e10",
  punto: "#232327",
  tarjeta: "#1a1a1e",
  panel: "#131316",
  borde: "#26262c",
  bordeAlto: "#35353d",
  texto: "#ededf0",
  apagado: "#8b8b95",
  tenue: "#5c5c66",
  ok: "#12b76a",
  arista: "#54545f",
  aristaTenue: "#3a3a44",
  etiquetaFondo: "#16161a",
  etiquetaTexto: "#a3a3ae",
};

/** Medidas de la tarjeta (espejo de `.fnode`, `.pill` y `.opt` en App.css). */
export const CAJA = {
  radio: 14,
  radioPill: 999,
  padding: 14,
  cabecera: 11,
  titulo: 14,
  resumen: 12,
  opcion: 12,
  altoOpcion: 30,
  radioOpcion: 8,
  fuente: "DejaVu Sans",
};
