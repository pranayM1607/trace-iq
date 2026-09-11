import React from 'react';
import {
  Sparkles,
  FileCode,
  FileArchive,
  Layers,
  Network,
  RotateCcw,
} from 'lucide-react';

interface HeaderProps {
  onLoadDemo: () => void;
  onOpenBlueprintModal: () => void;
  onOpenCodebaseModal: () => void;
  onOpenScenarioModal: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadDemo,
  onOpenBlueprintModal,
  onOpenCodebaseModal,
  onOpenScenarioModal,
  onReset,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4 max-w-full">
        {/* Left: Branding & Objective Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Trace<span className="text-blue-400">IQ</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  Objective 1 Prototype
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Automated Architecture Ingestion & Interactive Dependency Graph
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Demo Button */}
          <button
            onClick={onLoadDemo}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title="Instantly load realistic microservice system for mentor review"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Demo Architecture</span>
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
            title="Reset to default demo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
