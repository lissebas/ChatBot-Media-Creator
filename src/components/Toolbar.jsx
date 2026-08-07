/**
 * Barra superior: título + acciones (guardar/cargar JSON, auto-organizar,
 * ajustar, reiniciar al flujo semilla). El estado de guardado se muestra a la
 * derecha.
 */
export default function Toolbar({ onSave, onLoad, onAutoLayout, onFit, onReset, onToggleSim, simOpen, saved }) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">W</span>
        <div>
          <div className="toolbar__name">Willy Studio</div>
          <div className="toolbar__sub">Constructor de flujos · WGT Seguros</div>
        </div>
      </div>

      <div className="toolbar__actions">
        <button
          className={`btn ${simOpen ? "btn--primary" : "btn--play"}`}
          onClick={onToggleSim}
          title="Probar el flujo en el simulador de chat"
        >
          {simOpen ? "■ Detener" : "▶ Probar"}
        </button>
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
        <span className="toolbar__sep" />
        <button className="btn btn--ghost" onClick={onReset} title="Volver al flujo original de Willy">
          Reiniciar
        </button>
        <span className="toolbar__saved">{saved}</span>
      </div>
    </header>
  );
}
