import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
} from "@xyflow/react";

import FlowNode from "./components/FlowNode";
import Sidebar from "./components/Sidebar";
import Inspector from "./components/Inspector";
import Toolbar from "./components/Toolbar";
import Simulator from "./components/Simulator";
import ContextMenu from "./components/ContextMenu";
import ZoomControls from "./components/ZoomControls";
import Modal from "./components/Modal";
import Home from "./components/Home";
import { MINIMO_REMOTO, analizarRemoto, layoutRemoto, motorActivo, precalentar } from "./flow/remoto";
import { SimContext } from "./sim/SimContext";
import { entryNode } from "./sim/runtime";
import { CARDS, CARDS_POR_FAMILIA, cardColor, defaultProps, getCard } from "./flow/cardTypes";
import {
  autoLayout,
  buildInitialFlow,
  makeEdge,
  migrateFlow,
  nodeSize,
  simplificarAristas,
  NODE_H,
  NODE_W,
} from "./flow/transform";
import {
  alCerrar,
  alSincronizar,
  borrarEnLaNube,
  documento,
  nubeActiva,
  sincronizar,
  sincronizarIndice,
  sincronizarSoloIndice,
} from "./flow/nube";
import {
  borrarDocumento,
  cargarDocumento,
  cargarIndice,
  conNombre,
  conResumen,
  guardarDocumento,
  guardarIndice,
  nuevoMeta,
  sinFlujo,
} from "./flow/workspace";
import "./App.css";

const nodeTypes = { card: FlowNode };

/**
 * Compara dos listas ignorando lo que no se guarda (selección, estados de
 * arrastre). Es O(n) con comparaciones por referencia: nada de serializar.
 */
function mismoContenido(antes, ahora, iguales) {
  if (!antes || antes.length !== ahora.length) return false;
  for (let i = 0; i < ahora.length; i++) {
    if (antes[i] !== ahora[i] && !iguales(antes[i], ahora[i])) return false;
  }
  return true;
}

const nodoIgual = (a, b) =>
  a.id === b.id &&
  a.data === b.data &&
  a.position?.x === b.position?.x &&
  a.position?.y === b.position?.y;

const aristaIgual = (a, b) =>
  a.id === b.id &&
  a.source === b.source &&
  a.target === b.target &&
  a.sourceHandle === b.sourceHandle &&
  a.label === b.label;

/** Lo que se lee en la barra según cómo va la copia en S3. */
const ESTADO_NUBE = {
  subiendo: "Guardando en la nube…",
  guardado: "Guardado en la nube ✓",
  error: "Solo en este equipo (sin conexión con la nube)",
};

/* ══════════════════════════ Editor ══════════════════════════ */

function Studio({ nombre, doc, nube, onChange, onRename, onHome }) {
  // `doc` solo se lee al montar: el lienzo es el dueño del estado a partir de ahí.
  const initial = useMemo(() => doc, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selNodeId, setSelNodeId] = useState(null);
  const [selEdgeId, setSelEdgeId] = useState(null);
  const [saved, setSaved] = useState("Autoguardado activo");
  const [simOpen, setSimOpen] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menu, setMenu] = useState(null); // { kind, x, y, id?, flowPos? }
  const [informe, setInforme] = useState(null); // revisión del flujo en la nube
  const [reset, setReset] = useState(false);
  // Con muchos pasos, encuadrar todo al abrir monta el flujo entero de una vez.
  const grande = (initial.nodes?.length || 0) > 120;
  const wrapperRef = useRef(null);
  const { screenToFlowPosition, fitView, setCenter, getZoom } = useReactFlow();

  // Al cambiar el nodo activo del simulador, centrar la vista en él.
  useEffect(() => {
    if (!activeNodeId) return;
    const node = nodes.find((n) => n.id === activeNodeId);
    if (!node) return;
    const zoom = Math.max(getZoom(), 0.9);
    setCenter(node.position.x + NODE_W / 2, node.position.y + NODE_H / 2, {
      zoom,
      duration: 500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId]);

  // Autoguardado. Se salta el primer render (acabamos de cargar: no hay nada que
  // guardar), ignora los cambios que solo mueven la SELECCIÓN —seleccionar un
  // nodo no debe reescribir 126 KB— y escribe en un hueco libre del hilo para no
  // cortar una animación.
  const montado = useRef(false);
  const guardado = useRef({ nodes: null, edges: null });
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      guardado.current = { nodes, edges };
      return;
    }
    if (mismoContenido(guardado.current.nodes, nodes, nodoIgual) &&
        mismoContenido(guardado.current.edges, edges, aristaIgual)) {
      return;
    }
    const t = setTimeout(() => {
      const guardar = () => {
        onChange(nodes, edges);
        guardado.current = { nodes, edges };
        setSaved("Guardado ✓");
      };
      if (typeof requestIdleCallback === "function") requestIdleCallback(guardar, { timeout: 1000 });
      else guardar();
    }, 700);
    return () => clearTimeout(t);
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(makeEdge(params), eds)),
    [setEdges],
  );

  const onSelectionChange = useCallback(({ nodes: sn, edges: se }) => {
    setSelNodeId(sn && sn.length ? sn[0].id : null);
    setSelEdgeId(se && se.length ? se[0].id : null);
  }, []);

  // ── Crear nodos (drag & drop desde la paleta, o clic derecho en el lienzo) ──
  const addNode = useCallback(
    (cardKey, position) => {
      const id = `n_${Date.now()}`;
      setNodes((nds) => {
        const nodo = {
          id,
          type: "card",
          position,
          data: { card: cardKey, title: getCard(cardKey).nombre, props: defaultProps(cardKey) },
        };
        // Con dimensiones desde el primer momento, la virtualización lo tiene en
        // cuenta sin esperar a medirlo en el DOM.
        return nds.concat({ ...nodo, ...nodeSize(nodo) });
      });
      setSelNodeId(id);
      setSelEdgeId(null);
    },
    [setNodes],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const cardKey = event.dataTransfer.getData("application/chatbot-node");
      if (!cardKey || !CARDS[cardKey]) return;
      addNode(cardKey, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [screenToFlowPosition, addNode],
  );

  // ── Menú contextual (clic derecho) ──
  const openPaneMenu = useCallback(
    (event) => {
      event.preventDefault();
      setMenu({
        kind: "pane",
        x: event.clientX,
        y: event.clientY,
        flowPos: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    },
    [screenToFlowPosition],
  );

  const openNodeMenu = useCallback((event, node) => {
    event.preventDefault();
    setMenu({ kind: "node", x: event.clientX, y: event.clientY, id: node.id });
  }, []);

  const openEdgeMenu = useCallback((event, edge) => {
    event.preventDefault();
    setMenu({ kind: "edge", x: event.clientX, y: event.clientY, id: edge.id });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  // ── Edición desde el Inspector / el menú contextual ──
  const updateNode = useCallback(
    (id, patch) =>
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      ),
    [setNodes],
  );

  const updateEdge = useCallback(
    (id, patch) =>
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    [setEdges],
  );

  const deleteNode = useCallback(
    (id) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelNodeId(null);
    },
    [setNodes, setEdges],
  );

  const deleteEdge = useCallback(
    (id) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelEdgeId(null);
    },
    [setEdges],
  );

  const duplicateNode = useCallback(
    (id) => {
      setNodes((nds) => {
        const src = nds.find((n) => n.id === id);
        if (!src) return nds;
        const copia = {
          ...src,
          id: `n_${Date.now()}`,
          selected: false,
          position: { x: src.position.x + 44, y: src.position.y + 44 },
          data: { ...src.data },
        };
        return nds.concat({ ...nodeSize(copia), ...copia });
      });
    },
    [setNodes],
  );

  /**
   * Reencuadre AUTOMÁTICO (tras auto-organizar, importar o reiniciar).
   *
   * En un flujo grande, encuadrarlo entero mete los cientos de pasos dentro de
   * la vista y React Flow los monta todos: es justo lo que congela el equipo.
   * Cuando el flujo es grande se vuelve al principio en vez de encuadrar todo.
   * El botón ⤢ sí encuadra de verdad: ahí lo pide el usuario a propósito.
   */
  const reencuadrar = useCallback(
    (lista) => {
      const ns = lista || nodes;
      if (ns.length <= 120) {
        fitView({ padding: 0.18, duration: 400 });
        return;
      }
      const id = entryNode(ns, edges);
      const node = id && ns.find((n) => n.id === id);
      if (!node) return;
      const { width, height } = nodeSize(node);
      setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 0.8, duration: 400 });
    },
    [nodes, edges, fitView, setCenter],
  );

  // ── Toolbar ──
  const organizarEnLocal = useCallback(() => {
    setNodes((nds) => autoLayout(nds, edges, "TB"));
    setTimeout(() => reencuadrar(), 60);
  }, [edges, setNodes, reencuadrar]);

  const handleAutoLayout = useCallback(async () => {
    // Solo se delega cuando compensa: en flujos pequeños la red tarda más que dagre.
    if (motorActivo && nodes.length >= MINIMO_REMOTO) {
      try {
        const posiciones = await layoutRemoto(nodes, edges, "TB");
        setNodes((nds) =>
          nds.map((n) => (posiciones[n.id] ? { ...n, position: posiciones[n.id] } : n)),
        );
        setTimeout(() => reencuadrar(), 60);
        return;
      } catch (e) {
        console.warn("[motor] no disponible, se organiza en local:", e.message);
      }
    }
    organizarEnLocal();
  }, [nodes, edges, setNodes, reencuadrar, organizarEnLocal]);

  const handleAnalizar = useCallback(async () => {
    setInforme({ cargando: true });
    try {
      setInforme(await analizarRemoto(nodes, edges));
    } catch (e) {
      setInforme({ error: e.message });
    }
  }, [nodes, edges]);

  // Despierta la Lambda al abrir un flujo grande: así el primer uso no paga el
  // arranque en frío.
  useEffect(() => {
    if (nodes.length >= MINIMO_REMOTO) precalentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFit = useCallback(() => fitView({ padding: 0.18, duration: 400 }), [fitView]);

  const handleSave = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(nombre || "flujo").replace(/[^\w\-]+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, nombre]);

  const handleLoad = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
            const cargado = migrateFlow(data);
            setNodes(cargado.nodes);
            setEdges(cargado.edges);
            setTimeout(() => reencuadrar(cargado.nodes), 60);
          } else {
            alert("El archivo no tiene el formato esperado (nodes / edges).");
          }
        } catch {
          alert("No se pudo leer el JSON.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [setNodes, setEdges, reencuadrar],
  );

  /** Reinicia el lienzo: vacío o con el flujo de ejemplo. */
  const aplicarReset = useCallback(
    (modo) => {
      const fresh = modo === "ejemplo" ? buildInitialFlow() : { nodes: [], edges: [] };
      setNodes(fresh.nodes);
      setEdges(fresh.edges);
      setSelNodeId(null);
      setSelEdgeId(null);
      setReset(false);
      if (fresh.nodes.length) setTimeout(() => reencuadrar(fresh.nodes), 60);
    },
    [setNodes, setEdges, reencuadrar],
  );

  /** Al montar el lienzo grande, centrar en el primer paso sin encuadrar todo. */
  const alIniciar = useCallback(
    (instancia) => {
      if (!grande) return;
      const id = entryNode(nodes, edges);
      const node = id && nodes.find((n) => n.id === id);
      if (!node) return;
      const { width, height } = nodeSize(node);
      instancia.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 0.8 });
    },
    // Solo importa el estado inicial: después manda el usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grande],
  );

  /** Lleva la vista al primer paso del flujo (el Inicio, o el disparador). */
  const irAlInicio = useCallback(() => {
    const id = entryNode(nodes, edges);
    const node = id && nodes.find((n) => n.id === id);
    if (!node) return;
    const { width, height } = nodeSize(node);
    setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: Math.max(getZoom(), 0.8),
      duration: 500,
    });
    setSelNodeId(node.id);
    setSelEdgeId(null);
  }, [nodes, edges, setCenter, getZoom]);

  // Identidad estable: si esta función cambia en cada render, el minimapa se
  // repinta aunque no haya cambiado nada.
  const colorNodo = useCallback((n) => cardColor(n.data?.card), []);

  const toggleSim = useCallback(() => {
    setSimOpen((open) => {
      if (open) setActiveNodeId(null); // al detener, quita el resaltado
      return !open;
    });
  }, []);

  // Items del menú contextual según dónde se hizo clic derecho.
  const menuItems = useMemo(() => {
    if (!menu) return [];
    if (menu.kind === "pane") {
      return [
        ...CARDS_POR_FAMILIA.flatMap((f) => [
          { header: f.nombre, strong: true, color: f.color },
          ...f.grupos.flatMap((g) => [
            { header: g.nombre },
            ...g.cards.map((c) => ({
              label: c.nombre,
              dot: g.color,
              hint: c.icon,
              onSelect: () => addNode(c.key, menu.flowPos),
            })),
          ]),
        ]),
        { sep: true },
        { label: "Auto-organizar", onSelect: handleAutoLayout },
        { label: "Encuadrar todo", onSelect: handleFit },
      ];
    }
    if (menu.kind === "node") {
      return [
        { label: "Duplicar paso", onSelect: () => duplicateNode(menu.id) },
        { label: "Encuadrar todo", onSelect: handleFit },
        { sep: true },
        { label: "Borrar paso", danger: true, onSelect: () => deleteNode(menu.id) },
      ];
    }
    return [{ label: "Borrar conexión", danger: true, onSelect: () => deleteEdge(menu.id) }];
  }, [menu, addNode, duplicateNode, deleteNode, deleteEdge, handleAutoLayout, handleFit]);

  const selNode = nodes.find((n) => n.id === selNodeId) || null;
  const selEdge = edges.find((e) => e.id === selEdgeId) || null;

  // Un objeto nuevo aquí invalidaría el memo de TODOS los nodos en cada render.
  const simValue = useMemo(() => ({ activeNodeId }), [activeNodeId]);
  const lejos = useStore((s) => s.transform[2] < 0.5);
  // Lo que se DIBUJA; el estado `edges` conserva etiquetas y estilo para exportar.
  const edgesVista = useMemo(
    () => simplificarAristas(edges),
    [edges],
  );

  return (
    <div className="app">
      <Toolbar
        nombre={nombre}
        onRename={onRename}
        onHome={onHome}
        onSave={handleSave}
        onLoad={handleLoad}
        onAutoLayout={handleAutoLayout}
        onFit={handleFit}
        onReset={() => setReset(true)}
        onAnalizar={motorActivo ? handleAnalizar : null}
        onToggleSim={toggleSim}
        simOpen={simOpen}
        saved={ESTADO_NUBE[nube] || saved}
      />
      <div className={`app__body${sidebarOpen ? "" : " app__body--collapsed"}`}>
        <Sidebar />
        <div
          className={`canvas is-ligero${lejos ? " is-lod" : ""}`}
          ref={wrapperRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <button
            className={`canvas__toggle${sidebarOpen ? " is-on" : ""}`}
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Ocultar la paleta" : "Mostrar la paleta"}
          >
            <span className="canvas__toggle-icon" aria-hidden="true" />
          </button>

          <SimContext.Provider value={simValue}>
            <ReactFlow
              nodes={nodes}
              edges={edgesVista}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onPaneContextMenu={openPaneMenu}
              onNodeContextMenu={openNodeMenu}
              onEdgeContextMenu={openEdgeMenu}
              onPaneClick={closeMenu}
              onMoveStart={closeMenu}
              {...(grande
                ? // Encuadrar todo pondría los CIENTOS de pasos dentro de la vista
                  // y React Flow los montaría todos de golpe — eso es lo que
                  // congela el equipo. En un flujo grande se abre por el
                  // principio, y la virtualización solo monta lo que se ve.
                  { defaultViewport: { x: 60, y: 60, zoom: 0.8 } }
                : { fitView: true, fitViewOptions: { padding: 0.18 } })}
              onInit={alIniciar}
              minZoom={0.15}
              onlyRenderVisibleElements
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1.4} color="#232327" />
              <MiniMap
                pannable
                zoomable
                nodeColor={colorNodo}
                nodeStrokeWidth={0}
                maskColor="rgba(8,8,10,0.7)"
                bgColor="transparent"
              />
              <ZoomControls onInicio={irAlInicio} />
            </ReactFlow>
          </SimContext.Provider>

          {nodes.length === 0 ? (
            <div className="canvas__empty">
              <div className="canvas__emptytitle">Lienzo en blanco</div>
              <p>
                Arrastra una tarjeta desde la paleta, o haz <b>clic derecho</b> aquí
                para crear el primer paso.
              </p>
            </div>
          ) : null}

          {menu ? (
            <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />
          ) : null}
        </div>
        {simOpen ? (
          <Simulator
            nodes={nodes}
            edges={edges}
            onActive={setActiveNodeId}
            onClose={() => {
              setSimOpen(false);
              setActiveNodeId(null);
            }}
          />
        ) : (
          <Inspector
            node={selNode}
            edge={selEdge}
            onUpdateNode={updateNode}
            onUpdateEdge={updateEdge}
            onDeleteNode={deleteNode}
            onDeleteEdge={deleteEdge}
          />
        )}
      </div>

      {informe ? (
        <Modal
          icon="🔍"
          title="Revisión del flujo"
          onClose={() => setInforme(null)}
          acciones={[{ label: "Cerrar", onClick: () => setInforme(null), variant: "primary" }]}
        >
          {informe.cargando ? (
            "Analizando en la nube…"
          ) : informe.error ? (
            `No se pudo analizar: ${informe.error}`
          ) : (
            <>
              <p style={{ margin: "0 0 10px" }}>
                <b>{informe.pasos}</b> pasos y <b>{informe.conexiones}</b> conexiones ·
                empieza en <b>{informe.inicio || "—"}</b> · calculado en AWS en {informe.ms} ms.
              </p>
              <ListaInforme titulo="Pasos inalcanzables" items={informe.inalcanzables} />
              <ListaInforme titulo="Sin salida (callejones)" items={informe.callejones} />
              <ListaInforme titulo="Salidas sin conectar" items={informe.sueltas} />
              <ListaInforme titulo="Tarjetas que Meta rechazaría" items={informe.invalidas} />
              {!informe.inalcanzables.length &&
              !informe.callejones.length &&
              !informe.sueltas.length &&
              !informe.invalidas.length
                ? "✅ Sin problemas: todo alcanzable, conectado y válido."
                : null}
            </>
          )}
        </Modal>
      ) : null}

      {reset ? (
        <Modal
          icon="🔄"
          title="Reiniciar el lienzo"
          onClose={() => setReset(false)}
          acciones={[
            { label: "Cancelar", onClick: () => setReset(false), variant: "ghost", autoFocus: true },
            { label: "Cargar el ejemplo", onClick: () => aplicarReset("ejemplo") },
            { label: "Vaciar lienzo", variant: "danger", onClick: () => aplicarReset("blanco") },
          ]}
        >
          Vas a reemplazar <b>{nodes.length} pasos</b> y <b>{edges.length} conexiones</b>.
          Esto no se puede deshacer.
          <ul className="modal__list">
            <li><b>Vaciar lienzo</b> — empiezas de cero, sin ningún paso.</li>
            <li><b>Cargar el ejemplo</b> — vuelve el flujo de demostración.</li>
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

/** Bloque del informe: solo aparece si hay algo que contar. */
function ListaInforme({ titulo, items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <b>
        {titulo} ({items.length})
      </b>
      <ul className="modal__list">
        {items.slice(0, 8).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
        {items.length > 8 ? <li>…y {items.length - 8} más</li> : null}
      </ul>
    </div>
  );
}

/** Qué se está haciendo mientras se abre un flujo. */
const ETAPAS = {
  abriendo: "Abriendo el flujo…",
  bajando: "Bajando de la nube…",
  preparando: "Preparando los pasos…",
  dibujando: "Dibujando el lienzo…",
  listo: "Listo",
};

/**
 * Pantalla de apertura con avance real.
 *
 * Un flujo de cientos de pasos pesa cientos de KB: bajarlo, guardarlo y montarlo
 * lleva su tiempo, y sin señal parece que la aplicación se colgó. La barra usa
 * el porcentaje real de la descarga, que es la parte larga.
 */
function Cargando({ nombre, pasos, carga }) {
  const etapa = carga?.etapa || "abriendo";
  const pct = etapa === "bajando" ? carga.pct : etapa === "abriendo" ? 5 : 100;
  return (
    <div className="cargando">
      <div className="cargando__caja">
        <div className="cargando__nombre">{nombre}</div>
        {pasos ? <div className="cargando__pasos">{pasos} pasos</div> : null}
        <div className="cargando__barra">
          <div
            className={`cargando__avance${etapa === "bajando" ? "" : " is-indeterminado"}`}
            style={{ width: `${Math.max(5, pct)}%` }}
          />
        </div>
        <div className="cargando__etapa">
          {ETAPAS[etapa]}
          {etapa === "bajando" && carga.pct ? ` ${carga.pct}%` : ""}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ App: portada + editor ══════════════════════════ */

export default function App({ sesion }) {
  const [indice, setIndice] = useState(cargarIndice);
  const [abiertoId, setAbiertoId] = useState(null);
  // El id abierto también en un ref: así el callback de guardado es estable y no
  // vuelve a montar el efecto de autoguardado del lienzo.
  const abiertoRef = useRef(null);
  // El índice actual, para los manejadores: al mandarlo a la nube hace falta
  // cómo queda DESPUÉS del cambio, y el estado aún no se ha actualizado.
  const indiceRef = useRef(indice);
  // Cuerpo del flujo abierto: `null` mientras se busca (puede venir de S3).
  const [doc, setDoc] = useState(null);
  const [carga, setCarga] = useState(null); // { etapa, pct }
  const [estadoNube, setEstadoNube] = useState(null);

  // El índice es estado PURO; persistirlo es un efecto (y pesa ~1 KB).
  // Ojo con las llaves: `guardarIndice` DEVUELVE el índice, y un efecto que
  // devuelve algo que no es función revienta cuando React lo llama al limpiar.
  useEffect(() => {
    indiceRef.current = indice;
    guardarIndice(indice);
  }, [indice]);

  // Al entrar, se cruza lo de este navegador con lo guardado en S3.
  useEffect(() => {
    if (!nubeActiva) return undefined;
    let vivo = true;
    sincronizarIndice()
      .then((combinado) => {
        if (vivo && combinado) setIndice(combinado);
      })
      .catch((e) => console.warn("[nube] no se pudo leer el índice:", e));
    const quitar = alSincronizar(setEstadoNube);
    window.addEventListener("pagehide", alCerrar);
    return () => {
      vivo = false;
      quitar();
      window.removeEventListener("pagehide", alCerrar);
    };
  }, []);

  const abrir = useCallback((id) => {
    abiertoRef.current = id;
    setAbiertoId(id);
  }, []);

  const meta = indice.find((m) => m.id === abiertoId) || null;

  // El cuerpo se lee UNA vez al abrir el flujo, de este navegador o de S3.
  useEffect(() => {
    if (!abiertoId) {
      setDoc(null);
      return undefined;
    }
    let vivo = true;
    setDoc(null);
    setCarga({ etapa: "abriendo", pct: 0 });
    documento(abiertoId, (etapa, pct) => {
      if (vivo) setCarga({ etapa, pct });
    }).then((d) => {
      if (!vivo) return;
      setCarga({ etapa: "dibujando", pct: 100 });
      // Un respiro antes de montar el lienzo: así el navegador alcanza a pintar
      // el 100 % de la barra en vez de saltar de golpe a un lienzo a medio hacer.
      setTimeout(() => vivo && setDoc(d), 60);
    });
    return () => {
      vivo = false;
    };
  }, [abiertoId]);

  const crear = useCallback(
    (nombre, contenido = { nodes: [], edges: [] }) => {
      const nuevo = nuevoMeta(nombre, contenido);
      guardarDocumento(nuevo.id, contenido);
      setIndice((idx) => [nuevo, ...idx]);
      sincronizar(nuevo.id);
      abrir(nuevo.id);
    },
    [abrir],
  );

  const importar = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            alert("El archivo no tiene el formato esperado (nodes / edges).");
            return;
          }
          crear(file.name.replace(/\.json$/i, ""), migrateFlow(data));
        } catch {
          alert("No se pudo leer el JSON.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [crear],
  );

  /**
   * Autoguardado: escribe SOLO este flujo, toca el índice solo si su resumen
   * cambió y encola la subida a S3 (que espera a que pare la ráfaga de edición).
   */
  const guardar = useCallback((nodes, edges) => {
    const id = abiertoRef.current;
    if (!id) return;
    guardarDocumento(id, { nodes, edges });
    setIndice((idx) => conResumen(idx, id, { nodes, edges }));
    sincronizar(id);
  }, []);

  const renombrar = useCallback((nombre) => {
    const id = abiertoRef.current;
    if (!id) return;
    setIndice((idx) => conNombre(idx, id, nombre));
    sincronizar(id); // agrupado: no sube una versión por cada tecla
  }, []);

  const duplicar = useCallback((id) => {
    const orig = indice.find((m) => m.id === id);
    if (!orig) return;
    const copiaDoc = cargarDocumento(id);
    const copia = nuevoMeta(`${orig.nombre} (copia)`, copiaDoc);
    guardarDocumento(copia.id, copiaDoc);
    setIndice((idx) => [copia, ...idx]);
    sincronizar(copia.id);
  }, [indice]);

  const borrar = useCallback((id) => {
    borrarDocumento(id);
    setIndice((idx) => sinFlujo(idx, id));
    borrarEnLaNube(id, sinFlujo(indiceRef.current, id));
  }, []);

  /** Renombrar desde la portada: solo cambia la portada, no el cuerpo del flujo. */
  const renombrarEnPortada = useCallback((id, nombre) => {
    setIndice((idx) => conNombre(idx, id, nombre));
    sincronizarSoloIndice(conNombre(indiceRef.current, id, nombre));
  }, []);

  const volver = useCallback(() => {
    abiertoRef.current = null;
    setAbiertoId(null);
  }, []);

  // Con `meta` pero sin `doc`, el cuerpo se está bajando de S3.
  if (meta && !doc) {
    return <Cargando nombre={meta.nombre} pasos={meta.pasos} carga={carga} />;
  }

  if (!meta) {
    return (
      <Home
        sesion={sesion}
        flujos={indice}
        onAbrir={abrir}
        onNuevo={() => crear("Flujo sin título")}
        onEjemplo={() => crear("Flujo de ejemplo", buildInitialFlow())}
        onImportar={importar}
        onDuplicar={(tipo, id) => duplicar(id)}
        onBorrar={(tipo, id) => borrar(id)}
        onRenombrar={(tipo, id, nombre) => renombrarEnPortada(id, nombre)}
      />
    );
  }

  return (
    <ReactFlowProvider>
      <Studio
        key={meta.id}
        nombre={meta.nombre}
        doc={doc}
        nube={estadoNube}
        onChange={guardar}
        onRename={renombrar}
        onHome={volver}
      />
    </ReactFlowProvider>
  );
}
