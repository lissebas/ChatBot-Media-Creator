import { emptyItem, visibleFields } from "../flow/cardTypes";

/** Id corto y único para las salidas (botones / filas) creadas desde el editor. */
function autoId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Formulario que se dibuja solo a partir de la definición de campos de una
 * tarjeta (ver `flow/cardTypes.js`). Soporta listas anidadas (p. ej. secciones
 * con filas) llamándose a sí mismo.
 *
 * values  → objeto con los valores de este nivel.
 * onChange→ recibe el objeto completo del nivel, ya actualizado.
 * errors  → { "ruta.campo": "mensaje" }; `path` es el prefijo de este nivel.
 */
export default function FieldForm({ fields, values, onChange, errors = {}, path = "" }) {
  const set = (key, value) => onChange({ ...values, [key]: value });

  return (
    <>
      {visibleFields({ fields }, values).map((f) => {
        const id = `${path}${f.key}`;
        const error = errors[id];
        const value = values[f.key];

        if (f.type === "list") {
          const items = Array.isArray(value) ? value : [];
          const addItem = () => {
            const item = emptyItem(f);
            f.item.forEach((sub) => {
              if (sub.auto) item[sub.key] = autoId(sub.auto);
            });
            set(f.key, [...items, item]);
          };
          return (
            <div className="field field--list" key={f.key}>
              <span className="field__label">
                {f.label}
                <span className="field__count">
                  {items.length}
                  {f.max ? `/${f.max}` : ""}
                </span>
              </span>
              {f.help ? <p className="field__help">{f.help}</p> : null}

              {items.map((item, i) => (
                <div className="listitem" key={i}>
                  <div className="listitem__head">
                    <span className="listitem__title">
                      {f.itemLabel} {i + 1}
                    </span>
                    <div className="listitem__tools">
                      <button
                        className="iconbtn"
                        title="Subir"
                        disabled={i === 0}
                        onClick={() => {
                          const next = [...items];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          set(f.key, next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="iconbtn"
                        title="Bajar"
                        disabled={i === items.length - 1}
                        onClick={() => {
                          const next = [...items];
                          [next[i + 1], next[i]] = [next[i], next[i + 1]];
                          set(f.key, next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="iconbtn iconbtn--danger"
                        title="Quitar"
                        onClick={() => set(f.key, items.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <FieldForm
                    fields={f.item}
                    values={item}
                    errors={errors}
                    path={`${id}[${i}].`}
                    onChange={(next) => set(f.key, items.map((it, j) => (j === i ? next : it)))}
                  />
                </div>
              ))}

              <button
                className="btn btn--add"
                onClick={addItem}
                disabled={!!f.max && items.length >= f.max}
              >
                + Añadir {f.itemLabel?.toLowerCase() || "item"}
              </button>
            </div>
          );
        }

        if (f.type === "boolean") {
          return (
            <label className="field field--check" key={f.key}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => set(f.key, e.target.checked)}
              />
              <span>{f.label}</span>
            </label>
          );
        }

        if (f.type === "select") {
          return (
            <label className="field" key={f.key}>
              <span className="field__label">{f.label}</span>
              <select value={value ?? f.default ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {f.help ? <p className="field__help">{f.help}</p> : null}
            </label>
          );
        }

        const len = typeof value === "string" ? value.length : 0;
        const over = f.max && len > f.max;

        return (
          <label className="field" key={f.key}>
            <span className="field__label">
              {f.label}
              {f.required ? <span className="field__req">*</span> : null}
              {f.max ? (
                <span className={`field__count${over ? " is-over" : ""}`}>
                  {len}/{f.max}
                </span>
              ) : null}
            </span>
            {f.type === "textarea" ? (
              <textarea
                className={error ? "is-error" : ""}
                rows={f.rows || 4}
                value={value ?? ""}
                placeholder={f.placeholder || ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : (
              <input
                className={error ? "is-error" : ""}
                type={f.type === "number" ? "number" : "text"}
                value={value ?? ""}
                placeholder={f.placeholder || ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {error ? <p className="field__error">{error}</p> : null}
            {f.help ? <p className="field__help">{f.help}</p> : null}
          </label>
        );
      })}
    </>
  );
}
