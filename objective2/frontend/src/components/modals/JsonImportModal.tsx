import React, { useState, useRef } from 'react';
import { X, Upload, FileCode, AlertCircle, Archive, Loader2, CheckCircle2, FileUp } from 'lucide-react';
import type { ArchitectureModel, Objective2AnalysisResult } from '../../types/analysis';
import { ApiService } from '../../services/api';

interface JsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (model: ArchitectureModel) => void;
  onImportZipResult?: (result: { architecture: ArchitectureModel; analysis: Objective2AnalysisResult }) => void;
}

export const JsonImportModal: React.FC<JsonImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onImportZipResult,
}) => {
  const [activeTab, setActiveTab] = useState<'zip' | 'json'>('zip');

  // ZIP State
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingZip, setIsUploadingZip] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // JSON State
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleZipFileSelected = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Invalid file format. Please choose a .zip software repository archive.');
      setSelectedZipFile(null);
      return;
    }
    setError(null);
    setSelectedZipFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleZipFileSelected(file);
  };

  const handleUploadZip = async () => {
    if (!selectedZipFile) {
      setError('Please select a .zip codebase archive.');
      return;
    }

    setIsUploadingZip(true);
    setError(null);

    try {
      const result = await ApiService.uploadCodebaseZip(selectedZipFile);
      if (onImportZipResult) {
        onImportZipResult(result);
      } else {
        onImport(result.architecture);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to extract and analyze codebase archive.');
    } finally {
      setIsUploadingZip(false);
    }
  };

  // JSON handlers
  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonText(content);
        setError(null);
      } catch (err: any) {
        setError(`Failed to read file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyJson = () => {
    try {
      if (!jsonText.trim()) {
        setError('Please paste or upload a valid JSON architecture model.');
        return;
      }
      const parsed = JSON.parse(jsonText);
      if (!parsed.entities || !Array.isArray(parsed.entities)) {
        setError("Invalid schema: Expected 'entities' array in architecture JSON.");
        return;
      }
      if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
        setError("Invalid schema: Expected 'relationships' array in architecture JSON.");
        return;
      }

      const model: ArchitectureModel = {
        systemName: parsed.systemName || 'Imported Architecture',
        version: parsed.version || '1.0.0',
        extractedAt: parsed.extractedAt || new Date().toISOString(),
        inputType: parsed.inputType || 'blueprint',
        entities: parsed.entities,
        relationships: parsed.relationships,
        stats: parsed.stats,
        inventory: parsed.inventory,
        isLimitedArchitecture: parsed.isLimitedArchitecture,
        limitedArchitectureReason: parsed.limitedArchitectureReason,
      };

      onImport(model);
      onClose();
    } catch (err: any) {
      setError(`JSON Parse Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 font-sans animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Import Architecture
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isUploadingZip}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-5 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('zip');
              setError(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'zip'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Codebase Archive (.zip)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('json');
              setError(null);
            }}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'json'
                ? 'border-violet-600 text-violet-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Blueprint JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {activeTab === 'zip' ? (
            <div className="space-y-3.5">
              <p className="text-slate-600 text-xs leading-relaxed">
                Upload a software repository ZIP archive. TraceIQ will scan manifests (<code className="text-violet-700 font-medium">docker-compose</code>, <code className="text-violet-700 font-medium">package.json</code>, <code className="text-violet-700 font-medium">requirements.txt</code>, <code className="text-violet-700 font-medium">go.mod</code>) and source code calls to reconstruct the service graph and compute architectural risk metrics.
              </p>

              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => zipInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-violet-500 bg-violet-50/60 scale-[0.99]'
                    : selectedZipFile
                    ? 'border-violet-300 bg-violet-50/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  onChange={(e) => handleZipFileSelected(e.target.files?.[0])}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 shadow-2xs">
                    {selectedZipFile ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>

                  {selectedZipFile ? (
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-800 text-xs">
                        {selectedZipFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {formatFileSize(selectedZipFile.size)}
                      </p>
                      <p className="text-[11px] text-violet-600 hover:underline pt-1">
                        Click or drag to choose a different archive
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700 text-xs">
                        Drag and drop codebase .zip here
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        or click to browse local files
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <p className="text-slate-600 text-xs">
                Import an architecture model JSON containing <code className="text-violet-700 font-semibold">entities</code> and <code className="text-violet-700 font-semibold">relationships</code>.
              </p>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-pointer transition-colors text-xs shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-violet-600" />
                  <span>Choose .json file</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleJsonFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-slate-500 font-mono text-[11px]">or paste JSON content below</span>
              </div>

              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setError(null);
                }}
                placeholder={`{\n  "systemName": "E-Commerce System",\n  "entities": [\n    { "id": "service-a", "name": "Service A", "type": "Service", "technology": "Go" }\n  ],\n  "relationships": [\n    { "id": "rel-1", "source": "service-a", "target": "service-b", "type": "CALLS" }\n  ]\n}`}
                rows={9}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500/30"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isUploadingZip}
            className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          {activeTab === 'zip' ? (
            <button
              onClick={handleUploadZip}
              disabled={!selectedZipFile || isUploadingZip}
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold transition-all cursor-pointer disabled:cursor-not-allowed text-xs shadow-xs flex items-center gap-1.5"
            >
              {isUploadingZip ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing codebase...</span>
                </>
              ) : (
                <span>Analyze Codebase</span>
              )}
            </button>
          ) : (
            <button
              onClick={handleApplyJson}
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors cursor-pointer text-xs shadow-xs"
            >
              Load & Analyze
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
