import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import Modal from "./Modal";

/**
 * Diagnóstico de rendimiento: mide en TU navegador lo que no se puede adivinar
 * desde fuera — cuánto DOM hay montado de verdad, cuántos fotogramas por segundo
 * da el lienzo al moverse, y qué máquina lo está dibujando.
 */
export default function Diagnostico({ nodes, edges, ligero, mapa, onClose }) {
  const { getViewport, setViewport } = useReactFlow();
  const [datos, setDatos] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const corriendo = useRef(false);

  useEffect(() => {
    if (corriendo.current) return;
    corriendo.current = true;
    medir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function medir() {
    const lienzo = document.querySelector(".react-flow__viewport");
    const elementos = lienzo ? lienzo.querySelectorAll("*").length : 0;
    const nodosMontados = document.querySelectorAll(".react-flow__node").length;
    const aristasMontadas = document.querySelectorAll(".react-flow__edge").length;

    // Prueba de fluidez: mueve la vista 1,5 s y mide el tiempo de cada fotograma.
    const inicial = getViewport();
    const tiempos = [];
    await new Promise((listo) => {
      let t0 = performance.now();
      const arranque = t0;
      const paso = (t) => {
        tiempos.push(t - t0);
        t0 = t;
        const avance = (t - arranque) / 1500;
        if (avance >= 1) {
          setViewport(inicial);
          return listo();
        }
        setViewport({
          ...inicial,
          x: inicial.x + Math.sin(avance * Math.PI * 2) * 300,
          y: inicial.y + Math.cos(avance * Math.PI * 2) * 150,
        });
        requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    });

    const utiles = tiempos.slice(1).sort((a, b) => a - b);
    const media = utiles.reduce((s, n) => s + n, 0) / (utiles.length || 1);
    const p95 = utiles[Math.floor(utiles.length * 0.95)] || 0;
    const mem = performance.memory
      ? Math.round(performance.memory.usedJSHeapSize / 1048576)
      : null;

    setDatos({
      nodos: nodes.length,
      aristas: edges.length,
      nodosMontados,
      aristasMontadas,
      elementos,
      fps: Math.round(1000 / media),
      media: media.toFixed(1),
      p95: p95.toFixed(1),
      mem,
      ligero,
      mapa,
      nucleos: navigator.hardwareConcurrency || "?",
      memoriaEquipo: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "?",
      dpr: window.devicePixelRatio,
      pantalla: `${window.innerWidth}×${window.innerHeight}`,
      navegador: navigator.userAgent.slice(0, 110),
    });
  }

  const texto = datos
    ? [
        `Flujo: ${datos.nodos} nodos / ${datos.aristas} aristas`,
        `Montado: ${datos.nodosMontados} nodos, ${datos.aristasMontadas} aristas, ${datos.elementos} elementos DOM`,
        `Fluidez: ${datos.fps} fps (medio ${datos.media} ms, p95 ${datos.p95} ms)`,
        `Memoria JS: ${datos.mem ? `${datos.mem} MB` : "no disponible"}`,
        `Modo ligero: ${datos.ligero ? "sí" : "no"} · minimapa: ${datos.mapa ? "sí" : "no"}`,
        `Equipo: ${datos.nucleos} núcleos, ${datos.memoriaEquipo}, DPR ${datos.dpr}, ventana ${datos.pantalla}`,
        `Navegador: ${datos.navegador}`,
      ].join("\n")
    : "";

  return (
    <Modal
      icon="📊"
      title="Diagnóstico de rendimiento"
      onClose={onClose}
      acciones={[
        {
          label: copiado ? "Copiado ✓" : "Copiar",
          onClick: () => {
            navigator.clipboard?.writeText(texto);
            setCopiado(true);
          },
        },
        { label: "Cerrar", onClick: onClose, variant: "primary" },
      ]}
    >
      {!datos ? (
        "Midiendo… (el lienzo se moverá un segundo y medio)"
      ) : (
        <>
          <pre className="jsonbox__code" style={{ maxHeight: 260 }}>{texto}</pre>
          <p style={{ margin: "10px 0 0" }}>
            {datos.fps >= 50
              ? "✅ El lienzo va fluido en esta máquina."
              : datos.fps >= 25
                ? "⚠️ Va justo: se notará al arrastrar."
                : "❌ Va muy lento: aquí está el problema."}
          </p>
        </>
      )}
    </Modal>
  );
}
