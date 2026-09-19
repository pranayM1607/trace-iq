import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  RotateCcw,
  Sparkles,
  UploadCloud,
  FileCode,
  CheckCircle2,
  Database,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { NavRoute } from './Sidebar';

interface TopHeaderProps {
  currentRoute: NavRoute;
  systemName: string;
  version: string;
  inputType: 'blueprint' | 'codebase';
  filesCount?: number;
  onOpenSearch: () => void;
  onLoadDemo: () => void;
  onOpenBlueprintModal: () => void;
  onOpenCodebaseModal: () => void;
  onReset: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentRoute,
  systemName,
  version,
  inputType,
  filesCount,
  onOpenSearch,
  onLoadDemo,
  onOpenBlueprintModal,
  onOpenCodebaseModal,
  onReset,
}) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (uploadRef.current && !uploadRef.current.contains(event.target as Node)) {
        setIsUploadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const routeBreadcrumbMap: Record<NavRoute, { section: string; title: string }> = {
    analyze: { section: 'Overview', title: 'Analyze Workspace' },
    compare: { section: 'Overview', title: 'Compare Architectures' },
    architecture: { section: 'Architecture', title: 'Architecture Graph Canvas' },
    dependencies: { section: 'Architecture', title: 'Dependencies & Protocols' },
    inventory: { section: 'Architecture', title: '100% Repository Inventory' },
    risk: { section: 'Insights', title: 'Architecture Risk Analysis' },
    impact: { section: 'Insights', title: 'Impact & Blast Radius' },
    evidence: { section: 'Insights', title: 'Code Evidence Provenance' },
    simulator: { section: 'Change Intelligence', title: 'Change Simulator' },
    reports: { section: 'Reports', title: 'Executive Architecture Report' },
  };

  const breadcrumb = routeBreadcrumbMap[currentRoute] || { section: 'Overview', title: 'Workspace' };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 select-none z-10">
      {/* Left: Breadcrumbs & Current Page Title */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">{breadcrumb.section}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">{breadcrumb.title}</h1>

        {/* Source State Pill */}
        <div className="ml-3 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              inputType === 'codebase' ? 'bg-violet-600' : 'bg-indigo-600'
            }`}
          />
          <span>
            {inputType === 'codebase'
              ? `Source: ZIP Repo (${filesCount ?? 0} files)`
              : 'Source: Architecture Blueprint'}
          </span>
          <span className="text-slate-300 font-normal">|</span>
          <span className="text-slate-500 font-mono text-[10px]">v{version}</span>
        </div>
      </div>

      {/* Center: Global Search Bar trigger */}
      <div className="flex-1 max-w-md mx-6">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-500 transition-colors cursor-pointer group shadow-2xs"
          title="Press Ctrl+K to search"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span>Search components, files, dependencies...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded">
            <span>Ctrl</span>
            <span>K</span>
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Upload Dropdown */}
        <div className="relative" ref={uploadRef}>
          <button
            onClick={() => setIsUploadDropdownOpen(!isUploadDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-xs shadow-violet-200 transition-all cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Input</span>
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
          </button>

          {isUploadDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs">
              <button
                onClick={() => {
                  setIsUploadDropdownOpen(false);
                  onOpenCodebaseModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-violet-50 text-slate-700 hover:text-violet-700 text-left transition-colors cursor-pointer font-medium"
              >
                <UploadCloud className="w-4 h-4 text-violet-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Upload Repository ZIP</div>
                  <div className="text-[10px] text-slate-500">100% file retention + AST scan</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setIsUploadDropdownOpen(false);
                  onOpenBlueprintModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-violet-50 text-slate-700 hover:text-violet-700 text-left transition-colors cursor-pointer font-medium"
              >
                <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900">Upload Blueprint JSON</div>
                  <div className="text-[10px] text-slate-500">Exact architecture manifest</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Load Reference Demo Architecture */}
        <button
          onClick={onLoadDemo}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors cursor-pointer"
          title="Load Retail Microservices Reference Architecture"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          <span>Load Demo</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer relative"
            title="Activity & Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white"></span>
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900">System Activity</span>
                <span className="text-[10px] text-slate-600">Live Workspace</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-emerald-950">Workspace Loaded</div>
                    <div className="text-[11px] text-emerald-700">{systemName} ready for analysis</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-50/70 border border-violet-100">
                  <Database className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-violet-950">100% Files Preserved</div>
                    <div className="text-[11px] text-violet-700">Full inventory catalog retained</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Reset Workspace"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
