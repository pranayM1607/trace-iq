from datetime import datetime, timezone
from typing import List
from ..models.schemas import (
    ArchitectureModel,
    Objective2AnalysisResult,
)
from .graph_service import GraphService
from .metrics_service import MetricsService
from .spof_service import SpofService
from .criticality_service import CriticalityService
from .complexity_service import ComplexityService
from .risk_service import RiskService

class AnalysisPipeline:
    @classmethod
    def execute_analysis(
        cls, architecture: ArchitectureModel, project_id: str = "demo-project"
    ) -> Objective2AnalysisResult:
        """
        Executes the complete end-to-end Objective 2 analysis pipeline:
        Input Architecture -> Graph Construction -> Topological Metrics ->
        SPOF Detection -> Criticality Scoring -> Complexity Analysis ->
        Risk Evaluation -> Evidence Synthesis -> Structured Result.
        """
        # 1. Build NetworkX Directed Graph
        G = GraphService.build_networkx_graph(architecture)

        # 2. Compute Component-level Graph Metrics
        metrics_map = MetricsService.calculate_all_metrics(G, architecture.entities)

        # 3. Counterfactual Single Point of Failure (SPOF) Analysis
        spof_results = SpofService.detect_spofs(G, architecture.entities)

        # 4. Multi-signal Normalized Criticality Analysis
        critical_components = CriticalityService.calculate_criticality(
            metrics_map, spof_results, architecture.entities
        )

        # 5. Graph Complexity & Cycle Analysis
        complexity = ComplexityService.analyze_complexity(G)

        # 6. Dependency & Component Risk Scoring
        high_risk_deps, component_risks = RiskService.analyze_dependency_risks(
            G,
            architecture.relationships,
            architecture.entities,
            critical_components,
            spof_results,
            complexity,
        )

        # 7. Synthesize Top Architectural Insights
        top_insights: List[str] = []

        # Insight: Critical component
        if critical_components:
            top_crit = critical_components[0]
            top_insights.append(
                f"Most Critical Service: '{top_crit.name}' (Score: {top_crit.criticality_score:.2f}) "
                f"due to {', '.join([e.split(':')[0] for e in top_crit.evidence[:2]])}."
            )

        # Insight: SPOF detection
        true_spofs = [s for s in spof_results if s.is_spof]
        if true_spofs:
            top_insights.append(
                f"SPOF Alert: {len(true_spofs)} component(s) act as structural Single Points of Failure, "
                f"most severely '{true_spofs[0].name}' whose loss severs {true_spofs[0].disconnected_paths_count} path(s)."
            )
        else:
            top_insights.append("SPOF Check: No single points of failure detected; redundant routing exists.")

        # Insight: Circular dependencies
        if complexity.cycles_count > 0:
            cycle_desc = " -> ".join(complexity.simple_cycles[0] + [complexity.simple_cycles[0][0]])
            top_insights.append(
                f"Circular Dependency: Detected cycle ({cycle_desc}), creating tight coupling."
            )

        # Insight: High risk dependencies
        crit_deps = [d for d in high_risk_deps if d.risk_level in ("CRITICAL", "HIGH")]
        if crit_deps:
            top_insights.append(
                f"High-Risk Links: {len(crit_deps)} relationship(s) exhibit elevated risk, "
                f"headed by '{crit_deps[0].source_name} -> {crit_deps[0].target_name}'."
            )

        # Insight: Complexity summary
        top_insights.append(
            f"Overall Architectural Complexity: {complexity.complexity_rating} "
            f"(Density: {complexity.density:.1%}, Max Chain Depth: {complexity.max_dependency_depth} tiers)."
        )

        return Objective2AnalysisResult(
            project_id=project_id,
            system_name=architecture.systemName,
            version=architecture.version or "1.0.0",
            analyzed_at=datetime.now(timezone.utc).isoformat(),
            architecture=architecture,
            component_metrics=metrics_map,
            critical_components=critical_components,
            spofs=spof_results,
            high_risk_dependencies=high_risk_deps,
            complexity=complexity,
            component_risks=component_risks,
            top_insights=top_insights,
        )
