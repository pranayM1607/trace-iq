import pytest
import networkx as nx
from app.models.schemas import ArchitectureModel, ArchitectureEntity, ArchitectureRelationship
from app.services.graph_service import GraphService
from app.services.metrics_service import MetricsService
from app.services.spof_service import SpofService
from app.services.criticality_service import CriticalityService
from app.services.complexity_service import ComplexityService
from app.services.risk_service import RiskService
from app.services.pipeline_service import AnalysisPipeline
from app.data.demo_architecture import DEMO_ARCHITECTURE

def test_linear_dependency_chain():
    """
    Test known linear graph: A -> B -> C -> D
    A downstream = 3 (B, C, D)
    B downstream = 2 (C, D)
    C downstream = 1 (D)
    D downstream = 0
    D upstream callers = 3 (A, B, C)
    """
    entities = [
        ArchitectureEntity(id="A", name="Service A", type="Service"),
        ArchitectureEntity(id="B", name="Service B", type="Service"),
        ArchitectureEntity(id="C", name="Service C", type="Service"),
        ArchitectureEntity(id="D", name="Service D", type="Service"),
    ]
    relationships = [
        ArchitectureRelationship(id="r1", source="A", target="B", type="CALLS"),
        ArchitectureRelationship(id="r2", source="B", target="C", type="CALLS"),
        ArchitectureRelationship(id="r3", source="C", target="D", type="CALLS"),
    ]
    arch = ArchitectureModel(systemName="LinearChain", entities=entities, relationships=relationships)
    G = GraphService.build_networkx_graph(arch)
    metrics = MetricsService.calculate_all_metrics(G, entities)

    assert metrics["A"].downstream_dependents_count == 3
    assert metrics["B"].downstream_dependents_count == 2
    assert metrics["C"].downstream_dependents_count == 1
    assert metrics["D"].downstream_dependents_count == 0

    assert metrics["D"].upstream_callers_count == 3
    assert set(metrics["D"].upstream_callers) == {"A", "B", "C"}
    assert metrics["A"].max_dependency_depth == 3

def test_circular_dependency_detection():
    """
    Test cycle detection: A -> B -> C -> A
    Cycle must be detected and extracted.
    """
    entities = [
        ArchitectureEntity(id="A", name="Service A", type="Service"),
        ArchitectureEntity(id="B", name="Service B", type="Service"),
        ArchitectureEntity(id="C", name="Service C", type="Service"),
    ]
    relationships = [
        ArchitectureRelationship(id="r1", source="A", target="B", type="CALLS"),
        ArchitectureRelationship(id="r2", source="B", target="C", type="CALLS"),
        ArchitectureRelationship(id="r3", source="C", target="A", type="CALLS"),
    ]
    arch = ArchitectureModel(systemName="CycleGraph", entities=entities, relationships=relationships)
    G = GraphService.build_networkx_graph(arch)
    complexity = ComplexityService.analyze_complexity(G)

    assert complexity.cycles_count >= 1
    # Check that cycle contains A, B, C
    flat_cycle = [item for sub in complexity.simple_cycles for item in sub]
    assert "A" in flat_cycle and "B" in flat_cycle and "C" in flat_cycle

def test_hub_topology_centrality():
    """
    Test Hub topology: A -> B, C -> B, D -> B, E -> B
    B must have high in-degree (4).
    """
    entities = [
        ArchitectureEntity(id="A", name="Service A", type="Service"),
        ArchitectureEntity(id="C", name="Service C", type="Service"),
        ArchitectureEntity(id="D", name="Service D", type="Service"),
        ArchitectureEntity(id="E", name="Service E", type="Service"),
        ArchitectureEntity(id="B", name="Hub B", type="Service"),
    ]
    relationships = [
        ArchitectureRelationship(id="r1", source="A", target="B", type="CALLS"),
        ArchitectureRelationship(id="r2", source="C", target="B", type="CALLS"),
        ArchitectureRelationship(id="r3", source="D", target="B", type="CALLS"),
        ArchitectureRelationship(id="r4", source="E", target="B", type="CALLS"),
    ]
    arch = ArchitectureModel(systemName="HubGraph", entities=entities, relationships=relationships)
    G = GraphService.build_networkx_graph(arch)
    metrics = MetricsService.calculate_all_metrics(G, entities)

    assert metrics["B"].in_degree == 4
    assert metrics["A"].in_degree == 0

def test_spof_bridge_detection():
    """
    Test SPOF Bridge:
    A -> B -> D
    A -> C -> D
    D -> E
    Removing D completely disconnects E from A, B, and C. D is a SPOF.
    """
    entities = [
        ArchitectureEntity(id="A", name="Entry A", type="Service"),
        ArchitectureEntity(id="B", name="Service B", type="Service"),
        ArchitectureEntity(id="C", name="Service C", type="Service"),
        ArchitectureEntity(id="D", name="Bridge D", type="Service"),
        ArchitectureEntity(id="E", name="Sink E", type="Database"),
    ]
    relationships = [
        ArchitectureRelationship(id="r1", source="A", target="B", type="CALLS"),
        ArchitectureRelationship(id="r2", source="A", target="C", type="CALLS"),
        ArchitectureRelationship(id="r3", source="B", target="D", type="CALLS"),
        ArchitectureRelationship(id="r4", source="C", target="D", type="CALLS"),
        ArchitectureRelationship(id="r5", source="D", target="E", type="USES"),
    ]
    arch = ArchitectureModel(systemName="BridgeGraph", entities=entities, relationships=relationships)
    G = GraphService.build_networkx_graph(arch)
    spof_results = SpofService.detect_spofs(G, entities)

    spof_map = {s.component_id: s for s in spof_results}
    assert spof_map["D"].is_spof is True
    assert "E" in spof_map["D"].severed_components
    assert spof_map["D"].disconnected_paths_count >= 1

def test_demo_architecture_complete_analysis():
    """
    Verifies that running the pipeline on the realistic demo architecture
    produces valid metrics, criticality ranking, SPOF detection, and complexity scoring.
    """
    result = AnalysisPipeline.execute_analysis(DEMO_ARCHITECTURE, project_id="demo-test")

    assert result.system_name == DEMO_ARCHITECTURE.systemName
    assert len(result.critical_components) == len(DEMO_ARCHITECTURE.entities)
    assert len(result.spofs) > 0

    # Ensure postgres-primary is identified as a SPOF
    spof_ids = [s.component_id for s in result.spofs if s.is_spof]
    assert "postgres-primary" in spof_ids

    # Ensure circular dependency between notification-service and analytics-worker is detected
    assert result.complexity.cycles_count >= 1
    cycle_nodes = [node for cycle in result.complexity.simple_cycles for node in cycle]
    assert "notification-service" in cycle_nodes and "analytics-worker" in cycle_nodes

    # Ensure high risk dependencies are identified
    assert len(result.high_risk_dependencies) > 0
    top_risk_dep = result.high_risk_dependencies[0]
    assert top_risk_dep.risk_level in ("CRITICAL", "HIGH")
    assert len(top_risk_dep.risk_factors) > 0

    # Ensure top insights are populated
    assert len(result.top_insights) >= 3
