import WaText from "./WaText";
import { cardOutputs, getCard } from "../flow/cardTypes";
import { describeCard } from "../sim/runtime";

/*
 * Renderiza una tarjeta tal como se ve en WhatsApp: la burbuja del negocio con
 * su encabezado, cuerpo, pie y hora, y —pegados debajo— los botones nativos
 * (respuestas rápidas, «ver opciones» de una lista, CTA de enlace o de Flow…).
 *
 * Lo usan el simulador (con `onAction`, los botones responden) y la vista previa
 * del inspector (sin `onAction`, los botones se ven pero no hacen nada).
 */

const ICONO_ACCION = {
  list: "☰",
  cta_url: "↗",
  flow: "▤",
  location_request: "📍",
  address_message: "🏠",
  catalog_message: "🛍",
};

/** Botones nativos que WhatsApp dibuja debajo de la burbuja. */
export function accionesDe(cardKey, props) {
  const outs = cardOutputs({ card: cardKey, props });

  if (cardKey === "buttons" || cardKey === "call_permission_request") {
    return outs.map((o) => ({ id: o.id, label: o.label }));
  }
  if (cardKey === "list") {
    return [{ id: "__list__", label: props.button || "Ver opciones", icon: ICONO_ACCION.list }];
  }
  const desc = describeCard(cardKey, props);
  if (desc?.cta) {
    return [{ id: "next", label: desc.cta, icon: ICONO_ACCION[cardKey] }];
  }
  return [];
}

export default function WhatsAppMessage({ card, props = {}, time = "10:30", onAction, muted }) {
  const desc = describeCard(card, props);
  if (!desc) {
    return (
      <div className="wa-note">Este paso no envía ningún mensaje: solo marca el flujo.</div>
    );
  }

  const meta = getCard(card);
  const acciones = accionesDe(card, props);
  const soloSticker = desc.kind === "media" && desc.media === "sticker";

  const cuerpo = (
    <>
      {desc.headerMedia ? (
        <div className="wa-media">
          {desc.headerMedia.type === "image" && desc.headerMedia.link ? (
            <img src={desc.headerMedia.link} alt="" onError={ocultar} />
          ) : (
            <div className="wa-file">
              <span className="wa-file__icon">{desc.headerMedia.icon}</span>
              <span className="wa-file__name">{desc.headerMedia.link || desc.headerMedia.type}</span>
            </div>
          )}
        </div>
      ) : null}

      {desc.kind === "media" ? (
        <div className={`wa-media wa-media--${desc.media}`}>
          {desc.media === "image" && desc.link ? (
            <img src={desc.link} alt="" onError={ocultar} />
          ) : desc.media === "audio" ? (
            <div className="wa-audio">
              <span className="wa-audio__play">▶</span>
              <span className="wa-audio__wave" />
              <span className="wa-audio__time">0:14</span>
            </div>
          ) : desc.media === "sticker" ? (
            <div className="wa-sticker">{desc.link ? <img src={desc.link} alt="" onError={ocultar} /> : "🏷️"}</div>
          ) : (
            <div className="wa-file">
              <span className="wa-file__icon">{desc.icon}</span>
              <span className="wa-file__name">{desc.filename || desc.link || desc.media}</span>
            </div>
          )}
        </div>
      ) : null}

      {desc.kind === "location" ? (
        <div className="wa-map">
          <div className="wa-map__pin">📍</div>
          <div className="wa-map__info">
            <div className="wa-map__title">{desc.text}</div>
            <div className="wa-map__sub">{desc.sub}</div>
          </div>
        </div>
      ) : null}

      {desc.kind === "contact" ? (
        <div className="wa-contact">
          <span className="wa-contact__avatar">{(desc.text || "?").slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="wa-contact__name">{desc.text || "Contacto"}</div>
            {desc.sub ? <div className="wa-contact__sub">{desc.sub}</div> : null}
          </div>
        </div>
      ) : null}

      {desc.kind === "product" ? (
        <div className="wa-product">
          <div className="wa-product__thumb">{meta.icon}</div>
          <div className="wa-product__sub">{desc.sub || "Catálogo"}</div>
        </div>
      ) : null}

      {desc.kind === "reaction" ? <div className="wa-reaction">{desc.text || "👍"}</div> : null}

      {/* El encabezado va sin formato: Meta solo admite emojis ahí. */}
      {desc.header ? <div className="wa-header">{desc.header}</div> : null}
      {desc.kind !== "reaction" && desc.text ? (
        <WaText className="wa-body" text={desc.text} />
      ) : null}
      {desc.footer ? <WaText className="wa-footer" text={desc.footer} /> : null}
    </>
  );

  return (
    <div className={`wa-msg${muted ? " wa-msg--muted" : ""}`}>
      <div className={`wa-bubble${soloSticker ? " wa-bubble--bare" : ""}${acciones.length ? " wa-bubble--attached" : ""}`}>
        {cuerpo}
        <span className="wa-time">{time}</span>
      </div>

      {acciones.length ? (
        <div className="wa-actions">
          {acciones.map((a) => (
            <button
              key={a.id}
              className="wa-action"
              onClick={() => onAction?.(a.id, a.label)}
              disabled={!onAction}
            >
              {a.icon ? <span className="wa-action__icon">{a.icon}</span> : null}
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ocultar(e) {
  e.currentTarget.style.display = "none";
}
