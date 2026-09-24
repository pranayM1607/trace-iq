export type EntityType =
  | 'Service'
  | 'API'
  | 'Database'
  | 'Module'
  | 'Library'
  | 'External System'
  | 'Application';

export type RelationshipType =
  | 'CALLS'
  | 'DEPENDS_ON'
  | 'USES'
  | 'CONNECTS_TO'
  | 'IMPORTS'
  | 'QUERIES'
  | 'LOADS'
  | 'EXPOSES'
  | 'CONTAINS';

export type SourceType = 'Detected' | 'User-provided';

export type EvidenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SourceEvidence {
  file?: string;
  line?: number;
  lineEnd?: number;
  lineRange?: string;
  snippet?: string;
  description?: string;
  method?: string;
  confidence?: EvidenceConfidence;
  statement?: string;
}

export interface ArchitectureEntity {
  id: string;
  name: string;
  type: EntityType;
  technology: string;
  source: SourceType;
  description?: string;
  sourceEvidence?: SourceEvidence;
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

export type FileCategory =
  | 'source'
  | 'config'
  | 'manifest'
  | 'dataset'
  | 'model_artifact'
  | 'documentation'
  | 'asset'
  | 'unanalyzed'
  | 'unsupported'
  | 'unknown'
  | 'other';

export interface InventoryFile {
  path: string;
  name: string;
  category: FileCategory;
  extension: string;
  size_bytes: number;
  lines_count?: number;
  language?: string;
  associated_entity_id?: string;
  analysis_status?: string;
  content_hash?: string;
}

export interface DetectedModule {
  id: string;
  name: string;
  path: string;
  files_count: number;
  languages: string[];
  description?: string;
}

export interface CodebaseFileDependency {
  id: string;
  source_file: string;
  target_file: string;
  type: RelationshipType;
  line?: number;
  snippet?: string;
  statement?: string;
  detectionMethod: string;
  confidence?: EvidenceConfidence;
}

export interface CodebaseModuleDependency {
  id: string;
  source_module: string;
  target_module: string;
  type: RelationshipType;
  count: number;
  sample_evidence?: SourceEvidence;
}

export interface CodebaseNode {
  id: string;
  name: string;
  type: 'folder' | 'module' | 'file';
  path: string;
  extension?: string;
  language?: string;
  category?: string;
  size_bytes: number;
  lines_count?: number;
  parent_id?: string;
}

export interface CodebaseGraph {
  nodes: CodebaseNode[];
  edges: CodebaseFileDependency[];
  module_dependencies: CodebaseModuleDependency[];
  total_nodes: number;
  total_edges: number;
  total_imports: number;
}

export interface ExternalDependencyItem {
  name: string;
  version?: string;
  manifest: string;
  type: string;
}

export interface CodebaseInventory {
  total_files: number;
  total_folders: number;
  total_lines: number;
  languages: Record<string, number>;
  frameworks: string[];
  categories_breakdown: Record<string, number>;
  manifests: string[];
  config_files: string[];
  modules: DetectedModule[];
  packages: string[];
  libraries: string[];
  endpoints_count: number;
  datastores_count: number;
  external_integrations_count: number;
  files: InventoryFile[];
  folders: string[];
  file_dependencies: CodebaseFileDependency[];
  external_dependencies: ExternalDependencyItem[];
  codebase_graph?: CodebaseGraph;
  detection_summary: string;
  is_limited_architecture: boolean;
  limited_architecture_reason?: string;
}

export interface InputIdentity {
  id: string;
  originalFilename?: string;
  filename: string;
  inputType: 'ZIP' | 'JSON' | 'blueprint' | 'codebase' | 'demo';
  uploadedAt: string;
  fileCount?: number;
  filesCount?: number;
  folderCount?: number;
  foldersCount?: number;
  scope: 'complete' | 'partial';
  contentHash?: string;
  sourceMetadata?: Record<string, any>;
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
  inventory?: CodebaseInventory;
  codebaseGraph?: CodebaseGraph;
  isLimitedArchitecture?: boolean;
  limitedArchitectureReason?: string;
  inputIdentity?: InputIdentity;
  originalJsonPayload?: any;
  rawJsonString?: string;
  scope?: 'complete' | 'partial';
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
    [key: string]: any;
  }>;
  entities?: Array<{
    id: string;
    name: string;
    type: EntityType;
    technology?: string;
    description?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  }>;
  relationships?: Array<{
    id?: string;
    source: string;
    target: string;
    type?: RelationshipType;
    protocol?: string;
    sourceEvidence?: SourceEvidence;
    description?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

// ==========================================
// ARCHITECTURE VERSIONING & SNAPSHOT MODELS
// ==========================================

export interface ArchitectureSnapshot {
  id: string;
  version: string;
  label: string;
  createdAt: string;
  sourceIdentifier?: string;
  repositoryInventory?: CodebaseInventory;
  architecture: ArchitectureModel;
  nodeCount: number;
  relationshipCount: number;
  fileCount: number;
  folderCount: number;
  inputIdentity?: InputIdentity;
  originalJsonPayload?: any;
  rawJsonString?: string;
  isFrozen: boolean;
  scope?: 'complete' | 'partial';
}

// ==========================================
// REPOSITORY INVENTORY DIFF MODELS (LEVEL 1)
// ==========================================

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DiffFileItem {
  changeType: DiffChangeType;
  file: InventoryFile;
  previousFile?: InventoryFile;
  versionOrigin: 'V1' | 'V2' | 'BOTH';
  diffReason?: string;
}

export interface DiffFolderItem {
  changeType: DiffChangeType;
  folder: string;
  versionOrigin: 'V1' | 'V2' | 'BOTH';
}

export interface RepositoryInventoryDiffSummary {
  addedFilesCount: number;
  removedFilesCount: number;
  modifiedFilesCount: number;
  unchangedFilesCount: number;
  addedFoldersCount: number;
  removedFoldersCount: number;
  unchangedFoldersCount: number;
}

export interface RepositoryInventoryDiff {
  summary: RepositoryInventoryDiffSummary;
  addedFiles: InventoryFile[];
  removedFiles: InventoryFile[];
  modifiedFiles: InventoryFile[];
  unchangedFiles: InventoryFile[];
  addedFolders: string[];
  removedFolders: string[];
  unchangedFolders: string[];
  diffFiles: DiffFileItem[];
  diffFolders: DiffFolderItem[];
}

// ==========================================
// ARCHITECTURE DIFF DATA MODELS (LEVEL 2)
// ==========================================

export interface DiffNodeItem {
  changeType: DiffChangeType;
  entity: ArchitectureEntity;
  previousEntity?: ArchitectureEntity;
  versionOrigin: 'V1' | 'V2' | 'BOTH';
}

export interface DiffRelationshipItem {
  id: string;
  changeType: DiffChangeType;
  relationship: ArchitectureRelationship;
  versionOrigin: 'V1' | 'V2' | 'BOTH';
  sourceEntity?: ArchitectureEntity;
  targetEntity?: ArchitectureEntity;
  sourceEvidence?: SourceEvidence;
}

export interface ArchitectureDiffSummary {
  addedNodesCount: number;
  removedNodesCount: number;
  modifiedNodesCount: number;
  unchangedNodesCount: number;
  addedRelationshipsCount: number;
  removedRelationshipsCount: number;
  modifiedRelationshipsCount: number;
  unchangedRelationshipsCount: number;
}

export interface ArchitectureDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromVersion: string;
  toVersion: string;
  fromLabel: string;
  toLabel: string;
  summary: ArchitectureDiffSummary;
  addedNodes: ArchitectureEntity[];
  removedNodes: ArchitectureEntity[];
  modifiedNodes: ArchitectureEntity[];
  unchangedNodes: ArchitectureEntity[];
  addedRelationships: DiffRelationshipItem[];
  removedRelationships: DiffRelationshipItem[];
  modifiedRelationships: DiffRelationshipItem[];
  unchangedRelationships: DiffRelationshipItem[];
  // Complete union graph for visual diff rendering
  diffNodes: DiffNodeItem[];
  diffRelationships: DiffRelationshipItem[];
  // Level 1 Repository Inventory Diff
  repositoryDiff?: RepositoryInventoryDiff;
}

// ==========================================
// IMPACT ANALYSIS & CAUSAL RISK MODELS
// ==========================================

export interface ImpactAnalysisResult {
  directlyChangedNodes: ArchitectureEntity[];
  newDependencies: ArchitectureRelationship[];
  removedDependencies: ArchitectureRelationship[];
  potentiallyImpactedNodes: ArchitectureEntity[];
  propagationPaths: Array<{
    source: string;
    impacted: string;
    path: string[];
    description: string;
  }>;
}

export interface CausalRiskFactor {
  factor: string;
  points: number;
  description: string;
  evidenceCount?: number;
}

export interface StructuralRiskDelta {
  originalScore: number;
  changedScore: number;
  delta: number;
  originalRiskLevel?: RiskLevel;
  changedRiskLevel?: RiskLevel;
  shiftDirection?: 'Higher structural risk' | 'Lower structural risk' | 'No structural risk change';
  ledger: CausalRiskFactor[];
  attributionStatement: string;
  brokenDependencies?: Array<{ callerName: string; removedTargetName: string }>;
}

export interface ArchitectureComparisonResult {
  originalIdentity: InputIdentity;
  changedIdentity: InputIdentity;
  originalModel: ArchitectureModel;
  changedModel: ArchitectureModel;
  repositoryDiff?: RepositoryInventoryDiff;
  architectureDiff: ArchitectureDiff;
  impactAnalysis: ImpactAnalysisResult;
  structuralRisk: StructuralRiskDelta;
  changeStory: string[];
}

export interface CurrentWorkspaceInfo {
  sourceName: string;
  sourceType: 'ZIP' | 'JSON' | 'DEMO';
  scope: 'complete' | 'partial';
  fileCount: number;
  folderCount: number;
  componentCount: number;
  relationshipCount: number;
  status: 'UNSAVED' | 'SAVED';
  savedSnapshotId?: string;
  savedSnapshotLabel?: string;
  inputIdentity?: InputIdentity;
}

// ==========================================
// OBJECTIVE 2: GRAPH RISK & QUALITY METRICS
// ==========================================

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SpofSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type ComplexityRating = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ComponentMetrics {
  component_id: string;
  name: string;
  type: string;
  in_degree: number;
  out_degree: number;
  total_degree: number;
  betweenness_centrality: number;
  pagerank: number;
  direct_callers_count: number;
  direct_callers: string[];
  direct_dependencies_count: number;
  direct_dependencies: string[];
  upstream_callers_count: number;
  upstream_callers: string[];
  downstream_dependents_count: number;
  downstream_dependents: string[];
  max_dependency_depth: number;
  max_propagation_depth: number;
  longest_downstream_path: string[];
  longest_upstream_path: string[];
  transitive_paths_through: string[][];
}

export interface CriticalComponent {
  component_id: string;
  name: string;
  type: string;
  technology: string;
  criticality_score: number;
  criticality_tier: RiskLevel;
  rank: number;
  score_breakdown: Record<string, number>;
  evidence: string[];
}

export interface SpofAnalysis {
  component_id: string;
  name: string;
  type: string;
  technology: string;
  is_spof: boolean;
  spof_type: string;
  disconnected_paths_count: number;
  affected_components_count: number;
  severed_components: string[];
  severed_component_names: string[];
  severed_paths: string[][];
  has_alternate_path: boolean;
  severity: SpofSeverity;
  explanation: string;
}

export interface HighRiskDependency {
  relationship_id: string;
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  type: RelationshipType;
  protocol?: string;
  risk_level: RiskLevel;
  risk_score: number;
  risk_factors: string[];
  is_part_of_cycle: boolean;
  is_target_spof: boolean;
  target_criticality: number;
  propagation_path: string[];
}

export interface ComplexityAnalysis {
  node_count: number;
  edge_count: number;
  average_degree: number;
  density: number;
  cyclomatic_complexity: number;
  max_dependency_depth: number;
  cycles_count: number;
  simple_cycles: string[][];
  scc_count: number;
  weakly_connected_components: number;
  complexity_rating: ComplexityRating;
  summary: string;
  factors?: Record<string, any>;
}

export interface ComponentRiskSummary {
  component_id: string;
  name: string;
  type: string;
  risk_level: RiskLevel;
  risk_score: number;
  is_spof: boolean;
  is_critical: boolean;
  is_in_cycle: boolean;
  evidence: string[];
}

export interface Objective2AnalysisResult {
  project_id: string;
  system_name: string;
  version: string;
  analyzed_at: string;
  architecture: ArchitectureModel;
  component_metrics: Record<string, ComponentMetrics>;
  critical_components: CriticalComponent[];
  spofs: SpofAnalysis[];
  high_risk_dependencies: HighRiskDependency[];
  complexity: ComplexityAnalysis;
  component_risks: Record<string, ComponentRiskSummary>;
  top_insights: string[];
}

// ==========================================
// OBJECTIVE 3: CHANGE SIMULATOR & CAUSAL RISK
// ==========================================

export type ProposedChangeAction =
  | 'add_component'
  | 'remove_component'
  | 'add_dependency'
  | 'remove_dependency';

export interface ProposedChange {
  id: string;
  action: ProposedChangeAction;
  component?: ArchitectureEntity;
  component_id?: string;
  relationship?: ArchitectureRelationship;
  relationship_id?: string;
  description?: string;
}

export type CausalRiskFactorItem = CausalRiskFactor;

export interface ChangeStoryStep {
  step: number;
  title: string;
  description: string;
  category: string;
}

export interface ChangeSimulationResult {
  current_architecture: ArchitectureModel;
  hypothetical_architecture: ArchitectureModel;
  current_analysis: Objective2AnalysisResult;
  hypothetical_analysis: Objective2AnalysisResult;
  directly_affected_nodes: ArchitectureEntity[];
  indirectly_affected_nodes: ArchitectureEntity[];
  propagation_paths: Array<{
    source: string;
    target: string;
    path_ids: string[];
    path_names: string[];
    propagation_type: string;
    description: string;
  }>;
  current_risk_score: number;
  hypothetical_risk_score: number;
  risk_delta: number;
  causal_risk_ledger: CausalRiskFactor[];
  change_story: ChangeStoryStep[];
  broken_dependencies?: Array<{ callerName: string; missingTargetName: string }>;
  recommended_checks?: string[];
  why_risk_changed?: string;
}
