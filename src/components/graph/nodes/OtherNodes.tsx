import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Box, BookOpen, ExternalLink, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { CustomNodeData } from './ServiceNode';

export const ModuleNode: React.FC<NodeProps> = memo(({ data }) => {
  const nodeData = data as unknown as CustomNodeData;
  const {
    entity,
    isSelected,
    isConnected,
    isDimmed,
    incomingCount = 0,
    outgoingCount = 0,
    direction = 'LR',
    diffMode = false,
    diffChangeType,
  } = nodeData;

  const targetPosition = direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

  let visualClass = isSelected
    ? 'border-purple-600 ring-4 ring-purple-500/30 shadow-lg scale-[1.02] z-30 opacity-100'
    : isConnected
    ? 'border-purple-400 ring-2 ring-purple-400/25 shadow-md z-20 opacity-95'
    : isDimmed
    ? 'opacity-50 border-slate-200 shadow-2xs hover:opacity-85'
    : 'border-slate-200/90 hover:border-purple-400 hover:shadow-md opacity-100';

  if (diffMode && diffChangeType) {
    if (diffChangeType === 'added') {
      visualClass = isSelected
        ? 'border-emerald-600 ring-4 ring-emerald-500/30 shadow-lg scale-[1.02] z-30 bg-emerald-50/20'
        : 'border-emerald-500 bg-emerald-50/15 ring-2 ring-emerald-400/30 shadow-md';
    } else if (diffChangeType === 'removed') {
      visualClass = isSelected
        ? 'border-dashed border-rose-600 ring-4 ring-rose-500/30 shadow-lg scale-[1.02] z-30 bg-rose-50/30'
        : 'border-dashed border-rose-400 bg-rose-50/20 opacity-70 hover:opacity-95';
    } else {
      visualClass = isSelected
        ? 'border-purple-600 ring-4 ring-purple-500/30 shadow-lg scale-[1.02] z-30'
        : 'border-slate-200/80 opacity-80';
    }
  }

  return (
    <div
      className={`relative w-[230px] rounded-xl border bg-white transition-all duration-200 cursor-pointer select-none ${visualClass}`}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-purple-600 !border-2 !border-white !-ml-1.5"
      />

      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-purple-50/60 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-purple-100 text-purple-800">
            <Box className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Module</span>
        </div>
        {diffMode && diffChangeType ? (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
              diffChangeType === 'added'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : diffChangeType === 'removed'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {diffChangeType === 'added' ? '+ ADDED' : diffChangeType === 'removed' ? '- REMOVED' : 'UNCHANGED'}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-purple-700 bg-purple-100/60 px-1.5 py-0.5 rounded">
            Internal
          </span>
        )}
      </div>

      <div className="px-3.5 py-2">
        <h3 className="font-semibold text-slate-900 text-xs leading-tight truncate" title={entity.name}>
          {entity.name}
        </h3>
        <p className="text-[10px] text-slate-500 truncate mt-0.5" title={entity.technology}>
          {entity.technology}
        </p>

        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>{incomingCount} importers</span>
          <span>{outgoingCount} deps</span>
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-purple-600 !border-2 !border-white !-mr-1.5"
      />
    </div>
  );
});

export const LibraryNode: React.FC<NodeProps> = memo(({ data }) => {
  const nodeData = data as unknown as CustomNodeData;
  const {
    entity,
    isSelected,
    isConnected,
    isDimmed,
    incomingCount = 0,
    direction = 'LR',
  } = nodeData;

  const targetPosition = direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

  const visualClass = isSelected
    ? 'border-cyan-600 ring-4 ring-cyan-500/30 shadow-lg scale-[1.02] z-30 opacity-100'
    : isConnected
    ? 'border-cyan-400 ring-2 ring-cyan-400/25 shadow-md z-20 opacity-95'
    : isDimmed
    ? 'opacity-50 border-slate-200 shadow-2xs hover:opacity-85'
    : 'border-slate-200/90 hover:border-cyan-400 hover:shadow-md opacity-100';

  return (
    <div
      className={`relative w-[220px] rounded-xl border bg-white transition-all duration-200 cursor-pointer select-none ${visualClass}`}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-cyan-600 !border-2 !border-white !-ml-1.5"
      />

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-cyan-50/60 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-cyan-100 text-cyan-800">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-800">Library</span>
        </div>
        <span className="text-[9px] font-mono text-cyan-700 bg-cyan-100/60 px-1 py-0.2 rounded">
          pkg
        </span>
      </div>

      <div className="px-3 py-2">
        <h3 className="font-semibold text-slate-900 text-xs leading-tight truncate font-mono" title={entity.name}>
          {entity.name}
        </h3>
        <p className="text-[10px] text-slate-500 truncate mt-0.5" title={entity.technology}>
          {entity.technology}
        </p>

        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>Used by {incomingCount} component{incomingCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-cyan-600 !border-2 !border-white !-mr-1.5"
      />
    </div>
  );
});

export const ExternalNode: React.FC<NodeProps> = memo(({ data }) => {
  const nodeData = data as unknown as CustomNodeData;
  const {
    entity,
    isSelected,
    isConnected,
    isDimmed,
    incomingCount = 0,
    outgoingCount = 0,
    direction = 'LR',
    diffMode = false,
    diffChangeType,
  } = nodeData;

  const targetPosition = direction === 'LR' ? Position.Left : Position.Top;
  const sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

  let visualClass = isSelected
    ? 'border-amber-600 ring-4 ring-amber-500/30 shadow-lg scale-[1.02] z-30 opacity-100'
    : isConnected
    ? 'border-amber-400 ring-2 ring-amber-400/25 shadow-md z-20 opacity-95'
    : isDimmed
    ? 'opacity-50 border-slate-200 shadow-2xs hover:opacity-85'
    : 'border-slate-200/90 hover:border-amber-400 hover:shadow-md opacity-100';

  if (diffMode && diffChangeType) {
    if (diffChangeType === 'added') {
      visualClass = isSelected
        ? 'border-emerald-600 ring-4 ring-emerald-500/30 shadow-lg scale-[1.02] z-30 bg-emerald-50/20'
        : 'border-emerald-500 bg-emerald-50/15 ring-2 ring-emerald-400/30 shadow-md';
    } else if (diffChangeType === 'removed') {
      visualClass = isSelected
        ? 'border-dashed border-rose-600 ring-4 ring-rose-500/30 shadow-lg scale-[1.02] z-30 bg-rose-50/30'
        : 'border-dashed border-rose-400 bg-rose-50/20 opacity-70 hover:opacity-95';
    } else {
      visualClass = isSelected
        ? 'border-amber-600 ring-4 ring-amber-500/30 shadow-lg scale-[1.02] z-30'
        : 'border-slate-200/80 opacity-80';
    }
  }

  return (
    <div
      className={`relative w-[250px] rounded-xl border bg-white transition-all duration-200 cursor-pointer select-none ${visualClass}`}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-amber-600 !border-2 !border-white !-ml-1.5"
      />

      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-amber-50/70 rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-amber-100 text-amber-900">
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">External System</span>
        </div>
        {diffMode && diffChangeType ? (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
              diffChangeType === 'added'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : diffChangeType === 'removed'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {diffChangeType === 'added' ? '+ ADDED' : diffChangeType === 'removed' ? '- REMOVED' : 'UNCHANGED'}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
            Third-Party
          </span>
        )}
      </div>

      <div className="px-3.5 py-2.5">
        <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate" title={entity.name}>
          {entity.name}
        </h3>
        <p className="text-[11px] text-slate-500 truncate mt-0.5" title={entity.technology}>
          {entity.technology}
        </p>

        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3 text-amber-600" />
            <span>{incomingCount} callers</span>
          </div>
          {outgoingCount > 0 && (
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-amber-600" />
              <span>{outgoingCount} targets</span>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-amber-600 !border-2 !border-white !-mr-1.5"
      />
    </div>
  );
});
