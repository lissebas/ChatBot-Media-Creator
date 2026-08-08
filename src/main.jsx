import React from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { resolverSesion } from "./auth";

const raiz = ReactDOM.createRoot(document.getElementById("root"));

// Antes de dibujar nada: resolver la sesión. Sin Cognito configurado (desarrollo
// local) esto entra directo; en AWS, redirige al Hosted UI si hace falta.
raiz.render(<Cargando />);

resolverSesion()
  .then((sesion) => {
    raiz.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App sesion={sesion} />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((e) => {
    console.error("[auth]", e);
    raiz.render(<FalloLogin mensaje={String(e.message || e)} />);
  });

function Cargando() {
  return (
    <div className="crash">
      <div className="crash__panel">
        <div className="crash__icon">⏳</div>
        <h1 className="crash__title">Entrando…</h1>
        <p className="crash__text">Comprobando tu sesión.</p>
      </div>
    </div>
  );
}

function FalloLogin({ mensaje }) {
  return (
    <div className="crash">
      <div className="crash__panel">
        <div className="crash__icon">🔒</div>
        <h1 className="crash__title">No se pudo iniciar sesión</h1>
        <p className="crash__text">{mensaje}</p>
        <div className="crash__actions">
          <button className="btn btn--primary" onClick={() => window.location.replace("/")}>
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
