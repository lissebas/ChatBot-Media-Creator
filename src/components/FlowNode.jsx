import { memo, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { GRUPOS } from "../flow/seedFlow";
import { SimContext } from "../sim/SimContext";

/**
 * Tarjeta de nodo. Dos variantes según el grupo:
 *  - `pill`  → cápsula compacta (Inicio / Fin): solo el título.
 *  - tarjeta → etiqueta del grupo en su color, título y texto del paso.
 * Un handle de entrada (arriba) y otro de salida (abajo) para conectar arrastrando.
 */
function FlowNode({ id, data, selected }) {
  const grupo = GRUPOS[data.group] || GRUPOS.inicio;
  const color = grupo.color;
  const { activeNodeId } = useContext(SimContext);
  const active = activeNodeId === id;
  const state = `${selected ? " is-selected" : ""}${active ? " is-active" : ""}`;

  if (grupo.pill) {
    return (
      <div
        className={`pill${grupo.solid ? " pill--solid" : ""}${state}`}
        style={{ "--accent": color }}
      >
        <Handle type="target" position={Position.Top} className="fnode__handle" />
        <span className="pill__grip" aria-hidden="true" />
        <span className="pill__label">{data.title}</span>
        <Handle type="source" position={Position.Bottom} className="fnode__handle" />
      </div>
    );
  }

  return (
    <div className={`fnode${state}`} style={{ "--accent": color }}>
      <Handle type="target" position={Position.Top} className="fnode__handle" />

      <div className="fnode__head">
        <span className="fnode__dot" />
        <span className="fnode__group">{grupo.nombre}</span>
      </div>

      <div className="fnode__title">{data.title}</div>
      {data.text ? <div className="fnode__text">{data.text}</div> : null}

      <Handle type="source" position={Position.Bottom} className="fnode__handle" />
    </div>
  );
}

export default memo(FlowNode);
