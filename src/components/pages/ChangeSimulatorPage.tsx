import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Network,
  Boxes,
  Activity,
  GitCommit,
  Check,
  ShieldCheck,
} from 'lucide-react';
import type {
  ArchitectureModel,
  ArchitectureEntity,
  ArchitectureRelationship,
  ProposedChange,
  ChangeSimulationResult,
  DiffNodeItem,
  DiffRelationshipItem,
} from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';
import { ArchitectureGraph } from '../graph/ArchitectureGraph';
import { TraceIQApi } from '../../services/api';
import { ChangeSimulatorEngine } from '../../engine/changeSimulatorEngine';

interface ChangeSimulatorPageProps {
  model: ArchitectureModel;
  onNavigate?: (route: NavRoute) => void;
}

export const ChangeSimulatorPage: React.FC<ChangeSimulatorPageProps> = ({
  model,
  onNavigate: _onNavigate,
}) => {
  // Staged changes list
  const [stagedChanges, setStagedChanges] = useState<ProposedChange[]>([]);

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<ChangeSimulationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form input states
  const [changeType, setChangeType] = useState<
    'add_component' | 'remove_component' | 'add_dependency' | 'remove_dependency'
  >('add_component');

  // Form: Add Component
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<ArchitectureEntity['type']>('Service');
  const [compTech, setCompTech] = useState('Node.js / Express');
  const [compDesc, setCompDesc] = useState('');

  // Form: Remove Component
  const [removeCompId, setRemoveCompId] = useState('');

  // Form: Add Dependency
  const [depSource, setDepSource] = useState('');
  const [depTarget, setDepTarget] = useState('');
  const [depType, setDepType] = useState<ArchitectureRelationship['type']>('CALLS');
  const [depProto, setDepProto] = useState('HTTP/REST');

  // Form: Remove Dependency
  const [removeRelId, setRemoveRelId] = useState('');

  // Dual graph selected node state
  const [selectedBaseNodeId, setSelectedBaseNodeId] = useState<string | null>(null);
  const [selectedSimNodeId, setSelectedSimNodeId] = useState<string | null>(null);

  // Active view tab in results: 'overview' | 'ledger' | 'impact' | 'story'
  const [activeTab, setActiveTab] = useState<'overview' | 'impact' | 'story'>('overview');

  // Available components for dropdowns (current model entities)
  const currentEntities = model.entities || [];
  const currentRelationships = model.relationships || [];

  // Default dropdown selections
  React.useEffect(() => {
    if (currentEntities.length > 0) {
      if (!removeCompId) setRemoveCompId(currentEntities[0].id);
      if (!depSource) setDepSource(currentEntities[0].id);
      if (!depTarget && currentEntities.length > 1) setDepTarget(currentEntities[1].id);
    }
    if (currentRelationships.length > 0 && !removeRelId) {
      setRemoveRelId(currentRelationships[0].id);
    }
  }, [currentEntities, currentRelationships, removeCompId, depSource, depTarget, removeRelId]);

  // Stage a new change
  const handleStageChange = () => {
    setErrorMessage(null);

    if (changeType === 'add_component') {
      if (!compName.trim()) {
        setErrorMessage('Component name is required.');
        return;
      }
      const newCompId = `comp-${compName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'add_component',
        description: `Add ${compType} '${compName}' (${compTech})`,
        component: {
          id: newCompId,
          name: compName.trim(),
          type: compType,
          technology: compTech.trim() || 'Generic',
          source: 'User-provided',
          description: compDesc.trim() || `Proposed ${compType} component`,
        },
      };
      setStagedChanges((prev) => [...prev, newChange]);
      setCompName('');
      setCompDesc('');
    } else if (changeType === 'remove_component') {
      if (!removeCompId) {
        setErrorMessage('Please select a component to remove.');
        return;
      }
      const targetEntity = currentEntities.find((e) => e.id === removeCompId);
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'remove_component',
        description: `Remove Component '${targetEntity?.name || removeCompId}'`,
        component_id: removeCompId,
      };
      setStagedChanges((prev) => [...prev, newChange]);
    } else if (changeType === 'add_dependency') {
      if (!depSource || !depTarget) {
        setErrorMessage('Source and target components are required.');
        return;
      }
      if (depSource === depTarget) {
        setErrorMessage('Source and target cannot be the same component.');
        return;
      }
      const srcEntity = currentEntities.find((e) => e.id === depSource);
      const tgtEntity = currentEntities.find((e) => e.id === depTarget);
      const newRelId = `rel-${depSource}-${depTarget}-${Date.now().toString().slice(-4)}`;
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'add_dependency',
        description: `Add dependency: ${srcEntity?.name || depSource} → ${tgtEntity?.name || depTarget} (${depType} via ${depProto})`,
        relationship: {
          id: newRelId,
          source: depSource,
          target: depTarget,
          type: depType,
          protocol: depProto,
          description: `Simulated call from ${srcEntity?.name || depSource} to ${tgtEntity?.name || depTarget}`,
        },
      };
      setStagedChanges((prev) => [...prev, newChange]);
    } else if (changeType === 'remove_dependency') {
      if (!removeRelId) {
        setErrorMessage('Please select a dependency to remove.');
        return;
      }
      const targetRel = currentRelationships.find((r) => r.id === removeRelId);
      const srcEntity = currentEntities.find((e) => e.id === targetRel?.source);
      const tgtEntity = currentEntities.find((e) => e.id === targetRel?.target);
      const newChange: ProposedChange = {
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        action: 'remove_dependency',
        description: `Remove dependency: ${srcEntity?.name || targetRel?.source} → ${tgtEntity?.name || targetRel?.target}`,
        relationship_id: removeRelId,
      };
      setStagedChanges((prev) => [...prev, newChange]);
    }
  };

  // Remove a staged change
  const handleRemoveStagedChange = (id: string) => {
    setStagedChanges((prev) => prev.filter((c) => c.id !== id));
  };

  // Quick preset scenario helpers
  const handleApplyPreset = (presetType: 'payment_gateway' | 'spof_removal' | 'circular_dependency') => {
    setErrorMessage(null);
    if (presetType === 'payment_gateway') {
      const gwId = `comp-payment-gw-${Date.now().toString().slice(-4)}`;
      const c1: ProposedChange = {
        id: `preset-${Date.now()}-1`,
        action: 'add_component',
        description: "Add External System 'Stripe Payment Gateway'",
        component: {
          id: gwId,
          name: 'Stripe Payment Gateway',
          type: 'External System',
          technology: 'HTTPS REST API',
          source: 'User-provided',
          description: 'Third-party payment settlement gateway',
        },
      };
      const orderComp = currentEntities.find((e) => e.name.toLowerCase().includes('order')) || currentEntities[0];
      const c2: ProposedChange = {
        id: `preset-${Date.now()}-2`,
        action: 'add_dependency',
        description: `Add dependency: ${orderComp?.name || 'Service'} → Stripe Payment Gateway (CALLS via HTTPS)`,
        relationship: {
          id: `rel-${orderComp?.id || 'order'}-${gwId}`,
          source: orderComp?.id || 'order',
          target: gwId,
          type: 'CALLS',
          protocol: 'HTTPS',
          description: 'Checkout payment token processing',
        },
      };
      setStagedChanges([c1, c2]);
    } else if (presetType === 'spof_removal') {
      const spofCandidate = currentEntities.find((e) => e.type === 'Database') || currentEntities[1] || currentEntities[0];
      if (spofCandidate) {
        const c: ProposedChange = {
          id: `preset-${Date.now()}-spof`,
          action: 'remove_component',
          description: `Simulate Outage: Sever '${spofCandidate.name}' (${spofCandidate.type})`,
          component_id: spofCandidate.id,
        };
        setStagedChanges([c]);
      }
    } else if (presetType === 'circular_dependency') {
      if (currentEntities.length >= 2) {
        const e1 = currentEntities[0];
        const e2 = currentEntities[1];
        const c1: ProposedChange = {
          id: `preset-${Date.now()}-c1`,
          action: 'add_dependency',
          description: `Add cross-call: ${e1.name} → ${e2.name} (CALLS via gRPC)`,
          relationship: {
            id: `rel-cycle-1-${Date.now()}`,
            source: e1.id,
            target: e2.id,
            type: 'CALLS',
            protocol: 'gRPC',
          },
        };
        const c2: ProposedChange = {
          id: `preset-${Date.now()}-c2`,
          action: 'add_dependency',
          description: `Add reciprocal loop: ${e2.name} → ${e1.name} (CALLS via HTTP)`,
          relationship: {
            id: `rel-cycle-2-${Date.now()}`,
            source: e2.id,
            target: e1.id,
            type: 'CALLS',
            protocol: 'HTTP',
          },
        };
        setStagedChanges([c1, c2]);
      }
    }
  };

  // Run the hypothetical simulation
  const handleRunSimulation = async () => {
    if (stagedChanges.length === 0) {
      setErrorMessage('Please stage at least one proposed modification before simulating.');
      return;
    }

    setIsSimulating(true);
    setErrorMessage(null);

    try {
      let result: ChangeSimulationResult;
      try {
        result = await TraceIQApi.simulateChange(model, stagedChanges, 'sim-workspace');
      } catch (backendErr) {
        console.warn('Backend /api/v1/simulate call failed, executing client engine fallback:', backendErr);
        result = ChangeSimulatorEngine.simulateChange(model, stagedChanges, 'sim-workspace');
      }

      setSimulationResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Simulation execution failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Build Diff maps for Dual Architecture Graph comparison
  const { origDiffNodesMap, origDiffEdgesMap, simDiffNodesMap, simDiffEdgesMap } = useMemo(() => {
    const origNodes = new Map<string, DiffNodeItem>();
    const origEdges = new Map<string, DiffRelationshipItem>();
    const simNodes = new Map<string, DiffNodeItem>();
    const simEdges = new Map<string, DiffRelationshipItem>();

    if (!simulationResult) {
      return { origDiffNodesMap: origNodes, origDiffEdgesMap: origEdges, simDiffNodesMap: simNodes, simDiffEdgesMap: simEdges };
    }

    const baseline = simulationResult.current_architecture;
    const simulated = simulationResult.hypothetical_architecture;

    const baseEntityMap = new Map<string, ArchitectureEntity>(baseline.entities.map((e) => [e.id, e]));
    const simEntityMap = new Map<string, ArchitectureEntity>(simulated.entities.map((e) => [e.id, e]));

    // Nodes in Baseline
    baseline.entities.forEach((be) => {
      if (!simEntityMap.has(be.id)) {
        origNodes.set(be.id, { changeType: 'removed', entity: be, versionOrigin: 'V1' });
      } else {
        origNodes.set(be.id, { changeType: 'unchanged', entity: be, versionOrigin: 'BOTH' });
      }
    });

    // Nodes in Simulated
    simulated.entities.forEach((se) => {
      if (!baseEntityMap.has(se.id)) {
        simNodes.set(se.id, { changeType: 'added', entity: se, versionOrigin: 'V2' });
      } else {
        simNodes.set(se.id, { changeType: 'unchanged', entity: se, versionOrigin: 'BOTH' });
      }
    });

    // Edges
    const baseRelMap = new Map<string, ArchitectureRelationship>(baseline.relationships.map((r) => [r.id, r]));
    const simRelMap = new Map<string, ArchitectureRelationship>(simulated.relationships.map((r) => [r.id, r]));

    baseline.relationships.forEach((br) => {
      if (!simRelMap.has(br.id)) {
        origEdges.set(br.id, { id: br.id, changeType: 'removed', relationship: br, versionOrigin: 'V1' });
      } else {
        origEdges.set(br.id, { id: br.id, changeType: 'unchanged', relationship: br, versionOrigin: 'BOTH' });
      }
    });

    simulated.relationships.forEach((sr) => {
      if (!baseRelMap.has(sr.id)) {
        simEdges.set(sr.id, { id: sr.id, changeType: 'added', relationship: sr, versionOrigin: 'V2' });
      } else {
        simEdges.set(sr.id, { id: sr.id, changeType: 'unchanged', relationship: sr, versionOrigin: 'BOTH' });
      }
    });

    return { origDiffNodesMap: origNodes, origDiffEdgesMap: origEdges, simDiffNodesMap: simNodes, simDiffEdgesMap: simEdges };
  }, [simulationResult]);

  const totalBlastRadius = simulationResult
    ? simulationResult.directly_affected_nodes.length + simulationResult.indirectly_affected_nodes.length
    : 0;

  const maxPropagationDepth = simulationResult
    ? Math.max(0, ...simulationResult.propagation_paths.map((p) => p.path_ids.length - 1))
    : 0;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50">
      {/* Top Header Banner */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-violet-600 text-white shadow-xs">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">
                  Hypothetical Change Simulator & Causal Risk Ledger
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 uppercase tracking-wider">
                  Objective 3
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Propose structural mutations in an isolated sandbox, trace cascading dependency propagation, and inspect itemized causal risk attribution.
              </p>
            </div>
          </div>

          {/* Non-Mutation Guarantee Badge */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Strict Isolation: Zero mutation to active workspace or files</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Step 1: Change Proposal Workspace */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">1. Propose Architectural Modifications</h2>
              <p className="text-xs text-slate-500">
                Specify components or dependencies to add or remove in the hypothetical model.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Quick Scenarios:</span>
              <button
                onClick={() => handleApplyPreset('payment_gateway')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer text-[11px]"
              >
                + Stripe Gateway
              </button>
              <button
                onClick={() => handleApplyPreset('spof_removal')}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold transition-colors cursor-pointer text-[11px]"
              >
                - Outage (SPOF)
              </button>
              <button
                onClick={() => handleApplyPreset('circular_dependency')}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold transition-colors cursor-pointer text-[11px]"
              >
                + Loop Cycle
              </button>
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit text-xs font-semibold">
            <button
              onClick={() => setChangeType('add_component')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                changeType === 'add_component' ? 'bg-white text-violet-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              + Add Component
            </button>
            <button
              onClick={() => setChangeType('remove_component')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                changeType === 'remove_component' ? 'bg-white text-violet-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              - Remove Component
            </button>
            <button
              onClick={() => setChangeType('add_dependency')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                changeType === 'add_dependency' ? 'bg-white text-violet-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              + Add Dependency
            </button>
            <button
              onClick={() => setChangeType('remove_dependency')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                changeType === 'remove_dependency' ? 'bg-white text-violet-700 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              - Remove Dependency
            </button>
          </div>

          {/* Dynamic Form based on changeType */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-3">
            {changeType === 'add_component' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Component Name *</label>
                  <input
                    type="text"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="e.g. AnalyticsService"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Type</label>
                  <select
                    value={compType}
                    onChange={(e) => setCompType(e.target.value as ArchitectureEntity['type'])}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium cursor-pointer"
                  >
                    <option value="Service">Service</option>
                    <option value="Database">Database</option>
                    <option value="Queue">Queue / Message Broker</option>
                    <option value="External System">External System</option>
                    <option value="Gateway">Gateway</option>
                    <option value="Cache">Cache</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Technology Stack</label>
                  <input
                    type="text"
                    value={compTech}
                    onChange={(e) => setCompTech(e.target.value)}
                    placeholder="e.g. Go, Kafka, PostgreSQL"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    value={compDesc}
                    onChange={(e) => setCompDesc(e.target.value)}
                    placeholder="Optional details..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium"
                  />
                </div>
              </div>
            )}

            {changeType === 'remove_component' && (
              <div className="text-xs">
                <label className="block text-slate-600 font-semibold mb-1">Select Component to Remove</label>
                <select
                  value={removeCompId}
                  onChange={(e) => setRemoveCompId(e.target.value)}
                  className="w-full max-w-md px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium cursor-pointer"
                >
                  {currentEntities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.type} • {e.technology})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {changeType === 'add_dependency' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Source (Caller)</label>
                  <select
                    value={depSource}
                    onChange={(e) => setDepSource(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium cursor-pointer"
                  >
                    {currentEntities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Target (Callee)</label>
                  <select
                    value={depTarget}
                    onChange={(e) => setDepTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium cursor-pointer"
                  >
                    {currentEntities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Call Type</label>
                  <select
                    value={depType}
                    onChange={(e) => setDepType(e.target.value as ArchitectureRelationship['type'])}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium cursor-pointer"
                  >
                    <option value="CALLS">CALLS</option>
                    <option value="QUERIES">QUERIES</option>
                    <option value="SENDS_EVENT">SENDS_EVENT</option>
                    <option value="CONNECTS_TO">CONNECTS_TO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Protocol</label>
                  <input
                    type="text"
                    value={depProto}
                    onChange={(e) => setDepProto(e.target.value)}
                    placeholder="HTTP/REST, gRPC, TCP"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium"
                  />
                </div>
              </div>
            )}

            {changeType === 'remove_dependency' && (
              <div className="text-xs">
                <label className="block text-slate-600 font-semibold mb-1">Select Dependency to Remove</label>
                <select
                  value={removeRelId}
                  onChange={(e) => setRemoveRelId(e.target.value)}
                  className="w-full max-w-lg px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-hidden focus:border-violet-500 font-medium cursor-pointer"
                >
                  {currentRelationships.map((r) => {
                    const src = currentEntities.find((e) => e.id === r.source);
                    const tgt = currentEntities.find((e) => e.id === r.target);
                    return (
                      <option key={r.id} value={r.id}>
                        {src?.name || r.source} → {tgt?.name || r.target} ({r.type} via {r.protocol})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleStageChange}
                className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Stage Modification</span>
              </button>
            </div>
          </div>

          {/* Staged Changes Queue */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-700">
                Staged Changes Queue ({stagedChanges.length})
              </span>
              {stagedChanges.length > 0 && (
                <button
                  onClick={() => setStagedChanges([])}
                  className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {stagedChanges.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-xs">
                No changes staged yet. Select an action above or click one of the quick scenario buttons.
              </div>
            ) : (
              <div className="space-y-1.5">
                {stagedChanges.map((chg) => (
                  <div
                    key={chg.id}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          chg.action.startsWith('add')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {chg.action.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="font-semibold text-slate-800">{chg.description}</span>
                    </div>

                    <button
                      onClick={() => handleRemoveStagedChange(chg.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove change"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Execute Simulation Button */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div className="text-[11px] text-slate-500">
              Evaluates structural risk delta, causal risk ledger, and downstream propagation paths.
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isSimulating || stagedChanges.length === 0}
              className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${
                stagedChanges.length === 0 || isSimulating
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white cursor-pointer'
              }`}
            >
              {isSimulating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Computing Propagation...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Hypothetical Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step 2: Simulation Results */}
        {simulationResult && (
          <div className="space-y-6">
            {/* 9-Point Change Simulation Intelligence Assessment */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-violet-100 text-violet-700">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Comprehensive Change Simulation Assessment
                    </h2>
                    <p className="text-xs text-slate-500">
                      Objective 3 evaluated impact across 9 core architectural dimensions.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                    simulationResult.risk_delta > 0
                      ? 'bg-rose-100 text-rose-800'
                      : simulationResult.risk_delta < 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    Net Shift: {simulationResult.risk_delta > 0 ? `+${simulationResult.risk_delta}` : simulationResult.risk_delta} pts
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* CHANGE STAGED */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    CHANGE STAGED
                  </div>
                  <div className="space-y-1 pt-1">
                    {stagedChanges.map((c, i) => (
                      <div key={i} className="text-xs font-semibold text-slate-800 truncate" title={c.description}>
                        • {c.description}
                      </div>
                    ))}
                  </div>
                </div>

                {/* DIRECT EFFECTS */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    DIRECT EFFECTS
                  </div>
                  <div className="text-xs text-slate-700 pt-1">
                    <span className="font-bold text-slate-900">{simulationResult.directly_affected_nodes.length} component(s)</span> directly modified:
                    <div className="flex flex-wrap gap-1 mt-1">
                      {simulationResult.directly_affected_nodes.map((n) => (
                        <span key={n.id} className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-slate-200 font-mono text-slate-700">
                          {n.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BROKEN DEPENDENCIES */}
                <div className={`p-3.5 rounded-xl border space-y-1 ${
                  (simulationResult.broken_dependencies && simulationResult.broken_dependencies.length > 0)
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>BROKEN DEPENDENCIES</span>
                  </div>
                  <div className="text-xs pt-1">
                    {(simulationResult.broken_dependencies && simulationResult.broken_dependencies.length > 0) ? (
                      <div className="space-y-1">
                        <div className="font-bold text-rose-800">
                          {simulationResult.broken_dependencies.length} Broken Required Dependency Link(s):
                        </div>
                        {simulationResult.broken_dependencies.map((b, i) => (
                          <div key={i} className="text-[11px] font-mono text-rose-700">
                            ⚠ "{b.callerName}" missing "{b.missingTargetName}"
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>None — All required dependencies remain resolved.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AFFECTED COMPONENTS */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    AFFECTED COMPONENTS
                  </div>
                  <div className="text-xs text-slate-700 pt-1">
                    <span className="font-extrabold text-slate-900">{totalBlastRadius} total components</span> ({simulationResult.directly_affected_nodes.length} direct, {simulationResult.indirectly_affected_nodes.length} indirect ripple) over max <span className="font-bold">{maxPropagationDepth} hop(s)</span>.
                  </div>
                </div>

                {/* RISK METRICS */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    RISK METRICS
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono">
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <div className="text-[9px] text-slate-400 uppercase font-bold">Before</div>
                      <div className="font-extrabold text-slate-800 text-sm">{simulationResult.current_risk_score}</div>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <div className="text-[9px] text-slate-400 uppercase font-bold">After</div>
                      <div className="font-extrabold text-slate-800 text-sm">{simulationResult.hypothetical_risk_score}</div>
                    </div>
                    <div className={`p-1.5 rounded border ${
                      simulationResult.risk_delta > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : simulationResult.risk_delta < 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <div className="text-[9px] uppercase font-bold">Delta (Δ)</div>
                      <div className="font-extrabold text-sm">
                        {simulationResult.risk_delta > 0 ? `+${simulationResult.risk_delta}` : simulationResult.risk_delta}
                      </div>
                    </div>
                  </div>
                </div>

                {/* WHY RISK CHANGED */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    WHY RISK CHANGED
                  </div>
                  <div className="text-xs text-slate-700 leading-relaxed pt-1">
                    {simulationResult.causal_risk_ledger.length > 0
                      ? simulationResult.causal_risk_ledger[0].description
                      : 'No structural risk regressions or improvements detected.'}
                  </div>
                </div>
              </div>

              {/* RECOMMENDED CHECKS */}
              <div className="p-3.5 rounded-xl bg-violet-50/70 border border-violet-200 space-y-2">
                <div className="text-xs font-bold text-violet-900 uppercase tracking-wider flex items-center gap-2">
                  RECOMMENDED CHECKS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-violet-950">
                  {(simulationResult.recommended_checks && simulationResult.recommended_checks.length > 0
                    ? simulationResult.recommended_checks
                    : ['Verify end-to-end integration and run smoke test suite before deploying.']
                  ).map((check, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white/80 p-2 rounded-lg border border-violet-100">
                      <span className="text-violet-600 font-bold mt-0.5">•</span>
                      <span className="leading-snug">{check}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Side-by-Side Dual Architecture Graph Visualizer */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-violet-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Side-by-Side Architectural Topologies
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                    <span>Added</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                    <span>Removed</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-300"></span>
                    <span>Unchanged</span>
                  </span>
                </div>
              </div>

              {/* Dual Canvas Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-100/50">
                {/* Baseline Left Graph */}
                <div className="flex flex-col h-[420px] bg-white">
                  <div className="px-4 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      Current Baseline Architecture
                    </span>
                    <span className="text-[11px] font-mono text-blue-700">
                      {simulationResult.current_architecture.entities.length} Nodes • {simulationResult.current_architecture.relationships.length} Edges
                    </span>
                  </div>
                  <div className="flex-1 relative">
                    <ArchitectureGraph
                      entities={simulationResult.current_architecture.entities}
                      relationships={simulationResult.current_architecture.relationships}
                      selectedEntityId={selectedBaseNodeId}
                      onSelectEntity={setSelectedBaseNodeId}
                      diffMode={true}
                      diffNodesMap={origDiffNodesMap}
                      diffEdgesMap={origDiffEdgesMap}
                    />
                  </div>
                </div>

                {/* Simulated Right Graph */}
                <div className="flex flex-col h-[420px] bg-white">
                  <div className="px-4 py-2 bg-violet-50/60 border-b border-violet-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-violet-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                      Simulated Hypothetical Architecture
                    </span>
                    <span className="text-[11px] font-mono text-violet-700">
                      {simulationResult.hypothetical_architecture.entities.length} Nodes • {simulationResult.hypothetical_architecture.relationships.length} Edges
                    </span>
                  </div>
                  <div className="flex-1 relative">
                    <ArchitectureGraph
                      entities={simulationResult.hypothetical_architecture.entities}
                      relationships={simulationResult.hypothetical_architecture.relationships}
                      selectedEntityId={selectedSimNodeId}
                      onSelectEntity={setSelectedSimNodeId}
                      diffMode={true}
                      diffNodesMap={simDiffNodesMap}
                      diffEdgesMap={simDiffEdgesMap}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Analysis Tabs (Causal Risk Ledger, Impact Analysis, Change Story) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Tab navigation */}
              <div className="flex items-center gap-4 px-5 border-b border-slate-200 bg-slate-50/50">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'overview'
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Causal Risk Ledger</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                    {simulationResult.causal_risk_ledger.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('impact')}
                  className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'impact'
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Dependency Propagation</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                    {totalBlastRadius}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('story')}
                  className={`py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'story'
                      ? 'border-violet-600 text-violet-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Change Story Narrative</span>
                </button>
              </div>

              {/* Tab 1: Causal Risk Ledger */}
              {activeTab === 'overview' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                        Itemized Causal Risk Attribution
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Deterministic mathematical attribution derived from graph metrics (no stochastic guessing).
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Causal Factor</th>
                          <th className="py-2.5 px-3 text-center">Score Delta</th>
                          <th className="py-2.5 px-3">Evidence</th>
                          <th className="py-2.5 px-4">Deterministic Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {simulationResult.causal_risk_ledger.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400">
                              No risk factors modified in this simulation run.
                            </td>
                          </tr>
                        ) : (
                          simulationResult.causal_risk_ledger.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 font-semibold text-slate-900">
                                {item.factor}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-extrabold">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] ${
                                    item.points > 0
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : item.points < 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {item.points > 0 ? `+${item.points}` : item.points} pts
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-xs text-slate-600">
                                {item.evidenceCount !== undefined ? `${item.evidenceCount} element(s)` : 'Topology'}
                              </td>
                              <td className="py-3 px-4 text-slate-600 leading-relaxed text-xs">
                                {item.description}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Dependency Propagation & Impact Analysis */}
              {activeTab === 'impact' && (
                <div className="p-5 space-y-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                      Dependency Propagation & Cascading Ripple Effect
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Traced upstream callers and downstream dependents impacted by the proposed modifications.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Directly Affected */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Directly Affected Components</span>
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          {simulationResult.directly_affected_nodes.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {simulationResult.directly_affected_nodes.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between"
                          >
                            <span className="font-bold text-slate-900">{c.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Indirectly Affected */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Indirectly Affected (Cascading Dependents)</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {simulationResult.indirectly_affected_nodes.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {simulationResult.indirectly_affected_nodes.length === 0 ? (
                          <div className="text-xs text-slate-400 py-4 text-center">
                            No secondary cascading propagation detected.
                          </div>
                        ) : (
                          simulationResult.indirectly_affected_nodes.map((c) => (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between"
                            >
                              <span className="font-bold text-slate-900">{c.name}</span>
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                Cascade Dependent
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Concrete Propagation Paths */}
                  {simulationResult.propagation_paths.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Traced Propagation Paths
                      </div>
                      <div className="space-y-1.5">
                        {simulationResult.propagation_paths.map((p, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center gap-2 font-mono text-slate-800"
                          >
                            <span className="text-violet-600 font-bold">Path #{idx + 1}:</span>
                            <span>{p.path_names.join('  →  ')}</span>
                            <span className="ml-auto text-[10px] text-slate-400">
                              {p.path_ids.length - 1} hops
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Change Story Narrative */}
              {activeTab === 'story' && (
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                      Narrative Change Story
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sequential explanation of how proposed modifications reshape topology and structural risk.
                    </p>
                  </div>

                  <div className="relative pl-6 border-l-2 border-violet-200 space-y-6">
                    {simulationResult.change_story.map((step, idx) => (
                      <div key={idx} className="relative">
                        {/* Step Marker */}
                        <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          {step.step}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{step.title}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Step {step.step} • {step.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
