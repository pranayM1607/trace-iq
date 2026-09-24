import type {
  ArchitectureModel,
  ArchitectureEntity,
  ArchitectureDiff,
  ImpactAnalysisResult,
  StructuralRiskDelta,
  CausalRiskFactor,
} from '../types/architecture';
import { Objective2AnalysisEngine } from './objective2AnalysisEngine';

/**
 * Computes graph-based impact analysis.
 * Identifies directly changed components and traverses dependency edges
 * (upstream callers and downstream dependencies) to find potentially impacted nodes.
 */
export function computeImpactAnalysis(
  original: ArchitectureModel,
  changed: ArchitectureModel,
  diff: ArchitectureDiff
): ImpactAnalysisResult {
  const directMap = new Map<string, ArchitectureEntity>();

  diff.addedNodes.forEach((n) => directMap.set(n.id, n));
  diff.removedNodes.forEach((n) => directMap.set(n.id, n));
  diff.modifiedNodes.forEach((n) => directMap.set(n.id, n));

  const newDependencies = diff.addedRelationships.map((r) => r.relationship);
  const removedDependencies = diff.removedRelationships.map((r) => r.relationship);

  // Entities connected to new/removed dependencies are also directly touched
  const unionEntitiesMap = new Map<string, ArchitectureEntity>();
  original.entities.forEach((e) => unionEntitiesMap.set(e.id, e));
  changed.entities.forEach((e) => unionEntitiesMap.set(e.id, e));

  diff.addedRelationships.forEach((r) => {
    if (r.sourceEntity) directMap.set(r.sourceEntity.id, r.sourceEntity);
    if (r.targetEntity) directMap.set(r.targetEntity.id, r.targetEntity);
  });
  diff.removedRelationships.forEach((r) => {
    if (r.sourceEntity) directMap.set(r.sourceEntity.id, r.sourceEntity);
    if (r.targetEntity) directMap.set(r.targetEntity.id, r.targetEntity);
  });

  const directlyChangedNodes = Array.from(directMap.values());
  const directIds = new Set(directlyChangedNodes.map((n) => n.id));

  // Build reverse adjacency (upstream callers: target -> sources) on the changed architecture
  // (and original for removed elements)
  const upstreamMap = new Map<string, string[]>();
  const activeRelationships = changed.relationships.length > 0 ? changed.relationships : original.relationships;

  activeRelationships.forEach((rel) => {
    if (!upstreamMap.has(rel.target)) {
      upstreamMap.set(rel.target, []);
    }
    upstreamMap.get(rel.target)!.push(rel.source);
  });

  // BFS propagation to identify callers that transitively depend on changed nodes
  const impactedMap = new Map<string, ArchitectureEntity>();
  const propagationPaths: Array<{
    source: string;
    impacted: string;
    path: string[];
    description: string;
  }> = [];

  directlyChangedNodes.forEach((directNode) => {
    const queue: Array<{ currentId: string; path: string[] }> = [{ currentId: directNode.id, path: [directNode.id] }];
    const visited = new Set<string>([directNode.id]);

    while (queue.length > 0) {
      const { currentId, path } = queue.shift()!;
      const callers = upstreamMap.get(currentId) || [];

      for (const callerId of callers) {
        if (!visited.has(callerId)) {
          visited.add(callerId);
          const nextPath = [...path, callerId];
          const callerEntity = unionEntitiesMap.get(callerId);

          if (callerEntity && !directIds.has(callerId)) {
            impactedMap.set(callerId, callerEntity);
            propagationPaths.push({
              source: directNode.id,
              impacted: callerId,
              path: nextPath,
              description: `Component "${callerEntity.name}" calls "${directNode.name}" directly or transitively along ${nextPath.join(' -> ')}`,
            });
          }

          queue.push({ currentId: callerId, path: nextPath });
        }
      }
    }
  });

  return {
    directlyChangedNodes,
    newDependencies,
    removedDependencies,
    potentiallyImpactedNodes: Array.from(impactedMap.values()),
    propagationPaths,
  };
}

/**
 * Evaluates structural risk metrics on an architecture model deterministically.
 */
function calculateModelRiskScore(model: ArchitectureModel): {
  score: number;
  couplingRatio: number;
  bottlenecks: string[];
  externalSystems: number;
  spofs: string[];
} {
  const nodeCount = Math.max(1, model.entities.length);
  const relCount = model.relationships.length;
  const couplingRatio = Math.round((relCount / nodeCount) * 100) / 100;

  // Degree counting for bottlenecks
  const degreeMap = new Map<string, number>();
  model.relationships.forEach((r) => {
    degreeMap.set(r.source, (degreeMap.get(r.source) || 0) + 1);
    degreeMap.set(r.target, (degreeMap.get(r.target) || 0) + 1);
  });

  const bottlenecks = Array.from(degreeMap.entries())
    .filter(([_, deg]) => deg >= 3)
    .map(([id]) => id);

  const externalSystems = model.entities.filter((e) => e.type === 'External System').length;

  // Deterministic Articulation Point / SPOF detection
  const spofs = findArticulationPoints(
    model.entities.map((e) => e.id),
    model.relationships.map((r) => ({ u: r.source, v: r.target }))
  );

  // Baseline 20 pts + coupling + bottlenecks + external + spofs
  let score = 20;
  score += Math.min(30, Math.round(couplingRatio * 15));
  score += bottlenecks.length * 8;
  score += externalSystems * 6;
  score += spofs.length * 12;

  return {
    score: Math.min(100, Math.max(0, score)),
    couplingRatio,
    bottlenecks,
    externalSystems,
    spofs,
  };
}

/**
 * Finds articulation points (Single Points of Failure) using Tarjan's DFS algorithm.
 */
function findArticulationPoints(nodes: string[], edges: Array<{ u: string; v: string }>): string[] {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n, []));

  edges.forEach(({ u, v }) => {
    if (adj.has(u) && adj.has(v)) {
      adj.get(u)!.push(v);
      adj.get(v)!.push(u);
    }
  });

  const tin = new Map<string, number>();
  const low = new Map<string, number>();
  const visited = new Set<string>();
  const isCut = new Set<string>();
  let timer = 0;

  function dfs(v: string, p = '-1') {
    visited.add(v);
    tin.set(v, ++timer);
    low.set(v, timer);
    let children = 0;

    for (const to of adj.get(v) || []) {
      if (to === p) continue;
      if (visited.has(to)) {
        low.set(v, Math.min(low.get(v)!, tin.get(to)!));
      } else {
        dfs(to, v);
        low.set(v, Math.min(low.get(v)!, low.get(to)!));
        if (low.get(to)! >= tin.get(v)! && p !== '-1') {
          isCut.add(v);
        }
        children++;
      }
    }
    if (p === '-1' && children > 1) {
      isCut.add(v);
    }
  }

  for (const n of nodes) {
    if (!visited.has(n)) {
      dfs(n);
    }
  }

  return Array.from(isCut);
}

/**
 * Computes deterministic structural risk delta and itemized Causal Risk Ledger.
 */
export function computeStructuralRiskDelta(
  original: ArchitectureModel,
  changed: ArchitectureModel,
  diff: ArchitectureDiff,
  _impact?: ImpactAnalysisResult
): StructuralRiskDelta {
  const origAnalysis = Objective2AnalysisEngine.analyzeArchitecture(original);
  const chgAnalysis = Objective2AnalysisEngine.analyzeArchitecture(changed);
  const origScore = Objective2AnalysisEngine.calculateDeterministicRiskScore(origAnalysis);
  const chgScore = Objective2AnalysisEngine.calculateDeterministicRiskScore(chgAnalysis);
  const origRiskLevel = Objective2AnalysisEngine.getRiskLevel(origScore);
  const chgRiskLevel = Objective2AnalysisEngine.getRiskLevel(chgScore);

  const orig = calculateModelRiskScore(original);
  const chg = calculateModelRiskScore(changed);

  const ledger: CausalRiskFactor[] = [];
  const changedEntityIds = new Set(changed.entities.map((e) => e.id));

  // Itemize Broken Required Dependencies (Target removed while callers remain active)
  const brokenDeps: Array<{ callerName: string; removedTargetName: string }> = [];
  const removedNodeIds = new Set(diff.removedNodes.map((n) => n.id));

  diff.removedNodes.forEach((removedNode) => {
    const callersInOriginal = original.relationships
      .filter((r) => r.target === removedNode.id)
      .map((r) => r.source);

    callersInOriginal.forEach((callerId) => {
      if (changedEntityIds.has(callerId)) {
        const callerEntity = changed.entities.find((e) => e.id === callerId) || original.entities.find((e) => e.id === callerId);
        brokenDeps.push({
          callerName: callerEntity?.name || callerId,
          removedTargetName: removedNode.name,
        });
      }
    });
  });

  if (brokenDeps.length > 0) {
    const pts = brokenDeps.length * 15;
    ledger.push({
      factor: 'Broken Required Dependency Detected',
      points: pts,
      description: `Target component(s) removed while dependent caller(s) remain active: ${brokenDeps
        .map((b) => `"${b.callerName}" missing "${b.removedTargetName}"`)
        .join(', ')}. Raises severe structural breakage and unresolvability risk.`,
      evidenceCount: brokenDeps.length,
    });
  }

  // Itemize Added Dependencies
  if (diff.addedRelationships.length > 0) {
    const pts = diff.addedRelationships.length * 4;
    ledger.push({
      factor: 'Introduced New Architectural Dependencies',
      points: pts,
      description: `Added ${diff.addedRelationships.length} new communication edge(s), increasing graph density and cross-service coupling.`,
      evidenceCount: diff.addedRelationships.length,
    });
  }

  // Itemize Genuinely Decommissioned Dependencies (excluding edges where target was removed but caller remains broken)
  const genuinePrunedEdges = diff.removedRelationships.filter((r) => {
    const targetRemoved = removedNodeIds.has(r.relationship.target);
    const callerSurvives = changedEntityIds.has(r.relationship.source);
    return !(targetRemoved && callerSurvives);
  });

  if (genuinePrunedEdges.length > 0) {
    const pts = -1 * genuinePrunedEdges.length * 3;
    ledger.push({
      factor: 'Decommissioned Obsolete Dependencies',
      points: pts,
      description: `Safely pruned ${genuinePrunedEdges.length} retired dependency edge(s), reducing direct coupling.`,
      evidenceCount: genuinePrunedEdges.length,
    });
  }

  // Itemize External Integrations
  const extAdded = diff.addedNodes.filter((n) => n.type === 'External System');
  if (extAdded.length > 0) {
    ledger.push({
      factor: 'New External Third-Party Integration',
      points: extAdded.length * 6,
      description: `Introduced external service(s): ${extAdded.map((e) => e.name).join(', ')}. Increases third-party reliability surface.`,
      evidenceCount: extAdded.length,
    });
  }

  // Itemize New Bottlenecks
  const origBottlenecks = new Set(orig.bottlenecks);
  const newBottlenecks = chg.bottlenecks.filter((b) => !origBottlenecks.has(b));
  if (newBottlenecks.length > 0) {
    ledger.push({
      factor: 'High-Centrality Architectural Bottleneck Created',
      points: newBottlenecks.length * 8,
      description: `Component(s) [${newBottlenecks.join(', ')}] reached >= 3 connected relationships, concentrating traffic.`,
      evidenceCount: newBottlenecks.length,
    });
  }

  // Itemize Single Points of Failure
  const origSpofs = new Set(orig.spofs);
  const newSpofs = chg.spofs.filter((s) => !origSpofs.has(s));
  if (newSpofs.length > 0) {
    ledger.push({
      factor: 'Single Point of Failure (SPOF) Introduced',
      points: newSpofs.length * 12,
      description: `Component(s) [${newSpofs.join(', ')}] identified as articulation points whose removal partitions the system.`,
      evidenceCount: newSpofs.length,
    });
  }

  // Baseline empty ledger safeguard
  if (ledger.length === 0) {
    ledger.push({
      factor: 'Stable Architecture Configuration',
      points: 0,
      description: 'No significant structural risk deviations detected between baseline and target models.',
      evidenceCount: 0,
    });
  }

  const delta = Number((chgScore - origScore).toFixed(1));
  const shiftDirection: 'Higher structural risk' | 'Lower structural risk' | 'No structural risk change' =
    delta > 0 ? 'Higher structural risk' : delta < 0 ? 'Lower structural risk' : 'No structural risk change';

  let attributionStatement: string;
  if (brokenDeps.length > 0 && delta < 0) {
    attributionStatement = `Lower aggregate structural score (${delta} pts: ${origScore} [${origRiskLevel}] → ${chgScore} [${chgRiskLevel}]), but with ${brokenDeps.length} broken required ${brokenDeps.length === 1 ? 'dependency' : 'dependencies'} that require immediate resolution.`;
  } else if (delta > 0) {
    const factors = ledger.filter((f) => f.points > 0).map((f) => f.factor.toLowerCase()).join(', ');
    attributionStatement = `Higher structural risk: Net shift of +${delta} points (${origScore} [${origRiskLevel}] → ${chgScore} [${chgRiskLevel}])${factors ? ` due to ${factors}` : ''}.`;
  } else if (delta < 0) {
    attributionStatement = `Lower structural risk: Net shift of ${delta} points (${origScore} [${origRiskLevel}] → ${chgScore} [${chgRiskLevel}]) through decoupling and architecture simplification.`;
  } else {
    attributionStatement = `No structural risk change: Structural risk posture remains stable at ${origScore} [${origRiskLevel}].`;
  }

  return {
    originalScore: origScore,
    changedScore: chgScore,
    delta,
    originalRiskLevel: origRiskLevel,
    changedRiskLevel: chgRiskLevel,
    shiftDirection,
    ledger,
    attributionStatement,
    brokenDependencies: brokenDeps,
  };
}

/**
 * Builds a deterministic step-by-step Change Story.
 */
export function generateChangeStory(
  original: ArchitectureModel,
  changed: ArchitectureModel,
  diff: ArchitectureDiff,
  impact: ImpactAnalysisResult,
  risk: StructuralRiskDelta
): string[] {
  const story: string[] = [];

  const origName = original.systemName;
  const chgName = changed.systemName;
  const title = origName === chgName ? origName : `${origName} -> ${chgName}`;

  story.push(
    `System Evolution Overview: Reconstructed transition for "${title}" from version ${original.version} (${original.entities.length} components) to version ${changed.version} (${changed.entities.length} components).`
  );

  if (diff.repositoryDiff) {
    const rd = diff.repositoryDiff.summary;
    story.push(
      `Repository Inventory Delta: ${rd.addedFilesCount} added file(s), ${rd.removedFilesCount} removed file(s), ${rd.modifiedFilesCount} modified file(s), and ${rd.unchangedFilesCount} unchanged file(s) across ${rd.addedFoldersCount + rd.unchangedFoldersCount} directories.`
    );
  }

  story.push(
    `Architecture Delta: ${diff.summary.addedNodesCount} component(s) added, ${diff.summary.removedNodesCount} removed, ${diff.summary.modifiedNodesCount} modified. Dependencies: ${diff.summary.addedRelationshipsCount} added, ${diff.summary.removedRelationshipsCount} decommissioned.`
  );

  if (impact.directlyChangedNodes.length > 0 || impact.potentiallyImpactedNodes.length > 0) {
    story.push(
      `Impact Footprint: ${impact.directlyChangedNodes.length} component(s) directly altered. Graph propagation identified ${impact.potentiallyImpactedNodes.length} potentially impacted upstream callers (${impact.potentiallyImpactedNodes.map((n) => n.name).join(', ') || 'none'}).`
    );
  }

  story.push(
    `Risk Ledger Assessment: ${risk.attributionStatement} Base risk transitioned from ${risk.originalScore}/100 to ${risk.changedScore}/100 (net delta: ${risk.delta >= 0 ? '+' : ''}${risk.delta}).`
  );

  return story;
}
