import pytest
from app.services.pipeline_service import AnalysisPipeline
from app.models.schemas import ArchitectureModel, ArchitectureEntity, ArchitectureRelationship
from app.data.demo_architecture import DEMO_ARCHITECTURE

def test_graph_analyzer_consistency():
    result = AnalysisPipeline.execute_analysis(DEMO_ARCHITECTURE)

    # 1. Structural entities and relationships counts
    assert len(DEMO_ARCHITECTURE.entities) == 13
    assert len(DEMO_ARCHITECTURE.relationships) == 20

    # 2. SPOF count consistency: exactly 7 SPOFs calculated by the engine
    true_spofs = [s for s in result.spofs if s.is_spof]
    assert len(true_spofs) == 7, f"Expected 7 SPOFs, got {len(true_spofs)}"
    
    spof_ids = {s.component_id for s in true_spofs}
    expected_spofs = {
        'api-gateway',
        'order-service',
        'postgres-primary',
        'redis-cluster',
        'notification-service',
        'payment-service',
        'analytics-worker'
    }
    assert spof_ids == expected_spofs

    # Every SPOF must have severed components and a clear explanation
    for s in true_spofs:
        assert len(s.severed_components) > 0
        assert len(s.explanation) > 0
        assert s.name != ""

    # 3. High-risk dependencies consistency: exactly 16 Critical/High risk dependencies
    high_risk_deps = [d for d in result.high_risk_dependencies if d.risk_level in ('CRITICAL', 'HIGH')]
    assert len(high_risk_deps) == 16, f"Expected 16 high-risk dependencies, got {len(high_risk_deps)}"

    critical_deps = [d for d in high_risk_deps if d.risk_level == 'CRITICAL']
    high_deps = [d for d in high_risk_deps if d.risk_level == 'HIGH']
    assert len(critical_deps) == 8
    assert len(high_deps) == 8

    # 4. Critical & High criticality components: exactly 4
    high_crit_comps = [c for c in result.critical_components if c.criticality_tier in ('CRITICAL', 'HIGH')]
    assert len(high_crit_comps) == 4

    # 5. Cycles count: exactly 1 circular loop
    assert result.complexity.cycles_count == 1
    assert len(result.complexity.simple_cycles) == 1
    assert 'notification-service' in result.complexity.simple_cycles[0]
    assert 'analytics-worker' in result.complexity.simple_cycles[0]
