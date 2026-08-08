import { GRUPOS } from "../flow/seedFlow";

/**
 * Paleta lateral: cada "tipo" (grupo) se puede arrastrar al lienzo para crear un
 * nodo nuevo. Al empezar a arrastrar se guarda el grupo en el dataTransfer; App
 * lo lee en onDrop. También se puede crear con clic derecho sobre el lienzo.
 */
export default function Sidebar() {
  const onDragStart = (event, group) => {
    event.dataTransfer.setData("application/chatbot-node", group);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__title">Pasos</div>
      <p className="sidebar__hint">
        Arrastra un tipo al lienzo, o haz <b>clic derecho</b> sobre él.
      </p>
      <div className="palette">
        {Object.entries(GRUPOS).map(([key, g]) => (
          <div
            key={key}
            className="palette__item"
            draggable
            onDragStart={(e) => onDragStart(e, key)}
            style={{ "--accent": g.color }}
            title={`Crear paso: ${g.nombre}`}
          >
            <span className="palette__dot" />
            <span className="palette__name">{g.nombre}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
