import React, { useState } from 'react';
import {
  GitCompare,
  Eye,
  Camera,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  ArrowRight,
  ListFilter,
  X,
  FileCode,
  Folder,
} from 'lucide-react';
import type {
  ArchitectureSnapshot,
  ArchitectureDiff,
} from '../../types/architecture';

interface VersionDiffBarProps {
  snapshots: ArchitectureSnapshot[];
  activeSnapshotId: string;
  comparisonSnapshotId: string;
  onSelectActiveSnapshot: (id: string) => void;
  onSelectComparisonSnapshot: (id: string) => void;
  viewMode: 'normal' | 'diff';
  onToggleViewMode: (mode: 'normal' | 'diff') => void;
  onSaveSnapshot: (label: string) => void;
  diff: ArchitectureDiff | null;
  onSelectEntity?: (entityId: string) => void;
}

export const VersionDiffBar: React.FC<VersionDiffBarProps> = ({
  snapshots,
  activeSnapshotId,
  comparisonSnapshotId,
  onSelectActiveSnapshot,
  onSelectComparisonSnapshot,
  viewMode,
  onToggleViewMode,
  onSaveSnapshot,
  diff,
  onSelectEntity,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [newSnapshotLabel, setNewSnapshotLabel] = useState('');
  const [showDiffSummaryModal, setShowDiffSummaryModal] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'architecture' | 'repository'>('architecture');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSnapshotLabel.trim()) {
      onSaveSnapshot(newSnapshotLabel.trim());
      setNewSnapshotLabel('');
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-2xs z-15">
      {/* Left: View Mode Toggle & Snapshot Selection */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Mode Selector */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => onToggleViewMode('normal')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
              viewMode === 'normal'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Normal View</span>
          </button>
          <button
            onClick={() => onToggleViewMode('diff')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
              viewMode === 'diff'
                ? 'bg-purple-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>V1 → V2 Diff View</span>
          </button>
        </div>

        {/* Snapshot Selectors */}
        {viewMode === 'diff' ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">V1 Baseline:</span>
              <select
                value={activeSnapshotId}
                onChange={(e) => onSelectActiveSnapshot(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">V2 Target:</span>
              <select
                value={comparisonSnapshotId}
                onChange={(e) => onSelectComparisonSnapshot(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Snapshot:</span>
            <select
              value={activeSnapshotId}
              onChange={(e) => onSelectActiveSnapshot(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Center/Right: Diff Summary Pills & Save Snapshot Action */}
      <div className="flex items-center gap-2">
        {viewMode === 'diff' && diff && (
          <div className="flex items-center gap-1.5 text-xs">
            {/* Added Pills */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <PlusCircle className="w-3 h-3 text-emerald-600" />
              <span>
                +{diff.summary.addedNodesCount} Node{diff.summary.addedNodesCount !== 1 ? 's' : ''}, +
                {diff.summary.addedRelationshipsCount} Rel{diff.summary.addedRelationshipsCount !== 1 ? 's' : ''}
              </span>
            </span>

            {/* Removed Pills */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
              <MinusCircle className="w-3 h-3 text-rose-600" />
              <span>
                -{diff.summary.removedNodesCount} Node{diff.summary.removedNodesCount !== 1 ? 's' : ''}, -
                {diff.summary.removedRelationshipsCount} Rel{diff.summary.removedRelationshipsCount !== 1 ? 's' : ''}
              </span>
            </span>

            {/* Unchanged Pills */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
              <CheckCircle2 className="w-3 h-3 text-slate-400" />
              <span>{diff.summary.unchangedRelationshipsCount} Unchanged</span>
            </span>

            {/* Level 1 Repository Diff Pills */}
            {diff.repositoryDiff && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                <FileCode className="w-3 h-3 text-blue-600" />
                <span>
                  +{diff.repositoryDiff.summary.addedFilesCount} File{diff.repositoryDiff.summary.addedFilesCount !== 1 ? 's' : ''}
                  {diff.repositoryDiff.summary.removedFilesCount > 0 ? `, -${diff.repositoryDiff.summary.removedFilesCount}` : ''}
                </span>
              </span>
            )}

            {/* View Change Ledger Button */}
            <button
              onClick={() => setShowDiffSummaryModal(true)}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-semibold transition-all cursor-pointer"
              title="Inspect structured list of all architectural changes"
            >
              <ListFilter className="w-3.5 h-3.5 text-purple-600" />
              <span>Change Ledger</span>
            </button>
          </div>
        )}

        {/* Save Current Architecture Snapshot */}
        {isSaving ? (
          <form onSubmit={handleSave} className="flex items-center gap-1.5 text-xs">
            <input
              type="text"
              value={newSnapshotLabel}
              onChange={(e) => setNewSnapshotLabel(e.target.value)}
              placeholder="e.g., Release v2.1-rc1"
              autoFocus
              className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsSaving(false)}
              className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsSaving(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            title="Save current architecture state as an immutable snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>Save Snapshot</span>
          </button>
        )}
      </div>

      {/* Change Ledger Summary Modal */}
      {showDiffSummaryModal && diff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Architecture Diff: {diff.fromLabel} → {diff.toLabel}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Deterministic structural comparison between snapshots
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiffSummaryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100 px-5 text-xs font-semibold">
              <button
                onClick={() => setLedgerTab('architecture')}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  ledgerTab === 'architecture'
                    ? 'border-purple-600 text-purple-700 bg-white font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Architecture Diff (Level 2)</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-mono">
                  +{diff.summary.addedNodesCount} / -{diff.summary.removedNodesCount}
                </span>
              </button>
              <button
                onClick={() => setLedgerTab('repository')}
                className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  ledgerTab === 'repository'
                    ? 'border-blue-600 text-blue-700 bg-white font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Repository Inventory Diff (Level 1)</span>
                {diff.repositoryDiff && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono">
                    +{diff.repositoryDiff.summary.addedFilesCount} / -{diff.repositoryDiff.summary.removedFilesCount}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body: Architecture Diff */}
            {ledgerTab === 'architecture' && (
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Added Components */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 uppercase tracking-wider text-[11px]">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Added Components ({diff.addedNodes.length})</span>
                </div>
                {diff.addedNodes.length === 0 ? (
                  <p className="text-slate-400 italic pl-5">None</p>
                ) : (
                  <div className="space-y-1 pl-5">
                    {diff.addedNodes.map((node) => (
                      <div
                        key={node.id}
                        onClick={() => {
                          onSelectEntity?.(node.id);
                          setShowDiffSummaryModal(false);
                        }}
                        className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between hover:bg-emerald-100/70 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-emerald-950 truncate">+ {node.name}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                            {node.type}
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-600 truncate">{node.technology}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Relationships */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 uppercase tracking-wider text-[11px]">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Added Relationships ({diff.addedRelationships.length})</span>
                </div>
                {diff.addedRelationships.length === 0 ? (
                  <p className="text-slate-400 italic pl-5">None</p>
                ) : (
                  <div className="space-y-1 pl-5">
                    {diff.addedRelationships.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-950">
                            + {item.sourceEntity?.name || item.relationship.source} →{' '}
                            {item.targetEntity?.name || item.relationship.target}
                          </span>
                          <span className="text-[10px] font-mono bg-emerald-200/60 text-emerald-900 px-1.5 py-0.2 rounded">
                            {item.relationship.type}
                          </span>
                        </div>
                        {item.sourceEvidence?.snippet && (
                          <div className="text-[10px] font-mono text-emerald-800 bg-white/70 px-2 py-1 rounded border border-emerald-100 truncate">
                            {item.sourceEvidence.snippet}
                          </div>
                        )}
                        {item.sourceEvidence?.file && (
                          <div className="text-[10px] text-emerald-700">
                            Evidence: {item.sourceEvidence.file}
                            {item.sourceEvidence.line ? `:${item.sourceEvidence.line}` : ''} •{' '}
                            {item.sourceEvidence.confidence} confidence
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Removed Components */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-800 uppercase tracking-wider text-[11px]">
                  <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Removed Components ({diff.removedNodes.length})</span>
                </div>
                {diff.removedNodes.length === 0 ? (
                  <p className="text-slate-400 italic pl-5">None</p>
                ) : (
                  <div className="space-y-1 pl-5">
                    {diff.removedNodes.map((node) => (
                      <div
                        key={node.id}
                        className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/80 flex items-center justify-between"
                      >
                        <span className="font-bold text-rose-950 truncate">- {node.name}</span>
                        <span className="text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-mono">
                          {node.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Removed Relationships */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-800 uppercase tracking-wider text-[11px]">
                  <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Removed Relationships ({diff.removedRelationships.length})</span>
                </div>
                {diff.removedRelationships.length === 0 ? (
                  <p className="text-slate-400 italic pl-5">None</p>
                ) : (
                  <div className="space-y-1 pl-5">
                    {diff.removedRelationships.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-950">
                            - {item.sourceEntity?.name || item.relationship.source} →{' '}
                            {item.targetEntity?.name || item.relationship.target}
                          </span>
                          <span className="text-[10px] font-mono bg-rose-200/60 text-rose-900 px-1.5 py-0.2 rounded">
                            {item.relationship.type}
                          </span>
                        </div>
                        {item.sourceEvidence?.file && (
                          <div className="text-[10px] text-rose-700">
                            Original V1 Evidence: {item.sourceEvidence.file}
                            {item.sourceEvidence.line ? `:${item.sourceEvidence.line}` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unchanged Relationships */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unchanged Relationships ({diff.unchangedRelationships.length})</span>
                </div>
                <div className="space-y-1 pl-5 max-h-36 overflow-y-auto pr-1">
                  {diff.unchangedRelationships.map((item) => (
                    <div
                      key={item.id}
                      className="p-1.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-600"
                    >
                      <span className="truncate">
                        {item.sourceEntity?.name || item.relationship.source} →{' '}
                        {item.targetEntity?.name || item.relationship.target}
                      </span>
                      <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1 py-0.2 rounded shrink-0">
                        {item.relationship.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Modal Body: Repository Inventory Diff */}
            {ledgerTab === 'repository' && (
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Repository Summary Metrics */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Added Files</span>
                    <p className="text-base font-bold text-emerald-600">
                      +{diff.repositoryDiff?.summary.addedFilesCount ?? 0}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Removed Files</span>
                    <p className="text-base font-bold text-rose-600">
                      -{diff.repositoryDiff?.summary.removedFilesCount ?? 0}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Modified Files</span>
                    <p className="text-base font-bold text-amber-600">
                      ~{diff.repositoryDiff?.summary.modifiedFilesCount ?? 0}
                    </p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Unchanged Files</span>
                    <p className="text-base font-bold text-slate-700">
                      {diff.repositoryDiff?.summary.unchangedFilesCount ?? 0}
                    </p>
                  </div>
                </div>

                {/* Added Files */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 uppercase tracking-wider text-[11px]">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Added Files ({diff.repositoryDiff?.addedFiles.length ?? 0})</span>
                  </div>
                  {(diff.repositoryDiff?.addedFiles.length ?? 0) === 0 ? (
                    <p className="text-slate-400 italic pl-5">None</p>
                  ) : (
                    <div className="space-y-1 pl-5">
                      {diff.repositoryDiff?.addedFiles.map((file) => (
                        <div
                          key={file.path}
                          className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-emerald-950 font-bold truncate">+ {file.path}</span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                              {file.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-600 truncate">
                            {file.analysis_status || file.language || 'Retained'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modified Files */}
                {((diff.repositoryDiff?.modifiedFiles?.length ?? 0) > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800 uppercase tracking-wider text-[11px]">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">~</span>
                      <span>Modified Files ({diff.repositoryDiff?.modifiedFiles?.length ?? 0})</span>
                    </div>
                    <div className="space-y-1 pl-5">
                      {diff.repositoryDiff?.modifiedFiles?.map((file) => (
                        <div
                          key={file.path}
                          className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-amber-950 font-bold truncate">~ {file.path}</span>
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-mono">
                              {file.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-700 truncate">
                            {file.lines_count ? `${file.lines_count} lines` : 'Modified'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Files */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 uppercase tracking-wider text-[11px]">
                    <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Removed Files ({diff.repositoryDiff?.removedFiles.length ?? 0})</span>
                  </div>
                  {(diff.repositoryDiff?.removedFiles.length ?? 0) === 0 ? (
                    <p className="text-slate-400 italic pl-5">None</p>
                  ) : (
                    <div className="space-y-1 pl-5">
                      {diff.repositoryDiff?.removedFiles.map((file) => (
                        <div
                          key={file.path}
                          className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/80 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-rose-950 font-bold truncate">- {file.path}</span>
                            <span className="text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-mono">
                              {file.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-rose-600 truncate">{file.language || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Folder Hierarchy Changes */}
                {((diff.repositoryDiff?.addedFolders.length ?? 0) > 0 || (diff.repositoryDiff?.removedFolders.length ?? 0) > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      <Folder className="w-3.5 h-3.5 text-slate-500" />
                      <span>Folder Hierarchy Changes</span>
                    </div>
                    <div className="space-y-1 pl-5">
                      {diff.repositoryDiff?.addedFolders.map((f) => (
                        <div key={f} className="p-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px]">
                          + {f}/
                        </div>
                      ))}
                      {diff.repositoryDiff?.removedFolders.map((f) => (
                        <div key={f} className="p-1.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-mono text-[11px]">
                          - {f}/
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDiffSummaryModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
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
