import { useCallback, useEffect, useRef, useState } from "react";
import WhatsAppMessage from "./WhatsAppMessage";
import WaText from "./WaText";
import { getCard } from "../flow/cardTypes";
import { buscarPaso, interceptar, notaDe, resolver } from "../sim/motores";
import {
  conVariables,
  matchEdge,
  entryNode,
  nextEdge,
  nodeById,
  nodeOptions,
  outgoing,
  stepMode,
} from "../sim/runtime";

/** Hora corta tipo WhatsApp (HH:MM). */
function ahora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Aplica cambios de variables; `undefined` borra. */
function aplicar(base, cambios) {
  if (!cambios) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(cambios)) {
    if (v === undefined || v === null || v === "") delete out[k];
    else out[k] = v;
  }
  return out;
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
 *
 * Los pasos de automatización no se dibujan como mensajes (el cliente no los
 * vería): salen como una nota técnica con lo que decidieron. Las validaciones,
 * las condiciones y las intenciones se ejecutan de verdad, así que el simulador
 * sirve para probar las reglas, no solo el guion.
 */
export default function Simulator({ nodes, edges, onActive, onClose }) {
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sheet, setSheet] = useState(false);
  const [vars, setVars] = useState({});
  const [verVars, setVerVars] = useState(false);
  const started = useRef(false);
  const pasos = useRef(0);
  const scrollRef = useRef(null);
  // Las variables también en un ref: al encadenar pasos hay que leer el valor
  // recién escrito, y el estado de React todavía no lo tiene.
  const varsRef = useRef({});
  const intentos = useRef(0);
  const decision = useRef(null);

  /** Entra en un nodo: emite su mensaje (o su nota) y guarda lo que decidió. */
  const emitir = useCallback(
    (nodeId, { extra = [], vars: cambios, nota } = {}) => {
      const node = nodeById(nodes, nodeId);
      const card = getCard(node?.data?.card);
      const props = node?.data?.props || {};

      let actuales = aplicar(varsRef.current, cambios);
      let linea = nota;

      // Las tarjetas que deciden solas se resuelven al entrar: así la nota que
      // se enseña es la decisión de verdad y no una promesa.
      decision.current = null;
      if (node && card.decide) {
        const r = resolver(node.data.card, props, { vars: actuales });
        if (r) {
          actuales = aplicar(actuales, r.vars);
          linea = r.nota;
          decision.current = r;
        }
      }

      varsRef.current = actuales;
      setVars(actuales);
      intentos.current = 0;

      const propio =
        node && card.chat !== false
          ? [
              {
                role: "bot",
                card: node.data.card,
                props: conVariables(props, actuales),
                time: ahora(),
                nota: card.tecnica ? linea || notaDe(node.data.card, props, actuales) : undefined,
              },
            ]
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
    intentos.current = 0;
    decision.current = null;
    varsRef.current = {};
    setVars({});
    setSheet(false);
    setMessages([]);
    setCurrentId(null);
    const entry = entryNode(nodes, edges);
    if (entry) emitir(entry);
    else onActive(null);
  }, [nodes, edges, emitir, onActive]);

  // Arranca una vez al abrir el simulador (ref evita doble arranque en StrictMode).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    restart();
  }, [restart]);

  const current = nodeById(nodes, currentId);
  const mode = stepMode(current, edges);
  const options = nodeOptions(current, edges);

  const avisar = useCallback(
    (texto) => setMessages((m) => [...m, { role: "sys", text: texto }]),
    [],
  );

  /** Sigue por una salida concreta del nodo actual. */
  const porSalida = useCallback(
    (nodeId, salida, opciones) => {
      const edge = outgoing(edges, nodeId).find((e) => (e.sourceHandle || "next") === salida);
      if (!edge) {
        avisar(`La salida «${salida}» no lleva a ningún paso todavía.`);
        return false;
      }
      emitir(edge.target, opciones);
      return true;
    },
    [edges, emitir, avisar],
  );

  // Los mensajes que no esperan respuesta encadenan solos, con una pausa corta.
  useEffect(() => {
    if (!currentId) return undefined;
    if (pasos.current > 40) return undefined; // freno ante ciclos infinitos

    if (mode === "auto") {
      const edge = nextEdge(edges, currentId);
      if (!edge) return undefined;
      const t = setTimeout(() => {
        pasos.current += 1;
        emitir(edge.target);
      }, 650);
      return () => clearTimeout(t);
    }

    if (mode === "decide") {
      const t = setTimeout(() => {
        pasos.current += 1;
        const d = decision.current;
        if (!d) return;
        if (d.saltarA) {
          const destino = buscarPaso(nodes, d.saltarA);
          if (destino) emitir(destino);
          else avisar(`No encuentro el paso «${d.saltarA}».`);
          return;
        }
        porSalida(currentId, d.salida);
      }, 550);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [mode, currentId, edges, nodes, emitir, porSalida, avisar]);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, mode]);

  const avanzar = (edge, userText) => {
    if (!edge) return;
    pasos.current = 0;
    emitir(edge.target, {
      extra: userText != null ? [{ role: "user", text: userText, time: ahora() }] : [],
      vars: userText != null ? { respuesta: userText } : undefined,
    });
  };

  /** Toque en un botón nativo de la burbuja (o en una rama de un paso técnico). */
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
    if (opt?.edge) avanzar(opt.edge, getCard(current?.data?.card).tecnica ? null : label);
    else avisar(`«${label}» no lleva a ningún paso todavía.`);
  };

  const send = () => {
    const t = input.trim();
    if (!t || mode === "end") return;
    setInput("");
    const escrito = { role: "user", text: t, time: ahora() };

    // Los comandos globales mandan sobre el paso actual: «menú» funciona en
    // mitad de un formulario, que es justo para lo que existen.
    const cmd = interceptar(nodes, t);
    if (cmd && cmd.nodo !== currentId) {
      pasos.current = 0;
      const edge = outgoing(edges, cmd.nodo).find((e) => (e.sourceHandle || "next") === cmd.salida);
      if (edge) {
        emitir(edge.target, { extra: [escrito], vars: { respuesta: t }, nota: `Comando: ${cmd.etiqueta}` });
      } else {
        setMessages((m) => [...m, escrito]);
        avisar(`El comando «${cmd.etiqueta}» no lleva a ningún paso todavía.`);
      }
      return;
    }

    // Pregunta y valida / intención: aquí decide el motor, no un botón.
    if (mode === "captura") {
      const r = resolver(current.data.card, current.data.props || {}, {
        vars: varsRef.current,
        texto: t,
        intentos: intentos.current,
      });
      setMessages((m) => [...m, escrito]);
      if (!r) return;

      if (r.reintentar) {
        intentos.current += 1;
        setMessages((m) => [
          ...m,
          { role: "bot", card: "text", props: { body: r.mensaje }, time: ahora() },
        ]);
        return;
      }
      pasos.current = 0;
      const edge = outgoing(edges, currentId).find((e) => (e.sourceHandle || "next") === r.salida);
      if (edge) emitir(edge.target, { vars: { ...r.vars, respuesta: t }, nota: r.nota });
      else avisar(`La salida «${r.salida}» no lleva a ningún paso todavía.`);
      return;
    }

    if (mode === "text" || mode === "action") {
      avanzar(nextEdge(edges, currentId), t);
      return;
    }

    const res = matchEdge(edges, nodes, currentId, t);
    if (res === null) return;
    if (res === undefined) {
      setMessages((m) => [
        ...m,
        escrito,
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
  const nombresVar = Object.keys(vars);

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
                <WaText className="wa-body" text={m.text} />
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
              nota={m.nota}
              muted={i !== ultimoBot || !interactivo}
              onAction={i === ultimoBot && interactivo ? onAction : undefined}
            />
          ),
        )}

        {(mode === "auto" || mode === "decide") && (
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

      {nombresVar.length ? (
        <div className={`wa-vars${verVars ? " is-open" : ""}`}>
          <button className="wa-vars__toggle" onClick={() => setVerVars((v) => !v)}>
            <span className="wa-vars__chev">▸</span>
            Variables
            <span className="wa-vars__count">{nombresVar.length}</span>
          </button>
          {verVars ? (
            <ul className="wa-vars__list">
              {nombresVar.map((k) => (
                <li key={k}>
                  <code>{k}</code>
                  <span>{String(vars[k])}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="wa-composer">
        {mode === "end" ? (
          <button className="wa-restart" onClick={restart}>Reiniciar conversación</button>
        ) : (
          <>
            <input
              className="wa-input"
              value={input}
              placeholder={mode === "captura" ? "Escribe tu respuesta" : "Escribe un mensaje"}
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
