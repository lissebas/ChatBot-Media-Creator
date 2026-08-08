import { useEffect, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

/**
 * Controles flotantes del lienzo: zoom +/−, porcentaje, encuadrar, y los dos
 * interruptores de rendimiento — el minimapa (se redibuja entero en cada
 * movimiento de la vista) y las aristas ligeras (sin etiquetas).
 */
export default function ZoomControls({ mapa, onToggleMapa, simples, onToggleSimples }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const [pct, setPct] = useState(100);

  useEffect(() => {
    setPct(Math.round(zoom * 100));
  }, [zoom]);

  return (
    <div className="zoomctl">
      <button className="zoomctl__btn" onClick={() => zoomIn({ duration: 180 })} title="Acercar">
        +
      </button>
      <div className="zoomctl__pct" title="Zoom actual">{pct}%</div>
      <button className="zoomctl__btn" onClick={() => zoomOut({ duration: 180 })} title="Alejar">
        −
      </button>
      <div className="zoomctl__sep" />
      <button
        className="zoomctl__btn"
        onClick={() => fitView({ padding: 0.18, duration: 400 })}
        title="Encuadrar todo"
      >
        ⤢
      </button>
      <button
        className={`zoomctl__btn${mapa ? " is-on" : ""}`}
        onClick={onToggleMapa}
        title={mapa ? "Ocultar el minimapa" : "Mostrar el minimapa"}
      >
        ▣
      </button>
      <button
        className={`zoomctl__btn${simples ? " is-on" : ""}`}
        onClick={onToggleSimples}
        title={
          simples
            ? "Aristas ligeras: sin etiquetas (toca para verlas)"
            : "Aristas completas: con etiquetas (toca para aligerar)"
        }
      >
        ⤳
      </button>
    </div>
  );
}
