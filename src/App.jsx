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
import { SimContext } from "./sim/SimContext";
import { CARDS, CARDS_POR_CATEGORIA, cardColor, defaultProps, getCard } from "./flow/cardTypes";
import {
  autoLayout,
  buildInitialFlow,
  makeEdge,
  migrateFlow,
  NODE_H,
  NODE_W,
} from "./flow/transform";
import "./App.css";

const STORAGE_KEY = "chatbot-creator-flow-v2";
const nodeTypes = { card: FlowNode };

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data.nodes) && Array.isArray(data.edges)) return migrateFlow(data);
  } catch {
    /* ignora JSON corrupto */
  }
  return null;
}

function Studio() {
  const initial = useMemo(() => loadFromStorage() || buildInitialFlow(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selNodeId, setSelNodeId] = useState(null);
  const [selEdgeId, setSelEdgeId] = useState(null);
  const [saved, setSaved] = useState("Autoguardado activo");
  const [simOpen, setSimOpen] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menu, setMenu] = useState(null); // { kind, x, y, id?, flowPos? }
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

  // Autoguardado en el navegador (localStorage).
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
      setSaved("Guardado ✓");
    }, 500);
    return () => clearTimeout(t);
  }, [nodes, edges]);

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
    a.download = "flujo.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const handleLoad = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
            const flujo = migrateFlow(data);
            setNodes(flujo.nodes);
            setEdges(flujo.edges);
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

  const handleReset = useCallback(() => {
    if (!confirm("¿Volver al flujo de ejemplo? Se perderán tus cambios.")) return;
    const fresh = buildInitialFlow();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelNodeId(null);
    setSelEdgeId(null);
    setTimeout(() => fitView({ padding: 0.18, duration: 400 }), 60);
  }, [setNodes, setEdges, fitView]);

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
        ...CARDS_POR_CATEGORIA.flatMap((g) => [
          { header: g.nombre },
          ...g.cards.map((c) => ({
            label: c.nombre,
            dot: g.color,
            hint: c.icon,
            onSelect: () => addNode(c.key, menu.flowPos),
          })),
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
        onSave={handleSave}
        onLoad={handleLoad}
        onAutoLayout={handleAutoLayout}
        onFit={handleFit}
        onReset={handleReset}
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
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}
