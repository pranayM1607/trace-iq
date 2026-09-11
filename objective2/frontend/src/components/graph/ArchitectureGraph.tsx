import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  RotateCcw,
  ArrowRightLeft,
  ArrowDownUp,
  Maximize2,
  ShieldAlert,
  Repeat,
  Layers,
  ChevronDown,
  X,
  Route,
  AlertTriangle,
  FolderTree,
  Network,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  RiskLevel,
  Objective2AnalysisResult,
} from '../../types/analysis';
import {
  computeBaseGraphLayout,
  decorateGraphVisuals,
} from '../../engine/graphLayout';
import { ServiceNode } from './nodes/ServiceNode';
import { DatabaseNode } from './nodes/DatabaseNode';
import { ApiNode } from './nodes/ApiNode';
import { ExternalNode } from './nodes/ExternalNode';
import { TypedRiskEdge } from './edges/TypedRiskEdge';

interface ArchitectureGraphProps {
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  analysis?: Objective2AnalysisResult | null;
  extractedAt?: string;
  highlightedPathNodes?: Set<string> | null;
  highlightedPathEdges?: Set<string> | null;
  onClearHighlightedPaths?: () => void;
  isLimitedArchitecture?: boolean;
  limitedArchitectureReason?: string | null;
  onSwitchToCodebase?: () => void;
  graphMode?: 'architecture' | 'codebase';
  onChangeGraphMode?: (mode: 'architecture' | 'codebase') => void;
  totalCodebaseDependencies?: number;
}

const nodeTypes = {
  serviceNode: ServiceNode,
  databaseNode: DatabaseNode,
  apiNode: ApiNode,
  externalNode: ExternalNode,
};

const edgeTypes = {
  typedRiskEdge: TypedRiskEdge,
};

const GraphCanvasInner: React.FC<ArchitectureGraphProps> = ({
  entities,
  relationships,
  selectedEntityId,
  onSelectEntity,
  analysis,
  extractedAt,
  highlightedPathNodes,
  highlightedPathEdges,
  onClearHighlightedPaths,
  isLimitedArchitecture,
  limitedArchitectureReason,
  onSwitchToCodebase,
  onChangeGraphMode,
  totalCodebaseDependencies,
}) => {
  const { fitView, setCenter } = useReactFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel | 'SPOF' | 'CYCLE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EntityType>('ALL');
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR');
  const [showLegend, setShowLegend] = useState(false);

  const selectedRel = useMemo(
    () => (selectedEdgeId ? relationships.find((r) => r.id === selectedEdgeId) : null),
    [relationships, selectedEdgeId]
  );
  const selectedDepRisk = useMemo(
    () =>
      selectedEdgeId
        ? analysis?.high_risk_dependencies.find((d) => d.relationship_id === selectedEdgeId)
        : null,
    [analysis, selectedEdgeId]
  );

  const prevLayoutKeyRef = useRef<string>('');

  // 1. BASE TOPOLOGICAL POSITIONING: Computes coordinates once per orientation/dataset
  const baseLayout = useMemo(() => {
    return computeBaseGraphLayout(entities, relationships, direction);
  }, [entities, relationships, direction]);

  // 2. VISUAL DECORATION: Highlighting & opacity without spatial shifts
  const visualGraph = useMemo(() => {
    return decorateGraphVisuals(baseLayout, {
      selectedNodeId: selectedEntityId,
      selectedEdgeId,
      riskFilter,
      typeFilter,
      searchTerm,
      analysis,
      highlightedPathNodes,
      highlightedPathEdges,
    });
  }, [
    baseLayout,
    selectedEntityId,
    selectedEdgeId,
    riskFilter,
    typeFilter,
    searchTerm,
    analysis,
    highlightedPathNodes,
    highlightedPathEdges,
  ]);

  const [, , onNodesChange] = useNodesState(visualGraph.nodes);
  const [, , onEdgesChange] = useEdgesState(visualGraph.edges);

  // 3. FIT VIEW: Triggered once after data ingestion or direction toggle
  useEffect(() => {
    const layoutKey = `${entities.length}-${relationships.length}-${direction}-${extractedAt || ''}`;
    if (prevLayoutKeyRef.current !== layoutKey) {
      prevLayoutKeyRef.current = layoutKey;
      const timeout = setTimeout(() => {
        fitView({ padding: 0.12, duration: 400 });
      }, 60);
      return () => clearTimeout(timeout);
    }
  }, [entities.length, relationships.length, direction, extractedAt, fitView]);

  // 4. SEARCH: Center matching node smoothly
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.trim()) {
      const clean = term.toLowerCase().trim();
      const match = entities.find(
        (ent) =>
          ent.name.toLowerCase().includes(clean) ||
          ent.technology.toLowerCase().includes(clean) ||
          ent.id.toLowerCase().includes(clean)
      );

      if (match) {
        const targetNode = visualGraph.nodes.find((n) => n.id === match.id);
        if (targetNode) {
          const w = (targetNode.width as number) || 220;
          const h = (targetNode.height as number) || 76;
          setCenter(targetNode.position.x + w / 2, targetNode.position.y + h / 2, {
            zoom: 1.1,
            duration: 400,
          });
          onSelectEntity(match.id);
          setSelectedEdgeId(null);
        }
      }
    }
  };

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectEntity(node.id);
      setSelectedEdgeId(null);
    },
    [onSelectEntity]
  );

  useEffect(() => {
    const handleEdgeSelectEvent = (e: any) => {
      if (e.detail?.edgeId) {
        setSelectedEdgeId(e.detail.edgeId);
        onSelectEntity(null);
      }
    };
    window.addEventListener('traceiq-edge-select', handleEdgeSelectEvent);
    return () => window.removeEventListener('traceiq-edge-select', handleEdgeSelectEvent);
  }, [onSelectEntity]);

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
      onSelectEntity(null);
    },
    [onSelectEntity]
  );

  const handlePaneClick = useCallback(() => {
    onSelectEntity(null);
    setSelectedEdgeId(null);
  }, [onSelectEntity]);

  const handleResetView = () => {
    setSearchTerm('');
    setRiskFilter('ALL');
    setTypeFilter('ALL');
    onSelectEntity(null);
    setSelectedEdgeId(null);
    fitView({ padding: 0.12, duration: 400 });
  };

  const handleManualFitView = () => {
    fitView({ padding: 0.12, duration: 400 });
  };

  // Compute status bar summary metrics
  const highRiskCount = analysis
    ? analysis.critical_components.filter(
        (c) => c.criticality_tier === 'CRITICAL' || c.criticality_tier === 'HIGH'
      ).length
    : 0;
  const spofCount = analysis ? analysis.spofs.filter((s) => s.is_spof).length : 0;
  const cyclesCount = analysis?.complexity?.cycles_count || 0;

  return (
    <div className="relative flex-1 h-full w-full bg-[#f8fafc] flex flex-col overflow-hidden font-sans">
      {/* Sleek Sub-Header Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 z-10 shadow-2xs">
        {/* Search input */}
        <div className="relative w-64 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search architecture..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 focus:bg-white transition-all font-sans"
          />
        </div>

        {/* Filters Group (Category + Risk) */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Type Filters */}
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              typeFilter === 'ALL'
                ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('Service')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              typeFilter === 'Service'
                ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setTypeFilter('Database')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              typeFilter === 'Database'
                ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Databases
          </button>
          <button
            onClick={() => setTypeFilter('External System')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              typeFilter === 'External System'
                ? 'bg-violet-600 text-white font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            External
          </button>

          <span className="w-px h-4 bg-slate-200 mx-1" />

          {/* Risk Filters */}
          <button
            onClick={() => setRiskFilter('HIGH')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              riskFilter === 'HIGH'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => setRiskFilter('SPOF')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              riskFilter === 'SPOF'
                ? 'bg-rose-100 text-rose-900 border border-rose-300 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            SPOFs
          </button>
        </div>

        {/* View Controls & Graph Level Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {onChangeGraphMode && (
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => onChangeGraphMode('architecture')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-violet-700 shadow-xs cursor-pointer"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Architecture</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-violet-50 text-violet-700">
                  {entities.length}
                </span>
              </button>
              <button
                onClick={() => onChangeGraphMode('codebase')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Codebase</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 text-slate-700">
                  {totalCodebaseDependencies ?? 0} deps
                </span>
              </button>
            </div>
          )}

          <button
            onClick={() => setDirection((prev) => (prev === 'LR' ? 'TB' : 'LR'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title={`Toggle Orientation: Currently ${direction === 'LR' ? 'Horizontal' : 'Vertical'}`}
          >
            {direction === 'LR' ? (
              <ArrowRightLeft className="w-3.5 h-3.5 text-violet-600" />
            ) : (
              <ArrowDownUp className="w-3.5 h-3.5 text-violet-600" />
            )}
            <span className="hidden md:inline">{direction === 'LR' ? 'Horizontal' : 'Vertical'}</span>
          </button>

          <button
            onClick={handleManualFitView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Fit graph inside viewport"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Fit</span>
          </button>

          <button
            onClick={handleResetView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Reset Filters and View"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* React Flow Canvas (Hero Element) */}
      <div className="flex-1 relative w-full h-full">
        <ReactFlow
          nodes={visualGraph.nodes}
          edges={visualGraph.edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, duration: 400 }}
          minZoom={0.2}
          maxZoom={2.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
          <Controls
            position="bottom-left"
            className="!bg-white !border !border-slate-200 !text-slate-700 !shadow-md !rounded-lg overflow-hidden"
            showInteractive={false}
          />

          {/* MiniMap */}
          <MiniMap
            position="bottom-right"
            style={{ width: 140, height: 100 }}
            className="!bg-white !border !border-slate-200 !rounded-xl !shadow-lg overflow-hidden !m-3 hidden sm:block"
            nodeColor={(node: any) => {
              const critTier = node.data?.critTier;
              const isSpof = node.data?.isSpof;
              if (isSpof || critTier === 'CRITICAL') return '#f43f5e';
              if (critTier === 'HIGH') return '#f59e0b';
              switch (node.type) {
                case 'serviceNode':
                  return '#8b5cf6';
                case 'databaseNode':
                  return '#10b981';
                case 'apiNode':
                  return '#14b8a6';
                case 'externalNode':
                  return '#f59e0b';
                default:
                  return '#64748b';
              }
            }}
            nodeStrokeColor="#ffffff"
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(248, 250, 252, 0.75)"
            maskStrokeColor="#7c3aed"
            zoomable
            pannable
          />
        </ReactFlow>

        {/* Floating Bottom Status Pill (Section 5 Spec) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-full px-5 py-2 shadow-lg z-10 flex items-center gap-4 text-xs font-medium text-slate-700 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">{entities.length}</span>
            <span className="text-slate-500">Components</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">{relationships.length}</span>
            <span className="text-slate-500">Dependencies</span>
          </div>

          {analysis && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-amber-600">{highRiskCount}</span>
                <span className="text-slate-500">High-Risk</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-rose-600">{spofCount}</span>
                <span className="text-slate-500">SPOFs</span>
              </div>
              {cyclesCount > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-purple-600">{cyclesCount}</span>
                    <span className="text-slate-500">Cycle</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Floating Limited Architecture Notification Banner */}
        {isLimitedArchitecture && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-lg bg-amber-50/95 backdrop-blur-md border border-amber-300 px-4 py-2 rounded-xl shadow-md flex items-center justify-between gap-3 text-xs text-amber-900 animate-fadeIn pointer-events-auto">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0 text-left">
                <span className="font-semibold text-amber-950 block text-[11px]">Limited Architecture Detected</span>
                <span className="text-[10px] text-amber-800 truncate block">
                  {limitedArchitectureReason || 'Service-level boundaries could not be confidently inferred.'}
                </span>
              </div>
            </div>
            {onSwitchToCodebase && (
              <button
                onClick={onSwitchToCodebase}
                className="px-2.5 py-1 text-[10px] font-semibold bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-md shrink-0 transition-colors cursor-pointer"
              >
                View Codebase
              </button>
            )}
          </div>
        )}

        {/* Floating SPOF Path Highlighting Banner */}
        {highlightedPathNodes && highlightedPathNodes.size > 0 && (
          <div className={`absolute ${isLimitedArchitecture ? 'top-16' : 'top-3'} left-1/2 -translate-x-1/2 z-20 bg-rose-50/95 backdrop-blur-md border border-rose-300 px-4 py-1.5 rounded-full shadow-md flex items-center gap-2.5 text-xs text-rose-900 animate-fadeIn`}>
            <Route className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-semibold text-[11px]">
              Highlighting SPOF Severed Paths ({highlightedPathNodes.size} components)
            </span>
            {onClearHighlightedPaths && (
              <button
                onClick={onClearHighlightedPaths}
                className="ml-1 text-[10px] font-bold uppercase tracking-wider bg-rose-200/80 hover:bg-rose-300 text-rose-900 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Floating Edge / High-Risk Dependency Detail Card */}
        {selectedRel && (
          <div className="absolute top-16 right-4 z-20 w-80 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3.5 shadow-xl animate-fadeIn text-xs font-sans">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                  Dependency Inspection
                </span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 mt-0.5 text-xs">
                  <span className="truncate max-w-[110px]">{selectedRel.source}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-violet-700 truncate max-w-[110px]">{selectedRel.target}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEdgeId(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                title="Close edge inspection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Risk Assessment</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                    selectedDepRisk?.risk_level === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : selectedDepRisk?.risk_level === 'HIGH'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {selectedDepRisk?.risk_level || 'LOW RISK'}
                </span>
              </div>

              <div className="text-[11px] flex items-center justify-between">
                <span className="text-slate-500">Protocol / Type</span>
                <span className="font-mono text-slate-700 font-medium">
                  {selectedRel.type} {selectedRel.protocol ? `(${selectedRel.protocol})` : ''}
                </span>
              </div>

              {selectedDepRisk && selectedDepRisk.risk_factors.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Risk Factors:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700">
                    {selectedDepRisk.risk_factors.map((f: string, idx: number) => (
                      <li key={idx} className="leading-tight">{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedDepRisk?.propagation_path && selectedDepRisk.propagation_path.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Failure Propagation Path:</span>
                  <div className="p-1 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700 flex items-center gap-1 overflow-x-auto">
                    {selectedDepRisk.propagation_path.map((step: string, sIdx: number) => (
                      <React.Fragment key={sIdx}>
                        <span className={step === selectedRel.target ? 'font-bold text-violet-800' : 'text-slate-600'}>
                          {step}
                        </span>
                        {sIdx < selectedDepRisk.propagation_path!.length - 1 && <span className="text-slate-400">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Legend Toggle */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setShowLegend((prev) => !prev)}
            className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-violet-600" />
            <span>Legend</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showLegend ? 'rotate-180' : ''}`} />
          </button>

          {showLegend && (
            <div className="mt-1.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3 shadow-xl text-xs text-slate-700 w-52 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-2xs" />
                <span className="text-[11px] text-rose-700 font-medium">Critical / SPOF</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs" />
                <span className="text-[11px] text-amber-700 font-medium">High Risk Component</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                <span className="text-[11px] text-slate-700">Core Service</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-slate-700">Database / Cache</span>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-rose-700 font-medium">
                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                  <span>Single Point of Failure</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-purple-700 font-medium">
                  <Repeat className="w-3 h-3 text-purple-600" />
                  <span>Circular Dependency</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ArchitectureGraph: React.FC<ArchitectureGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
