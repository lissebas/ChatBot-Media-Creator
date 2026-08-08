/**
 * Barra superior: marca + acciones (probar, auto-organizar, ajustar,
 * exportar/importar JSON, reiniciar al flujo semilla). El estado de guardado se
 * muestra a la derecha.
 */
export default function Toolbar({ onSave, onLoad, onAutoLayout, onFit, onReset, onToggleSim, simOpen, saved }) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">C</span>
        <div>
          <div className="toolbar__name">ChatBot Creator</div>
          <div className="toolbar__sub">Constructor visual de flujos conversacionales</div>
        </div>
      </div>

      <div className="toolbar__actions">
        <span className="toolbar__saved">{saved}</span>
        <span className="toolbar__sep" />
        <button className="btn" onClick={onAutoLayout} title="Reorganizar los nodos automáticamente">
          Auto-organizar
        </button>
        <button className="btn" onClick={onFit} title="Encuadrar todo">Ajustar</button>
        <span className="toolbar__sep" />
        <button className="btn" onClick={onSave} title="Descargar el flujo como JSON">
          Exportar
        </button>
        <label className="btn" title="Cargar un flujo desde JSON">
          Importar
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={onLoad}
          />
        </label>
        <button className="btn btn--ghost" onClick={onReset} title="Volver al flujo de ejemplo">
          Reiniciar
        </button>
        <span className="toolbar__sep" />
        <button
          className={`btn ${simOpen ? "btn--stop" : "btn--play"}`}
          onClick={onToggleSim}
          title="Probar el flujo en el simulador de chat"
        >
          {simOpen ? "■ Detener" : "▶ Probar"}
        </button>
      </div>
    </header>
  );
}
