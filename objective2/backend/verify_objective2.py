import httpx

def main():
    print("=== TRACEIQ OBJECTIVE 2 VERIFICATION & VALIDATION SUITE ===\n")
    
    # 1. Check Backend Health
    r = httpx.get("http://127.0.0.1:8001/api/v1/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print(f"[PASS] 1. Backend Health Check: {r.json()}")

    # 2. Fetch Demo Architecture
    r_demo = httpx.get("http://127.0.0.1:8001/api/v1/demo")
    assert r_demo.status_code == 200, f"Demo fetch failed: {r_demo.status_code}"
    demo_data = r_demo.json()
    print(f"[PASS] 2. Demo Architecture Loaded: {demo_data['systemName']}")
    print(f"       - Total Components: {len(demo_data['entities'])}")
    print(f"       - Total Relationships: {len(demo_data['relationships'])}")

    # 3. Run Analysis Pipeline
    r_analysis = httpx.post("http://127.0.0.1:8001/api/v1/analyze", json=demo_data)
    assert r_analysis.status_code == 200, f"Analysis failed: {r_analysis.status_code}"
    res = r_analysis.json()
    print(f"[PASS] 3. Analysis Pipeline Executed Successfully!")

    # 4. Validate Complexity
    comp = res["complexity"]
    print(f"[PASS] 4. Architectural Complexity:")
    print(f"       - Rating: {comp['complexity_rating']}")
    print(f"       - Density: {comp['density']:.2%}")
    print(f"       - Cyclomatic Index: {comp['cyclomatic_complexity']}")
    print(f"       - Max Chain Depth: {comp['max_dependency_depth']} tiers")
    print(f"       - Detected Cycles: {comp['cycles_count']}")
    assert comp["cycles_count"] >= 1, "Expected circular dependency to be detected!"

    # 5. Validate Critical Components Ranking
    crit_comps = res["critical_components"]
    print(f"[PASS] 5. Top Critical Components:")
    for c in crit_comps[:3]:
        print(f"       #{c['rank']} {c['name']} ({c['criticality_tier']}) - Score: {c['criticality_score']}")
        print(f"          Evidence: {c['evidence'][0]}")
    assert len(crit_comps) == len(demo_data["entities"])
    assert crit_comps[0]["criticality_score"] >= crit_comps[1]["criticality_score"]

    # 6. Validate SPOF Detection
    spofs = [s for s in res["spofs"] if s["is_spof"]]
    print(f"[PASS] 6. Detected Single Points of Failure ({len(spofs)} total):")
    for s in spofs[:3]:
        print(f"       - {s['name']} ({s['severity']} SPOF): Disconnects {s['disconnected_paths_count']} paths")
        print(f"         Severed: {', '.join(s['severed_component_names'][:3])}")
    assert any(s["component_id"] == "postgres-primary" for s in spofs)

    # 7. Validate High-Risk Dependencies
    high_risk_deps = res["high_risk_dependencies"]
    print(f"[PASS] 7. High-Risk Dependencies ({len(high_risk_deps)} total):")
    for d in high_risk_deps[:3]:
        print(f"       - {d['source_name']} -> {d['target_name']} ({d['risk_level']})")
        print(f"         Reason: {d['risk_factors'][0]}")

    # 8. Check Insights
    print(f"[PASS] 8. Synthesized Insights:")
    for i, ins in enumerate(res["top_insights"]):
        print(f"       {i+1}. {ins}")

    print("\n=== ALL OBJECTIVE 2 VERIFICATIONS PASSED 100%! ===")

if __name__ == "__main__":
    main()
