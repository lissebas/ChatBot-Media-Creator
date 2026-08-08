import { useState } from "react";
import CardPreview from "./CardPreview";
import FieldForm from "./FieldForm";
import {
  CARDS_POR_FAMILIA,
  buildMessage,
  cardCategoria,
  cardFamilia,
  defaultProps,
  getCard,
  validateCard,
} from "../flow/cardTypes";

/** Al cambiar el tipo de tarjeta, conserva los valores cuyos campos existan en la nueva. */
function remapProps(oldProps = {}, newKey) {
  const base = defaultProps(newKey);
  const keys = new Set(getCard(newKey).fields.map((f) => f.key));
  for (const [k, v] of Object.entries(oldProps)) {
    if (keys.has(k) && v !== undefined && v !== "") base[k] = v;
  }
  return base;
}

/**
 * Panel derecho: edita el nodo o la conexión seleccionada.
 * El formulario del nodo se genera a partir del tipo de tarjeta de Meta, con sus
 * límites de caracteres, su validación y una vista previa del JSON que se envía
 * a la Cloud API.
 */
export default function Inspector({ node, edge, onUpdateNode, onUpdateEdge, onDeleteNode, onDeleteEdge }) {
  const [verJson, setVerJson] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (node) {
    const card = getCard(node.data.card);
    const props = node.data.props || {};
    const { errors, list } = validateCard(node.data.card, props);
    const mensaje = buildMessage(node.data);
    const json = mensaje ? JSON.stringify(mensaje, null, 2) : null;
    const familia = cardFamilia(node.data.card);
    const categoria = cardCategoria(node.data.card);
    const apiTipo = !mensaje
      ? null
      : mensaje.type === "interactive"
        ? `interactive / ${mensaje.interactive?.type}`
        : mensaje.type;

    const copiar = () => {
      navigator.clipboard?.writeText(json || "");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    };

    return (
      <aside className="inspector">
        <div className="inspector__title">Editar paso</div>

        <CardPreview card={node.data.card} props={props} />

        <label className="field">
          <span className="field__label">Nombre del paso</span>
          <input
            value={node.data.title || ""}
            onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
            placeholder="Solo para ti: no se envía a WhatsApp"
          />
        </label>

        <label className="field">
          <span className="field__label">Tipo de tarjeta</span>
          <select
            value={node.data.card}
            onChange={(e) =>
              onUpdateNode(node.id, {
                card: e.target.value,
                props: remapProps(props, e.target.value),
              })
            }
          >
            {CARDS_POR_FAMILIA.flatMap((f) =>
              f.grupos.map((g) => (
                <optgroup key={g.cat} label={`${f.nombre} · ${g.nombre}`}>
                  {g.cards.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.icon} {c.nombre}
                    </option>
                  ))}
                </optgroup>
              )),
            )}
          </select>
        </label>

        <div className="taxo">
          <span className="taxo__fam" style={{ "--accent": familia.color }}>{familia.sigla}</span>
          <span className="taxo__cat" style={{ "--accent": categoria.color }}>{categoria.nombre}</span>
          {apiTipo ? <code className="taxo__api">{apiTipo}</code> : null}
        </div>

        <p className="inspector__desc">
          {card.desc}
          {card.docs ? (
            <>
              {" "}
              <a href={card.docs} target="_blank" rel="noreferrer">
                Documentación de Meta ↗
              </a>
            </>
          ) : null}
        </p>

        {card.fields.length ? <div className="inspector__rule" /> : null}

        <FieldForm
          fields={card.fields}
          values={props}
          errors={errors}
          onChange={(next) => onUpdateNode(node.id, { props: next })}
        />

        {list.length ? (
          <div className="alert">
            <div className="alert__title">Revisa antes de publicar</div>
            <ul>
              {list.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {json ? (
          <div className="jsonbox">
            <button className="jsonbox__toggle" onClick={() => setVerJson((v) => !v)}>
              {verJson ? "▾" : "▸"} JSON para la Cloud API
            </button>
            {verJson ? (
              <>
                <pre className="jsonbox__code">{json}</pre>
                <button className="btn btn--wide" onClick={copiar}>
                  {copiado ? "Copiado ✓" : "Copiar JSON"}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="inspector__meta">id: <code>{node.id}</code></div>
        <button className="btn btn--danger" onClick={() => onDeleteNode(node.id)}>
          Borrar paso
        </button>
      </aside>
    );
  }

  if (edge) {
    return (
      <aside className="inspector">
        <div className="inspector__title">Editar conexión</div>
        <label className="field">
          <span className="field__label">Etiqueta</span>
          <input
            value={edge.label || ""}
            onChange={(e) => onUpdateEdge(edge.id, { label: e.target.value })}
            placeholder="p. ej. Sí / No / sin respuesta"
          />
        </label>
        <p className="inspector__desc">
          Las conexiones que salen de un botón o de una fila ya saben qué opción
          representan; la etiqueta es solo para leer el diagrama.
        </p>
        <div className="inspector__meta">
          <code>{edge.source}</code>
          {edge.sourceHandle && edge.sourceHandle !== "next" ? (
            <>
              {" "}
              <code>{edge.sourceHandle}</code>
            </>
          ) : null}{" "}
          <span>→</span> <code>{edge.target}</code>
        </div>
        <button className="btn btn--danger" onClick={() => onDeleteEdge(edge.id)}>
          Borrar conexión
        </button>
      </aside>
    );
  }

  return (
    <aside className="inspector inspector--empty">
      <div className="inspector__title">Inspector</div>
      <p className="inspector__hint">
        Selecciona un <b>paso</b> o una <b>conexión</b> para editarlo.
      </p>
      <ul className="inspector__tips">
        <li>Cada tarjeta es un <b>tipo de mensaje real</b> de la WhatsApp Cloud API.</li>
        <li>Los <b>botones y filas</b> tienen su propio conector a la derecha.</li>
        <li><b>Clic derecho</b> en el lienzo para crear un paso donde apuntas.</li>
        <li><kbd>Supr</kbd> / <kbd>Backspace</kbd> borra lo seleccionado.</li>
      </ul>
    </aside>
  );
}
