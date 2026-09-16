import React, { useState } from 'react';
import {
  Bookmark,
  Plus,
  Network,
  Layers,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
  ArchitectureSnapshot,
} from '../../types/architecture';
import { ArchitectureGraph } from '../graph/ArchitectureGraph';
import { ArchitectureDetailsPanel } from '../details/ArchitectureDetailsPanel';

interface ArchitecturePageProps {
  model: ArchitectureModel;
  snapshots: ArchitectureSnapshot[];
  activeSnapshotId: string;
  onSelectActiveSnapshot: (id: string) => void;
  onSaveSnapshot: (label: string) => void;
  currentEntities: ArchitectureEntity[];
  currentRelationships: ArchitectureRelationship[];
  selectedEntityId: string | null;
  selectedEdgeId: string | null;
  onSelectEntity: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
}

export const ArchitecturePage: React.FC<ArchitecturePageProps> = ({
  model,
  snapshots,
  activeSnapshotId,
  onSelectActiveSnapshot,
  onSaveSnapshot,
  currentEntities,
  currentRelationships,
  selectedEntityId,
  selectedEdgeId,
  onSelectEntity,
  onSelectEdge,
}) => {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSnapshotLabel, setNewSnapshotLabel] = useState('');

  const selectedEntity = currentEntities.find((e) => e.id === selectedEntityId) || null;
  const selectedRelationship =
    currentRelationships.find((r) => r.id === selectedEdgeId) || null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapshotLabel.trim()) return;
    onSaveSnapshot(newSnapshotLabel.trim());
    setNewSnapshotLabel('');
    setIsSaveModalOpen(false);
  };

  const activeSnapshot = snapshots.find((s) => s.id === activeSnapshotId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Clean Single-Version Top Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
              <Network className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 leading-none">
                  {activeSnapshot ? activeSnapshot.label : model.systemName}
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  v{activeSnapshot ? activeSnapshot.version : model.version || '1.0.0'}
                </span>
                {activeSnapshot && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-50 text-violet-700 border border-violet-200">
                    Snapshot View
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Single-version topology inspection • Level 2 semantic architecture model
              </p>
            </div>
          </div>
        </div>

        {/* Snapshot Selector & Actions */}
        <div className="flex items-center gap-2.5">
          {snapshots.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-600 text-[11px]">View Version:</span>
              <select
                value={activeSnapshotId}
                onChange={(e) => onSelectActiveSnapshot(e.target.value)}
                className="bg-transparent font-bold text-purple-700 focus:outline-none cursor-pointer pr-1"
              >
                <option value="">Current Workspace ({model.systemName})</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.nodeCount} nodes)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Snapshot</span>
          </button>
        </div>
      </div>

      {/* Inline Save Snapshot Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveSubmit}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">Freeze Architecture Snapshot</h3>
            </div>
            <p className="text-xs text-slate-500">
              Save an immutable snapshot of the current architecture model ({currentEntities.length} components,{' '}
              {currentRelationships.length} relationships) and its Level 1 repository inventory.
            </p>
            <input
              type="text"
              value={newSnapshotLabel}
              onChange={(e) => setNewSnapshotLabel(e.target.value)}
              placeholder="e.g. v1.0-initial-reconstruction"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newSnapshotLabel.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer"
              >
                Freeze Snapshot
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Single-Version Graph Canvas & Contextual Details Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        <ArchitectureGraph
          entities={currentEntities}
          relationships={currentRelationships}
          selectedEntityId={selectedEntityId}
          onSelectEntity={(id) => {
            onSelectEntity(id);
            if (id) onSelectEdge(null);
          }}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={(edgeId) => {
            onSelectEdge(edgeId);
            if (edgeId) onSelectEntity(null);
          }}
          extractedAt={model.extractedAt}
          isLimitedArchitecture={model.isLimitedArchitecture}
          limitedArchitectureReason={model.limitedArchitectureReason}
          diffMode={false}
        />

        {/* Contextual Right Details Panel */}
        <ArchitectureDetailsPanel
          selectedEntity={selectedEntity}
          selectedRelationship={selectedRelationship}
          allEntities={currentEntities}
          relationships={currentRelationships}
          onClose={() => {
            onSelectEntity(null);
            onSelectEdge(null);
          }}
          onSelectEntity={(id) => {
            onSelectEntity(id);
            onSelectEdge(null);
          }}
          diffMode={false}
        />
      </div>
    </div>
  );
};
export default ArchitecturePage;
