import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Menú contextual del lienzo (clic derecho). Recibe la posición en pantalla y
 * una lista de items; se cierra al elegir uno, al hacer clic fuera o con Esc.
 *
 * item = { label, onSelect, dot?, hint?, danger?, disabled? } | { sep: true }
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Reubica el menú si se saldría de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.min(x, window.innerWidth - width - 12),
      top: Math.min(y, window.innerHeight - height - 12),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div className="ctxmenu" ref={ref} style={{ left: pos.left, top: pos.top }}>
      {items.map((it, i) =>
        it.sep ? (
          <div key={`s${i}`} className="ctxmenu__sep" />
        ) : it.header ? (
          <div
            key={`h${i}`}
            className={`ctxmenu__header${it.strong ? " ctxmenu__header--fam" : ""}`}
            style={it.color ? { "--accent": it.color } : undefined}
          >
            {it.header}
          </div>
        ) : (
          <button
            key={it.label}
            className={`ctxmenu__item${it.danger ? " ctxmenu__item--danger" : ""}`}
            disabled={it.disabled}
            onClick={() => {
              it.onSelect();
              onClose();
            }}
          >
            {it.dot ? <span className="ctxmenu__dot" style={{ background: it.dot }} /> : null}
            <span className="ctxmenu__label">{it.label}</span>
            {it.hint ? <span className="ctxmenu__hint">{it.hint}</span> : null}
          </button>
        ),
      )}
    </div>
  );
}
