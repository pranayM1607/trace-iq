import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  BlueprintJSON,
  EntityType,
  RelationshipType,
  ValidationIssue,
} from '../types/architecture';

const VALID_ENTITY_TYPES: EntityType[] = [
  'Service',
  'API',
  'Database',
  'Module',
  'Library',
  'External System',
];

const VALID_RELATIONSHIP_TYPES: RelationshipType[] = [
  'CALLS',
  'DEPENDS_ON',
  'USES',
  'CONNECTS_TO',
];

export interface BlueprintParseResult {
  success: boolean;
  systemName: string;
  version?: string;
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  issues: ValidationIssue[];
}

export function parseAndValidateBlueprint(jsonString: string): BlueprintParseResult {
  const issues: ValidationIssue[] = [];
  let parsed: BlueprintJSON;

  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      success: false,
      systemName: 'Unknown System',
      entities: [],
      relationships: [],
      issues: [
        {
          type: 'error',
          message: `JSON Syntax Error: ${err.message || 'Invalid JSON syntax'}`,
        },
      ],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      systemName: 'Invalid Blueprint',
      entities: [],
      relationships: [],
      issues: [
        {
          type: 'error',
          message: 'Root of blueprint must be a JSON object containing services/entities and relationships arrays.',
        },
      ],
    };
  }

  const systemName = parsed.systemName || 'Reconstructed Architecture';
  const version = parsed.version || '1.0.0';

  const rawEntities = parsed.entities || parsed.services || [];
  if (!Array.isArray(rawEntities)) {
    issues.push({
      type: 'error',
      field: 'entities',
      message: '"entities" or "services" property must be an array.',
    });
  }

  const rawRelationships = parsed.relationships || [];
  if (!Array.isArray(rawRelationships)) {
    issues.push({
      type: 'error',
      field: 'relationships',
      message: '"relationships" property must be an array.',
    });
  }

  const entities: ArchitectureEntity[] = [];
  const entityIdMap = new Map<string, ArchitectureEntity>();

  // Process entities
  if (Array.isArray(rawEntities)) {
    rawEntities.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        issues.push({
          type: 'error',
          field: `entities[${index}]`,
          message: `Entity at index ${index} must be an object.`,
        });
        return;
      }

      const id = String(item.id || '').trim();
      const name = String(item.name || '').trim();

      if (!id) {
        issues.push({
          type: 'error',
          field: `entities[${index}].id`,
          message: `Entity at index ${index} is missing required field "id".`,
        });
        return;
      }

      if (entityIdMap.has(id)) {
        issues.push({
          type: 'error',
          field: `entities[${index}].id`,
          entityId: id,
          message: `Duplicate entity ID detected: "${id}". Entity IDs must be unique.`,
        });
        return;
      }

      let type = item.type as EntityType;
      if (!type || !VALID_ENTITY_TYPES.includes(type)) {
        issues.push({
          type: 'warning',
          field: `entities[${index}].type`,
          entityId: id,
          message: `Unrecognized or missing entity type "${item.type}" for "${id}". Defaulting to "Service". Valid types are: ${VALID_ENTITY_TYPES.join(', ')}`,
        });
        type = 'Service';
      }

      const entity: ArchitectureEntity = {
        id,
        name: name || id,
        type,
        technology: item.technology || 'Generic / Undefined',
        source: 'User-provided',
        description: item.description || `${type} component in ${systemName}`,
        metadata: {
          filePath: 'blueprint.json',
          ...(item.metadata || {}),
        },
      };

      entities.push(entity);
      entityIdMap.set(id, entity);
    });
  }

  const relationships: ArchitectureRelationship[] = [];

  // Process relationships
  if (Array.isArray(rawRelationships)) {
    rawRelationships.forEach((rel, index) => {
      if (!rel || typeof rel !== 'object') {
        issues.push({
          type: 'error',
          field: `relationships[${index}]`,
          message: `Relationship at index ${index} must be an object.`,
        });
        return;
      }

      const source = String(rel.source || '').trim();
      const target = String(rel.target || '').trim();

      if (!source) {
        issues.push({
          type: 'error',
          field: `relationships[${index}].source`,
          message: `Relationship at index ${index} is missing "source" entity ID.`,
        });
        return;
      }

      if (!target) {
        issues.push({
          type: 'error',
          field: `relationships[${index}].target`,
          message: `Relationship at index ${index} is missing "target" entity ID.`,
        });
        return;
      }

      if (!entityIdMap.has(source)) {
        issues.push({
          type: 'error',
          field: `relationships[${index}].source`,
          message: `Relationship source "${source}" references an undefined entity ID.`,
        });
        return;
      }

      if (!entityIdMap.has(target)) {
        issues.push({
          type: 'error',
          field: `relationships[${index}].target`,
          message: `Relationship target "${target}" references an undefined entity ID.`,
        });
        return;
      }

      let type = rel.type as RelationshipType;
      if (!type || !VALID_RELATIONSHIP_TYPES.includes(type)) {
        issues.push({
          type: 'warning',
          field: `relationships[${index}].type`,
          message: `Unrecognized relationship type "${rel.type}" between "${source}" and "${target}". Defaulting to "CALLS". Valid types: ${VALID_RELATIONSHIP_TYPES.join(', ')}`,
        });
        type = 'CALLS';
      }

      const relId = rel.id || `rel-${source}-${target}-${index}`;

      relationships.push({
        id: relId,
        source,
        target,
        type,
        protocol: rel.protocol || (type === 'CALLS' ? 'HTTP/REST' : type === 'USES' ? 'TCP/Driver' : 'Direct Link'),
        sourceEvidence: rel.sourceEvidence || {
          file: 'blueprint.json',
          description: `Blueprint relationship definition (${source} ${type} ${target})`,
        },
        description: rel.description || `${source} ${type} ${target}`,
      });
    });
  }

  const hasFatalErrors = issues.some((i) => i.type === 'error');

  return {
    success: !hasFatalErrors && entities.length > 0,
    systemName,
    version,
    entities,
    relationships,
    issues,
  };
}
