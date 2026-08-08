import { useCallback, useEffect, useRef, useState } from "react";
import WhatsAppMessage from "./WhatsAppMessage";
import {
  matchEdge,
  entryNode,
  nextEdge,
  nodeById,
  nodeOptions,
  stepMode,
} from "../sim/runtime";

/** Hora corta tipo WhatsApp (HH:MM). */
function ahora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Hoja inferior de una tarjeta de lista: es lo que abre WhatsApp al tocar el
 * botón «Ver opciones».
 */
function ListSheet({ card, onPick, onClose }) {
  const secciones = card.props?.sections || [];
  return (
    <div className="wa-sheet" role="dialog">
      <div className="wa-sheet__backdrop" onClick={onClose} />
      <div className="wa-sheet__panel">
        <div className="wa-sheet__head">
          <span>{card.props?.header_text || "Elige una opción"}</span>
          <button className="wa-sheet__close" onClick={onClose}>✕</button>
        </div>
        <div className="wa-sheet__body">
          {secciones.map((s, si) => (
            <div className="wa-sheet__section" key={si}>
              {s.title ? <div className="wa-sheet__sectitle">{s.title}</div> : null}
              {(s.rows || []).map((r, ri) => (
                <button
                  className="wa-sheet__row"
                  key={r.id || ri}
                  onClick={() => onPick(r.id || `row_${si + 1}_${ri + 1}`, r.title)}
                >
                  <div>
                    <div className="wa-sheet__rowtitle">{r.title || "—"}</div>
                    {r.description ? <div className="wa-sheet__rowsub">{r.description}</div> : null}
                  </div>
                  <span className="wa-sheet__radio" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Emulador de WhatsApp: ejecuta el flujo diseñado con el mismo aspecto y las
 * mismas interacciones que el chat real — los botones van pegados a la burbuja,
 * las listas abren su hoja inferior y los mensajes que no esperan respuesta
 * encadenan solos. El nodo activo se resalta en el lienzo.
 */
export default function Simulator({ nodes, edges, onActive, onClose }) {
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sheet, setSheet] = useState(false);
  const started = useRef(false);
  const pasos = useRef(0);
  const scrollRef = useRef(null);

  const emitir = useCallback(
    (nodeId, extra = []) => {
      const node = nodeById(nodes, nodeId);
      const propio = node && node.data?.card !== "start" && node.data?.card !== "end"
        ? [{ role: "bot", card: node.data.card, props: node.data.props || {}, time: ahora() }]
        : [];
      setMessages((m) => [...m, ...extra, ...propio]);
      setCurrentId(nodeId);
      setSheet(false);
      onActive(nodeId);
    },
    [nodes, onActive],
  );

  const restart = useCallback(() => {
    pasos.current = 0;
    setSheet(false);
    setMessages([]);
    const entry = entryNode(nodes, edges);
    const node = nodeById(nodes, entry);
    setMessages(
      node && node.data?.card !== "start" && node.data?.card !== "end"
        ? [{ role: "bot", card: node.data.card, props: node.data.props || {}, time: ahora() }]
        : [],
    );
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
    }, 650);
    return () => clearTimeout(t);
  }, [mode, currentId, edges, emitir]);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, mode]);

  const avanzar = (edge, userText) => {
    if (!edge) return;
    pasos.current = 0;
    emitir(edge.target, userText != null ? [{ role: "user", text: userText, time: ahora() }] : []);
  };

  /** Toque en un botón nativo de la burbuja. */
  const onAction = (id, label) => {
    if (id === "__list__") {
      setSheet(true);
      return;
    }
    if (id === "next") {
      avanzar(nextEdge(edges, currentId), label);
      return;
    }
    const opt = options.find((o) => o.id === id);
    if (opt?.edge) avanzar(opt.edge, opt.label);
    else avisar(`«${label}» no lleva a ningún paso todavía.`);
  };

  const avisar = (texto) =>
    setMessages((m) => [...m, { role: "sys", text: texto }]);

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
        { role: "user", text: t, time: ahora() },
        {
          role: "bot",
          card: "text",
          props: { body: "No entendí 🤔 Toca una de las opciones." },
          time: ahora(),
        },
      ]);
      return;
    }
    avanzar(res, t);
  };

  const ultimoBot = messages.map((m) => m.role).lastIndexOf("bot");
  const interactivo = mode === "options" || mode === "action";

  return (
    <aside className="sim">
      <div className="wa-topbar">
        <span className="wa-topbar__avatar">🤖</span>
        <div className="wa-topbar__info">
          <div className="wa-topbar__name">Mi negocio</div>
          <div className="wa-topbar__sub">
            {current ? `Paso: ${current.data?.title || current.id}` : "en línea"}
          </div>
        </div>
        <button className="wa-topbar__btn" onClick={restart} title="Reiniciar conversación">↻</button>
        <button className="wa-topbar__btn" onClick={onClose} title="Cerrar simulador">✕</button>
      </div>

      <div className="wa-chat" ref={scrollRef}>
        <div className="wa-daysep">HOY</div>

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div className="wa-msg wa-msg--out" key={i}>
              <div className="wa-bubble wa-bubble--out">
                <div className="wa-body">{m.text}</div>
                <span className="wa-time">{m.time} ✓✓</span>
              </div>
            </div>
          ) : m.role === "sys" ? (
            <div className="wa-sys" key={i}>{m.text}</div>
          ) : (
            <WhatsAppMessage
              key={i}
              card={m.card}
              props={m.props}
              time={m.time}
              muted={i !== ultimoBot || !interactivo}
              onAction={i === ultimoBot && interactivo ? onAction : undefined}
            />
          ),
        )}

        {mode === "auto" && (
          <div className="wa-typing"><span /><span /><span /></div>
        )}
        {mode === "end" && <div className="wa-sys">— fin del flujo —</div>}
      </div>

      {sheet && current ? (
        <ListSheet
          card={current.data}
          onClose={() => setSheet(false)}
          onPick={(id, label) => {
            const opt = options.find((o) => o.id === id);
            if (opt?.edge) avanzar(opt.edge, label);
            else {
              setSheet(false);
              avisar(`«${label}» no lleva a ningún paso todavía.`);
            }
          }}
        />
      ) : null}

      <div className="wa-composer">
        {mode === "end" ? (
          <button className="wa-restart" onClick={restart}>Reiniciar conversación</button>
        ) : (
          <>
            <input
              className="wa-input"
              value={input}
              placeholder="Escribe un mensaje"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="wa-send" onClick={send} title="Enviar">➤</button>
          </>
        )}
      </div>
    </aside>
  );
}
