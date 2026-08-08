import { GRUPOS } from "../flow/seedFlow";

/**
 * Panel derecho: edita el nodo o la arista seleccionada.
 * - Nodo: título, texto, grupo (color) y borrar.
 * - Arista: etiqueta y borrar.
 * Si no hay selección, muestra una ayuda.
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
        <label className="field">
          <span>Grupo (color)</span>
          <select
            value={node.data.group}
            onChange={(e) => onUpdateNode(node.id, { group: e.target.value })}
          >
            {Object.entries(GRUPOS).map(([key, g]) => (
              <option key={key} value={key}>{g.nombre}</option>
            ))}
          </select>
        </label>
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
            placeholder="p. ej. Sí / No / sin saldo"
          />
        </label>
        <div className="inspector__meta">
          {edge.source} <span>→</span> {edge.target}
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
        <li>Arrastra un tipo desde la izquierda para <b>crear</b> un paso.</li>
        <li><kbd>Supr</kbd> / <kbd>Backspace</kbd> borra lo seleccionado.</li>
      </ul>
    </aside>
  );
}
