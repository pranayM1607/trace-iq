import React, { useState, useMemo } from 'react';
import {
  X,
  FileCode,
  Search,
  CheckCircle2,
  FileArchive,
} from 'lucide-react';
import type {
  CodebaseInventory,
  FileCategory,
} from '../../types/architecture';

interface CodebaseInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory?: CodebaseInventory;
  systemName: string;
}

export const CodebaseInventoryModal: React.FC<CodebaseInventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  systemName,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'dependencies' | 'manifests'>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'ALL'>('ALL');

  // Filter files
  const filteredFiles = useMemo(() => {
    if (!inventory) return [];
    return inventory.files.filter((f) => {
      const matchSearch =
        f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.language && f.language.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory = selectedCategory === 'ALL' || f.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [inventory, searchQuery, selectedCategory]);

  if (!isOpen || !inventory) return null;

  const categoryBadge = (cat: FileCategory) => {
    switch (cat) {
      case 'source':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'manifest':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'config':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'dataset':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'model_artifact':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'documentation':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'asset':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'unanalyzed':
      case 'unsupported':
      case 'unknown':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Codebase Inventory (Level 1)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  100% File Retention
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {systemName} — Complete catalog of {inventory.total_files} files and {inventory.total_folders} folders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-white border-b border-slate-100 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Files</span>
            <span className="text-xl font-bold text-slate-900">{inventory.total_files}</span>
            <span className="text-[10px] text-slate-500 ml-1">in {inventory.total_folders} folders</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Source Lines</span>
            <span className="text-xl font-bold text-blue-600">{inventory.total_lines.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 ml-1">LOC</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Languages</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {Object.keys(inventory.languages).slice(0, 4).map((lang) => (
                <span key={lang} className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-700 font-medium">
                  {lang} ({inventory.languages[lang]})
                </span>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">External Dependencies</span>
            <span className="text-xl font-bold text-indigo-600">{inventory.external_dependencies.length}</span>
            <span className="text-[10px] text-slate-500 ml-1">packages cataloged</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 border-b border-slate-200 bg-slate-50/50">
          <div className="flex gap-1 py-2">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'files'
                  ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Files ({inventory.total_files})
            </button>
            <button
              onClick={() => setActiveTab('dependencies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'dependencies'
                  ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              External Dependencies ({inventory.external_dependencies.length})
            </button>
            <button
              onClick={() => setActiveTab('manifests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'manifests'
                  ? 'bg-white text-purple-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Manifests & Config ({inventory.manifests.length})
            </button>
          </div>

          {activeTab === 'files' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search files or languages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-400 w-52"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-purple-400 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="source">Source Code</option>
                <option value="manifest">Manifests</option>
                <option value="dataset">Datasets</option>
                <option value="model_artifact">Model Artifacts</option>
                <option value="config">Configuration</option>
                <option value="documentation">Documentation</option>
                <option value="asset">Assets</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'files' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">File Path</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Analysis Status</th>
                    <th className="py-2.5 px-3">Language</th>
                    <th className="py-2.5 px-3 text-right">Size</th>
                    <th className="py-2.5 px-3 text-right">Lines</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No files matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-4 font-mono text-slate-800 text-[11px] break-all">
                          {file.path}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${categoryBadge(file.category)}`}>
                            {file.category}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              file.analysis_status?.includes('mapped')
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : file.analysis_status?.includes('internal') || file.analysis_status?.includes('dependency')
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : file.analysis_status?.includes('manifest') || file.analysis_status?.includes('configuration')
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {file.analysis_status || 'Retained — semantic analysis unavailable'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium">
                          {file.language || '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 font-mono text-[11px]">
                          {formatBytes(file.size_bytes)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 font-mono text-[11px]">
                          {file.lines_count && file.lines_count > 0 ? file.lines_count.toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Third-Party & External Dependencies:</span> These packages were detected from manifests (requirements.txt, package.json, pom.xml, go.mod) and external imports. In Level 2, they remain cleanly distinguished from internal services.
                </div>
              </div>

              {inventory.external_dependencies.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  No external manifest dependencies detected.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {inventory.external_dependencies.map((dep, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 text-xs truncate">
                          {dep.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {dep.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono truncate">
                        Manifest: {dep.manifest.split('/').pop()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manifests' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Detected Build & Orchestration Manifests ({inventory.manifests.length})
              </h4>
              <div className="space-y-2">
                {inventory.manifests.map((m, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileCode className="w-4 h-4 text-purple-600" />
                      <span className="font-mono text-xs text-slate-800 font-semibold">{m}</span>
                    </div>
                    <span className="text-[10px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                      Verified Manifest
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>{inventory.total_files} total files retained • Level 1 Verification Complete</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
