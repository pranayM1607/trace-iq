import React from 'react';
import {
  UploadCloud,
  FileCode,
  FolderTree,
  Network,
  History,
  Sparkles,
  ArrowRight,
  Database,
  Server,
  Layers,
} from 'lucide-react';
import type { ArchitectureModel, ArchitectureSnapshot, ProcessingStep } from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';
import { ProcessingPipeline } from '../pipeline/ProcessingPipeline';

interface AnalyzePageProps {
  model: ArchitectureModel;
  snapshots: ArchitectureSnapshot[];
  isProcessing: boolean;
  pipelineSteps: ProcessingStep[];
  onNavigate: (route: NavRoute) => void;
  onOpenCodebaseModal: () => void;
  onOpenBlueprintModal: () => void;
  onOpenScenarioModal: () => void;
  onSaveSnapshot: (label: string) => void;
  onOpenRawPayload?: () => void;
}

export const AnalyzePage: React.FC<AnalyzePageProps> = ({
  model,
  snapshots,
  isProcessing,
  pipelineSteps,
  onNavigate,
  onOpenCodebaseModal,
  onOpenBlueprintModal,
  onOpenScenarioModal,
  onOpenRawPayload,
}) => {
  const serviceCount = model.entities.filter((e) => e.type.toLowerCase() === 'service').length;
  const dbCount = model.entities.filter((e) => e.type.toLowerCase() === 'database').length;
  const apiCount = model.entities.filter((e) => e.type.toLowerCase() === 'api').length;
  const filesCount = model.inventory?.total_files ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Top Banner / Ingestion Pipeline if running */}
      {isProcessing && (
        <div className="bg-white rounded-2xl p-4 border border-violet-200 shadow-xs">
          <ProcessingPipeline steps={pipelineSteps} isProcessing={isProcessing} />
        </div>
      )}

      {/* Main Grid: Upload Dropzones & Quick Scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Ingest & Analyze Software Architecture
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an ingestion method to reconstruct software components, calls, and 100% repository inventory.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ZIP Ingestion Card */}
            <div
              onClick={onOpenCodebaseModal}
              className="bg-white hover:bg-violet-50/40 p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-violet-400 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                  Upload Codebase (ZIP)
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Extracts microservices, APIs, database drivers, and retains 100% of all files in archive.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-violet-600">
                <span>Upload .zip</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Blueprint JSON Card */}
            <div
              onClick={onOpenBlueprintModal}
              className="bg-white hover:bg-indigo-50/40 p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-105 transition-transform">
                  <FileCode className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  Upload Blueprint (JSON)
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Load structured JSON architecture definitions with exact entity and relationship specifications.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                <span>Load .json</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Quick Presets / Reference Scenarios banner */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50/60 rounded-2xl p-4 border border-violet-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Want to test reference architectures?</div>
                <div className="text-[11px] text-slate-500">
                  Explore pre-built Retail, FinTech, and IoT event-driven blueprints.
                </div>
              </div>
            </div>
            <button
              onClick={onOpenScenarioModal}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-violet-100/50 text-violet-700 border border-violet-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Browse Presets
            </button>
          </div>
        </div>

        {/* Right Column: Active Workspace Snapshot (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Active Workspace</h2>
            <p className="text-xs text-slate-500 mt-0.5">Currently loaded system model and state.</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-slate-900">{model.systemName}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    v{model.version}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span className="capitalize">{model.inputType} Input</span>
                  <span>•</span>
                  <span>{model.scope === 'partial' ? 'Partial Scope' : 'Complete Scope'}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-lg font-bold text-slate-900">{model.entities.length}</div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Components</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-lg font-bold text-slate-900">{model.relationships.length}</div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Calls / Edges</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-lg font-bold text-violet-700">
                  {filesCount > 0 ? filesCount : model.entities.length}
                </div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Files Kept</div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => onNavigate('architecture')}
                className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs shadow-violet-200 transition-all cursor-pointer"
              >
                <Network className="w-4 h-4" />
                <span>Open Architecture Graph</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onNavigate('inventory')}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FolderTree className="w-3.5 h-3.5 text-slate-600" />
                  <span>Inventory ({filesCount})</span>
                </button>

                <button
                  onClick={() => onNavigate('snapshots')}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  <span>Snapshots ({snapshots.length})</span>
                </button>
              </div>

              {model.rawJsonString && onOpenRawPayload && (
                <button
                  onClick={onOpenRawPayload}
                  className="w-full py-1.5 px-3 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 border border-indigo-100 font-medium transition-colors cursor-pointer"
                >
                  View Original JSON Blueprint
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Breakdown Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Reconstructed Topology Summary
          </h3>
          <button
            onClick={() => onNavigate('architecture')}
            className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Explore on Canvas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{serviceCount}</div>
              <div className="text-[11px] text-slate-500 font-medium">Microservices</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{dbCount}</div>
              <div className="text-[11px] text-slate-500 font-medium">Databases / Stores</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{apiCount}</div>
              <div className="text-[11px] text-slate-500 font-medium">APIs & Endpoints</div>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{filesCount}</div>
              <div className="text-[11px] text-slate-500 font-medium">Preserved Files (100%)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
