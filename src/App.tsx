import React, { useState, useCallback } from 'react';
import { Header } from './components/header/Header';
import { ArchitectureGraph } from './components/graph/ArchitectureGraph';
import { ArchitectureDetailsPanel } from './components/details/ArchitectureDetailsPanel';
import { ArchitectureStats } from './components/overview/ArchitectureStats';
import { ProcessingPipeline } from './components/pipeline/ProcessingPipeline';
import { BlueprintEditorModal } from './components/input/BlueprintEditorModal';
import { CodebaseUploadModal } from './components/input/CodebaseUploadModal';
import { ScenarioSwitcherModal } from './components/input/ScenarioSwitcherModal';
import { DEMO_ARCHITECTURE } from './data/demoArchitecture';
import type { SampleBlueprintItem } from './data/sampleBlueprints';
import type { BlueprintParseResult } from './engine/blueprintParser';
import type { CodebaseAnalysisResult } from './engine/codebaseAnalyzer';
import { reconstructArchitecture } from './engine/architectureReconstructor';
import type {
  ArchitectureModel,
  ProcessingStep,
} from './types/architecture';

const INITIAL_PIPELINE_STEPS: ProcessingStep[] = [
  { id: 'reading', stepNumber: '01', title: 'Reading Artifacts', description: 'Ingesting raw source files and blueprints', status: 'completed' },
  { id: 'extraction', stepNumber: '02', title: 'Extracting Entities', description: 'Discovering services, databases, and APIs', status: 'completed' },
  { id: 'dependencies', stepNumber: '03', title: 'Detecting Dependencies', description: 'Resolving calls, drivers, and imports', status: 'completed' },
  { id: 'reconstruction', stepNumber: '04', title: 'Reconstructing Model', description: 'Normalizing architecture topology', status: 'completed' },
  { id: 'graph_generation', stepNumber: '05', title: 'Graph Layout', description: 'Generating automated hierarchical graph', status: 'completed' },
];

export const App: React.FC = () => {
  // State
  const [model, setModel] = useState<ArchitectureModel>(DEMO_ARCHITECTURE);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<ProcessingStep[]>(INITIAL_PIPELINE_STEPS);

  // Modals
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isCodebaseModalOpen, setIsCodebaseModalOpen] = useState(false);
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);

  // Run pipeline animation sequence
  const executePipelineSequence = useCallback(
    async (finalModel: ArchitectureModel) => {
      setIsProcessing(true);
      setSelectedEntityId(null);

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
        // Realistic step latency
        await new Promise((resolve) => setTimeout(resolve, 220));
      }

      // Final step complete
      setPipelineSteps((prev) => prev.map((step) => ({ ...step, status: 'completed' })));
      setModel(finalModel);
      setIsProcessing(false);
    },
    []
  );

  // Action: Load Default Demo Architecture
  const handleLoadDemo = useCallback(() => {
    executePipelineSequence(DEMO_ARCHITECTURE);
  }, [executePipelineSequence]);

  // Action: Apply Blueprint JSON
  const handleApplyBlueprint = useCallback(
    (result: BlueprintParseResult) => {
      const reconstructed = reconstructArchitecture({
        systemName: result.systemName,
        version: result.version,
        inputType: 'blueprint',
        entities: result.entities,
        relationships: result.relationships,
        sourceArtifacts: ['blueprint.json'],
      });
      executePipelineSequence(reconstructed);
    },
    [executePipelineSequence]
  );

  // Action: Apply Codebase ZIP Analysis
  const handleApplyCodebase = useCallback(
    (result: CodebaseAnalysisResult, fileName: string) => {
      const reconstructed = reconstructArchitecture({
        systemName: result.systemName,
        version: '1.0.0',
        inputType: 'codebase',
        entities: result.entities,
        relationships: result.relationships,
        sourceArtifacts: result.manifestsFound.length > 0 ? result.manifestsFound : [fileName],
      });
      executePipelineSequence(reconstructed);
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
    },
    [executePipelineSequence]
  );

  // Reset to default
  const handleReset = useCallback(() => {
    handleLoadDemo();
  }, [handleLoadDemo]);

  const selectedEntity = model.entities.find((e) => e.id === selectedEntityId) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 overflow-hidden select-none">
      {/* Header Bar */}
      <Header
        onLoadDemo={handleLoadDemo}
        onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
        onOpenCodebaseModal={() => setIsCodebaseModalOpen(true)}
        onOpenScenarioModal={() => setIsScenarioModalOpen(true)}
        onReset={handleReset}
      />

      {/* Processing Pipeline Stepper Banner */}
      <ProcessingPipeline
        steps={pipelineSteps}
        isProcessing={isProcessing}
      />

      {/* Reconstructed Architecture Metrics */}
      <ArchitectureStats
        stats={model.stats}
        systemName={model.systemName}
        version={model.version}
        inputType={model.inputType}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left/Center: Interactive Graph Canvas */}
        <ArchitectureGraph
          entities={model.entities}
          relationships={model.relationships}
          selectedEntityId={selectedEntityId}
          onSelectEntity={setSelectedEntityId}
          extractedAt={model.extractedAt}
        />

        {/* Right: Architecture Details & Source Traceability Panel */}
        <ArchitectureDetailsPanel
          selectedEntity={selectedEntity}
          allEntities={model.entities}
          relationships={model.relationships}
          onClose={() => setSelectedEntityId(null)}
          onSelectEntity={(id) => setSelectedEntityId(id)}
        />
      </main>

      {/* Modals */}
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
    </div>
  );
};

export default App;
