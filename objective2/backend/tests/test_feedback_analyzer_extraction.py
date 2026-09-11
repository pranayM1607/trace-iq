import os
import pytest
from pathlib import Path
from app.services.codebase_service import CodebaseService
from app.services.pipeline_service import AnalysisPipeline

FEEDBACK_ZIP = r"C:\Users\prana\Downloads\AI-Customer-Feedback-Analyzer-main.zip"

@pytest.mark.skipif(not os.path.exists(FEEDBACK_ZIP), reason="Real feedback analyzer ZIP not in Downloads")
def test_feedback_analyzer_real_extraction():
    with open(FEEDBACK_ZIP, "rb") as f:
        zip_bytes = f.read()

    arch = CodebaseService.extract_from_zip(zip_bytes, "AI-Customer-Feedback-Analyzer-main.zip")

    # 1. Verify Entities
    assert len(arch.entities) >= 3, f"Expected at least 3 entities, got {len(arch.entities)}"
    
    app_ent = next((e for e in arch.entities if e.type == "Application"), None)
    assert app_ent is not None, "Application entity should be extracted"
    assert "Streamlit" in app_ent.technology, f"Expected Streamlit tech, got {app_ent.technology}"

    gemini_ent = next((e for e in arch.entities if "gemini" in e.id.lower() or "gemini" in e.name.lower()), None)
    assert gemini_ent is not None, "Google Gemini API External System should be extracted"
    assert gemini_ent.type == "External System"

    ds_ent = next((e for e in arch.entities if e.type == "Database"), None)
    assert ds_ent is not None, "Dataset Store Database should be extracted"
    assert "CSV" in ds_ent.technology or "Tabular" in ds_ent.technology

    # 2. Verify Relationships
    assert len(arch.relationships) >= 2, f"Expected at least 2 relationships, got {len(arch.relationships)}"
    
    gemini_rel = next((r for r in arch.relationships if r.target == gemini_ent.id), None)
    assert gemini_rel is not None, "Should have relationship to Google Gemini API"
    assert gemini_rel.type == "CALLS"

    ds_rel = next((r for r in arch.relationships if r.target == ds_ent.id), None)
    assert ds_rel is not None, "Should have relationship to Datasets Store"
    assert ds_rel.type == "QUERIES"

    # 3. Verify Codebase Graph
    assert arch.codebaseGraph is not None
    assert len(arch.codebaseGraph.nodes) >= 5
    assert len(arch.codebaseGraph.edges) >= 1

    # 4. Verify Pipeline Analysis
    analysis = AnalysisPipeline.execute_analysis(arch, project_id="test-feedback-analyzer")
    assert analysis is not None
    assert len(analysis.critical_components) >= 3
    assert len(analysis.high_risk_dependencies) >= 1
