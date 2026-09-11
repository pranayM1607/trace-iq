import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileCode, FileText, Settings, FileSpreadsheet, Box } from 'lucide-react';
import type { CodebaseNode } from '../../../types/analysis';

export interface CodebaseFileNodeData {
  node: CodebaseNode;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  inDegree: number;
  outDegree: number;
}

interface CodebaseFileNodeProps {
  data: CodebaseFileNodeData;
}

const getCategoryIcon = (category?: string | null) => {
  switch (category) {
    case 'source':
      return <FileCode className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    case 'manifest':
      return <Box className="w-3.5 h-3.5 text-violet-600 shrink-0" />;
    case 'config':
      return <Settings className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    case 'documentation':
      return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    default:
      return <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  }
};

const getLanguageBadgeColor = (lang?: string | null) => {
  switch (lang) {
    case 'TypeScript':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'JavaScript':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Python':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Go':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'Java':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'C#':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Rust':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

export const CodebaseFileNode = memo(({ data }: CodebaseFileNodeProps) => {
  const { node, isSelected, isDimmed, isHighlighted, inDegree, outDegree } = data;

  const fileName = node.name || node.path.split('/').pop() || 'file';
  const dirPath = node.path.includes('/')
    ? node.path.substring(0, node.path.lastIndexOf('/'))
    : '';

  return (
    <div
      className={`relative min-w-[210px] max-w-[260px] bg-white rounded-xl border p-2.5 shadow-xs transition-all duration-150 cursor-pointer select-none font-sans ${
        isSelected
          ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-md bg-violet-50/10'
          : isHighlighted
          ? 'border-indigo-400 ring-2 ring-indigo-400/20 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-300 hover:!bg-violet-600 !border-2 !border-white transition-colors"
      />

      {/* Directory Breadcrumb */}
      {dirPath && (
        <div className="text-[10px] text-slate-400 truncate mb-1 font-mono tracking-tight" title={dirPath}>
          {dirPath}/
        </div>
      )}

      {/* Main File Name & Icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded bg-slate-50 border border-slate-100">
          {getCategoryIcon(node.category)}
        </div>
        <div className="truncate font-semibold text-xs text-slate-800" title={node.path}>
          {fileName}
        </div>
      </div>

      {/* Badges and Metrics */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-[10px]">
        {node.language ? (
          <span
            className={`px-1.5 py-0.5 rounded border font-medium ${getLanguageBadgeColor(
              node.language
            )}`}
          >
            {node.language}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 font-mono">
            {node.extension || 'file'}
          </span>
        )}

        <div className="flex items-center gap-2 font-mono text-slate-500">
          {node.lines_count > 0 && <span>{node.lines_count}L</span>}
          <div className="flex items-center gap-1 text-[9px]">
            <span
              className={`px-1 rounded ${
                inDegree > 0 ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-400'
              }`}
              title={`Imported by ${inDegree} file(s)`}
            >
              in:{inDegree}
            </span>
            <span
              className={`px-1 rounded ${
                outDegree > 0 ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-400'
              }`}
              title={`Imports ${outDegree} file(s)`}
            >
              out:{outDegree}
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-300 hover:!bg-violet-600 !border-2 !border-white transition-colors"
      />
    </div>
  );
});

CodebaseFileNode.displayName = 'CodebaseFileNode';
