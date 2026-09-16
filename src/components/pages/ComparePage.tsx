import React from 'react';
import type { ArchitectureSnapshot } from '../../types/architecture';
import { DirectCompareView } from '../compare/DirectCompareView';

interface ComparePageProps {
  savedSnapshots: ArchitectureSnapshot[];
  onSelectEntity?: (entityId: string) => void;
}

export const ComparePage: React.FC<ComparePageProps> = ({
  savedSnapshots,
  onSelectEntity,
}) => {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/50">
      <DirectCompareView savedSnapshots={savedSnapshots} onSelectEntity={onSelectEntity} />
    </div>
  );
};
