import { useState } from "react";
import { cambiarContrasena, entrar } from "../auth";

/**
 * Pantalla de acceso propia: mismo tema que el editor y, sobre todo, en el
 * mismo dominio — nada de saltar al Hosted UI de Cognito.
 *
 * Cubre los dos momentos: entrar, y el cambio de contraseña obligatorio del
 * primer acceso.
 */
export default function Login({ onEntrar }) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [reto, setReto] = useState(null); // { sesionReto, correo }
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (reto) {
        if (nueva !== repetir) throw new Error("Las contraseñas no coinciden.");
        onEntrar(await cambiarContrasena(reto.correo, nueva, reto.sesionReto));
        return;
      }
      const r = await entrar(correo.trim(), contrasena);
      if (r.reto) {
        setReto({ sesionReto: r.sesionReto, correo: r.correo });
        setContrasena("");
      } else {
        onEntrar(r.sesion);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login">
      <form className="login__panel" onSubmit={enviar}>
        <div className="login__marca">
          <span className="toolbar__logo">C</span>
          <div>
            <div className="login__nombre">ChatBot Creator</div>
            <div className="login__sub">Constructor visual de flujos conversacionales</div>
          </div>
        </div>

        {reto ? (
          <>
            <h1 className="login__titulo">Elige tu contraseña</h1>
            <p className="login__texto">
              Es tu primer acceso con <b>{reto.correo}</b>. Escribe una contraseña
              nueva: mínimo 12 caracteres, con mayúscula, minúscula y número.
            </p>
            <label className="field">
              <span className="field__label">Contraseña nueva</span>
              <input
                type="password"
                value={nueva}
                autoFocus
                autoComplete="new-password"
                onChange={(e) => setNueva(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Repítela</span>
              <input
                type="password"
                value={repetir}
                autoComplete="new-password"
                onChange={(e) => setRepetir(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <h1 className="login__titulo">Entra a tu cuenta</h1>
            <label className="field">
              <span className="field__label">Correo</span>
              <input
                type="email"
                value={correo}
                autoFocus
                autoComplete="username"
                placeholder="tu@correo.com"
                onChange={(e) => setCorreo(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Contraseña</span>
              <input
                type="password"
                value={contrasena}
                autoComplete="current-password"
                onChange={(e) => setContrasena(e.target.value)}
              />
            </label>
          </>
        )}

        {error ? <div className="login__error">{error}</div> : null}

        <button className="btn btn--primary login__enviar" type="submit" disabled={cargando}>
          {cargando ? "Entrando…" : reto ? "Guardar y entrar" : "Entrar"}
        </button>

        <p className="login__pie">
          Acceso protegido con Amazon Cognito · las cuentas las crea el administrador.
        </p>
      </form>
    </div>
  );
}
