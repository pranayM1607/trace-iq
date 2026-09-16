import React, { useState } from 'react';
import {
  Bookmark,
  Calendar,
  Network,
  GitCompare,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { ArchitectureModel, ArchitectureSnapshot } from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';

interface SnapshotsPageProps {
  model: ArchitectureModel;
  snapshots: ArchitectureSnapshot[];
  activeSnapshotId: string;
  onSelectActiveSnapshot: (id: string) => void;
  onSaveSnapshot: (label: string) => void;
  onRenameSnapshot?: (id: string, newLabel: string) => void;
  onDeleteSnapshot?: (id: string) => void;
  onNavigate: (route: NavRoute) => void;
}

export const SnapshotsPage: React.FC<SnapshotsPageProps> = ({
  model,
  snapshots,
  activeSnapshotId,
  onSelectActiveSnapshot,
  onSaveSnapshot,
  onRenameSnapshot,
  onDeleteSnapshot,
  onNavigate,
}) => {
  const [newSnapshotLabel, setNewSnapshotLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Rename modal state
  const [editingSnapshot, setEditingSnapshot] = useState<ArchitectureSnapshot | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Delete modal state
  const [deletingSnapshot, setDeletingSnapshot] = useState<ArchitectureSnapshot | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapshotLabel.trim()) return;
    onSaveSnapshot(newSnapshotLabel.trim());
    setNewSnapshotLabel('');
    setIsSaving(false);
  };

  const handleStartRename = (snap: ArchitectureSnapshot) => {
    setEditingSnapshot(snap);
    setEditLabel(snap.label);
  };

  const handleConfirmRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSnapshot && editLabel.trim() && onRenameSnapshot) {
      onRenameSnapshot(editingSnapshot.id, editLabel.trim());
    }
    setEditingSnapshot(null);
  };

  const handleConfirmDelete = () => {
    if (deletingSnapshot && onDeleteSnapshot) {
      onDeleteSnapshot(deletingSnapshot.id);
    }
    setDeletingSnapshot(null);
  };

  const handleLoadSnapshot = (id: string) => {
    onSelectActiveSnapshot(id);
    onNavigate('architecture');
  };

  const handleCompareSnapshot = (id: string) => {
    onSelectActiveSnapshot(id);
    onNavigate('compare');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Header & Save Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Architecture Version Snapshots ({model.systemName})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable frozen snapshots of reconstructed architecture topologies and Level 1 repository inventories.
          </p>
        </div>

        <button
          onClick={() => setIsSaving(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-xs shadow-violet-200 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Save Current State</span>
        </button>
      </div>

      {/* Inline Save Form if toggled */}
      {isSaving && (
        <form
          onSubmit={handleSave}
          className="bg-white p-4 rounded-2xl border-2 border-violet-200 shadow-xs flex flex-col sm:flex-row items-center gap-3 animate-in fade-in duration-150"
        >
          <input
            type="text"
            value={newSnapshotLabel}
            onChange={(e) => setNewSnapshotLabel(e.target.value)}
            placeholder="Enter snapshot name (e.g. v1.1-monolith-decoupling)..."
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
            autoFocus
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsSaving(false)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newSnapshotLabel.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer"
            >
              Freeze Snapshot
            </button>
          </div>
        </form>
      )}

      {/* Rename Modal */}
      {editingSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmRename}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-violet-600" />
                <h3 className="text-sm font-bold text-slate-900">Rename Snapshot</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSnapshot(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">New Label:</label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-violet-500 focus:bg-white"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSnapshot(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editLabel.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer"
              >
                Save Label
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="p-2 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Architecture Snapshot?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              You are about to permanently delete <strong className="text-slate-900 font-semibold">{deletingSnapshot.label}</strong>.
              The active workspace and other snapshots will remain untouched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingSnapshot(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Delete Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshots.map((snap) => {
          const isCurrentActive = snap.id === activeSnapshotId;
          const entityCount = snap.architecture.entities.length;
          const relCount = snap.architecture.relationships.length;
          const fileCount = snap.architecture.inventory?.total_files ?? 0;

          return (
            <div
              key={snap.id}
              className={`bg-white rounded-2xl p-5 border transition-all shadow-2xs flex flex-col justify-between ${
                isCurrentActive
                  ? 'border-violet-400 ring-2 ring-violet-200 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                      <h3 className="text-sm font-bold text-slate-900 truncate" title={snap.label}>
                        {snap.label}
                      </h3>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{snap.createdAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Rename Button */}
                    <button
                      data-testid="snapshot-rename-btn"
                      onClick={() => handleStartRename(snap)}
                      title="Rename snapshot"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      data-testid="snapshot-delete-btn"
                      onClick={() => setDeletingSnapshot(snap)}
                      title="Delete snapshot"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {isCurrentActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 ml-1">
                        LOADED
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 my-4 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-sm font-extrabold text-slate-900">{entityCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Nodes</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-sm font-extrabold text-slate-900">{relCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Calls</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-sm font-extrabold text-slate-900">{fileCount || entityCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Files</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                <button
                  onClick={() => handleLoadSnapshot(snap.id)}
                  className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-700 font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>View Graph</span>
                </button>

                <button
                  onClick={() => handleCompareSnapshot(snap.id)}
                  className="py-2 px-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold flex items-center justify-center gap-1 border border-violet-200 transition-colors cursor-pointer"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Compare</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default SnapshotsPage;
