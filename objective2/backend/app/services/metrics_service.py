from typing import Dict, List
import networkx as nx
from ..models.schemas import ComponentMetrics, ArchitectureEntity

class MetricsService:
    @staticmethod
    def calculate_longest_path(
        G: nx.DiGraph, start_node: str, reverse: bool = False, max_limit: int = 15
    ) -> List[str]:
        """
        Calculates the longest simple directed path starting from start_node
        (or ending at start_node if reverse=True).
        Cycle-safe BFS with visited set.
        """
        graph = G.reverse() if reverse else G
        if graph.out_degree(start_node) == 0:
            return [start_node]

        longest_path = [start_node]
        queue = [([start_node], {start_node})]

        while queue:
            path, visited = queue.pop(0)
            if len(path) > len(longest_path):
                longest_path = path

            if len(path) >= max_limit:
                continue

            curr = path[-1]
            for nxt in graph.successors(curr):
                if nxt not in visited:
                    queue.append((path + [nxt], visited | {nxt}))

        if reverse:
            longest_path.reverse()

        return longest_path

    @staticmethod
    def find_sample_paths_through_node(
        G: nx.DiGraph, node: str, max_paths: int = 3
    ) -> List[List[str]]:
        """
        Finds concrete shortest paths between pairs of components (s != node != t)
        that transit through this node. Used as structural evidence for Betweenness Centrality.
        """
        paths: List[List[str]] = []
        ancestors = list(nx.ancestors(G, node))
        descendants = list(nx.descendants(G, node))

        for s in ancestors[:10]:
            for t in descendants[:10]:
                try:
                    p = nx.shortest_path(G, s, t)
                    if node in p[1:-1]:  # strictly an intermediary
                        if p not in paths:
                            paths.append(p)
                        if len(paths) >= max_paths:
                            return paths
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue
        return paths

    @staticmethod
    def _pure_python_pagerank(G: nx.DiGraph, alpha: float = 0.85, max_iter: int = 100, tol: float = 1e-6) -> Dict[str, float]:
        nodes = list(G.nodes())
        N = len(nodes)
        if N == 0:
            return {}
        if G.number_of_edges() == 0:
            return {n: 1.0 / N for n in nodes}
        p = {n: 1.0 / N for n in nodes}
        for _ in range(max_iter):
            p_next = {n: (1.0 - alpha) / N for n in nodes}
            dangling_sum = sum(p[n] for n in nodes if G.out_degree(n) == 0)
            dangling_contrib = alpha * dangling_sum / N
            for n in nodes:
                p_next[n] += dangling_contrib
            for u in nodes:
                out_deg = G.out_degree(u)
                if out_deg > 0:
                    share = alpha * p[u] / out_deg
                    for v in G.successors(u):
                        p_next[v] += share
            diff = sum(abs(p_next[n] - p[n]) for n in nodes)
            p = p_next
            if diff < tol:
                break
        return p

    @classmethod
    def calculate_all_metrics(
        cls, G: nx.DiGraph, entities: List[ArchitectureEntity]
    ) -> Dict[str, ComponentMetrics]:
        """
        Calculates comprehensive mathematical graph metrics for all components in the architecture.
        Every metric is directly derived from the NetworkX directed graph topology.
        """
        metrics_map: Dict[str, ComponentMetrics] = {}
        node_count = G.number_of_nodes()

        if node_count == 0:
            return metrics_map

        # Centrality metrics
        betweenness = nx.betweenness_centrality(G, normalized=True)
        try:
            pagerank = nx.pagerank(G, alpha=0.85, max_iter=200)
        except Exception:
            # High-fidelity pure-Python power iteration fallback
            pagerank = cls._pure_python_pagerank(G, alpha=0.85, max_iter=100)

        for entity in entities:
            node_id = entity.id
            if not G.has_node(node_id):
                continue

            in_deg = G.in_degree(node_id)
            out_deg = G.out_degree(node_id)
            tot_deg = in_deg + out_deg

            # Direct callers (dependents): distinct nodes with an edge pointing into node_id
            direct_callers = sorted(list(G.predecessors(node_id)))

            # Direct dependencies (callees): distinct nodes node_id points into
            direct_dependencies = sorted(list(G.successors(node_id)))

            # Upstream Callers (Transitive Blast Radius): All nodes that have a directed path to this node
            upstream_callers = sorted(list(nx.ancestors(G, node_id)))

            # Downstream Dependents (Transitive Footprint): All nodes reachable from this node
            downstream_dependents = sorted(list(nx.descendants(G, node_id)))

            # Maximum downstream outgoing dependency chain (callees)
            longest_downstream = cls.calculate_longest_path(G, node_id, reverse=False)
            downstream_depth = max(0, len(longest_downstream) - 1)

            # Maximum upstream incoming failure propagation chain (callers)
            longest_upstream = cls.calculate_longest_path(G, node_id, reverse=True)
            upstream_depth = max(0, len(longest_upstream) - 1)

            # Sample shortest paths transiting through this node (Betweenness evidence)
            paths_through = cls.find_sample_paths_through_node(G, node_id, max_paths=3)

            metrics_map[node_id] = ComponentMetrics(
                component_id=node_id,
                name=entity.name,
                type=entity.type,
                in_degree=in_deg,
                out_degree=out_deg,
                total_degree=tot_deg,
                betweenness_centrality=round(float(betweenness.get(node_id, 0.0)), 4),
                pagerank=round(float(pagerank.get(node_id, 0.0)), 4),
                direct_callers_count=len(direct_callers),
                direct_callers=direct_callers,
                direct_dependencies_count=len(direct_dependencies),
                direct_dependencies=direct_dependencies,
                upstream_callers_count=len(upstream_callers),
                upstream_callers=upstream_callers,
                downstream_dependents_count=len(downstream_dependents),
                downstream_dependents=downstream_dependents,
                max_dependency_depth=downstream_depth,
                max_propagation_depth=upstream_depth,
                longest_downstream_path=longest_downstream,
                longest_upstream_path=longest_upstream,
                transitive_paths_through=paths_through,
            )

        return metrics_map
