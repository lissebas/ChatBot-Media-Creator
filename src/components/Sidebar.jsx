import { CARDS_POR_CATEGORIA } from "../flow/cardTypes";

/**
 * Paleta lateral: todas las tarjetas de la WhatsApp Cloud API, agrupadas por
 * categoría. Se arrastran al lienzo para crear un paso (App las lee en onDrop);
 * también se pueden crear con clic derecho sobre el lienzo.
 */
export default function Sidebar() {
  const onDragStart = (event, cardKey) => {
    event.dataTransfer.setData("application/chatbot-node", cardKey);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__title">Tarjetas</div>
      <p className="sidebar__hint">
        Arrastra una al lienzo, o haz <b>clic derecho</b> sobre él.
      </p>

      {CARDS_POR_CATEGORIA.map((g) => (
        <div className="palgroup" key={g.cat}>
          <div className="palgroup__title">{g.nombre}</div>
          <div className="palette">
            {g.cards.map((c) => (
              <div
                key={c.key}
                className="palette__item"
                draggable
                onDragStart={(e) => onDragStart(e, c.key)}
                style={{ "--accent": g.color }}
                title={c.desc}
              >
                <span className="palette__icon">{c.icon}</span>
                <span className="palette__name">{c.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
