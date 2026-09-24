import React from 'react';
import type { ArchitectureComparisonResult } from '../../types/architecture';
import { DirectCompareView } from '../compare/DirectCompareView';

interface ComparePageProps {
  onSelectEntity?: (entityId: string) => void;
  persistedComparison?: ArchitectureComparisonResult | null;
  onSetPersistedComparison?: (result: ArchitectureComparisonResult | null) => void;
  persistedOrigFile?: File | null;
  onSetPersistedOrigFile?: (file: File | null) => void;
  persistedChgFile?: File | null;
  onSetPersistedChgFile?: (file: File | null) => void;
  persistedActiveTab?: 'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'try_change' | 'json_payload';
  onSetPersistedActiveTab?: (tab: 'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'try_change' | 'json_payload') => void;
  persistedCompareDirection?: 'v1_to_v2' | 'v2_to_v1';
  onSetPersistedCompareDirection?: (dir: 'v1_to_v2' | 'v2_to_v1') => void;
  persistedSimulationTarget?: 'v1' | 'v2';
  onSetPersistedSimulationTarget?: (target: 'v1' | 'v2') => void;
}

export const ComparePage: React.FC<ComparePageProps> = ({
  onSelectEntity,
  persistedComparison,
  onSetPersistedComparison,
  persistedOrigFile,
  onSetPersistedOrigFile,
  persistedChgFile,
  onSetPersistedChgFile,
  persistedActiveTab,
  onSetPersistedActiveTab,
  persistedCompareDirection,
  onSetPersistedCompareDirection,
  persistedSimulationTarget,
  onSetPersistedSimulationTarget,
}) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-slate-100">
      <DirectCompareView
        onSelectEntity={onSelectEntity}
        persistedComparison={persistedComparison}
        onSetPersistedComparison={onSetPersistedComparison}
        persistedOrigFile={persistedOrigFile}
        onSetPersistedOrigFile={onSetPersistedOrigFile}
        persistedChgFile={persistedChgFile}
        onSetPersistedChgFile={onSetPersistedChgFile}
        persistedActiveTab={persistedActiveTab}
        onSetPersistedActiveTab={onSetPersistedActiveTab}
        persistedCompareDirection={persistedCompareDirection}
        onSetPersistedCompareDirection={onSetPersistedCompareDirection}
        persistedSimulationTarget={persistedSimulationTarget}
        onSetPersistedSimulationTarget={onSetPersistedSimulationTarget}
      />
    </div>
  );
};
