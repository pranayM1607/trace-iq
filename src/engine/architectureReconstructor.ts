import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
  ArchitectureStats,
  CodebaseInventory,
  CodebaseGraph,
  InputIdentity,
} from '../types/architecture';

export interface ReconstructionInput {
  systemName: string;
  version?: string;
  inputType: 'blueprint' | 'codebase' | 'demo';
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  sourceArtifacts?: string[];
  inventory?: CodebaseInventory;
  codebaseGraph?: CodebaseGraph;
  isLimitedArchitecture?: boolean;
  limitedArchitectureReason?: string;
  inputIdentity?: InputIdentity;
  originalJsonPayload?: any;
  rawJsonString?: string;
  scope?: 'complete' | 'partial';
}

export function reconstructArchitecture(input: ReconstructionInput): ArchitectureModel {
  const {
    systemName,
    version = '1.0.0',
    inputType,
    sourceArtifacts = [],
    inventory,
    codebaseGraph,
    isLimitedArchitecture = false,
    limitedArchitectureReason,
    inputIdentity,
    originalJsonPayload,
    rawJsonString,
    scope,
  } = input;

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
      if (existing.technology === 'Generic' && entity.technology) {
        existing.technology = entity.technology;
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
            method: 'Architecture Linker',
            confidence: 'HIGH',
          },
          description: rel.description || `${rel.source} ${rel.type} ${rel.target}`,
        });
      }
    }
  });

  // Calculate statistics (strictly Objective 1 reconstruction metrics)
  const stats: ArchitectureStats = {
    services: normalizedEntities.filter((e) => e.type === 'Service' || e.type === 'Application').length,
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

  // Synthesize default blueprint inventory if none was provided
  const finalInventory: CodebaseInventory = inventory || {
    total_files: 1,
    total_folders: 1,
    total_lines: 50,
    languages: { JSON: 1 },
    frameworks: [],
    categories_breakdown: { manifest: 1 },
    manifests: ['blueprint.json'],
    config_files: [],
    modules: [],
    packages: [],
    libraries: [],
    endpoints_count: stats.apis,
    datastores_count: stats.databases,
    external_integrations_count: stats.externalSystems,
    files: [
      {
        path: 'blueprint.json',
        name: 'blueprint.json',
        category: 'manifest',
        extension: '.json',
        size_bytes: 2048,
        lines_count: 50,
        language: 'JSON',
        analysis_status: 'Analyzed — architecture blueprint',
      },
    ],
    folders: ['root'],
    file_dependencies: [],
    external_dependencies: [],
    detection_summary: `Reconstructed ${normalizedEntities.length} architecture entities and ${normalizedRelationships.length} relationships from blueprint specification.`,
    is_limited_architecture: isLimitedArchitecture,
    limited_architecture_reason: limitedArchitectureReason,
  };

  const resolvedScope = scope || (isLimitedArchitecture && finalInventory.total_files <= 3 ? 'partial' : 'complete');

  const resolvedIdentity: InputIdentity = inputIdentity || {
    id: `input_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    filename: sourceArtifacts[0] || `${systemName.toLowerCase().replace(/\s+/g, '_')}_spec`,
    inputType,
    uploadedAt: new Date().toISOString(),
    filesCount: finalInventory.total_files,
    foldersCount: finalInventory.total_folders,
    scope: resolvedScope,
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
    inventory: finalInventory,
    codebaseGraph,
    isLimitedArchitecture,
    limitedArchitectureReason,
    inputIdentity: resolvedIdentity,
    originalJsonPayload,
    rawJsonString,
    scope: resolvedScope,
  };
}
