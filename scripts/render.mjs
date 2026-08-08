/*
 * Renderiza un flujo a PNG desde la línea de comandos, con el MISMO código que
 * usará la Lambda. Sirve para ver el resultado y, sobre todo, para medir si el
 * rasterizado cabe en el presupuesto (<400 ms) antes de montar nada más.
 *
 *   npm run render -- "examples/gys-legal.json" --w 1600 --h 900 --zoom 1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { cajaFlujo, svgDeRegion } from "../api/svg.mjs";

const args = process.argv.slice(2);
const flag = (n, def) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? def : Number(args[i + 1]);
};
const archivo = args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
if (!archivo) {
  console.error('Uso: npm run render -- "examples/flujo.json" [--w 1600 --h 900 --zoom 1]');
  process.exit(1);
}

const flujo = JSON.parse(readFileSync(archivo, "utf8"));
const caja = cajaFlujo(flujo.nodes);
const zoom = flag("zoom", 1);
const region = {
  x: flag("x", caja.x),
  y: flag("y", caja.y),
  w: flag("w", Math.min(1600, caja.w)),
  h: flag("h", Math.min(900, caja.h)),
};

console.log(`${archivo}: ${flujo.nodes.length} nodos · lienzo ${Math.round(caja.w)}×${Math.round(caja.h)} px`);

let t = Date.now();
const svg = svgDeRegion(flujo, { region, zoom });
const msSvg = Date.now() - t;

await initWasm(readFileSync("node_modules/@resvg/resvg-wasm/index_bg.wasm"));
const fuentes = [readFileSync("api/fuentes/DejaVuSans.ttf"), readFileSync("api/fuentes/DejaVuSans-Bold.ttf")];

t = Date.now();
const png = new Resvg(svg, {
  font: { fontBuffers: fuentes, defaultFontFamily: "DejaVu Sans", loadSystemFonts: false },
  background: "transparent",
}).render().asPng();
const msPng = Date.now() - t;

const salida = args.includes("--out") ? args[args.indexOf("--out") + 1] : "/tmp/flujo.png";
writeFileSync(salida, png);

console.log(`región ${region.w}×${region.h} @ zoom ${zoom} → ${Math.round(region.w * zoom)}×${Math.round(region.h * zoom)} px`);
console.log(`SVG: ${(svg.length / 1024).toFixed(0)} KB en ${msSvg} ms · PNG: ${(png.length / 1024).toFixed(0)} KB en ${msPng} ms`);
console.log(`presupuesto (<400 ms y <600 KB): ${msPng < 400 && png.length < 600 * 1024 ? "✅ dentro" : "⚠️ fuera"}`);
console.log(`escrito en ${salida}`);
