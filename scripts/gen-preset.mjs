/*
 * Genera los flujos de `examples/` a partir de los presets de `src/flow/presets`.
 * El JSON resultante se carga con el botón «Importar» del editor.
 *
 *   npm run presets
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { buildFlowFrom } from "../src/flow/transform.js";
import { cardOutputs, validateCard } from "../src/flow/cardTypes.js";
import gysLegal from "../src/flow/presets/gysLegal.js";

const PRESETS = [{ archivo: "examples/gys-legal.json", preset: gysLegal }];

mkdirSync("examples", { recursive: true });
let fallos = 0;

for (const { archivo, preset } of PRESETS) {
  const flujo = buildFlowFrom(preset);
  const byId = new Map(flujo.nodes.map((n) => [n.id, n]));

  // Cada arista debe salir de una salida real y llegar a un nodo existente.
  for (const e of flujo.edges) {
    const src = byId.get(e.source);
    if (!src) {
      console.log(`  ✗ ${e.id}: origen inexistente ${e.source}`);
      fallos++;
      continue;
    }
    if (!byId.get(e.target)) {
      console.log(`  ✗ ${e.id}: destino inexistente ${e.target}`);
      fallos++;
    }
    const ids = cardOutputs(src.data).map((o) => o.id);
    if (!ids.includes(e.sourceHandle)) {
      console.log(`  ✗ ${e.id}: ${e.source} no tiene la salida "${e.sourceHandle}"`);
      fallos++;
    }
  }

  // Avisos de validación de Meta (no bloquean: el flujo se exporta igual).
  const invalidos = flujo.nodes.filter((n) => !validateCard(n.data.card, n.data.props).ok);
  const sueltos = flujo.nodes.filter(
    (n) => !flujo.edges.some((e) => e.source === n.id || e.target === n.id),
  );

  writeFileSync(archivo, `${JSON.stringify(flujo, null, 2)}\n`);
  console.log(
    `${archivo}: ${flujo.nodes.length} nodos, ${flujo.edges.length} conexiones` +
      (invalidos.length ? ` · ${invalidos.length} con avisos de Meta` : "") +
      (sueltos.length ? ` · ${sueltos.length} suelto(s): ${sueltos.map((n) => n.id).join(", ")}` : ""),
  );
}

console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTodo OK");
process.exit(fallos ? 1 : 0);
