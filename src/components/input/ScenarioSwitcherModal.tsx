import React from 'react';
import { X, Layers, ArrowRight, CheckCircle2, Shield, Radio, ShoppingCart } from 'lucide-react';
import { SAMPLE_BLUEPRINTS } from '../../data/sampleBlueprints';
import type { SampleBlueprintItem } from '../../data/sampleBlueprints';
import { DEMO_ARCHITECTURE } from '../../data/demoArchitecture';

interface ScenarioSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleBlueprint: (sample: SampleBlueprintItem) => void;
  onSelectDemo: () => void;
}

export const ScenarioSwitcherModal: React.FC<ScenarioSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSelectSampleBlueprint,
  onSelectDemo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Preset Architecture Scenarios
              </h2>
              <p className="text-xs text-slate-500">
                Switch between curated multi-tier systems to evaluate automated graph reconstruction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Scenarios */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {/* Main Demo Architecture */}
          <div
            onClick={() => {
              onSelectDemo();
              onClose();
            }}
            className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/40 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white mt-0.5 shadow-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                      {DEMO_ARCHITECTURE.systemName}
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      Primary Review Demo
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    10 Microservices, 2 Datastores (PostgreSQL, Redis), 2 External APIs (Stripe, SendGrid), and 17 typed relationships with source traceability.
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2.5">
                    <span>12 Entities</span>
                    <span>•</span>
                    <span>17 Relationships</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Full Source Evidence
                    </span>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 mt-2" />
            </div>
          </div>

          {/* Sample Blueprints */}
          {SAMPLE_BLUEPRINTS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => {
                onSelectSampleBlueprint(sample);
                onClose();
              }}
              className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-slate-50 transition-all cursor-pointer group bg-white shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 mt-0.5 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                    {sample.category.includes('Financial') ? (
                      <Shield className="w-5 h-5" />
                    ) : sample.category.includes('IoT') ? (
                      <Radio className="w-5 h-5" />
                    ) : (
                      <Layers className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                        {sample.name}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded">
                        {sample.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {sample.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                      <span>{sample.blueprint.entities?.length || 0} Entities</span>
                      <span>•</span>
                      <span>{sample.blueprint.relationships?.length || 0} Relationships</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
