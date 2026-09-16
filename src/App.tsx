import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar, type NavRoute } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { TraceIQAssistant } from './components/assistant/TraceIQAssistant';

// Dedicated Page Views
import { AnalyzePage } from './components/pages/AnalyzePage';
import { ComparePage } from './components/pages/ComparePage';
import { ArchitecturePage } from './components/pages/ArchitecturePage';
import { DependenciesPage } from './components/pages/DependenciesPage';
import { RepositoryInventoryPage } from './components/pages/RepositoryInventoryPage';
import { RiskAnalysisPage } from './components/pages/RiskAnalysisPage';
import { ImpactAnalysisPage } from './components/pages/ImpactAnalysisPage';
import { EvidencePage } from './components/pages/EvidencePage';
import { SnapshotsPage } from './components/pages/SnapshotsPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { ChangeSimulatorPage } from './components/pages/ChangeSimulatorPage';

// Modals
import { BlueprintEditorModal } from './components/input/BlueprintEditorModal';
import { CodebaseUploadModal } from './components/input/CodebaseUploadModal';
import { ScenarioSwitcherModal } from './components/input/ScenarioSwitcherModal';
import { CodebaseInventoryModal } from './components/inventory/CodebaseInventoryModal';

import { DEMO_ARCHITECTURE } from './data/demoArchitecture';
import { SNAPSHOT_V1, SNAPSHOT_V2 } from './data/sampleEvolutions';
import type { SampleBlueprintItem } from './data/sampleBlueprints';
import type { BlueprintParseResult } from './engine/blueprintParser';
import type { CodebaseAnalysisResult } from './engine/codebaseAnalyzer';
import { reconstructArchitecture } from './engine/architectureReconstructor';
import { createArchitectureSnapshot } from './engine/architectureDiffEngine';
import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
  ArchitectureSnapshot,
  ProcessingStep,
} from './types/architecture';
import { FileCode, X } from 'lucide-react';

const INITIAL_PIPELINE_STEPS: ProcessingStep[] = [
  { id: 'reading', stepNumber: '01', title: 'Reading Artifacts', description: 'Ingesting raw source files and blueprints', status: 'completed' },
  { id: 'extraction', stepNumber: '02', title: 'Extracting Entities', description: 'Discovering services, databases, and APIs', status: 'completed' },
  { id: 'dependencies', stepNumber: '03', title: 'Detecting Dependencies', description: 'Resolving calls, drivers, and imports', status: 'completed' },
  { id: 'reconstruction', stepNumber: '04', title: 'Reconstructing Model', description: 'Normalizing architecture topology', status: 'completed' },
  { id: 'graph_generation', stepNumber: '05', title: 'Graph Layout', description: 'Generating automated hierarchical graph', status: 'completed' },
];

export const App: React.FC = () => {
  // Navigation Route State (Defaults to 'analyze' - CodeAnt-style clear landing)
  const [currentRoute, setCurrentRoute] = useState<NavRoute>('analyze');

  // Architecture Model State (Current Workspace)
  const [model, setModel] = useState<ArchitectureModel>(DEMO_ARCHITECTURE);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<ProcessingStep[]>(INITIAL_PIPELINE_STEPS);

  // Versioning & Snapshots State
  const [snapshots, setSnapshots] = useState<ArchitectureSnapshot[]>([
    SNAPSHOT_V1,
    SNAPSHOT_V2,
  ]);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string>(SNAPSHOT_V1.id);

  // Assistant & Search State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Modals
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isCodebaseModalOpen, setIsCodebaseModalOpen] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isRawPayloadModalOpen, setIsRawPayloadModalOpen] = useState(false);

  // Global keyboard shortcut for Ctrl+K search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Run pipeline animation sequence
  const executePipelineSequence = useCallback(
    async (finalModel: ArchitectureModel) => {
      setIsProcessing(true);
      setSelectedEntityId(null);
      setSelectedEdgeId(null);

      const stepIds: Array<ProcessingStep['id']> = [
        'reading',
        'extraction',
        'dependencies',
        'reconstruction',
        'graph_generation',
      ];

      for (let i = 0; i < stepIds.length; i++) {
        setPipelineSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx < i ? 'completed' : idx === i ? 'active' : 'pending',
          }))
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      setPipelineSteps((prev) => prev.map((step) => ({ ...step, status: 'completed' })));
      setModel(finalModel);
      setIsProcessing(false);
    },
    []
  );

  // Action: Load Default Demo Architecture
  const handleLoadDemo = useCallback(() => {
    executePipelineSequence(DEMO_ARCHITECTURE);
    setSnapshots([SNAPSHOT_V1, SNAPSHOT_V2]);
    setActiveSnapshotId(SNAPSHOT_V1.id);
  }, [executePipelineSequence]);

  // Action: Apply Blueprint JSON
  const handleApplyBlueprint = useCallback(
    (result: BlueprintParseResult) => {
      const inputId = `input_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const reconstructed = reconstructArchitecture({
        systemName: result.systemName,
        version: result.version || '1.0.0',
        inputType: 'blueprint',
        entities: result.entities,
        relationships: result.relationships,
        sourceArtifacts: ['blueprint.json'],
        inputIdentity: {
          id: inputId,
          filename: 'blueprint.json',
          inputType: 'blueprint',
          uploadedAt: new Date().toISOString(),
          filesCount: 1,
          foldersCount: 1,
          scope: 'complete',
        },
        originalJsonPayload: result.originalJsonPayload,
        rawJsonString: result.rawJsonString,
        scope: 'complete',
      });
      executePipelineSequence(reconstructed);
      setCurrentRoute('architecture');
    },
    [executePipelineSequence]
  );

  // Action: Apply Codebase ZIP Analysis
  const handleApplyCodebase = useCallback(
    (result: CodebaseAnalysisResult, fileName: string) => {
      const inputId = `input_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const totalFiles = result.inventory?.total_files || result.filesScanned;
      const totalFolders = result.inventory?.total_folders || 0;
      const resolvedScope = result.scope || (result.isLimitedArchitecture ? 'partial' : 'complete');

      const reconstructed = reconstructArchitecture({
        systemName: result.systemName,
        version: '1.0.0',
        inputType: 'codebase',
        entities: result.entities,
        relationships: result.relationships,
        sourceArtifacts: result.manifestsFound.length > 0 ? result.manifestsFound : [fileName],
        inventory: result.inventory,
        codebaseGraph: result.codebaseGraph,
        isLimitedArchitecture: result.isLimitedArchitecture,
        limitedArchitectureReason: result.limitedArchitectureReason,
        inputIdentity: {
          id: inputId,
          filename: fileName,
          inputType: 'codebase',
          uploadedAt: new Date().toISOString(),
          filesCount: totalFiles,
          foldersCount: totalFolders,
          scope: resolvedScope,
        },
        scope: resolvedScope,
      });
      executePipelineSequence(reconstructed);
      setCurrentRoute('architecture');
    },
    [executePipelineSequence]
  );

  // Action: Apply Sample Scenario
  const handleSelectSampleBlueprint = useCallback(
    (sample: SampleBlueprintItem) => {
      const entities = (sample.blueprint.entities || []).map((e) => ({
        ...e,
        technology: e.technology || 'Generic / Undefined',
        source: 'User-provided' as const,
        description: e.description || `${e.type} component`,
        metadata: { filePath: 'preset-blueprint.json' },
      }));

      const relationships = (sample.blueprint.relationships || []).map((r, i) => ({
        id: `rel-${r.source}-${r.target}-${i}`,
        source: r.source,
        target: r.target,
        type: r.type || 'CALLS',
        protocol: r.protocol || 'Default Protocol',
        sourceEvidence: {
          file: 'preset-blueprint.json',
          description: `${r.source} ${r.type || 'CALLS'} ${r.target}`,
          confidence: 'HIGH' as const,
        },
        description: `${r.source} ${r.type || 'CALLS'} ${r.target}`,
      }));

      const reconstructed = reconstructArchitecture({
        systemName: sample.blueprint.systemName || sample.name,
        version: sample.blueprint.version || '1.0.0',
        inputType: 'blueprint',
        entities,
        relationships,
        sourceArtifacts: ['preset-blueprint.json'],
      });

      executePipelineSequence(reconstructed);
      setCurrentRoute('architecture');
    },
    [executePipelineSequence]
  );

  // Action: Select Active Snapshot
  const handleSelectActiveSnapshot = useCallback(
    (id: string) => {
      setActiveSnapshotId(id);
      if (!id) {
        return;
      }
      const found = snapshots.find((s) => s.id === id);
      if (found) {
        setModel(found.architecture);
        setSelectedEntityId(null);
        setSelectedEdgeId(null);
      }
    },
    [snapshots]
  );

  // Action: Save Current Snapshot (Frozen, deep-copied)
  const handleSaveSnapshot = useCallback(
    (label: string) => {
      const snap = createArchitectureSnapshot(model, label);
      setSnapshots((prev) => [...prev, snap]);
      setActiveSnapshotId(snap.id);
    },
    [model]
  );

  // Action: Rename Snapshot
  const handleRenameSnapshot = useCallback((id: string, newLabel: string) => {
    setSnapshots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label: newLabel } : s))
    );
  }, []);

  // Action: Delete Snapshot
  const handleDeleteSnapshot = useCallback((id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
    setActiveSnapshotId((prevId) => (prevId === id ? '' : prevId));
  }, []);

  // Reset to default
  const handleReset = useCallback(() => {
    handleLoadDemo();
    setCurrentRoute('analyze');
  }, [handleLoadDemo]);

  // Active elements in current workspace
  const currentEntities = model.entities;
  const currentRelationships = model.relationships;

  const selectedEntity = currentEntities.find((e: ArchitectureEntity) => e.id === selectedEntityId) || null;
  const selectedRelationship =
    currentRelationships.find((r: ArchitectureRelationship) => r.id === selectedEdgeId) || null;

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Persistent Left Navigation Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        inventoryCount={model.inventory?.total_files}
        entitiesCount={model.entities.length}
        highRiskCount={model.relationships.length > 5 ? 2 : 0}
        systemName={model.systemName}
        isProcessing={isProcessing}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <TopHeader
          currentRoute={currentRoute}
          systemName={model.systemName}
          version={model.version || '1.0.0'}
          inputType={model.inputType === 'codebase' ? 'codebase' : 'blueprint'}
          filesCount={model.inventory?.total_files}
          onOpenSearch={() => setIsSearchOpen(true)}
          onLoadDemo={handleLoadDemo}
          onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
          onOpenCodebaseModal={() => setIsCodebaseModalOpen(true)}
          onReset={handleReset}
        />

        {/* View Routing */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {currentRoute === 'analyze' && (
            <AnalyzePage
              model={model}
              snapshots={snapshots}
              isProcessing={isProcessing}
              pipelineSteps={pipelineSteps}
              onNavigate={setCurrentRoute}
              onOpenCodebaseModal={() => setIsCodebaseModalOpen(true)}
              onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
              onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
              onSaveSnapshot={handleSaveSnapshot}
              onOpenRawPayload={model.rawJsonString ? () => setIsRawPayloadModalOpen(true) : undefined}
            />
          )}

          {currentRoute === 'compare' && (
            <ComparePage
              savedSnapshots={snapshots}
              onSelectEntity={(id) => {
                setSelectedEntityId(id);
                setCurrentRoute('architecture');
              }}
            />
          )}

          {currentRoute === 'snapshots' && (
            <SnapshotsPage
              model={model}
              snapshots={snapshots}
              activeSnapshotId={activeSnapshotId}
              onSelectActiveSnapshot={handleSelectActiveSnapshot}
              onSaveSnapshot={handleSaveSnapshot}
              onRenameSnapshot={handleRenameSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onNavigate={setCurrentRoute}
            />
          )}

          {currentRoute === 'architecture' && (
            <ArchitecturePage
              model={model}
              snapshots={snapshots}
              activeSnapshotId={activeSnapshotId}
              onSelectActiveSnapshot={handleSelectActiveSnapshot}
              onSaveSnapshot={handleSaveSnapshot}
              currentEntities={currentEntities}
              currentRelationships={currentRelationships}
              selectedEntityId={selectedEntityId}
              selectedEdgeId={selectedEdgeId}
              onSelectEntity={setSelectedEntityId}
              onSelectEdge={setSelectedEdgeId}
            />
          )}

          {currentRoute === 'dependencies' && (
            <DependenciesPage
              model={model}
              onNavigate={setCurrentRoute}
              onSelectEntity={setSelectedEntityId}
              onSelectEdge={setSelectedEdgeId}
            />
          )}

          {currentRoute === 'inventory' && (
            <RepositoryInventoryPage model={model} />
          )}

          {currentRoute === 'risk' && (
            <RiskAnalysisPage
              model={model}
              onNavigate={setCurrentRoute}
              onSelectEntity={setSelectedEntityId}
            />
          )}

          {currentRoute === 'impact' && (
            <ImpactAnalysisPage
              model={model}
              onNavigate={setCurrentRoute}
              onSelectEntity={setSelectedEntityId}
            />
          )}

          {currentRoute === 'evidence' && (
            <EvidencePage
              model={model}
              onNavigate={setCurrentRoute}
              onSelectEntity={setSelectedEntityId}
            />
          )}

          {currentRoute === 'simulator' && (
            <ChangeSimulatorPage
              model={model}
              snapshots={snapshots}
              onNavigate={setCurrentRoute}
              onSaveSnapshot={handleSaveSnapshot}
            />
          )}

          {currentRoute === 'reports' && (
            <ReportsPage model={model} />
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        model={model}
        snapshots={snapshots}
        onNavigate={setCurrentRoute}
        onSelectEntity={setSelectedEntityId}
        onSelectEdge={setSelectedEdgeId}
      />

      {/* Upload & Preset Modals */}
      <BlueprintEditorModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        onApplyBlueprint={handleApplyBlueprint}
      />

      <CodebaseUploadModal
        isOpen={isCodebaseModalOpen}
        onClose={() => setIsCodebaseModalOpen(false)}
        onApplyCodebase={handleApplyCodebase}
      />

      <ScenarioSwitcherModal
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
        onSelectSampleBlueprint={handleSelectSampleBlueprint}
        onSelectDemo={handleLoadDemo}
      />

      <CodebaseInventoryModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        inventory={model.inventory}
        systemName={model.systemName}
      />

      {/* Raw JSON Blueprint Payload Modal */}
      {isRawPayloadModalOpen && model.rawJsonString && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-violet-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  100% Preserved Original JSON Blueprint Payload ({model.systemName})
                </h3>
              </div>
              <button
                onClick={() => setIsRawPayloadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed">
              <pre>{model.rawJsonString}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Assistant Drawer & Launcher */}
      <TraceIQAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onOpen={() => setIsAssistantOpen(true)}
        currentRoute={currentRoute}
        model={model}
        selectedEntity={selectedEntity}
        selectedRelationship={selectedRelationship}
        snapshots={snapshots}
        onNavigate={setCurrentRoute}
      />
    </div>
  );
};

export default App;
