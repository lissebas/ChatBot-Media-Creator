import { useMemo, useState } from "react";
import FieldForm from "./FieldForm";
import FlowScreen from "./FlowScreen";
import {
  COMPONENTES_POR_CAT,
  VERSION_FLOW,
  camposDe,
  componenteCon,
  construirFlowJson,
  getComponente,
  nuevaPantalla,
  nuevoComponente,
  validarFlow,
} from "../flow/flowJson";

/**
 * Diseñador del formulario de UNA tarjeta Flow. Se abre sobre el lienzo, sin
 * salir del flujo: la tarjeta es la dueña de sus pantallas.
 *
 * Es un componente controlado: `valor` son las pantallas guardadas en la tarjeta
 * y cada cambio sube por `onChange`.
 */
export default function FlowDesigner({ valor, onChange, onClose, nombre }) {
  const flujo = valor?.pantallas?.length
    ? valor
    : { version: VERSION_FLOW, pantallas: [nuevaPantalla(1)] };

  const [pantallaId, setPantallaId] = useState(flujo.pantallas[0]?.id);
  const [seleccion, setSeleccion] = useState(null);
  const [verJson, setVerJson] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const pantalla = flujo.pantallas.find((p) => p.id === pantallaId) || flujo.pantallas[0];
  const componente = pantalla?.children.find((c) => c.uid === seleccion) || null;
  const json = useMemo(() => JSON.stringify(construirFlowJson(flujo), null, 2), [flujo]);
  const avisos = useMemo(() => validarFlow(flujo), [flujo]);

  const setPantallas = (pantallas) => onChange({ ...flujo, pantallas });
  const setPantalla = (id, patch) =>
    setPantallas(flujo.pantallas.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPantalla = () => {
    let n = flujo.pantallas.length + 1;
    while (flujo.pantallas.some((p) => p.id === `PANTALLA_${n}`)) n += 1;
    const nueva = nuevaPantalla(n);
    nueva.children = [componenteCon("Footer", { label: "Continuar", accion: "complete" })];
    nueva.terminal = true;
    setPantallas([...flujo.pantallas, nueva]);
    setPantallaId(nueva.id);
    setSeleccion(null);
  };

  const borrarPantallaActual = () => {
    if (flujo.pantallas.length < 2) return;
    const resto = flujo.pantallas.filter((p) => p.id !== pantalla.id);
    setPantallas(resto);
    setPantallaId(resto[0].id);
    setSeleccion(null);
  };

  const addComponente = (tipo) => {
    const def = getComponente(tipo);
    if (def.unicoPorPantalla && pantalla.children.some((c) => c.tipo === tipo)) return;
    const nuevo = nuevoComponente(tipo, camposDe(pantalla).length);
    const hijos = [...pantalla.children];
    const iPie = hijos.findIndex((c) => c.tipo === "Footer");
    // El pie siempre cierra la pantalla; el resto entra justo antes.
    if (tipo === "Footer" || iPie === -1) hijos.push(nuevo);
    else hijos.splice(iPie, 0, nuevo);
    setPantalla(pantalla.id, { children: hijos });
    setSeleccion(nuevo.uid);
  };

  const moverComponente = (i, dir) => {
    const hijos = [...pantalla.children];
    const j = i + dir;
    if (j < 0 || j >= hijos.length) return;
    [hijos[i], hijos[j]] = [hijos[j], hijos[i]];
    setPantalla(pantalla.id, { children: hijos });
  };

  const borrarComponente = (uid) => {
    setPantalla(pantalla.id, { children: pantalla.children.filter((c) => c.uid !== uid) });
    if (seleccion === uid) setSeleccion(null);
  };

  /** Renombrar una pantalla arrastra las referencias de los botones. */
  const renombrarPantalla = (idViejo, idNuevo) => {
    const limpio = idNuevo.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    setPantallas(
      flujo.pantallas.map((p) => ({
        ...p,
        id: p.id === idViejo ? limpio : p.id,
        children: p.children.map((c) =>
          c.tipo === "Footer" && c.props?.next === idViejo
            ? { ...c, props: { ...c.props, next: limpio } }
            : c,
        ),
      })),
    );
    setPantallaId(limpio);
  };

  const exportar = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(nombre || "flow").replace(/[^\w-]+/g, "-").toLowerCase()}.flow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiar = () => {
    navigator.clipboard?.writeText(json);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <div className="fd">
      <div className="fd__backdrop" onClick={onClose} />
      <div className="fd__panel">
        <header className="fd__head">
          <span className="taxo__fam" style={{ "--accent": "#25d366" }}>FLOW JSON</span>
          <div className="fd__title">
            Formulario de «{nombre}»
            <span className="fd__sub">
              {flujo.pantallas.length} pantallas · versión {flujo.version || VERSION_FLOW}
            </span>
          </div>
          <div className="fd__actions">
            <button className="btn" onClick={() => setVerJson((v) => !v)}>
              {verJson ? "Ver diseño" : "Ver JSON"}
            </button>
            <button className="btn" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar JSON"}</button>
            <button className="btn" onClick={exportar}>Exportar</button>
            <button className="btn btn--primary" onClick={onClose}>Listo</button>
          </div>
        </header>

        <div className="fd__body">
          <aside className="sidebar">
            <div className="sidebar__title">Pantallas</div>
            <div className="fj-screens">
              {flujo.pantallas.map((p) => (
                <button
                  key={p.id}
                  className={`fj-screen${p.id === pantalla?.id ? " is-on" : ""}`}
                  onClick={() => {
                    setPantallaId(p.id);
                    setSeleccion(null);
                  }}
                >
                  <span className="fj-screen__id">{p.id}</span>
                  <span className="fj-screen__meta">
                    {p.children.length} comp.{p.terminal ? " · final" : ""}
                  </span>
                </button>
              ))}
            </div>
            <button className="btn btn--add" onClick={addPantalla}>+ Añadir pantalla</button>

            <div className="sidebar__title" style={{ marginTop: 18 }}>Componentes</div>
            {COMPONENTES_POR_CAT.map((g) => (
              <div className="palgroup" key={g.cat}>
                <div className="palgroup__title is-open" style={{ cursor: "default" }}>{g.cat}</div>
                <div className="palette">
                  {g.items.map((c) => (
                    <button
                      key={c.key}
                      className="palette__item"
                      style={{ "--accent": "#25d366" }}
                      title={c.desc}
                      onClick={() => addComponente(c.key)}
                    >
                      <span className="palette__icon">{c.icon}</span>
                      <span className="palette__name">{c.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>

          <div className="fj-canvas">
            {verJson ? (
              <pre className="fj-json">{json}</pre>
            ) : (
              <FlowScreen
                pantalla={pantalla}
                seleccion={seleccion}
                onSelect={setSeleccion}
                onMover={moverComponente}
                onBorrar={borrarComponente}
                marca="Gestionado por tu negocio"
              />
            )}
          </div>

          <aside className="inspector">
            {componente ? (
              <>
                <div className="inspector__title">{getComponente(componente.tipo).nombre}</div>
                <div className="taxo">
                  <span className="taxo__cat" style={{ "--accent": "#25d366" }}>
                    {getComponente(componente.tipo).cat}
                  </span>
                  <code className="taxo__api">{componente.tipo}</code>
                </div>
                <FieldForm
                  fields={getComponente(componente.tipo).fields}
                  values={componente.props}
                  ctx={{ pantallas: flujo.pantallas }}
                  onChange={(props) =>
                    setPantalla(pantalla.id, {
                      children: pantalla.children.map((c) =>
                        c.uid === seleccion ? { ...c, props } : c,
                      ),
                    })
                  }
                />
                <button className="btn btn--danger" onClick={() => borrarComponente(componente.uid)}>
                  Quitar componente
                </button>
              </>
            ) : (
              <>
                <div className="inspector__title">Pantalla</div>
                <label className="field">
                  <span className="field__label">Id (va en el Flow JSON)</span>
                  <input
                    value={pantalla?.id || ""}
                    onChange={(e) => renombrarPantalla(pantalla.id, e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Título de la barra</span>
                  <input
                    value={pantalla?.title || ""}
                    onChange={(e) => setPantalla(pantalla.id, { title: e.target.value })}
                  />
                </label>
                <label className="field field--check">
                  <input
                    type="checkbox"
                    checked={!!pantalla?.terminal}
                    onChange={(e) => setPantalla(pantalla.id, { terminal: e.target.checked })}
                  />
                  <span>Pantalla final (terminal)</span>
                </label>
                <label className="field">
                  <span className="field__label">Versión de Flow JSON</span>
                  <input
                    value={flujo.version || VERSION_FLOW}
                    onChange={(e) => onChange({ ...flujo, version: e.target.value })}
                  />
                  <p className="field__help">
                    La vigente es {VERSION_FLOW}; las antiguas dejan de admitirse para publicar.
                  </p>
                </label>
                <div className="inspector__meta">
                  Campos de esta pantalla: <code>{camposDe(pantalla).join(", ") || "ninguno"}</code>
                </div>
                {flujo.pantallas.length > 1 ? (
                  <button className="btn btn--danger" onClick={borrarPantallaActual}>
                    Borrar pantalla
                  </button>
                ) : null}
              </>
            )}

            {avisos.length ? (
              <div className="alert">
                <div className="alert__title">Revisa antes de publicar</div>
                <ul>
                  {avisos.slice(0, 12).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="inspector__desc" style={{ marginTop: 16 }}>
                ✅ El Flow JSON pasa las validaciones locales.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
