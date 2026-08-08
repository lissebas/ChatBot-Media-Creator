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
import { SimContext } from "./sim/SimContext";
import { CARDS, CARDS_POR_FAMILIA, cardColor, defaultProps, getCard } from "./flow/cardTypes";
import {
  autoLayout,
  buildInitialFlow,
  makeEdge,
  migrateFlow,
  simplificarAristas,
  NODE_H,
  NODE_W,
} from "./flow/transform";
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

/* ══════════════════════════ Editor ══════════════════════════ */

function Studio({ nombre, doc, onChange, onRename, onHome }) {
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
  // El minimapa redibuja TODOS los nodos en cada movimiento de la vista: en
  // flujos grandes arranca apagado, y la preferencia se recuerda.
  const [mapa, setMapa] = useState(() => {
    const guardado = localStorage.getItem("cbc-minimapa");
    if (guardado !== null) return guardado === "1";
    return (initial.nodes?.length || 0) <= 60;
  });
  // Aristas ligeras (sin etiquetas): automáticas en flujos con muchas conexiones.
  const [simples, setSimples] = useState(() => {
    const guardado = localStorage.getItem("cbc-aristas-simples");
    if (guardado !== null) return guardado === "1";
    return (initial.edges?.length || 0) > 80;
  });
  const [reset, setReset] = useState(false);
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
  // guardar) y escribe en un hueco libre del hilo para no cortar una animación.
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const t = setTimeout(() => {
      const guardar = () => {
        onChange(nodes, edges);
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
      setNodes((nds) =>
        nds.concat({
          id,
          type: "card",
          position,
          data: { card: cardKey, title: getCard(cardKey).nombre, props: defaultProps(cardKey) },
        }),
      );
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
        return nds.concat({
          ...src,
          id: `n_${Date.now()}`,
          selected: false,
          position: { x: src.position.x + 44, y: src.position.y + 44 },
          data: { ...src.data },
        });
      });
    },
    [setNodes],
  );

  // ── Toolbar ──
  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => autoLayout(nds, edges, "TB"));
    setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 60);
  }, [edges, setNodes, fitView]);

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
            setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 60);
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
    [setNodes, setEdges, fitView],
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
      if (fresh.nodes.length) setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 60);
    },
    [setNodes, setEdges, fitView],
  );

  const toggleSimples = useCallback(() => {
    setSimples((v) => {
      localStorage.setItem("cbc-aristas-simples", v ? "0" : "1");
      return !v;
    });
  }, []);

  const toggleMapa = useCallback(() => {
    setMapa((v) => {
      localStorage.setItem("cbc-minimapa", v ? "0" : "1");
      return !v;
    });
  }, []);

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
  // Lo que se DIBUJA; el estado `edges` conserva etiquetas y estilo para exportar.
  const edgesVista = useMemo(
    () => (simples ? simplificarAristas(edges) : edges),
    [edges, simples],
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
        onToggleSim={toggleSim}
        simOpen={simOpen}
        saved={saved}
      />
      <div className={`app__body${sidebarOpen ? "" : " app__body--collapsed"}`}>
        <Sidebar />
        <div className="canvas" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver}>
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
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.15}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1.4} color="#232327" />
              {mapa ? (
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={colorNodo}
                  nodeStrokeWidth={0}
                  maskColor="rgba(8,8,10,0.7)"
                  bgColor="transparent"
                />
              ) : null}
              <ZoomControls
                mapa={mapa}
                onToggleMapa={toggleMapa}
                simples={simples}
                onToggleSimples={toggleSimples}
              />
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

/* ══════════════════════════ App: portada + editor ══════════════════════════ */

export default function App() {
  const [indice, setIndice] = useState(cargarIndice);
  const [abiertoId, setAbiertoId] = useState(null);
  // El id abierto también en un ref: así el callback de guardado es estable y no
  // vuelve a montar el efecto de autoguardado del lienzo.
  const abiertoRef = useRef(null);

  // El índice es estado PURO; persistirlo es un efecto (y pesa ~1 KB).
  // Ojo con las llaves: `guardarIndice` DEVUELVE el índice, y un efecto que
  // devuelve algo que no es función revienta cuando React lo llama al limpiar.
  useEffect(() => {
    guardarIndice(indice);
  }, [indice]);

  const abrir = useCallback((id) => {
    abiertoRef.current = id;
    setAbiertoId(id);
  }, []);

  const meta = indice.find((m) => m.id === abiertoId) || null;
  // El cuerpo del flujo se lee UNA vez al abrirlo (no en cada render).
  const doc = useMemo(() => (abiertoId ? cargarDocumento(abiertoId) : null), [abiertoId]);

  const crear = useCallback(
    (nombre, contenido = { nodes: [], edges: [] }) => {
      const nuevo = nuevoMeta(nombre, contenido);
      guardarDocumento(nuevo.id, contenido);
      setIndice((idx) => [nuevo, ...idx]);
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

  /** Autoguardado: escribe SOLO este flujo y toca el índice solo si su resumen cambió. */
  const guardar = useCallback((nodes, edges) => {
    const id = abiertoRef.current;
    if (!id) return;
    guardarDocumento(id, { nodes, edges });
    setIndice((idx) => conResumen(idx, id, { nodes, edges }));
  }, []);

  const renombrar = useCallback((nombre) => {
    const id = abiertoRef.current;
    if (id) setIndice((idx) => conNombre(idx, id, nombre));
  }, []);

  const duplicar = useCallback((id) => {
    const orig = indice.find((m) => m.id === id);
    if (!orig) return;
    const copiaDoc = cargarDocumento(id);
    const copia = nuevoMeta(`${orig.nombre} (copia)`, copiaDoc);
    guardarDocumento(copia.id, copiaDoc);
    setIndice((idx) => [copia, ...idx]);
  }, [indice]);

  const borrar = useCallback((id) => {
    borrarDocumento(id);
    setIndice((idx) => sinFlujo(idx, id));
  }, []);

  const volver = useCallback(() => {
    abiertoRef.current = null;
    setAbiertoId(null);
  }, []);

  if (!meta || !doc) {
    return (
      <Home
        flujos={indice}
        onAbrir={abrir}
        onNuevo={() => crear("Flujo sin título")}
        onEjemplo={() => crear("Flujo de ejemplo", buildInitialFlow())}
        onImportar={importar}
        onDuplicar={(tipo, id) => duplicar(id)}
        onBorrar={(tipo, id) => borrar(id)}
        onRenombrar={(tipo, id, nombre) => setIndice((idx) => conNombre(idx, id, nombre))}
      />
    );
  }

  return (
    <ReactFlowProvider>
      <Studio
        key={meta.id}
        nombre={meta.nombre}
        doc={doc}
        onChange={guardar}
        onRename={renombrar}
        onHome={volver}
      />
    </ReactFlowProvider>
  );
}
