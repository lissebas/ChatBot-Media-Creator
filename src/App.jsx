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
  NODE_H,
  NODE_W,
} from "./flow/transform";
import {
  borrarDoc,
  cargarEspacio,
  crearFlujo,
  duplicarDoc,
  guardarDoc,
  guardarEspacio,
  renombrarDoc,
} from "./flow/workspace";
import "./App.css";

const nodeTypes = { card: FlowNode };

/* ══════════════════════════ Editor ══════════════════════════ */

function Studio({ flujo, onChange, onRename, onHome }) {
  const initial = useMemo(() => ({ nodes: flujo.nodes, edges: flujo.edges }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selNodeId, setSelNodeId] = useState(null);
  const [selEdgeId, setSelEdgeId] = useState(null);
  const [saved, setSaved] = useState("Autoguardado activo");
  const [simOpen, setSimOpen] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menu, setMenu] = useState(null); // { kind, x, y, id?, flowPos? }
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

  // Autoguardado en el espacio de trabajo (localStorage).
  useEffect(() => {
    const t = setTimeout(() => {
      onChange(nodes, edges);
      setSaved("Guardado ✓");
    }, 500);
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
    a.download = `${(flujo.nombre || "flujo").replace(/[^\w\-]+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, flujo.nombre]);

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

  return (
    <div className="app">
      <Toolbar
        nombre={flujo.nombre}
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

          <SimContext.Provider value={{ activeNodeId }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => cardColor(n.data?.card)}
                nodeStrokeWidth={0}
                maskColor="rgba(8,8,10,0.7)"
                bgColor="transparent"
              />
              <ZoomControls />
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
  const [espacio, setEspacio] = useState(cargarEspacio);
  const [abierto, setAbierto] = useState(null); // { tipo, id }

  useEffect(() => guardarEspacio(espacio), [espacio]);

  const abrirNuevo = useCallback((tipo, doc) => {
    setEspacio((e) => ({ ...e, ultimo: doc.id, [tipo]: [doc, ...(e[tipo] || [])] }));
    setAbierto({ tipo, id: doc.id });
  }, []);

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
          abrirNuevo("flujos", crearFlujo(file.name.replace(/\.json$/i, ""), migrateFlow(data)));
        } catch {
          alert("No se pudo leer el JSON.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [abrirNuevo],
  );

  const doc = abierto ? (espacio[abierto.tipo] || []).find((d) => d.id === abierto.id) : null;

  const guardarContenido = useCallback(
    (patch) => {
      if (!abierto) return;
      setEspacio((e) => {
        const actual = (e[abierto.tipo] || []).find((d) => d.id === abierto.id);
        if (!actual) return e;
        return guardarDoc(e, abierto.tipo, { ...actual, ...patch });
      });
    },
    [abierto],
  );

  // Identidades estables: los editores autoguardan en un efecto que depende de
  // ellas; si cambiaran en cada render, el guardado se repetiría sin parar.
  const guardarLienzo = useCallback(
    (nodes, edges) => guardarContenido({ nodes, edges }),
    [guardarContenido],
  );
  const renombrar = useCallback(
    (nombre) => abierto && setEspacio((e) => renombrarDoc(e, abierto.tipo, abierto.id, nombre)),
    [abierto],
  );

  if (!doc) {
    return (
      <Home
        flujos={espacio.flujos}
        onAbrir={(id) => setAbierto({ tipo: "flujos", id })}
        onNuevo={() => abrirNuevo("flujos", crearFlujo("Flujo sin título"))}
        onEjemplo={() => abrirNuevo("flujos", crearFlujo("Flujo de ejemplo", buildInitialFlow()))}
        onImportar={importar}
        onDuplicar={(tipo, id) => setEspacio((e) => duplicarDoc(e, tipo, id))}
        onBorrar={(tipo, id) => setEspacio((e) => borrarDoc(e, tipo, id))}
        onRenombrar={(tipo, id, nombre) => setEspacio((e) => renombrarDoc(e, tipo, id, nombre))}
      />
    );
  }

  return (
    <ReactFlowProvider>
      <Studio
        key={doc.id}
        flujo={doc}
        onChange={guardarLienzo}
        onRename={renombrar}
        onHome={() => setAbierto(null)}
      />
    </ReactFlowProvider>
  );
}
