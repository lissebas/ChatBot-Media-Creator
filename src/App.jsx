import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
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
import { SimContext } from "./sim/SimContext";
import { GRUPOS } from "./flow/willyFlow";
import { autoLayout, buildInitialFlow, makeEdge, NODE_H, NODE_W } from "./flow/transform";
import "./App.css";

const STORAGE_KEY = "willy-studio-flow-v1";
const nodeTypes = { willy: FlowNode };

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data.nodes) && Array.isArray(data.edges)) return data;
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

  // ── Crear nodo por drag & drop desde la paleta ──
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const group = event.dataTransfer.getData("application/willy-node");
      if (!group || !GRUPOS[group]) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = `n_${Date.now()}`;
      setNodes((nds) =>
        nds.concat({
          id,
          type: "willy",
          position,
          data: { title: "Nuevo paso", text: "", group },
        }),
      );
      setSelNodeId(id);
      setSelEdgeId(null);
    },
    [screenToFlowPosition, setNodes],
  );

  // ── Edición desde el Inspector ──
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

  // ── Toolbar ──
  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => autoLayout(nds, edges, "TB"));
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60);
  }, [edges, setNodes, fitView]);

  const handleFit = useCallback(() => fitView({ padding: 0.15, duration: 400 }), [fitView]);

  const handleSave = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "willy-flujo.json";
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
            setNodes(data.nodes);
            setEdges(data.edges);
            setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60);
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
    if (!confirm("¿Volver al flujo original de Willy? Se perderán tus cambios.")) return;
    const fresh = buildInitialFlow();
    setNodes(fresh.nodes);
    setEdges(fresh.edges);
    setSelNodeId(null);
    setSelEdgeId(null);
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 60);
  }, [setNodes, setEdges, fitView]);

  const toggleSim = useCallback(() => {
    setSimOpen((open) => {
      if (open) setActiveNodeId(null); // al detener, quita el resaltado
      return !open;
    });
  }, []);

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
      <div className="app__body">
        <Sidebar />
        <div className="canvas" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver}>
          <SimContext.Provider value={{ activeNodeId }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.15}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={18} size={1} color="#e2e8f0" />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => (GRUPOS[n.data?.group] || GRUPOS.inicio).color}
                maskColor="rgba(15,23,42,0.06)"
              />
              <Controls />
            </ReactFlow>
          </SimContext.Provider>
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
