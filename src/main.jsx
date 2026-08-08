import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./index.css";
import "./App.css";
import App from "./App";
import Login from "./components/Login";
import ErrorBoundary from "./components/ErrorBoundary";
import { resolverSesion } from "./auth";

const raiz = ReactDOM.createRoot(document.getElementById("root"));

/** Decide qué se ve: el formulario de acceso o el editor. */
function Raiz({ inicial }) {
  const [sesion, setSesion] = useState(inicial);
  if (!sesion) return <Login onEntrar={setSesion} />;
  return <App sesion={sesion} />;
}

// La sesión se resuelve antes de dibujar: si hay una guardada (o se puede
// renovar con el refresh token), se entra directo; si no, sale el formulario.
resolverSesion()
  .then((sesion) => {
    raiz.render(
      <React.StrictMode>
        <ErrorBoundary>
          <Raiz inicial={sesion} />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((e) => {
    console.error("[auth]", e);
    raiz.render(
      <React.StrictMode>
        <ErrorBoundary>
          <Raiz inicial={null} />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  });
