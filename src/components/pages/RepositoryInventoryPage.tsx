import React, { useState, useMemo } from 'react';
import {
  FileCode,
  Search,
  CheckCircle2,
  Copy,
  Check,
  File,
} from 'lucide-react';
import type { ArchitectureModel } from '../../types/architecture';

interface RepositoryInventoryPageProps {
  model: ArchitectureModel;
}

export const RepositoryInventoryPage: React.FC<RepositoryInventoryPageProps> = ({ model }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'raw_blueprint'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [copiedJson, setCopiedJson] = useState(false);

  const inventory = model.inventory;
  const files = inventory?.files || [];
  const totalFiles = inventory?.total_files || files.length;
  const totalFolders = inventory?.total_folders || 0;

  // Compute breakdown counts
  const manifestCount = files.filter(
    (f) =>
      f.path.endsWith('package.json') ||
      f.path.endsWith('pom.xml') ||
      f.path.endsWith('requirements.txt') ||
      f.path.endsWith('go.mod') ||
      f.path.endsWith('build.gradle') ||
      f.path.endsWith('Cargo.toml')
  ).length;

  const parsedCount = files.filter((f) => f.analysis_status === 'parsed').length;

  // Filtered files list
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Classification filter
      if (selectedFilter === 'parsed' && file.analysis_status !== 'parsed') {
        return false;
      }
      if (selectedFilter === 'manifests') {
        const isManifest =
          file.path.endsWith('package.json') ||
          file.path.endsWith('pom.xml') ||
          file.path.endsWith('requirements.txt') ||
          file.path.endsWith('go.mod') ||
          file.path.endsWith('build.gradle') ||
          file.path.endsWith('Cargo.toml');
        if (!isManifest) return false;
      }
      if (selectedFilter === 'binary' && file.analysis_status !== 'unsupported_binary' && file.analysis_status !== 'ignored') {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return file.path.toLowerCase().includes(q) || file.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [files, selectedFilter, searchQuery]);

  const handleCopyJson = () => {
    if (model.rawJsonString) {
      navigator.clipboard.writeText(model.rawJsonString);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Repository Inventory & File Preservation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete Level 1 inventory guaranteeing 100% file retention across ZIP archives and JSON blueprints.
          </p>
        </div>

        {/* Tab Switcher if raw blueprint JSON exists */}
        {model.rawJsonString && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Files Catalog ({totalFiles})
            </button>
            <button
              onClick={() => setActiveTab('raw_blueprint')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'raw_blueprint'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw Blueprint JSON
            </button>
          </div>
        )}
      </div>

      {/* Mode 1: Inventory Table */}
      {activeTab === 'inventory' && (
        <>
          {/* Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Files Discovered</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">{totalFiles}</div>
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>100% Preserved</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Directories</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">{totalFolders}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Directory hierarchy</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-indigo-600 font-semibold uppercase">Manifest Files</div>
              <div className="text-xl font-extrabold text-indigo-900 mt-1">{manifestCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">package.json, pom.xml, etc.</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-violet-600 font-semibold uppercase">Parsed & Analyzed</div>
              <div className="text-xl font-extrabold text-violet-900 mt-1">{parsedCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">AST & regex mapped</div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Filter Controls */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by file path or name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-violet-500"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
                {[
                  { id: 'all', label: `All (${files.length})` },
                  { id: 'parsed', label: `Parsed (${parsedCount})` },
                  { id: 'manifests', label: `Manifests (${manifestCount})` },
                  { id: 'binary', label: 'Binary / Other' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => setSelectedFilter(chip.id)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                      selectedFilter === chip.id
                        ? 'bg-violet-100 text-violet-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Discovered File Path</th>
                    <th className="py-3 px-3">Extension</th>
                    <th className="py-3 px-3">Size (Bytes)</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-4">Processing Status</th>
                    <th className="py-3 px-4 text-right">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No files match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file, idx) => {
                      const ext = file.extension || (file.path.includes('.') ? file.path.split('.').pop() : '-');
                      const sizeKb = file.size_bytes ? (file.size_bytes > 1024 ? `${(file.size_bytes / 1024).toFixed(1)} KB` : `${file.size_bytes} B`) : '-';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-900 flex items-center gap-2">
                            <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-md" title={file.path}>
                              {file.path}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            .{ext}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {sizeKb}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {file.category || 'Source / Text'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                file.analysis_status === 'parsed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : file.analysis_status === 'manifest'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  file.analysis_status === 'parsed'
                                    ? 'bg-emerald-500'
                                    : file.analysis_status === 'manifest'
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              {file.analysis_status || 'retained'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              RETAINED (100%)
                            </span>
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
              <span>Showing {filteredFiles.length} of {files.length} preserved repository items</span>
              <span className="text-emerald-700 font-medium">Level 1 Complete Inventory</span>
            </div>
          </div>
        </>
      )}

      {/* Mode 2: Raw Blueprint JSON */}
      {activeTab === 'raw_blueprint' && model.rawJsonString && (
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-white font-mono">
                verbatim_payload_{model.systemName.toLowerCase().replace(/\s+/g, '_')}.json
              </span>
            </div>
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          <pre className="overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-h-[600px] p-2 select-text">
            {model.rawJsonString}
          </pre>
        </div>
      )}
    </div>
  );
};
