import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';
import type { ArchitectureEntity, RiskLevel } from '../../../types/analysis';

interface ExternalNodeProps {
  data: {
    entity: ArchitectureEntity;
    isSelected: boolean;
    isConnected: boolean;
    isDimmed: boolean;
    critTier: RiskLevel;
    direction?: 'LR' | 'TB';
  };
}

export const ExternalNode: React.FC<ExternalNodeProps> = ({ data }) => {
  const {
    entity,
    isSelected,
    isConnected,
    isDimmed,
    critTier,
    direction = 'LR',
  } = data;

  const isLR = direction === 'LR';
  const targetPos = isLR ? Position.Left : Position.Top;
  const sourcePos = isLR ? Position.Right : Position.Bottom;

  const isHigh = critTier === 'CRITICAL' || critTier === 'HIGH';

  let containerClasses = 'bg-white border-slate-200/90 text-slate-900 shadow-2xs hover:border-amber-400 hover:shadow-md';

  if (isHigh) {
    containerClasses = 'bg-amber-50/30 border-amber-300 shadow-sm hover:border-amber-400';
  }

  if (isSelected) {
    containerClasses += ' ring-4 ring-amber-500/25 border-amber-600 shadow-lg scale-[1.02] z-30 opacity-100';
  } else if (isConnected) {
    containerClasses += ' ring-2 ring-amber-400/25 border-amber-400 shadow-sm z-20 opacity-95';
  }

  return (
    <div
      className={`relative w-[230px] rounded-xl border transition-all duration-200 cursor-pointer select-none overflow-hidden ${containerClasses} ${
        isDimmed ? 'opacity-40 border-slate-200 hover:opacity-85' : 'opacity-100'
      }`}
    >
      <Handle
        type="target"
        position={targetPos}
        className="!w-2.5 !h-2.5 !bg-amber-600 !border-2 !border-white"
      />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-amber-50/70 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <div className="p-0.5 rounded bg-amber-100 text-amber-800">
            <ExternalLink className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">External System</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <h4 className="text-xs font-semibold text-slate-900 truncate leading-tight tracking-tight" title={entity.name}>
          {entity.name}
        </h4>
        <span className="text-[10px] text-amber-700/90 font-mono truncate block mt-0.5" title={entity.technology}>
          {entity.technology}
        </span>

        {/* Footer info & Severity */}
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[9px] text-amber-700/80 font-mono font-medium">Third-Party API</span>
          {isHigh ? (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
              High Risk
            </span>
          ) : (
            <span className="text-[9px] text-slate-400 font-mono">External</span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePos}
        className="!w-2.5 !h-2.5 !bg-amber-600 !border-2 !border-white"
      />
    </div>
  );
};
