import { useEffect } from "react";

/**
 * Diálogo propio de la app (reemplaza a `confirm`/`prompt` del navegador, que
 * rompen el tema oscuro). Se cierra con Esc o tocando el fondo.
 *
 * acciones = [{ label, onClick, variant?: "primary" | "danger" | "ghost", autoFocus? }]
 */
export default function Modal({ title, children, acciones = [], onClose, icon }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        <div className="modal__head">
          {icon ? <span className="modal__icon">{icon}</span> : null}
          <h2 className="modal__title">{title}</h2>
        </div>
        {children ? <div className="modal__body">{children}</div> : null}
        <div className="modal__foot">
          {acciones.map((a) => (
            <button
              key={a.label}
              className={`btn${a.variant ? ` btn--${a.variant}` : ""} modal__btn`}
              onClick={a.onClick}
              autoFocus={a.autoFocus}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
