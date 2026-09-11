from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field

EntityType = Literal[
    'Service', 'API', 'Database', 'Module', 'Library', 'External System',
    'Application', 'Queue', 'Package', 'Worker', 'Infrastructure'
]
RelationshipType = Literal[
    'CALLS', 'DEPENDS_ON', 'USES', 'CONNECTS_TO',
    'IMPORTS', 'CONTAINS', 'EXPOSES', 'QUERIES', 'PUBLISHES', 'SUBSCRIBES'
]
RiskLevel = Literal['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
SpofSeverity = Literal['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']
ComplexityRating = Literal['LOW', 'MEDIUM', 'HIGH']

class SourceEvidence(BaseModel):
    file: Optional[str] = None
    line: Optional[int] = None
    snippet: Optional[str] = None
    description: Optional[str] = None
    detectionMethod: Optional[str] = None
    folderModule: Optional[str] = None

class ArchitectureEntity(BaseModel):
    id: str
    name: str
    type: EntityType
    technology: str = "Generic"
    source: str = "Detected"
    description: Optional[str] = None
    sourceEvidence: Optional[SourceEvidence] = None
    evidenceList: List[SourceEvidence] = Field(default_factory=list)
    associatedFiles: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ArchitectureRelationship(BaseModel):
    id: str
    source: str
    target: str
    type: RelationshipType
    protocol: Optional[str] = None
    sourceEvidence: Optional[SourceEvidence] = None
    description: Optional[str] = None

class ArchitectureStats(BaseModel):
    services: int = 0
    apis: int = 0
    databases: int = 0
    modules: int = 0
    libraries: int = 0
    externalSystems: int = 0
    totalEntities: int = 0
    totalRelationships: int = 0
    detectedCount: int = 0
    userProvidedCount: int = 0

class InventoryFile(BaseModel):
    path: str
    category: str  # 'source', 'config', 'manifest', 'test', 'script', 'documentation', 'other'
    extension: str
    size_bytes: int
    lines_count: Optional[int] = None
    language: Optional[str] = None
    associated_entity_id: Optional[str] = None

class DetectedModule(BaseModel):
    id: str
    name: str
    path: str
    files_count: int
    languages: List[str] = Field(default_factory=list)
    description: Optional[str] = None

class CodebaseFileDependency(BaseModel):
    id: str
    source_file: str
    target_file: str
    type: RelationshipType = 'IMPORTS'
    line: Optional[int] = None
    snippet: Optional[str] = None
    statement: Optional[str] = None
    detectionMethod: str = "Language Import Extractor"

class CodebaseModuleDependency(BaseModel):
    id: str
    source_module: str
    target_module: str
    type: RelationshipType = 'USES'
    count: int = 1
    sample_evidence: Optional[SourceEvidence] = None

class CodebaseNode(BaseModel):
    id: str
    name: str
    type: Literal['folder', 'module', 'file']
    path: str
    extension: Optional[str] = None
    language: Optional[str] = None
    category: Optional[str] = None
    size_bytes: int = 0
    lines_count: int = 0
    parent_id: Optional[str] = None
    module_id: Optional[str] = None
    service_id: Optional[str] = None
    imports: List[str] = Field(default_factory=list)
    imported_by: List[str] = Field(default_factory=list)

class CodebaseGraph(BaseModel):
    nodes: List[CodebaseNode] = Field(default_factory=list)
    edges: List[CodebaseFileDependency] = Field(default_factory=list)
    module_dependencies: List[CodebaseModuleDependency] = Field(default_factory=list)
    total_nodes: int = 0
    total_edges: int = 0
    total_imports: int = 0

class CodebaseInventory(BaseModel):
    total_files: int = 0
    total_folders: int = 0
    total_lines: int = 0
    languages: Dict[str, int] = Field(default_factory=dict)
    frameworks: List[str] = Field(default_factory=list)
    categories_breakdown: Dict[str, int] = Field(default_factory=dict)
    manifests: List[str] = Field(default_factory=list)
    config_files: List[str] = Field(default_factory=list)
    modules: List[DetectedModule] = Field(default_factory=list)
    packages: List[str] = Field(default_factory=list)
    libraries: List[str] = Field(default_factory=list)
    endpoints_count: int = 0
    datastores_count: int = 0
    external_integrations_count: int = 0
    files: List[InventoryFile] = Field(default_factory=list)
    folders: List[str] = Field(default_factory=list)
    file_dependencies: List[CodebaseFileDependency] = Field(default_factory=list)
    external_dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    codebase_graph: Optional[CodebaseGraph] = None
    detection_summary: str = ""
    is_limited_architecture: bool = False
    limited_architecture_reason: Optional[str] = None

class ArchitectureModel(BaseModel):
    systemName: str
    version: Optional[str] = "1.0.0"
    extractedAt: Optional[str] = None
    inputType: Optional[str] = "blueprint"
    sourceArtifacts: List[str] = Field(default_factory=list)
    entities: List[ArchitectureEntity] = Field(default_factory=list)
    relationships: List[ArchitectureRelationship] = Field(default_factory=list)
    stats: Optional[ArchitectureStats] = None
    inventory: Optional[CodebaseInventory] = None
    codebaseGraph: Optional[CodebaseGraph] = None
    isLimitedArchitecture: bool = False
    limitedArchitectureReason: Optional[str] = None

class ComponentMetrics(BaseModel):
    component_id: str
    name: str
    type: EntityType
    in_degree: int
    out_degree: int
    total_degree: int
    betweenness_centrality: float
    pagerank: float
    direct_callers_count: int = 0  # Direct dependents: components that directly call this component
    direct_callers: List[str] = Field(default_factory=list)
    direct_dependencies_count: int = 0  # Direct dependencies: components this component directly relies upon
    direct_dependencies: List[str] = Field(default_factory=list)
    upstream_callers_count: int = 0  # Total blast radius: all components that break if this component fails
    upstream_callers: List[str] = Field(default_factory=list)
    downstream_dependents_count: int = 0  # Total dependency footprint: all components transitively relied upon
    downstream_dependents: List[str] = Field(default_factory=list)
    max_dependency_depth: int = 0  # Longest outgoing dependency chain depth (callees)
    max_propagation_depth: int = 0  # Longest incoming failure propagation depth (callers)
    longest_downstream_path: List[str] = Field(default_factory=list)  # Sequence: [this, child1, child2...]
    longest_upstream_path: List[str] = Field(default_factory=list)  # Sequence: [root_caller, ..., this]
    transitive_paths_through: List[List[str]] = Field(default_factory=list)  # Shortest paths passing through this component

class CriticalComponent(BaseModel):
    component_id: str
    name: str
    type: EntityType
    technology: str
    criticality_score: float
    criticality_tier: RiskLevel
    rank: int
    score_breakdown: Dict[str, float]
    evidence: List[str]

class SpofAnalysis(BaseModel):
    component_id: str
    name: str
    type: EntityType
    technology: str
    is_spof: bool
    spof_type: str = "TRANSIT"  # "TRANSIT" or "SHARED_DATASTORE"
    disconnected_paths_count: int = 0
    affected_components_count: int = 0
    severed_components: List[str] = Field(default_factory=list)
    severed_component_names: List[str] = Field(default_factory=list)
    severed_paths: List[List[str]] = Field(default_factory=list)  # Concrete path sequences severed
    has_alternate_path: bool = False
    severity: SpofSeverity = "NONE"
    explanation: str

class HighRiskDependency(BaseModel):
    relationship_id: str
    source_id: str
    source_name: str
    target_id: str
    target_name: str
    type: RelationshipType
    protocol: Optional[str] = None
    risk_level: RiskLevel
    risk_score: float
    risk_factors: List[str]
    is_part_of_cycle: bool
    is_target_spof: bool
    target_criticality: float
    propagation_path: List[str] = Field(default_factory=list)

class ComplexityAnalysis(BaseModel):
    node_count: int
    edge_count: int
    average_degree: float
    density: float
    cyclomatic_complexity: int
    max_dependency_depth: int
    cycles_count: int
    simple_cycles: List[List[str]]
    scc_count: int
    weakly_connected_components: int = 1
    formula_explanation: str = "TraceIQ Architectural Cyclomatic Score: M = E - V + 2P"
    complexity_rating: ComplexityRating
    summary: str
    factors: Dict[str, Any]

class ComponentRiskSummary(BaseModel):
    component_id: str
    name: str
    type: EntityType
    risk_level: RiskLevel
    risk_score: float
    is_spof: bool
    is_critical: bool
    is_in_cycle: bool
    evidence: List[str]

class Objective2AnalysisResult(BaseModel):
    project_id: str
    system_name: str
    version: str
    analyzed_at: str
    architecture: ArchitectureModel
    component_metrics: Dict[str, ComponentMetrics]
    critical_components: List[CriticalComponent]
    spofs: List[SpofAnalysis]
    high_risk_dependencies: List[HighRiskDependency]
    complexity: ComplexityAnalysis
    component_risks: Dict[str, ComponentRiskSummary]
    top_insights: List[str]
