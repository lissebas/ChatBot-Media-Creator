import { useEffect, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

/**
 * Controles flotantes del lienzo: zoom +/−, porcentaje, encuadrar y mostrar u
 * ocultar el minimapa (que en flujos grandes se redibuja entero en cada
 * movimiento de la vista, así que conviene poder apagarlo).
 */
export default function ZoomControls({ mapa, onToggleMapa }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const [pct, setPct] = useState(100);

  useEffect(() => setPct(Math.round(zoom * 100)), [zoom]);

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
    </div>
  );
}
