import { Component } from "react";

/**
 * Red de seguridad: si algo revienta en tiempo de ejecución, React desmonta el
 * árbol y la app se queda en NEGRO, sin pistas. Aquí se muestra el error, con
 * salida a la portada y opción de vaciar lo guardado si el dato está corrupto.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ChatBot Creator] error no controlado:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__panel">
          <div className="crash__icon">💥</div>
          <h1 className="crash__title">Algo se rompió al dibujar la pantalla</h1>
          <p className="crash__text">
            Tus flujos siguen guardados. Vuelve a la portada y ábrelo de nuevo; si
            se repite, copia este mensaje:
          </p>
          <pre className="crash__error">{String(error?.stack || error?.message || error)}</pre>
          <div className="crash__actions">
            <button className="btn btn--primary" onClick={() => window.location.reload()}>
              Recargar
            </button>
            <button
              className="btn"
              onClick={() => {
                try {
                  localStorage.removeItem("cbc-minimapa");
                  localStorage.removeItem("cbc-aristas-simples");
                } finally {
                  window.location.reload();
                }
              }}
            >
              Recargar sin preferencias de vista
            </button>
          </div>
        </div>
      </div>
    );
  }
}
