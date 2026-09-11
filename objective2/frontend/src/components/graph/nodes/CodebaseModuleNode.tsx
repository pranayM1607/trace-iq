import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Folder, Boxes } from 'lucide-react';
import type { CodebaseNode } from '../../../types/analysis';

export interface CodebaseModuleNodeData {
  node: CodebaseNode;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  inDegree: number;
  outDegree: number;
}

interface CodebaseModuleNodeProps {
  data: CodebaseModuleNodeData;
}

export const CodebaseModuleNode = memo(({ data }: CodebaseModuleNodeProps) => {
  const { node, isSelected, isDimmed, isHighlighted, inDegree, outDegree } = data;

  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] bg-slate-50/80 rounded-xl border p-3 shadow-xs transition-all duration-150 cursor-pointer select-none font-sans backdrop-blur-xs ${
        isSelected
          ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-md bg-violet-50/30'
          : isHighlighted
          ? 'border-indigo-400 ring-2 ring-indigo-400/20 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 hover:shadow-sm'
      } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-slate-400 hover:!bg-violet-600 !border-2 !border-white transition-colors"
      />

      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1 rounded bg-violet-100 text-violet-700 border border-violet-200">
          {node.type === 'module' ? <Boxes className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        </div>
        <div className="truncate">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-violet-600">
            {node.type === 'module' ? 'Module' : 'Folder'}
          </div>
          <div className="font-bold text-xs text-slate-900 truncate" title={node.path}>
            {node.name || node.path}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/60 font-mono">
        <span className="truncate max-w-[140px]" title={node.path}>
          {node.path}
        </span>
        <div className="flex items-center gap-1.5">
          {inDegree > 0 && <span className="text-indigo-600 font-semibold">in:{inDegree}</span>}
          {outDegree > 0 && <span className="text-violet-600 font-semibold">out:{outDegree}</span>}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-slate-400 hover:!bg-violet-600 !border-2 !border-white transition-colors"
      />
    </div>
  );
});

CodebaseModuleNode.displayName = 'CodebaseModuleNode';
