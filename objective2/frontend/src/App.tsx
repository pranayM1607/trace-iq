import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ArchitectureModel, Objective2AnalysisResult } from './types/analysis';
import { ApiService } from './services/api';
import { FALLBACK_DEMO_ARCHITECTURE } from './data/demoScenario';
import { Header } from './components/header/Header';
import { ArchitectureGraph } from './components/graph/ArchitectureGraph';
import { CodebaseGraph } from './components/graph/CodebaseGraph';
import { RiskTriageView } from './components/triage/RiskTriageView';
import { ComponentInspectionDrawer } from './components/details/ComponentInspectionDrawer';
import { JsonImportModal } from './components/modals/JsonImportModal';
import { CodebaseInventoryView } from './components/inventory/CodebaseInventoryView';

export function App() {
  const [architecture, setArchitecture] = useState<ArchitectureModel>(FALLBACK_DEMO_ARCHITECTURE);
  const [analysis, setAnalysis] = useState<Objective2AnalysisResult | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'graph' | 'triage' | 'codebase'>('graph');
  const [graphMode, setGraphMode] = useState<'architecture' | 'codebase'>('architecture');
  const [codebaseFocusServiceId, setCodebaseFocusServiceId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightedPaths, setHighlightedPaths] = useState<string[][] | null>(null);

  // Derive highlighted path node and edge ID sets for visual highlighting
  const { highlightedPathNodes, highlightedPathEdges } = useMemo(() => {
    if (!highlightedPaths || highlightedPaths.length === 0) {
      return { highlightedPathNodes: null, highlightedPathEdges: null };
    }
    const nodes = new Set<string>();
    const edges = new Set<string>();

    highlightedPaths.forEach((path) => {
      path.forEach((nodeId) => nodes.add(nodeId));
      for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        architecture.relationships.forEach((rel) => {
          if (
            (rel.source === u && rel.target === v) ||
            (rel.source === v && rel.target === u)
          ) {
            edges.add(rel.id);
          }
        });
      }
    });

    return { highlightedPathNodes: nodes, highlightedPathEdges: edges };
  }, [highlightedPaths, architecture.relationships]);

  const handleClearHighlightedPaths = useCallback(() => {
    setHighlightedPaths(null);
  }, []);

  // Trigger analysis on an architecture model with refined transition
  const executeAnalysis = useCallback(async (modelToAnalyze: ArchitectureModel) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const result = await ApiService.runAnalysis(modelToAnalyze);
      // Brief smooth transition to let animation feel intentional
      await new Promise((r) => setTimeout(r, 400));
      setAnalysis(result);
    } catch (err: any) {
      console.error('Analysis execution failed:', err);
      setErrorMessage(`Analysis failed: ${err.message || 'Check backend connection on port 8001.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Initialize: check health, load architecture and run analysis on mount
  useEffect(() => {
    let isMounted = true;
    async function init() {
      const healthy = await ApiService.checkHealth();
      if (!isMounted) return;
      setIsBackendHealthy(healthy);

      if (healthy) {
        try {
          const demoModel = await ApiService.getDemoArchitecture();
          if (!isMounted) return;
          setArchitecture(demoModel);
          await executeAnalysis(demoModel);
        } catch {
          await executeAnalysis(FALLBACK_DEMO_ARCHITECTURE);
        }
      } else {
        setErrorMessage('Backend engine on port 8001 is offline. Start the backend with: python run_backend.py');
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [executeAnalysis]);

  // Load Sample Architecture
  const handleLoadDemo = useCallback(async () => {
    try {
      const demoModel = await ApiService.getDemoArchitecture();
      setArchitecture(demoModel);
      setSelectedEntityId(null);
      setCodebaseFocusServiceId(null);
      await executeAnalysis(demoModel);
    } catch {
      setArchitecture(FALLBACK_DEMO_ARCHITECTURE);
      setSelectedEntityId(null);
      setCodebaseFocusServiceId(null);
      await executeAnalysis(FALLBACK_DEMO_ARCHITECTURE);
    }
  }, [executeAnalysis]);

  // Run Analysis on current architecture
  const handleRunAnalysis = useCallback(async () => {
    await executeAnalysis(architecture);
  }, [architecture, executeAnalysis]);

  // Handle Import JSON
  const handleImportArchitecture = useCallback(async (importedModel: ArchitectureModel) => {
    setArchitecture(importedModel);
    setSelectedEntityId(null);
    setCodebaseFocusServiceId(null);
    await executeAnalysis(importedModel);
  }, [executeAnalysis]);

  // Handle ZIP Codebase Upload Result
  const handleImportZipResult = useCallback(
    (result: { architecture: ArchitectureModel; analysis: Objective2AnalysisResult }) => {
      setArchitecture(result.architecture);
      setAnalysis(result.analysis);
      setSelectedEntityId(null);
      setCodebaseFocusServiceId(null);
      setErrorMessage(null);
    },
    []
  );

  const selectedEntity = architecture.entities.find((e) => e.id === selectedEntityId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans">
      {/* Header */}
      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        onLoadDemo={handleLoadDemo}
        onRunAnalysis={handleRunAnalysis}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        isAnalyzing={isAnalyzing}
        isBackendHealthy={isBackendHealthy}
        hasAnalysis={analysis !== null}
        totalFiles={architecture.inventory?.total_files}
      />

      {/* Subtle floating error banner if any */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs text-rose-800 flex items-center justify-between z-40 backdrop-blur-md">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Body with Smooth View Transition */}
      <main className="flex-1 relative flex overflow-hidden">
        {activeView === 'graph' ? (
          <div className="flex-1 flex h-full w-full relative overflow-hidden transition-all duration-300 animate-fadeIn">
            {graphMode === 'architecture' ? (
              <>
                <ArchitectureGraph
                  entities={architecture.entities}
                  relationships={architecture.relationships}
                  selectedEntityId={selectedEntityId}
                  onSelectEntity={(id) => {
                    setSelectedEntityId(id);
                    if (!id) setHighlightedPaths(null);
                  }}
                  analysis={analysis}
                  extractedAt={architecture.extractedAt}
                  highlightedPathNodes={highlightedPathNodes}
                  highlightedPathEdges={highlightedPathEdges}
                  onClearHighlightedPaths={handleClearHighlightedPaths}
                  isLimitedArchitecture={architecture.isLimitedArchitecture}
                  limitedArchitectureReason={architecture.limitedArchitectureReason}
                  onSwitchToCodebase={() => setGraphMode('codebase')}
                  graphMode={graphMode}
                  onChangeGraphMode={setGraphMode}
                  totalCodebaseDependencies={architecture.codebaseGraph?.edges.length ?? architecture.inventory?.file_dependencies?.length ?? 0}
                />

                {/* Component Inspection Drawer */}
                {selectedEntity && (
                  <ComponentInspectionDrawer
                    entity={selectedEntity}
                    relationships={architecture.relationships}
                    analysis={analysis}
                    onClose={() => {
                      setSelectedEntityId(null);
                      setHighlightedPaths(null);
                    }}
                    onSelectComponent={setSelectedEntityId}
                    onHighlightPaths={setHighlightedPaths}
                    onClearHighlightPaths={handleClearHighlightedPaths}
                    isPathHighlighted={!!highlightedPaths && highlightedPaths.length > 0}
                    onViewInCodebaseGraph={(serviceId) => {
                      setCodebaseFocusServiceId(serviceId);
                      setGraphMode('codebase');
                      setSelectedEntityId(null);
                    }}
                  />
                )}
              </>
            ) : (
              <CodebaseGraph
                architecture={architecture}
                focusServiceId={codebaseFocusServiceId}
                onClearFocusService={() => setCodebaseFocusServiceId(null)}
                onSwitchToArchitecture={() => setGraphMode('architecture')}
                onSelectComponentInArchitecture={(cid) => {
                  setSelectedEntityId(cid);
                  setGraphMode('architecture');
                }}
                onChangeGraphMode={setGraphMode}
              />
            )}
          </div>
        ) : activeView === 'triage' ? (
          <div className="flex-1 flex h-full w-full relative overflow-hidden transition-all duration-300 animate-fadeIn">
            <RiskTriageView
              analysis={analysis}
              onSelectComponent={(cid) => {
                setSelectedEntityId(cid);
                setActiveView('graph');
              }}
              onSwitchToGraphView={() => setActiveView('graph')}
            />
          </div>
        ) : (
          <div className="flex-1 flex h-full w-full relative overflow-hidden transition-all duration-300 animate-fadeIn">
            <CodebaseInventoryView
              architecture={architecture}
              onSelectComponent={(cid) => {
                setSelectedEntityId(cid);
                setActiveView('graph');
              }}
              onSwitchToGraphView={() => setActiveView('graph')}
            />
          </div>
        )}
      </main>

      {/* Import Modal */}
      <JsonImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportArchitecture}
        onImportZipResult={handleImportZipResult}
      />
    </div>
  );
}

export default App;
