import React, { useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  Search,
  RotateCcw,
  ArrowRightLeft,
  ArrowDownUp,
  Maximize2,
  Filter,
  ExternalLink,
  X,
  Copy,
  Check,
  Network,
  FolderTree,
} from 'lucide-react';
import type {
  CodebaseNode,
  CodebaseFileDependency,
  RelationshipType,
  ArchitectureModel,
} from '../../types/analysis';
import { CodebaseFileNode } from './nodes/CodebaseFileNode';
import { CodebaseModuleNode } from './nodes/CodebaseModuleNode';

interface CodebaseGraphProps {
  architecture: ArchitectureModel;
  focusServiceId?: string | null;
  onClearFocusService?: () => void;
  onSwitchToArchitecture?: () => void;
  onSelectComponentInArchitecture?: (componentId: string) => void;
  onChangeGraphMode?: (mode: 'architecture' | 'codebase') => void;
}

const nodeTypes: any = {
  codebaseFile: CodebaseFileNode,
  codebaseModule: CodebaseModuleNode,
};

const getEdgeColor = (type: RelationshipType): string => {
  switch (type) {
    case 'IMPORTS':
      return '#7c3aed'; // Violet
    case 'CALLS':
      return '#0284c7'; // Sky
    case 'USES':
      return '#059669'; // Emerald
    case 'DEPENDS_ON':
      return '#d97706'; // Amber
    case 'EXPOSES':
      return '#db2777'; // Pink
    case 'QUERIES':
      return '#0891b2'; // Cyan
    case 'PUBLISHES':
      return '#4f46e5'; // Indigo
    case 'SUBSCRIBES':
      return '#9333ea'; // Purple
    default:
      return '#64748b'; // Slate
  }
};

const CodebaseGraphCanvasInner: React.FC<CodebaseGraphProps> = ({
  architecture,
  focusServiceId,
  onClearFocusService,
  onSwitchToArchitecture,
  onSelectComponentInArchitecture,
  onChangeGraphMode,
}) => {
  const { fitView } = useReactFlow();
  const codebaseGraph = architecture.codebaseGraph || architecture.inventory?.codebase_graph;

  const [searchTerm, setSearchTerm] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<'ALL' | 'files' | 'modules'>('ALL');
  const [relTypeFilter, setRelTypeFilter] = useState<'ALL' | RelationshipType>('ALL');
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // All raw nodes and edges
  const rawNodes = useMemo<CodebaseNode[]>(() => {
    if (codebaseGraph?.nodes && codebaseGraph.nodes.length > 0) {
      return codebaseGraph.nodes;
    }
    // Fallback: construct from inventory files
    if (architecture.inventory?.files) {
      return architecture.inventory.files.map((f) => ({
        id: f.path,
        name: f.path.split('/').pop() || f.path,
        type: 'file',
        path: f.path,
        extension: f.extension,
        language: f.language,
        category: f.category,
        size_bytes: f.size_bytes,
        lines_count: f.lines_count || 0,
        service_id: f.associated_entity_id,
        imports: [],
        imported_by: [],
      }));
    }
    return [];
  }, [codebaseGraph, architecture.inventory]);

  const rawEdges = useMemo<CodebaseFileDependency[]>(() => {
    return codebaseGraph?.edges || architecture.inventory?.file_dependencies || [];
  }, [codebaseGraph, architecture.inventory]);

  // Degree calculation maps
  const { inDegreeMap, outDegreeMap } = useMemo(() => {
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();

    rawNodes.forEach((n) => {
      inDeg.set(n.id, 0);
      outDeg.set(n.id, 0);
    });

    rawEdges.forEach((e) => {
      if (outDeg.has(e.source_file)) {
        outDeg.set(e.source_file, (outDeg.get(e.source_file) || 0) + 1);
      }
      if (inDeg.has(e.target_file)) {
        inDeg.set(e.target_file, (inDeg.get(e.target_file) || 0) + 1);
      }
    });

    return { inDegreeMap: inDeg, outDegreeMap: outDeg };
  }, [rawNodes, rawEdges]);

  // Filter nodes according to filters, search, and service focus
  const filteredNodes = useMemo(() => {
    return rawNodes.filter((n) => {
      // Focus Service filter
      if (focusServiceId && n.service_id !== focusServiceId) {
        return false;
      }

      // Node type filter
      if (nodeTypeFilter === 'files' && n.type !== 'file') return false;
      if (nodeTypeFilter === 'modules' && n.type === 'file') return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = n.name.toLowerCase().includes(q);
        const matchPath = n.path.toLowerCase().includes(q);
        const matchLang = n.language?.toLowerCase().includes(q) || false;
        const matchExt = n.extension?.toLowerCase().includes(q) || false;
        if (!matchName && !matchPath && !matchLang && !matchExt) return false;
      }

      return true;
    });
  }, [rawNodes, focusServiceId, nodeTypeFilter, searchTerm]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // Filter edges according to visible nodes and relationship type filter
  const filteredEdges = useMemo(() => {
    return rawEdges.filter((e) => {
      if (!visibleNodeIds.has(e.source_file) || !visibleNodeIds.has(e.target_file)) {
        return false;
      }
      if (relTypeFilter !== 'ALL' && e.type !== relTypeFilter) {
        return false;
      }
      return true;
    });
  }, [rawEdges, visibleNodeIds, relTypeFilter]);

  // Build Dagre Layout
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (filteredNodes.length === 0) {
      return { layoutNodes: [], layoutEdges: [] };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      ranksep: 90,
      nodesep: 40,
      edgesep: 25,
      align: 'UL',
    });
    g.setDefaultEdgeLabel(() => ({}));

    filteredNodes.forEach((node) => {
      const w = node.type === 'file' ? 240 : 260;
      const h = node.type === 'file' ? 82 : 86;
      g.setNode(node.id, { width: w, height: h });
    });

    filteredEdges.forEach((edge) => {
      g.setEdge(edge.source_file, edge.target_file);
    });

    dagre.layout(g);

    const isNodeSelected = !!selectedNodeId;

    // Connected neighbors of selected node
    const connectedNodeIds = new Set<string>();
    if (selectedNodeId) {
      connectedNodeIds.add(selectedNodeId);
      filteredEdges.forEach((e) => {
        if (e.source_file === selectedNodeId) connectedNodeIds.add(e.target_file);
        if (e.target_file === selectedNodeId) connectedNodeIds.add(e.source_file);
      });
    }

    const flowNodes: Node[] = filteredNodes.map((node) => {
      const pos = g.node(node.id);
      const isSel = node.id === selectedNodeId;
      const isConn = connectedNodeIds.has(node.id);
      const isDimmed = isNodeSelected && !isConn;

      return {
        id: node.id,
        type: node.type === 'file' ? 'codebaseFile' : 'codebaseModule',
        position: {
          x: (pos ? pos.x - pos.width / 2 : 0) + 50,
          y: (pos ? pos.y - pos.height / 2 : 0) + 50,
        },
        data: {
          node,
          isSelected: isSel,
          isHighlighted: isConn && !isSel,
          isDimmed,
          inDegree: inDegreeMap.get(node.id) || 0,
          outDegree: outDegreeMap.get(node.id) || 0,
        },
      };
    });

    const flowEdges: Edge[] = filteredEdges.map((edge) => {
      const color = getEdgeColor(edge.type);
      const isConn =
        selectedNodeId &&
        (edge.source_file === selectedNodeId || edge.target_file === selectedNodeId);
      const isDimmed = isNodeSelected && !isConn;

      return {
        id: edge.id,
        source: edge.source_file,
        target: edge.target_file,
        type: 'smoothstep',
        animated: edge.type === 'CALLS',
        label: edge.type,
        labelStyle: {
          fontSize: 9,
          fontFamily: 'monospace',
          fontWeight: 600,
          fill: color,
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.9,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [4, 2] as [number, number],
        style: {
          stroke: color,
          strokeWidth: isConn ? 2.5 : 1.5,
          opacity: isDimmed ? 0.15 : 0.85,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color,
        },
      };
    });

    return { layoutNodes: flowNodes, layoutEdges: flowEdges };
  }, [
    filteredNodes,
    filteredEdges,
    direction,
    selectedNodeId,
    inDegreeMap,
    outDegreeMap,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  // Fit view on initial render or layout direction change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 100);
    return () => clearTimeout(timer);
  }, [direction, fitView, focusServiceId]);

  // Selected node details
  const selectedNode = useMemo(
    () => (selectedNodeId ? rawNodes.find((n) => n.id === selectedNodeId) || null : null),
    [rawNodes, selectedNodeId]
  );

  // Outbound dependencies from selected file
  const selectedOutbound = useMemo(
    () => (selectedNodeId ? rawEdges.filter((e) => e.source_file === selectedNodeId) : []),
    [rawEdges, selectedNodeId]
  );

  // Inbound dependents to selected file
  const selectedInbound = useMemo(
    () => (selectedNodeId ? rawEdges.filter((e) => e.target_file === selectedNodeId) : []),
    [rawEdges, selectedNodeId]
  );

  const handleCopyPath = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="flex-1 flex h-full w-full relative overflow-hidden bg-[#f8fafc]">
      {/* Top Filter & Controls Toolbar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        {/* Left Toolbar Controls */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs pointer-events-auto">
          {/* Node Scope Filter */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setNodeTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                nodeTypeFilter === 'ALL'
                  ? 'bg-white text-violet-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({rawNodes.length})
            </button>
            <button
              onClick={() => setNodeTypeFilter('files')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                nodeTypeFilter === 'files'
                  ? 'bg-white text-violet-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setNodeTypeFilter('modules')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                nodeTypeFilter === 'modules'
                  ? 'bg-white text-violet-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Modules
            </button>
          </div>

          <div className="w-px h-4 bg-slate-200" />

          {/* Relationship Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={relTypeFilter}
              onChange={(e) => setRelTypeFilter(e.target.value as any)}
              className="text-xs bg-transparent border-0 font-medium text-slate-700 focus:ring-0 cursor-pointer pr-4 py-1"
            >
              <option value="ALL">All Relations ({rawEdges.length})</option>
              <option value="IMPORTS">Imports Only</option>
              <option value="CALLS">API / HTTP Calls</option>
              <option value="DEPENDS_ON">Dependencies</option>
              <option value="USES">Database / Uses</option>
            </select>
          </div>

          <div className="w-px h-4 bg-slate-200" />

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search files or modules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-7 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white w-44 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right Toolbar Controls: Layout & Focus Banner */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {focusServiceId && (
            <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-xl text-xs text-violet-800 shadow-xs">
              <span className="font-semibold">Service: {focusServiceId}</span>
              <button
                onClick={onClearFocusService}
                className="ml-1 text-violet-500 hover:text-violet-800 font-bold cursor-pointer"
                title="Clear service filter"
              >
                ✕
              </button>
            </div>
          )}

          {/* Graph Level Switcher: Architecture vs Codebase */}
          {onChangeGraphMode && (
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => onChangeGraphMode('architecture')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Architecture</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 text-slate-700">
                  {architecture.entities.length}
                </span>
              </button>
              <button
                onClick={() => onChangeGraphMode('codebase')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-violet-700 shadow-xs cursor-pointer"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Codebase</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-violet-50 text-violet-700">
                  {rawEdges.length} deps
                </span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setDirection((d) => (d === 'LR' ? 'TB' : 'LR'))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={`Layout: ${direction === 'LR' ? 'Horizontal (Left-Right)' : 'Vertical (Top-Bottom)'}`}
            >
              {direction === 'LR' ? (
                <ArrowRightLeft className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownUp className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => fitView({ padding: 0.2, duration: 400 })}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Fit View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setSelectedNodeId(null);
                setSearchTerm('');
                setNodeTypeFilter('ALL');
                setRelTypeFilter('ALL');
                fitView({ padding: 0.2, duration: 400 });
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Reset Filters & View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main React Flow Graph Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
        minZoom={0.15}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
        <Controls
          showInteractive={false}
          className="!bg-white !border !border-slate-200 !shadow-xs !rounded-xl overflow-hidden"
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => (n.type === 'codebaseFile' ? '#818cf8' : '#c084fc')}
          maskColor="rgba(241, 245, 249, 0.7)"
          className="!border !border-slate-200 !rounded-xl !bg-white/90 !shadow-xs"
        />
      </ReactFlow>

      {/* Bottom Summary Pill */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600 shadow-xs">
        <span className="font-semibold text-slate-800">{filteredNodes.length}</span> nodes visible
        <span className="text-slate-300">•</span>
        <span className="font-semibold text-slate-800">{filteredEdges.length}</span> dependencies
        {architecture.inventory?.languages && Object.keys(architecture.inventory.languages).length > 0 && (
          <>
            <span className="text-slate-300">•</span>
            <span>{Object.keys(architecture.inventory.languages).slice(0, 4).join(', ')}</span>
          </>
        )}
      </div>

      {/* File / Module Inspection Drawer */}
      {selectedNode && (
        <div className="absolute top-0 right-0 bottom-0 w-[400px] bg-white border-l border-slate-200 shadow-xl z-30 flex flex-col animate-slideLeft">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
            <div className="truncate pr-2">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    selectedNode.type === 'file'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-violet-50 text-violet-700 border border-violet-200'
                  }`}
                >
                  {selectedNode.type}
                </span>
                {selectedNode.language && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                    {selectedNode.language}
                  </span>
                )}
              </div>
              <h2 className="font-bold text-sm text-slate-900 truncate" title={selectedNode.name}>
                {selectedNode.name}
              </h2>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
            {/* Path and copy */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Repository Path</span>
                <button
                  onClick={() => handleCopyPath(selectedNode.path)}
                  className="flex items-center gap-1 text-violet-600 hover:text-violet-800 cursor-pointer font-medium"
                >
                  {copiedSnippet ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-800 break-all bg-white p-2 rounded border border-slate-100">
                {selectedNode.path}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Lines</div>
                <div className="font-bold text-slate-800 text-sm">{selectedNode.lines_count || 0}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Inbound (Called by)</div>
                <div className="font-bold text-indigo-700 text-sm">
                  {inDegreeMap.get(selectedNode.id) || 0}
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                <div className="text-[10px] text-slate-500">Outbound (Imports)</div>
                <div className="font-bold text-violet-700 text-sm">
                  {outDegreeMap.get(selectedNode.id) || 0}
                </div>
              </div>
            </div>

            {/* Associated Service Link */}
            {selectedNode.service_id && (
              <div className="p-3 bg-violet-50/60 rounded-xl border border-violet-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-violet-700 font-semibold uppercase tracking-wider">
                    Enclosing Architecture Service
                  </div>
                  <div className="font-bold text-xs text-slate-900 mt-0.5">
                    {selectedNode.service_id}
                  </div>
                </div>
                {onSelectComponentInArchitecture && onSwitchToArchitecture && (
                  <button
                    onClick={() => {
                      onSelectComponentInArchitecture(selectedNode.service_id!);
                      onSwitchToArchitecture();
                    }}
                    className="flex items-center gap-1 text-[11px] bg-white border border-violet-200 text-violet-700 font-medium px-2 py-1 rounded-lg hover:bg-violet-50 cursor-pointer shadow-xs transition-colors"
                  >
                    <span>View Service</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Outbound Imports */}
            <div>
              <h3 className="font-bold text-slate-900 text-xs mb-2 flex items-center justify-between">
                <span>Dependencies & Imports</span>
                <span className="text-slate-400 font-normal">({selectedOutbound.length})</span>
              </h3>
              {selectedOutbound.length === 0 ? (
                <div className="p-3 text-slate-400 text-center bg-slate-50 rounded-xl border border-slate-100">
                  No outgoing imports detected in this file.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedOutbound.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => setSelectedNodeId(dep.target_file)}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className="px-1.5 py-0.2 text-[9px] font-semibold rounded uppercase tracking-wider"
                          style={{
                            color: getEdgeColor(dep.type),
                            backgroundColor: `${getEdgeColor(dep.type)}15`,
                          }}
                        >
                          {dep.type}
                        </span>
                        {dep.line && (
                          <span className="text-[10px] font-mono text-slate-400">
                            line {dep.line}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-800 truncate group-hover:text-violet-700 text-[11px]">
                        {dep.target_file.split('/').pop()}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">
                        {dep.target_file}
                      </div>
                      {dep.snippet && (
                        <div className="mt-1.5 p-1.5 bg-white rounded border border-slate-200/80 font-mono text-[10px] text-slate-700 truncate">
                          {dep.snippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inbound Callers */}
            <div>
              <h3 className="font-bold text-slate-900 text-xs mb-2 flex items-center justify-between">
                <span>Imported By / Dependents</span>
                <span className="text-slate-400 font-normal">({selectedInbound.length})</span>
              </h3>
              {selectedInbound.length === 0 ? (
                <div className="p-3 text-slate-400 text-center bg-slate-50 rounded-xl border border-slate-100">
                  No files import this file directly.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedInbound.map((dep) => (
                    <div
                      key={dep.id}
                      onClick={() => setSelectedNodeId(dep.source_file)}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className="px-1.5 py-0.2 text-[9px] font-semibold rounded uppercase tracking-wider"
                          style={{
                            color: getEdgeColor(dep.type),
                            backgroundColor: `${getEdgeColor(dep.type)}15`,
                          }}
                        >
                          {dep.type}
                        </span>
                        {dep.line && (
                          <span className="text-[10px] font-mono text-slate-400">
                            line {dep.line}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-slate-800 truncate group-hover:text-indigo-700 text-[11px]">
                        {dep.source_file.split('/').pop()}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">
                        {dep.source_file}
                      </div>
                      {dep.snippet && (
                        <div className="mt-1.5 p-1.5 bg-white rounded border border-slate-200/80 font-mono text-[10px] text-slate-700 truncate">
                          {dep.snippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CodebaseGraph: React.FC<CodebaseGraphProps> = (props) => (
  <ReactFlowProvider>
    <CodebaseGraphCanvasInner {...props} />
  </ReactFlowProvider>
);
