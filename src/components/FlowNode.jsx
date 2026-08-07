import { memo, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { GRUPOS } from "../flow/willyFlow";
import { SimContext } from "../sim/SimContext";

/**
 * Tarjeta de nodo estilo Botpress: barra superior con el color/nombre del grupo,
 * título en negrita y el texto del paso. Un handle de entrada (arriba) y otro de
 * salida (abajo) para conectar arrastrando.
 */
function FlowNode({ id, data, selected }) {
  const grupo = GRUPOS[data.group] || GRUPOS.inicio;
  const color = grupo.color;
  const { activeNodeId } = useContext(SimContext);
  const active = activeNodeId === id;

  return (
    <div
      className={`wnode ${selected ? "wnode--selected" : ""} ${active ? "wnode--active" : ""}`}
      style={{ "--accent": color }}
    >
      <Handle type="target" position={Position.Top} className="wnode__handle" />

      <div className="wnode__bar" style={{ background: color }}>
        <span className="wnode__group">{grupo.nombre}</span>
      </div>

      <div className="wnode__body">
        <div className="wnode__title">{data.title}</div>
        {data.text ? <div className="wnode__text">{data.text}</div> : null}
      </div>

      <Handle type="source" position={Position.Bottom} className="wnode__handle" />
    </div>
  );
}

export default memo(FlowNode);
