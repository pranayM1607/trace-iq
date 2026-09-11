from typing import Dict, Any, List
import networkx as nx
from ..models.schemas import ArchitectureModel, ArchitectureEntity, ArchitectureRelationship

class GraphService:
    @staticmethod
    def build_networkx_graph(architecture: ArchitectureModel) -> nx.DiGraph:
        """
        Constructs a NetworkX directed graph G = (V, E) from the architecture model.
        Nodes represent components with full metadata attributes.
        Edges represent directed dependency relationships (source -> target: source calls/depends on target).
        """
        G = nx.DiGraph()

        # Add nodes with all architectural attributes
        for entity in architecture.entities:
            G.add_node(
                entity.id,
                name=entity.name,
                type=entity.type,
                technology=entity.technology,
                source=entity.source,
                description=entity.description or "",
                metadata=entity.metadata or {}
            )

        # Add directed edges
        for rel in architecture.relationships:
            # Ensure endpoints exist (in case of loose relationships)
            if not G.has_node(rel.source):
                G.add_node(rel.source, name=rel.source, type="Service", technology="Generic")
            if not G.has_node(rel.target):
                G.add_node(rel.target, name=rel.target, type="Service", technology="Generic")

            G.add_edge(
                rel.source,
                rel.target,
                id=rel.id,
                type=rel.type,
                protocol=rel.protocol or "Default",
                description=rel.description or f"{rel.source} {rel.type} {rel.target}"
            )

        return G

    @staticmethod
    def validate_graph(G: nx.DiGraph) -> Dict[str, Any]:
        """
        Validates the graph topology and returns basic structural status.
        """
        return {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "is_directed": G.is_directed(),
            "is_empty": G.number_of_nodes() == 0,
            "connected_components": nx.number_weakly_connected_components(G) if G.number_of_nodes() > 0 else 0
        }
