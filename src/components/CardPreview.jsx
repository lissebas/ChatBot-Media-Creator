import { useState } from "react";
import WhatsAppMessage from "./WhatsAppMessage";

/**
 * Vista previa de la tarjeta que se está editando, con el aspecto real de
 * WhatsApp. Se actualiza mientras escribes. En las tarjetas de lista, tocar el
 * botón despliega las filas tal como aparecerían en la hoja inferior del chat.
 */
export default function CardPreview({ card, props }) {
  const [verLista, setVerLista] = useState(false);
  const secciones = props?.sections || [];

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
      </div>

      <p className="preview__formato">
        Formato de WhatsApp: <code>*negrita*</code> <code>_cursiva_</code>{" "}
        <code>~tachado~</code> <code>```mono```</code>, listas con <code>-</code> o{" "}
        <code>1.</code> y citas con <code>&gt;</code>.
      </p>
    </div>
  );
}
