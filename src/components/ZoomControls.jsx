import { useReactFlow, useStore } from "@xyflow/react";

/**
 * Controles flotantes del lienzo: zoom +/−, porcentaje, encuadrar, y los dos
 * interruptores de rendimiento — el minimapa (se redibuja entero en cada
 * movimiento de la vista) y el modo ligero (monta solo lo visible).
 */
export default function ZoomControls({ mapa, onToggleMapa, ligero, onToggleLigero }) {
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
        className={`zoomctl__btn${mapa ? " is-on" : ""}`}
        onClick={onToggleMapa}
        title={mapa ? "Ocultar el minimapa" : "Mostrar el minimapa"}
      >
        ▣
      </button>
      <button
        className={`zoomctl__btn${ligero ? " is-on" : ""}`}
        onClick={onToggleLigero}
        title={
          ligero
            ? "Modo ligero activo: solo se dibuja lo que se ve, sin etiquetas ni detalle"
            : "Activar modo ligero (recomendado en flujos grandes)"
        }
      >
        ⚡
      </button>
    </div>
  );
}
