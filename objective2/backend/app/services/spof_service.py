from typing import Dict, List, Set
import networkx as nx
from ..models.schemas import SpofAnalysis, ArchitectureEntity, SpofSeverity

class SpofService:
    @classmethod
    def detect_spofs(
        cls, G: nx.DiGraph, entities: List[ArchitectureEntity]
    ) -> List[SpofAnalysis]:
        r"""
        Executes counterfactual algorithmic Single Point of Failure (SPOF) detection.
        For each component v:
        1. Analyzes baseline pairwise reachability R_G(s, t).
        2. Simulates removal of v: G' = G \ {v}.
        3. Identifies severed dependency paths and isolated downstream/upstream components.
        4. Classifies potential SPOFs with concrete structural evidence and exact path sequences.
        """
        spof_results: List[SpofAnalysis] = []
        entity_map = {e.id: e for e in entities}
        nodes = list(G.nodes())

        if len(nodes) <= 1:
            return spof_results

        # Precompute baseline reachability across all ordered pairs (s, t)
        baseline_reachable_pairs = set()
        for s in nodes:
            for t in nx.descendants(G, s):
                baseline_reachable_pairs.add((s, t))

        for entity in entities:
            v = entity.id
            if not G.has_node(v):
                continue

            # Simulate removal of component v
            G_sub = G.copy()
            G_sub.remove_node(v)

            # Check transitively severed paths between other nodes (s -> v -> t)
            transitively_severed_pairs = []
            transitively_severed_targets = set()
            affected_callers = set()
            concrete_severed_paths: List[List[str]] = []

            for s, t in baseline_reachable_pairs:
                if s == v or t == v:
                    continue  # Paths directly targeting or starting from v handled below
                if not nx.has_path(G_sub, s, t):
                    transitively_severed_pairs.append((s, t))
                    transitively_severed_targets.add(t)
                    affected_callers.add(s)
                    if len(concrete_severed_paths) < 6:
                        try:
                            # Reconstruct baseline path that traversed v
                            base_path = nx.shortest_path(G, s, t)
                            if v in base_path:
                                concrete_severed_paths.append(base_path)
                        except Exception:
                            pass

            # Check callers impacted if v itself is a shared dependency or sink
            ancestors = set(nx.ancestors(G, v))
            direct_callers = set(G.predecessors(v))

            # If v is an intermediate transit bridge:
            is_transit_spof = len(transitively_severed_pairs) > 0

            # If v is a shared terminal/persistence sink with multiple dependent services:
            # (e.g. un-replicated database or external provider shared by >= 2 services)
            is_shared_sink_spof = (
                (entity.type in ("Database", "External System") or G.out_degree(v) == 0)
                and len(direct_callers) >= 2
            )

            is_spof = is_transit_spof or is_shared_sink_spof

            # Total disconnected paths count
            disconnected_count = len(transitively_severed_pairs)
            if is_shared_sink_spof:
                disconnected_count += len(ancestors)
                # Add sample paths from callers to this sink
                for caller in list(direct_callers)[:4]:
                    concrete_severed_paths.append([caller, v])

            # Affected components include both isolated targets and disrupted callers
            affected_ids: Set[str] = set()
            if is_transit_spof:
                affected_ids.update(transitively_severed_targets)
                affected_ids.update(affected_callers)
            if is_shared_sink_spof:
                affected_ids.update(direct_callers)
                affected_ids.update(ancestors)

            severed_component_ids = sorted(list(affected_ids))
            severed_component_names = [
                entity_map[t].name if t in entity_map else t for t in severed_component_ids
            ]

            # Determine severity based on structural impact
            severity: SpofSeverity = "NONE"
            spof_type = "TRANSIT"
            if is_spof:
                if is_shared_sink_spof and not is_transit_spof:
                    spof_type = "SHARED_DATASTORE"
                else:
                    spof_type = "TRANSIT"

                if disconnected_count >= 5 or (is_shared_sink_spof and len(direct_callers) >= 4):
                    severity = "CRITICAL"
                elif disconnected_count >= 2 or len(direct_callers) >= 2:
                    severity = "HIGH"
                else:
                    severity = "MEDIUM"

                if spof_type == "SHARED_DATASTORE":
                    explanation = (
                        f"Shared Datastore SPOF: '{entity.name}' is an un-replicated terminal resource; "
                        f"outage directly disables {len(direct_callers)} caller service(s): "
                        f"{', '.join(severed_component_names[:3])}"
                        f"{' and more' if len(severed_component_names) > 3 else ''}."
                    )
                else:
                    explanation = (
                        f"Architectural Transit SPOF: Removal of '{entity.name}' permanently severs "
                        f"{disconnected_count} dependency path(s), disrupting {len(severed_component_names)} "
                        f"dependent component(s): {', '.join(severed_component_names[:3])}"
                        f"{' and more' if len(severed_component_names) > 3 else ''}."
                    )
            else:
                explanation = (
                    f"Component '{entity.name}' has redundant alternative paths or is an edge leaf; "
                    f"removal does not sever critical inter-service dependency workflows."
                )

            spof_results.append(
                SpofAnalysis(
                    component_id=v,
                    name=entity.name,
                    type=entity.type,
                    technology=entity.technology,
                    is_spof=is_spof,
                    spof_type=spof_type,
                    disconnected_paths_count=disconnected_count,
                    affected_components_count=len(severed_component_ids),
                    severed_components=severed_component_ids,
                    severed_component_names=severed_component_names,
                    severed_paths=concrete_severed_paths,
                    has_alternate_path=not is_spof,
                    severity=severity,
                    explanation=explanation,
                )
            )

        return spof_results
