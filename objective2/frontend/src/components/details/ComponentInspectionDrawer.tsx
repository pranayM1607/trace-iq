import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  Repeat,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  HelpCircle,
  Route,
  FileCode,
  Folder,
  Code2,
  FileSearch,
  FolderTree,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  Objective2AnalysisResult,
} from '../../types/analysis';

interface ComponentInspectionDrawerProps {
  entity: ArchitectureEntity | null;
  relationships: ArchitectureRelationship[];
  analysis: Objective2AnalysisResult | null;
  onClose: () => void;
  onSelectComponent: (componentId: string) => void;
  onHighlightPaths?: (paths: string[][]) => void;
  onClearHighlightPaths?: () => void;
  isPathHighlighted?: boolean;
  onViewInCodebaseGraph?: (entityId: string) => void;
}

type MetricKey = 'in_degree' | 'out_degree' | 'betweenness' | 'pagerank' | null;

export const ComponentInspectionDrawer: React.FC<ComponentInspectionDrawerProps> = ({
  entity,
  relationships,
  analysis,
  onClose,
  onSelectComponent,
  onHighlightPaths,
  onClearHighlightPaths,
  isPathHighlighted = false,
  onViewInCodebaseGraph,
}) => {
  const [isWhyExpanded, setIsWhyExpanded] = useState(false);
  const [activeMetricDetail, setActiveMetricDetail] = useState<MetricKey>(null);
  const [showBlastComponents, setShowBlastComponents] = useState(false);
  const [showAllAssociatedFiles, setShowAllAssociatedFiles] = useState(false);

  if (!entity) return null;

  const metrics = analysis?.component_metrics[entity.id];
  const crit = analysis?.critical_components.find((c) => c.component_id === entity.id);
  const spof = analysis?.spofs.find((s) => s.component_id === entity.id);
  const compRisk = analysis?.component_risks[entity.id];

  // Incoming and Outgoing relationships from active architecture
  const incomingRels = relationships.filter((r) => r.target === entity.id);
  const outgoingRels = relationships.filter((r) => r.source === entity.id);

  // Distinct caller and callee components for semantic consistency
  const distinctCallerIds = Array.from(
    new Set(metrics?.direct_callers && metrics.direct_callers.length > 0
      ? metrics.direct_callers
      : incomingRels.map((r) => r.source))
  );
  const distinctDependencyIds = Array.from(
    new Set(metrics?.direct_dependencies && metrics.direct_dependencies.length > 0
      ? metrics.direct_dependencies
      : outgoingRels.map((r) => r.target))
  );

  const isSpof = spof?.is_spof || false;
  const isInCycle = compRisk?.is_in_cycle || false;
  const critTier = crit?.criticality_tier || 'LOW';

  const isCritical = critTier === 'CRITICAL';
  const isHigh = critTier === 'HIGH';

  const inDegreeVal = metrics?.in_degree ?? distinctCallerIds.length;
  const outDegreeVal = metrics?.out_degree ?? distinctDependencyIds.length;
  const betweennessVal = metrics?.betweenness_centrality ?? 0;
  const pagerankVal = metrics?.pagerank ?? 0;

  // Breakdown for blast radius
  const totalBlastCount = metrics?.upstream_callers_count ?? distinctCallerIds.length;
  const directCallerCount = distinctCallerIds.length;
  const transitiveCallerCount = Math.max(0, totalBlastCount - directCallerCount);

  const toggleMetricDetail = (key: MetricKey) => {
    setActiveMetricDetail((prev) => (prev === key ? null : key));
  };

  const handleToggleHighlight = () => {
    if (isPathHighlighted) {
      onClearHighlightPaths?.();
    } else if (spof?.severed_paths && spof.severed_paths.length > 0) {
      onHighlightPaths?.(spof.severed_paths);
    } else if (spof) {
      // Fallback: build synthetic path segments from callers to entity to severed
      const fallbackPaths: string[][] = [];
      distinctCallerIds.forEach((c) => {
        fallbackPaths.push([c, entity.id]);
      });
      spof.severed_components.forEach((s) => {
        fallbackPaths.push([entity.id, s]);
      });
      onHighlightPaths?.(fallbackPaths.length > 0 ? fallbackPaths : [[entity.id]]);
    }
  };

  return (
    <div className="w-84 sm:w-96 h-full bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20 overflow-hidden font-sans">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/90 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                isCritical
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : isHigh
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'
              }`}
            >
              {critTier === 'CRITICAL' ? 'CRITICAL RISK' : critTier === 'HIGH' ? 'HIGH RISK' : 'NORMAL'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">{entity.type}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase truncate">
            {entity.name}
          </h3>
          <span className="text-[10px] text-slate-500 font-mono truncate block">
            {entity.technology}
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          title="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* SPOF / Cycle Highlight if present */}
        {isSpof && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-rose-900 text-xs block">
                    Single Point of Failure
                  </span>
                  <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 border border-rose-300 rounded text-[9px] font-mono uppercase font-bold">
                    {spof?.spof_type === 'SHARED_DATASTORE' ? 'Shared Datastore' : 'Transit Bottleneck'}
                  </span>
                </div>
                <p className="text-[11px] text-rose-800/90 leading-relaxed mt-1">
                  {spof?.explanation}
                </p>
              </div>
            </div>

            {/* SPOF Highlight Affected Paths Button */}
            {onHighlightPaths && (
              <button
                onClick={handleToggleHighlight}
                className={`mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                  isPathHighlighted
                    ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-300'
                    : 'bg-white hover:bg-rose-100/70 border border-rose-300 text-rose-800'
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                <span>
                  {isPathHighlighted ? 'Clear Path Highlight' : 'Highlight Affected Paths'}
                </span>
              </button>
            )}
          </div>
        )}

        {isInCycle && (
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-start gap-2.5">
            <Repeat className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-purple-900 text-xs block">
                Circular Dependency
              </span>
              <p className="text-[11px] text-purple-800/90 leading-relaxed mt-0.5">
                Participates in a cyclic dependency loop. Poses deadlock, retry storms, and initialization order risks.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1: STRUCTURAL METRICS (Progressive Disclosure) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Structural Metrics
            </span>
            <span className="text-[10px] text-slate-400">Click any metric for calculation</span>
          </div>

          {metrics ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {/* In-Degree */}
                <button
                  type="button"
                  onClick={() => toggleMetricDetail('in_degree')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex justify-between items-center ${
                    activeMetricDetail === 'in_degree'
                      ? 'bg-violet-50/80 border-violet-300 ring-1 ring-violet-400'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">In-degree</span>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans">Callers</span>
                  </div>
                  <strong className="text-slate-900 font-bold text-sm">{inDegreeVal}</strong>
                </button>

                {/* Out-Degree */}
                <button
                  type="button"
                  onClick={() => toggleMetricDetail('out_degree')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex justify-between items-center ${
                    activeMetricDetail === 'out_degree'
                      ? 'bg-violet-50/80 border-violet-300 ring-1 ring-violet-400'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">Out-degree</span>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans">Callees</span>
                  </div>
                  <strong className="text-slate-900 font-bold text-sm">{outDegreeVal}</strong>
                </button>

                {/* Betweenness Centrality */}
                <button
                  type="button"
                  onClick={() => toggleMetricDetail('betweenness')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex justify-between items-center ${
                    activeMetricDetail === 'betweenness'
                      ? 'bg-violet-50/80 border-violet-300 ring-1 ring-violet-400'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">Betweenness</span>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans">Bridge ratio</span>
                  </div>
                  <strong className="text-violet-700 font-bold text-sm">{betweennessVal.toFixed(3)}</strong>
                </button>

                {/* PageRank */}
                <button
                  type="button"
                  onClick={() => toggleMetricDetail('pagerank')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex justify-between items-center ${
                    activeMetricDetail === 'pagerank'
                      ? 'bg-violet-50/80 border-violet-300 ring-1 ring-violet-400'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600 text-[11px] font-sans font-medium">PageRank</span>
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans">Authority</span>
                  </div>
                  <strong className="text-teal-700 font-bold text-sm">{pagerankVal.toFixed(3)}</strong>
                </button>
              </div>

              {/* Expandable Explanation Panel based on clicked metric */}
              {activeMetricDetail === 'in_degree' && (
                <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200 text-xs text-slate-800 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between pb-1 border-b border-violet-200/60">
                    <span className="font-bold text-violet-900">In-degree Calculation</span>
                    <span className="font-mono text-[10px] text-violet-700">|Inbound Callers| = {inDegreeVal}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>Formula:</strong> <code className="text-violet-900 bg-white px-1 py-0.5 rounded border border-violet-200">deg⁻(v) = |{'{'}u ∈ V : (u, v) ∈ E{'}'}|</code>
                  </p>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase block mb-1">
                      Graph Evidence ({distinctCallerIds.length} Direct Callers):
                    </span>
                    {distinctCallerIds.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">Entry Point component (no upstream callers).</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {distinctCallerIds.map((cid) => (
                          <button
                            key={cid}
                            onClick={() => onSelectComponent(cid)}
                            className="px-1.5 py-0.5 rounded bg-white hover:bg-violet-100 border border-violet-200 text-violet-800 text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            {cid}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-violet-100">
                    <strong>Why it matters:</strong> Quantifies dependency concentration. When high, any outage or latency spike on this component cascades directly into all {inDegreeVal} callers.
                  </div>
                </div>
              )}

              {activeMetricDetail === 'out_degree' && (
                <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200 text-xs text-slate-800 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between pb-1 border-b border-violet-200/60">
                    <span className="font-bold text-violet-900">Out-degree Calculation</span>
                    <span className="font-mono text-[10px] text-violet-700">|Outbound Dependencies| = {outDegreeVal}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>Formula:</strong> <code className="text-violet-900 bg-white px-1 py-0.5 rounded border border-violet-200">deg⁺(v) = |{'{'}w ∈ V : (v, w) ∈ E{'}'}|</code>
                  </p>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase block mb-1">
                      Graph Evidence ({distinctDependencyIds.length} Direct Callees):
                    </span>
                    {distinctDependencyIds.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">Sink / leaf component (no outbound calls).</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {distinctDependencyIds.map((cid) => (
                          <button
                            key={cid}
                            onClick={() => onSelectComponent(cid)}
                            className="px-1.5 py-0.5 rounded bg-white hover:bg-teal-100 border border-teal-200 text-teal-800 text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            {cid}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-violet-100">
                    <strong>Why it matters:</strong> Indicates operational coupling. High out-degree means this component is vulnerable to transitive errors or latency from any of its downstream targets.
                  </div>
                </div>
              )}

              {activeMetricDetail === 'betweenness' && (
                <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200 text-xs text-slate-800 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between pb-1 border-b border-violet-200/60">
                    <span className="font-bold text-violet-900">Betweenness Centrality</span>
                    <span className="font-mono text-[10px] text-violet-700">{betweennessVal.toFixed(4)}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>Formula:</strong> <code className="text-violet-900 bg-white px-1 py-0.5 rounded border border-violet-200">g(v) = Σ (σ_st(v) / σ_st) / ((N-1)(N-2))</code>
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Measures the fraction of all topological shortest paths in the architecture that pass through this component.
                  </p>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase block mb-1">
                      Graph Evidence (Shortest Paths Transiting This Node):
                    </span>
                    {metrics.transitive_paths_through && metrics.transitive_paths_through.length > 0 ? (
                      <div className="space-y-1 font-mono text-[10px]">
                        {metrics.transitive_paths_through.map((p, pIdx) => (
                          <div key={pIdx} className="p-1 rounded bg-white border border-violet-200 flex items-center gap-1 overflow-x-auto">
                            {p.map((segment, sIdx) => (
                              <React.Fragment key={sIdx}>
                                <span className={segment === entity.id ? 'font-bold text-violet-900 bg-violet-100 px-1 rounded' : 'text-slate-600'}>
                                  {segment}
                                </span>
                                {sIdx < p.length - 1 && <span className="text-slate-400">→</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        {betweennessVal === 0 ? 'Peripheral node — no intermediate transit shortest paths.' : 'Direct edge connections only.'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-violet-100">
                    <strong>Why it matters:</strong> High betweenness identifies architectural bridges and brokers. Bottlenecks here choke inter-service communications across tiers.
                  </div>
                </div>
              )}

              {activeMetricDetail === 'pagerank' && (
                <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200 text-xs text-slate-800 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between pb-1 border-b border-violet-200/60">
                    <span className="font-bold text-violet-900">PageRank Authority</span>
                    <span className="font-mono text-[10px] text-violet-700">{pagerankVal.toFixed(4)}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>Formula:</strong> NetworkX directed PageRank (<code className="text-violet-900 bg-white px-1 py-0.5 rounded border border-violet-200">α = 0.85, ε = 10⁻⁶</code>).
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Recursively measures systemic importance based on the authority of calling nodes, rather than simple connection count.
                  </p>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase block mb-1">
                      Authority Contributors (Inbound Callers):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {distinctCallerIds.map((cid) => {
                        const callerRank = analysis.component_metrics[cid]?.pagerank ?? 0;
                        return (
                          <div
                            key={cid}
                            className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono flex items-center gap-1"
                          >
                            <span className="text-slate-800">{cid}</span>
                            <span className="text-teal-700 font-bold">({callerRank.toFixed(3)})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed pt-1 border-t border-violet-100">
                    <strong>Why it matters:</strong> A component called by high-tier gateways holds far greater structural authority than one called by leaf utility nodes.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 italic text-[11px]">Run analysis to calculate metrics.</p>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* SECTION 2: DEPENDENCY IMPACT (Semantic Consistency) */}
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Dependency Impact
          </span>

          {metrics ? (
            <div className="space-y-2">
              {/* Direct Dependents (Consistently using distinct caller count) */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-slate-700 font-medium text-xs block">Direct Dependents</span>
                    <span className="text-[10px] text-slate-400">Direct callers invoking this component</span>
                  </div>
                  <strong className="text-slate-900 font-bold font-mono text-sm">{distinctCallerIds.length}</strong>
                </div>
                {distinctCallerIds.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                    {distinctCallerIds.map((cid) => (
                      <button
                        key={cid}
                        onClick={() => onSelectComponent(cid)}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono cursor-pointer transition-colors"
                      >
                        {cid}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Failure Blast Radius (Labeled as components, with breakdown) */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-slate-700 font-medium text-xs block">Failure Blast Radius</span>
                    <span className="text-[10px] text-slate-400">Total upstream components affected if this fails</span>
                  </div>
                  <strong className="text-rose-600 font-bold font-mono text-sm">
                    {totalBlastCount} {totalBlastCount === 1 ? 'component' : 'components'}
                  </strong>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                    Direct: <strong className="text-slate-800">{directCallerCount}</strong>
                  </span>
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                    Transitive: <strong className="text-slate-800">{transitiveCallerCount}</strong>
                  </span>
                  {totalBlastCount > 0 && (
                    <button
                      onClick={() => setShowBlastComponents((prev) => !prev)}
                      className="ml-auto text-violet-600 hover:text-violet-800 font-sans font-semibold cursor-pointer underline"
                    >
                      {showBlastComponents ? 'Hide' : 'View all'}
                    </button>
                  )}
                </div>

                {showBlastComponents && metrics.upstream_callers && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Affected Components:</span>
                    <div className="flex flex-wrap gap-1">
                      {metrics.upstream_callers.map((callerId) => (
                        <button
                          key={callerId}
                          onClick={() => onSelectComponent(callerId)}
                          className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-mono cursor-pointer transition-colors"
                        >
                          {callerId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chain Depths: Downstream Callees vs Upstream Propagation */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-medium text-[11px]">Downstream Dependency Depth</span>
                    <span className="font-mono font-bold text-amber-800 text-xs">
                      {metrics.max_dependency_depth ?? 0} {metrics.max_dependency_depth === 1 ? 'tier' : 'tiers'}
                    </span>
                  </div>
                  {metrics.longest_downstream_path && metrics.longest_downstream_path.length > 0 ? (
                    (() => {
                      const path = metrics.longest_downstream_path;
                      return (
                        <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-slate-600 overflow-x-auto bg-white p-1 rounded border border-slate-200">
                          {path.map((node, nIdx) => (
                            <React.Fragment key={nIdx}>
                              <span className={node === entity.id ? 'font-bold text-slate-900' : 'text-slate-500'}>
                                {node}
                              </span>
                              {nIdx < path.length - 1 && <span>→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-[10px] text-slate-400 italic block mt-0.5">
                      0 tiers (Sink component — no outgoing downstream dependencies)
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 font-medium text-[11px]">Upstream Failure Propagation Depth</span>
                    <span className="font-mono font-bold text-violet-800 text-xs">
                      {metrics.max_propagation_depth ?? 0} {metrics.max_propagation_depth === 1 ? 'tier' : 'tiers'}
                    </span>
                  </div>
                  {metrics.longest_upstream_path && metrics.longest_upstream_path.length > 0 ? (
                    (() => {
                      const path = metrics.longest_upstream_path;
                      return (
                        <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-slate-600 overflow-x-auto bg-white p-1 rounded border border-slate-200">
                          {path.map((node, nIdx) => (
                            <React.Fragment key={nIdx}>
                              <span className={node === entity.id ? 'font-bold text-slate-900' : 'text-slate-500'}>
                                {node}
                              </span>
                              {nIdx < path.length - 1 && <span>→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-[10px] text-slate-400 italic block mt-0.5">
                      0 tiers (Entry point — no incoming upstream callers)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 italic text-[11px]">No impact data available.</p>
          )}
        </div>

        {/* SECTION 3: SPOF DETAILS (If applicable) */}
        {isSpof && spof && (
          <>
            <div className="border-t border-slate-100" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Disrupted Components ({spof.affected_components_count || spof.severed_components.length})
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {spof.disconnected_paths_count} severed workflow paths
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {spof.severed_component_names.map((name, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-mono border border-rose-200"
                  >
                    {name}
                  </span>
                ))}
              </div>

              {/* Display concrete severed paths if present */}
              {spof.severed_paths && spof.severed_paths.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Sample Severed Paths:</span>
                  <div className="space-y-1 font-mono text-[9px] max-h-24 overflow-y-auto">
                    {spof.severed_paths.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-1">
                        {p.join(' → ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-slate-100" />

        {/* SECTION 4: "WHY?" PROGRESSIVE DISCLOSURE */}
        <div>
          <button
            onClick={() => setIsWhyExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-xs font-semibold text-slate-800"
          >
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-violet-600" />
              <span>Why is this component {critTier.toLowerCase()}?</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                isWhyExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isWhyExpanded && (
            <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 text-xs text-slate-700 animate-fadeIn">
              {crit && crit.evidence.length > 0 ? (
                <>
                  <div className="space-y-1.5">
                    {crit.evidence.map((ev, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-violet-600 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed text-[11px]">{ev}</span>
                      </div>
                    ))}
                  </div>

                  {/* Factor breakdown score bars */}
                  {crit.score_breakdown && (
                    <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Criticality Breakdown:</span>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-600">
                        <div className="p-1.5 rounded bg-white border border-slate-200">
                          Betweenness: <strong>{(crit.score_breakdown.betweenness_factor * 100).toFixed(0)}%</strong>
                        </div>
                        <div className="p-1.5 rounded bg-white border border-slate-200">
                          PageRank: <strong>{(crit.score_breakdown.pagerank_factor * 100).toFixed(0)}%</strong>
                        </div>
                        <div className="p-1.5 rounded bg-white border border-slate-200">
                          Blast Radius: <strong>{(crit.score_breakdown.blast_radius_factor * 100).toFixed(0)}%</strong>
                        </div>
                        <div className="p-1.5 rounded bg-white border border-slate-200">
                          SPOF Penalty: <strong>{(crit.score_breakdown.spof_factor * 100).toFixed(0)}%</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Normal peripheral component with low coupling and redundant routing.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* SECTION 5: DEPENDENCY LISTS */}
        <div className="space-y-3">
          {/* Incoming */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-violet-600" />
              Inbound Callers ({distinctCallerIds.length})
            </span>
            {distinctCallerIds.length === 0 ? (
              <p className="text-slate-400 italic text-[10px]">None (Entry Point).</p>
            ) : (
              <div className="space-y-1">
                {incomingRels.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectComponent(rel.source)}
                    className="w-full text-left p-1.5 rounded-md bg-slate-50 hover:bg-violet-50 hover:border-violet-300 border border-slate-200 transition-colors flex items-center justify-between font-mono text-[10px] cursor-pointer"
                  >
                    <span className="text-violet-700 font-medium truncate">{rel.source}</span>
                    <span className="text-slate-400">{rel.protocol || rel.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-teal-600" />
              Outbound Dependencies ({distinctDependencyIds.length})
            </span>
            {distinctDependencyIds.length === 0 ? (
              <p className="text-slate-400 italic text-[10px]">None (Leaf / Sink).</p>
            ) : (
              <div className="space-y-1">
                {outgoingRels.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectComponent(rel.target)}
                    className="w-full text-left p-1.5 rounded-md bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 transition-colors flex items-center justify-between font-mono text-[10px] cursor-pointer"
                  >
                    <span className="text-teal-700 font-medium truncate">{rel.target}</span>
                    <span className="text-slate-400">{rel.protocol || rel.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* SECTION 6: CODEBASE EVIDENCE & PROVENANCE */}
        <div className="space-y-2.5 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileSearch className="w-3 h-3 text-violet-600" />
              Codebase Evidence & Provenance
            </span>
            {entity.sourceEvidence?.detectionMethod && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                {entity.sourceEvidence.detectionMethod}
              </span>
            )}
          </div>

          {/* Primary Evidence Box */}
          {entity.sourceEvidence ? (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2 text-xs">
              {entity.sourceEvidence.file && (
                <div className="flex items-start gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 font-mono text-[11px]">
                    <span className="text-slate-800 break-all font-medium">
                      {entity.sourceEvidence.file}
                    </span>
                    {typeof entity.sourceEvidence.line === 'number' && entity.sourceEvidence.line > 0 && (
                      <span className="text-violet-600 font-semibold ml-1">
                        :L{entity.sourceEvidence.line}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {entity.sourceEvidence.folderModule && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">
                    Module: <strong className="text-slate-700 font-mono">{entity.sourceEvidence.folderModule}</strong>
                  </span>
                </div>
              )}

              {entity.sourceEvidence.snippet && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mb-1">
                    <Code2 className="w-3 h-3" />
                    <span>Evidence Snippet</span>
                  </div>
                  <pre className="p-2 bg-slate-900 text-slate-200 text-[10px] font-mono rounded overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                    {entity.sourceEvidence.snippet}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-400 italic">
              Extracted from high-level architecture blueprint. No inline source file binding available.
            </div>
          )}

          {/* Associated Files List */}
          {entity.associatedFiles && entity.associatedFiles.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
                <span>Associated Files ({entity.associatedFiles.length})</span>
                {entity.associatedFiles.length > 3 && (
                  <button
                    onClick={() => setShowAllAssociatedFiles(!showAllAssociatedFiles)}
                    className="text-violet-600 hover:text-violet-800 text-[10px] font-medium cursor-pointer"
                  >
                    {showAllAssociatedFiles ? 'Show less' : `+${entity.associatedFiles.length - 3} more`}
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {(showAllAssociatedFiles ? entity.associatedFiles : entity.associatedFiles.slice(0, 3)).map((file, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-1 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-700 truncate"
                    title={file}
                  >
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drill-down action to Codebase Graph */}
          {onViewInCodebaseGraph && (
            <button
              onClick={() => onViewInCodebaseGraph(entity.id)}
              className="w-full mt-3 py-2 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <FolderTree className="w-3.5 h-3.5 text-violet-600" />
              <span>View Sub-Modules & Files in Codebase Graph</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

