import pytest
import networkx as nx
from app.services.graph_service import GraphService
from app.services.metrics_service import MetricsService
from app.services.spof_service import SpofService
from app.services.complexity_service import ComplexityService
from app.services.pipeline_service import AnalysisPipeline
from app.data.demo_architecture import DEMO_ARCHITECTURE
from app.models.schemas import ArchitectureModel, ArchitectureEntity, ArchitectureRelationship

def test_metrics_consistency_direct_callers_and_dependencies():
    G = GraphService.build_networkx_graph(DEMO_ARCHITECTURE)
    metrics_map = MetricsService.calculate_all_metrics(G, DEMO_ARCHITECTURE.entities)

    for node_id, metrics in metrics_map.items():
        # In-degree must equal number of distinct predecessors in a simple DiGraph
        assert metrics.in_degree == metrics.direct_callers_count
        assert len(metrics.direct_callers) == metrics.in_degree

        # Out-degree must equal number of distinct successors
        assert metrics.out_degree == metrics.direct_dependencies_count
        assert len(metrics.direct_dependencies) == metrics.out_degree

        # Total degree must equal in + out
        assert metrics.total_degree == metrics.in_degree + metrics.out_degree

        # Downstream path starts with this node
        assert metrics.longest_downstream_path[0] == node_id
        # Upstream path ends with this node
        assert metrics.longest_upstream_path[-1] == node_id

        # If terminal sink (out_degree == 0), downstream depth must be 0
        if metrics.out_degree == 0:
            assert metrics.max_dependency_depth == 0
            assert metrics.longest_downstream_path == [node_id]

        # If entrypoint (in_degree == 0), upstream propagation depth must be 0
        if metrics.in_degree == 0:
            assert metrics.max_propagation_depth == 0
            assert metrics.longest_upstream_path == [node_id]

def test_spof_explanation_and_concrete_severed_paths():
    G = GraphService.build_networkx_graph(DEMO_ARCHITECTURE)
    spofs = SpofService.detect_spofs(G, DEMO_ARCHITECTURE.entities)

    true_spofs = [s for s in spofs if s.is_spof]
    assert len(true_spofs) > 0

    for s in true_spofs:
        assert s.spof_type in ("TRANSIT", "SHARED_DATASTORE")
        assert s.affected_components_count > 0
        assert len(s.severed_components) == s.affected_components_count
        assert len(s.severed_paths) > 0

        # Each concrete severed path must be a non-empty sequence of component IDs
        for p in s.severed_paths:
            assert len(p) >= 2
            assert all(isinstance(node, str) for node in p)

def test_complexity_formula_explanation():
    G = GraphService.build_networkx_graph(DEMO_ARCHITECTURE)
    comp = ComplexityService.analyze_complexity(G)

    assert comp.weakly_connected_components >= 1
    assert "TraceIQ Architectural Cyclomatic Score: M = E - V + 2P" in comp.formula_explanation
    assert comp.average_degree == round((2.0 * comp.edge_count) / comp.node_count, 2)
    assert comp.density == round(comp.edge_count / (comp.node_count * (comp.node_count - 1)), 4)

def test_pipeline_execution_with_explanations():
    result = AnalysisPipeline.execute_analysis(DEMO_ARCHITECTURE, project_id="test-explanations")

    assert len(result.critical_components) > 0
    assert len(result.spofs) > 0
    assert len(result.high_risk_dependencies) > 0

    for dep in result.high_risk_dependencies:
        assert len(dep.propagation_path) >= 2
        assert dep.propagation_path[-1] == dep.target_id

    for cid, m in result.component_metrics.items():
        assert m.direct_callers_count == len(m.direct_callers)
        assert m.direct_dependencies_count == len(m.direct_dependencies)
