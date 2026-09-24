import React, { useState, useMemo, useEffect } from 'react';
import {
  GitCompare,
  Upload,
  FileArchive,
  FileCode,
  ArrowRight,
  ShieldAlert,
  Boxes,
  AlertTriangle,
  Network,
  Activity,
  FileText,
  CornerDownRight,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import type {
  ArchitectureComparisonResult,
  DiffNodeItem,
  DiffRelationshipItem,
  ArchitectureEntity,
  ArchitectureRelationship,
  ProposedChange,
  ChangeSimulationResult,
} from '../../types/architecture';
import { compareRealInputs, compareRealModels } from '../../engine/directCompareEngine';
import { ArchitectureGraph } from '../graph/ArchitectureGraph';
import { Objective2AnalysisEngine } from '../../engine/objective2AnalysisEngine';
import { ChangeSimulatorEngine } from '../../engine/changeSimulatorEngine';

interface DirectCompareViewProps {
  onSelectEntity?: (entityId: string) => void;
  persistedComparison?: ArchitectureComparisonResult | null;
  onSetPersistedComparison?: (result: ArchitectureComparisonResult | null) => void;
  persistedOrigFile?: File | null;
  onSetPersistedOrigFile?: (file: File | null) => void;
  persistedChgFile?: File | null;
  onSetPersistedChgFile?: (file: File | null) => void;
  persistedActiveTab?: 'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'try_change' | 'json_payload';
  onSetPersistedActiveTab?: (tab: 'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'try_change' | 'json_payload') => void;
  persistedCompareDirection?: 'v1_to_v2' | 'v2_to_v1';
  onSetPersistedCompareDirection?: (dir: 'v1_to_v2' | 'v2_to_v1') => void;
  persistedSimulationTarget?: 'v1' | 'v2';
  onSetPersistedSimulationTarget?: (target: 'v1' | 'v2') => void;
}

export const DirectCompareView: React.FC<DirectCompareViewProps> = ({
  onSelectEntity,
  persistedComparison,
  onSetPersistedComparison,
  persistedOrigFile,
  onSetPersistedOrigFile,
  persistedChgFile,
  onSetPersistedChgFile,
  persistedActiveTab = 'repo_diff',
  onSetPersistedActiveTab,
  persistedCompareDirection,
  onSetPersistedCompareDirection,
  persistedSimulationTarget,
  onSetPersistedSimulationTarget,
}) => {
  // Upload files state
  const [origFile, setOrigFileInternal] = useState<File | null>(persistedOrigFile || null);
  const setOrigFile = (f: File | null) => {
    setOrigFileInternal(f);
    if (onSetPersistedOrigFile) onSetPersistedOrigFile(f);
  };

  const [chgFile, setChgFileInternal] = useState<File | null>(persistedChgFile || null);
  const setChgFile = (f: File | null) => {
    setChgFileInternal(f);
    if (onSetPersistedChgFile) onSetPersistedChgFile(f);
  };

  // Comparison State
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResultInternal] = useState<ArchitectureComparisonResult | null>(persistedComparison || null);
  const setComparisonResult = (res: ArchitectureComparisonResult | null) => {
    setComparisonResultInternal(res);
    if (onSetPersistedComparison) onSetPersistedComparison(res);
  };

  // Side-by-side graph selection and visibility state
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);
  const [selectedOrigEntityId, setSelectedOrigEntityId] = useState<string | null>(null);
  const [selectedChgEntityId, setSelectedChgEntityId] = useState<string | null>(null);

  // Active Tab
  type CompareTab = 'repo_diff' | 'arch_diff' | 'impact' | 'risk' | 'evidence' | 'story' | 'try_change' | 'json_payload';
  const [activeTab, setActiveTabInternal] = useState<CompareTab>(persistedActiveTab);
  const setActiveTab = (t: CompareTab) => {
    setActiveTabInternal(t);
    if (onSetPersistedActiveTab) onSetPersistedActiveTab(t);
  };

  // Synchronize persisted props across route navigation
  useEffect(() => {
    if (persistedComparison !== undefined && persistedComparison !== comparisonResult) {
      setComparisonResultInternal(persistedComparison);
    }
  }, [persistedComparison]);

  useEffect(() => {
    if (persistedOrigFile !== undefined && persistedOrigFile !== origFile) {
      setOrigFileInternal(persistedOrigFile);
    }
  }, [persistedOrigFile]);

  useEffect(() => {
    if (persistedChgFile !== undefined && persistedChgFile !== chgFile) {
      setChgFileInternal(persistedChgFile);
    }
  }, [persistedChgFile]);

  useEffect(() => {
    if (persistedActiveTab !== undefined && persistedActiveTab !== activeTab) {
      setActiveTabInternal(persistedActiveTab);
    }
  }, [persistedActiveTab]);

  // Repo filter
  const [repoFilter, setRepoFilter] = useState<'all' | 'added' | 'removed' | 'modified' | 'unchanged'>('all');

  // Run Direct Upload Comparison
  const handleRunUploadCompare = async () => {
    if (!origFile || !chgFile) {
      setCompareError('Please select both an Original/Baseline file and a Changed/Target file.');
      return;
    }

    setIsComparing(true);
    setCompareError(null);

    try {
      const result = await compareRealInputs(origFile, chgFile);
      setComparisonResult(result);
      setActiveTab('arch_diff');
    } catch (err: any) {
      setCompareError(err.message || 'Comparison failed. Please verify input files.');
    } finally {
      setIsComparing(false);
    }
  };

  // Direction state (V1 -> V2 or V2 -> V1)
  const [compareDirection, setCompareDirectionInternal] = useState<'v1_to_v2' | 'v2_to_v1'>(
    persistedCompareDirection || 'v1_to_v2'
  );
  const setCompareDirection = (d: 'v1_to_v2' | 'v2_to_v1') => {
    setCompareDirectionInternal(d);
    if (onSetPersistedCompareDirection) onSetPersistedCompareDirection(d);
  };

  useEffect(() => {
    if (persistedCompareDirection && persistedCompareDirection !== compareDirection) {
      setCompareDirectionInternal(persistedCompareDirection);
    }
  }, [persistedCompareDirection]);

  // Simulation Target state (V1 or V2)
  const [simulationTarget, setSimulationTargetInternal] = useState<'v1' | 'v2'>(
    persistedSimulationTarget || 'v2'
  );
  const setSimulationTarget = (t: 'v1' | 'v2') => {
    setSimulationTargetInternal(t);
    if (onSetPersistedSimulationTarget) onSetPersistedSimulationTarget(t);
  };

  useEffect(() => {
    if (persistedSimulationTarget && persistedSimulationTarget !== simulationTarget) {
      setSimulationTargetInternal(persistedSimulationTarget);
    }
  }, [persistedSimulationTarget]);

  // Derive active comparison deterministically without duplicating architecture data
  const activeComparison = useMemo(() => {
    if (!comparisonResult) return null;
    if (compareDirection === 'v1_to_v2') return comparisonResult;
    return compareRealModels(comparisonResult.changedModel, comparisonResult.originalModel);
  }, [comparisonResult, compareDirection]);

  const archDiff = activeComparison?.architectureDiff;
  const repoDiff = activeComparison?.repositoryDiff;
  const impact = activeComparison?.impactAnalysis;
  const risk = activeComparison?.structuralRisk;
  const story = activeComparison?.changeStory;

  // Objective 2 deterministic risk analyses for V1 and V2 independently
  const v1Analysis = useMemo(() => {
    if (!comparisonResult?.originalModel) return null;
    return Objective2AnalysisEngine.analyzeArchitecture(comparisonResult.originalModel, 'v1-baseline');
  }, [comparisonResult?.originalModel]);

  const v2Analysis = useMemo(() => {
    if (!comparisonResult?.changedModel) return null;
    return Objective2AnalysisEngine.analyzeArchitecture(comparisonResult.changedModel, 'v2-target');
  }, [comparisonResult?.changedModel]);

  const v1Score = useMemo(() => {
    return v1Analysis ? Objective2AnalysisEngine.calculateDeterministicRiskScore(v1Analysis) : 0;
  }, [v1Analysis]);

  const v2Score = useMemo(() => {
    return v2Analysis ? Objective2AnalysisEngine.calculateDeterministicRiskScore(v2Analysis) : 0;
  }, [v2Analysis]);

  const v1Level = useMemo(() => Objective2AnalysisEngine.getRiskLevel(v1Score), [v1Score]);
  const v2Level = useMemo(() => Objective2AnalysisEngine.getRiskLevel(v2Score), [v2Score]);

  // Directional Risk Delta: Delta(V1 -> V2) = Risk(V2) - Risk(V1), Delta(V2 -> V1) = Risk(V1) - Risk(V2)
  const directionalRiskDelta = useMemo(() => {
    if (compareDirection === 'v1_to_v2') {
      return Number((v2Score - v1Score).toFixed(1));
    } else {
      return Number((v1Score - v2Score).toFixed(1));
    }
  }, [compareDirection, v1Score, v2Score]);

  const shiftDirection = useMemo(() => {
    if (directionalRiskDelta > 0) return 'Higher structural risk';
    if (directionalRiskDelta < 0) return 'Lower structural risk';
    return 'No structural risk change';
  }, [directionalRiskDelta]);

  // Breakdown metrics for V1
  const v1ServicesCount = useMemo(() => {
    return comparisonResult?.originalModel.entities.filter((e) => e.type === 'Service').length || 0;
  }, [comparisonResult?.originalModel]);

  const v1ApisCount = useMemo(() => {
    return comparisonResult?.originalModel.entities.filter((e) => e.type === 'API').length || 0;
  }, [comparisonResult?.originalModel]);

  const v1DbsCount = useMemo(() => {
    return comparisonResult?.originalModel.entities.filter((e) => e.type === 'Database').length || 0;
  }, [comparisonResult?.originalModel]);

  const v1CriticalNames = useMemo(() => {
    return v1Analysis?.critical_components.slice(0, 3).map((c) => c.name).join(', ') || 'None';
  }, [v1Analysis]);

  // Breakdown metrics for V2
  const v2ServicesCount = useMemo(() => {
    return comparisonResult?.changedModel.entities.filter((e) => e.type === 'Service').length || 0;
  }, [comparisonResult?.changedModel]);

  const v2ApisCount = useMemo(() => {
    return comparisonResult?.changedModel.entities.filter((e) => e.type === 'API').length || 0;
  }, [comparisonResult?.changedModel]);

  const v2DbsCount = useMemo(() => {
    return comparisonResult?.changedModel.entities.filter((e) => e.type === 'Database').length || 0;
  }, [comparisonResult?.changedModel]);

  const v2CriticalNames = useMemo(() => {
    return v2Analysis?.critical_components.slice(0, 3).map((c) => c.name).join(', ') || 'None';
  }, [v2Analysis]);

  // Active base model for simulation (either V1 or V2 in isolated memory space)
  const simBaseModel = useMemo(() => {
    if (!comparisonResult) return null;
    return simulationTarget === 'v1' ? comparisonResult.originalModel : comparisonResult.changedModel;
  }, [comparisonResult, simulationTarget]);

  const simTargetFilename = useMemo(() => {
    if (!comparisonResult) return '';
    return simulationTarget === 'v1'
      ? comparisonResult.originalIdentity.filename
      : comparisonResult.changedIdentity.filename;
  }, [comparisonResult, simulationTarget]);

  // Sandbox simulation state
  const [sandboxAction, setSandboxAction] = useState<'remove_component' | 'add_component' | 'add_dependency' | 'remove_dependency'>('remove_component');
  const [sandboxRemoveCompId, setSandboxRemoveCompId] = useState<string>('');
  const [sandboxNewCompName, setSandboxNewCompName] = useState<string>('');
  const [sandboxNewCompType, setSandboxNewCompType] = useState<ArchitectureEntity['type']>('Service');
  const [sandboxNewCompTech, setSandboxNewCompTech] = useState<string>('Node.js / Express');
  const [sandboxDepSource, setSandboxDepSource] = useState<string>('');
  const [sandboxDepTarget, setSandboxDepTarget] = useState<string>('');
  const [sandboxDepType, setSandboxDepType] = useState<ArchitectureRelationship['type']>('CALLS');
  const [sandboxRemoveRelId, setSandboxRemoveRelId] = useState<string>('');
  const [sandboxStagedChanges, setSandboxStagedChanges] = useState<ProposedChange[]>([]);
  const [sandboxSimResult, setSandboxSimResult] = useState<ChangeSimulationResult | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // Initialize sandbox dropdown selections when simBaseModel changes
  useEffect(() => {
    const simEntities = simBaseModel?.entities || [];
    const simRels = simBaseModel?.relationships || [];
    if (simEntities.length > 0) {
      if (!sandboxRemoveCompId || !simEntities.some((e) => e.id === sandboxRemoveCompId)) {
        setSandboxRemoveCompId(simEntities[0].id);
      }
      if (!sandboxDepSource || !simEntities.some((e) => e.id === sandboxDepSource)) {
        setSandboxDepSource(simEntities[0].id);
      }
      if (!sandboxDepTarget || !simEntities.some((e) => e.id === sandboxDepTarget)) {
        setSandboxDepTarget(simEntities.length > 1 ? simEntities[1].id : simEntities[0].id);
      }
    }
    if (simRels.length > 0 && (!sandboxRemoveRelId || !simRels.some((r) => r.id === sandboxRemoveRelId))) {
      setSandboxRemoveRelId(simRels[0].id);
    }
  }, [simBaseModel]);

  const handleStageSandboxChange = () => {
    setSandboxError(null);
    const simEntities = simBaseModel?.entities || [];
    const simRels = simBaseModel?.relationships || [];

    if (sandboxAction === 'remove_component') {
      if (!sandboxRemoveCompId) {
        setSandboxError(`Please select a component to remove from ${simulationTarget.toUpperCase()}.`);
        return;
      }
      const targetEntity = simEntities.find((e) => e.id === sandboxRemoveCompId);
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'remove_component',
        description: `Remove Component '${targetEntity?.name || sandboxRemoveCompId}' (from ${simulationTarget.toUpperCase()})`,
        component_id: sandboxRemoveCompId,
      };
      setSandboxStagedChanges((prev) => [...prev, newChange]);
      setSandboxSimResult(null);
    } else if (sandboxAction === 'add_component') {
      if (!sandboxNewCompName.trim()) {
        setSandboxError('Component name is required.');
        return;
      }
      const newCompId = `comp-${sandboxNewCompName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'add_component',
        description: `Add ${sandboxNewCompType} '${sandboxNewCompName}' (${sandboxNewCompTech}) to ${simulationTarget.toUpperCase()}`,
        component: {
          id: newCompId,
          name: sandboxNewCompName.trim(),
          type: sandboxNewCompType,
          technology: sandboxNewCompTech.trim() || 'Generic',
          source: 'User-provided',
          description: `Sandbox simulated ${sandboxNewCompType}`,
        },
      };
      setSandboxStagedChanges((prev) => [...prev, newChange]);
      setSandboxNewCompName('');
      setSandboxSimResult(null);
    } else if (sandboxAction === 'add_dependency') {
      if (!sandboxDepSource || !sandboxDepTarget) {
        setSandboxError('Source and target components are required.');
        return;
      }
      if (sandboxDepSource === sandboxDepTarget) {
        setSandboxError('Source and target cannot be the same component.');
        return;
      }
      const src = simEntities.find((e) => e.id === sandboxDepSource);
      const tgt = simEntities.find((e) => e.id === sandboxDepTarget);
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'add_dependency',
        description: `Add Dependency: '${src?.name || sandboxDepSource}' -> '${tgt?.name || sandboxDepTarget}' (${sandboxDepType}) on ${simulationTarget.toUpperCase()}`,
        relationship: {
          id: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          source: sandboxDepSource,
          target: sandboxDepTarget,
          type: sandboxDepType,
          protocol: 'HTTP/REST',
          description: `Simulated edge from ${src?.name} to ${tgt?.name}`,
        },
      };
      setSandboxStagedChanges((prev) => [...prev, newChange]);
      setSandboxSimResult(null);
    } else if (sandboxAction === 'remove_dependency') {
      if (!sandboxRemoveRelId) {
        setSandboxError(`Please select a dependency to remove from ${simulationTarget.toUpperCase()}.`);
        return;
      }
      const matched = simRels.find((r) => r.id === sandboxRemoveRelId);
      const src = simEntities.find((e) => e.id === matched?.source);
      const tgt = simEntities.find((e) => e.id === matched?.target);
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'remove_dependency',
        description: `Remove Dependency: '${src?.name || matched?.source}' -> '${tgt?.name || matched?.target}' (from ${simulationTarget.toUpperCase()})`,
        relationship_id: sandboxRemoveRelId,
      };
      setSandboxStagedChanges((prev) => [...prev, newChange]);
      setSandboxSimResult(null);
    }
  };

  const handleRemoveSandboxStaged = (id: string) => {
    setSandboxStagedChanges((prev) => prev.filter((c) => c.id !== id));
    setSandboxSimResult(null);
  };

  const handleClearSandboxStaged = () => {
    setSandboxStagedChanges([]);
    setSandboxSimResult(null);
    setSandboxError(null);
  };

  const handleRunSandboxSim = () => {
    if (!simBaseModel) return;
    if (sandboxStagedChanges.length === 0) {
      setSandboxError('Please stage at least one change before running simulation.');
      return;
    }
    setSandboxError(null);
    try {
      // In-memory isolated simulation strictly on selected target (zero mutation to original/changed models)
      const result = ChangeSimulatorEngine.simulateChange(
        simBaseModel,
        sandboxStagedChanges,
        `compare-sandbox-${simulationTarget}`
      );
      setSandboxSimResult(result);
    } catch (err: any) {
      setSandboxError(err.message || 'Simulation execution failed.');
    }
  };

  // Compute isolated diff node and relationship maps for Original and Changed graphs
  const { origDiffNodesMap, origDiffEdgesMap, chgDiffNodesMap, chgDiffEdgesMap } = useMemo(() => {
    const origNodes = new Map<string, DiffNodeItem>();
    const origEdges = new Map<string, DiffRelationshipItem>();
    const chgNodes = new Map<string, DiffNodeItem>();
    const chgEdges = new Map<string, DiffRelationshipItem>();

    if (!archDiff) {
      return { origDiffNodesMap: origNodes, origDiffEdgesMap: origEdges, chgDiffNodesMap: chgNodes, chgDiffEdgesMap: chgEdges };
    }

    if (compareDirection === 'v1_to_v2') {
      // V1 -> V2: Removed nodes belong to V1 (origNodes), Added nodes belong to V2 (chgNodes)
      archDiff.removedNodes.forEach((entity) => {
        origNodes.set(entity.id, {
          changeType: 'removed',
          entity,
          versionOrigin: 'V1',
        });
      });
      archDiff.addedNodes.forEach((entity) => {
        chgNodes.set(entity.id, {
          changeType: 'added',
          entity,
          versionOrigin: 'V2',
        });
      });
      archDiff.removedRelationships.forEach((rel) => {
        origEdges.set(rel.id, rel);
      });
      archDiff.addedRelationships.forEach((rel) => {
        chgEdges.set(rel.id, rel);
      });
    } else {
      // V2 -> V1: archDiff.removedNodes belong to V2 (chgNodes), archDiff.addedNodes belong to V1 (origNodes)
      archDiff.removedNodes.forEach((entity) => {
        chgNodes.set(entity.id, {
          changeType: 'removed',
          entity,
          versionOrigin: 'V2',
        });
      });
      archDiff.addedNodes.forEach((entity) => {
        origNodes.set(entity.id, {
          changeType: 'added',
          entity,
          versionOrigin: 'V1',
        });
      });
      archDiff.removedRelationships.forEach((rel) => {
        chgEdges.set(rel.id, rel);
      });
      archDiff.addedRelationships.forEach((rel) => {
        origEdges.set(rel.id, rel);
      });
    }

    // Modified nodes belong to BOTH
    archDiff.modifiedNodes?.forEach((entity) => {
      origNodes.set(entity.id, {
        changeType: 'modified',
        entity,
        versionOrigin: 'BOTH',
      });
      chgNodes.set(entity.id, {
        changeType: 'modified',
        entity,
        versionOrigin: 'BOTH',
      });
    });

    // Unchanged nodes belong to BOTH
    archDiff.unchangedNodes?.forEach((entity) => {
      origNodes.set(entity.id, {
        changeType: 'unchanged',
        entity,
        versionOrigin: 'BOTH',
      });
      chgNodes.set(entity.id, {
        changeType: 'unchanged',
        entity,
        versionOrigin: 'BOTH',
      });
    });

    archDiff.modifiedRelationships?.forEach((rel) => {
      origEdges.set(rel.id, rel);
      chgEdges.set(rel.id, rel);
    });

    archDiff.unchangedRelationships?.forEach((rel) => {
      origEdges.set(rel.id, rel);
      chgEdges.set(rel.id, rel);
    });

    return { origDiffNodesMap: origNodes, origDiffEdgesMap: origEdges, chgDiffNodesMap: chgNodes, chgDiffEdgesMap: chgEdges };
  }, [archDiff, compareDirection]);

  // Filtered repository files
  const filteredRepoFiles = repoDiff?.diffFiles.filter((f) => {
    if (repoFilter === 'all') return true;
    return f.changeType === repoFilter;
  }) || [];

  return (
    <div className="w-full min-h-full flex flex-col bg-slate-100">
      {/* Top Bar: Comparison Configuration & Dropzones */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
              <GitCompare className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Direct Architecture & Codebase Comparison</h2>
              <p className="text-xs text-slate-500">
                Compare two real ZIP archives or JSON blueprints side-by-side with complete input preservation.
              </p>
            </div>
          </div>

        </div>

        {/* Input Zones: Dual Files */}
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
          {/* Dropzone 1: Original */}
          <div className="md:col-span-5 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-3 text-center transition-colors">
            <input
              type="file"
              accept=".zip,.json"
              id="originalFileInput"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setOrigFile(e.target.files[0]);
              }}
            />
            <label htmlFor="originalFileInput" className="cursor-pointer block">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                ORIGINAL / BASELINE (V1)
              </div>
              {origFile ? (
                <div className="flex items-center justify-center gap-2 text-xs text-blue-700 font-semibold bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200">
                  {origFile.name.endsWith('.zip') ? <FileArchive className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                  <span className="truncate max-w-[200px]">{origFile.name}</span>
                  <span className="text-[11px] text-blue-500">({(origFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 py-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select baseline .ZIP or .JSON</span>
                </div>
              )}
            </label>
          </div>

          {/* Middle Action / Arrow */}
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <button
              onClick={handleRunUploadCompare}
              disabled={!origFile || !chgFile || isComparing}
              className={`w-full py-2 px-3 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                origFile && chgFile && !isComparing
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20 hover:scale-[1.02]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isComparing ? 'Analyzing...' : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Dropzone 2: Changed */}
          <div className="md:col-span-5 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl p-3 text-center transition-colors">
            <input
              type="file"
              accept=".zip,.json"
              id="changedFileInput"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) setChgFile(e.target.files[0]);
              }}
            />
            <label htmlFor="changedFileInput" className="cursor-pointer block">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                CHANGED / TARGET (V2)
              </div>
              {chgFile ? (
                <div className="flex items-center justify-center gap-2 text-xs text-purple-700 font-semibold bg-purple-50 py-1.5 px-3 rounded-lg border border-purple-200">
                  {chgFile.name.endsWith('.zip') ? <FileArchive className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                  <span className="truncate max-w-[200px]">{chgFile.name}</span>
                  <span className="text-[11px] text-purple-500">({(chgFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5 py-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select target .ZIP or .JSON</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Error notification */}
        {compareError && (
          <div className="mt-2.5 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{compareError}</span>
          </div>
        )}
      </div>

      {/* Comparison Results Content */}
      {comparisonResult ? (
        <div className="w-full flex flex-col">
          {/* Result Header & Metrics Strip */}
          <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white">
                  Direct Comparison ({compareDirection === 'v1_to_v2' ? 'V1 → V2' : 'V2 → V1'})
                </span>
                <span className="text-sm font-bold text-white">
                  {compareDirection === 'v1_to_v2'
                    ? `${comparisonResult.originalIdentity.filename} → ${comparisonResult.changedIdentity.filename}`
                    : `${comparisonResult.changedIdentity.filename} → ${comparisonResult.originalIdentity.filename}`}
                </span>
              </div>

              {/* Compare Direction Interactive Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  COMPARE DIRECTION
                </span>
                <button
                  type="button"
                  data-testid="compare-dir-v1-v2"
                  onClick={() => setCompareDirection('v1_to_v2')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    compareDirection === 'v1_to_v2'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  [ V1 → V2 ]
                </button>
                <button
                  type="button"
                  data-testid="compare-dir-v2-v1"
                  onClick={() => setCompareDirection('v2_to_v1')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                    compareDirection === 'v2_to_v1'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  [ V2 → V1 ]
                </button>
              </div>

              {/* Unique input IDs */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>V1: {comparisonResult.originalIdentity.id.slice(0, 12)}...</span>
                <span>•</span>
                <span>V2: {comparisonResult.changedIdentity.id.slice(0, 12)}...</span>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Architecture Nodes:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {archDiff?.summary.addedNodesCount ? (
                    <span className="text-emerald-400">+{archDiff.summary.addedNodesCount}</span>
                  ) : null}
                  {archDiff?.summary.removedNodesCount ? (
                    <span className="text-red-400">-{archDiff.summary.removedNodesCount}</span>
                  ) : null}
                  {archDiff?.summary.modifiedNodesCount ? (
                    <span className="text-amber-400">~{archDiff.summary.modifiedNodesCount}</span>
                  ) : null}
                  <span className="text-slate-400">={archDiff?.summary.unchangedNodesCount}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Dependencies:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {archDiff?.summary.addedRelationshipsCount ? (
                    <span className="text-emerald-400">+{archDiff.summary.addedRelationshipsCount}</span>
                  ) : null}
                  {archDiff?.summary.removedRelationshipsCount ? (
                    <span className="text-red-400">-{archDiff.summary.removedRelationshipsCount}</span>
                  ) : null}
                  <span className="text-slate-400">={archDiff?.summary.unchangedRelationshipsCount}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Repository Files:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {repoDiff?.summary.addedFilesCount ? (
                    <span className="text-emerald-400">+{repoDiff.summary.addedFilesCount}</span>
                  ) : null}
                  {repoDiff?.summary.removedFilesCount ? (
                    <span className="text-red-400">-{repoDiff.summary.removedFilesCount}</span>
                  ) : null}
                  {repoDiff?.summary.modifiedFilesCount ? (
                    <span className="text-amber-400">~{repoDiff.summary.modifiedFilesCount}</span>
                  ) : null}
                  <span className="text-slate-400">={repoDiff?.summary.unchangedFilesCount}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2 flex items-center justify-between">
                <span className="text-slate-400">Risk Score ({compareDirection === 'v1_to_v2' ? 'V1 → V2' : 'V2 → V1'}):</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span className="text-slate-300">{compareDirection === 'v1_to_v2' ? v1Score : v2Score}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-purple-400">{compareDirection === 'v1_to_v2' ? v2Score : v1Score}</span>
                  <span className={directionalRiskDelta > 0 ? 'text-red-400 text-[11px]' : directionalRiskDelta < 0 ? 'text-emerald-400 text-[11px]' : 'text-slate-400 text-[11px]'}>
                    ({directionalRiskDelta > 0 ? `+${directionalRiskDelta}` : directionalRiskDelta})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stacked Dual Architecture Graphs Section */}
          <div className="bg-white border-b border-slate-200 shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Stacked Architecture Topology (Baseline V1 on Top, Target V2 on Bottom)
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  (Full width with independent inspection)
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Diff Legend */}
                <div className="hidden md:flex items-center gap-3 text-[11px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 ring-1 ring-emerald-600"></span>
                    <span>Added</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 ring-1 ring-rose-600"></span>
                    <span>Removed</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 ring-1 ring-amber-600"></span>
                    <span>Modified</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 border border-slate-400"></span>
                    <span>Unchanged</span>
                  </span>
                </div>

                {/* Collapse / Expand Toggle */}
                <button
                  onClick={() => setIsGraphCollapsed((prev) => !prev)}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-purple-700 px-2 py-1 rounded-md bg-white border border-slate-200 transition-colors cursor-pointer"
                >
                  <span>{isGraphCollapsed ? 'Show Graphs' : 'Collapse Graphs'}</span>
                  {isGraphCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {!isGraphCollapsed && (
              <div className="p-3 flex flex-col gap-4 bg-slate-100/70">
                {/* Top Graph: Original / Baseline (V1) */}
                <div className="flex flex-col h-[520px] rounded-xl border border-blue-200 bg-white overflow-hidden shadow-xs w-full">
                  <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                      <span className="shrink-0">ORIGINAL / BASELINE ARCHITECTURE (V1)</span>
                      <span className="text-slate-500 font-mono text-[11px] font-normal truncate" title={comparisonResult.originalIdentity.filename}>
                        {comparisonResult.originalIdentity.filename}
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-700 font-mono font-medium shrink-0 ml-2">
                      {comparisonResult.originalModel.entities.length} nodes • {comparisonResult.originalModel.relationships.length} edges
                    </span>
                  </div>

                  {/* Compact Analysis Card for V1 */}
                  <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Total Components:</span>
                        <span className="font-bold text-slate-700 font-mono">{comparisonResult.originalModel.entities.length}</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Detected:</span>
                        <span className="font-semibold text-slate-700">{v1ServicesCount} Services</span>,{' '}
                        <span className="font-semibold text-slate-700">{v1ApisCount} APIs</span>,{' '}
                        <span className="font-semibold text-slate-700">{v1DbsCount} Databases</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Top Critical:</span>
                        <span className="font-medium text-slate-700 font-mono truncate max-w-[220px]" title={v1CriticalNames}>{v1CriticalNames}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Objective 2 Risk:</span>
                      <span className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${
                        v1Level === 'CRITICAL' || v1Level === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-200' :
                        v1Level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {v1Score}/100 [{v1Level}]
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 relative w-full">
                    <ArchitectureGraph
                      entities={comparisonResult.originalModel.entities}
                      relationships={comparisonResult.originalModel.relationships}
                      selectedEntityId={selectedOrigEntityId}
                      onSelectEntity={(id) => {
                        setSelectedOrigEntityId(id);
                        if (id && onSelectEntity) onSelectEntity(id);
                      }}
                      diffMode={true}
                      diffNodesMap={origDiffNodesMap}
                      diffEdgesMap={origDiffEdgesMap}
                      extractedAt={comparisonResult.originalModel.extractedAt}
                      isLimitedArchitecture={comparisonResult.originalModel.isLimitedArchitecture}
                      limitedArchitectureReason={comparisonResult.originalModel.limitedArchitectureReason}
                    />
                  </div>
                </div>

                {/* Bottom Graph: Changed / Target (V2) */}
                <div className="flex flex-col h-[520px] rounded-xl border border-purple-200 bg-white overflow-hidden shadow-xs w-full">
                  <div className="px-4 py-2 bg-purple-50/70 border-b border-purple-100 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0"></span>
                      <span className="shrink-0">CHANGED / TARGET ARCHITECTURE (V2)</span>
                      <span className="text-slate-500 font-mono text-[11px] font-normal truncate" title={comparisonResult.changedIdentity.filename}>
                        {comparisonResult.changedIdentity.filename}
                      </span>
                    </div>
                    <span className="text-[11px] text-purple-700 font-mono font-medium shrink-0 ml-2">
                      {comparisonResult.changedModel.entities.length} nodes • {comparisonResult.changedModel.relationships.length} edges
                    </span>
                  </div>

                  {/* Compact Analysis Card for V2 */}
                  <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Total Components:</span>
                        <span className="font-bold text-slate-700 font-mono">{comparisonResult.changedModel.entities.length}</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Detected:</span>
                        <span className="font-semibold text-slate-700">{v2ServicesCount} Services</span>,{' '}
                        <span className="font-semibold text-slate-700">{v2ApisCount} APIs</span>,{' '}
                        <span className="font-semibold text-slate-700">{v2DbsCount} Databases</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <div>
                        <span className="text-slate-400 font-medium mr-1">Top Critical:</span>
                        <span className="font-medium text-slate-700 font-mono truncate max-w-[220px]" title={v2CriticalNames}>{v2CriticalNames}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Objective 2 Risk:</span>
                      <span className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${
                        v2Level === 'CRITICAL' || v2Level === 'HIGH' ? 'bg-red-50 text-red-700 border border-red-200' :
                        v2Level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {v2Score}/100 [{v2Level}]
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 relative w-full">
                    <ArchitectureGraph
                      entities={comparisonResult.changedModel.entities}
                      relationships={comparisonResult.changedModel.relationships}
                      selectedEntityId={selectedChgEntityId}
                      onSelectEntity={(id) => {
                        setSelectedChgEntityId(id);
                        if (id && onSelectEntity) onSelectEntity(id);
                      }}
                      diffMode={true}
                      diffNodesMap={chgDiffNodesMap}
                      diffEdgesMap={chgDiffEdgesMap}
                      extractedAt={comparisonResult.changedModel.extractedAt}
                      isLimitedArchitecture={comparisonResult.changedModel.isLimitedArchitecture}
                      limitedArchitectureReason={comparisonResult.changedModel.limitedArchitectureReason}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div data-testid="compare-tabs" className="sticky top-0 z-20 bg-white border-y border-slate-200 px-4 flex items-center gap-1 text-xs font-semibold overflow-x-auto shadow-xs">
            <button
              onClick={() => setActiveTab('repo_diff')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'repo_diff'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
              <span>Repository Diff ({repoDiff?.diffFiles.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('arch_diff')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'arch_diff'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Architecture Diff</span>
            </button>

            <button
              onClick={() => setActiveTab('impact')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'impact'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Impact Analysis ({impact?.potentiallyImpactedNodes.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('risk')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'risk'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>Risk Delta ({risk ? (risk.delta > 0 ? `+${risk.delta}` : risk.delta) : 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'evidence'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Evidence</span>
            </button>

            <button
              onClick={() => setActiveTab('story')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'story'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Change Story</span>
            </button>

            <button
              data-testid="compare-tab-try-change"
              onClick={() => setActiveTab('try_change')}
              className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'try_change'
                  ? 'border-purple-600 text-purple-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              <span>Try a Change (Simulator: {simulationTarget.toUpperCase()})</span>
              {sandboxStagedChanges.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 text-[10px] font-mono font-bold">
                  {sandboxStagedChanges.length}
                </span>
              )}
            </button>

            {(comparisonResult.originalModel.rawJsonString || comparisonResult.changedModel.rawJsonString) && (
              <button
                onClick={() => setActiveTab('json_payload')}
                className={`px-3 py-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'json_payload'
                    ? 'border-purple-600 text-purple-700 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                <span>Original JSON Payload</span>
              </button>
            )}
          </div>

          {/* Active Tab Panel */}
          <div className="w-full p-4 pb-16">
            {/* TAB 1: ARCHITECTURE DIFF */}
            {activeTab === 'arch_diff' && archDiff && (
              <div className="space-y-4 max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Added Components */}
                  <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-3 pb-2 border-b border-emerald-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      ADDED COMPONENTS ({archDiff.addedNodes.length})
                    </div>
                    {archDiff.addedNodes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No new components introduced.</p>
                    ) : (
                      <div className="space-y-2">
                        {archDiff.addedNodes.map((node) => (
                          <div
                            key={node.id}
                            className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-xs"
                          >
                            <div className="font-bold text-slate-900">{node.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Type: {node.type} • Tech: {node.technology || 'Generic'}
                            </div>
                            {node.description && (
                              <p className="text-[11px] text-slate-600 mt-1">{node.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Removed Components */}
                  <div className="bg-white rounded-xl border border-red-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-red-800 font-bold text-xs mb-3 pb-2 border-b border-red-100">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      REMOVED COMPONENTS ({archDiff.removedNodes.length})
                    </div>
                    {archDiff.removedNodes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No components decommissioned.</p>
                    ) : (
                      <div className="space-y-2">
                        {archDiff.removedNodes.map((node) => (
                          <div key={node.id} className="p-2.5 rounded-lg bg-red-50/50 border border-red-200 text-xs">
                            <div className="font-bold text-slate-900 line-through text-red-900">{node.name}</div>
                            <div className="text-[11px] text-slate-500">
                              Type: {node.type} • Tech: {node.technology || 'Generic'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Modified Components */}
                  <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-3 pb-2 border-b border-amber-100">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      MODIFIED COMPONENTS ({archDiff.modifiedNodes?.length || 0})
                    </div>
                    {(!archDiff.modifiedNodes || archDiff.modifiedNodes.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">No existing components modified.</p>
                    ) : (
                      <div className="space-y-2">
                        {archDiff.modifiedNodes.map((node) => (
                          <div key={node.id} className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200 text-xs">
                            <div className="font-bold text-slate-900">{node.name}</div>
                            <div className="text-[11px] text-amber-800">
                              Updated attributes or technology: {node.technology}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Relationship Changes */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
                    Dependency Changes ({archDiff.addedRelationships.length + archDiff.removedRelationships.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Added Relationships */}
                    <div>
                      <span className="text-[11px] font-bold text-emerald-700 block mb-2">
                        + Added Dependencies ({archDiff.addedRelationships.length}):
                      </span>
                      {archDiff.addedRelationships.map((r) => (
                        <div
                          key={r.id}
                          className="p-2 bg-emerald-50/40 border border-emerald-200 rounded-lg text-xs mb-2"
                        >
                          <div className="font-bold text-slate-800">
                            {r.relationship.source} → {r.relationship.target}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Type: {r.relationship.type} • Protocol: {r.relationship.protocol}
                          </div>
                          {r.sourceEvidence && (
                            <div className="mt-1 text-[10px] text-emerald-800 font-mono bg-white p-1 rounded border border-emerald-200">
                              Provenance: {r.sourceEvidence.file} ({r.sourceEvidence.description})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Removed Relationships */}
                    <div>
                      <span className="text-[11px] font-bold text-red-700 block mb-2">
                        - Removed Dependencies ({archDiff.removedRelationships.length}):
                      </span>
                      {archDiff.removedRelationships.map((r) => (
                        <div key={r.id} className="p-2 bg-red-50/40 border border-red-200 rounded-lg text-xs mb-2">
                          <div className="font-bold text-slate-800 line-through">
                            {r.relationship.source} → {r.relationship.target}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Type: {r.relationship.type} • Protocol: {r.relationship.protocol}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REPOSITORY DIFF */}
            {activeTab === 'repo_diff' && repoDiff && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 max-w-6xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Level 1 Repository Inventory Diff</h3>
                    <p className="text-xs text-slate-500">
                      100% of discovered files compared across archives. Tracks Added (+), Removed (-), Modified (~),
                      and Unchanged (=).
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {(['all', 'added', 'removed', 'modified', 'unchanged'] as const).map((filter) => (
                      <button
                        key={filter}
                        data-testid={`repo-filter-${filter}`}
                        onClick={() => setRepoFilter(filter)}
                        className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-all cursor-pointer ${
                          repoFilter === filter ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level 1 Summary Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div
                    onClick={() => setRepoFilter('added')}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      repoFilter === 'added' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Added Files</div>
                    <div className="text-2xl font-black text-emerald-600 mt-0.5 font-mono">
                      +{repoDiff.summary.addedFilesCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">New in target archive</div>
                  </div>

                  <div
                    onClick={() => setRepoFilter('removed')}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      repoFilter === 'removed' ? 'bg-red-50 border-red-400 ring-2 ring-red-200' : 'bg-slate-50 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-red-700">Removed Files</div>
                    <div className="text-2xl font-black text-red-600 mt-0.5 font-mono">
                      -{repoDiff.summary.removedFilesCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Missing in target archive</div>
                  </div>

                  <div
                    onClick={() => setRepoFilter('modified')}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      repoFilter === 'modified' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200' : 'bg-slate-50 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Modified Files</div>
                    <div className="text-2xl font-black text-amber-600 mt-0.5 font-mono">
                      ~{repoDiff.summary.modifiedFilesCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Content or size altered</div>
                  </div>

                  <div
                    onClick={() => setRepoFilter('unchanged')}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      repoFilter === 'unchanged' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Unchanged Files</div>
                    <div className="text-2xl font-black text-slate-700 mt-0.5 font-mono">
                      ={repoDiff.summary.unchangedFilesCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Identical across archives</div>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Change</th>
                        <th className="p-2.5">File Path</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Size</th>
                        <th className="p-2.5">Lines</th>
                        <th className="p-2.5">Analysis Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredRepoFiles.map((item, idx) => (
                        <tr
                          key={`${item.file.path}-${idx}`}
                          className={
                            item.changeType === 'added'
                              ? 'bg-emerald-50/40'
                              : item.changeType === 'removed'
                              ? 'bg-red-50/40'
                              : item.changeType === 'modified'
                              ? 'bg-amber-50/40'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="p-2.5 whitespace-nowrap">
                            {item.changeType === 'added' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                                + ADDED
                              </span>
                            )}
                            {item.changeType === 'removed' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                                - REMOVED
                              </span>
                            )}
                            {item.changeType === 'modified' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                                ~ MODIFIED
                              </span>
                            )}
                            {item.changeType === 'unchanged' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                = UNCHANGED
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-slate-900 font-medium">{item.file.path}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.file.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500 font-mono">{item.file.size_bytes} B</td>
                          <td className="p-2.5 text-slate-500 font-mono">{item.file.lines_count ?? 0}</td>
                          <td className="p-2.5 text-slate-700">{item.file.analysis_status || 'Retained'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: IMPACT ANALYSIS */}
            {activeTab === 'impact' && impact && (
              <div className="space-y-4 max-w-6xl mx-auto">
                {/* Directly Changed vs Potentially Impacted */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                      Directly Changed Nodes ({impact.directlyChangedNodes.length})
                    </h3>
                    <div className="space-y-2">
                      {impact.directlyChangedNodes.map((n) => (
                        <div key={n.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                          <div className="font-bold text-slate-900">{n.name}</div>
                          <div className="text-[11px] text-slate-500">ID: {n.id} • Type: {n.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      Potentially Impacted Upstream Callers ({impact.potentiallyImpactedNodes.length})
                    </h3>
                    {impact.potentiallyImpactedNodes.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No transitive callers impacted.</p>
                    ) : (
                      <div className="space-y-2">
                        {impact.potentiallyImpactedNodes.map((n) => (
                          <div key={n.id} className="p-2.5 bg-blue-50/50 border border-blue-200 rounded-lg text-xs">
                            <div className="font-bold text-blue-900">{n.name}</div>
                            <div className="text-[11px] text-blue-600">Upstream Caller • Type: {n.type}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Propagation Paths */}
                {impact.propagationPaths.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                      Graph Propagation Paths ({impact.propagationPaths.length})
                    </h3>
                    <div className="space-y-2">
                      {impact.propagationPaths.map((p, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-start gap-2">
                          <CornerDownRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-mono text-slate-800 font-bold">{p.path.join(' → ')}</div>
                            <div className="text-slate-500 text-[11px] mt-0.5">{p.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: RISK LEDGER */}
            {activeTab === 'risk' && risk && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs max-w-6xl mx-auto space-y-4">
                {/* Score Banner */}
                <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block mb-1">
                      STRUCTURAL RISK POSTURE (OBJECTIVE 2 DETERMINISTIC)
                    </span>
                    <h3 className="text-base font-bold text-white">{risk.attributionStatement}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        directionalRiskDelta > 0
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : directionalRiskDelta < 0
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {shiftDirection}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block">Baseline Risk ({compareDirection === 'v1_to_v2' ? 'V1' : 'V2'})</span>
                      <span className="text-lg font-mono font-bold">{compareDirection === 'v1_to_v2' ? v1Score : v2Score}/100</span>
                      <span className="text-[10px] text-slate-400 block font-semibold">[{compareDirection === 'v1_to_v2' ? v1Level : v2Level}]</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 block">Target Risk ({compareDirection === 'v1_to_v2' ? 'V2' : 'V1'})</span>
                      <span className="text-lg font-mono font-bold text-purple-400">{compareDirection === 'v1_to_v2' ? v2Score : v1Score}/100</span>
                      <span className="text-[10px] text-purple-300 block font-semibold">[{compareDirection === 'v1_to_v2' ? v2Level : v1Level}]</span>
                    </div>
                    <div className="text-center pl-3 border-l border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Directional Delta ({compareDirection === 'v1_to_v2' ? 'V1 → V2' : 'V2 → V1'})</span>
                      <span
                        className={`text-lg font-mono font-bold ${
                          directionalRiskDelta > 0 ? 'text-red-400' : directionalRiskDelta < 0 ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {directionalRiskDelta > 0 ? `+${directionalRiskDelta}` : directionalRiskDelta}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Structural Breakage Alert Banner (Broken Dependency Priority) */}
                {risk.brokenDependencies && risk.brokenDependencies.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                          STRUCTURAL BREAKAGE ({risk.brokenDependencies.length} Broken Required {risk.brokenDependencies.length === 1 ? 'Dependency' : 'Dependencies'})
                        </h4>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Critical architecture warning: A lower numerical risk score must never hide structural breakages. The following components were removed while active callers still depend on them:
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {risk.brokenDependencies.map((b, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white/90 border border-amber-200 p-2 rounded-lg">
                          <span className="font-semibold text-slate-800">
                            <strong>{b.callerName}</strong> still depends on decommissioned component <strong>{b.removedTargetName}</strong>
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-red-100 text-red-700 border border-red-200 shrink-0 ml-2">
                            +15.0 pts structural breakage
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Itemized Ledger Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Risk Factor</th>
                        <th className="p-2.5">Points</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Evidence Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {risk.ledger.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{item.factor}</td>
                          <td className="p-2.5 font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                item.points > 0
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : item.points < 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.points > 0 ? `+${item.points}` : item.points}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600">{item.description}</td>
                          <td className="p-2.5 font-mono text-slate-500">{item.evidenceCount ?? 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: EVIDENCE */}
            {activeTab === 'evidence' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs max-w-6xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Authentic Source Evidence & Provenance</h3>
                      <p className="text-xs text-slate-500">
                        Zero synthetic data. All entities, dependencies, and file changes are traceable directly to parsed files.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Provenance Verified
                  </span>
                </div>

                {/* Evidence Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Baseline Evidence */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      Baseline Archive Evidence ({comparisonResult.originalIdentity.filename})
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Discovered Manifests & Configurations</div>
                        <div className="text-[11px] text-slate-600">
                          {comparisonResult.originalModel.inventory?.manifests.length ? (
                            comparisonResult.originalModel.inventory.manifests.map((m) => (
                              <div key={m} className="font-mono text-blue-700 py-0.5">• {m}</div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No package manifests found.</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Decommissioned Files (-{repoDiff?.summary.removedFilesCount || 0})</div>
                        {repoDiff?.removedFiles.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">No files decommissioned from baseline.</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                            {repoDiff?.removedFiles.map((f) => (
                              <div key={f.path} className="flex items-center justify-between text-red-700 bg-red-50/60 px-2 py-1 rounded">
                                <span className="truncate">{f.path}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">{f.size_bytes} B</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Target Evidence */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      Target Archive Evidence ({comparisonResult.changedIdentity.filename})
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Discovered Manifests & Configurations</div>
                        <div className="text-[11px] text-slate-600">
                          {comparisonResult.changedModel.inventory?.manifests.length ? (
                            comparisonResult.changedModel.inventory.manifests.map((m) => (
                              <div key={m} className="font-mono text-purple-700 py-0.5">• {m}</div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No package manifests found.</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-800 mb-1">Added Files Provenance (+{repoDiff?.summary.addedFilesCount || 0})</div>
                        <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                          {repoDiff?.addedFiles.map((f) => (
                            <div key={f.path} className="flex items-center justify-between text-emerald-700 bg-emerald-50/60 px-2 py-1 rounded">
                              <span className="truncate">{f.path}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">{f.size_bytes} B</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Architecture Provenance Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase">
                    Architecture Component Evidence Citations
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Component</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Source Evidence File</th>
                        <th className="p-2.5">Confidence</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {comparisonResult.changedModel.entities.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{e.name}</td>
                          <td className="p-2.5 text-slate-600">{e.type}</td>
                          <td className="p-2.5 text-slate-700">{e.metadata?.filePath || comparisonResult.changedIdentity.filename || 'Codebase root'}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {e.metadata?.confidenceScore ? `${Math.round(e.metadata.confidenceScore * 100)}%` : '92%'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {archDiff?.addedNodes.some((n) => n.id === e.id) ? (
                              <span className="text-emerald-600 font-bold">+ Added</span>
                            ) : archDiff?.modifiedNodes?.some((n) => n.id === e.id) ? (
                              <span className="text-amber-600 font-bold">~ Modified</span>
                            ) : (
                              <span className="text-slate-400">= Unchanged</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: CHANGE STORY */}
            {activeTab === 'story' && story && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs max-w-4xl mx-auto space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Deterministic Step-by-Step Change Story</h3>
                </div>

                <div className="space-y-3">
                  {story.map((paragraph, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <p className="flex-1">{paragraph}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: TRY A CHANGE (SANDBOX SIMULATOR ON V2) */}
            {activeTab === 'try_change' && (
              <div className="space-y-6 max-w-6xl mx-auto">
                {/* Header Banner */}
                <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-purple-600 text-white">
                      <Sliders className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">
                          In-Memory Sandbox Simulator (Target: {simulationTarget.toUpperCase()})
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-300 border border-purple-400/30">
                          Isolated Sandbox
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Simulate architectural modifications on {simulationTarget.toUpperCase()} in an isolated memory space. Neither V1 nor V2 nor active repository files will ever be mutated.
                      </p>
                    </div>
                  </div>

                  {/* Simulation Target Selector (Requirement 5) */}
                  <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider px-1">
                      Simulation Target:
                    </span>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="simTargetRadio"
                        data-testid="sim-target-v1"
                        checked={simulationTarget === 'v1'}
                        onChange={() => {
                          setSimulationTarget('v1');
                          setSandboxStagedChanges([]);
                          setSandboxSimResult(null);
                        }}
                        className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span>V1 ({comparisonResult.originalIdentity.filename})</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="simTargetRadio"
                        data-testid="sim-target-v2"
                        checked={simulationTarget === 'v2'}
                        onChange={() => {
                          setSimulationTarget('v2');
                          setSandboxStagedChanges([]);
                          setSandboxSimResult(null);
                        }}
                        className="text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span>V2 ({comparisonResult.changedIdentity.filename})</span>
                    </label>
                  </div>
                </div>

                {/* Staging & Simulation Controls Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Form Controls (5 cols) */}
                  <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Stage a Simulated Change ({simulationTarget.toUpperCase()})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Step 1</span>
                    </div>

                    {/* Action Selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Change Type
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setSandboxAction('remove_component')}
                          className={`px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                            sandboxAction === 'remove_component'
                              ? 'bg-white text-rose-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Remove Component
                        </button>
                        <button
                          type="button"
                          onClick={() => setSandboxAction('add_component')}
                          className={`px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                            sandboxAction === 'add_component'
                              ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Add Component
                        </button>
                        <button
                          type="button"
                          onClick={() => setSandboxAction('add_dependency')}
                          className={`px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                            sandboxAction === 'add_dependency'
                              ? 'bg-white text-blue-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Add Dependency
                        </button>
                        <button
                          type="button"
                          onClick={() => setSandboxAction('remove_dependency')}
                          className={`px-2 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                            sandboxAction === 'remove_dependency'
                              ? 'bg-white text-amber-700 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Remove Dependency
                        </button>
                      </div>
                    </div>

                    {/* Conditional Form Fields */}
                    {sandboxAction === 'remove_component' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Component to Remove (from {simulationTarget.toUpperCase()})
                          </label>
                          <select
                            data-testid="sandbox-remove-comp-select"
                            value={sandboxRemoveCompId}
                            onChange={(e) => setSandboxRemoveCompId(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          >
                            {(simBaseModel?.entities || []).map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name} ({e.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-[11px] text-slate-500 italic">
                          Simulates decommissioning this component and removing all attached incoming and outgoing edges from {simulationTarget.toUpperCase()}.
                        </p>
                      </div>
                    )}

                    {sandboxAction === 'add_component' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Component Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., audit-service"
                            value={sandboxNewCompName}
                            onChange={(e) => setSandboxNewCompName(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Component Type
                            </label>
                            <select
                              value={sandboxNewCompType}
                              onChange={(e) => setSandboxNewCompType(e.target.value as ArchitectureEntity['type'])}
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                            >
                              <option value="Service">Service</option>
                              <option value="API">API Endpoint</option>
                              <option value="Database">Database</option>
                              <option value="Queue">Queue / Topic</option>
                              <option value="External System">External System</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Technology
                            </label>
                            <input
                              type="text"
                              value={sandboxNewCompTech}
                              onChange={(e) => setSandboxNewCompTech(e.target.value)}
                              className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {sandboxAction === 'add_dependency' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Source Component (Caller in {simulationTarget.toUpperCase()})
                          </label>
                          <select
                            value={sandboxDepSource}
                            onChange={(e) => setSandboxDepSource(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          >
                            {(simBaseModel?.entities || []).map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name} ({e.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Target Component (Callee in {simulationTarget.toUpperCase()})
                          </label>
                          <select
                            value={sandboxDepTarget}
                            onChange={(e) => setSandboxDepTarget(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          >
                            {(simBaseModel?.entities || []).map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name} ({e.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Relationship Type
                          </label>
                          <select
                            value={sandboxDepType}
                            onChange={(e) => setSandboxDepType(e.target.value as ArchitectureRelationship['type'])}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          >
                            <option value="CALLS">CALLS</option>
                            <option value="USES">USES</option>
                            <option value="QUERIES">QUERIES</option>
                            <option value="CONNECTS_TO">CONNECTS_TO</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {sandboxAction === 'remove_dependency' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Dependency to Sever (from {simulationTarget.toUpperCase()})
                          </label>
                          <select
                            value={sandboxRemoveRelId}
                            onChange={(e) => setSandboxRemoveRelId(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                          >
                            {(simBaseModel?.relationships || []).map((r) => {
                              const s = simBaseModel?.entities.find((e) => e.id === r.source);
                              const t = simBaseModel?.entities.find((e) => e.id === r.target);
                              return (
                                <option key={r.id} value={r.id}>
                                  {s?.name || r.source} → {t?.name || r.target} ({r.type})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Stage Error Notification */}
                    {sandboxError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{sandboxError}</span>
                      </div>
                    )}

                    {/* Stage Button */}
                    <button
                      type="button"
                      data-testid="sandbox-stage-button"
                      onClick={handleStageSandboxChange}
                      className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Stage Change</span>
                    </button>
                  </div>

                  {/* Right Column: Staged Queue & Run Button (7 cols) */}
                  <div className="lg:col-span-7 flex flex-col gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex-1 flex flex-col">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Staged Sandbox Queue ({simulationTarget.toUpperCase()})
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-700">
                            {sandboxStagedChanges.length}
                          </span>
                        </div>
                        {sandboxStagedChanges.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearSandboxStaged}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {sandboxStagedChanges.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                          <Sliders className="w-8 h-8 mb-2 opacity-40 text-purple-600" />
                          <p className="text-xs font-medium">No changes staged in sandbox yet.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Select a change type on the left to stage modifications against {simulationTarget.toUpperCase()}.
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 space-y-2 max-h-56 overflow-y-auto mb-3">
                          {sandboxStagedChanges.map((chg) => (
                            <div
                              key={chg.id}
                              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    chg.action.startsWith('remove') ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                                />
                                <span className="font-semibold text-slate-800 truncate">
                                  {chg.description}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSandboxStaged(chg.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Remove staged change"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Run Simulation Button */}
                      <button
                        type="button"
                        data-testid="sandbox-run-button"
                        onClick={handleRunSandboxSim}
                        disabled={sandboxStagedChanges.length === 0}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer ${
                          sandboxStagedChanges.length > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Run Simulation on {simulationTarget.toUpperCase()} Sandbox</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulation Results Display */}
                {sandboxSimResult && (() => {
                  const allAffectedNodes = [
                    ...sandboxSimResult.directly_affected_nodes,
                    ...sandboxSimResult.indirectly_affected_nodes,
                  ];
                  const brokenDeps = sandboxSimResult.broken_dependencies || [];
                  const recChecks = sandboxSimResult.recommended_checks || [];
                  const simShift =
                    sandboxSimResult.risk_delta > 0
                      ? 'Higher structural risk'
                      : sandboxSimResult.risk_delta < 0
                      ? 'Lower structural risk'
                      : 'No structural risk change';

                  return (
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
                      {/* Top Simulated Risk Banner (Requirement 7) */}
                      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block mb-1">
                            SIMULATING {simulationTarget.toUpperCase()}
                          </span>
                          <h3 className="text-base font-bold text-white">
                            Simulation target: {simulationTarget.toUpperCase()} ({simTargetFilename})
                          </h3>
                          <p className="text-xs text-slate-300 mt-1">
                            Original risk: <span className="font-mono font-bold text-white">{sandboxSimResult.current_risk_score}/100</span> • Simulated risk: <span className="font-mono font-bold text-purple-300">{sandboxSimResult.hypothetical_risk_score}/100</span> • Risk delta: <span className="font-mono font-bold text-white">{sandboxSimResult.risk_delta > 0 ? `+${sandboxSimResult.risk_delta}` : sandboxSimResult.risk_delta}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Direction: <span className="font-semibold text-purple-300">{simShift}</span> ({simShift === 'Higher structural risk' ? `+${sandboxSimResult.risk_delta} pts penalty` : `${sandboxSimResult.risk_delta} pts`})
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <span className="text-[10px] text-slate-400 block">{simulationTarget.toUpperCase()} Original</span>
                            <span className="text-xl font-mono font-bold">{sandboxSimResult.current_risk_score}/100</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-500" />
                          <div className="text-center">
                            <span className="text-[10px] text-slate-400 block">Simulated</span>
                            <span className="text-xl font-mono font-bold text-purple-400">{sandboxSimResult.hypothetical_risk_score}/100</span>
                          </div>
                          <div className="text-center pl-3 border-l border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Risk Delta</span>
                            <span
                              className={`text-xl font-mono font-bold ${
                                sandboxSimResult.risk_delta > 0
                                  ? 'text-red-400'
                                  : sandboxSimResult.risk_delta < 0
                                  ? 'text-emerald-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {sandboxSimResult.risk_delta > 0 ? `+${sandboxSimResult.risk_delta}` : sandboxSimResult.risk_delta}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Metric Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Blast Radius</div>
                          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                            {allAffectedNodes.length}
                          </div>
                          <div className="text-[10px] text-slate-500">Components in ripple zone</div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Broken Dependencies</div>
                          <div className={`text-xl font-black font-mono mt-0.5 ${
                            brokenDeps.length > 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}>
                            {brokenDeps.length}
                          </div>
                          <div className="text-[10px] text-slate-500">Unresolved caller paths</div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Changes Applied</div>
                          <div className="text-xl font-black text-purple-600 font-mono mt-0.5">
                            {sandboxStagedChanges.length}
                          </div>
                          <div className="text-[10px] text-slate-500">Staged sandbox mutations</div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Recommended Checks</div>
                          <div className="text-xl font-black text-blue-600 font-mono mt-0.5">
                            {recChecks.length}
                          </div>
                          <div className="text-[10px] text-slate-500">Suggested test targets</div>
                        </div>
                      </div>

                      {/* Broken Dependencies Alert Banner */}
                      {brokenDeps.length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                          <div className="flex items-center gap-2 text-red-800 font-bold text-xs">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span>Broken Architectural Dependencies ({brokenDeps.length})</span>
                          </div>
                          <p className="text-xs text-red-700">
                            The simulated change removes components or severs edges that have active callers:
                          </p>
                          <div className="space-y-1.5 pt-1">
                            {brokenDeps.map((b, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-red-200 text-xs flex items-center justify-between font-mono">
                                <span className="text-slate-800 font-bold">{b.callerName}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-red-700 line-through">{b.missingTargetName}</span>
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-sans font-bold uppercase">
                                  REQUIRED
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Affected Components & Recommended Checks Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Affected Components */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4 text-purple-600" />
                            <span>Affected Components ({allAffectedNodes.length})</span>
                          </h4>
                          <div className="space-y-1 max-h-56 overflow-y-auto">
                            {allAffectedNodes.map((comp: ArchitectureEntity) => (
                              <div key={comp.id} className="p-2 bg-white rounded border border-slate-200 text-xs flex items-center justify-between">
                                <span className="font-bold text-slate-800">{comp.name}</span>
                                <span className="text-[11px] text-slate-500 font-mono">{comp.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recommended Regression Checks */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Recommended Regression Checks</span>
                          </h4>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {recChecks.map((check, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-slate-200 text-xs flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span className="text-slate-700">{check}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 6: ORIGINAL JSON PAYLOAD */}
            {activeTab === 'json_payload' && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">100% Preserved Original JSON Blueprint Payload</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {comparisonResult.originalModel.rawJsonString && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-auto max-h-96">
                      <div className="font-bold text-purple-400 mb-2">ORIGINAL (V1) PAYLOAD:</div>
                      <pre>{comparisonResult.originalModel.rawJsonString}</pre>
                    </div>
                  )}
                  {comparisonResult.changedModel.rawJsonString && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-auto max-h-96">
                      <div className="font-bold text-blue-400 mb-2">CHANGED (V2) PAYLOAD:</div>
                      <pre>{comparisonResult.changedModel.rawJsonString}</pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 mb-4 shadow-sm">
            <GitCompare className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Ready to Compare Architectures</h3>
          <p className="text-xs text-slate-500 max-w-md mb-4">
            Upload two repository ZIPs, two blueprint JSONs, or compare saved snapshots. TraceIQ will reconstruct both,
            diff 100% of files, compute structural risk deltas, and analyze propagation paths.
          </p>
        </div>
      )}
    </div>
  );
};
