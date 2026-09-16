import type {
  ArchitectureModel,
  ArchitectureEntity,
  ArchitectureRelationship,
  ProposedChange,
  ChangeSimulationResult,
  CausalRiskFactor,
  ChangeStoryStep,
} from '../types/architecture';
import { Objective2AnalysisEngine } from './objective2AnalysisEngine';

export class ChangeSimulatorEngine {
  /**
   * Runs an isolated Objective 3 hypothetical change simulation.
   * GUARANTEE: Never mutates currentArchitecture, snapshots, or repository files.
   */
  static simulateChange(
    currentArchitecture: ArchitectureModel,
    changes: ProposedChange[],
    projectId: string = 'sim-run'
  ): ChangeSimulationResult {
    // 1. Deep copy to strictly isolate simulation
    const hypothetical: ArchitectureModel = JSON.parse(JSON.stringify(currentArchitecture));

    let hypoEntities: ArchitectureEntity[] = [...hypothetical.entities];
    let hypoRelationships: ArchitectureRelationship[] = [...hypothetical.relationships];

    const entityMap = new Map<string, ArchitectureEntity>();
    hypoEntities.forEach((e) => entityMap.set(e.id, e));

    const directlyAffectedIds = new Set<string>();
    const directlyAffectedEntities: ArchitectureEntity[] = [];
    const removedEntitiesRecord: ArchitectureEntity[] = [];

    // 2. Apply proposed modifications
    for (const change of changes) {
      if (change.action === 'add_component' && change.component) {
        const comp: ArchitectureEntity = {
          ...change.component,
          id: change.component.id || `comp-${Math.random().toString(36).substring(2, 9)}`,
        };
        hypoEntities.push(comp);
        entityMap.set(comp.id, comp);
        directlyAffectedIds.add(comp.id);
        directlyAffectedEntities.push(comp);
      } else if (change.action === 'remove_component') {
        const targetId = change.component_id || change.component?.id;
        if (targetId) {
          const found = entityMap.get(targetId);
          if (found) {
            removedEntitiesRecord.push(found);
            directlyAffectedIds.add(found.id);
            directlyAffectedEntities.push(found);
            hypoEntities = hypoEntities.filter((e) => e.id !== targetId);
            // Cascade remove attached relationships in hypothetical graph
            hypoRelationships = hypoRelationships.filter(
              (r) => r.source !== targetId && r.target !== targetId
            );
          }
        }
      } else if (change.action === 'add_dependency' && change.relationship) {
        const rel: ArchitectureRelationship = {
          ...change.relationship,
          id: change.relationship.id || `rel-${Math.random().toString(36).substring(2, 9)}`,
        };
        hypoRelationships.push(rel);
        directlyAffectedIds.add(rel.source);
        directlyAffectedIds.add(rel.target);

        const s = entityMap.get(rel.source);
        const t = entityMap.get(rel.target);
        if (s && !directlyAffectedEntities.some((e) => e.id === s.id)) directlyAffectedEntities.push(s);
        if (t && !directlyAffectedEntities.some((e) => e.id === t.id)) directlyAffectedEntities.push(t);
      } else if (change.action === 'remove_dependency') {
        const relId = change.relationship_id;
        const matched = hypoRelationships.find(
          (r) => r.id === relId || (change.relationship && r.source === change.relationship.source && r.target === change.relationship.target)
        );
        if (matched) {
          directlyAffectedIds.add(matched.source);
          directlyAffectedIds.add(matched.target);
          const s = entityMap.get(matched.source);
          const t = entityMap.get(matched.target);
          if (s && !directlyAffectedEntities.some((e) => e.id === s.id)) directlyAffectedEntities.push(s);
          if (t && !directlyAffectedEntities.some((e) => e.id === t.id)) directlyAffectedEntities.push(t);
          hypoRelationships = hypoRelationships.filter((r) => r.id !== matched.id);
        }
      }
    }

    hypothetical.entities = hypoEntities;
    hypothetical.relationships = hypoRelationships;

    // 3. Trace dependency propagation (Impact Analysis)
    // Semantics: A -> B means "A depends on B".
    // When B changes, upstream callers/dependents (nodes with edges pointing to B) are impacted.
    const allKnownEntities = new Map<string, ArchitectureEntity>();
    [...currentArchitecture.entities, ...hypoEntities, ...removedEntitiesRecord].forEach((e) =>
      allKnownEntities.set(e.id, e)
    );

    const inAdjHypo = new Map<string, string[]>();
    hypoEntities.forEach((e) => inAdjHypo.set(e.id, []));
    hypoRelationships.forEach((r) => {
      if (!inAdjHypo.has(r.target)) inAdjHypo.set(r.target, []);
      inAdjHypo.get(r.target)!.push(r.source);
    });

    const inAdjCurr = new Map<string, string[]>();
    currentArchitecture.entities.forEach((e) => inAdjCurr.set(e.id, []));
    currentArchitecture.relationships.forEach((r) => {
      if (!inAdjCurr.has(r.target)) inAdjCurr.set(r.target, []);
      inAdjCurr.get(r.target)!.push(r.source);
    });

    const indirectlyAffectedIds = new Set<string>();
    const propagationPaths: Array<{
      source: string;
      target: string;
      path_ids: string[];
      path_names: string[];
      propagation_type: string;
      description: string;
    }> = [];

    directlyAffectedIds.forEach((changedId) => {
      // Traverse upstream dependents in hypothetical and current
      [inAdjHypo, inAdjCurr].forEach((adj) => {
        const queue: Array<{ curr: string; path: string[] }> = [{ curr: changedId, path: [changedId] }];
        const visited = new Set<string>([changedId]);

        while (queue.length > 0) {
          const { curr, path } = queue.shift()!;
          for (const callerId of adj.get(curr) || []) {
            if (!visited.has(callerId)) {
              visited.add(callerId);
              const nextPath = [callerId, ...path];
              if (!directlyAffectedIds.has(callerId)) {
                indirectlyAffectedIds.add(callerId);
                const callerName = allKnownEntities.get(callerId)?.name || callerId;
                const changedName = allKnownEntities.get(changedId)?.name || changedId;
                const pathNames = nextPath.map((nid) => allKnownEntities.get(nid)?.name || nid);

                propagationPaths.push({
                  source: callerId,
                  target: changedId,
                  path_ids: nextPath,
                  path_names: pathNames,
                  propagation_type: 'Upstream Dependent Impact',
                  description: `'${callerName}' depends transitively on changed node '${changedName}' along ${pathNames.join(' -> ')}.`,
                });
              }
              queue.push({ curr: callerId, path: nextPath });
            }
          }
        }
      });
    });

    // Deduplicate propagation paths
    const seenPathKeys = new Set<string>();
    const uniquePropagationPaths = propagationPaths.filter((p) => {
      const k = p.path_ids.join('>');
      if (seenPathKeys.has(k)) return false;
      seenPathKeys.add(k);
      return true;
    });

    const indirectlyAffectedEntities: ArchitectureEntity[] = Array.from(indirectlyAffectedIds)
      .map((id) => allKnownEntities.get(id))
      .filter((e): e is ArchitectureEntity => !!e);

    // 4. Run Objective 2 analysis on both graphs
    const currentAnalysis = Objective2AnalysisEngine.analyzeArchitecture(
      currentArchitecture,
      `${projectId}-baseline`
    );
    const hypotheticalAnalysis = Objective2AnalysisEngine.analyzeArchitecture(
      hypothetical,
      `${projectId}-hypo`
    );

    // 5. Calculate Risk Scores & Delta
    const currentRisk = Objective2AnalysisEngine.calculateDeterministicRiskScore(currentAnalysis);
    const hypotheticalRisk = Objective2AnalysisEngine.calculateDeterministicRiskScore(hypotheticalAnalysis);
    const riskDelta = Number((hypotheticalRisk - currentRisk).toFixed(1));

    // 6. Causal Risk Ledger (deterministic structural-risk attribution)
    const causalRiskLedger: CausalRiskFactor[] = [];

    // Coupling
    const deltaEdges = hypothetical.relationships.length - currentArchitecture.relationships.length;
    if (deltaEdges > 0) {
      causalRiskLedger.push({
        factor: 'Increased Outbound Coupling',
        points: Number((deltaEdges * 4.0).toFixed(1)),
        description: `Added ${deltaEdges} new dependency link(s), increasing graph density and coordination complexity.`,
        evidenceCount: deltaEdges,
      });
    } else if (deltaEdges < 0) {
      causalRiskLedger.push({
        factor: 'Reduced Dependency Coupling',
        points: Number((deltaEdges * 3.5).toFixed(1)),
        description: `Decommissioned ${Math.abs(deltaEdges)} dependency edge(s), decoupling architecture components.`,
        evidenceCount: Math.abs(deltaEdges),
      });
    }

    // SPOFs
    const currSpofIds = new Set(currentAnalysis.spofs.filter((s) => s.is_spof).map((s) => s.component_id));
    const hypoSpofIds = new Set(hypotheticalAnalysis.spofs.filter((s) => s.is_spof).map((s) => s.component_id));

    const newSpofIds = Array.from(hypoSpofIds).filter((id) => !currSpofIds.has(id));
    const resSpofIds = Array.from(currSpofIds).filter((id) => !hypoSpofIds.has(id));

    if (newSpofIds.length > 0) {
      const names = newSpofIds.map((id) => allKnownEntities.get(id)?.name || id).join(', ');
      causalRiskLedger.push({
        factor: 'Single Point of Failure Introduced',
        points: Number((newSpofIds.length * 12.0).toFixed(1)),
        description: `Introduced ${newSpofIds.length} new SPOF(s) (${names}); failure disrupts upstream components.`,
        evidenceCount: newSpofIds.length,
      });
    }

    if (resSpofIds.length > 0) {
      const names = resSpofIds.map((id) => allKnownEntities.get(id)?.name || id).join(', ');
      causalRiskLedger.push({
        factor: 'Single Point of Failure Eliminated',
        points: Number((-resSpofIds.length * 10.0).toFixed(1)),
        description: `Eliminated ${resSpofIds.length} SPOF(s) (${names}) through redundant routing.`,
        evidenceCount: resSpofIds.length,
      });
    }

    // Cycles
    const deltaCycles = hypotheticalAnalysis.complexity.cycles_count - currentAnalysis.complexity.cycles_count;
    if (deltaCycles > 0) {
      causalRiskLedger.push({
        factor: 'Circular Dependency Loop Created',
        points: Number((deltaCycles * 10.0).toFixed(1)),
        description: `Created ${deltaCycles} recursive dependency cycle(s), elevating deadlock risk.`,
        evidenceCount: deltaCycles,
      });
    } else if (deltaCycles < 0) {
      causalRiskLedger.push({
        factor: 'Circular Dependency Resolved',
        points: Number((deltaCycles * 10.0).toFixed(1)),
        description: `Eliminated ${Math.abs(deltaCycles)} cyclic dependency loop(s).`,
        evidenceCount: Math.abs(deltaCycles),
      });
    }

    // External dependencies
    const currExtCount = currentArchitecture.entities.filter((e) => e.type === 'External System').length;
    const hypoExtCount = hypothetical.entities.filter((e) => e.type === 'External System').length;
    const deltaExt = hypoExtCount - currExtCount;
    if (deltaExt > 0) {
      causalRiskLedger.push({
        factor: 'Third-Party External Integration Added',
        points: Number((deltaExt * 6.0).toFixed(1)),
        description: `Added ${deltaExt} external third-party dependency, introducing external boundary latency and SLA risk.`,
        evidenceCount: deltaExt,
      });
    } else if (deltaExt < 0) {
      causalRiskLedger.push({
        factor: 'External Dependency Decommissioned',
        points: Number((deltaExt * 5.0).toFixed(1)),
        description: `Removed ${Math.abs(deltaExt)} external boundary integration(s).`,
        evidenceCount: Math.abs(deltaExt),
      });
    }

    if (causalRiskLedger.length === 0) {
      causalRiskLedger.push({
        factor: 'Neutral Architecture Adjustment',
        points: 0,
        description: 'The proposed modifications did not introduce structural risk regressions.',
        evidenceCount: 0,
      });
    }

    // 7. Change Story narrative
    const changeStory: ChangeStoryStep[] = [
      {
        step: 1,
        title: 'Proposed Changes Application',
        description: `Applied ${changes.length} modification(s) across ${directlyAffectedEntities.length} directly affected entity/entities in isolated simulation.`,
        category: 'Scope & Staging',
      },
      {
        step: 2,
        title: 'Dependency Propagation Analysis',
        description:
          indirectlyAffectedEntities.length > 0
            ? `Identified ${indirectlyAffectedEntities.length} upstream dependent component(s) across ${uniquePropagationPaths.length} transitive propagation path(s).`
            : 'No upstream dependent services are indirectly impacted by this modification.',
        category: 'Blast Radius',
      },
      {
        step: 3,
        title: 'Structural Risk Shift',
        description: `Modelled structural risk score transitioned from ${currentRisk} to ${hypotheticalRisk} (Net Delta: ${riskDelta > 0 ? `+${riskDelta}` : riskDelta}). ${
          riskDelta > 0
            ? 'Risk increased due to new architectural obligations.'
            : riskDelta < 0
            ? 'Risk reduced via architectural decoupling.'
            : 'Risk posture remains neutral.'
        }`,
        category: 'Risk Delta',
      },
      {
        step: 4,
        title: 'Deterministic Causal Attribution',
        description: `Primary risk driver: ${causalRiskLedger[0].factor} (${causalRiskLedger[0].points > 0 ? `+${causalRiskLedger[0].points}` : causalRiskLedger[0].points} pts) - ${causalRiskLedger[0].description}`,
        category: 'Causal Attribution',
      },
    ];

    return {
      current_architecture: currentArchitecture,
      hypothetical_architecture: hypothetical,
      current_analysis: currentAnalysis,
      hypothetical_analysis: hypotheticalAnalysis,
      directly_affected_nodes: directlyAffectedEntities,
      indirectly_affected_nodes: indirectlyAffectedEntities,
      propagation_paths: uniquePropagationPaths,
      current_risk_score: currentRisk,
      hypothetical_risk_score: hypotheticalRisk,
      risk_delta: riskDelta,
      causal_risk_ledger: causalRiskLedger,
      change_story: changeStory,
    };
  }
}
