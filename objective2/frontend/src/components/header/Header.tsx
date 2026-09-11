import React from 'react';
import {
  Play,
  Upload,
  Activity,
  Network,
  FolderTree,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  systemName?: string;
  activeView: 'graph' | 'triage' | 'codebase';
  onChangeView: (view: 'graph' | 'triage' | 'codebase') => void;
  onLoadDemo: () => void;
  onRunAnalysis: () => void;
  onOpenImportModal: () => void;
  isAnalyzing: boolean;
  isBackendHealthy: boolean;
  hasAnalysis: boolean;
  totalFiles?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  onLoadDemo,
  onRunAnalysis,
  onOpenImportModal,
  isAnalyzing,
  isBackendHealthy,
  hasAnalysis,
  totalFiles,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 z-30 font-sans shadow-xs">
      {/* Left: Clean Brand (Pure TRACEIQ, no subtitles or objective labels) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white font-black text-xs shadow-xs tracking-tighter">
            IQ
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-900">
            TRACE<span className="text-violet-600">IQ</span>
          </h1>
        </div>
      </div>

      {/* Center: View Switcher (Graph View vs Risk & Triage vs Codebase) */}
      <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
        <button
          onClick={() => onChangeView('graph')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeView === 'graph'
              ? 'bg-white text-violet-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Graph View</span>
        </button>

        <button
          onClick={() => onChangeView('triage')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeView === 'triage'
              ? 'bg-white text-violet-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Risk & Triage</span>
          {hasAnalysis && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-0.5" />
          )}
        </button>

        <button
          onClick={() => onChangeView('codebase')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeView === 'codebase'
              ? 'bg-white text-violet-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Codebase</span>
          {typeof totalFiles === 'number' && totalFiles > 0 && (
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-mono rounded-full font-semibold">
              {totalFiles}
            </span>
          )}
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Subtle Engine Status Dot */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-slate-500 font-mono"
          title={isBackendHealthy ? 'Analysis Engine Connected' : 'Analysis Engine Offline'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendHealthy ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-rose-500'
            }`}
          />
          <span className="hidden lg:inline text-[11px] font-medium text-slate-500">
            {isBackendHealthy ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Load Sample Button */}
        <button
          onClick={onLoadDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
          title="Load Sample Architecture"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          <span className="hidden sm:inline">Sample</span>
        </button>

        {/* Import JSON Button */}
        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
          title="Import Architecture JSON"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Import</span>
        </button>

        {/* Primary Action: Analyze */}
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-xs shadow-violet-600/20 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
        >
          {isAnalyzing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3 h-3 fill-white" />
          )}
          <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
        </button>
      </div>
    </header>
  );
};
