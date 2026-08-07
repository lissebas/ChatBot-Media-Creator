import { GRUPOS } from "../flow/willyFlow";

/**
 * Paleta lateral: cada "tipo" (grupo) se puede arrastrar al lienzo para crear un
 * nodo nuevo. Al empezar a arrastrar se guarda el grupo en el dataTransfer; App
 * lo lee en onDrop.
 */
export default function Sidebar() {
  const onDragStart = (event, group) => {
    event.dataTransfer.setData("application/willy-node", group);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__title">Nodos</div>
      <p className="sidebar__hint">Arrastra un tipo al lienzo para crear un paso.</p>
      <div className="palette">
        {Object.entries(GRUPOS).map(([key, g]) => (
          <div
            key={key}
            className="palette__item"
            draggable
            onDragStart={(e) => onDragStart(e, key)}
            style={{ "--accent": g.color }}
            title={`Crear nodo: ${g.nombre}`}
          >
            <span className="palette__dot" style={{ background: g.color }} />
            {g.nombre}
          </div>
        ))}
      </div>
    </aside>
  );
}
