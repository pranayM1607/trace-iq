import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { parseAndValidateBlueprint } from '../../engine/blueprintParser';
import type { BlueprintParseResult } from '../../engine/blueprintParser';
import { SAMPLE_BLUEPRINTS } from '../../data/sampleBlueprints';
import type { BlueprintJSON } from '../../types/architecture';

interface BlueprintEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBlueprint: (result: BlueprintParseResult, rawJson: string) => void;
}

export const BlueprintEditorModal: React.FC<BlueprintEditorModalProps> = ({
  isOpen,
  onClose,
  onApplyBlueprint,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [validationResult, setValidationResult] = useState<BlueprintParseResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize with sample on first open if empty
  useEffect(() => {
    if (isOpen && !jsonText) {
      setJsonText(JSON.stringify(SAMPLE_BLUEPRINTS[0].blueprint, null, 2));
    }
  }, [isOpen, jsonText]);

  // Live validation on JSON change
  useEffect(() => {
    if (!jsonText.trim()) {
      setValidationResult(null);
      return;
    }
    const res = parseAndValidateBlueprint(jsonText);
    setValidationResult(res);
  }, [jsonText]);

  if (!isOpen) return null;

  const handleLoadSample = (sampleBlueprint: BlueprintJSON) => {
    setJsonText(JSON.stringify(sampleBlueprint, null, 2));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setJsonText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(jsonText);
      setJsonText(JSON.stringify(obj, null, 2));
    } catch {
      // ignore if invalid syntax
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = () => {
    if (validationResult && validationResult.success) {
      onApplyBlueprint(validationResult, jsonText);
      onClose();
    }
  };

  const errors = validationResult?.issues.filter((i) => i.type === 'error') || [];
  const warnings = validationResult?.issues.filter((i) => i.type === 'warning') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Architecture Blueprint Ingestion (JSON)
              </h2>
              <p className="text-xs text-slate-500">
                Upload or edit a declarative system blueprint with entities and typed relationships
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

        {/* Toolbar */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Load Template:</span>
            {SAMPLE_BLUEPRINTS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleLoadSample(s.blueprint)}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 font-medium transition-colors cursor-pointer"
              >
                {s.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 font-medium cursor-pointer transition-colors">
              <span>Upload .json</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={handleFormatJson}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 font-medium cursor-pointer"
            >
              Format JSON
            </button>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-blue-400 font-medium flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Code Editor & Diagnostic Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-[380px] overflow-hidden">
          {/* JSON Textarea */}
          <div className="lg:col-span-2 p-4 border-r border-slate-200 flex flex-col bg-slate-900">
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
              <span>blueprint.json</span>
              <span>{jsonText.split('\n').length} lines</span>
            </div>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Paste JSON blueprint here..."
              spellCheck={false}
              className="flex-1 w-full bg-slate-950 text-slate-100 font-mono text-xs p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
            />
          </div>

          {/* Live Validation & Diagnostics */}
          <div className="p-4 bg-slate-50 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Blueprint Validator
              </span>
              {validationResult?.success ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> Valid Schema
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                  <AlertTriangle className="w-4 h-4" /> Issues Found
                </span>
              )}
            </div>

            {/* Entity Summary */}
            {validationResult && (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">System Name:</span>
                    <span className="font-semibold text-slate-900">{validationResult.systemName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Entities:</span>
                    <span className="font-semibold text-slate-900">{validationResult.entities.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Relationships:</span>
                    <span className="font-semibold text-slate-900">{validationResult.relationships.length}</span>
                  </div>
                </div>

                {/* Error diagnostics */}
                {errors.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-rose-700">Errors ({errors.length}):</span>
                    <div className="space-y-1">
                      {errors.map((err, i) => (
                        <div
                          key={i}
                          className="bg-rose-50 border border-rose-200 text-rose-800 p-2 rounded-lg text-[11px] leading-snug"
                        >
                          {err.field && <span className="font-mono font-bold block mb-0.5">{err.field}</span>}
                          {err.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning diagnostics */}
                {warnings.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-amber-700">Warnings ({warnings.length}):</span>
                    <div className="space-y-1">
                      {warnings.map((warn, i) => (
                        <div
                          key={i}
                          className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg text-[11px] leading-snug"
                        >
                          {warn.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={!validationResult?.success}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm ${
              validationResult?.success
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-blue-500/20'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Reconstruct Architecture</span>
          </button>
        </div>
      </div>
    </div>
  );
};
