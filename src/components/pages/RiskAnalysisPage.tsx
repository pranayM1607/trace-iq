import React, { useState, useMemo } from 'react';
import {
  Search,
  Network,
} from 'lucide-react';
import type { ArchitectureModel } from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';
import { Objective2AnalysisEngine } from '../../engine/objective2AnalysisEngine';

interface RiskFinding {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'SPOF' | 'Coupling' | 'Cycles' | 'Data Isolation' | 'Protocol / Security';
  componentId: string;
  componentName: string;
  componentType: string;
  description: string;
  evidenceFile: string;
  blastRadius: number;
  remediation: string;
  inDegree: number;
  outDegree: number;
  betweenness: number;
  pagerank: number;
  isSpof: boolean;
  maxDepth: number;
  longestPath: string[];
}

interface RiskAnalysisPageProps {
  model: ArchitectureModel;
  onNavigate: (route: NavRoute) => void;
  onSelectEntity: (id: string) => void;
}

export const RiskAnalysisPage: React.FC<RiskAnalysisPageProps> = ({
  model,
  onNavigate,
  onSelectEntity,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFinding, setActiveFinding] = useState<RiskFinding | null>(null);

  // Compute full Objective 2 graph metrics deterministically
  const analysisResult = useMemo(() => {
    return Objective2AnalysisEngine.analyzeArchitecture(model);
  }, [model]);

  // Overall Structural Risk Score (0 - 100)
  const overallRiskScore = useMemo(() => {
    return Objective2AnalysisEngine.calculateDeterministicRiskScore(analysisResult);
  }, [analysisResult]);

  // Build comprehensive architectural risk findings from Objective 2 analysis
  const findings = useMemo<RiskFinding[]>(() => {
    const list: RiskFinding[] = [];
    const metrics = analysisResult.component_metrics;
    const spofs = analysisResult.spofs;
    const criticals = analysisResult.critical_components;
    const cycles = analysisResult.complexity.simple_cycles;
    const highRiskDeps = analysisResult.high_risk_dependencies;
    const entities = model.entities || [];

    // 1. Single Points of Failure (SPOFs)
    spofs.filter((s) => s.is_spof).forEach((spof) => {
      const m = metrics[spof.component_id];
      const ent = entities.find((e) => e.id === spof.component_id);
      list.push({
        id: `spof-${spof.component_id}`,
        title: `Single Point of Failure: ${spof.name}`,
        severity: spof.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        category: 'SPOF',
        componentId: spof.component_id,
        componentName: spof.name,
        componentType: spof.type,
        description: `Structural articulation bottleneck bridging disjoint subgraphs. Failure directly isolates ${spof.affected_components_count} dependent component(s).`,
        evidenceFile: ent?.metadata?.filePath || 'architecture-model.json',
        blastRadius: spof.affected_components_count,
        remediation: 'Introduce redundant routing paths, replicate datastore instances, or add fallback queues.',
        inDegree: m?.in_degree || 0,
        outDegree: m?.out_degree || 0,
        betweenness: m?.betweenness_centrality || 0,
        pagerank: m?.pagerank || 0,
        isSpof: true,
        maxDepth: m?.max_dependency_depth || 0,
        longestPath: m?.longest_downstream_path || [],
      });
    });

    // 2. High-Criticality Components (High betweenness / fan-in)
    criticals
      .filter((c) => c.criticality_tier === 'CRITICAL' && !list.some((f) => f.componentId === c.component_id))
      .forEach((crit) => {
        const m = metrics[crit.component_id];
        const ent = entities.find((e) => e.id === crit.component_id);
        list.push({
          id: `crit-${crit.component_id}`,
          title: `High Centrality Hub: ${crit.name}`,
          severity: 'HIGH',
          category: 'Coupling',
          componentId: crit.component_id,
          componentName: crit.name,
          componentType: crit.type,
          description: `Disproportionate betweenness centrality (${m?.betweenness_centrality || 0}) and high in-degree (${m?.in_degree || 0}). High risk of service bottleneck.`,
          evidenceFile: ent?.metadata?.filePath || 'service-hub',
          blastRadius: m?.upstream_callers_count || m?.in_degree || 0,
          remediation: 'Decompose service responsibilities or introduce an API gateway aggregator layer.',
          inDegree: m?.in_degree || 0,
          outDegree: m?.out_degree || 0,
          betweenness: m?.betweenness_centrality || 0,
          pagerank: m?.pagerank || 0,
          isSpof: false,
          maxDepth: m?.max_dependency_depth || 0,
          longestPath: m?.longest_downstream_path || [],
        });
      });

    // 3. Circular Dependencies
    cycles.forEach((cycle, idx) => {
      const compId = cycle[0];
      const ent = entities.find((e) => e.id === compId);
      const m = metrics[compId];
      list.push({
        id: `cycle-${idx}`,
        title: `Circular Dependency Cycle Detected (${cycle.length} nodes)`,
        severity: 'HIGH',
        category: 'Cycles',
        componentId: compId,
        componentName: ent?.name || compId,
        componentType: ent?.type || 'Service',
        description: `Cyclic call loop: ${cycle.join(' → ')} → ${cycle[0]}. Causes tight coupling and deadlock hazards.`,
        evidenceFile: 'graph-topology-cycle',
        blastRadius: cycle.length,
        remediation: 'Break loop using asynchronous event publishing or inverted dependency injection.',
        inDegree: m?.in_degree || 1,
        outDegree: m?.out_degree || 1,
        betweenness: m?.betweenness_centrality || 0,
        pagerank: m?.pagerank || 0,
        isSpof: false,
        maxDepth: cycle.length,
        longestPath: cycle,
      });
    });

    // 4. Cross-service database sharing
    const dbUsers: Record<string, string[]> = {};
    (model.relationships || []).forEach((rel) => {
      if (rel.type === 'QUERIES' || rel.type === 'USES' || rel.type === 'CONNECTS_TO') {
        const targetEntity = entities.find((e) => e.id === rel.target || e.name === rel.target);
        if (targetEntity && targetEntity.type.toLowerCase() === 'database') {
          if (!dbUsers[targetEntity.name]) dbUsers[targetEntity.name] = [];
          dbUsers[targetEntity.name].push(rel.source);
        }
      }
    });

    Object.entries(dbUsers).forEach(([dbName, users]) => {
      const uniqueUsers = Array.from(new Set(users));
      if (uniqueUsers.length > 1) {
        const dbEntity = entities.find((e) => e.name === dbName);
        const m = dbEntity ? metrics[dbEntity.id] : null;
        list.push({
          id: `db-share-${dbName}`,
          title: `Shared Database Coupling: ${dbName}`,
          severity: 'HIGH',
          category: 'Data Isolation',
          componentId: dbEntity?.id || dbName,
          componentName: dbName,
          componentType: 'Database',
          description: `${uniqueUsers.length} independent services directly query this database. Violates microservice bounded contexts.`,
          evidenceFile: dbEntity?.metadata?.filePath || 'database-config',
          blastRadius: uniqueUsers.length,
          remediation: 'Encapsulate database behind a dedicated domain service with authorized API endpoints.',
          inDegree: m?.in_degree || uniqueUsers.length,
          outDegree: m?.out_degree || 0,
          betweenness: m?.betweenness_centrality || 0,
          pagerank: m?.pagerank || 0,
          isSpof: true,
          maxDepth: 1,
          longestPath: [uniqueUsers[0], dbName],
        });
      }
    });

    // 5. High-Risk Dependencies
    highRiskDeps
      .filter((d) => d.risk_level === 'CRITICAL' || d.risk_level === 'HIGH')
      .slice(0, 3)
      .forEach((dep) => {
        const srcEnt = entities.find((e) => e.id === dep.source_id);
        const tgtEnt = entities.find((e) => e.id === dep.target_id);
        const m = metrics[dep.source_id];
        list.push({
          id: `dep-${dep.relationship_id}`,
          title: `High-Risk Dependency: ${srcEnt?.name || dep.source_id} → ${tgtEnt?.name || dep.target_id}`,
          severity: dep.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          category: 'Coupling',
          componentId: dep.source_id,
          componentName: srcEnt?.name || dep.source_id,
          componentType: srcEnt?.type || 'Service',
          description: dep.risk_factors.join(' '),
          evidenceFile: 'relationship-contract',
          blastRadius: 2,
          remediation: 'Add resilience timeout or circuit breaker on outbound dependency.',
          inDegree: m?.in_degree || 0,
          outDegree: m?.out_degree || 0,
          betweenness: m?.betweenness_centrality || 0,
          pagerank: m?.pagerank || 0,
          isSpof: dep.is_target_spof,
          maxDepth: 1,
          longestPath: dep.propagation_path,
        });
      });

    // Default Informational if empty
    if (list.length === 0) {
      list.push({
        id: 'clean-arch',
        title: 'Balanced Microservice Boundary Distribution',
        severity: 'LOW',
        category: 'Coupling',
        componentId: entities[0]?.id || 'root',
        componentName: entities[0]?.name || 'Baseline',
        componentType: 'System',
        description: 'No critical single points of failure, circular cycles, or direct shared database couplings detected.',
        evidenceFile: 'topology-scan',
        blastRadius: 0,
        remediation: 'Maintain current separation of concerns.',
        inDegree: 0,
        outDegree: 0,
        betweenness: 0,
        pagerank: 0,
        isSpof: false,
        maxDepth: 0,
        longestPath: [],
      });
    }

    return list;
  }, [analysisResult, model]);

  // Counts
  const critCount = findings.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const medCount = findings.filter((f) => f.severity === 'MEDIUM').length;
  const lowCount = findings.filter((f) => f.severity === 'LOW').length;

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (selectedSeverity !== 'ALL' && f.severity !== selectedSeverity) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          f.title.toLowerCase().includes(q) ||
          f.componentName.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [findings, selectedSeverity, searchQuery]);

  const handleInspectFinding = (finding: RiskFinding) => {
    onSelectEntity(finding.componentId);
    onNavigate('architecture');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Top Banner: Risk Ledger & Objective 2 System Risk Score */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Architectural Risk Analysis & Engineering Quality Metrics
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wider">
                Objective 2
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic graph topology evaluation: betweenness centrality, PageRank, single points of failure, cycles, and cyclomatic complexity.
            </p>
          </div>

          {/* Overall System Risk Badge */}
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Structural Risk Score
              </div>
              <div className="text-xl font-extrabold text-slate-900 font-mono leading-none mt-0.5">
                {overallRiskScore}
                <span className="text-xs text-slate-400 font-normal"> / 100</span>
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                overallRiskScore >= 60
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : overallRiskScore >= 35
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {overallRiskScore >= 60 ? 'HIGH' : overallRiskScore >= 35 ? 'MED' : 'LOW'}
            </div>
          </div>
        </div>

        {/* 5 Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Critical Components */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs">
            <div className="text-[11px] text-rose-700 font-bold uppercase tracking-wider">
              Critical Nodes
            </div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1 font-mono">
              {analysisResult.critical_components.filter((c) => c.criticality_tier === 'CRITICAL').length}
            </div>
            <div className="text-[10px] text-rose-600 mt-0.5 truncate">High betweenness / fan-in</div>
          </div>

          {/* High Risk Dependencies */}
          <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
            <div className="text-[11px] text-amber-700 font-bold uppercase tracking-wider">
              High-Risk Deps
            </div>
            <div className="text-2xl font-extrabold text-amber-900 mt-1 font-mono">
              {analysisResult.high_risk_dependencies.filter((d) => d.risk_level === 'CRITICAL' || d.risk_level === 'HIGH').length}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5 truncate">Coupled to critical targets</div>
          </div>

          {/* Single Points of Failure */}
          <div className="bg-white p-3.5 rounded-xl border border-purple-200 shadow-2xs">
            <div className="text-[11px] text-purple-700 font-bold uppercase tracking-wider">
              SPOF Bottlenecks
            </div>
            <div className="text-2xl font-extrabold text-purple-900 mt-1 font-mono">
              {analysisResult.spofs.filter((s) => s.is_spof).length}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5 truncate">Articulation cut-vertices</div>
          </div>

          {/* Cycles Detected */}
          <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs">
            <div className="text-[11px] text-indigo-700 font-bold uppercase tracking-wider">
              Cycles Detected
            </div>
            <div className="text-2xl font-extrabold text-indigo-900 mt-1 font-mono">
              {analysisResult.complexity.cycles_count}
            </div>
            <div className="text-[10px] text-indigo-600 mt-0.5 truncate">Circular call loops</div>
          </div>

          {/* Cyclomatic Complexity */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              Complexity (M)
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {analysisResult.complexity.cyclomatic_complexity}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">M = E - V + 2P formula</div>
          </div>
        </div>
      </div>

      {/* Findings Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings, components, categories..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-violet-500"
            />
          </div>

          {/* Severity Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
            {[
              { id: 'ALL', label: `All (${findings.length})` },
              { id: 'CRITICAL', label: `Critical (${critCount})` },
              { id: 'HIGH', label: `High (${highCount})` },
              { id: 'MEDIUM', label: `Medium (${medCount})` },
              { id: 'LOW', label: `Low (${lowCount})` },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setSelectedSeverity(chip.id)}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedSeverity === chip.id
                    ? 'bg-violet-100 text-violet-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Findings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Architectural Finding</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-4">Affected Component</th>
                <th className="py-3 px-3 text-center">In-Degree / Blast</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredFindings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No findings match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFindings.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setActiveFinding(item)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-violet-700 flex items-center gap-1.5">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 max-w-md truncate">
                        {item.description}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : item.severity === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : item.severity === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium text-[11px]">
                      {item.category}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                      {item.componentName}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-mono">
                      <span className="font-bold text-slate-900">{item.blastRadius}</span> callers
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectFinding(item);
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-violet-700 hover:bg-violet-50 border border-violet-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Network className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filteredFindings.length} architectural findings</span>
          <span>Click any finding for progressive disclosure of graph metrics and paths</span>
        </div>
      </div>

      {/* Progressive Disclosure Modal */}
      {activeFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    activeFinding.severity === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : activeFinding.severity === 'HIGH'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : activeFinding.severity === 'MEDIUM'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {activeFinding.severity} SEVERITY • {activeFinding.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-2">{activeFinding.title}</h3>
              </div>
              <button
                onClick={() => setActiveFinding(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs">
              {/* Description & Remediation */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">
                    Structural Root Cause
                  </div>
                  <div className="text-slate-800 leading-relaxed mt-0.5">{activeFinding.description}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">
                    Remediation Recommendation
                  </div>
                  <div className="text-emerald-800 font-medium leading-relaxed bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 mt-0.5">
                    {activeFinding.remediation}
                  </div>
                </div>
              </div>

              {/* Exact Graph Metrics Grid (Objective 2 Progressive Disclosure) */}
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1.5">
                  Topology & Centrality Metrics
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold">Fan-In (In-Degree)</div>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{activeFinding.inDegree}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold">Fan-Out (Out-Degree)</div>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{activeFinding.outDegree}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold">Betweenness</div>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{activeFinding.betweenness}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 font-semibold">PageRank</div>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">{activeFinding.pagerank}</div>
                  </div>
                </div>
              </div>

              {/* Concrete Dependency Path */}
              {activeFinding.longestPath && activeFinding.longestPath.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">
                    Concrete Dependency Propagation Path
                  </div>
                  <div className="font-mono text-xs text-violet-800 font-semibold flex items-center flex-wrap gap-1">
                    {activeFinding.longestPath.join('  →  ')}
                  </div>
                </div>
              )}

              {/* Evidence Location */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>Source Artifact Evidence:</span>
                <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {activeFinding.evidenceFile}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveFinding(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleInspectFinding(activeFinding);
                  setActiveFinding(null);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Network className="w-3.5 h-3.5" />
                <span>Inspect in Graph</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
