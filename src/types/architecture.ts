export type EntityType =
  | 'Service'
  | 'API'
  | 'Database'
  | 'Module'
  | 'Library'
  | 'External System';

export type RelationshipType =
  | 'CALLS'
  | 'DEPENDS_ON'
  | 'USES'
  | 'CONNECTS_TO';

export type SourceType = 'Detected' | 'User-provided';

export interface SourceEvidence {
  file?: string;
  line?: number;
  snippet?: string;
  description?: string;
}

export interface ArchitectureEntity {
  id: string;
  name: string;
  type: EntityType;
  technology: string;
  source: SourceType;
  description?: string;
  metadata?: {
    runtime?: string;
    framework?: string;
    port?: number | string;
    endpoints?: string[];
    version?: string;
    filePath?: string;
    language?: string;
    packageManager?: string;
    dbType?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface ArchitectureRelationship {
  id: string;
  source: string; // source entity id
  target: string; // target entity id
  type: RelationshipType;
  protocol?: string; // HTTP/REST, gRPC, TCP, AMQP, Import, etc.
  sourceEvidence?: SourceEvidence;
  description?: string;
}

export interface ArchitectureStats {
  services: number;
  apis: number;
  databases: number;
  modules: number;
  libraries: number;
  externalSystems: number;
  totalEntities: number;
  totalRelationships: number;
  detectedCount: number;
  userProvidedCount: number;
}

export interface ArchitectureModel {
  systemName: string;
  version?: string;
  extractedAt: string;
  inputType: 'blueprint' | 'codebase' | 'demo';
  sourceArtifacts?: string[];
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  stats: ArchitectureStats;
}

export type ProcessingStageId =
  | 'reading'
  | 'extraction'
  | 'dependencies'
  | 'reconstruction'
  | 'graph_generation'
  | 'ready';

export type ProcessingStepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ProcessingStep {
  id: ProcessingStageId;
  stepNumber: string;
  title: string;
  description: string;
  status: ProcessingStepStatus;
  detail?: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  field?: string;
  entityId?: string;
  relationshipId?: string;
}

export interface BlueprintJSON {
  systemName?: string;
  version?: string;
  services?: Array<{
    id: string;
    name: string;
    type?: EntityType;
    technology?: string;
    description?: string;
    metadata?: Record<string, any>;
  }>;
  entities?: Array<{
    id: string;
    name: string;
    type: EntityType;
    technology?: string;
    description?: string;
    metadata?: Record<string, any>;
  }>;
  relationships?: Array<{
    id?: string;
    source: string;
    target: string;
    type?: RelationshipType;
    protocol?: string;
    sourceEvidence?: SourceEvidence;
    description?: string;
  }>;
}
