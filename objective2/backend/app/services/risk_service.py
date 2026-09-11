from typing import Dict, List, Set, Tuple
import networkx as nx
from ..models.schemas import (
    HighRiskDependency,
    ComponentRiskSummary,
    ArchitectureRelationship,
    ArchitectureEntity,
    CriticalComponent,
    SpofAnalysis,
    ComplexityAnalysis,
    RiskLevel,
)

class RiskService:
    @classmethod
    def analyze_dependency_risks(
        cls,
        G: nx.DiGraph,
        relationships: List[ArchitectureRelationship],
        entities: List[ArchitectureEntity],
        critical_components: List[CriticalComponent],
        spof_results: List[SpofAnalysis],
        complexity: ComplexityAnalysis,
    ) -> Tuple[List[HighRiskDependency], Dict[str, ComponentRiskSummary]]:
        """
        Evaluates risk for both individual relationships (edges) and components (nodes).
        All risk levels and factors are derived from mathematical graph evidence.
        """
        entity_map = {e.id: e for e in entities}
        crit_map = {c.component_id: c for c in critical_components}
        spof_map = {s.component_id: s for s in spof_results}

        # Identify all edges that participate in circular dependency cycles
        cycle_edges: Set[Tuple[str, str]] = set()
        cycle_nodes: Set[str] = set()

        for cycle in complexity.simple_cycles:
            cycle_nodes.update(cycle)
            for i in range(len(cycle)):
                u = cycle[i]
                v = cycle[(i + 1) % len(cycle)]
                cycle_edges.add((u, v))

        high_risk_dependencies: List[HighRiskDependency] = []

        for rel in relationships:
            src_id = rel.source
            tgt_id = rel.target

            src_entity = entity_map.get(src_id)
            tgt_entity = entity_map.get(tgt_id)

            src_name = src_entity.name if src_entity else src_id
            tgt_name = tgt_entity.name if tgt_entity else tgt_id

            tgt_crit = crit_map.get(tgt_id)
            tgt_crit_score = tgt_crit.criticality_score if tgt_crit else 0.2

            tgt_spof = spof_map.get(tgt_id)
            is_target_spof = tgt_spof.is_spof if tgt_spof else False

            is_in_cycle = (src_id, tgt_id) in cycle_edges

            # Calculate edge risk factors
            risk_factors: List[str] = []
            risk_score = 0.15  # baseline

            if is_target_spof:
                risk_score += 0.35
                risk_factors.append(
                    f"Target '{tgt_name}' is a Single Point of Failure; disruption halts upstream processes."
                )

            if tgt_crit and tgt_crit.criticality_tier == "CRITICAL":
                risk_score += 0.25
                risk_factors.append(
                    f"Dependent on top-tier Critical component '{tgt_name}' (Score: {tgt_crit_score})."
                )
            elif tgt_crit and tgt_crit.criticality_tier == "HIGH":
                risk_score += 0.15
                risk_factors.append(f"Dependent on high-centrality service '{tgt_name}'.")

            if is_in_cycle:
                risk_score += 0.30
                risk_factors.append(
                    "Participates in a circular dependency loop, risking lock contention and recursion."
                )

            # Check if target has high fan-in (congested resource)
            if G.has_node(tgt_id) and G.in_degree(tgt_id) >= 4:
                risk_score += 0.15
                risk_factors.append(
                    f"Target is heavily shared ({G.in_degree(tgt_id)} inbound connections), creating a concurrency bottleneck."
                )

            risk_score = round(min(1.0, risk_score), 3)

            # Risk level categorization
            risk_lvl: RiskLevel
            if risk_score >= 0.70:
                risk_lvl = "CRITICAL"
            elif risk_score >= 0.50:
                risk_lvl = "HIGH"
            elif risk_score >= 0.30:
                risk_lvl = "MEDIUM"
            else:
                risk_lvl = "LOW"

            if not risk_factors:
                risk_factors.append("Standard service-to-service communication with normal redundancy.")

            prop_path = [src_id, tgt_id]
            try:
                ancestors = list(nx.ancestors(G, src_id))
                if ancestors:
                    sp = nx.shortest_path(G, ancestors[0], src_id)
                    prop_path = sp + [tgt_id]
            except Exception:
                pass

            high_risk_dependencies.append(
                HighRiskDependency(
                    relationship_id=rel.id,
                    source_id=src_id,
                    source_name=src_name,
                    target_id=tgt_id,
                    target_name=tgt_name,
                    type=rel.type,
                    protocol=rel.protocol,
                    risk_level=risk_lvl,
                    risk_score=risk_score,
                    risk_factors=risk_factors,
                    is_part_of_cycle=is_in_cycle,
                    is_target_spof=is_target_spof,
                    target_criticality=tgt_crit_score,
                    propagation_path=prop_path,
                )
            )

        # Sort dependencies by risk descending
        high_risk_dependencies.sort(key=lambda d: d.risk_score, reverse=True)

        # Component Composite Risk Summaries
        component_risks: Dict[str, ComponentRiskSummary] = {}

        for entity in entities:
            cid = entity.id
            crit = crit_map.get(cid)
            spof = spof_map.get(cid)
            is_spof = spof.is_spof if spof else False
            is_critical = crit.criticality_tier in ("CRITICAL", "HIGH") if crit else False
            is_in_cycle = cid in cycle_nodes

            c_risk_score = 0.1
            c_evidence: List[str] = []

            if crit:
                c_risk_score += crit.criticality_score * 0.4
                if crit.criticality_tier == "CRITICAL":
                    c_evidence.append(f"Top-tier structural criticality (Score: {crit.criticality_score}).")

            if is_spof:
                c_risk_score += 0.35
                c_evidence.append("Identified as a Single Point of Failure with no alternative path.")

            if is_in_cycle:
                c_risk_score += 0.25
                c_evidence.append("Entangled in a circular dependency cycle.")

            c_risk_score = round(min(1.0, c_risk_score), 3)

            comp_lvl: RiskLevel
            if c_risk_score >= 0.65 or (is_spof and is_critical):
                comp_lvl = "CRITICAL"
            elif c_risk_score >= 0.45 or is_spof:
                comp_lvl = "HIGH"
            elif c_risk_score >= 0.25:
                comp_lvl = "MEDIUM"
            else:
                comp_lvl = "LOW"

            if not c_evidence:
                c_evidence.append("Low operational risk; well-distributed peripheral component.")

            component_risks[cid] = ComponentRiskSummary(
                component_id=cid,
                name=entity.name,
                type=entity.type,
                risk_level=comp_lvl,
                risk_score=c_risk_score,
                is_spof=is_spof,
                is_critical=is_critical,
                is_in_cycle=is_in_cycle,
                evidence=c_evidence,
            )

        return high_risk_dependencies, component_risks
