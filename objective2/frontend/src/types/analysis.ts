export type EntityType =
  | 'Service'
  | 'API'
  | 'Database'
  | 'Module'
  | 'Library'
  | 'External System'
  | 'Application'
  | 'Queue'
  | 'Package'
  | 'Worker'
  | 'Infrastructure';

export type RelationshipType =
  | 'CALLS'
  | 'DEPENDS_ON'
  | 'USES'
  | 'CONNECTS_TO'
  | 'IMPORTS'
  | 'CONTAINS'
  | 'EXPOSES'
  | 'QUERIES'
  | 'PUBLISHES'
  | 'SUBSCRIBES';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SpofSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type ComplexityRating = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SourceEvidence {
  file?: string;
  line?: number;
  snippet?: string;
  description?: string;
  detectionMethod?: string;
  folderModule?: string;
}

export interface CodebaseFileDependency {
  id: string;
  source_file: string;
  target_file: string;
  type: RelationshipType;
  line?: number | null;
  snippet?: string | null;
  statement?: string | null;
  detectionMethod: string;
}

export interface CodebaseModuleDependency {
  id: string;
  source_module: string;
  target_module: string;
  type: RelationshipType;
  count: number;
  sample_evidence?: SourceEvidence | null;
}

export interface CodebaseNode {
  id: string;
  name: string;
  type: 'folder' | 'module' | 'file';
  path: string;
  extension?: string | null;
  language?: string | null;
  category?: string | null;
  size_bytes: number;
  lines_count: number;
  parent_id?: string | null;
  module_id?: string | null;
  service_id?: string | null;
  imports: string[];
  imported_by: string[];
}

export interface CodebaseGraph {
  nodes: CodebaseNode[];
  edges: CodebaseFileDependency[];
  module_dependencies: CodebaseModuleDependency[];
  total_nodes: number;
  total_edges: number;
  total_imports: number;
}

export interface ArchitectureEntity {
  id: string;
  name: string;
  type: EntityType;
  technology: string;
  source: string;
  description?: string;
  sourceEvidence?: SourceEvidence;
  evidenceList?: SourceEvidence[];
  associatedFiles?: string[];
  metadata?: Record<string, any>;
}

export interface ArchitectureRelationship {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  protocol?: string;
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

export interface InventoryFile {
  path: string;
  category: 'source' | 'config' | 'manifest' | 'test' | 'script' | 'documentation' | 'other';
  extension: string;
  size_bytes: number;
  lines_count?: number | null;
  language?: string | null;
  associated_entity_id?: string | null;
}

export interface DetectedModule {
  id: string;
  name: string;
  path: string;
  files_count: number;
  languages: string[];
  description?: string;
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
  file_dependencies?: CodebaseFileDependency[];
  codebase_graph?: CodebaseGraph | null;
  detection_summary: string;
  is_limited_architecture: boolean;
  limited_architecture_reason?: string | null;
}

export interface ArchitectureModel {
  systemName: string;
  version?: string;
  extractedAt?: string;
  inputType?: string;
  sourceArtifacts?: string[];
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  stats?: ArchitectureStats;
  inventory?: CodebaseInventory | null;
  codebaseGraph?: CodebaseGraph | null;
  isLimitedArchitecture?: boolean;
  limitedArchitectureReason?: string | null;
}

export interface ComponentMetrics {
  component_id: string;
  name: string;
  type: EntityType;
  in_degree: int;
  out_degree: int;
  total_degree: int;
  direct_callers?: string[];
  direct_callers_count?: int;
  direct_dependencies?: string[];
  direct_dependencies_count?: int;
  betweenness_centrality: number;
  pagerank: number;
  upstream_callers_count: number;
  upstream_callers: string[];
  downstream_dependents_count: number;
  downstream_dependents: string[];
  max_dependency_depth: number;
  max_propagation_depth?: number;
  longest_downstream_path?: string[];
  longest_upstream_path?: string[];
  transitive_paths_through?: string[][];
}

// Helper int type alias
type int = number;

export interface CriticalComponent {
  component_id: string;
  name: string;
  type: EntityType;
  technology: string;
  criticality_score: number;
  criticality_tier: RiskLevel;
  rank: number;
  score_breakdown: {
    betweenness_factor: number;
    pagerank_factor: number;
    in_degree_factor: number;
    blast_radius_factor: number;
    spof_factor: number;
  };
  evidence: string[];
}

export interface SpofAnalysis {
  component_id: string;
  name: string;
  type: EntityType;
  technology: string;
  is_spof: boolean;
  spof_type?: string;
  disconnected_paths_count: number;
  severed_components: string[];
  severed_component_names: string[];
  severed_paths?: string[][];
  affected_components_count?: number;
  has_alternate_path?: boolean;
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
  propagation_path?: string[];
}

export interface ComplexityAnalysis {
  node_count: number;
  edge_count: number;
  average_degree: number;
  density: number;
  cyclomatic_complexity: number;
  weakly_connected_components?: number;
  formula_explanation?: string;
  max_dependency_depth: number;
  cycles_count: number;
  simple_cycles: string[][];
  scc_count: number;
  complexity_rating: ComplexityRating;
  summary: string;
  factors: Record<string, any>;
}

export interface ComponentRiskSummary {
  component_id: string;
  name: string;
  type: EntityType;
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
