import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Globe, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { CustomNodeData } from './ServiceNode';

export const ApiNode: React.FC<NodeProps> = memo(({ data }) => {
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

  const method = entity.metadata?.method || 'API';
  const methodColor =
    method === 'GET'
      ? 'bg-blue-100 text-blue-800'
      : method === 'POST'
      ? 'bg-emerald-100 text-emerald-800'
      : method === 'DELETE'
      ? 'bg-rose-100 text-rose-800'
      : 'bg-amber-100 text-amber-800';

  const visualClass = isSelected
    ? 'border-teal-600 ring-4 ring-teal-500/30 shadow-lg scale-[1.02] z-30 opacity-100'
    : isConnected
    ? 'border-teal-400 ring-2 ring-teal-400/25 shadow-md z-20 opacity-95'
    : isDimmed
    ? 'opacity-50 border-slate-200 shadow-2xs hover:opacity-85'
    : 'border-slate-200/90 hover:border-teal-400 hover:shadow-md opacity-100';

  return (
    <div
      className={`relative w-[240px] rounded-xl border bg-white transition-all duration-200 cursor-pointer select-none ${visualClass}`}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-teal-600 !border-2 !border-white !-ml-1.5"
      />

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-teal-50/60 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-teal-100 text-teal-800">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">API Endpoint</span>
        </div>
        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${methodColor}`}>
          {method}
        </span>
      </div>

      <div className="px-3 py-2">
        <h3 className="font-semibold text-slate-900 text-xs leading-tight truncate font-mono" title={entity.name}>
          {entity.name}
        </h3>
        <p className="text-[10px] text-slate-500 truncate mt-0.5" title={entity.technology}>
          {entity.technology}
        </p>

        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3 text-teal-600" />
            <span>{incomingCount} in</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-teal-600" />
            <span>{outgoingCount} out</span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-teal-600 !border-2 !border-white !-mr-1.5"
      />
    </div>
  );
});
