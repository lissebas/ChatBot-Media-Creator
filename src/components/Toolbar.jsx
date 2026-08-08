/**
 * Barra superior del editor: volver a la portada, nombre del flujo y acciones
 * (probar, auto-organizar, ajustar, exportar/importar JSON, reiniciar). El
 * estado de guardado se muestra a la derecha.
 */
export default function Toolbar({
  nombre,
  onRename,
  onHome,
  onSave,
  onLoad,
  onAutoLayout,
  onFit,
  onReset,
  onAnalizar,
  onToggleSim,
  simOpen,
  saved,
}) {
  return (
    <header className="toolbar">
      <button className="btn btn--ghost toolbar__home" onClick={onHome} title="Volver a la portada">
        ← Inicio
      </button>

      <input
        className="toolbar__title"
        value={nombre}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Nombre del flujo"
        title="Nombre del flujo"
      />

      <div className="toolbar__actions">
        <span className="toolbar__saved">{saved}</span>
        <span className="toolbar__sep" />
        <button className="btn" onClick={onAutoLayout} title="Reorganizar los nodos automáticamente">
          Auto-organizar
        </button>
        <button className="btn" onClick={onFit} title="Encuadrar todo">Ajustar</button>
        {onAnalizar ? (
          <button className="btn" onClick={onAnalizar} title="Revisar el flujo (se calcula en AWS)">
            Analizar
          </button>
        ) : null}
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
        <button className="btn btn--ghost" onClick={onReset} title="Vaciar el lienzo o volver al ejemplo">
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
