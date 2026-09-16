import copy
import uuid
from typing import List, Dict, Any, Set, Tuple
import networkx as nx

from ..models.schemas import (
    ArchitectureModel,
    ArchitectureEntity,
    ArchitectureRelationship,
    Objective2AnalysisResult,
    ProposedChange,
    CausalRiskFactorItem,
    ChangeStoryStep,
    ChangeSimulationResult,
)
from .pipeline_service import AnalysisPipeline
from .graph_service import GraphService


class SimulationService:
    @classmethod
    def calculate_deterministic_risk_score(cls, analysis: Objective2AnalysisResult) -> float:
        """
        Calculates a reproducible, deterministic composite structural risk score (0 - 100)
        derived entirely from NetworkX graph properties and engineering quality metrics.
        No LLMs or nondeterministic heuristics are used.
        """
        G = GraphService.build_networkx_graph(analysis.architecture)
        node_count = G.number_of_nodes()
        if node_count == 0:
            return 0.0

        # 1. Base Density & Coupling (up to 25 pts)
        density = analysis.complexity.density
        avg_degree = analysis.complexity.average_degree
        coupling_score = min(25.0, (density * 30.0) + (avg_degree * 2.5))

        # 2. Single Points of Failure (up to 30 pts)
        true_spofs = [s for s in analysis.spofs if s.is_spof]
        spof_score = min(30.0, len(true_spofs) * 12.0)

        # 3. Circular Dependencies & Cycles (up to 20 pts)
        cycles_count = analysis.complexity.cycles_count
        cycle_score = min(20.0, cycles_count * 10.0)

        # 4. Critical & High-Risk Dependencies (up to 15 pts)
        high_risk_deps = [
            d for d in analysis.high_risk_dependencies
            if d.risk_level in ("CRITICAL", "HIGH")
        ]
        dep_score = min(15.0, len(high_risk_deps) * 3.5)

        # 5. External Dependency Exposure & Depth (up to 10 pts)
        ext_nodes = [e for e in analysis.architecture.entities if e.type == 'External System']
        depth = analysis.complexity.max_dependency_depth
        ext_score = min(10.0, (len(ext_nodes) * 3.0) + max(0, depth - 3) * 1.5)

        total_score = coupling_score + spof_score + cycle_score + dep_score + ext_score
        return round(min(100.0, max(5.0, total_score)), 1)

    @classmethod
    def simulate_change(
        cls,
        current_architecture: ArchitectureModel,
        changes: List[ProposedChange],
        project_id: str = "sim-project",
    ) -> ChangeSimulationResult:
        """
        Executes an isolated Objective 3 hypothetical change simulation:
        1. Deep-copies current_architecture into an isolated hypothetical_architecture.
        2. Applies proposed changes (Add/Remove component, Add/Remove dependency).
        3. Identifies directly affected components and traces transitive dependency propagation.
        4. Runs Objective 2 pipeline on both models to obtain exact before/after metrics.
        5. Computes risk delta and generates the itemized Causal Risk Ledger.
        6. Generates the structured deterministic Change Story.
        GUARANTEE: current_architecture is NEVER mutated.
        """
        # Deep copy to guarantee complete isolation
        hypothetical = current_architecture.model_copy(deep=True)
        hypo_entities: List[ArchitectureEntity] = list(hypothetical.entities)
        hypo_relationships: List[ArchitectureRelationship] = list(hypothetical.relationships)

        entity_id_map: Dict[str, ArchitectureEntity] = {e.id: e for e in hypo_entities}
        entity_name_map: Dict[str, ArchitectureEntity] = {e.name: e for e in hypo_entities}

        directly_affected_ids: Set[str] = set()
        directly_affected_entities: List[ArchitectureEntity] = []

        # Track removed entities for impact reporting
        removed_entities_record: List[ArchitectureEntity] = []

        for change in changes:
            if change.action == 'add_component' and change.component:
                comp = change.component.model_copy(deep=True)
                if not comp.id:
                    comp.id = f"comp-{uuid.uuid4().hex[:8]}"
                hypo_entities.append(comp)
                entity_id_map[comp.id] = comp
                entity_name_map[comp.name] = comp
                directly_affected_ids.add(comp.id)
                directly_affected_entities.append(comp)

            elif change.action == 'remove_component':
                target_id = change.component_id
                if not target_id and change.component:
                    target_id = change.component.id

                found = entity_id_map.get(target_id)
                if found:
                    removed_entities_record.append(found)
                    directly_affected_ids.add(found.id)
                    directly_affected_entities.append(found)
                    hypo_entities = [e for e in hypo_entities if e.id != found.id]
                    # Also cascade-remove attached relationships in the hypothetical graph
                    hypo_relationships = [
                        r for r in hypo_relationships
                        if r.source != found.id and r.target != found.id
                    ]

            elif change.action == 'add_dependency' and change.relationship:
                rel = change.relationship.model_copy(deep=True)
                if not rel.id:
                    rel.id = f"rel-{uuid.uuid4().hex[:8]}"
                hypo_relationships.append(rel)
                directly_affected_ids.add(rel.source)
                directly_affected_ids.add(rel.target)
                src_ent = entity_id_map.get(rel.source)
                tgt_ent = entity_id_map.get(rel.target)
                if src_ent and src_ent not in directly_affected_entities:
                    directly_affected_entities.append(src_ent)
                if tgt_ent and tgt_ent not in directly_affected_entities:
                    directly_affected_entities.append(tgt_ent)

            elif change.action == 'remove_dependency':
                rel_id = change.relationship_id
                matched_rel = None
                if rel_id:
                    matched_rel = next((r for r in hypo_relationships if r.id == rel_id), None)
                elif change.relationship:
                    matched_rel = next(
                        (r for r in hypo_relationships
                         if r.source == change.relationship.source and r.target == change.relationship.target),
                        None
                    )

                if matched_rel:
                    directly_affected_ids.add(matched_rel.source)
                    directly_affected_ids.add(matched_rel.target)
                    src_ent = entity_id_map.get(matched_rel.source)
                    tgt_ent = entity_id_map.get(matched_rel.target)
                    if src_ent and src_ent not in directly_affected_entities:
                        directly_affected_entities.append(src_ent)
                    if tgt_ent and tgt_ent not in directly_affected_entities:
                        directly_affected_entities.append(tgt_ent)
                    hypo_relationships = [r for r in hypo_relationships if r.id != matched_rel.id]

        hypothetical.entities = hypo_entities
        hypothetical.relationships = hypo_relationships

        # Build NetworkX graphs for impact propagation analysis
        G_curr = GraphService.build_networkx_graph(current_architecture)
        G_hypo = GraphService.build_networkx_graph(hypothetical)

        # SEMANTICS (Part H):
        # If A -> B means "A depends on B":
        # A has B as outbound dependency. B has A as direct dependent.
        # When B changes, dependents that rely on B (G.predecessors / nx.ancestors) are impacted.
        # When A changes, outgoing dependency interactions to B (G.successors) are touched.
        indirectly_affected_ids: Set[str] = set()
        propagation_paths: List[Dict[str, Any]] = []

        # Union of current and hypothetical entities for metadata lookup
        all_known_entities: Dict[str, ArchitectureEntity] = {
            e.id: e for e in current_architecture.entities + hypothetical.entities + removed_entities_record
        }

        # Analyze upstream callers (dependents) and downstream callees (dependencies)
        for changed_id in directly_affected_ids:
            # Check upstream dependents in both graphs
            for G_active, graph_label in [(G_hypo, "hypothetical"), (G_curr, "current")]:
                if G_active.has_node(changed_id):
                    ancestors = nx.ancestors(G_active, changed_id)
                    for anc_id in ancestors:
                        if anc_id not in directly_affected_ids:
                            indirectly_affected_ids.add(anc_id)
                            try:
                                path = nx.shortest_path(G_active, anc_id, changed_id)
                                path_names = [all_known_entities.get(n, ArchitectureEntity(id=n, name=n, type="Service")).name for n in path]
                                propagation_paths.append({
                                    "source": anc_id,
                                    "target": changed_id,
                                    "path_ids": path,
                                    "path_names": path_names,
                                    "propagation_type": "Upstream Dependent Impact",
                                    "description": f"'{path_names[0]}' depends on changed component '{path_names[-1]}' via {' -> '.join(path_names)} ({graph_label} topology).",
                                })
                            except Exception:
                                pass

        # Deduplicate propagation paths by path_ids
        seen_paths: Set[Tuple[str, ...]] = set()
        unique_propagation_paths: List[Dict[str, Any]] = []
        for p in propagation_paths:
            key = tuple(p["path_ids"])
            if key not in seen_paths:
                seen_paths.add(key)
                unique_propagation_paths.append(p)

        indirectly_affected_entities = [
            all_known_entities[nid] for nid in indirectly_affected_ids if nid in all_known_entities
        ]

        # 4. Run Objective 2 Analysis on both models
        current_analysis = AnalysisPipeline.execute_analysis(
            current_architecture, project_id=f"{project_id}-baseline"
        )
        hypothetical_analysis = AnalysisPipeline.execute_analysis(
            hypothetical, project_id=f"{project_id}-hypo"
        )

        # 5. Compute Risk Scores & Delta
        curr_risk = cls.calculate_deterministic_risk_score(current_analysis)
        hypo_risk = cls.calculate_deterministic_risk_score(hypothetical_analysis)
        risk_delta = round(hypo_risk - curr_risk, 1)

        # 6. Causal Risk Ledger (deterministic structural-risk attribution)
        causal_risk_ledger: List[CausalRiskFactorItem] = []

        # (a) Dependency additions / removals
        delta_edges = len(hypothetical.relationships) - len(current_architecture.relationships)
        if delta_edges > 0:
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Increased Outbound Coupling",
                points=round(delta_edges * 4.0, 1),
                description=f"Added {delta_edges} new dependency link(s), increasing graph density and cross-service coordination overhead.",
                evidenceCount=delta_edges,
            ))
        elif delta_edges < 0:
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Reduced Dependency Coupling",
                points=round(delta_edges * 3.5, 1),
                description=f"Decommissioned {abs(delta_edges)} dependency edge(s), decoupling architecture subsystems.",
                evidenceCount=abs(delta_edges),
            ))

        # (b) Single Points of Failure shifts
        curr_spofs = {s.component_id: s for s in current_analysis.spofs if s.is_spof}
        hypo_spofs = {s.component_id: s for s in hypothetical_analysis.spofs if s.is_spof}
        new_spofs = set(hypo_spofs.keys()) - set(curr_spofs.keys())
        resolved_spofs = set(curr_spofs.keys()) - set(hypo_spofs.keys())

        if new_spofs:
            new_spof_names = [all_known_entities.get(nid, ArchitectureEntity(id=nid, name=nid, type="Service")).name for nid in new_spofs]
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Single Point of Failure Introduced",
                points=round(len(new_spofs) * 12.0, 1),
                description=f"Introduced {len(new_spofs)} new SPOF(s) ({', '.join(new_spof_names)}); failure will sever transit paths for upstream services.",
                evidenceCount=len(new_spofs),
            ))
        if resolved_spofs:
            res_spof_names = [all_known_entities.get(nid, ArchitectureEntity(id=nid, name=nid, type="Service")).name for nid in resolved_spofs]
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Single Point of Failure Eliminated",
                points=round(-len(resolved_spofs) * 10.0, 1),
                description=f"Eliminated {len(resolved_spofs)} SPOF(s) ({', '.join(res_spof_names)}) by introducing redundant paths.",
                evidenceCount=len(resolved_spofs),
            ))

        # (c) Circular Dependencies
        curr_cycles = current_analysis.complexity.cycles_count
        hypo_cycles = hypothetical_analysis.complexity.cycles_count
        delta_cycles = hypo_cycles - curr_cycles
        if delta_cycles > 0:
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Circular Dependency Loop Created",
                points=round(delta_cycles * 10.0, 1),
                description=f"Created {delta_cycles} new recursive dependency cycle(s), elevating deadlock risk and tight bidirectional coupling.",
                evidenceCount=delta_cycles,
            ))
        elif delta_cycles < 0:
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Circular Dependency Resolved",
                points=round(delta_cycles * 10.0, 1),
                description=f"Eliminated {abs(delta_cycles)} cyclic loop(s), restoring acyclic DAG structure.",
                evidenceCount=abs(delta_cycles),
            ))

        # (d) External Systems
        curr_ext = [e for e in current_architecture.entities if e.type == 'External System']
        hypo_ext = [e for e in hypothetical.entities if e.type == 'External System']
        delta_ext = len(hypo_ext) - len(curr_ext)
        if delta_ext > 0:
            new_ext_names = [e.name for e in hypo_ext if e not in curr_ext]
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Third-Party External Integration Added",
                points=round(delta_ext * 6.0, 1),
                description=f"Integrated external dependency ({', '.join(new_ext_names)}), introducing third-party network and SLA risk.",
                evidenceCount=delta_ext,
            ))
        elif delta_ext < 0:
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="External Dependency Decommissioned",
                points=round(delta_ext * 5.0, 1),
                description=f"Removed {abs(delta_ext)} external third-party boundary connection(s).",
                evidenceCount=abs(delta_ext),
            ))

        # (e) Baseline stability if ledger is empty
        if not causal_risk_ledger:
            causal_risk_ledger.append(CausalRiskFactorItem(
                factor="Neutral Architecture Adjustment",
                points=0.0,
                description="The proposed modifications did not alter critical structural risk drivers.",
                evidenceCount=0,
            ))

        # 7. Change Story
        change_story: List[ChangeStoryStep] = []
        change_story.append(ChangeStoryStep(
            step=1,
            title="Proposed Changes Application",
            description=f"Applied {len(changes)} modification(s) across {len(directly_affected_entities)} directly affected entity/entities in isolated simulation.",
            category="Scope & Staging",
        ))

        change_story.append(ChangeStoryStep(
            step=2,
            title="Dependency Propagation Analysis",
            description=(
                f"Identified {len(indirectly_affected_entities)} upstream dependent component(s) "
                f"across {len(unique_propagation_paths)} transitive propagation path(s)."
                if indirectly_affected_entities
                else "No upstream dependent services are indirectly impacted by this modification."
            ),
            category="Blast Radius",
        ))

        change_story.append(ChangeStoryStep(
            step=3,
            title="Structural Risk Shift",
            description=(
                f"Modelled structural risk score transitioned from {curr_risk} to {hypo_risk} (Net Delta: {risk_delta:+0.1f}). "
                f"{'Risk increased due to new architectural obligations.' if risk_delta > 0 else 'Risk reduced or preserved via architectural simplification.' if risk_delta < 0 else 'Risk posture remains neutral.'}"
            ),
            category="Risk Delta",
        ))

        top_driver = causal_risk_ledger[0]
        change_story.append(ChangeStoryStep(
            step=4,
            title="Deterministic Causal Attribution",
            description=f"Primary risk driver: {top_driver.factor} ({top_driver.points:+} pts) - {top_driver.description}",
            category="Causal Attribution",
        ))

        return ChangeSimulationResult(
            current_architecture=current_architecture,
            hypothetical_architecture=hypothetical,
            current_analysis=current_analysis,
            hypothetical_analysis=hypothetical_analysis,
            directly_affected_nodes=directly_affected_entities,
            indirectly_affected_nodes=indirectly_affected_entities,
            propagation_paths=unique_propagation_paths,
            current_risk_score=curr_risk,
            hypothetical_risk_score=hypo_risk,
            risk_delta=risk_delta,
            causal_risk_ledger=causal_risk_ledger,
            change_story=change_story,
        )
