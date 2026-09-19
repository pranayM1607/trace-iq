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
      />
    </div>
  );
};
