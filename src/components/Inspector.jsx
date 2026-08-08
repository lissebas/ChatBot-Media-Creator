import { GRUPOS } from "../flow/seedFlow";

/**
 * Panel derecho: edita el nodo o la arista seleccionada.
 * - Nodo: título, texto, tipo de paso (color) y borrar.
 * - Arista: etiqueta y borrar.
 * Si no hay selección, muestra una ayuda con los atajos del lienzo.
 */
export default function Inspector({ node, edge, onUpdateNode, onUpdateEdge, onDeleteNode, onDeleteEdge }) {
  if (node) {
    return (
      <aside className="inspector">
        <div className="inspector__title">Editar paso</div>
        <label className="field">
          <span>Título</span>
          <input
            value={node.data.title || ""}
            onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
            placeholder="Nombre del paso"
          />
        </label>
        <label className="field">
          <span>Texto / mensaje</span>
          <textarea
            rows={7}
            value={node.data.text || ""}
            onChange={(e) => onUpdateNode(node.id, { text: e.target.value })}
            placeholder="Lo que dice o hace el bot en este paso…"
          />
        </label>
        <div className="field">
          <span>Tipo de paso</span>
          <div className="swatches">
            {Object.entries(GRUPOS).map(([key, g]) => (
              <button
                key={key}
                type="button"
                className={`swatch${node.data.group === key ? " is-on" : ""}`}
                style={{ "--accent": g.color }}
                onClick={() => onUpdateNode(node.id, { group: key })}
                title={g.nombre}
              >
                <span className="swatch__dot" />
                {g.nombre}
              </button>
            ))}
          </div>
        </div>
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
          <span>Etiqueta (condición)</span>
          <input
            value={edge.label || ""}
            onChange={(e) => onUpdateEdge(edge.id, { label: e.target.value })}
            placeholder="p. ej. Sí / No / sin respuesta"
          />
        </label>
        <p className="inspector__hint">
          Sin etiqueta, el paso espera <b>texto libre</b>. Con etiqueta (o con varias
          salidas) el simulador muestra <b>botones</b>.
        </p>
        <div className="inspector__meta">
          <code>{edge.source}</code> <span>→</span> <code>{edge.target}</code>
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
        <li>Arrastra desde el borde inferior de un nodo para <b>conectar</b>.</li>
        <li><b>Clic derecho</b> en el lienzo para crear un paso donde apuntas.</li>
        <li>Arrastra un tipo desde la izquierda para <b>crearlo</b>.</li>
        <li><kbd>Supr</kbd> / <kbd>Backspace</kbd> borra lo seleccionado.</li>
      </ul>
    </aside>
  );
}
