import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  RelationshipType,
  DiffNodeItem,
  DiffRelationshipItem,
} from '../types/architecture';

export interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

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
  selectedTypeFilter: EntityType | 'ALL';
  selectedRelFilter: RelationshipType | 'ALL';
  searchTerm: string;
  diffMode?: boolean;
  diffNodesMap?: Map<string, DiffNodeItem>;
  diffEdgesMap?: Map<string, DiffRelationshipItem>;
}

export const NODE_DIMENSIONS: Record<EntityType, { width: number; height: number }> = {
  'Service': { width: 260, height: 105 },
  'Application': { width: 260, height: 105 },
  'API': { width: 240, height: 95 },
  'Database': { width: 250, height: 105 },
  'Module': { width: 230, height: 90 },
  'Library': { width: 220, height: 85 },
  'External System': { width: 250, height: 95 },
};

const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  CALLS: '#2563eb',       // Blue
  DEPENDS_ON: '#7c3aed',  // Purple
  USES: '#059669',        // Emerald green
  CONNECTS_TO: '#d97706', // Amber
  IMPORTS: '#6366f1',     // Indigo
  QUERIES: '#0891b2',     // Cyan
  LOADS: '#d97706',       // Amber
  EXPOSES: '#0284c7',     // Sky
  CONTAINS: '#64748b',    // Slate
};

/**
 * Computes architectural tiers dynamically for any system topology.
 * Tiers flow from Entry/Client -> Gateway -> Domain Services -> Downstream -> Databases & External APIs.
 */
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

  // Sinks: Databases and External Systems belong in the rightmost/bottom tier
  const nonSinks = entities.filter(
    (e) => e.type !== 'Database' && e.type !== 'External System'
  );

  // Identify entry points (Applications, in-degree 0, or frontend/client in name)
  const entryPoints = nonSinks.filter((e) => {
    const parents = revAdj.get(e.id) || [];
    const idLower = e.id.toLowerCase();
    const nameLower = e.name.toLowerCase();
    return (
      e.type === 'Application' ||
      parents.length === 0 ||
      idLower.includes('frontend') ||
      idLower.includes('client') ||
      idLower.includes('extension') ||
      idLower.includes('ui') ||
      nameLower.includes('frontend') ||
      nameLower.includes('client')
    );
  });

  if (entryPoints.length === 0 && nonSinks.length > 0) {
    entryPoints.push(nonSinks[0]);
  }

  // BFS / Topological depth calculation for services
  entryPoints.forEach((ep) => levelMap.set(ep.id, 0));

  const queue = [...entryPoints.map((e) => e.id)];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLevel = levelMap.get(curr) || 0;
    const children = adj.get(curr) || [];

    children.forEach((childId) => {
      const child = entities.find((e) => e.id === childId);
      if (child && child.type !== 'Database' && child.type !== 'External System') {
        const existingLevel = levelMap.get(childId);
        if (existingLevel === undefined || existingLevel < currLevel + 1) {
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

/**
 * Computes topological coordinates for ALL entities and relationships.
 * Produces a balanced, centered, Left-to-Right architectural layout (or Top-to-Bottom).
 * Node positions remain 100% FIXED during user interactions (search, filter, selection).
 */
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

  // Group nodes by tier
  const tierGroups = new Map<number, ArchitectureEntity[]>();
  entities.forEach((e) => {
    const t = tierMap.get(e.id) || 0;
    if (!tierGroups.has(t)) tierGroups.set(t, []);
    tierGroups.get(t)?.push(e);
  });

  const nodeW = 260;
  const nodeH = 105;
  const rankGap = isLR ? 150 : 130;
  const nodeGap = isLR ? 45 : 60;

  // Find max nodes in any tier to calculate canvas bounding box
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

/**
 * Decorates the base layout with visual highlighting, dimming, and selection states.
 * Reuses the EXACT base positions without any spatial movement.
 * Three-tier hierarchy: selected = 100%, connected = 95%, unrelated = 50% (never hidden).
 */
export function decorateGraphVisuals(
  baseLayout: BaseGraphLayout,
  visualState: VisualStateOptions
): GraphData {
  const { positions, direction, entities, relationships } = baseLayout;
  const {
    selectedNodeId,
    selectedEdgeId,
    selectedTypeFilter,
    selectedRelFilter,
    searchTerm,
    diffMode = false,
    diffNodesMap,
    diffEdgesMap,
  } = visualState;

  const cleanSearch = searchTerm.trim().toLowerCase();
  const isSearchActive = cleanSearch.length > 0;
  const isTypeFilterActive = selectedTypeFilter !== 'ALL';
  const isRelFilterActive = selectedRelFilter !== 'ALL';
  const isNodeSelected = selectedNodeId !== null;
  const isEdgeSelected = !!selectedEdgeId;

  // 1. Identify directly connected neighbor nodes & edges for selected node
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

  // If an edge is selected, identify its incident nodes
  if (selectedEdgeId) {
    const activeRel = relationships.find((r) => r.id === selectedEdgeId);
    if (activeRel) {
      selectedNeighbors.add(activeRel.source);
      selectedNeighbors.add(activeRel.target);
      selectedEdges.add(activeRel.id);
    }
  }

  // 2. Identify nodes incident to matching relationship filter
  const matchingRelNodeIds = new Set<string>();
  if (isRelFilterActive) {
    relationships.forEach((rel) => {
      if (rel.type === selectedRelFilter) {
        matchingRelNodeIds.add(rel.source);
        matchingRelNodeIds.add(rel.target);
      }
    });
  }

  // 3. Map entities to React Flow Node objects
  const nodeTypeMap: Record<EntityType, string> = {
    'Service': 'serviceNode',
    'Application': 'serviceNode',
    'API': 'apiNode',
    'Database': 'databaseNode',
    'Module': 'moduleNode',
    'Library': 'libraryNode',
    'External System': 'externalNode',
  };

  const nodes: Node[] = entities.map((entity) => {
    const pos = positions.get(entity.id) || {
      x: 0,
      y: 0,
      width: 250,
      height: 100,
    };

    const isSelected = selectedNodeId === entity.id;
    const isConnected =
      (isNodeSelected || isEdgeSelected) &&
      !isSelected &&
      selectedNeighbors.has(entity.id);

    // Check search match
    const isSearchMatch = isSearchActive
      ? entity.name.toLowerCase().includes(cleanSearch) ||
        entity.technology.toLowerCase().includes(cleanSearch) ||
        entity.id.toLowerCase().includes(cleanSearch)
      : true;

    // Check type filter match
    const isTypeMatch = isTypeFilterActive ? entity.type === selectedTypeFilter : true;

    // Check relationship filter match
    const isRelMatch = isRelFilterActive ? matchingRelNodeIds.has(entity.id) : true;

    // Check neighbor connected match if a node or edge is selected
    const isNeighborMatch = isNodeSelected || isEdgeSelected
      ? selectedNeighbors.has(entity.id)
      : true;

    // Node is dimmed if it fails any active visual criterion
    const isDimmed = !isSearchMatch || !isTypeMatch || !isRelMatch || !isNeighborMatch;

    // Check incoming & outgoing connections
    const incomingCount = relationships.filter((r) => r.target === entity.id).length;
    const outgoingCount = relationships.filter((r) => r.source === entity.id).length;

    // Check diff metadata if in diff mode
    const diffNode = diffMode && diffNodesMap ? diffNodesMap.get(entity.id.toLowerCase().trim()) : undefined;
    const diffChangeType = diffNode?.changeType;
    const versionOrigin = diffNode?.versionOrigin;

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
        incomingCount,
        outgoingCount,
        direction,
        diffMode: !!diffMode,
        diffChangeType,
        versionOrigin,
      },
    };
  });

  // 4. Map relationships to React Flow Edge objects
  const edges: Edge[] = relationships.map((rel) => {
    const relKey = `${rel.source.toLowerCase().trim()}->${rel.target.toLowerCase().trim()}:${rel.type}`;
    const diffRel = diffMode && diffEdgesMap ? diffEdgesMap.get(relKey) : undefined;
    const diffChangeType = diffRel?.changeType;

    let edgeColor = RELATIONSHIP_COLORS[rel.type] || '#64748b';
    let strokeWidth = 1.75;
    let strokeDasharray: string | undefined = undefined;
    let opacity = 1;
    let isAnimated = rel.type === 'CALLS';

    if (diffMode && diffChangeType) {
      if (diffChangeType === 'added') {
        edgeColor = '#059669'; // Emerald 600
        strokeWidth = 3;
        isAnimated = true;
      } else if (diffChangeType === 'removed') {
        edgeColor = '#e11d48'; // Rose 600
        strokeWidth = 2.25;
        strokeDasharray = '6 4';
        opacity = 0.7;
        isAnimated = false;
      } else {
        // unchanged in diff mode: muted clean appearance
        edgeColor = '#94a3b8';
        opacity = 0.65;
        isAnimated = false;
      }
    }

    let isHighlighted = false;
    let isDimmed = false;

    if (isNodeSelected || isEdgeSelected) {
      if (selectedEdges.has(rel.id)) {
        isHighlighted = true;
        strokeWidth = Math.max(strokeWidth + 1.5, 3.5);
        opacity = 1;
      } else {
        isDimmed = true;
        opacity = 0.35;
      }
    } else if (isRelFilterActive) {
      if (rel.type === selectedRelFilter) {
        isHighlighted = true;
        strokeWidth = Math.max(strokeWidth + 1.5, 3.5);
        opacity = 1;
      } else {
        isDimmed = true;
        opacity = 0.35;
      }
    } else if (isTypeFilterActive || isSearchActive) {
      const sourceNode = nodes.find((n) => n.id === rel.source);
      const targetNode = nodes.find((n) => n.id === rel.target);
      if (sourceNode?.data.isDimmed || targetNode?.data.isDimmed) {
        isDimmed = true;
        opacity = 0.35;
      }
    }

    if (isDimmed) {
      isAnimated = false;
    }

    return {
      id: rel.id,
      source: rel.source,
      target: rel.target,
      type: 'typedEdge',
      animated: isAnimated,
      data: {
        relationship: rel,
        isHighlighted,
        isDimmed,
        color: edgeColor,
        diffMode: !!diffMode,
        diffChangeType,
        diffRel,
      },
      style: {
        stroke: edgeColor,
        strokeWidth,
        strokeDasharray,
        opacity,
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

/**
 * Legacy wrapper for backward compatibility with existing tests
 */
export function calculateGraphLayout(
  entities: ArchitectureEntity[],
  relationships: ArchitectureRelationship[],
  options: LayoutOptions = {},
  selectedNodeId: string | null = null
): GraphData {
  const direction = options.direction || 'LR';
  const base = computeBaseGraphLayout(entities, relationships, direction);
  return decorateGraphVisuals(base, {
    selectedNodeId,
    selectedTypeFilter: 'ALL',
    selectedRelFilter: 'ALL',
    searchTerm: '',
  });
}
