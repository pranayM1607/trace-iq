import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  Boxes,
  Database,
  Globe,
  Server,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Code2,
  FileSpreadsheet,
  Network
} from 'lucide-react';
import type { ArchitectureModel } from '../../types/analysis';
import { CodebaseGraph } from '../graph/CodebaseGraph';

interface CodebaseInventoryViewProps {
  architecture: ArchitectureModel;
  onSelectComponent: (componentId: string) => void;
  onSwitchToGraphView: () => void;
}

export const CodebaseInventoryView: React.FC<CodebaseInventoryViewProps> = ({
  architecture,
  onSelectComponent,
  onSwitchToGraphView,
}) => {
  const inventory = architecture.inventory;
  const [activeTab, setActiveTab] = useState<'modules' | 'files' | 'graph' | 'manifests' | 'evidence'>('modules');
  const [fileCategoryFilter, setFileCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'source':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'manifest':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'config':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'test':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'script':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'documentation':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getLanguageColor = (lang?: string | null) => {
    switch (lang) {
      case 'TypeScript':
        return 'bg-blue-100 text-blue-800';
      case 'JavaScript':
        return 'bg-amber-100 text-amber-800';
      case 'Python':
        return 'bg-emerald-100 text-emerald-800';
      case 'Go':
        return 'bg-cyan-100 text-cyan-800';
      case 'Java':
        return 'bg-orange-100 text-orange-800';
      case 'C#':
        return 'bg-purple-100 text-purple-800';
      case 'Rust':
        return 'bg-rose-100 text-rose-800';
      case 'Ruby':
        return 'bg-red-100 text-red-800';
      case 'PHP':
        return 'bg-indigo-100 text-indigo-800';
      case 'SQL':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!inventory?.files) return [];
    return inventory.files.filter((f) => {
      const matchCat = fileCategoryFilter === 'ALL' || f.category === fileCategoryFilter;
      const matchSearch =
        !searchTerm.trim() ||
        f.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.language && f.language.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [inventory?.files, fileCategoryFilter, searchTerm]);

  if (!inventory) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f8fafc]">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center shadow-xs">
          <FolderTree className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">No Codebase Inventory</h3>
          <p className="text-xs text-slate-500 mb-4">
            Upload a codebase ZIP repository to extract and inspect the complete file hierarchy, modules, and source evidence.
          </p>
          <button
            onClick={onSwitchToGraphView}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
          >
            Switch to Graph View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-[#f8fafc] font-sans">
      {/* Top Banner for Limited Architecture if applicable */}
      {inventory.is_limited_architecture && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between z-20 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Limited Architecture Detected:</strong>{' '}
              {inventory.limited_architecture_reason ||
                'Service-level boundaries could not be confidently inferred from this codebase.'}
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium hidden md:inline">
            Showing all detected modules & files below
          </span>
        </div>
      )}

      {/* Header Summary Card */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-violet-100 text-violet-700">
                Codebase Inventory
              </span>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {architecture.systemName}
              </h2>
              <span className="text-xs text-slate-400 font-mono">v{architecture.version || '1.0.0'}</span>
            </div>
            <p className="text-xs text-slate-500">
              {inventory.detection_summary ||
                `Cataloged ${inventory.total_files} files across ${inventory.total_folders} directories.`}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 lg:pb-0">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
              <span className="block text-xs font-bold text-slate-800">{inventory.total_files}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Files</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
              <span className="block text-xs font-bold text-slate-800">{inventory.total_folders}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Folders</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
              <span className="block text-xs font-bold text-slate-800">{inventory.total_lines.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Lines</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
              <span className="block text-xs font-bold text-violet-700">{architecture.entities.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Entities</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-center min-w-[70px]">
              <span className="block text-xs font-bold text-indigo-700">{architecture.relationships.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Edges</span>
            </div>
          </div>
        </div>

        {/* Languages & Frameworks Distribution Row */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Languages */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Languages:</span>
            {Object.entries(inventory.languages).map(([lang, count]) => (
              <span
                key={lang}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getLanguageColor(lang)}`}
              >
                {lang} <span className="opacity-70 font-normal">({count})</span>
              </span>
            ))}
          </div>

          {/* Frameworks */}
          {inventory.frameworks && inventory.frameworks.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px] font-medium mr-1">Frameworks & Tools:</span>
              {inventory.frameworks.slice(0, 7).map((fw) => (
                <span
                  key={fw}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {fw}
                </span>
              ))}
              {inventory.frameworks.length > 7 && (
                <span className="text-[11px] text-slate-400">+{inventory.frameworks.length - 7} more</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Tabs & Body */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tab Navigation */}
        <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'modules'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Architecture & Modules ({architecture.entities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'files'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>File Inventory ({inventory.total_files})</span>
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'graph'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>
              Codebase Graph ({architecture.codebaseGraph?.edges.length ?? inventory.file_dependencies?.length ?? 0})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('manifests')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'manifests'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Manifests & Dependencies ({inventory.manifests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'evidence'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Source Provenance</span>
          </button>
        </div>

        {/* Tab 1: Architecture & Modules Tree */}
        {activeTab === 'modules' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Extracted Architecture Components & Associated Files
                </h3>
                <span className="text-xs text-slate-400">
                  Click any component to inspect its associated codebase files or view it in the graph
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {architecture.entities.map((entity) => {
                  const isExpanded = expandedModules[entity.id] ?? false;
                  const associatedFiles = entity.associatedFiles || [];

                  return (
                    <div
                      key={entity.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-violet-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-violet-50 text-violet-600 shrink-0">
                            {entity.type === 'Database' ? (
                              <Database className="w-4 h-4" />
                            ) : entity.type === 'API' ? (
                              <Globe className="w-4 h-4" />
                            ) : entity.type === 'Module' ? (
                              <Boxes className="w-4 h-4" />
                            ) : (
                              <Server className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              {entity.name}
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-600">
                                {entity.type}
                              </span>
                            </h4>
                            <p className="text-xs text-slate-500 line-clamp-1">{entity.description}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            onSelectComponent(entity.id);
                            onSwitchToGraphView();
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg border border-violet-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="View on Canvas"
                        >
                          <span>Graph</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Provenance Badge */}
                      {entity.sourceEvidence && (
                        <div className="mt-3 bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs">
                          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                            <span className="font-semibold text-slate-700">
                              Method: {entity.sourceEvidence.detectionMethod || 'Code Analysis'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {entity.sourceEvidence.file}
                              {entity.sourceEvidence.line ? `:${entity.sourceEvidence.line}` : ''}
                            </span>
                          </div>
                          {entity.sourceEvidence.snippet && (
                            <pre className="text-[10.5px] font-mono text-slate-700 bg-white p-1.5 rounded border border-slate-200 overflow-x-auto whitespace-pre-wrap">
                              {entity.sourceEvidence.snippet}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Associated Files Toggle */}
                      {associatedFiles.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          <button
                            onClick={() => toggleModule(entity.id)}
                            className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              Associated Source Files ({associatedFiles.length})
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {isExpanded ? 'Hide' : 'Expand'}
                            </span>
                          </button>

                          {isExpanded && (
                            <ul className="mt-2 space-y-1 pl-5 text-xs text-slate-600 font-mono">
                              {associatedFiles.map((file) => (
                                <li key={file} className="truncate text-[11px] text-slate-600 hover:text-slate-900">
                                  📄 {file}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: File Inventory Explorer */}
        {activeTab === 'files' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              {/* Filter & Search Bar */}
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['ALL', 'source', 'manifest', 'config', 'test', 'script', 'documentation', 'other'].map(
                    (cat) => {
                      const count =
                        cat === 'ALL'
                          ? inventory.total_files
                          : inventory.categories_breakdown[cat] || 0;
                      if (count === 0 && cat !== 'ALL') return null;

                      return (
                        <button
                          key={cat}
                          onClick={() => setFileCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            fileCategoryFilter === cat
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {cat.toUpperCase()} ({count})
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Search Input */}
                <div className="relative min-w-[240px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search file path or extension..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Files Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <th className="py-2.5 px-4">File Path</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Language</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Lines</th>
                      <th className="py-2.5 px-4">Associated Entity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {filteredFiles.map((file) => (
                      <tr key={file.path} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-4 text-slate-800 font-medium truncate max-w-xs">
                          {file.path}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getCategoryColor(
                              file.category
                            )}`}
                          >
                            {file.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-sans">
                          {file.language || file.extension}
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono">
                          {formatFileSize(file.size_bytes)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono">
                          {file.lines_count !== null && file.lines_count !== undefined
                            ? file.lines_count
                            : '—'}
                        </td>
                        <td className="py-2 px-4 font-sans text-slate-600">
                          {file.associated_entity_id ? (
                            <span className="text-violet-700 bg-violet-50 px-2 py-0.5 rounded font-semibold text-[10.5px]">
                              {file.associated_entity_id}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10.5px]">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredFiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-sans text-xs">
                          No files matching current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Interactive Codebase Graph */}
        {activeTab === 'graph' && (
          <div className="flex-1 h-full w-full relative overflow-hidden">
            <CodebaseGraph
              architecture={architecture}
              onSwitchToArchitecture={onSwitchToGraphView}
              onSelectComponentInArchitecture={onSelectComponent}
            />
          </div>
        )}

        {/* Tab 3: Manifests & Dependencies */}
        {activeTab === 'manifests' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Detected Build & Package Manifests
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inventory.manifests.map((manPath) => (
                  <div key={manPath} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                      <h4 className="text-xs font-bold font-mono text-slate-900">{manPath}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Software dependency manifest used to extract services, external packages, and infrastructure connections.
                    </p>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                        Detected External Packages:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {inventory.packages.map((pkg) => (
                          <span
                            key={pkg}
                            className="px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-white border border-slate-200 text-slate-700"
                          >
                            {pkg}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Source Evidence & Provenance */}
        {activeTab === 'evidence' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Source Evidence & Algorithmic Provenance Log
              </h3>
              <p className="text-xs text-slate-500">
                Every architectural component and dependency edge extracted by TraceIQ retains verifiable provenance linking directly to repository files and source code snippets.
              </p>

              <div className="space-y-3">
                {architecture.entities.map((e) => (
                  <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{e.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-100 text-slate-600">
                          {e.type}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-violet-700">
                        {e.sourceEvidence?.detectionMethod || 'Direct Detection'}
                      </span>
                    </div>

                    {e.sourceEvidence ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            File: <strong className="font-mono text-slate-700">{e.sourceEvidence.file}</strong>
                          </span>
                          {e.sourceEvidence.line && <span>Line: {e.sourceEvidence.line}</span>}
                        </div>
                        {e.sourceEvidence.snippet && (
                          <pre className="text-[10.5px] font-mono text-slate-800 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap mt-1.5">
                            {e.sourceEvidence.snippet}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No source snippet recorded.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default CodebaseInventoryView;
