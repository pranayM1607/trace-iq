import React from 'react';
import {
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { ProcessingStep } from '../../types/architecture';

interface ProcessingPipelineProps {
  steps: ProcessingStep[];
  isProcessing: boolean;
  onDismiss?: () => void;
}

export const ProcessingPipeline: React.FC<ProcessingPipelineProps> = ({
  steps,
  isProcessing,
}) => {
  if (!isProcessing && steps.every((s) => s.status === 'completed' || s.status === 'pending')) {
    return null;
  }

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2.5 shadow-md">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing ? (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Reconstruction Pipeline
          </span>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          {steps.map((step) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isError = step.status === 'error';

            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-xs'
                    : isCompleted
                    ? 'text-emerald-400'
                    : isError
                    ? 'bg-rose-900/40 text-rose-300 border border-rose-600'
                    : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isActive && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                  {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  {isError && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                  {!isActive && !isCompleted && !isError && (
                    <Clock className="w-3 h-3 text-slate-600" />
                  )}
                  <span className="font-mono text-[10px] opacity-75">{step.stepNumber}</span>
                  <span className="truncate max-w-[130px]">{step.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
