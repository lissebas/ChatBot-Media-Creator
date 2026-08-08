import { useState } from "react";
import Modal from "./Modal";
import { cardColor, getCard } from "../flow/cardTypes";
import { haceCuanto } from "../flow/workspace";

/** Lo que viene después: se muestra apagado, sin prometer fechas. */
const PROXIMAMENTE = [
  {
    icon: "🚀",
    titulo: "Publicar en WhatsApp",
    desc: "Conectar un número de la Cloud API y poner el flujo a atender de verdad.",
  },
  {
    icon: "🔔",
    titulo: "Webhooks entrantes",
    desc: "Recibir las respuestas reales de los usuarios y avanzar el flujo con ellas.",
  },
  {
    icon: "🧠",
    titulo: "Variables y contexto",
    desc: "Guardar lo que responde el usuario y reutilizarlo en pasos posteriores.",
  },
  {
    icon: "📊",
    titulo: "Analítica del flujo",
    desc: "Ver en qué paso abandonan las conversaciones y cuánto tardan.",
  },
  {
    icon: "🧩",
    titulo: "Plantillas de Meta",
    desc: "Sincronizar las plantillas aprobadas de tu cuenta y usarlas como tarjeta.",
  },
  {
    icon: "🕘",
    titulo: "Historial de versiones",
    desc: "Volver a cualquier versión anterior del flujo y comparar cambios.",
  },
];

/** Resumen de una tarjeta de flujo: pasos, conexiones y colores usados. */
function resumen(flujo) {
  const nodes = flujo.nodes || [];
  const cards = nodes.map((n) => n.data?.card).filter(Boolean);
  const colores = [...new Set(cards.map((c) => cardColor(c)))].slice(0, 6);
  const tipos = [...new Set(cards)].filter((c) => c !== "start" && c !== "end");
  return {
    pasos: nodes.length,
    conexiones: (flujo.edges || []).length,
    colores,
    tipos: tipos.slice(0, 3).map((c) => getCard(c).nombre),
    mas: Math.max(0, tipos.length - 3),
  };
}

export default function Home({
  flujos,
  formularios,
  onAbrir,
  onAbrirFormulario,
  onNuevo,
  onNuevoFormulario,
  onEjemplo,
  onImportar,
  onDuplicar,
  onBorrar,
  onRenombrar,
}) {
  const [borrando, setBorrando] = useState(null);
  const [renombrando, setRenombrando] = useState(null);
  const [nombre, setNombre] = useState("");

  /** Acciones de una tarjeta: sirven para flujos y para formularios. */
  const tools = (f, tipo) => (
    <div className="flowcard__tools">
      <button
        className="iconbtn"
        title="Renombrar"
        onClick={() => {
          setRenombrando({ ...f, tipo });
          setNombre(f.nombre);
        }}
      >
        ✎
      </button>
      <button className="iconbtn" title="Duplicar" onClick={() => onDuplicar(tipo, f.id)}>
        ⧉
      </button>
      <button
        className="iconbtn iconbtn--danger"
        title="Borrar"
        onClick={() => setBorrando({ ...f, tipo })}
      >
        ✕
      </button>
    </div>
  );

  return (
    <div className="home">
      <header className="home__top">
        <div className="toolbar__brand">
          <span className="toolbar__logo">C</span>
          <div>
            <div className="toolbar__name">ChatBot Creator</div>
            <div className="toolbar__sub">Constructor visual de flujos conversacionales</div>
          </div>
        </div>
        <div className="home__topactions">
          <label className="btn" title="Cargar un flujo desde JSON">
            Importar
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={onImportar}
            />
          </label>
          <button className="btn" onClick={onNuevoFormulario}>+ Formulario</button>
          <button className="btn btn--primary" onClick={onNuevo}>+ Nuevo flujo</button>
        </div>
      </header>

      <div className="home__body">
        <section className="home__section">
          <div className="home__sectionhead">
            <h2 className="home__h2">Tus flujos</h2>
            <span className="home__count">{flujos.length}</span>
          </div>

          {flujos.length === 0 ? (
            <div className="empty">
              <div className="empty__icon">🗂️</div>
              <div className="empty__title">Todavía no tienes flujos</div>
              <p className="empty__text">
                Crea uno en blanco y arrastra tarjetas de WhatsApp al lienzo, o importa
                un flujo que ya tengas en JSON.
              </p>
              <div className="empty__actions">
                <button className="btn btn--primary" onClick={onNuevo}>+ Lienzo en blanco</button>
                <button className="btn" onClick={onEjemplo}>Empezar desde el ejemplo</button>
              </div>
            </div>
          ) : (
            <div className="grid">
              {flujos.map((f) => {
                const r = resumen(f);
                return (
                  <article className="flowcard" key={f.id}>
                    <button className="flowcard__open" onClick={() => onAbrir(f.id)}>
                      <div className="flowcard__dots">
                        {r.colores.map((c) => (
                          <span key={c} style={{ background: c }} />
                        ))}
                      </div>
                      <h3 className="flowcard__name">{f.nombre}</h3>
                      <div className="flowcard__meta">
                        {r.pasos} pasos · {r.conexiones} conexiones
                      </div>
                      <div className="flowcard__tipos">
                        {r.tipos.join(" · ") || "Lienzo vacío"}
                        {r.mas ? ` · +${r.mas}` : ""}
                      </div>
                      <div className="flowcard__time">Editado {haceCuanto(f.actualizado)}</div>
                    </button>
                    {tools(f, "flujos")}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="home__section">
          <div className="home__sectionhead">
            <h2 className="home__h2">Formularios nativos (Flows)</h2>
            <span className="home__count">{formularios.length}</span>
          </div>
          <p className="home__lead">
            Las pantallas que se abren dentro del chat. Se diseñan aquí y se publican
            en Meta; luego una tarjeta <b>Flow</b> de tus flujos las invoca.
          </p>

          {formularios.length === 0 ? (
            <div className="empty">
              <div className="empty__icon">🧾</div>
              <div className="empty__title">Sin formularios todavía</div>
              <p className="empty__text">
                Un Flow es el formulario nativo de WhatsApp: títulos, campos, selectores
                y un botón de pie. Al terminar exportas su Flow JSON.
              </p>
              <div className="empty__actions">
                <button className="btn btn--primary" onClick={onNuevoFormulario}>
                  + Crear formulario
                </button>
              </div>
            </div>
          ) : (
            <div className="grid">
              {formularios.map((f) => (
                <article className="flowcard" key={f.id}>
                  <button className="flowcard__open" onClick={() => onAbrirFormulario(f.id)}>
                    <div className="flowcard__dots">
                      <span style={{ background: "#25d366" }} />
                    </div>
                    <h3 className="flowcard__name">{f.nombre}</h3>
                    <div className="flowcard__meta">
                      {(f.pantallas || []).length} pantallas ·{" "}
                      {(f.pantallas || []).reduce((n, p) => n + (p.children || []).length, 0)} componentes
                    </div>
                    <div className="flowcard__tipos">Flow JSON {f.version || "—"}</div>
                    <div className="flowcard__time">Editado {haceCuanto(f.actualizado)}</div>
                  </button>
                  {tools(f, "formularios")}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="home__section">
          <div className="home__sectionhead">
            <h2 className="home__h2">Próximamente</h2>
            <span className="home__count">{PROXIMAMENTE.length}</span>
          </div>
          <div className="grid">
            {PROXIMAMENTE.map((p) => (
              <article className="soon" key={p.titulo}>
                <div className="soon__head">
                  <span className="soon__icon">{p.icon}</span>
                  <span className="soon__badge">Próximamente</span>
                </div>
                <h3 className="soon__title">{p.titulo}</h3>
                <p className="soon__desc">{p.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {borrando ? (
        <Modal
          icon="🗑️"
          title={`¿Borrar «${borrando.nombre}»?`}
          onClose={() => setBorrando(null)}
          acciones={[
            { label: "Cancelar", onClick: () => setBorrando(null), variant: "ghost" },
            {
              label: "Borrar flujo",
              variant: "danger",
              onClick: () => {
                onBorrar(borrando.tipo, borrando.id);
                setBorrando(null);
              },
            },
          ]}
        >
          Esta acción no se puede deshacer. Si quieres conservarlo, ábrelo y usa
          <b> Exportar</b> antes de borrarlo.
        </Modal>
      ) : null}

      {renombrando ? (
        <Modal
          icon="✎"
          title="Renombrar flujo"
          onClose={() => setRenombrando(null)}
          acciones={[
            { label: "Cancelar", onClick: () => setRenombrando(null), variant: "ghost" },
            {
              label: "Guardar",
              variant: "primary",
              onClick: () => {
                onRenombrar(renombrando.tipo, renombrando.id, nombre.trim());
                setRenombrando(null);
              },
            },
          ]}
        >
          <input
            className="modal__input"
            value={nombre}
            autoFocus
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del flujo"
          />
        </Modal>
      ) : null}
    </div>
  );
}
