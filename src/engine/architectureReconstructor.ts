import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
  ArchitectureStats,
} from '../types/architecture';

export interface ReconstructionInput {
  systemName: string;
  version?: string;
  inputType: 'blueprint' | 'codebase' | 'demo';
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  sourceArtifacts?: string[];
}

export function reconstructArchitecture(input: ReconstructionInput): ArchitectureModel {
  const { systemName, version = '1.0.0', inputType, sourceArtifacts = [] } = input;

  // Deduplicate and normalize entities
  const entityMap = new Map<string, ArchitectureEntity>();
  input.entities.forEach((entity) => {
    if (!entityMap.has(entity.id)) {
      entityMap.set(entity.id, {
        ...entity,
        metadata: entity.metadata || {},
      });
    } else {
      // Merge
      const existing = entityMap.get(entity.id)!;
      existing.metadata = { ...existing.metadata, ...(entity.metadata || {}) };
      if (!existing.description && entity.description) {
        existing.description = entity.description;
      }
    }
  });

  const normalizedEntities = Array.from(entityMap.values());
  const validEntityIds = new Set(entityMap.keys());

  // Normalize and filter relationships to only valid entities
  const seenRels = new Set<string>();
  const normalizedRelationships: ArchitectureRelationship[] = [];

  input.relationships.forEach((rel, index) => {
    if (validEntityIds.has(rel.source) && validEntityIds.has(rel.target)) {
      const relKey = `${rel.source}->${rel.target}:${rel.type}`;
      if (!seenRels.has(relKey)) {
        seenRels.add(relKey);
        normalizedRelationships.push({
          id: rel.id || `rel-${index}-${rel.source}-${rel.target}`,
          source: rel.source,
          target: rel.target,
          type: rel.type,
          protocol: rel.protocol || 'Default Protocol',
          sourceEvidence: rel.sourceEvidence || {
            file: inputType === 'blueprint' ? 'blueprint.json' : 'extracted-manifest',
            description: `${rel.source} ${rel.type} ${rel.target}`,
          },
          description: rel.description || `${rel.source} ${rel.type} ${rel.target}`,
        });
      }
    }
  });

  // Calculate statistics (strictly Objective 1 reconstruction metrics)
  const stats: ArchitectureStats = {
    services: normalizedEntities.filter((e) => e.type === 'Service').length,
    apis: normalizedEntities.filter((e) => e.type === 'API').length,
    databases: normalizedEntities.filter((e) => e.type === 'Database').length,
    modules: normalizedEntities.filter((e) => e.type === 'Module').length,
    libraries: normalizedEntities.filter((e) => e.type === 'Library').length,
    externalSystems: normalizedEntities.filter((e) => e.type === 'External System').length,
    totalEntities: normalizedEntities.length,
    totalRelationships: normalizedRelationships.length,
    detectedCount: normalizedEntities.filter((e) => e.source === 'Detected').length,
    userProvidedCount: normalizedEntities.filter((e) => e.source === 'User-provided').length,
  };

  return {
    systemName,
    version,
    extractedAt: new Date().toISOString(),
    inputType,
    sourceArtifacts,
    entities: normalizedEntities,
    relationships: normalizedRelationships,
    stats,
  };
}
