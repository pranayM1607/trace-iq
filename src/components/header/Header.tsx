import React from 'react';
import {
  Sparkles,
  FileCode,
  FileArchive,
  Layers,
  Network,
  RotateCcw,
  Boxes,
  Search,
  GitCompare,
} from 'lucide-react';

interface HeaderProps {
  workflowMode?: 'analyze' | 'compare';
  onSelectWorkflowMode?: (mode: 'analyze' | 'compare') => void;
  onLoadDemo: () => void;
  onOpenBlueprintModal: () => void;
  onOpenCodebaseModal: () => void;
  onOpenScenarioModal: () => void;
  onReset: () => void;
  onOpenInventoryModal?: () => void;
  inventoryCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  workflowMode = 'analyze',
  onSelectWorkflowMode,
  onLoadDemo,
  onOpenBlueprintModal,
  onOpenCodebaseModal,
  onOpenScenarioModal,
  onReset,
  onOpenInventoryModal,
  inventoryCount,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4 max-w-full">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  TRACE<span className="text-purple-400">IQ</span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Automated Software Architecture & Dependency Analysis Framework
              </p>
            </div>
          </div>
        </div>

        {/* Center: Mode Switcher [ ANALYZE ] [ COMPARE ] */}
        {onSelectWorkflowMode && (
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 shadow-inner">
            <button
              onClick={() => onSelectWorkflowMode('analyze')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                workflowMode === 'analyze'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>ANALYZE</span>
            </button>
            <button
              onClick={() => onSelectWorkflowMode('compare')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                workflowMode === 'compare'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>COMPARE</span>
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Demo Button */}
          <button
            onClick={onLoadDemo}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm shadow-purple-600/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title="Load reference architecture"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reference Architecture</span>
          </button>

          {/* Blueprint Ingestion Button */}
          <button
            onClick={onOpenBlueprintModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Upload or paste custom architecture blueprint JSON"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload Blueprint</span>
          </button>

          {/* Codebase Upload Button */}
          <button
            onClick={onOpenCodebaseModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Upload and extract dependencies from ZIP codebase"
          >
            <FileArchive className="w-3.5 h-3.5 text-purple-400" />
            <span>Upload Codebase</span>
          </button>

          {/* Codebase Inventory Button */}
          {onOpenInventoryModal && (
            <button
              onClick={onOpenInventoryModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
              title="Inspect Level 1 Codebase Inventory (100% of uploaded files)"
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-400" />
              <span>Codebase Inventory</span>
              {typeof inventoryCount === 'number' && inventoryCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {inventoryCount}
                </span>
              )}
            </button>
          )}

          {/* Presets Button */}
          <button
            onClick={onOpenScenarioModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="Browse built-in architecture scenarios"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Scenarios</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
            title="Reset to default architecture"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
