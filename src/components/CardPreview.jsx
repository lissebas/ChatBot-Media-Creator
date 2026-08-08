import { useState } from "react";
import WhatsAppMessage from "./WhatsAppMessage";
import FlowScreen from "./FlowScreen";

/**
 * Vista previa de la tarjeta que se está editando, con el aspecto real de
 * WhatsApp. Se actualiza mientras escribes. En las tarjetas de lista, tocar el
 * botón despliega las filas tal como aparecerían en la hoja inferior del chat.
 */
export default function CardPreview({ card, props }) {
  const [verLista, setVerLista] = useState(false);
  const [verForm, setVerForm] = useState(false);
  const secciones = props?.sections || [];
  const pantallas = props?.flowjson?.pantallas || [];

  return (
    <div className="preview">
      <div className="preview__head">
        <span className="preview__title">Vista previa</span>
        <span className="preview__hint">Así se verá en WhatsApp</span>
      </div>

      <div className="preview__screen">
        <WhatsAppMessage
          card={card}
          props={props}
          time="10:30"
          onAction={(id) => {
            if (id === "__list__") setVerLista((v) => !v);
            if (card === "flow" && id === "next" && pantallas.length) setVerForm((v) => !v);
          }}
        />

        {card === "list" && verLista ? (
          <div className="preview__sheet">
            <div className="wa-sheet__head">
              <span>{props.header_text || "Elige una opción"}</span>
              <button className="wa-sheet__close" onClick={() => setVerLista(false)}>✕</button>
            </div>
            <div className="wa-sheet__body">
              {secciones.map((s, si) => (
                <div key={si}>
                  {s.title ? <div className="wa-sheet__sectitle">{s.title}</div> : null}
                  {(s.rows || []).map((r, ri) => (
                    <div className="wa-sheet__row" key={r.id || ri}>
                      <div>
                        <div className="wa-sheet__rowtitle">{r.title || "—"}</div>
                        {r.description ? (
                          <div className="wa-sheet__rowsub">{r.description}</div>
                        ) : null}
                      </div>
                      <span className="wa-sheet__radio" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {card === "flow" && verForm && pantallas.length ? (
          <div className="preview__form">
            <FlowScreen
              pantalla={pantallas[0]}
              seleccion={null}
              onSelect={() => {}}
              onMover={() => {}}
              onBorrar={() => {}}
              marca="Gestionado por tu negocio"
            />
          </div>
        ) : null}
      </div>

      {card === "flow" && pantallas.length ? (
        <p className="preview__formato">
          Toca «{props.flow_cta || "el botón"}» en la vista previa para ver el formulario
          ({pantallas.length} pantalla{pantallas.length === 1 ? "" : "s"}).
        </p>
      ) : null}

      <p className="preview__formato">
        Formato de WhatsApp: <code>*negrita*</code> <code>_cursiva_</code>{" "}
        <code>~tachado~</code> <code>```mono```</code>, listas con <code>-</code> o{" "}
        <code>1.</code> y citas con <code>&gt;</code>.
      </p>
    </div>
  );
}
