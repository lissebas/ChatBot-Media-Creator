import { useCallback, useEffect, useRef, useState } from "react";
import {
  matchEdge,
  entryNode,
  nextEdge,
  nodeById,
  nodeMessage,
  nodeOptions,
  stepMode,
} from "../sim/runtime";

/** Burbuja del bot: se dibuja según el tipo de tarjeta de Meta. */
function BotBubble({ msg }) {
  if (!msg) return null;
  const { kind } = msg;

  return (
    <div className="bubble bubble--bot">
      {msg.header ? <div className="bubble__header">{msg.header}</div> : null}

      {kind === "media" ? (
        <div className={`bubble__media bubble__media--${msg.media}`}>
          {msg.media === "image" && msg.link ? (
            <img src={msg.link} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="bubble__file">
              <span className="bubble__fileicon">{msg.icon}</span>
              <span className="bubble__filename">{msg.filename || msg.link || msg.media}</span>
            </div>
          )}
        </div>
      ) : null}

      {kind === "location" || kind === "contact" || kind === "product" ? (
        <div className="bubble__card">
          <div className="bubble__cardtitle">{msg.text || "—"}</div>
          {msg.sub ? <div className="bubble__cardsub">{msg.sub}</div> : null}
        </div>
      ) : (
        msg.text && <div className="bubble__text">{msg.text}</div>
      )}

      {msg.footer ? <div className="bubble__footer">{msg.footer}</div> : null}

      {kind === "cta" || kind === "location_request" ? (
        <div className="bubble__cta">{msg.cta || "Abrir"}</div>
      ) : null}
    </div>
  );
}

/**
 * Simulador de chat: ejecuta el flujo diseñado. Los mensajes que no esperan
 * respuesta avanzan solos (como en WhatsApp); los botones, listas y acciones
 * nativas esperan al usuario. El nodo activo se resalta en el lienzo.
 */
export default function Simulator({ nodes, edges, onActive, onClose }) {
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const started = useRef(false);
  const pasos = useRef(0);
  const scrollRef = useRef(null);

  const emitir = useCallback((nodeId, extra = []) => {
    const node = nodeById(nodes, nodeId);
    const msg = nodeMessage(node);
    setMessages((m) => [...m, ...extra, ...(msg ? [{ role: "bot", msg }] : [])]);
    setCurrentId(nodeId);
    onActive(nodeId);
  }, [nodes, onActive]);

  const restart = useCallback(() => {
    pasos.current = 0;
    setMessages([]);
    const entry = entryNode(nodes, edges);
    const node = nodeById(nodes, entry);
    const msg = nodeMessage(node);
    setMessages(msg ? [{ role: "bot", msg }] : []);
    setCurrentId(entry);
    onActive(entry);
  }, [nodes, edges, onActive]);

  // Arranca una vez al abrir el simulador (ref evita doble arranque en StrictMode).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    restart();
  }, [restart]);

  const current = nodeById(nodes, currentId);
  const mode = stepMode(current, edges);
  const options = nodeOptions(current, edges);

  // Los mensajes que no esperan respuesta encadenan solos, con una pausa corta.
  useEffect(() => {
    if (mode !== "auto" || !currentId) return;
    if (pasos.current > 40) return; // freno ante ciclos infinitos
    const edge = nextEdge(edges, currentId);
    if (!edge) return;
    const t = setTimeout(() => {
      pasos.current += 1;
      emitir(edge.target);
    }, 550);
    return () => clearTimeout(t);
  }, [mode, currentId, edges, emitir]);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const avanzar = (edge, userText) => {
    if (!edge) return;
    pasos.current = 0;
    emitir(edge.target, userText != null ? [{ role: "user", text: userText }] : []);
  };

  const send = () => {
    const t = input.trim();
    if (!t || mode === "end") return;
    setInput("");

    if (mode === "text" || mode === "action") {
      avanzar(nextEdge(edges, currentId), t);
      return;
    }

    const res = matchEdge(edges, nodes, currentId, t);
    if (res === null) return;
    if (res === undefined) {
      setMessages((m) => [
        ...m,
        { role: "user", text: t },
        { role: "bot", msg: { kind: "text", text: "No entendí 🤔 Toca una de las opciones o escríbela." } },
      ]);
      return;
    }
    avanzar(res, t);
  };

  return (
    <aside className="sim">
      <div className="sim__head">
        <div>
          <div className="sim__title">Simulador</div>
          <div className="sim__sub">
            {current ? `Paso: ${current.data?.title || current.id}` : "—"}
          </div>
        </div>
        <div className="sim__headbtns">
          <button className="sim__iconbtn" onClick={restart} title="Reiniciar conversación">↻</button>
          <button className="sim__iconbtn" onClick={onClose} title="Cerrar simulador">✕</button>
        </div>
      </div>

      <div className="sim__chat" ref={scrollRef}>
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="bubble bubble--user">{m.text}</div>
          ) : (
            <BotBubble key={i} msg={m.msg} />
          ),
        )}
        {mode === "end" && <div className="sim__ended">— fin del flujo —</div>}
        {mode === "auto" && <div className="sim__typing"><span /><span /><span /></div>}
      </div>

      <div className="sim__foot">
        {mode === "options" && (
          <div className="sim__quick">
            {options.map((o) => (
              <button
                key={o.id}
                className={`chip${o.edge ? "" : " chip--dead"}`}
                onClick={() => avanzar(o.edge, o.label)}
                title={o.edge ? "" : "Esta salida no está conectada a ningún paso"}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {mode === "action" && (
          <button className="btn btn--primary sim__restart" onClick={() => avanzar(nextEdge(edges, currentId))}>
            {nodeMessage(current)?.cta || "Continuar"}
          </button>
        )}

        {mode === "end" ? (
          <button className="btn btn--primary sim__restart" onClick={restart}>
            Reiniciar conversación
          </button>
        ) : (
          <div className="sim__inputrow">
            <input
              className="sim__input"
              value={input}
              placeholder={
                mode === "options" ? "Escribe o toca una opción…" : "Escribe tu respuesta…"
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="btn btn--primary" onClick={send}>Enviar</button>
          </div>
        )}
      </div>
    </aside>
  );
}
