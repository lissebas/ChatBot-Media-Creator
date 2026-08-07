import { useCallback, useEffect, useRef, useState } from "react";
import {
  edgeLabel,
  entryNode,
  matchEdge,
  nodeMessage,
  outgoing,
} from "../sim/runtime";

/**
 * Simulador de chat: ejecuta el flujo diseñado. El usuario escribe o toca
 * opciones y el bot avanza por el grafo; el nodo activo se resalta en el lienzo
 * (vía onActive → SimContext).
 */
export default function Simulator({ nodes, edges, onActive, onClose }) {
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const started = useRef(false);
  const scrollRef = useRef(null);

  const restart = useCallback(() => {
    const entry = entryNode(nodes, edges);
    const node = nodes.find((n) => n.id === entry);
    setCurrentId(entry);
    setMessages(node ? [{ role: "bot", text: nodeMessage(node) }] : []);
    onActive(entry);
  }, [nodes, edges, onActive]);

  // Arranca una vez al abrir el simulador (ref evita doble arranque en StrictMode).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    restart();
  }, [restart]);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const goTo = useCallback(
    (targetId, userText) => {
      const node = nodes.find((n) => n.id === targetId);
      setMessages((m) => {
        const base = userText != null ? [...m, { role: "user", text: userText }] : m;
        return node ? [...base, { role: "bot", text: nodeMessage(node) }] : base;
      });
      setCurrentId(targetId);
      onActive(targetId);
    },
    [nodes, onActive],
  );

  const outs = outgoing(edges, currentId);
  const ended = currentId != null && outs.length === 0;
  // Botones cuando hay ramificación (2+) o una sola salida con etiqueta explícita.
  const showButtons = outs.length > 1 || (outs.length === 1 && !!outs[0].label);
  const freeText = outs.length === 1 && !outs[0].label; // nodo que espera respuesta escrita

  const send = () => {
    const t = input.trim();
    if (!t || ended) return;
    setInput("");
    const res = matchEdge(edges, nodes, currentId, t);
    if (res === null) return; // terminal
    if (res === undefined) {
      setMessages((m) => [
        ...m,
        { role: "user", text: t },
        { role: "bot", text: "No entendí 🤔 Toca una de las opciones o escríbela." },
      ]);
      return;
    }
    goTo(res.target, t);
  };

  const currentNode = nodes.find((n) => n.id === currentId);

  return (
    <aside className="sim">
      <div className="sim__head">
        <div>
          <div className="sim__title">Simulador</div>
          <div className="sim__sub">
            {currentNode ? `Paso: ${currentNode.data?.title || currentNode.id}` : "—"}
          </div>
        </div>
        <div className="sim__headbtns">
          <button className="sim__iconbtn" onClick={restart} title="Reiniciar conversación">↻</button>
          <button className="sim__iconbtn" onClick={onClose} title="Cerrar simulador">✕</button>
        </div>
      </div>

      <div className="sim__chat" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.role}`}>
            {m.text}
          </div>
        ))}
        {ended && <div className="sim__ended">— fin del flujo —</div>}
      </div>

      <div className="sim__foot">
        {showButtons && !ended && (
          <div className="sim__quick">
            {outs.map((e) => (
              <button key={e.id} className="chip" onClick={() => goTo(e.target, edgeLabel(e, nodes))}>
                {edgeLabel(e, nodes)}
              </button>
            ))}
          </div>
        )}
        {ended ? (
          <button className="btn btn--primary sim__restart" onClick={restart}>
            Reiniciar conversación
          </button>
        ) : (
          <div className="sim__inputrow">
            <input
              className="sim__input"
              value={input}
              placeholder={freeText ? "Escribe tu respuesta…" : "Escribe o toca una opción…"}
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
