import React, { useState, useMemo } from 'react';
import {
  Search,
  Copy,
  Check,
} from 'lucide-react';
import type { ArchitectureModel, EvidenceConfidence } from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';

interface EvidenceItem {
  id: string;
  sourceEntity: string;
  targetEntity?: string;
  type: string;
  file: string;
  line?: number;
  statement?: string;
  snippet?: string;
  confidence: EvidenceConfidence;
  extractionMethod: string;
  description?: string;
}

interface EvidencePageProps {
  model: ArchitectureModel;
  onNavigate: (route: NavRoute) => void;
  onSelectEntity: (id: string) => void;
}

export const EvidencePage: React.FC<EvidencePageProps> = ({
  model,
  onNavigate,
  onSelectEntity,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConfidence, setSelectedConfidence] = useState<string>('ALL');
  const [activeEvidence, setActiveEvidence] = useState<EvidenceItem | null>(null);
  const [copied, setCopied] = useState(false);

  // Compile all evidence items from entities and relationships
  const evidenceList = useMemo<EvidenceItem[]>(() => {
    const items: EvidenceItem[] = [];

    // From Relationships
    (model.relationships || []).forEach((rel) => {
      if (rel.sourceEvidence) {
        items.push({
          id: `rel-${rel.id}`,
          sourceEntity: rel.source,
          targetEntity: rel.target,
          type: rel.type,
          file: rel.sourceEvidence.file || 'topology-manifest',
          line: rel.sourceEvidence.line,
          statement: rel.sourceEvidence.statement,
          snippet: rel.sourceEvidence.snippet,
          confidence: rel.sourceEvidence.confidence || 'HIGH',
          extractionMethod: rel.sourceEvidence.method || 'AST Dependency Scanner',
          description: rel.sourceEvidence.description || `${rel.source} ${rel.type} ${rel.target}`,
        });
      }
    });

    // From Entities metadata
    (model.entities || []).forEach((ent) => {
      if (ent.metadata?.filePath) {
        items.push({
          id: `ent-${ent.id}`,
          sourceEntity: ent.name,
          type: ent.type,
          file: ent.metadata.filePath,
          confidence: 'HIGH',
          extractionMethod: ent.source === 'Detected' ? 'AST Module Parser' : 'Manifest Scanner',
          description: `Discovered ${ent.type} component defined in ${ent.metadata.filePath}`,
          snippet: ent.description ? `// Definition:\n${ent.description}` : undefined,
        });
      }
    });

    return items;
  }, [model]);

  // Metrics
  const highConfidenceCount = evidenceList.filter((e) => e.confidence === 'HIGH').length;
  const astCount = evidenceList.filter((e) => e.extractionMethod.includes('AST')).length;
  const manifestCount = evidenceList.filter((e) => e.extractionMethod.includes('Manifest')).length;

  // Filtered
  const filteredList = useMemo(() => {
    return evidenceList.filter((item) => {
      if (selectedConfidence !== 'ALL' && item.confidence !== selectedConfidence) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.file.toLowerCase().includes(q) ||
          item.sourceEntity.toLowerCase().includes(q) ||
          (item.targetEntity && item.targetEntity.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [evidenceList, selectedConfidence, searchQuery]);

  const handleCopySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Source Evidence Provenance Catalog
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographic-style traceability connecting high-level architecture components to exact repository source files and statements.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 font-semibold uppercase">Total Citations</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{evidenceList.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Verified code statements</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-emerald-600 font-semibold uppercase">High Confidence</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-1">{highConfidenceCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Explicit import / client call</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-violet-600 font-semibold uppercase">AST Derived</div>
            <div className="text-xl font-extrabold text-violet-900 mt-1">{astCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Static syntax tree nodes</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-indigo-600 font-semibold uppercase">Manifest Derived</div>
            <div className="text-xl font-extrabold text-indigo-900 mt-1">{manifestCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Package & deployment specs</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file path, component, statement..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-violet-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {/* Confidence Filter */}
            <select
              value={selectedConfidence}
              onChange={(e) => setSelectedConfidence(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-hidden focus:border-violet-500 cursor-pointer"
            >
              <option value="ALL">All Confidence Levels</option>
              <option value="HIGH">High Confidence</option>
              <option value="MEDIUM">Medium Confidence</option>
              <option value="LOW">Low Confidence</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Subject Component</th>
                <th className="py-3 px-3">Relationship / Role</th>
                <th className="py-3 px-4">Source File Path</th>
                <th className="py-3 px-3">Extraction Method</th>
                <th className="py-3 px-3">Confidence</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No evidence records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setActiveEvidence(item)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td
                      className="py-3 px-4 font-bold text-slate-900 group-hover:text-violet-700 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspectEntity(item.sourceEntity);
                      }}
                    >
                      {item.sourceEntity}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        {item.type} {item.targetEntity ? `→ ${item.targetEntity}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 truncate max-w-xs" title={item.file}>
                      {item.file} {item.line ? `:${item.line}` : ''}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {item.extractionMethod}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          item.confidence === 'HIGH'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.confidence === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.confidence === 'HIGH' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        {item.confidence}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveEvidence(item);
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-violet-700 hover:bg-violet-50 border border-violet-200 transition-colors cursor-pointer"
                      >
                        Snippet
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
          <span>Showing {filteredList.length} evidence citations</span>
          <span className="text-emerald-700 font-medium">Objective 1 Ground Truth</span>
        </div>
      </div>

      {/* Snippet Modal */}
      {activeEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Source Provenance Citation
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {activeEvidence.sourceEntity} {activeEvidence.targetEntity ? `→ ${activeEvidence.targetEntity}` : ''}
                </h3>
              </div>
              <button
                onClick={() => setActiveEvidence(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-[11px] text-slate-500">File Path</div>
                <div className="font-mono text-xs font-bold text-slate-800 break-all">
                  {activeEvidence.file}
                </div>
                {activeEvidence.description && (
                  <div className="text-[11px] text-slate-600 mt-1 pt-1 border-t border-slate-200">
                    {activeEvidence.description}
                  </div>
                )}
              </div>

              {activeEvidence.snippet && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Code Statement Snippet:</span>
                    <button
                      onClick={() => handleCopySnippet(activeEvidence.snippet || '')}
                      className="text-[10px] text-violet-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
                    {activeEvidence.snippet}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveEvidence(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
