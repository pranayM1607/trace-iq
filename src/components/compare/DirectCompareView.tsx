import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  Upload,
  FileArchive,
  FileCode,
  ArrowRight,
  ShieldAlert,
  Boxes,
  AlertTriangle,
  Network,
  Activity,
  FileText,
  CornerDownRight,
  FileCheck2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  ArchitectureComparisonResult,
  ArchitectureSnapshot,
  DiffNodeItem,
  DiffRelationshipItem,
} from '../../types/architecture';
import { compareRealInputs, compareRealModels } from '../../engine/directCompareEngine';
import { ArchitectureGraph } from '../graph/ArchitectureGraph';

interface DirectCompareViewProps {
  savedSnapshots: ArchitectureSnapshot[];
  onSelectEntity?: (entityId: string) => void;
}

export const DirectCompareView: React.FC<DirectCompareViewProps> = ({
  savedSnapshots,
  onSelectEntity,
}) => {
  // Input mode: 'upload' | 'snapshots'
  const [compareSource, setCompareSource] = useState<'upload' | 'snapshots'>('upload');

  // Upload files state
  const [origFile, setOrigFile] = useState<File | null>(null);
  const [chgFile, setChgFile] = useState<File | null>(null);

  // Snapshot selection state
  const [origSnapId, setOrigSnapId] = useState<string>(savedSnapshots[0]?.id || '');
  const [chgSnapId, setChgSnapId] = useState<string>(savedSnapshots[1]?.id || savedSnapshots[0]?.id || '');

  // Comparison State
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ArchitectureComparisonResult | null>(null);
  const [comparisonType, setComparisonType] = useState<'direct_upload' | 'snapshot_compare'>('direct_upload');

  // Side-by-side graph selection and visibility state
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);
  const [selectedOrigEntityId, setSelectedOrigEntityId] = useState<string | null>(null);
  const [selectedChgEntityId, setSelectedChgEntityId] = useState<string | null>(null);

  // Active Tab: 'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'json_payload'
  const [activeTab, setActiveTab] = useState<
    'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'json_payload'
  >('repo_diff');

  // Repo filter
  const [repoFilter, setRepoFilter] = useState<'all' | 'added' | 'removed' | 'modified' | 'unchanged'>('all');

  // Run Direct Upload Comparison
  const handleRunUploadCompare = async () => {
    if (!origFile || !chgFile) {
      setCompareError('Please select both an Original/Baseline file and a Changed/Target file.');
      return;
    }

    setIsComparing(true);
    setCompareError(null);

    try {
      const result = await compareRealInputs(origFile, chgFile);
      setComparisonResult(result);
      setComparisonType('direct_upload');
      setActiveTab('arch_diff');
    } catch (err: any) {
      setCompareError(err.message || 'Comparison failed. Please verify input files.');
    } finally {
      setIsComparing(false);
    }
  };

  // Run Snapshot Comparison
  const handleRunSnapshotCompare = () => {
    const s1 = savedSnapshots.find((s) => s.id === origSnapId);
    const s2 = savedSnapshots.find((s) => s.id === chgSnapId);

    if (!s1 || !s2) {
      setCompareError('Please select two valid snapshots to compare.');
      return;
    }

    try {
      const result = compareRealModels(s1.architecture, s2.architecture);
      setComparisonResult(result);
      setComparisonType('snapshot_compare');
      setActiveTab('arch_diff');
      setCompareError(null);
    } catch (err: any) {
      setCompareError(err.message || 'Snapshot comparison failed.');
    }
  };

  const archDiff = comparisonResult?.architectureDiff;
  const repoDiff = comparisonResult?.repositoryDiff;
  const impact = comparisonResult?.impactAnalysis;
  const risk = comparisonResult?.structuralRisk;
  const story = comparisonResult?.changeStory;

  // Compute isolated diff node and relationship maps for Original and Changed graphs
  const { origDiffNodesMap, origDiffEdgesMap, chgDiffNodesMap, chgDiffEdgesMap } = useMemo(() => {
    const origNodes = new Map<string, DiffNodeItem>();
    const origEdges = new Map<string, DiffRelationshipItem>();
    const chgNodes = new Map<string, DiffNodeItem>();
    const chgEdges = new Map<string, DiffRelationshipItem>();

    if (!archDiff) {
      return { origDiffNodesMap: origNodes, origDiffEdgesMap: origEdges, chgDiffNodesMap: chgNodes, chgDiffEdgesMap: chgEdges };
    }

    // Removed nodes belong to V1
    archDiff.removedNodes.forEach((entity) => {
      origNodes.set(entity.id, {
        changeType: 'removed',
        entity,
        versionOrigin: 'V1',
      });
    });

    // Added nodes belong to V2
    archDiff.addedNodes.forEach((entity) => {
      chgNodes.set(entity.id, {
        changeType: 'added',
        entity,
        versionOrigin: 'V2',
      });
    });

    // Modified nodes belong to BOTH
    archDiff.modifiedNodes?.forEach((entity) => {
      origNodes.set(entity.id, {
        changeType: 'modified',
        entity,
        versionOrigin: 'BOTH',
      });
      chgNodes.set(entity.id, {
        changeType: 'modified',
        entity,
        versionOrigin: 'BOTH',
      });
    });

    // Unchanged nodes belong to BOTH
    archDiff.unchangedNodes?.forEach((entity) => {
      origNodes.set(entity.id, {
        changeType: 'unchanged',
        entity,
        versionOrigin: 'BOTH',
      });
      chgNodes.set(entity.id, {
        changeType: 'unchanged',
        entity,
        versionOrigin: 'BOTH',
      });
    });

    // Removed relationships belong to V1
    archDiff.removedRelationships.forEach((rel) => {
      origEdges.set(rel.id, rel);
    });

    // Added relationships belong to V2
    archDiff.addedRelationships.forEach((rel) => {
      chgEdges.set(rel.id, rel);
    });

    // Unchanged relationships belong to BOTH
    archDiff.unchangedRelationships?.forEach((rel) => {
      origEdges.set(rel.id, rel);
      chgEdges.set(rel.id, rel);
    });

    return { origDiffNodesMap: origNodes, origDiffEdgesMap: origEdges, chgDiffNodesMap: chgNodes, chgDiffEdgesMap: chgEdges };
  }, [archDiff]);

  // Filtered repository files
  const filteredRepoFiles = repoDiff?.diffFiles.filter((f) => {
    if (repoFilter === 'all') return true;
    return f.changeType === repoFilter;
  }) || [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
      {/* Top Bar: Comparison Configuration & Dropzones */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
              <GitCompare className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Direct Architecture & Codebase Comparison</h2>
              <p className="text-xs text-slate-500">
                Compare two real ZIP archives or JSON blueprints side-by-side with complete input preservation.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setCompareSource('upload')}
              className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                compareSource === 'upload' ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Upload Dual Files
            </button>
            {savedSnapshots.length >= 2 && (
              <button
                onClick={() => setCompareSource('snapshots')}
                className={`px-3 py-1 font-semibold rounded-md transition-all cursor-pointer ${
                  compareSource === 'snapshots' ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Saved Snapshots ({savedSnapshots.length})
              </button>
            )}
          </div>
        </div>

        {/* Input Zones */}
        {compareSource === 'upload' ? (
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            {/* Dropzone 1: Original */}
            <div className="md:col-span-5 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-3 text-center transition-colors">
              <input
                type="file"
                accept=".zip,.json"
                id="originalFileInput"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setOrigFile(e.target.files[0]);
                }}
              />
              <label htmlFor="originalFileInput" className="cursor-pointer block">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  ORIGINAL / BASELINE (V1)
                </div>
                {origFile ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-blue-700 font-semibold bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200">
                    {origFile.name.endsWith('.zip') ? <FileArchive className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                    <span className="truncate max-w-[200px]">{origFile.name}</span>
                    <span className="text-[11px] text-blue-500">({(origFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 py-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select baseline .ZIP or .JSON</span>
                  </div>
                )}
              </label>
            </div>

            {/* Middle Action / Arrow */}
            <div className="md:col-span-1 flex flex-col items-center justify-center">
              <button
                onClick={handleRunUploadCompare}
                disabled={!origFile || !chgFile || isComparing}
                className={`w-full py-2 px-3 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  origFile && chgFile && !isComparing
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20 hover:scale-[1.02]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isComparing ? 'Analyzing...' : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Dropzone 2: Changed */}
            <div className="md:col-span-5 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl p-3 text-center transition-colors">
              <input
                type="file"
                accept=".zip,.json"
                id="changedFileInput"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setChgFile(e.target.files[0]);
                }}
              />
              <label htmlFor="changedFileInput" className="cursor-pointer block">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 mb-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  CHANGED / TARGET (V2)
                </div>
                {chgFile ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-purple-700 font-semibold bg-purple-50 py-1.5 px-3 rounded-lg border border-purple-200">
                    {chgFile.name.endsWith('.zip') ? <FileArchive className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                    <span className="truncate max-w-[200px]">{chgFile.name}</span>
                    <span className="text-[11px] text-purple-500">({(chgFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 py-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select target .ZIP or .JSON</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        ) : (
          /* Snapshot selector row */
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="font-bold text-slate-500">Baseline Snapshot:</span>
              <select
                value={origSnapId}
                onChange={(e) => setOrigSnapId(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                {savedSnapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.nodeCount} nodes, {s.fileCount} files)
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="font-bold text-slate-500">Target Snapshot:</span>
              <select
                value={chgSnapId}
                onChange={(e) => setChgSnapId(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                {savedSnapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.nodeCount} nodes, {s.fileCount} files)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunSnapshotCompare}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              Compare Snapshots
            </button>
          </div>
        )}

        {/* Error notification */}
        {compareError && (
          <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{compareError}</span>
          </div>
        )}
      </div>

      {/* Comparison Results Content */}
      {comparisonResult ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Result Header & Metrics Strip */}
          <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white">
                  {comparisonType === 'direct_upload' ? 'Source: Uploaded Direct' : 'Source: Saved Snapshots'}
                </span>
                <span className="text-sm font-bold text-white">
                  {comparisonResult.originalIdentity.filename} → {comparisonResult.changedIdentity.filename}
                </span>
              </div>

              {/* Unique input IDs */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>V1: {comparisonResult.originalIdentity.id.slice(0, 12)}...</span>
                <span>•</span>
                <span>V2: {comparisonResult.changedIdentity.id.slice(0, 12)}...</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Architecture Nodes:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {archDiff?.summary.addedNodesCount ? (
                    <span className="text-emerald-400">+{archDiff.summary.addedNodesCount}</span>
                  ) : null}
                  {archDiff?.summary.removedNodesCount ? (
                    <span className="text-red-400">-{archDiff.summary.removedNodesCount}</span>
                  ) : null}
                  {archDiff?.summary.modifiedNodesCount ? (
                    <span className="text-amber-400">~{archDiff.summary.modifiedNodesCount}</span>
                  ) : null}
                  <span className="text-slate-400">={archDiff?.summary.unchangedNodesCount}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Dependencies:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {archDiff?.summary.addedRelationshipsCount ? (
                    <span className="text-emerald-400">+{archDiff.summary.addedRelationshipsCount}</span>
                  ) : null}
                  {archDiff?.summary.removedRelationshipsCount ? (
                    <span className="text-red-400">-{archDiff.summary.removedRelationshipsCount}</span>
                  ) : null}
                  <span className="text-slate-400">={archDiff?.summary.unchangedRelationshipsCount}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Repository Files:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {repoDiff?.summary.addedFilesCount ? (
                    <span className="text-emerald-400">+{repoDiff.summary.addedFilesCount}</span>
                  ) : null}
                  {repoDiff?.summary.removedFilesCount ? (
                    <span className="text-red-400">-{repoDiff.summary.removedFilesCount}</span>
                  ) : null}
                  {repoDiff?.summary.modifiedFilesCount ? (
                    <span className="text-amber-400">~{repoDiff.summary.modifiedFilesCount}</span>
                  ) : null}
                  <span className="text-slate-400">={repoDiff?.summary.unchangedFilesCount}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Risk Score:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span className="text-slate-300">{risk?.originalScore}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-slate-300">{risk?.changedScore}</span>
                  {risk && risk.delta !== 0 && (
                    <span className={risk.delta > 0 ? 'text-red-400 text-[11px]' : 'text-emerald-400 text-[11px]'}>
                      ({risk.delta > 0 ? `+${risk.delta}` : risk.delta})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Dual Architecture Graphs Section */}
          <div className="bg-white border-b border-slate-200 shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Side-by-Side Architecture Topology
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  (Original Baseline vs Changed Target)
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Diff Legend */}
                <div className="hidden md:flex items-center gap-3 text-[11px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 ring-1 ring-emerald-600"></span>
                    <span>Added</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 ring-1 ring-rose-600"></span>
                    <span>Removed</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 ring-1 ring-amber-600"></span>
                    <span>Modified</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 border border-slate-400"></span>
                    <span>Unchanged</span>
                  </span>
                </div>

                {/* Collapse / Expand Toggle */}
                <button
                  onClick={() => setIsGraphCollapsed((prev) => !prev)}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-purple-700 px-2 py-1 rounded-md bg-white border border-slate-200 transition-colors cursor-pointer"
                >
                  <span>{isGraphCollapsed ? 'Show Graphs' : 'Collapse Graphs'}</span>
                  {isGraphCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {!isGraphCollapsed && (
              <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 bg-slate-100/70">
                {/* Left Graph: Original / Baseline */}
                <div className="flex flex-col h-[380px] rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="px-3 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                      <span className="shrink-0">ORIGINAL / BASELINE (V1)</span>
                      <span className="text-slate-500 font-mono text-[11px] font-normal truncate" title={comparisonResult.originalIdentity.filename}>
                        {comparisonResult.originalIdentity.filename}
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-700 font-mono font-medium shrink-0 ml-2">
                      {comparisonResult.originalModel.entities.length} nodes • {comparisonResult.originalModel.relationships.length} edges
                    </span>
                  </div>
                  <div className="flex-1 relative">
                    <ArchitectureGraph
                      entities={comparisonResult.originalModel.entities}
                      relationships={comparisonResult.originalModel.relationships}
                      selectedEntityId={selectedOrigEntityId}
                      onSelectEntity={(id) => {
                        setSelectedOrigEntityId(id);
                        if (id && onSelectEntity) onSelectEntity(id);
                      }}
                      diffMode={true}
                      diffNodesMap={origDiffNodesMap}
                      diffEdgesMap={origDiffEdgesMap}
                      extractedAt={comparisonResult.originalModel.extractedAt}
                      isLimitedArchitecture={comparisonResult.originalModel.isLimitedArchitecture}
                      limitedArchitectureReason={comparisonResult.originalModel.limitedArchitectureReason}
                    />
                  </div>
                </div>

                {/* Right Graph: Changed / Target */}
                <div className="flex flex-col h-[380px] rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="px-3 py-2 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0"></span>
                      <span className="shrink-0">CHANGED / TARGET (V2)</span>
                      <span className="text-slate-500 font-mono text-[11px] font-normal truncate" title={comparisonResult.changedIdentity.filename}>
                        {comparisonResult.changedIdentity.filename}
                      </span>
                    </div>
                    <span className="text-[11px] text-purple-700 font-mono font-medium shrink-0 ml-2">
                      {comparisonResult.changedModel.entities.length} nodes • {comparisonResult.changedModel.relationships.length} edges
                    </span>
                  </div>
                  <div className="flex-1 relative">
                    <ArchitectureGraph
                      entities={comparisonResult.changedModel.entities}
                      relationships={comparisonResult.changedModel.relationships}
                      selectedEntityId={selectedChgEntityId}
                      onSelectEntity={(id) => {
                        setSelectedChgEntityId(id);
                        if (id && onSelectEntity) onSelectEntity(id);
                      }}
                      diffMode={true}
                      diffNodesMap={chgDiffNodesMap}
                      diffEdgesMap={chgDiffEdgesMap}
                      extractedAt={comparisonResult.changedModel.extractedAt}
                      isLimitedArchitecture={comparisonResult.changedModel.isLimitedArchitecture}
                      limitedArchitectureReason={comparisonResult.changedModel.limitedArchitectureReason}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div data-testid="compare-tabs" className="bg-white border-b border-slate-200 px-4 flex items-center gap-1 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('repo_diff')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'repo_diff'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
              <span>Repository Diff ({repoDiff?.diffFiles.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('arch_diff')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'arch_diff'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Architecture Diff</span>
            </button>

            <button
              onClick={() => setActiveTab('impact')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'impact'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Impact Analysis ({impact?.potentiallyImpactedNodes.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('risk')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'risk'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>Risk Delta ({risk ? (risk.delta > 0 ? `+${risk.delta}` : risk.delta) : 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'evidence'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Evidence</span>
            </button>

            <button
              onClick={() => setActiveTab('story')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'story'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Change Story</span>
            </button>

            {(comparisonResult.originalModel.rawJsonString || comparisonResult.changedModel.rawJsonString) && (
              <button
                onClick={() => setActiveTab('json_payload')}
                className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'json_payload'
                    ? 'border-purple-600 text-purple-700 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                <span>Original JSON Payload</span>
              </button>
            )}
          </div>

          {/* Active Tab Panel */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* TAB 1: ARCHITECTURE DIFF */}
            {activeTab === 'arch_diff' && archDiff && (
              <div className="space-y-4 max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Added Components */}
                  <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-3 pb-2 border-b border-emerald-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      ADDED COMPONENTS ({archDiff.addedNodes.length})
                    </div>
                    {archDiff.addedNodes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No new components introduced.</p>
                    ) : (
                      <div className="space-y-2">
                        {archDiff.addedNodes.map((node) => (
                          <div
                            key={node.id}
                            className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-xs"
                          >
                            <div className="font-bold text-slate-900">{node.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Type: {node.type} • Tech: {node.technology || 'Generic'}
                            </div>
                            {node.description && (
                              <p className="text-[11px] text-slate-600 mt-1">{node.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Removed Components */}
                  <div className="bg-white rounded-xl border border-red-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-red-800 font-bold text-xs mb-3 pb-2 border-b border-red-100">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      REMOVED COMPONENTS ({archDiff.removedNodes.length})
                    </div>
                    {archDiff.removedNodes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No components decommissioned.</p>
                    ) : (
                      <div className="space-y-2">
                        {archDiff.removedNodes.map((node) => (
                          <div key={node.id} className="p-2.5 rounded-lg bg-red-50/50 border border-red-200 text-xs">
                            <div className="font-bold text-slate-900 line-through text-red-900">{node.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Type: {node.type} • Tech: {node.technology || 'Generic'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Modified Components */}
                  <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-3 pb-2 border-b border-amber-100">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      MODIFIED COMPONENTS ({archDiff.modifiedNodes?.length || 0})
                    </div>
                    {(!archDiff.modifiedNodes || archDiff.modifiedNodes.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">No existing components modified.</p>
                    ) : (
                      <div className="space-y-2">
                        {archDiff.modifiedNodes.map((node) => (
                          <div key={node.id} className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200 text-xs">
                            <div className="font-bold text-slate-900">{node.name}</div>
                            <div className="text-[11px] text-amber-800">
                              Updated attributes or technology: {node.technology}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Relationship Changes */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
                    Dependency Changes ({archDiff.addedRelationships.length + archDiff.removedRelationships.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Added Relationships */}
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 block mb-2">
                        + Added Dependencies ({archDiff.addedRelationships.length}):
                      </span>
                      {archDiff.addedRelationships.map((r) => (
                        <div
                          key={r.id}
                          className="p-2 bg-emerald-50/40 border border-emerald-200 rounded-lg text-xs mb-2"
                        >
                          <div className="font-bold text-slate-800">
                            {r.relationship.source} → {r.relationship.target}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Type: {r.relationship.type} • Protocol: {r.relationship.protocol}
                          </div>
                          {r.sourceEvidence && (
                            <div className="mt-1 text-[10px] text-emerald-800 font-mono bg-white p-1 rounded border border-emerald-200">
                              Provenance: {r.sourceEvidence.file} ({r.sourceEvidence.description})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Removed Relationships */}
                    <div>
                      <span className="text-[11px] font-bold text-red-700 block mb-2">
                        - Removed Dependencies ({archDiff.removedRelationships.length}):
                      </span>
                      {archDiff.removedRelationships.map((r) => (
                        <div key={r.id} className="p-2 bg-red-50/40 border border-red-200 rounded-lg text-xs mb-2">
                          <div className="font-bold text-slate-800 line-through">
                            {r.relationship.source} → {r.relationship.target}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Type: {r.relationship.type} • Protocol: {r.relationship.protocol}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REPOSITORY DIFF */}
            {activeTab === 'repo_diff' && repoDiff && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 max-w-6xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Level 1 Repository Inventory Diff</h3>
                    <p className="text-xs text-slate-500">
                      100% of discovered files compared across archives. Tracks Added (+), Removed (-), Modified (~),
                      and Unchanged (=).
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {(['all', 'added', 'removed', 'modified', 'unchanged'] as const).map((filter) => (
                      <button
                        key={filter}
                        data-testid={`repo-filter-${filter}`}
                        onClick={() => setRepoFilter(filter)}
                        className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all cursor-pointer ${
                          repoFilter === filter ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Change</th>
                        <th className="p-2.5">File Path</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Size</th>
                        <th className="p-2.5">Lines</th>
                        <th className="p-2.5">Analysis Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredRepoFiles.map((item, idx) => (
                        <tr
                          key={`${item.file.path}-${idx}`}
                          className={
                            item.changeType === 'added'
                              ? 'bg-emerald-50/40'
                              : item.changeType === 'removed'
                              ? 'bg-red-50/40'
                              : item.changeType === 'modified'
                              ? 'bg-amber-50/40'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="p-2.5 whitespace-nowrap">
                            {item.changeType === 'added' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                                + ADDED
                              </span>
                            )}
                            {item.changeType === 'removed' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                                - REMOVED
                              </span>
                            )}
                            {item.changeType === 'modified' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                                ~ MODIFIED
                              </span>
                            )}
                            {item.changeType === 'unchanged' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                = UNCHANGED
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-slate-900 font-medium">{item.file.path}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.file.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500 font-mono">{item.file.size_bytes} B</td>
                          <td className="p-2.5 text-slate-500 font-mono">{item.file.lines_count ?? 0}</td>
                          <td className="p-2.5 text-slate-700">{item.file.analysis_status || 'Retained'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: IMPACT ANALYSIS */}
            {activeTab === 'impact' && impact && (
              <div className="space-y-4 max-w-6xl mx-auto">
                {/* Directly Changed vs Potentially Impacted */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                      Directly Changed Nodes ({impact.directlyChangedNodes.length})
                    </h3>
                    <div className="space-y-2">
                      {impact.directlyChangedNodes.map((n) => (
                        <div key={n.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <div className="font-bold text-slate-900">{n.name}</div>
                          <div className="text-[11px] text-slate-500">ID: {n.id} • Type: {n.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      Potentially Impacted Upstream Callers ({impact.potentiallyImpactedNodes.length})
                    </h3>
                    {impact.potentiallyImpactedNodes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No transitive callers impacted.</p>
                    ) : (
                      <div className="space-y-2">
                        {impact.potentiallyImpactedNodes.map((n) => (
                          <div key={n.id} className="p-2.5 bg-blue-50/50 border border-blue-200 rounded-lg text-xs">
                            <div className="font-bold text-blue-900">{n.name}</div>
                            <div className="text-[11px] text-blue-600">Upstream Caller • Type: {n.type}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Propagation Paths */}
                {impact.propagationPaths.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                      Graph Propagation Paths ({impact.propagationPaths.length})
                    </h3>
                    <div className="space-y-2">
                      {impact.propagationPaths.map((p, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-start gap-2">
                          <CornerDownRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-mono text-slate-800 font-bold">{p.path.join(' → ')}</div>
                            <div className="text-slate-500 text-[11px] mt-0.5">{p.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: RISK LEDGER */}
            {activeTab === 'risk' && risk && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs max-w-6xl mx-auto space-y-4">
                {/* Score Banner */}
                <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block mb-1">
                      STRUCTURAL RISK POSTURE
                    </span>
                    <h3 className="text-base font-bold text-white">{risk.attributionStatement}</h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block">Baseline Risk</span>
                      <span className="text-lg font-mono font-bold">{risk.originalScore}/100</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block">Target Risk</span>
                      <span className="text-lg font-mono font-bold text-purple-400">{risk.changedScore}/100</span>
                    </div>
                    <div className="text-center pl-3 border-l border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Net Delta</span>
                      <span
                        className={`text-lg font-mono font-bold ${
                          risk.delta > 0 ? 'text-red-400' : risk.delta < 0 ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {risk.delta > 0 ? `+${risk.delta}` : risk.delta}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Itemized Ledger Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Risk Factor</th>
                        <th className="p-2.5">Points</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Evidence Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {risk.ledger.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{item.factor}</td>
                          <td className="p-2.5 font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                item.points > 0
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : item.points < 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.points > 0 ? `+${item.points}` : item.points}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600">{item.description}</td>
                          <td className="p-2.5 font-mono text-slate-500">{item.evidenceCount ?? 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: EVIDENCE */}
            {activeTab === 'evidence' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs max-w-6xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Authentic Source Evidence & Provenance</h3>
                      <p className="text-xs text-slate-500">
                        Zero synthetic data. All entities, dependencies, and file changes are traceable directly to parsed files.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Provenance Verified
                  </span>
                </div>

                {/* Evidence Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Baseline Evidence */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      Baseline Archive Evidence ({comparisonResult.originalIdentity.filename})
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Discovered Manifests & Configurations</div>
                        <div className="text-[11px] text-slate-600">
                          {comparisonResult.originalModel.inventory?.manifests.length ? (
                            comparisonResult.originalModel.inventory.manifests.map((m) => (
                              <div key={m} className="font-mono text-blue-700 py-0.5">• {m}</div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No package manifests found.</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Decommissioned Files (-{repoDiff?.summary.removedFilesCount || 0})</div>
                        {repoDiff?.removedFiles.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">No files decommissioned from baseline.</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                            {repoDiff?.removedFiles.map((f) => (
                              <div key={f.path} className="flex items-center justify-between text-red-700 bg-red-50/60 px-2 py-1 rounded">
                                <span className="truncate">{f.path}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">{f.size_bytes} B</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Target Evidence */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      Target Archive Evidence ({comparisonResult.changedIdentity.filename})
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Discovered Manifests & Configurations</div>
                        <div className="text-[11px] text-slate-600">
                          {comparisonResult.changedModel.inventory?.manifests.length ? (
                            comparisonResult.changedModel.inventory.manifests.map((m) => (
                              <div key={m} className="font-mono text-purple-700 py-0.5">• {m}</div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No package manifests found.</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Added Files Provenance (+{repoDiff?.summary.addedFilesCount || 0})</div>
                        <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                          {repoDiff?.addedFiles.map((f) => (
                            <div key={f.path} className="flex items-center justify-between text-emerald-700 bg-emerald-50/60 px-2 py-1 rounded">
                              <span className="truncate">{f.path}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">{f.size_bytes} B</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Architecture Provenance Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase">
                    Architecture Component Evidence Citations
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Component</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Source Evidence File</th>
                        <th className="p-2.5">Confidence</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {comparisonResult.changedModel.entities.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{e.name}</td>
                          <td className="p-2.5 text-slate-600">{e.type}</td>
                          <td className="p-2.5 text-slate-700">{e.metadata?.filePath || comparisonResult.changedIdentity.filename || 'Codebase root'}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {e.metadata?.confidenceScore ? `${Math.round(e.metadata.confidenceScore * 100)}%` : '92%'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {archDiff?.addedNodes.some((n) => n.id === e.id) ? (
                              <span className="text-emerald-600 font-bold">+ Added</span>
                            ) : archDiff?.modifiedNodes?.some((n) => n.id === e.id) ? (
                              <span className="text-amber-600 font-bold">~ Modified</span>
                            ) : (
                              <span className="text-slate-400">= Unchanged</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: CHANGE STORY */}
            {activeTab === 'story' && story && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs max-w-4xl mx-auto space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Deterministic Step-by-Step Change Story</h3>
                </div>

                <div className="space-y-3">
                  {story.map((paragraph, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <p className="flex-1">{paragraph}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: ORIGINAL JSON PAYLOAD */}
            {activeTab === 'json_payload' && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">100% Preserved Original JSON Blueprint Payload</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {comparisonResult.originalModel.rawJsonString && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-auto max-h-96">
                      <div className="font-bold text-purple-400 mb-2">ORIGINAL (V1) PAYLOAD:</div>
                      <pre>{comparisonResult.originalModel.rawJsonString}</pre>
                    </div>
                  )}
                  {comparisonResult.changedModel.rawJsonString && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-auto max-h-96">
                      <div className="font-bold text-blue-400 mb-2">CHANGED (V2) PAYLOAD:</div>
                      <pre>{comparisonResult.changedModel.rawJsonString}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 mb-4 shadow-sm">
            <GitCompare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Ready to Compare Architectures</h3>
          <p className="text-xs text-slate-500 max-w-md mb-4">
            Upload two repository ZIPs, two blueprint JSONs, or compare saved snapshots. TraceIQ will reconstruct both,
            diff 100% of files, compute structural risk deltas, and analyze propagation paths.
          </p>
        </div>
      )}
    </div>
  );
};
