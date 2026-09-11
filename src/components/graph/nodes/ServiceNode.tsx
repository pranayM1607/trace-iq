import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Server, ArrowDownLeft, ArrowUpRight, CheckCircle2, FileCode } from 'lucide-react';
import type { ArchitectureEntity } from '../../../types/architecture';

export interface CustomNodeData {
  entity: ArchitectureEntity;
  isSelected?: boolean;
  isConnected?: boolean;
  isDimmed?: boolean;
  incomingCount?: number;
  outgoingCount?: number;
  direction?: 'LR' | 'TB';
}

export const ServiceNode: React.FC<NodeProps> = memo(({ data }) => {
  const nodeData = data as unknown as CustomNodeData;
  const {
    entity,
    isSelected,
    isConnected,
    isDimmed,
    incomingCount = 0,
    outgoingCount = 0,
    direction = 'LR',
  } = nodeData;

  const targetPosition = direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

  const visualClass = isSelected
    ? 'border-blue-600 ring-4 ring-blue-500/30 shadow-lg scale-[1.02] z-30 opacity-100'
    : isConnected
    ? 'border-blue-400 ring-2 ring-blue-400/25 shadow-md z-20 opacity-95'
    : isDimmed
    ? 'opacity-50 border-slate-200 shadow-2xs hover:opacity-85'
    : 'border-slate-200/90 hover:border-blue-400 hover:shadow-md opacity-100';

  return (
    <div
      className={`relative w-[260px] rounded-xl border bg-white transition-all duration-200 cursor-pointer select-none ${visualClass}`}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-blue-600 !border-2 !border-white !-ml-1.5"
      />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/80 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-blue-100 text-blue-700">
            <Server className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Service</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
              entity.source === 'Detected'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
            }`}
          >
            {entity.source === 'Detected' ? (
              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
            ) : (
              <FileCode className="w-2.5 h-2.5 mr-0.5" />
            )}
            {entity.source}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3.5 py-2.5">
        <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate" title={entity.name}>
          {entity.name}
        </h3>
        <p className="text-[11px] text-slate-500 truncate mt-0.5" title={entity.technology}>
          {entity.technology}
        </p>

        {/* Footer Metrics */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1" title={`${incomingCount} Incoming Connections`}>
            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
            <span>{incomingCount} in</span>
          </div>
          <div className="flex items-center gap-1" title={`${outgoingCount} Outgoing Connections`}>
            <ArrowUpRight className="w-3 h-3 text-blue-600" />
            <span>{outgoingCount} out</span>
          </div>
          {entity.metadata?.port && (
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[9px]">
              :{entity.metadata.port}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-blue-600 !border-2 !border-white !-mr-1.5"
      />
    </div>
  );
});
