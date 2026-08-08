import { memo, useContext, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { sinFormato } from "./WaText";
import { cardColor, cardOutputs, getCard, validateCard } from "../flow/cardTypes";
import { hasOptionRows } from "../flow/transform";
import { SimContext } from "../sim/SimContext";

/**
 * Nodo del lienzo. Se dibuja según el tipo de tarjeta de Meta:
 *  - `pill`   → cápsula compacta (Inicio / Fin).
 *  - tarjeta  → icono + tipo, título, previsualización del contenido y una fila
 *               por cada salida (botón de respuesta, fila de lista…), cada una
 *               con su propio conector a la derecha.
 */
function FlowNode({ id, data, selected }) {
  const card = getCard(data.card);
  const color = cardColor(data.card);
  const props = data.props || {};
  const { activeNodeId } = useContext(SimContext);
  const active = activeNodeId === id;
  const state = `${selected ? " is-selected" : ""}${active ? " is-active" : ""}`;

  // Validar y calcular salidas cuesta lo suyo y no cambia si `data` no cambia:
  // con 100 nodos en el lienzo, recalcularlo en cada render se nota al arrastrar.
  const { outs, options, ok, resumen } = useMemo(() => {
    const salidas = cardOutputs(data);
    return {
      outs: salidas,
      options: hasOptionRows(data) ? salidas : [],
      ok: validateCard(data.card, props).ok,
      // En el lienzo se lee mejor sin los marcadores (*negrita*, _cursiva_…).
      resumen: sinFormato(card.summary(props)),
    };
  }, [data, card, props]);

  if (card.pill) {
    const esInicio = !!card.solid;
    return (
      <div className={`pill${esInicio ? " pill--solid" : ""}${state}`} style={{ "--accent": color }}>
        {esInicio ? null : (
          <Handle type="target" position={Position.Top} className="fnode__handle" />
        )}
        <span className="pill__grip" aria-hidden="true" />
        <span className="pill__label">{data.title || card.nombre}</span>
        {outs.length ? (
          <Handle type="source" position={Position.Bottom} id="next" className="fnode__handle" />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`fnode${state}`} style={{ "--accent": color }}>
      <Handle type="target" position={Position.Top} className="fnode__handle" />

      <div className="fnode__head">
        <span className="fnode__icon">{card.icon}</span>
        <span className="fnode__group">{card.nombre}</span>
        {ok ? null : (
          <span className="fnode__warn" title="Falta información o se excede un límite de Meta">
            !
          </span>
        )}
      </div>

      <div className="fnode__title">{data.title || card.nombre}</div>

      {card.media === "image" && props.link ? (
        <img
          className="fnode__thumb"
          src={props.link}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      {resumen ? <div className="fnode__text">{resumen}</div> : null}

      {options.length ? (
        <div className="fnode__opts">
          {options.map((o) => (
            <div className="opt" key={o.id}>
              <span className="opt__label">{o.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={o.id}
                className="fnode__handle opt__handle"
              />
            </div>
          ))}
        </div>
      ) : null}

      {!options.length && outs.length ? (
        <Handle type="source" position={Position.Bottom} id="next" className="fnode__handle" />
      ) : null}
    </div>
  );
}

export default memo(FlowNode);
