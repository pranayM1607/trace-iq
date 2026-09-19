import React from 'react';
import {
  Network,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
} from '../../types/architecture';
import { ArchitectureGraph } from '../graph/ArchitectureGraph';
import { ArchitectureDetailsPanel } from '../details/ArchitectureDetailsPanel';

interface ArchitecturePageProps {
  model: ArchitectureModel;
  currentEntities: ArchitectureEntity[];
  currentRelationships: ArchitectureRelationship[];
  selectedEntityId: string | null;
  selectedEdgeId: string | null;
  onSelectEntity: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
}

export const ArchitecturePage: React.FC<ArchitecturePageProps> = ({
  model,
  currentEntities,
  currentRelationships,
  selectedEntityId,
  selectedEdgeId,
  onSelectEntity,
  onSelectEdge,
}) => {
  const selectedEntity = currentEntities.find((e) => e.id === selectedEntityId) || null;
  const selectedRelationship =
    currentRelationships.find((r) => r.id === selectedEdgeId) || null;

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
                  {model.systemName}
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  v{model.version || '1.0.0'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Single-version topology inspection • Level 2 semantic architecture model
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
            {currentEntities.length} Components
          </span>
          <span>•</span>
          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
            {currentRelationships.length} Relationships
          </span>
        </div>
      </div>

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
