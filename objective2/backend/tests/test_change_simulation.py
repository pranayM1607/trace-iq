import pytest
from app.models.schemas import (
    ArchitectureModel,
    ArchitectureEntity,
    ArchitectureRelationship,
    ProposedChange,
)
from app.services.simulation_service import SimulationService


@pytest.fixture
def sample_arch() -> ArchitectureModel:
    """
    Creates a sample microservices architecture:
    API Gateway -> Order Service -> Payment Service -> Payment DB
    """
    entities = [
        ArchitectureEntity(id="api-gw", name="API Gateway", type="API", technology="Kong"),
        ArchitectureEntity(id="order-svc", name="Order Service", type="Service", technology="Node.js"),
        ArchitectureEntity(id="payment-svc", name="Payment Service", type="Service", technology="Python"),
        ArchitectureEntity(id="payment-db", name="Payment DB", type="Database", technology="PostgreSQL"),
    ]
    relationships = [
        ArchitectureRelationship(id="r1", source="api-gw", target="order-svc", type="CALLS", protocol="REST"),
        ArchitectureRelationship(id="r2", source="order-svc", target="payment-svc", type="CALLS", protocol="gRPC"),
        ArchitectureRelationship(id="r3", source="payment-svc", target="payment-db", type="USES", protocol="PostgreSQL"),
    ]
    return ArchitectureModel(
        systemName="Retail Core",
        version="1.0.0",
        entities=entities,
        relationships=relationships,
    )


def test_simulation_add_component_and_dependency(sample_arch):
    """
    Test Objective 3 simulation: Adding 'Fraud Service' and 'Payment Service -> Fraud Service'
    """
    orig_entity_count = len(sample_arch.entities)
    orig_rel_count = len(sample_arch.relationships)

    fraud_entity = ArchitectureEntity(
        id="fraud-svc", name="Fraud Service", type="Service", technology="Go"
    )
    new_rel = ArchitectureRelationship(
        id="r-fraud", source="payment-svc", target="fraud-svc", type="CALLS", protocol="gRPC"
    )

    changes = [
        ProposedChange(action="add_component", component=fraud_entity),
        ProposedChange(action="add_dependency", relationship=new_rel),
    ]

    result = SimulationService.simulate_change(sample_arch, changes)

    # 1. Non-mutation of original architecture
    assert len(sample_arch.entities) == orig_entity_count
    assert len(sample_arch.relationships) == orig_rel_count
    assert "fraud-svc" not in [e.id for e in sample_arch.entities]

    # 2. Hypothetical architecture contains new node & edge
    assert len(result.hypothetical_architecture.entities) == orig_entity_count + 1
    assert len(result.hypothetical_architecture.relationships) == orig_rel_count + 1
    assert "fraud-svc" in [e.id for e in result.hypothetical_architecture.entities]

    # 3. Directly affected nodes contain added component and connected node
    direct_ids = [e.id for e in result.directly_affected_nodes]
    assert "fraud-svc" in direct_ids
    assert "payment-svc" in direct_ids

    # 4. Upstream dependency propagation: order-svc and api-gw depend transitively on payment-svc
    # Since payment-svc acquired a new downstream dependency, upstream dependents are traced
    indirect_ids = [e.id for e in result.indirectly_affected_nodes]
    assert "order-svc" in indirect_ids or "api-gw" in indirect_ids

    # 5. Causal Risk Ledger contains entries explaining coupling points
    assert len(result.causal_risk_ledger) > 0
    factors = [item.factor for item in result.causal_risk_ledger]
    assert any("Coupling" in f for f in factors)

    # 6. Change Story contains structured narrative steps
    assert len(result.change_story) >= 3


def test_simulation_remove_dependency(sample_arch):
    """
    Test Objective 3 simulation: Removing 'order-svc -> payment-svc' edge
    """
    orig_rel_count = len(sample_arch.relationships)

    changes = [
        ProposedChange(action="remove_dependency", relationship_id="r2"),
    ]

    result = SimulationService.simulate_change(sample_arch, changes)

    # Original model intact
    assert len(sample_arch.relationships) == orig_rel_count

    # Hypothetical model has 1 fewer relationship
    assert len(result.hypothetical_architecture.relationships) == orig_rel_count - 1

    # Ledger acknowledges decoupling
    assert any("Decoupling" in item.description or "Decommissioned" in item.description or item.points <= 0
               for item in result.causal_risk_ledger)


def test_simulation_remove_component_cascades(sample_arch):
    """
    Test removing 'payment-svc': should remove entity and attached relationships (r2, r3) in hypothetical
    """
    changes = [
        ProposedChange(action="remove_component", component_id="payment-svc"),
    ]

    result = SimulationService.simulate_change(sample_arch, changes)

    # Original intact
    assert len(sample_arch.entities) == 4
    assert len(sample_arch.relationships) == 3

    # Hypothetical has 3 entities, and relationships connected to payment-svc are removed
    assert len(result.hypothetical_architecture.entities) == 3
    assert len(result.hypothetical_architecture.relationships) == 1
    assert result.hypothetical_architecture.relationships[0].id == "r1"
