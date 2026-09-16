import React, { useState, useMemo } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Network,
  ChevronRight,
  Activity,
} from 'lucide-react';
import type { ArchitectureModel } from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';
import { Objective2AnalysisEngine } from '../../engine/objective2AnalysisEngine';

interface ImpactAnalysisPageProps {
  model: ArchitectureModel;
  onNavigate: (route: NavRoute) => void;
  onSelectEntity: (id: string) => void;
}

export const ImpactAnalysisPage: React.FC<ImpactAnalysisPageProps> = ({
  model,
  onNavigate,
  onSelectEntity,
}) => {
  const entities = model.entities || [];

  // Default to first service or entity
  const [selectedComponentId, setSelectedComponentId] = useState<string>(
    entities[0]?.id || ''
  );

  // Compute full Objective 2 analysis
  const analysisResult = useMemo(() => {
    return Objective2AnalysisEngine.analyzeArchitecture(model);
  }, [model]);

  const targetEntity = entities.find((e) => e.id === selectedComponentId) || entities[0];
  const targetMetrics = targetEntity ? analysisResult.component_metrics[targetEntity.id] : null;

  // Upstream callers (Callers that depend on this component)
  const upstreamCallers = useMemo(() => {
    if (!targetMetrics) return [];
    return targetMetrics.upstream_callers.map((cid) => {
      const ent = entities.find((e) => e.id === cid || e.name === cid);
      const isDirect = targetMetrics.direct_callers.includes(cid);
      return {
        id: cid,
        name: ent?.name || cid,
        type: ent?.type || 'Service',
        technology: ent?.technology || 'Generic',
        isDirect,
      };
    });
  }, [targetMetrics, entities]);

  // Downstream dependencies (Components this component depends on)
  const downstreamDependencies = useMemo(() => {
    if (!targetMetrics) return [];
    return targetMetrics.downstream_dependents.map((cid) => {
      const ent = entities.find((e) => e.id === cid || e.name === cid);
      const isDirect = targetMetrics.direct_dependencies.includes(cid);
      return {
        id: cid,
        name: ent?.name || cid,
        type: ent?.type || 'Dependency',
        technology: ent?.technology || 'Generic',
        isDirect,
      };
    });
  }, [targetMetrics, entities]);

  const handleInspectOnGraph = (entityId: string) => {
    onSelectEntity(entityId);
    onNavigate('architecture');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Impact Analysis & Cascading Blast Radius
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wider">
                Objective 2
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic reachability analysis: evaluate cascading failures across upstream callers and downstream targets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleInspectOnGraph(targetEntity?.id || '')}
              className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Inspect on Graph</span>
            </button>
          </div>
        </div>

        {/* Focus Component Selector Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
              Focus Component:
            </span>
            <select
              value={selectedComponentId}
              onChange={(e) => setSelectedComponentId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-hidden focus:border-violet-500 cursor-pointer w-full sm:w-80"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.type} • {e.technology})
                </option>
              ))}
            </select>
          </div>

          {targetMetrics && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>Betweenness: {targetMetrics.betweenness_centrality}</span>
              <span>•</span>
              <span>PageRank: {targetMetrics.pagerank}</span>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Total Blast Radius */}
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs">
            <div className="text-xs text-rose-700 font-bold uppercase">Upstream Blast Radius</div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1 font-mono">
              {targetMetrics?.upstream_callers_count || 0}
              <span className="text-xs font-normal text-rose-600"> Callers</span>
            </div>
            <div className="text-[11px] text-rose-600 mt-0.5">
              {targetMetrics?.direct_callers_count || 0} direct + {Math.max(0, (targetMetrics?.upstream_callers_count || 0) - (targetMetrics?.direct_callers_count || 0))} indirect
            </div>
          </div>

          {/* Downstream Dependencies */}
          <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs">
            <div className="text-xs text-indigo-700 font-bold uppercase">Downstream Targets</div>
            <div className="text-2xl font-extrabold text-indigo-900 mt-1 font-mono">
              {targetMetrics?.downstream_dependents_count || 0}
              <span className="text-xs font-normal text-indigo-600"> Dependencies</span>
            </div>
            <div className="text-[11px] text-indigo-600 mt-0.5">
              {targetMetrics?.direct_dependencies_count || 0} direct dependencies
            </div>
          </div>

          {/* Max Propagation Depth */}
          <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-2xs">
            <div className="text-xs text-purple-700 font-bold uppercase">Max Propagation Depth</div>
            <div className="text-2xl font-extrabold text-purple-900 mt-1 font-mono">
              {targetMetrics?.max_propagation_depth || 0}
              <span className="text-xs font-normal text-purple-600"> Hops</span>
            </div>
            <div className="text-[11px] text-purple-600 mt-0.5">Longest upstream ripple trail</div>
          </div>

          {/* Cascade Risk Rating */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 font-bold uppercase">Cascade Risk Rating</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {(targetMetrics?.upstream_callers_count || 0) >= 4
                ? 'CRITICAL'
                : (targetMetrics?.upstream_callers_count || 0) >= 2
                ? 'ELEVATED'
                : 'LOW'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Based on upstream dependency fan-in</div>
          </div>
        </div>
      </div>

      {/* Concrete Propagation Paths */}
      {targetMetrics && targetMetrics.longest_upstream_path.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1.5">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-violet-600" />
            <span>Longest Cascading Upstream Path (Ripple Trail)</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-violet-900 font-semibold flex items-center flex-wrap gap-2">
            {targetMetrics.longest_upstream_path.map((cid, i) => {
              const ent = entities.find((e) => e.id === cid || e.name === cid);
              return (
                <React.Fragment key={cid}>
                  <span className={cid === targetEntity?.id ? 'text-violet-600 font-bold underline' : ''}>
                    {ent?.name || cid}
                  </span>
                  {i < targetMetrics.longest_upstream_path.length - 1 && (
                    <span className="text-slate-400 font-normal">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Two Column Breakdown: Upstream Callers vs Downstream Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upstream Callers (Blast Radius) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upstream Callers (Direct & Cascading)</h3>
                <p className="text-[11px] text-slate-500">Components affected if {targetEntity?.name} degrades</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              {upstreamCallers.length} Affected
            </span>
          </div>

          {upstreamCallers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No upstream callers depend on this component. (Edge ingress component or uncalled service).
            </div>
          ) : (
            <div className="space-y-1.5">
              {upstreamCallers.map((caller) => (
                <div
                  key={caller.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{caller.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {caller.type} • {caller.technology}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      caller.isDirect
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {caller.isDirect ? 'DIRECT' : 'CASCADE'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Downstream Dependencies */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Downstream Dependencies</h3>
                <p className="text-[11px] text-slate-500">Systems required for {targetEntity?.name} to operate</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              {downstreamDependencies.length} Targets
            </span>
          </div>

          {downstreamDependencies.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No outbound dependencies detected for this component.
            </div>
          ) : (
            <div className="space-y-1.5">
              {downstreamDependencies.map((dep) => (
                <div
                  key={dep.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{dep.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {dep.type} • {dep.technology}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedComponentId(dep.id)}
                    className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Focus</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
