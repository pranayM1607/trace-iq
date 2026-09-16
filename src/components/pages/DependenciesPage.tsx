import React, { useState, useMemo } from 'react';
import {
  Search,
  FileCode,
  Network,
  ArrowRight,
} from 'lucide-react';
import type {
  ArchitectureModel,
  ArchitectureRelationship,
} from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';

interface DependenciesPageProps {
  model: ArchitectureModel;
  onNavigate: (route: NavRoute) => void;
  onSelectEntity: (id: string) => void;
  onSelectEdge: (id: string) => void;
}

export const DependenciesPage: React.FC<DependenciesPageProps> = ({
  model,
  onNavigate,
  onSelectEntity,
  onSelectEdge,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedConfidence, setSelectedConfidence] = useState<string>('ALL');
  const [activeRel, setActiveRel] = useState<ArchitectureRelationship | null>(null);

  // Reconstructed relationships
  const relationships = model.relationships || [];

  // Metrics
  const totalCalls = relationships.filter((r) => r.type === 'CALLS').length;
  const totalDbRels = relationships.filter(
    (r) => r.type === 'QUERIES' || r.type === 'USES' || r.type === 'CONNECTS_TO'
  ).length;
  const highConfidenceCount = relationships.filter(
    (r) => r.sourceEvidence?.confidence === 'HIGH'
  ).length;

  // Filtered list
  const filteredRelationships = useMemo(() => {
    return relationships.filter((rel) => {
      // Type filter
      if (selectedType !== 'ALL' && rel.type !== selectedType) {
        return false;
      }
      // Confidence filter
      if (selectedConfidence !== 'ALL' && rel.sourceEvidence?.confidence !== selectedConfidence) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSource = rel.source.toLowerCase().includes(q);
        const matchesTarget = rel.target.toLowerCase().includes(q);
        const matchesProtocol = (rel.protocol || '').toLowerCase().includes(q);
        const matchesFile = (rel.sourceEvidence?.file || '').toLowerCase().includes(q);
        return matchesSource || matchesTarget || matchesProtocol || matchesFile;
      }
      return true;
    });
  }, [relationships, selectedType, selectedConfidence, searchQuery]);

  const handleInspectOnGraph = (rel: ArchitectureRelationship) => {
    onSelectEdge(rel.id);
    onNavigate('architecture');
  };

  const handleInspectEntity = (entityName: string) => {
    const found = model.entities.find((e) => e.name === entityName || e.id === entityName);
    if (found) {
      onSelectEntity(found.id);
      onNavigate('architecture');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Header & Metrics */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Component Dependencies & Protocol Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit inter-service communication, data-store drivers, message producers, and protocol definitions.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 font-semibold uppercase">Total Connections</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{relationships.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Across {model.entities.length} nodes</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-blue-600 font-semibold uppercase">Service Calls</div>
            <div className="text-xl font-extrabold text-blue-900 mt-1">{totalCalls}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Synchronous HTTP / RPC</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-emerald-600 font-semibold uppercase">Database Links</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-1">{totalDbRels}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">SQL / NoSQL / Key-Value</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-violet-600 font-semibold uppercase">High Confidence</div>
            <div className="text-xl font-extrabold text-violet-900 mt-1">{highConfidenceCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">AST & direct citation</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source, target, protocol..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-hidden focus:border-violet-500 cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="CALLS">CALLS</option>
              <option value="DEPENDS_ON">DEPENDS_ON</option>
              <option value="USES">USES</option>
              <option value="CONNECTS_TO">CONNECTS_TO</option>
              <option value="QUERIES">QUERIES</option>
              <option value="IMPORTS">IMPORTS</option>
              <option value="EXPOSES">EXPOSES</option>
            </select>

            {/* Confidence Filter */}
            <select
              value={selectedConfidence}
              onChange={(e) => setSelectedConfidence(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-hidden focus:border-violet-500 cursor-pointer"
            >
              <option value="ALL">All Confidence</option>
              <option value="HIGH">High Confidence</option>
              <option value="MEDIUM">Medium Confidence</option>
              <option value="LOW">Low Confidence</option>
            </select>
          </div>
        </div>

        {/* Clean Findings-Style Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Source Component</th>
                <th className="py-3 px-2 text-center w-8">Dir</th>
                <th className="py-3 px-4">Target Component</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Protocol / Port</th>
                <th className="py-3 px-3">Confidence</th>
                <th className="py-3 px-4">Source Evidence</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRelationships.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No dependencies match your current filters.
                  </td>
                </tr>
              ) : (
                filteredRelationships.map((rel) => {
                  const confidence = rel.sourceEvidence?.confidence || 'MEDIUM';
                  return (
                    <tr
                      key={rel.id}
                      onClick={() => setActiveRel(rel)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td
                        className="py-3 px-4 font-semibold text-slate-900 group-hover:text-violet-700 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectEntity(rel.source);
                        }}
                      >
                        {rel.source}
                      </td>
                      <td className="py-3 px-2 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 inline-block text-slate-400 group-hover:text-violet-600" />
                      </td>
                      <td
                        className="py-3 px-4 font-semibold text-slate-900 group-hover:text-violet-700 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectEntity(rel.target);
                        }}
                      >
                        {rel.target}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {rel.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                        {rel.protocol || 'Default'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            confidence === 'HIGH'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : confidence === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              confidence === 'HIGH'
                                ? 'bg-emerald-500'
                                : confidence === 'MEDIUM'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {confidence}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]" title={rel.sourceEvidence?.file}>
                        {rel.sourceEvidence?.file || 'Model inference'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectOnGraph(rel);
                          }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-violet-700 hover:bg-violet-50 border border-violet-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Network className="w-3 h-3" />
                          <span>Graph</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {filteredRelationships.length} of {relationships.length} dependencies</span>
          <span>Click any row to inspect code citation</span>
        </div>
      </div>

      {/* Selected Relationship Detail Modal/Drawer */}
      {activeRel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Dependency Citation</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {activeRel.source} → {activeRel.target}
                </h3>
              </div>
              <button
                onClick={() => setActiveRel(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Type</div>
                  <div className="font-bold text-slate-800">{activeRel.type}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Protocol</div>
                  <div className="font-mono text-slate-800">{activeRel.protocol || 'Default Protocol'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Confidence</div>
                  <div className="font-bold text-slate-800">{activeRel.sourceEvidence?.confidence || 'MEDIUM'}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Extraction Method</div>
                  <div className="text-slate-800">{activeRel.sourceEvidence?.method || 'AST Dependency Scanner'}</div>
                </div>
              </div>

              {activeRel.sourceEvidence && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-violet-600" />
                    <span>Source Evidence File:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs">
                    <div>{activeRel.sourceEvidence.file}</div>
                    {activeRel.sourceEvidence.snippet && (
                      <div className="mt-2 text-emerald-400 text-[11px] pt-2 border-t border-slate-700">
                        {activeRel.sourceEvidence.snippet}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveRel(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleInspectOnGraph(activeRel);
                  setActiveRel(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
              >
                Inspect on Graph
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
