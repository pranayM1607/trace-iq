import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Repeat,
  Layers,
  ArrowRight,
  Activity,
  CheckCircle2,
  ExternalLink,
  X,
  HelpCircle,
} from 'lucide-react';
import type { Objective2AnalysisResult } from '../../types/analysis';

interface RiskTriageViewProps {
  analysis: Objective2AnalysisResult | null;
  onSelectComponent: (componentId: string) => void;
  onSwitchToGraphView: () => void;
}

export const RiskTriageView: React.FC<RiskTriageViewProps> = ({
  analysis,
  onSelectComponent,
  onSwitchToGraphView,
}) => {
  const [showAllSpofsModal, setShowAllSpofsModal] = useState(false);
  const [showAllDepsModal, setShowAllDepsModal] = useState(false);
  const [showAllCompsModal, setShowAllCompsModal] = useState(false);
  const [explainedMetric, setExplainedMetric] = useState<
    'density' | 'avg_degree' | 'cyclomatic' | 'spofs' | 'cycles' | null
  >(null);

  if (!analysis) {
    return (
      <div className="flex-1 h-full bg-[#f8fafc] flex flex-col items-center justify-center p-8 text-center font-sans">
        <Activity className="w-10 h-10 text-violet-600 mb-3 animate-pulse" />
        <h3 className="text-base font-bold text-slate-900 mb-1">No Analysis Run Loaded</h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          Click "Analyze" in the top bar to run dependency graph analysis.
        </p>
        <button
          onClick={onSwitchToGraphView}
          className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
        >
          Return to Graph
        </button>
      </div>
    );
  }

  const { complexity, critical_components, spofs, high_risk_dependencies } = analysis;
  const trueSpofs = spofs.filter((s) => s.is_spof);

  const handleInspect = (componentId: string) => {
    onSelectComponent(componentId);
    onSwitchToGraphView();
  };

  const highRiskDeps = high_risk_dependencies.filter(
    (d) => d.risk_level === 'CRITICAL' || d.risk_level === 'HIGH'
  );
  const highRiskDepsCount = highRiskDeps.length;

  return (
    <div className="flex-1 h-full bg-[#f8fafc] overflow-y-auto p-6 space-y-6 font-sans text-slate-900">
      {/* 1. TOP: ARCHITECTURE HEALTH COMPACT SUMMARY */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Architecture Health
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  complexity.complexity_rating === 'HIGH'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : complexity.complexity_rating === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
              >
                {complexity.complexity_rating} COMPLEXITY
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Automated topological structural risk assessment
            </p>
          </div>

          <button
            onClick={onSwitchToGraphView}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <span>View Graph</span>
            <ArrowRight className="w-3.5 h-3.5 text-violet-600" />
          </button>
        </div>

        {/* Compact 5-Metric Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Density</span>
              <button
                onClick={() => setExplainedMetric('density')}
                className="p-0.5 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
                title="View formula & calculation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-base font-mono font-bold text-slate-900 mt-0.5 block">{(complexity.density * 100).toFixed(1)}%</span>
            <span className="text-[9px] text-slate-400 block">Coupling ratio</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Avg Degree</span>
              <button
                onClick={() => setExplainedMetric('avg_degree')}
                className="p-0.5 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
                title="View formula & calculation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-base font-mono font-bold text-slate-900 mt-0.5 block">{complexity.average_degree}</span>
            <span className="text-[9px] text-slate-400 block">Connections/Node</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold truncate" title="TraceIQ Architectural Cyclomatic Score">
                TraceIQ Cyclomatic
              </span>
              <button
                onClick={() => setExplainedMetric('cyclomatic')}
                className="p-0.5 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
                title="View formula & calculation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-base font-mono font-bold text-slate-900 mt-0.5 block">{complexity.cyclomatic_complexity}</span>
            <span className="text-[9px] text-slate-400 block">Score (M = E - V + 2P)</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Single Points of Failure</span>
              <button
                onClick={() => setExplainedMetric('spofs')}
                className="p-0.5 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
                title="View formula & calculation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-base font-mono font-bold text-rose-600 mt-0.5 block">{trueSpofs.length}</span>
            <span className="text-[9px] text-slate-400 block">{trueSpofs.length} bottlenecks detected</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cycles</span>
              <button
                onClick={() => setExplainedMetric('cycles')}
                className="p-0.5 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
                title="View formula & calculation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-base font-mono font-bold text-purple-600 mt-0.5 block">{complexity.cycles_count}</span>
            <span className="text-[9px] text-slate-400 block">Circular paths</span>
          </div>
        </div>
      </div>

      {/* 2. SECTION: CRITICAL COMPONENTS (Ranked with score bars) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600" />
            Ranked Critical Components ({critical_components.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Ranked by structural centrality, blast radius & SPOF penalty
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
          {critical_components.slice(0, 6).map((comp) => {
            const isCritical = comp.criticality_tier === 'CRITICAL';
            const isHigh = comp.criticality_tier === 'HIGH';

            return (
              <div
                key={comp.component_id}
                className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left: Rank + Name + Tech */}
                <div className="flex items-center gap-3 min-w-0 sm:w-1/3">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                      comp.rank <= 3
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {String(comp.rank).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-900 truncate">{comp.name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">
                      {comp.type} • {comp.technology}
                    </span>
                  </div>
                </div>

                {/* Center: Horizontal Score Bar */}
                <div className="flex-1 max-w-xs flex items-center gap-2.5">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-violet-500'
                      }`}
                      style={{ width: `${comp.criticality_score * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-700 w-10 text-right">
                    {(comp.criticality_score * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Right: Badge + Inspect Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                      isCritical
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : isHigh
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'
                    }`}
                  >
                    {comp.criticality_tier}
                  </span>
                  <button
                    onClick={() => handleInspect(comp.component_id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Slicing Disclosure Footer */}
          {critical_components.length > 6 && (
            <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-4">
              <span>Showing 6 of {critical_components.length} components</span>
              <button
                onClick={() => setShowAllCompsModal(true)}
                className="font-semibold text-violet-600 hover:text-violet-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all {critical_components.length} components</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. SECTION: STRUCTURAL RISKS (SPOFs & Cycles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SPOFs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Single Points of Failure ({trueSpofs.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {trueSpofs.length} detected
              </span>
            </div>

            {trueSpofs.length === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No structural single points of failure detected.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {trueSpofs.slice(0, 4).map((spof) => (
                  <div
                    key={spof.component_id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-slate-900 truncate">{spof.name}</h4>
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.2 rounded uppercase">
                          SPOF
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug mt-1 line-clamp-2">
                        {spof.explanation}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-700 font-medium">
                        <span>Impact:</span>
                        <span>Severs {spof.severed_components.length} components ({spof.severed_component_names.slice(0, 2).join(', ')}{spof.severed_component_names.length > 2 ? '...' : ''})</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleInspect(spof.component_id)}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shrink-0 cursor-pointer shadow-2xs mt-0.5"
                      title="Inspect in graph"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Slicing Disclosure Footer */}
          {trueSpofs.length > 4 && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing 4 of {trueSpofs.length} SPOFs</span>
              <button
                onClick={() => setShowAllSpofsModal(true)}
                className="font-semibold text-violet-600 hover:text-violet-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all {trueSpofs.length} SPOFs</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Cycles */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-purple-600" />
              Circular Dependencies ({complexity.cycles_count})
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {complexity.cycles_count} cycle loops
            </span>
          </div>

          {complexity.cycles_count === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No circular dependencies found across the graph.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {complexity.simple_cycles.map((cycle, cIdx) => (
                <div
                  key={cIdx}
                  className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-slate-800">
                    {cycle.map((node, nIdx) => (
                      <React.Fragment key={nIdx}>
                        <span className="px-1.5 py-0.5 bg-white border border-purple-200 rounded text-purple-800 font-semibold shadow-2xs">
                          {node}
                        </span>
                        <ArrowRight className="w-3 h-3 text-purple-600 shrink-0" />
                      </React.Fragment>
                    ))}
                    <span className="px-1.5 py-0.5 bg-white border border-purple-200 rounded text-purple-800 font-semibold shadow-2xs">
                      {cycle[0]}
                    </span>
                  </div>
                  <span className="text-[11px] text-purple-900/80 mt-2 block leading-relaxed">
                    Circular dependency loop prevents modular deployment and risks cascading timeouts or deadlock during failures.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. SECTION: HIGH-RISK DEPENDENCIES (Compact table with disclosure) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              High-Risk Dependencies ({highRiskDepsCount})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dependencies connected to single points of failure or circular loops
            </p>
          </div>
          {highRiskDepsCount > 6 && (
            <button
              onClick={() => setShowAllDepsModal(true)}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all {highRiskDepsCount} Dependencies</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Dependency (Source → Target)</th>
                <th className="py-2.5 px-4">Protocol</th>
                <th className="py-2.5 px-4">Risk Level</th>
                <th className="py-2.5 px-4">Key Risk Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {highRiskDeps.slice(0, 6).map((dep) => (
                <tr key={dep.relationship_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span>{dep.source_name}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-violet-700">{dep.target_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                    {dep.type} {dep.protocol && `(${dep.protocol})`}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                        dep.risk_level === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : dep.risk_level === 'HIGH'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {dep.risk_level}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 text-xs">
                    <span className="truncate block max-w-md">
                      {dep.risk_factors[0] || 'High structural centrality dependency'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Slicing Disclosure Footer */}
        {highRiskDepsCount > 6 && (
          <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-4">
            <span>Showing 6 of {highRiskDepsCount} high-risk dependencies</span>
            <button
              onClick={() => setShowAllDepsModal(true)}
              className="font-semibold text-violet-600 hover:text-violet-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all {highRiskDepsCount} dependencies</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ALL SINGLE POINTS OF FAILURE (7 SPOFs)                           */}
      {/* ========================================================================= */}
      {showAllSpofsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    All Single Points of Failure ({trueSpofs.length} Detected)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Components whose loss structurally disconnects or paralyzes dependent subsystems
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllSpofsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {trueSpofs.map((spof) => (
                <div
                  key={spof.component_id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col gap-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{spof.name}</h4>
                      <span className="text-[9px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-1.5 py-0.2 rounded uppercase">
                        SPOF
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowAllSpofsModal(false);
                        handleInspect(spof.component_id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="w-3 h-3 text-violet-600" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {spof.explanation}
                  </p>

                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-slate-600">Severed Components ({spof.severed_components.length}):</span>
                    <div className="flex flex-wrap gap-1">
                      {spof.severed_component_names.map((name, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200/70 text-[10px] font-mono"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end">
              <button
                onClick={() => setShowAllSpofsModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ALL HIGH-RISK DEPENDENCIES (16 Dependencies)                      */}
      {/* ========================================================================= */}
      {showAllDepsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    All High-Risk Dependencies ({highRiskDepsCount} Detected)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dependencies pointing to critical SPOFs, circular paths, or bottleneck services
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllDepsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono text-[10px] uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Dependency (Source → Target)</th>
                    <th className="py-2.5 px-4">Protocol</th>
                    <th className="py-2.5 px-4">Risk Level</th>
                    <th className="py-2.5 px-4">Risk Factors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {highRiskDeps.map((dep) => (
                    <tr key={dep.relationship_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span>{dep.source_name}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-violet-700">{dep.target_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                        {dep.type} {dep.protocol && `(${dep.protocol})`}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            dep.risk_level === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {dep.risk_level}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 text-xs">
                        <ul className="list-disc list-inside space-y-0.5">
                          {dep.risk_factors.map((factor, fIdx) => (
                            <li key={fIdx} className="leading-snug">{factor}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end">
              <button
                onClick={() => setShowAllDepsModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ALL RANKED COMPONENTS (13 Components)                            */}
      {/* ========================================================================= */}
      {showAllCompsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    All Ranked Architecture Components ({critical_components.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Comprehensive ranked criticality across all microservices and datastores
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllCompsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {critical_components.map((comp) => {
                const isCritical = comp.criticality_tier === 'CRITICAL';
                const isHigh = comp.criticality_tier === 'HIGH';

                return (
                  <div
                    key={comp.component_id}
                    className="p-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          comp.rank <= 3
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {String(comp.rank).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-slate-900 truncate">{comp.name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono block truncate">
                          {comp.type} • {comp.technology}
                        </span>
                      </div>
                    </div>

                    <div className="w-28 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-violet-500'
                          }`}
                          style={{ width: `${comp.criticality_score * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-700">
                        {(comp.criticality_score * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                          isCritical
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : isHigh
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-violet-50 text-violet-700 border-violet-200'
                        }`}
                      >
                        {comp.criticality_tier}
                      </span>
                      <button
                        onClick={() => {
                          setShowAllCompsModal(false);
                          handleInspect(comp.component_id);
                        }}
                        className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end">
              <button
                onClick={() => setShowAllCompsModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: METRIC EXPLANATION & DERIVATION MODAL                             */}
      {/* ========================================================================= */}
      {explainedMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Metric Formula & Calculation Details
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Transparent NetworkX graph algorithms, active system inputs, and architectural significance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExplainedMetric(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metric Selector Tabs */}
            <div className="px-4 pt-3 pb-1 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto bg-slate-50/50 text-xs">
              <button
                onClick={() => setExplainedMetric('density')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  explainedMetric === 'density'
                    ? 'bg-violet-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Density
              </button>
              <button
                onClick={() => setExplainedMetric('avg_degree')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  explainedMetric === 'avg_degree'
                    ? 'bg-violet-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Avg Degree
              </button>
              <button
                onClick={() => setExplainedMetric('cyclomatic')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  explainedMetric === 'cyclomatic'
                    ? 'bg-violet-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                TraceIQ Cyclomatic
              </button>
              <button
                onClick={() => setExplainedMetric('spofs')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  explainedMetric === 'spofs'
                    ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                SPOFs ({trueSpofs.length})
              </button>
              <button
                onClick={() => setExplainedMetric('cycles')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  explainedMetric === 'cycles'
                    ? 'bg-purple-600 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Cycles ({complexity.cycles_count})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-slate-800 font-sans">
              {explainedMetric === 'density' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Density (Coupling Ratio)</h4>
                      <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-mono font-bold">
                        {(complexity.density * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ratio of active dependency edges to the maximum conceivable connections in a directed graph.
                    </p>
                  </div>

                  {/* Formula Box */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 font-mono text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-sans">Formula:</span>
                    <code className="text-violet-900 font-bold">Density = E / (V × (V - 1))</code>
                  </div>

                  {/* Concrete Derivation */}
                  <div className="p-3.5 rounded-xl bg-violet-50/50 border border-violet-200/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-violet-900 block font-sans">
                      Active Architecture Inputs:
                    </span>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-700">
                      <div>Edges (E): <strong className="text-slate-900">{complexity.edge_count}</strong></div>
                      <div>Components (V): <strong className="text-slate-900">{complexity.node_count}</strong></div>
                      <div className="col-span-2">
                        Max Possible Edges: <strong className="text-slate-900">{complexity.node_count} × ({complexity.node_count} - 1) = {complexity.node_count * (complexity.node_count - 1)}</strong>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-violet-200/60 font-mono text-xs text-violet-950">
                      Calculation: {complexity.edge_count} / {complexity.node_count * (complexity.node_count - 1)} = <strong>{(complexity.density * 100).toFixed(2)}%</strong>
                    </div>
                  </div>

                  {/* Why it matters */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">Why it matters:</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Lower density (&lt;15%) indicates clean microservice modularity and isolated domain boundaries. Elevated density (&gt;25%) reveals monolithic entanglement where components know too much about each other, accelerating cascading outages and hindering parallel team deployments.
                    </p>
                  </div>
                </div>
              )}

              {explainedMetric === 'avg_degree' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Average Degree</h4>
                      <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-mono font-bold">
                        {complexity.average_degree} connections/node
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Average number of direct dependency couplings maintained per architectural component.
                    </p>
                  </div>

                  {/* Formula Box */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 font-mono text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-sans">Formula:</span>
                    <code className="text-violet-900 font-bold">Avg Out-Degree = E / V  |  Avg Total Degree = 2E / V</code>
                  </div>

                  {/* Concrete Derivation */}
                  <div className="p-3.5 rounded-xl bg-violet-50/50 border border-violet-200/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-violet-900 block font-sans">
                      Active Architecture Inputs:
                    </span>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-700">
                      <div>Total Dependencies (E): <strong className="text-slate-900">{complexity.edge_count}</strong></div>
                      <div>Total Components (V): <strong className="text-slate-900">{complexity.node_count}</strong></div>
                    </div>
                    <div className="pt-2 border-t border-violet-200/60 font-mono text-xs text-violet-950">
                      Calculation: {complexity.edge_count} / {complexity.node_count} = <strong>{complexity.average_degree}</strong>
                    </div>
                  </div>

                  {/* Why it matters */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">Why it matters:</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Measures architectural chattiness. High average degree (&gt;3.5) means services depend on numerous collaborators to complete requests, multiplying latency variance, circuit breaker complexity, and blast radius.
                    </p>
                  </div>
                </div>
              )}

              {explainedMetric === 'cyclomatic' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">TraceIQ Architectural Cyclomatic Score</h4>
                      <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-mono font-bold">
                        Score: {complexity.cyclomatic_complexity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      McCabe's graph-theoretic complexity adapted to distributed microservice architectures.
                    </p>
                  </div>

                  {/* Formula Box */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 font-mono text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Exact Formula:</span>
                    <code className="text-violet-900 font-bold block text-sm">M = E - V + 2P</code>
                    <div className="text-[10px] text-slate-500 font-sans pt-1">
                      Where <strong className="text-slate-700 font-mono">E</strong> = Edges (Dependencies), <strong className="text-slate-700 font-mono">V</strong> = Vertices (Components), and <strong className="text-slate-700 font-mono">P</strong> = Connected Components.
                    </div>
                  </div>

                  {/* Concrete Derivation */}
                  <div className="p-3.5 rounded-xl bg-violet-50/50 border border-violet-200/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-violet-900 block font-sans">
                      Active Architecture Inputs:
                    </span>
                    <div className="grid grid-cols-3 gap-2 font-mono text-xs text-slate-700">
                      <div>E (Edges): <strong className="text-slate-900">{complexity.edge_count}</strong></div>
                      <div>V (Nodes): <strong className="text-slate-900">{complexity.node_count}</strong></div>
                      <div>P (Connected): <strong className="text-slate-900">{complexity.weakly_connected_components ?? 1}</strong></div>
                    </div>
                    <div className="pt-2 border-t border-violet-200/60 font-mono text-xs text-violet-950">
                      Calculation: {complexity.edge_count} - {complexity.node_count} + 2({complexity.weakly_connected_components ?? 1}) = <strong>{complexity.cyclomatic_complexity}</strong>
                    </div>
                  </div>

                  {/* Why it matters */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">Why it matters:</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Evaluates the count of linearly independent structural execution paths and routing circuits in the service graph. A high score signifies non-linear dependency knots, multiple redundant or competing routing pathways, and elevated difficulty isolating failure modes during incidents.
                    </p>
                  </div>
                </div>
              )}

              {explainedMetric === 'spofs' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Single Points of Failure (SPOFs)</h4>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                        {trueSpofs.length} Bottlenecks Detected
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Components whose loss fractures the graph or leaves dependent subsystems without alternative paths.
                    </p>
                  </div>

                  {/* Algorithm Box */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Methodology:</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Directed Articulation Point & Cut-Vertex Search in NetworkX. Detects both <strong>Transit Bottlenecks</strong> (services connecting disparate tiers) and <strong>Shared Datastores</strong> (core databases queried by multiple mission-critical services with no read replica or cache fallback).
                    </p>
                  </div>

                  {/* Detected SPOFs List */}
                  <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-rose-900 block font-sans">
                      Detected Architecture SPOFs:
                    </span>
                    <div className="space-y-1.5">
                      {trueSpofs.map((s) => (
                        <div key={s.component_id} className="p-2 bg-white rounded-lg border border-rose-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-slate-900">{s.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-2">({s.spof_type || 'SPOF'})</span>
                          </div>
                          <span className="text-[10px] font-mono text-rose-700 font-bold">
                            {s.affected_components_count || s.severed_components.length} components severed
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Why it matters */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">Why it matters:</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      SPOFs have zero redundancy. Any transient outage, garbage collection pause, or network partition on these components causes instantaneous customer-visible failures across all dependent tiers.
                    </p>
                  </div>
                </div>
              )}

              {explainedMetric === 'cycles' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Circular Dependencies (Cycles)</h4>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-mono font-bold">
                        {complexity.cycles_count} Loops Detected
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Closed loops where service A transitively depends on service A.
                    </p>
                  </div>

                  {/* Algorithm Box */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Methodology:</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Johnson's Elementary Cycles Algorithm (<code className="text-purple-900 bg-white px-1 py-0.5 rounded border border-purple-200 font-mono">nx.simple_cycles</code>) executed on the directed multigraph.
                    </p>
                  </div>

                  {/* Cycles Evidence */}
                  {complexity.cycles_count > 0 ? (
                    <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-purple-900 block font-sans">
                        Detected Cycle Loops:
                      </span>
                      {complexity.simple_cycles.map((cycle, idx) => (
                        <div key={idx} className="p-2 bg-white rounded-lg border border-purple-200 font-mono text-[10px] text-slate-800 flex items-center gap-1 overflow-x-auto">
                          {cycle.map((node, nIdx) => (
                            <React.Fragment key={nIdx}>
                              <span className="font-semibold text-purple-900">{node}</span>
                              <span className="text-slate-400">→</span>
                            </React.Fragment>
                          ))}
                          <span className="font-semibold text-purple-900">{cycle[0]}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                      No cyclical loops detected in current architecture.
                    </div>
                  )}

                  {/* Why it matters */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">Why it matters:</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Circular dependencies break acyclic ordering. They prevent clean sequential bootstrap, cause distributed lockups during network hiccups, and trigger retry storms that can take down entire clusters.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end">
              <button
                onClick={() => setExplainedMetric(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
