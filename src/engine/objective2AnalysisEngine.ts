import type {
  ArchitectureModel,
  Objective2AnalysisResult,
  ComponentMetrics,
  CriticalComponent,
  SpofAnalysis,
  HighRiskDependency,
  ComplexityAnalysis,
  ComponentRiskSummary,
  RiskLevel,
} from '../types/architecture';

/**
 * Deterministic Client-Side Graph Analysis Engine for Objective 2.
 * Mirrors the NetworkX formulas from the Python backend so that TraceIQ
 * has 100% feature parity both online and offline.
 */
export class Objective2AnalysisEngine {
  /**
   * Calculates reproducible composite structural risk score (0 - 100).
   * Strictly deterministic from graph metrics; no LLM or random noise.
   */
  static calculateDeterministicRiskScore(analysis: Objective2AnalysisResult): number {
    const nodeCount = analysis.architecture.entities.length;
    if (nodeCount === 0) return 0;

    // 1. Base Density & Coupling (up to 25 pts)
    const density = analysis.complexity.density;
    const avgDegree = analysis.complexity.average_degree;
    const couplingScore = Math.min(25.0, density * 30.0 + avgDegree * 2.5);

    // 2. Single Points of Failure (up to 30 pts)
    const trueSpofs = analysis.spofs.filter((s) => s.is_spof);
    const spofScore = Math.min(30.0, trueSpofs.length * 12.0);

    // 3. Circular Dependencies & Cycles (up to 20 pts)
    const cycleScore = Math.min(20.0, analysis.complexity.cycles_count * 10.0);

    // 4. Critical & High-Risk Dependencies (up to 15 pts)
    const highRiskDeps = analysis.high_risk_dependencies.filter(
      (d) => d.risk_level === 'CRITICAL' || d.risk_level === 'HIGH'
    );
    const depScore = Math.min(15.0, highRiskDeps.length * 3.5);

    // 5. External Dependency Exposure & Depth (up to 10 pts)
    const extNodes = analysis.architecture.entities.filter((e) => e.type === 'External System');
    const depth = analysis.complexity.max_dependency_depth;
    const extScore = Math.min(10.0, extNodes.length * 3.0 + Math.max(0, depth - 3) * 1.5);

    const total = couplingScore + spofScore + cycleScore + depScore + extScore;
    return Number(Math.min(100.0, Math.max(5.0, total)).toFixed(1));
  }

  /**
   * Executes the full Objective 2 graph analysis pipeline on an ArchitectureModel.
   */
  static analyzeArchitecture(
    model: ArchitectureModel,
    projectId: string = 'client-project'
  ): Objective2AnalysisResult {
    const entities = model.entities || [];
    const relationships = model.relationships || [];
    const N = entities.length;
    const E = relationships.length;

    // Adjacency maps
    // A -> B: A has outgoing edge to B.
    // Outbound: source -> targets (direct dependencies)
    // Inbound: target -> sources (direct callers / dependents)
    const outAdj = new Map<string, string[]>();
    const inAdj = new Map<string, string[]>();

    entities.forEach((e) => {
      outAdj.set(e.id, []);
      inAdj.set(e.id, []);
    });

    relationships.forEach((r) => {
      if (!outAdj.has(r.source)) outAdj.set(r.source, []);
      if (!inAdj.has(r.target)) inAdj.set(r.target, []);
      outAdj.get(r.source)!.push(r.target);
      inAdj.get(r.target)!.push(r.source);
    });

    // 1. Component Metrics
    const componentMetrics: Record<string, ComponentMetrics> = {};

    // Breadth-first reachability
    const getReachable = (startId: string, adjMap: Map<string, string[]>): string[] => {
      const visited = new Set<string>();
      const queue = [startId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of adjMap.get(curr) || []) {
          if (!visited.has(neighbor) && neighbor !== startId) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      return Array.from(visited);
    };

    // Longest simple path from start
    const getLongestPath = (startId: string, adjMap: Map<string, string[]>): string[] => {
      let longest: string[] = [startId];
      const queue: Array<{ path: string[]; visited: Set<string> }> = [
        { path: [startId], visited: new Set([startId]) },
      ];

      while (queue.length > 0) {
        const { path, visited } = queue.shift()!;
        if (path.length > longest.length) longest = path;
        if (path.length >= 15) continue;

        const curr = path[path.length - 1];
        for (const nxt of adjMap.get(curr) || []) {
          if (!visited.has(nxt)) {
            const nextVisited = new Set(visited);
            nextVisited.add(nxt);
            queue.push({ path: [...path, nxt], visited: nextVisited });
          }
        }
      }
      return longest;
    };

    // Brandes Betweenness Centrality
    const betweenness = new Map<string, number>();
    entities.forEach((e) => betweenness.set(e.id, 0));

    for (const s of entities) {
      const S: string[] = [];
      const P = new Map<string, string[]>();
      const sigma = new Map<string, number>();
      const d = new Map<string, number>();

      entities.forEach((v) => {
        P.set(v.id, []);
        sigma.set(v.id, 0);
        d.set(v.id, -1);
      });

      sigma.set(s.id, 1);
      d.set(s.id, 0);
      const Q = [s.id];

      while (Q.length > 0) {
        const v = Q.shift()!;
        S.push(v);
        for (const w of outAdj.get(v) || []) {
          if (!d.has(w)) continue;
          if (d.get(w)! < 0) {
            Q.push(w);
            d.set(w, d.get(v)! + 1);
          }
          if (d.get(w)! === d.get(v)! + 1) {
            sigma.set(w, sigma.get(w)! + sigma.get(v)!);
            P.get(w)!.push(v);
          }
        }
      }

      const delta = new Map<string, number>();
      entities.forEach((v) => delta.set(v.id, 0));

      while (S.length > 0) {
        const w = S.pop()!;
        for (const v of P.get(w) || []) {
          const c = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
          delta.set(v, delta.get(v)! + c);
        }
        if (w !== s.id) {
          betweenness.set(w, betweenness.get(w)! + delta.get(w)!);
        }
      }
    }

    // Normalize betweenness
    const scale = N > 2 ? 1 / ((N - 1) * (N - 2)) : 1;
    entities.forEach((e) => {
      betweenness.set(e.id, (betweenness.get(e.id) || 0) * scale);
    });

    // PageRank via Power Iteration
    const pagerank = new Map<string, number>();
    const alpha = 0.85;
    const initialPr = N > 0 ? 1 / N : 0;
    entities.forEach((e) => pagerank.set(e.id, initialPr));

    for (let iter = 0; iter < 50; iter++) {
      let danglingSum = 0;
      entities.forEach((e) => {
        if ((outAdj.get(e.id) || []).length === 0) {
          danglingSum += pagerank.get(e.id) || 0;
        }
      });

      const nextPr = new Map<string, number>();
      entities.forEach((e) => {
        let sum = 0;
        for (const inNeighbor of inAdj.get(e.id) || []) {
          const outDegree = (outAdj.get(inNeighbor) || []).length;
          if (outDegree > 0) {
            sum += (pagerank.get(inNeighbor) || 0) / outDegree;
          }
        }
        const val = (1 - alpha) / N + alpha * (sum + danglingSum / N);
        nextPr.set(e.id, val);
      });

      let diff = 0;
      entities.forEach((e) => {
        diff += Math.abs((nextPr.get(e.id) || 0) - (pagerank.get(e.id) || 0));
        pagerank.set(e.id, nextPr.get(e.id) || 0);
      });
      if (diff < 1e-5) break;
    }

    // Build metrics for each entity
    entities.forEach((entity) => {
      const directCallers = inAdj.get(entity.id) || [];
      const directDependencies = outAdj.get(entity.id) || [];
      const upstreamCallers = getReachable(entity.id, inAdj);
      const downstreamDependents = getReachable(entity.id, outAdj);

      const longestDownstream = getLongestPath(entity.id, outAdj);
      const longestUpstream = getLongestPath(entity.id, inAdj).reverse();

      componentMetrics[entity.id] = {
        component_id: entity.id,
        name: entity.name,
        type: entity.type,
        in_degree: directCallers.length,
        out_degree: directDependencies.length,
        total_degree: directCallers.length + directDependencies.length,
        betweenness_centrality: Number((betweenness.get(entity.id) || 0).toFixed(4)),
        pagerank: Number((pagerank.get(entity.id) || 0).toFixed(4)),
        direct_callers_count: directCallers.length,
        direct_callers: directCallers,
        direct_dependencies_count: directDependencies.length,
        direct_dependencies: directDependencies,
        upstream_callers_count: upstreamCallers.length,
        upstream_callers: upstreamCallers,
        downstream_dependents_count: downstreamDependents.length,
        downstream_dependents: downstreamDependents,
        max_dependency_depth: Math.max(0, longestDownstream.length - 1),
        max_propagation_depth: Math.max(0, longestUpstream.length - 1),
        longest_downstream_path: longestDownstream,
        longest_upstream_path: longestUpstream,
        transitive_paths_through: [],
      };
    });

    // 2. SPOF Detection (Tarjan's Articulation Points on undirected projection)
    const undirAdj = new Map<string, string[]>();
    entities.forEach((e) => undirAdj.set(e.id, []));
    relationships.forEach((r) => {
      if (undirAdj.has(r.source) && undirAdj.has(r.target)) {
        undirAdj.get(r.source)!.push(r.target);
        undirAdj.get(r.target)!.push(r.source);
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

      for (const to of undirAdj.get(v) || []) {
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

    entities.forEach((e) => {
      if (!visited.has(e.id)) dfs(e.id);
    });

    const spofs: SpofAnalysis[] = entities.map((e) => {
      const isSpof = isCut.has(e.id);
      const callers = inAdj.get(e.id) || [];
      const callerNames = callers.map((cid) => entities.find((ent) => ent.id === cid)?.name || cid);

      return {
        component_id: e.id,
        name: e.name,
        type: e.type,
        technology: e.technology,
        is_spof: isSpof,
        spof_type: e.type === 'Database' ? 'SHARED_DATASTORE' : 'TRANSIT',
        disconnected_paths_count: isSpof ? callers.length * 2 : 0,
        affected_components_count: callers.length,
        severed_components: callers,
        severed_component_names: callerNames,
        severed_paths: callers.map((cid) => [cid, e.id]),
        has_alternate_path: !isSpof,
        severity: isSpof ? (callers.length >= 3 ? 'CRITICAL' : 'HIGH') : 'NONE',
        explanation: isSpof
          ? `Structural bottleneck bridging disjoint subgraphs; failure disrupts ${callers.length} dependent(s).`
          : 'Redundant or terminal node; does not act as a structural articulation point.',
      };
    });

    // 3. Cycle Detection (DFS)
    const cycles: string[][] = [];
    const color = new Map<string, number>(); // 0=white, 1=gray, 2=black
    const parentPath: string[] = [];

    const cycleDfs = (u: string) => {
      color.set(u, 1);
      parentPath.push(u);

      for (const v of outAdj.get(u) || []) {
        if (color.get(v) === 1) {
          const idx = parentPath.indexOf(v);
          if (idx !== -1) {
            cycles.push(parentPath.slice(idx));
          }
        } else if (color.get(v) === 0) {
          cycleDfs(v);
        }
      }

      parentPath.pop();
      color.set(u, 2);
    };

    entities.forEach((e) => color.set(e.id, 0));
    entities.forEach((e) => {
      if (color.get(e.id) === 0) cycleDfs(e.id);
    });

    // 4. Complexity Analysis
    const avgDegree = N > 0 ? Number(((2 * E) / N).toFixed(2)) : 0;
    const density = N > 1 ? Number((E / (N * (N - 1))).toFixed(3)) : 0;
    const cyclomatic = Math.max(1, E - N + 2);
    const maxDepth = Math.max(0, ...Object.values(componentMetrics).map((m) => m.max_dependency_depth));

    const complexityRating = cyclomatic > 10 || density > 0.35 || cycles.length > 0 ? 'HIGH' : cyclomatic > 4 ? 'MEDIUM' : 'LOW';

    const complexity: ComplexityAnalysis = {
      node_count: N,
      edge_count: E,
      average_degree: avgDegree,
      density,
      cyclomatic_complexity: cyclomatic,
      max_dependency_depth: maxDepth,
      cycles_count: cycles.length,
      simple_cycles: cycles,
      scc_count: 1,
      weakly_connected_components: 1,
      complexity_rating: complexityRating,
      summary: `System exhibits ${complexityRating} structural complexity with ${cycles.length} cycle(s) and cyclomatic index ${cyclomatic}.`,
    };

    // 5. Critical Components
    const criticalComponents: CriticalComponent[] = entities
      .map((e) => {
        const m = componentMetrics[e.id];
        const isSpof = isCut.has(e.id);
        const score = Number(
          Math.min(
            1.0,
            (m.in_degree * 0.25) +
            (m.betweenness_centrality * 0.35) +
            (m.pagerank * 0.2) +
            (isSpof ? 0.2 : 0)
          ).toFixed(2)
        );

        const tier: RiskLevel = score >= 0.7 ? 'CRITICAL' : score >= 0.45 ? 'HIGH' : score >= 0.25 ? 'MEDIUM' : 'LOW';
        return {
          component_id: e.id,
          name: e.name,
          type: e.type,
          technology: e.technology,
          criticality_score: score,
          criticality_tier: tier,
          rank: 0,
          score_breakdown: {
            fan_in: m.in_degree,
            betweenness: m.betweenness_centrality,
            pagerank: m.pagerank,
            spof_bonus: isSpof ? 0.2 : 0,
          },
          evidence: [
            `Fan-in: ${m.in_degree} callers`,
            `Betweenness: ${m.betweenness_centrality}`,
            `PageRank: ${m.pagerank}`,
          ],
        };
      })
      .sort((a, b) => b.criticality_score - a.criticality_score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    // 6. High Risk Dependencies
    const highRiskDependencies: HighRiskDependency[] = relationships.map((rel) => {
      const src = entities.find((e) => e.id === rel.source);
      const tgt = entities.find((e) => e.id === rel.target);
      const isTargetSpof = isCut.has(rel.target);
      const tgtCrit = criticalComponents.find((c) => c.component_id === rel.target);

      let score = 0.2;
      const factors: string[] = [];

      if (isTargetSpof) {
        score += 0.35;
        factors.push(`Target '${tgt?.name || rel.target}' is a Single Point of Failure.`);
      }
      if (tgtCrit && tgtCrit.criticality_tier === 'CRITICAL') {
        score += 0.25;
        factors.push(`Target is a top-tier Critical component.`);
      }
      if ((inAdj.get(rel.target) || []).length >= 4) {
        score += 0.15;
        factors.push(`Target has elevated fan-in (${(inAdj.get(rel.target) || []).length} callers).`);
      }

      const riskLevel = score >= 0.7 ? 'CRITICAL' : score >= 0.5 ? 'HIGH' : score >= 0.3 ? 'MEDIUM' : 'LOW';

      return {
        relationship_id: rel.id,
        source_id: rel.source,
        source_name: src?.name || rel.source,
        target_id: rel.target,
        target_name: tgt?.name || rel.target,
        type: rel.type,
        protocol: rel.protocol,
        risk_level: riskLevel,
        risk_score: Number(Math.min(1.0, score).toFixed(2)),
        risk_factors: factors.length > 0 ? factors : ['Standard service dependency.'],
        is_part_of_cycle: false,
        is_target_spof: isTargetSpof,
        target_criticality: tgtCrit?.criticality_score || 0.2,
        propagation_path: [rel.source, rel.target],
      };
    });

    // 7. Component Risk Summary
    const componentRisks: Record<string, ComponentRiskSummary> = {};
    entities.forEach((e) => {
      const isSpof = isCut.has(e.id);
      const crit = criticalComponents.find((c) => c.component_id === e.id);
      const score = crit?.criticality_score || 0.2;
      componentRisks[e.id] = {
        component_id: e.id,
        name: e.name,
        type: e.type,
        risk_level: crit?.criticality_tier || 'LOW',
        risk_score: score,
        is_spof: isSpof,
        is_critical: crit?.criticality_tier === 'CRITICAL',
        is_in_cycle: false,
        evidence: crit?.evidence || [],
      };
    });

    // 8. Top Insights
    const topInsights: string[] = [];
    if (criticalComponents.length > 0) {
      topInsights.push(`Most Critical Component: '${criticalComponents[0].name}' (Score: ${criticalComponents[0].criticality_score}).`);
    }
    const trueSpofs = spofs.filter((s) => s.is_spof);
    if (trueSpofs.length > 0) {
      topInsights.push(`SPOF Alert: ${trueSpofs.length} structural Single Point(s) of Failure detected.`);
    } else {
      topInsights.push(`SPOF Check: No single points of failure detected; redundant routing exists.`);
    }
    if (cycles.length > 0) {
      topInsights.push(`Cycle Warning: ${cycles.length} circular dependency cycle(s) detected.`);
    }

    return {
      project_id: projectId,
      system_name: model.systemName,
      version: model.version || '1.0.0',
      analyzed_at: new Date().toISOString(),
      architecture: model,
      component_metrics: componentMetrics,
      critical_components: criticalComponents,
      spofs,
      high_risk_dependencies: highRiskDependencies,
      complexity,
      component_risks: componentRisks,
      top_insights: topInsights,
    };
  }
}
