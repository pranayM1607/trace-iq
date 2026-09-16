import React, { useState } from 'react';
import {
  Boxes,
  Camera,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FileArchive,
  Sparkles,
  Layers,
  FolderTree,
  FileText,
  Clock,
  Hash,
} from 'lucide-react';
import type { ArchitectureModel, ArchitectureSnapshot } from '../../types/architecture';

interface CurrentWorkspaceCardProps {
  model: ArchitectureModel;
  savedSnapshots: ArchitectureSnapshot[];
  onSaveSnapshot: (label: string) => void;
  onOpenInventory: () => void;
  onOpenRawPayload?: () => void;
}

export const CurrentWorkspaceCard: React.FC<CurrentWorkspaceCardProps> = ({
  model,
  savedSnapshots,
  onSaveSnapshot,
  onOpenInventory,
  onOpenRawPayload,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');

  // Determine if current model matches an existing snapshot
  const matchingSnapshot = savedSnapshots.find((s) => {
    if (model.inputIdentity && s.inputIdentity) {
      return s.inputIdentity.id === model.inputIdentity.id;
    }
    return s.architecture.systemName === model.systemName && s.architecture.version === model.version;
  });

  const isSaved = Boolean(matchingSnapshot);
  const fileCount = model.inventory?.total_files || model.entities.length;
  const folderCount = model.inventory?.total_folders || 0;
  const isPartial = model.scope === 'partial' || model.isLimitedArchitecture;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (snapshotLabel.trim()) {
      onSaveSnapshot(snapshotLabel.trim());
      setSnapshotLabel('');
      setIsSaving(false);
    }
  };

  const sourceTypeBadge = () => {
    if (model.inputType === 'codebase') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-200">
          <FileArchive className="w-3 h-3" />
          ZIP Codebase (Uploaded)
        </span>
      );
    }
    if (model.inputType === 'blueprint') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-700 border border-blue-200">
          <FileCode className="w-3 h-3" />
          JSON Blueprint (Uploaded)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-200">
        <Sparkles className="w-3 h-3" />
        Reference Demo Architecture
      </span>
    );
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2.5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-full">
        {/* Left: Workspace Identity & Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white">
              WORKSPACE
            </span>
            <span className="font-bold text-slate-900 text-sm">{model.systemName}</span>
            <span className="text-xs font-mono font-medium text-slate-500">v{model.version}</span>
          </div>

          {/* Source Type Badge */}
          {sourceTypeBadge()}

          {/* Scope Badge */}
          {isPartial ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
              title={model.limitedArchitectureReason || 'Partial codebase: limited system boundaries'}
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Partial Scope / Limited Context
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Complete Ingestion (100% Files Preserved)
            </span>
          )}

          {/* Save Status Badge */}
          {isSaved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <Camera className="w-3 h-3 text-teal-600" />
              SAVED ({matchingSnapshot?.label || 'Snapshot'})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
              <Clock className="w-3 h-3 text-amber-600" />
              UNSAVED
            </span>
          )}

          {/* Input ID tag if available */}
          {model.inputIdentity && (
            <span
              className="text-[10px] font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5"
              title={`Unique Input ID: ${model.inputIdentity.id}`}
            >
              <Hash className="w-2.5 h-2.5 inline mr-0.5" />
              {model.inputIdentity.id.slice(0, 16)}...
            </span>
          )}
        </div>

        {/* Right: Counts & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Inventory Counts Pill */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs text-slate-600">
            <span className="flex items-center gap-1" title="Discovered Files">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <strong className="text-slate-900">{fileCount}</strong> files
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1" title="Discovered Folders">
              <FolderTree className="w-3.5 h-3.5 text-amber-600" />
              <strong className="text-slate-900">{folderCount}</strong> folders
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1" title="Architecture Components">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <strong className="text-slate-900">{model.entities.length}</strong> components
            </span>
          </div>

          {/* Complete Inventory Modal Trigger */}
          <button
            onClick={onOpenInventory}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Inspect full repository inventory and file classification"
          >
            <Boxes className="w-3.5 h-3.5 text-emerald-600" />
            <span>Complete Inventory</span>
          </button>

          {/* Raw JSON Blueprint Payload Button (if blueprint) */}
          {model.rawJsonString && onOpenRawPayload && (
            <button
              onClick={onOpenRawPayload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer"
              title="View original unparsed JSON blueprint payload"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600" />
              <span>Original JSON</span>
            </button>
          )}

          {/* Save Snapshot Button */}
          {isSaving ? (
            <form onSubmit={handleSave} className="flex items-center gap-1.5">
              <input
                type="text"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder={`e.g. ${model.systemName} Snapshot`}
                className="px-2.5 py-1 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
                autoFocus
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSaving(false)}
                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setSnapshotLabel(`${model.systemName} (v${model.version})`);
                setIsSaving(true);
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Save current workspace as an immutable frozen snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Save Snapshot</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
