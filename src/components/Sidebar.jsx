import { useMemo, useState } from "react";
import { CARDS_POR_FAMILIA, buscarCards } from "../flow/cardTypes";

/**
 * Paleta lateral, segmentada en dos niveles: familia (Meta Cards / control de
 * flujo) → categoría → tarjeta. Incluye buscador y grupos plegables, porque el
 * catálogo de Meta es largo.
 *
 * Las tarjetas se arrastran al lienzo para crear un paso (App las lee en
 * onDrop); también se pueden crear con clic derecho sobre el lienzo.
 */
export default function Sidebar() {
  const [familia, setFamilia] = useState("todas");
  const [q, setQ] = useState("");
  const [plegadas, setPlegadas] = useState(() => new Set());

  const filtro = useMemo(() => buscarCards(q), [q]);
  const buscando = filtro !== null;

  const onDragStart = (event, cardKey) => {
    event.dataTransfer.setData("application/chatbot-node", cardKey);
    event.dataTransfer.effectAllowed = "move";
  };

  const toggle = (cat) =>
    setPlegadas((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  // Familias visibles según la pestaña y el buscador.
  const familias = CARDS_POR_FAMILIA.filter((f) => familia === "todas" || f.familia === familia)
    .map((f) => ({
      ...f,
      grupos: f.grupos
        .map((g) => ({ ...g, cards: g.cards.filter((c) => !filtro || filtro.has(c.key)) }))
        .filter((g) => g.cards.length),
    }))
    .filter((f) => f.grupos.length);

  const visibles = familias.reduce((n, f) => n + f.grupos.reduce((m, g) => m + g.cards.length, 0), 0);

  return (
    <aside className="sidebar">
      <div className="sidebar__title">Tarjetas</div>

      <div className="seg" role="tablist">
        <button
          className={`seg__btn${familia === "todas" ? " is-on" : ""}`}
          onClick={() => setFamilia("todas")}
        >
          Todas
        </button>
        {CARDS_POR_FAMILIA.map((f) => (
          <button
            key={f.familia}
            className={`seg__btn${familia === f.familia ? " is-on" : ""}`}
            onClick={() => setFamilia(f.familia)}
            title={f.desc}
          >
            {f.tab || f.nombre}
            <span className="seg__count">{f.total}</span>
          </button>
        ))}
      </div>

      <input
        className="sidebar__search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar tarjeta…"
      />

      {visibles === 0 ? (
        <p className="sidebar__empty">Ninguna tarjeta coincide con «{q}».</p>
      ) : (
        <p className="sidebar__hint">
          Arrastra una al lienzo, o haz <b>clic derecho</b> sobre él.
        </p>
      )}

      {familias.map((f) => (
        <section className="fam" key={f.familia}>
          <div className="fam__head" style={{ "--accent": f.color }}>
            <span className="fam__badge">{f.sigla}</span>
            <span className="fam__name">{f.nombre}</span>
            <span className="fam__count">
              {f.grupos.reduce((n, g) => n + g.cards.length, 0)}
            </span>
          </div>
          <p className="fam__desc">{f.desc}</p>

          {f.grupos.map((g) => {
            const abierta = buscando || !plegadas.has(g.cat);
            return (
              <div className="palgroup" key={g.cat}>
                <button
                  className={`palgroup__title${abierta ? " is-open" : ""}`}
                  onClick={() => toggle(g.cat)}
                  disabled={buscando}
                >
                  <span className="palgroup__chev">▸</span>
                  {g.nombre}
                  <span className="palgroup__count">{g.cards.length}</span>
                </button>

                {abierta ? (
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
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </aside>
  );
}
