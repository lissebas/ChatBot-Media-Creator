import { useReactFlow, useStore } from "@xyflow/react";

/**
 * Controles flotantes del lienzo: zoom +/−, porcentaje, encuadrar todo y volver
 * al primer paso.
 *
 * Los dos interruptores de rendimiento que había aquí (minimapa y modo ligero)
 * ya no existen: los dos van siempre puestos, así que no había nada que elegir.
 */
export default function ZoomControls({ onInicio }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  // El redondeo va DENTRO del selector: así este componente solo se vuelve a
  // dibujar cuando cambia el porcentaje, no en cada fotograma del zoom.
  const pct = useStore((s) => Math.round(s.transform[2] * 100));

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
        className="zoomctl__btn zoomctl__btn--inicio"
        onClick={onInicio}
        title="Ir al primer paso del flujo (Inicio)"
      >
        ▶
      </button>
    </div>
  );
}
