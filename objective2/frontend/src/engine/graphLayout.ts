import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  RiskLevel,
  Objective2AnalysisResult,
} from '../types/analysis';

export interface BaseNodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseGraphLayout {
  positions: Map<string, BaseNodePosition>;
  direction: 'LR' | 'TB';
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface VisualStateOptions {
  selectedNodeId: string | null;
  selectedEdgeId?: string | null;
  riskFilter: 'ALL' | RiskLevel | 'SPOF' | 'CYCLE';
  typeFilter: 'ALL' | EntityType;
  searchTerm: string;
  analysis?: Objective2AnalysisResult | null;
  highlightedPathNodes?: Set<string> | null;
  highlightedPathEdges?: Set<string> | null;
}

export const NODE_DIMENSIONS: Record<EntityType, { width: number; height: number }> = {
  'Service': { width: 220, height: 76 },
  'API': { width: 210, height: 76 },
  'Database': { width: 220, height: 76 },
  'Module': { width: 210, height: 74 },
  'Library': { width: 200, height: 70 },
  'External System': { width: 220, height: 76 },
  'Application': { width: 230, height: 80 },
  'Queue': { width: 220, height: 76 },
  'Package': { width: 210, height: 74 },
  'Worker': { width: 210, height: 76 },
  'Infrastructure': { width: 220, height: 76 },
};

function computeArchitecturalTiers(
  entities: ArchitectureEntity[],
  relationships: ArchitectureRelationship[]
): Map<string, number> {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();

  entities.forEach((e) => {
    inDegree.set(e.id, 0);
    outDegree.set(e.id, 0);
    adj.set(e.id, []);
    revAdj.set(e.id, []);
  });

  relationships.forEach((r) => {
    if (inDegree.has(r.target)) inDegree.set(r.target, (inDegree.get(r.target) || 0) + 1);
    if (outDegree.has(r.source)) outDegree.set(r.source, (outDegree.get(r.source) || 0) + 1);
    if (adj.has(r.source)) adj.get(r.source)?.push(r.target);
    if (revAdj.has(r.target)) revAdj.get(r.target)?.push(r.source);
  });

  const levelMap = new Map<string, number>();

  // Sinks: Databases and External Systems belong in the rightmost tier
  const nonSinks = entities.filter(
    (e) => e.type !== 'Database' && e.type !== 'External System'
  );

  // Identify entry points (in-degree 0 or client/frontend in name/id)
  const entryPoints = nonSinks.filter((e) => {
    const parents = revAdj.get(e.id) || [];
    const idLower = e.id.toLowerCase();
    const nameLower = e.name.toLowerCase();
    return (
      parents.length === 0 ||
      idLower.includes('client') ||
      idLower.includes('frontend') ||
      idLower.includes('app') ||
      nameLower.includes('client') ||
      nameLower.includes('frontend')
    );
  });

  if (entryPoints.length === 0 && nonSinks.length > 0) {
    entryPoints.push(nonSinks[0]);
  }

  // BFS / Topological tier calculation with cycle protection
  const visited = new Set<string>();
  entryPoints.forEach((ep) => {
    levelMap.set(ep.id, 0);
    visited.add(ep.id);
  });

  const queue = [...entryPoints.map((e) => e.id)];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLevel = levelMap.get(curr) || 0;
    const children = adj.get(curr) || [];

    children.forEach((childId) => {
      const child = entities.find((e) => e.id === childId);
      if (child && child.type !== 'Database' && child.type !== 'External System') {
        if (!visited.has(childId)) {
          visited.add(childId);
          levelMap.set(childId, currLevel + 1);
          queue.push(childId);
        }
      }
    });
  }

  // Catch any disconnected non-sinks
  nonSinks.forEach((e) => {
    if (!levelMap.has(e.id)) {
      levelMap.set(e.id, 1);
    }
  });

  let maxServiceLevel = 0;
  levelMap.forEach((lvl) => {
    if (lvl > maxServiceLevel) maxServiceLevel = lvl;
  });

  // Assign rightmost tier to Databases & External Systems
  const sinkTier = maxServiceLevel + 1;
  entities.forEach((e) => {
    if (e.type === 'Database' || e.type === 'External System') {
      levelMap.set(e.id, sinkTier);
    }
  });

  return levelMap;
}

export function computeBaseGraphLayout(
  entities: ArchitectureEntity[],
  relationships: ArchitectureRelationship[],
  direction: 'LR' | 'TB' = 'LR'
): BaseGraphLayout {
  if (entities.length === 0) {
    return {
      positions: new Map(),
      direction,
      entities,
      relationships,
      canvasWidth: 0,
      canvasHeight: 0,
    };
  }

  const isLR = direction === 'LR';
  const tierMap = computeArchitecturalTiers(entities, relationships);

  const tierGroups = new Map<number, ArchitectureEntity[]>();
  entities.forEach((e) => {
    const t = tierMap.get(e.id) || 0;
    if (!tierGroups.has(t)) tierGroups.set(t, []);
    tierGroups.get(t)?.push(e);
  });

  const nodeW = 220;
  const nodeH = 76;
  const rankGap = isLR ? 130 : 100;
  const nodeGap = isLR ? 34 : 44;

  let maxNodesInAnyTier = 0;
  tierGroups.forEach((nodes) => {
    if (nodes.length > maxNodesInAnyTier) maxNodesInAnyTier = nodes.length;
  });

  const maxCrossDim =
    maxNodesInAnyTier * (isLR ? nodeH : nodeW) + (maxNodesInAnyTier - 1) * nodeGap;

  const positions = new Map<string, BaseNodePosition>();

  const sortedTierIndices = [...tierGroups.keys()].sort((a, b) => a - b);
  const totalTiers = sortedTierIndices.length;

  sortedTierIndices.forEach((tierIdx) => {
    const nodes = tierGroups.get(tierIdx) || [];
    const tierCrossDim =
      nodes.length * (isLR ? nodeH : nodeW) + (nodes.length - 1) * nodeGap;
    const crossOffset = Math.max(0, (maxCrossDim - tierCrossDim) / 2);

    const rankPos = tierIdx * ((isLR ? nodeW : nodeH) + rankGap);

    nodes.forEach((node, idx) => {
      const dim = NODE_DIMENSIONS[node.type] || { width: nodeW, height: nodeH };
      const crossPos = crossOffset + idx * ((isLR ? nodeH : nodeW) + nodeGap);

      if (isLR) {
        positions.set(node.id, {
          x: rankPos,
          y: crossPos,
          width: dim.width,
          height: dim.height,
        });
      } else {
        positions.set(node.id, {
          x: crossPos,
          y: rankPos,
          width: dim.width,
          height: dim.height,
        });
      }
    });
  });

  const canvasWidth = isLR
    ? totalTiers * nodeW + (totalTiers - 1) * rankGap
    : maxCrossDim;
  const canvasHeight = isLR
    ? maxCrossDim
    : totalTiers * nodeH + (totalTiers - 1) * rankGap;

  return {
    positions,
    direction,
    entities,
    relationships,
    canvasWidth,
    canvasHeight,
  };
}

export function decorateGraphVisuals(
  baseLayout: BaseGraphLayout,
  visualState: VisualStateOptions
): GraphData {
  const { positions, direction, entities, relationships } = baseLayout;
  const {
    selectedNodeId,
    selectedEdgeId,
    riskFilter,
    typeFilter,
    searchTerm,
    analysis,
    highlightedPathNodes,
    highlightedPathEdges,
  } = visualState;

  const isPathHighlightActive =
    (highlightedPathNodes && highlightedPathNodes.size > 0) ||
    (highlightedPathEdges && highlightedPathEdges.size > 0);

  const cleanSearch = searchTerm.trim().toLowerCase();
  const isSearchActive = cleanSearch.length > 0;
  const isTypeFilterActive = typeFilter !== 'ALL';
  const isRiskFilterActive = riskFilter !== 'ALL';
  const isNodeSelected = selectedNodeId !== null;
  const isEdgeSelected = !!selectedEdgeId;

  // Pre-index analysis lookups
  const spofMap = new Map<string, boolean>();
  const critMap = new Map<string, RiskLevel>();
  const metricsMap = analysis?.component_metrics || {};
  const cycleNodes = new Set<string>();

  if (analysis) {
    analysis.spofs.forEach((s) => spofMap.set(s.component_id, s.is_spof));
    analysis.critical_components.forEach((c) => critMap.set(c.component_id, c.criticality_tier));
    analysis.complexity.simple_cycles.forEach((cycle) => {
      cycle.forEach((node) => cycleNodes.add(node));
    });
  }

  // Incident neighbors for selected node / edge
  const selectedNeighbors = new Set<string>();
  const selectedEdges = new Set<string>();

  if (selectedNodeId) {
    selectedNeighbors.add(selectedNodeId);
    relationships.forEach((rel) => {
      if (rel.source === selectedNodeId) {
        selectedNeighbors.add(rel.target);
        selectedEdges.add(rel.id);
      }
      if (rel.target === selectedNodeId) {
        selectedNeighbors.add(rel.source);
        selectedEdges.add(rel.id);
      }
    });
  }

  if (selectedEdgeId) {
    const activeRel = relationships.find((r) => r.id === selectedEdgeId);
    if (activeRel) {
      selectedNeighbors.add(activeRel.source);
      selectedNeighbors.add(activeRel.target);
      selectedEdges.add(activeRel.id);
    }
  }

  const nodeTypeMap: Record<EntityType, string> = {
    'Service': 'serviceNode',
    'API': 'apiNode',
    'Database': 'databaseNode',
    'Module': 'serviceNode',
    'Library': 'serviceNode',
    'External System': 'externalNode',
    'Application': 'serviceNode',
    'Queue': 'databaseNode',
    'Package': 'serviceNode',
    'Worker': 'serviceNode',
    'Infrastructure': 'externalNode',
  };

  const nodes: Node[] = entities.map((entity) => {
    const pos = positions.get(entity.id) || {
      x: 0,
      y: 0,
      width: 220,
      height: 76,
    };

    const isSelected = selectedNodeId === entity.id;
    const isPathNode = isPathHighlightActive && !!highlightedPathNodes?.has(entity.id);
    const isConnected =
      isPathNode ||
      ((isNodeSelected || isEdgeSelected) &&
      !isSelected &&
      selectedNeighbors.has(entity.id));

    const isSpof = spofMap.get(entity.id) || false;
    const critTier = critMap.get(entity.id) || 'LOW';
    const isInCycle = cycleNodes.has(entity.id);
    const metrics = metricsMap[entity.id];

    // Filter checks
    const isSearchMatch = isSearchActive
      ? entity.name.toLowerCase().includes(cleanSearch) ||
        entity.technology.toLowerCase().includes(cleanSearch) ||
        entity.id.toLowerCase().includes(cleanSearch)
      : true;

    const isTypeMatch = isTypeFilterActive ? entity.type === typeFilter : true;

    let isRiskMatch = true;
    if (isRiskFilterActive) {
      if (riskFilter === 'SPOF') {
        isRiskMatch = isSpof;
      } else if (riskFilter === 'CYCLE') {
        isRiskMatch = isInCycle;
      } else {
        isRiskMatch = critTier === riskFilter;
      }
    }

    const isNeighborMatch = isNodeSelected || isEdgeSelected
      ? selectedNeighbors.has(entity.id)
      : true;

    const isDimmed = isPathHighlightActive
      ? !isPathNode
      : (!isSearchMatch || !isTypeMatch || !isRiskMatch || !isNeighborMatch);

    return {
      id: entity.id,
      type: nodeTypeMap[entity.type] || 'serviceNode',
      position: { x: pos.x, y: pos.y },
      width: pos.width,
      height: pos.height,
      initialWidth: pos.width,
      initialHeight: pos.height,
      style: { width: pos.width, height: pos.height },
      data: {
        entity,
        isSelected,
        isConnected,
        isDimmed,
        isSpof,
        critTier,
        isInCycle,
        metrics,
        direction,
      },
    };
  });

  const highRiskDepMap = new Map<string, RiskLevel>();
  if (analysis) {
    analysis.high_risk_dependencies.forEach((d) => {
      highRiskDepMap.set(d.relationship_id, d.risk_level);
    });
  }

  const edges: Edge[] = relationships.map((rel) => {
    const riskLvl = highRiskDepMap.get(rel.id) || 'LOW';
    const isPathEdge = isPathHighlightActive && !!highlightedPathEdges?.has(rel.id);

    let edgeColor = '#64748b';
    if (isPathEdge) edgeColor = '#e11d48'; // bold rose for severed SPOF path
    else if (riskLvl === 'CRITICAL') edgeColor = '#ef4444';
    else if (riskLvl === 'HIGH') edgeColor = '#f97316';
    else if (riskLvl === 'MEDIUM') edgeColor = '#eab308';
    else if (rel.type === 'CALLS') edgeColor = '#3b82f6';
    else if (rel.type === 'USES') edgeColor = '#10b981';

    let isHighlighted = false;
    let isDimmed = false;

    if (isPathHighlightActive) {
      if (isPathEdge) {
        isHighlighted = true;
      } else {
        isDimmed = true;
      }
    } else if (isNodeSelected || isEdgeSelected) {
      if (selectedEdges.has(rel.id)) {
        isHighlighted = true;
      } else {
        isDimmed = true;
      }
    } else if (isRiskFilterActive) {
      if (riskFilter === 'CRITICAL' && riskLvl === 'CRITICAL') isHighlighted = true;
      else if (riskFilter === 'HIGH' && (riskLvl === 'HIGH' || riskLvl === 'CRITICAL')) isHighlighted = true;
      else isDimmed = true;
    } else if (isTypeFilterActive || isSearchActive) {
      const src = nodes.find((n) => n.id === rel.source);
      const tgt = nodes.find((n) => n.id === rel.target);
      if (src?.data.isDimmed || tgt?.data.isDimmed) {
        isDimmed = true;
      }
    }

    return {
      id: rel.id,
      source: rel.source,
      target: rel.target,
      type: 'typedRiskEdge',
      animated: ((isPathEdge || riskLvl === 'CRITICAL' || riskLvl === 'HIGH') && !isDimmed),
      data: {
        relationship: rel,
        riskLevel: riskLvl,
        isHighlighted,
        isDimmed,
        color: edgeColor,
      },
      style: {
        stroke: edgeColor,
        strokeWidth: isHighlighted ? 3.5 : (riskLvl === 'CRITICAL' || riskLvl === 'HIGH' ? 2.5 : 1.75),
        opacity: isDimmed ? (isPathHighlightActive ? 0.18 : 0.35) : 1,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
        width: 18,
        height: 18,
      },
    };
  });

  return { nodes, edges };
}
