from typing import Dict, List
from ..models.schemas import (
    CriticalComponent,
    ComponentMetrics,
    SpofAnalysis,
    ArchitectureEntity,
    RiskLevel,
)

class CriticalityService:
    # Transparently documented mathematical weights
    WEIGHT_BETWEENNESS = 0.30   # Bottleneck & mediation importance
    WEIGHT_PAGERANK = 0.25      # Recursive structural importance
    WEIGHT_IN_DEGREE = 0.20     # Direct incoming client dependency load
    WEIGHT_BLAST_RADIUS = 0.15  # Upstream propagation reach
    WEIGHT_SPOF = 0.10          # Single point of failure structural penalty

    @classmethod
    def calculate_criticality(
        cls,
        metrics_map: Dict[str, ComponentMetrics],
        spof_results: List[SpofAnalysis],
        entities: List[ArchitectureEntity],
    ) -> List[CriticalComponent]:
        """
        Calculates multi-signal normalized architectural criticality for all components.
        Every score is deterministically derived from NetworkX graph measurements.
        """
        if not metrics_map:
            return []

        spof_map = {s.component_id: s for s in spof_results}
        entity_map = {e.id: e for e in entities}

        # Extract min and max values for linear min-max normalization
        cb_vals = [m.betweenness_centrality for m in metrics_map.values()]
        pr_vals = [m.pagerank for m in metrics_map.values()]
        in_vals = [m.in_degree for m in metrics_map.values()]
        blast_vals = [m.upstream_callers_count for m in metrics_map.values()]

        min_cb, max_cb = min(cb_vals), max(cb_vals)
        min_pr, max_pr = min(pr_vals), max(pr_vals)
        min_in, max_in = min(in_vals), max(in_vals)
        min_blast, max_blast = min(blast_vals), max(blast_vals)

        def normalize(val: float, min_val: float, max_val: float) -> float:
            if max_val < 1e-9:
                return 0.0
            if max_val - min_val < 1e-9:
                return 0.5  # Neutral when non-zero uniform distribution (e.g. PageRank 1/N)
            return max(0.0, min(1.0, (val - min_val) / (max_val - min_val)))

        critical_components: List[CriticalComponent] = []

        for node_id, metrics in metrics_map.items():
            norm_cb = normalize(metrics.betweenness_centrality, min_cb, max_cb)
            norm_pr = normalize(metrics.pagerank, min_pr, max_pr)
            norm_in = normalize(metrics.in_degree, min_in, max_in)
            norm_blast = normalize(metrics.upstream_callers_count, min_blast, max_blast)

            spof_info = spof_map.get(node_id)
            is_spof = spof_info.is_spof if spof_info else False
            spof_score = 1.0 if is_spof else 0.0

            composite_score = (
                cls.WEIGHT_BETWEENNESS * norm_cb
                + cls.WEIGHT_PAGERANK * norm_pr
                + cls.WEIGHT_IN_DEGREE * norm_in
                + cls.WEIGHT_BLAST_RADIUS * norm_blast
                + cls.WEIGHT_SPOF * spof_score
            )
            composite_score = round(composite_score, 4)

            # Assign Criticality Tier
            tier: RiskLevel
            if composite_score >= 0.70:
                tier = "CRITICAL"
            elif composite_score >= 0.45:
                tier = "HIGH"
            elif composite_score >= 0.25:
                tier = "MEDIUM"
            else:
                tier = "LOW"

            # Derive natural-language deterministic evidence
            evidence: List[str] = []
            if norm_cb >= 0.60:
                evidence.append(
                    f"High Betweenness Centrality ({metrics.betweenness_centrality:.4f}): Acts as a major transit bottleneck across architectural pathways."
                )
            if norm_in >= 0.60 or metrics.in_degree >= 3:
                evidence.append(
                    f"Elevated Fan-In ({metrics.in_degree} direct callers): Multiple services depend directly on its continuous availability."
                )
            if is_spof:
                evidence.append(
                    f"Single Point of Failure: Structural removal severs {spof_info.disconnected_paths_count if spof_info else 'multiple'} dependent workflows."
                )
            if metrics.upstream_callers_count >= 4 or norm_blast >= 0.60:
                evidence.append(
                    f"Wide Failure Impact ({metrics.upstream_callers_count} callers in blast radius): An outage propagates widely across the topology."
                )
            if norm_pr >= 0.60:
                evidence.append(
                    f"High PageRank ({metrics.pagerank:.4f}): Depended upon by other structurally significant services."
                )

            if not evidence:
                evidence.append("Normal peripheral component with low coupling and redundant routing.")

            entity = entity_map.get(node_id)

            critical_components.append(
                CriticalComponent(
                    component_id=node_id,
                    name=metrics.name,
                    type=metrics.type,
                    technology=entity.technology if entity else "Generic",
                    criticality_score=composite_score,
                    criticality_tier=tier,
                    rank=0,  # Assigned after sorting
                    score_breakdown={
                        "betweenness_factor": round(norm_cb * cls.WEIGHT_BETWEENNESS, 4),
                        "pagerank_factor": round(norm_pr * cls.WEIGHT_PAGERANK, 4),
                        "in_degree_factor": round(norm_in * cls.WEIGHT_IN_DEGREE, 4),
                        "blast_radius_factor": round(norm_blast * cls.WEIGHT_BLAST_RADIUS, 4),
                        "spof_factor": round(spof_score * cls.WEIGHT_SPOF, 4),
                    },
                    evidence=evidence,
                )
            )

        # Sort descending by criticality score
        critical_components.sort(key=lambda c: c.criticality_score, reverse=True)

        # Assign ranks
        for idx, comp in enumerate(critical_components):
            comp.rank = idx + 1

        return critical_components
