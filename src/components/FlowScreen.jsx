import { getComponente } from "../flow/flowJson";

/**
 * Vista previa de una pantalla de Flow con el aspecto de la hoja nativa de
 * WhatsApp: barra con «Cancelar», título, los componentes en orden y el botón
 * de pie. Cada componente se puede seleccionar y reordenar desde aquí.
 */
export default function FlowScreen({ pantalla, seleccion, onSelect, onMover, onBorrar, marca }) {
  const hijos = pantalla?.children || [];

  return (
    <div className="fj-phone">
      <div className="fj-sheet">
        <div className="fj-sheet__grip" />
        <div className="fj-sheet__bar">
          <span className="fj-sheet__cancel">Cancelar</span>
          <span className="fj-sheet__title">{pantalla?.title || pantalla?.id}</span>
          <span className="fj-sheet__more">•••</span>
        </div>

        <div className="fj-sheet__body">
          {hijos.length === 0 ? (
            <p className="fj-empty">
              Pantalla vacía. Añade componentes desde la paleta de la izquierda.
            </p>
          ) : null}

          {hijos.map((c, i) => (
            <div
              key={c.uid}
              className={`fj-item${seleccion === c.uid ? " is-sel" : ""}`}
              onClick={() => onSelect(c.uid)}
            >
              <div className="fj-item__tools" onClick={(e) => e.stopPropagation()}>
                <button className="iconbtn" title="Subir" disabled={i === 0} onClick={() => onMover(i, -1)}>↑</button>
                <button
                  className="iconbtn"
                  title="Bajar"
                  disabled={i === hijos.length - 1}
                  onClick={() => onMover(i, 1)}
                >
                  ↓
                </button>
                <button className="iconbtn iconbtn--danger" title="Quitar" onClick={() => onBorrar(c.uid)}>✕</button>
              </div>
              <Componente c={c} />
            </div>
          ))}
        </div>

        <div className="fj-sheet__foot">{marca}</div>
      </div>
    </div>
  );
}

/** Dibujo de cada componente, aproximado al render real de WhatsApp. */
function Componente({ c }) {
  const p = c.props || {};
  const def = getComponente(c.tipo);
  const opciones = p["data-source"] || [];

  switch (c.tipo) {
    case "TextHeading":
      return <div className="fj-heading">{p.text || "Título"}</div>;
    case "TextSubheading":
      return <div className="fj-subheading">{p.text || "Subtítulo"}</div>;
    case "TextBody":
      return (
        <div className="fj-body" style={estiloTexto(p["font-weight"])}>
          {p.text || "Párrafo"}
        </div>
      );
    case "TextCaption":
      return <div className="fj-caption">{p.text || "Nota"}</div>;
    case "EmbeddedLink":
      return <div className="fj-link">{p.text || "Enlace"}</div>;
    case "Image":
      return (
        <div className="fj-image">
          {p.src ? <img src={`data:image/jpeg;base64,${p.src}`} alt={p["alt-text"] || ""} /> : "🖼️"}
        </div>
      );

    case "TextInput":
    case "TextArea":
      return (
        <div className="fj-field">
          <div className={`fj-input${c.tipo === "TextArea" ? " fj-input--area" : ""}`}>
            <span className="fj-input__label">
              {p.label || "Etiqueta"}
              {p.required ? " *" : ""}
            </span>
          </div>
          {p["helper-text"] ? <div className="fj-helper">{p["helper-text"]}</div> : null}
        </div>
      );

    case "DatePicker":
      return (
        <div className="fj-field">
          <div className="fj-input">
            <span className="fj-input__label">{p.label || "Fecha"}</span>
            <span className="fj-input__icon">📅</span>
          </div>
          {p["helper-text"] ? <div className="fj-helper">{p["helper-text"]}</div> : null}
        </div>
      );

    case "Dropdown":
      return (
        <div className="fj-field">
          <div className="fj-input">
            <span className="fj-input__label">{p.label || "Selecciona"}</span>
            <span className="fj-input__icon">⌄</span>
          </div>
        </div>
      );

    case "RadioButtonsGroup":
    case "CheckboxGroup":
      return (
        <div className="fj-field">
          {p.label ? <div className="fj-grouplabel">{p.label}</div> : null}
          {p.description ? <div className="fj-helper">{p.description}</div> : null}
          <div className="fj-options">
            {(opciones.length ? opciones : [{ title: "Opción" }]).map((o, i) => (
              <div className="fj-option" key={i}>
                <div>
                  <div className="fj-option__title">{o.title || "Opción"}</div>
                  {o.description ? <div className="fj-option__desc">{o.description}</div> : null}
                </div>
                <span className={c.tipo === "CheckboxGroup" ? "fj-check" : "fj-radio"} />
              </div>
            ))}
          </div>
        </div>
      );

    case "OptIn":
      return (
        <div className="fj-optin">
          <span className="fj-check" />
          <span>{p.label || "Acepto los términos"}</span>
        </div>
      );

    case "Footer":
      return (
        <div className="fj-footer">
          <div className="fj-footer__btn">{p.label || "Continuar"}</div>
          {p["left-caption"] || p["center-caption"] || p["right-caption"] ? (
            <div className="fj-footer__caps">
              <span>{p["left-caption"]}</span>
              <span>{p["center-caption"]}</span>
              <span>{p["right-caption"]}</span>
            </div>
          ) : null}
        </div>
      );

    default:
      return <div className="fj-body">{def.nombre}</div>;
  }
}

function estiloTexto(peso) {
  if (peso === "bold") return { fontWeight: 700 };
  if (peso === "italic") return { fontStyle: "italic" };
  if (peso === "bold_italic") return { fontWeight: 700, fontStyle: "italic" };
  return undefined;
}
