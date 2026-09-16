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
import {
  Search,
  RotateCcw,
  ArrowRightLeft,
  ArrowDownUp,
  Filter,
  Info,
  Maximize2,
  AlertCircle,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  RelationshipType,
  DiffNodeItem,
  DiffRelationshipItem,
} from '../../types/architecture';
import {
  computeBaseGraphLayout,
  decorateGraphVisuals,
} from '../../engine/graphLayout';
import { ServiceNode } from './nodes/ServiceNode';
import { DatabaseNode } from './nodes/DatabaseNode';
import { ApiNode } from './nodes/ApiNode';
import { ModuleNode, LibraryNode, ExternalNode } from './nodes/OtherNodes';
import { TypedEdge } from './edges/TypedEdge';

interface ArchitectureGraphProps {
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  extractedAt?: string;
  isLimitedArchitecture?: boolean;
  limitedArchitectureReason?: string;
  diffMode?: boolean;
  diffNodesMap?: Map<string, DiffNodeItem>;
  diffEdgesMap?: Map<string, DiffRelationshipItem>;
  selectedEdgeId?: string | null;
  onSelectEdge?: (edgeId: string | null) => void;
}

const nodeTypes = {
  serviceNode: ServiceNode,
  databaseNode: DatabaseNode,
  apiNode: ApiNode,
  moduleNode: ModuleNode,
  libraryNode: LibraryNode,
  externalNode: ExternalNode,
};

const edgeTypes = {
  typedEdge: TypedEdge,
};

const ENTITY_FILTER_OPTIONS: Array<{ label: string; value: EntityType | 'ALL' }> = [
  { label: 'All Entities', value: 'ALL' },
  { label: 'Applications', value: 'Application' },
  { label: 'Services', value: 'Service' },
  { label: 'Databases', value: 'Database' },
  { label: 'APIs', value: 'API' },
  { label: 'Modules', value: 'Module' },
  { label: 'Libraries', value: 'Library' },
  { label: 'External', value: 'External System' },
];

const RELATIONSHIP_FILTER_OPTIONS: Array<{ label: string; value: RelationshipType | 'ALL' }> = [
  { label: 'All Links', value: 'ALL' },
  { label: 'CALLS', value: 'CALLS' },
  { label: 'USES', value: 'USES' },
  { label: 'DEPENDS_ON', value: 'DEPENDS_ON' },
  { label: 'CONNECTS_TO', value: 'CONNECTS_TO' },
  { label: 'IMPORTS', value: 'IMPORTS' },
  { label: 'QUERIES', value: 'QUERIES' },
  { label: 'LOADS', value: 'LOADS' },
  { label: 'EXPOSES', value: 'EXPOSES' },
];

const GraphCanvasInner: React.FC<ArchitectureGraphProps> = ({
  entities,
  relationships,
  selectedEntityId,
  onSelectEntity,
  extractedAt,
  isLimitedArchitecture,
  limitedArchitectureReason,
  diffMode = false,
  diffNodesMap,
  diffEdgesMap,
  selectedEdgeId: externalSelectedEdgeId,
  onSelectEdge,
}) => {
  const { fitView, setCenter } = useReactFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSelectedEdgeId, setInternalSelectedEdgeId] = useState<string | null>(null);
  const selectedEdgeId = externalSelectedEdgeId !== undefined ? externalSelectedEdgeId : internalSelectedEdgeId;

  const [selectedTypeFilter, setSelectedTypeFilter] = useState<EntityType | 'ALL'>('ALL');
  const [selectedRelFilter, setSelectedRelFilter] = useState<RelationshipType | 'ALL'>('ALL');
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR');
  const [showLegend, setShowLegend] = useState(true);

  // Track layout key to run fitView ONLY when data is loaded/reconstructed or direction changes
  const prevLayoutKeyRef = useRef<string>('');

  // 1. BASE TOPOLOGICAL LAYOUT: Computes (x, y) coordinates with generous rank/node spacing
  const baseLayout = useMemo(() => {
    return computeBaseGraphLayout(entities, relationships, direction);
  }, [entities, relationships, direction]);

  // 2. VISUAL DECORATION: Reuses base positions, strictly applies visual highlights/dimming
  const visualGraph = useMemo(() => {
    return decorateGraphVisuals(baseLayout, {
      selectedNodeId: selectedEntityId,
      selectedEdgeId,
      selectedTypeFilter,
      selectedRelFilter,
      searchTerm,
      diffMode,
      diffNodesMap,
      diffEdgesMap,
    });
  }, [
    baseLayout,
    selectedEntityId,
    selectedEdgeId,
    selectedTypeFilter,
    selectedRelFilter,
    searchTerm,
    diffMode,
    diffNodesMap,
    diffEdgesMap,
  ]);

  const [, , onNodesChange] = useNodesState(visualGraph.nodes);
  const [, , onEdgesChange] = useEdgesState(visualGraph.edges);

  // 3. FIT VIEW: Triggered once after data ingestion/reconstruction or orientation change
  useEffect(() => {
    const layoutKey = `${entities.length}-${relationships.length}-${direction}-${extractedAt || ''}`;
    if (prevLayoutKeyRef.current !== layoutKey) {
      prevLayoutKeyRef.current = layoutKey;
      const timeout = setTimeout(() => {
        fitView({ padding: 0.08, duration: 450 });
      }, 80);
      return () => clearTimeout(timeout);
    }
  }, [entities.length, relationships.length, direction, extractedAt, fitView]);

  // 4. SEARCH: Smoothly centers matching node without moving or collapsing graph
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
          const w = (targetNode.width as number) || 260;
          const h = (targetNode.height as number) || 105;
          setCenter(targetNode.position.x + w / 2, targetNode.position.y + h / 2, {
            zoom: 1.05,
            duration: 500,
          });
          onSelectEntity(match.id);
          if (onSelectEdge) onSelectEdge(null);
          else setInternalSelectedEdgeId(null);
        }
      }
    }
  };

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectEntity(node.id);
      if (onSelectEdge) {
        onSelectEdge(null);
      } else {
        setInternalSelectedEdgeId(null);
      }
    },
    [onSelectEntity, onSelectEdge]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (onSelectEdge) {
        onSelectEdge(edge.id);
      } else {
        setInternalSelectedEdgeId(edge.id);
      }
      onSelectEntity(null);
    },
    [onSelectEntity, onSelectEdge]
  );

  const handlePaneClick = useCallback(() => {
    onSelectEntity(null);
    if (onSelectEdge) {
      onSelectEdge(null);
    } else {
      setInternalSelectedEdgeId(null);
    }
  }, [onSelectEntity, onSelectEdge]);

  const handleResetView = () => {
    setSearchTerm('');
    setSelectedTypeFilter('ALL');
    setSelectedRelFilter('ALL');
    onSelectEntity(null);
    if (onSelectEdge) {
      onSelectEdge(null);
    } else {
      setInternalSelectedEdgeId(null);
    }
    fitView({ padding: 0.08, duration: 450 });
  };

  const handleManualFitView = () => {
    fitView({ padding: 0.08, duration: 450 });
  };

  return (
    <div className="relative flex-1 h-full w-full bg-slate-50 flex flex-col overflow-hidden">
      {/* Top Search & Filter Bar */}
      <div className="bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-10 shadow-2xs">
        {/* Search input */}
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search component, API, or tech..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Filter Badges: Entity Types */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3" /> Type:
          </span>
          {ENTITY_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedTypeFilter(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedTypeFilter === opt.value
                  ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter Badges: Relationship Types */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            Link:
          </span>
          {RELATIONSHIP_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedRelFilter(opt.value)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                selectedRelFilter === opt.value
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Layout controls & Reset */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setDirection((prev) => (prev === 'LR' ? 'TB' : 'LR'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title={`Toggle Layout: Currently ${direction === 'LR' ? 'Horizontal (LR)' : 'Vertical (TB)'}`}
          >
            {direction === 'LR' ? (
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <ArrowDownUp className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span className="hidden md:inline">{direction === 'LR' ? 'Horizontal' : 'Vertical'}</span>
          </button>

          <button
            onClick={handleManualFitView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Fit graph comfortably inside viewport"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden md:inline">Fit View</span>
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

      {/* Main Canvas Area */}
      <div className="flex-1 relative w-full h-full">
        {/* Limited Architecture Detected Banner */}
        {isLimitedArchitecture && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50/95 border border-amber-300 text-amber-900 rounded-xl px-4 py-2.5 shadow-md flex items-center gap-2.5 text-xs max-w-xl backdrop-blur-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold mr-1.5">Limited Architecture Detected:</span>
              <span className="text-amber-800">{limitedArchitectureReason || 'Single-file or minimal component boundaries.'}</span>
            </div>
          </div>
        )}

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
          fitViewOptions={{ padding: 0.08, duration: 450 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#cbd5e1" />
          <Controls
            position="bottom-left"
            className="!bg-white !border !border-slate-200 !shadow-sm !rounded-lg overflow-hidden"
            showInteractive={false}
          />
          {/* MiniMap: Compact, unobtrusive (155px x 112px) */}
          <MiniMap
            position="bottom-right"
            style={{ width: 155, height: 112 }}
            className="!bg-slate-900 !border-2 !border-slate-700 !rounded-xl !shadow-lg overflow-hidden !m-3 hidden sm:block"
            nodeColor={(node: any) => {
              const entity = node.data?.entity;
              const isDimmed = node.data?.isDimmed;
              if (isDimmed) return '#64748b';
              switch (entity?.type || node.type) {
                case 'Service':
                case 'serviceNode':
                  return '#3b82f6';
                case 'Database':
                case 'databaseNode':
                  return '#10b981';
                case 'API':
                case 'apiNode':
                  return '#14b8a6';
                case 'Module':
                case 'moduleNode':
                  return '#8b5cf6';
                case 'Library':
                case 'libraryNode':
                  return '#06b6d4';
                case 'External System':
                case 'externalNode':
                  return '#f59e0b';
                default:
                  return '#94a3b8';
              }
            }}
            nodeStrokeColor="#0f172a"
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(15, 23, 42, 0.7)"
            maskStrokeColor="#3b82f6"
            zoomable
            pannable
          />
        </ReactFlow>

        {/* Interactive Legend overlay */}
        {showLegend && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-3 shadow-md text-xs text-slate-700 z-10 max-w-[260px] transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
              <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                Graph Legend
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className="text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
              >
                Hide
              </button>
            </div>

            {diffMode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                  <span className="text-[11px] font-bold text-emerald-800">+ Added (V2 introduced)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0"></span>
                  <span className="text-[11px] font-bold text-rose-800">- Removed (V1 decommissioned)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
                  <span className="text-[11px] text-slate-600">= Unchanged</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 italic">
                  Select any component or edge to inspect source provenance & diff details.
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                    <span className="text-[11px]">Service Component</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                    <span className="text-[11px]">Database / Datastore</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0"></span>
                    <span className="text-[11px]">API Route / Gateway</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span className="text-[11px]">External Third-Party</span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono text-blue-600 font-semibold">CALLS</span>
                    <span>Synchronous REST / gRPC</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono text-emerald-600 font-semibold">USES</span>
                    <span>Database / Cache Driver</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono text-purple-600 font-semibold">DEPENDS_ON</span>
                    <span>Docker / Module Import</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!showLegend && (
          <button
            onClick={() => setShowLegend(true)}
            className="absolute top-4 right-4 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs text-xs font-medium text-slate-600 hover:bg-slate-50 z-10 flex items-center gap-1.5 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Show Legend</span>
          </button>
        )}
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
