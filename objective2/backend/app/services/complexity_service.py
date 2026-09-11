from typing import Dict, List, Any
import networkx as nx
from ..models.schemas import ComplexityAnalysis, ComplexityRating

class ComplexityService:
    @classmethod
    def analyze_complexity(cls, G: nx.DiGraph) -> ComplexityAnalysis:
        """
        Calculates mathematical architectural complexity metrics based on graph theory.
        Derived from density, cyclomatic complexity, circular dependencies, depth, and connectivity.
        """
        n = G.number_of_nodes()
        e = G.number_of_edges()

        if n == 0:
            return ComplexityAnalysis(
                node_count=0,
                edge_count=0,
                average_degree=0.0,
                density=0.0,
                cyclomatic_complexity=0,
                max_dependency_depth=0,
                cycles_count=0,
                simple_cycles=[],
                scc_count=0,
                complexity_rating="LOW",
                summary="Empty architecture with no components.",
                factors={},
            )

        # Average degree: (2 * E) / V
        avg_degree = round((2.0 * e) / n, 2)

        # Graph density: E / (V * (V - 1)) for directed graphs
        density = round(e / (n * (n - 1)), 4) if n > 1 else 0.0

        # Number of weakly connected components
        num_components = nx.number_weakly_connected_components(G)

        # McCabe Cyclomatic Complexity for directed graphs: M = E - V + 2P
        cyclomatic = max(1, e - n + (2 * num_components))

        # Cycles detection (Johnson's simple cycles algorithm)
        try:
            cycles_gen = nx.simple_cycles(G)
            # Limit to at most 10 cycles for practical display
            cycles: List[List[str]] = []
            for c in cycles_gen:
                cycles.append(c)
                if len(cycles) >= 10:
                    break
        except Exception:
            cycles = []

        cycles_count = len(cycles)

        # Strongly Connected Components (SCC)
        scc_count = nx.number_strongly_connected_components(G)

        # Maximum dependency depth across the architecture
        max_depth = 0
        try:
            # If DAG, use longest path
            if nx.is_directed_acyclic_graph(G):
                max_depth = nx.dag_longest_path_length(G)
            else:
                # Condensation of SCCs forms a DAG
                condensation = nx.condensation(G)
                max_depth = nx.dag_longest_path_length(condensation)
        except Exception:
            max_depth = 3

        # Deterministic Complexity Rating Calculation
        # Base signals: density, cyclomatic index, presence of cycles, and depth
        complexity_score = 0.0

        # Density contribution (0 to 3 points)
        if density > 0.20:
            complexity_score += 3.0
        elif density > 0.12:
            complexity_score += 2.0
        elif density > 0.06:
            complexity_score += 1.0

        # Cyclomatic complexity contribution
        if cyclomatic > 10:
            complexity_score += 3.0
        elif cyclomatic > 5:
            complexity_score += 2.0
        elif cyclomatic > 2:
            complexity_score += 1.0

        # Circular dependencies contribution (severe anti-pattern)
        if cycles_count > 0:
            complexity_score += 3.0

        # Depth contribution
        if max_depth >= 5:
            complexity_score += 2.0
        elif max_depth >= 3:
            complexity_score += 1.0

        # Rating classification
        rating: ComplexityRating
        if complexity_score >= 7.0:
            rating = "HIGH"
        elif complexity_score >= 3.5:
            rating = "MEDIUM"
        else:
            rating = "LOW"

        # Construct explainable summary
        summary_parts = []
        summary_parts.append(
            f"Architecture exhibits {rating} structural complexity (Density: {density:.2%}, Cyclomatic: {cyclomatic})."
        )
        if cycles_count > 0:
            summary_parts.append(
                f"ALERT: {cycles_count} circular dependency chain(s) detected, introducing tight coupling and deadlock risks."
            )
        if max_depth >= 4:
            summary_parts.append(
                f"Deep dependency chains present (Maximum chain depth: {max_depth} tiers), increasing end-to-end latency and failure propagation."
            )
        else:
            summary_parts.append(
                f"Dependency depth is well-contained ({max_depth} tiers), allowing clean service isolation."
            )

        summary = " ".join(summary_parts)

        return ComplexityAnalysis(
            node_count=n,
            edge_count=e,
            average_degree=avg_degree,
            density=density,
            cyclomatic_complexity=cyclomatic,
            max_dependency_depth=max_depth,
            cycles_count=cycles_count,
            simple_cycles=cycles,
            scc_count=scc_count,
            weakly_connected_components=num_components,
            formula_explanation=f"TraceIQ Architectural Cyclomatic Score: M = E - V + 2P = {e} - {n} + 2({num_components}) = {cyclomatic}",
            complexity_rating=rating,
            summary=summary,
            factors={
                "density_score": round(density, 4),
                "cyclomatic_number": cyclomatic,
                "cycles_penalty": cycles_count * 2.0,
                "chain_depth": max_depth,
                "composite_complexity_points": round(complexity_score, 1),
            },
        )
