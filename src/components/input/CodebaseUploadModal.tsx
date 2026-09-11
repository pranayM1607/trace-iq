import React, { useState } from 'react';
import {
  X,
  Upload,
  FileArchive,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import { analyzeCodebaseZip } from '../../engine/codebaseAnalyzer';
import type { CodebaseAnalysisResult } from '../../engine/codebaseAnalyzer';
import { generateSampleCodebaseZip } from '../../data/sampleZipGenerator';

interface CodebaseUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCodebase: (result: CodebaseAnalysisResult, fileName: string) => void;
}

export const CodebaseUploadModal: React.FC<CodebaseUploadModalProps> = ({
  isOpen,
  onClose,
  onApplyCodebase,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CodebaseAnalysisResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  if (!isOpen) return null;

  const processFile = async (file: File | Blob, name: string) => {
    setIsAnalyzing(true);
    setSelectedFileName(name);
    try {
      const result = await analyzeCodebaseZip(file);
      setAnalysisResult(result);
    } catch (err: any) {
      setAnalysisResult({
        success: false,
        systemName: 'Error Reading Codebase',
        filesScanned: 0,
        entities: [],
        relationships: [],
        manifestsFound: [],
        issues: [
          {
            type: 'error',
            message: `Analysis error: ${err.message || 'Failed to process archive'}`,
          },
        ],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file, file.name);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file, file.name);
    }
  };

  const handleTestSampleZip = async () => {
    setIsAnalyzing(true);
    try {
      const blob = await generateSampleCodebaseZip();
      await processFile(blob, 'sample-microservices-codebase.zip');
    } catch (err: any) {
      console.error(err);
      setIsAnalyzing(false);
    }
  };

  const handleDownloadSampleZip = async () => {
    try {
      const blob = await generateSampleCodebaseZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'traceiq-sample-microservices.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download sample zip', err);
    }
  };

  const handleApply = () => {
    if (analysisResult && analysisResult.success) {
      onApplyCodebase(analysisResult, selectedFileName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Codebase Ingestion & Dependency Extraction
              </h2>
              <p className="text-xs text-slate-500">
                Inspect source packages, manifests, APIs, and import graphs from a ZIP archive
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

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Quick Test Bar */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-blue-900">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Want to test codebase extraction immediately without preparing a ZIP?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleTestSampleZip}
                disabled={isAnalyzing}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Test Sample ZIP</span>
              </button>
              <button
                onClick={handleDownloadSampleZip}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Download sample zip to inspect files"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .zip</span>
              </button>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
            }`}
          >
            {isAnalyzing ? (
              <div className="py-4 space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-800">
                  Scanning archive and extracting dependencies...
                </p>
                <p className="text-xs text-slate-500">
                  Inspecting manifests (package.json, pom.xml, requirements.txt, go.mod) & source imports
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Drag and drop your codebase ZIP archive here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports JavaScript/TypeScript, Python, Java, Go, Docker Compose projects
                  </p>
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 font-medium text-xs shadow-2xs cursor-pointer transition-all">
                    <FileCode className="w-4 h-4" />
                    <span>Browse ZIP file</span>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Results Preview */}
          {analysisResult && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  {analysisResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span className="text-xs font-bold text-slate-800">
                    {analysisResult.success
                      ? `Analysis Complete: ${selectedFileName}`
                      : 'Extraction Failed'}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {analysisResult.filesScanned} files inspected
                </span>
              </div>

              {analysisResult.success && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">MANIFESTS</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {analysisResult.manifestsFound.length}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">ENTITIES</span>
                    <span className="font-bold text-blue-600 text-sm">
                      {analysisResult.entities.length}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">RELATIONSHIPS</span>
                    <span className="font-bold text-indigo-600 text-sm">
                      {analysisResult.relationships.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Manifests list */}
              {analysisResult.manifestsFound.length > 0 && (
                <div className="text-xs">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Detected Manifests & Blueprints:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.manifestsFound.map((m, i) => (
                      <span
                        key={i}
                        className="font-mono text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues/warnings */}
              {analysisResult.issues.length > 0 && (
                <div className="space-y-1 text-xs">
                  {analysisResult.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg text-[11px] ${
                        issue.type === 'error'
                          ? 'bg-rose-50 border border-rose-200 text-rose-800'
                          : 'bg-amber-50 border border-amber-200 text-amber-800'
                      }`}
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleApply}
            disabled={!analysisResult?.success}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm ${
              analysisResult?.success
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
