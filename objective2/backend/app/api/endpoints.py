import json
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session

from ..models.schemas import (
    ArchitectureModel,
    Objective2AnalysisResult,
    ComponentMetrics,
    CriticalComponent,
    SpofAnalysis,
    ComplexityAnalysis,
    HighRiskDependency,
)
from ..models.database import ProjectRecord, AnalysisRecord
from ..database.session import get_db
from ..data.demo_architecture import DEMO_ARCHITECTURE
from ..services.pipeline_service import AnalysisPipeline
from ..services.codebase_service import CodebaseService

router = APIRouter(prefix="/api/v1", tags=["Objective 2 Architecture Analysis"])

# In-memory fast cache for quick lookup
_LATEST_ANALYSIS_CACHE: Dict[str, Objective2AnalysisResult] = {}

@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "TraceIQ Objective 2 Analysis Engine"}

@router.get("/demo", response_model=ArchitectureModel)
def get_demo_architecture():
    """
    Returns the realistic 13-node, 20-edge demo architecture crafted for Objective 2.
    """
    return DEMO_ARCHITECTURE

@router.post("/architecture/import", response_model=Dict[str, Any])
def import_architecture(
    model: ArchitectureModel, db: Session = Depends(get_db)
):
    """
    Imports and stores an Objective-1-compatible architecture blueprint JSON.
    """
    project_id = f"proj-{uuid.uuid4().hex[:8]}"
    project_record = ProjectRecord(
        id=project_id,
        name=model.systemName,
        version=model.version or "1.0.0",
        architecture_json=model.model_dump_json(),
    )
    db.add(project_record)
    db.commit()

    return {
        "success": True,
        "project_id": project_id,
        "system_name": model.systemName,
        "entities_count": len(model.entities),
        "relationships_count": len(model.relationships),
    }

@router.post("/codebase/upload")
async def upload_codebase(
    file: UploadFile = File(...),
    project_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Accepts a codebase ZIP archive, extracts architecture components and dependencies,
    and runs the Objective 2 graph analysis pipeline on the extracted system.
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .zip archive.")

    try:
        content = await file.read()
        architecture = CodebaseService.extract_from_zip(content, filename=file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract codebase: {str(e)}")

    if not architecture.entities:
        raise HTTPException(status_code=400, detail="No architectural components could be extracted from this codebase.")

    proj_id = project_id or f"proj-{uuid.uuid4().hex[:8]}"

    # Run complete analysis
    analysis = AnalysisPipeline.execute_analysis(architecture, project_id=proj_id)
    _LATEST_ANALYSIS_CACHE[proj_id] = analysis
    _LATEST_ANALYSIS_CACHE["current-project"] = analysis

    # Persist in SQLite
    try:
        project_record = ProjectRecord(
            id=proj_id,
            name=architecture.systemName,
            version=architecture.version or "1.0.0",
            architecture_json=architecture.model_dump_json(),
        )
        db.add(project_record)

        run_record = AnalysisRecord(
            id=f"run-{uuid.uuid4().hex[:8]}",
            project_id=proj_id,
            critical_count=len([c for c in analysis.critical_components if c.criticality_tier == "CRITICAL"]),
            high_risk_count=len([d for d in analysis.high_risk_dependencies if d.risk_level in ("CRITICAL", "HIGH")]),
            spof_count=len([s for s in analysis.spofs if s.is_spof]),
            complexity_rating=analysis.complexity.complexity_rating,
            result_json=analysis.model_dump_json(),
        )
        db.add(run_record)
        db.commit()
    except Exception:
        db.rollback()

    return {
        "architecture": architecture,
        "analysis": analysis
    }

@router.post("/analyze", response_model=Objective2AnalysisResult)
def analyze_architecture(
    model: ArchitectureModel, project_id: str = "current-project", db: Session = Depends(get_db)
):
    """
    Runs the complete Objective 2 dependency analysis on the provided architecture model.
    """
    if not model.entities:
        raise HTTPException(status_code=400, detail="Architecture must contain at least 1 entity.")

    result = AnalysisPipeline.execute_analysis(model, project_id=project_id)
    _LATEST_ANALYSIS_CACHE[project_id] = result

    # Persist in SQLite
    try:
        run_record = AnalysisRecord(
            id=f"run-{uuid.uuid4().hex[:8]}",
            project_id=project_id,
            critical_count=len([c for c in result.critical_components if c.criticality_tier == "CRITICAL"]),
            high_risk_count=len([d for d in result.high_risk_dependencies if d.risk_level in ("CRITICAL", "HIGH")]),
            spof_count=len([s for s in result.spofs if s.is_spof]),
            complexity_rating=result.complexity.complexity_rating,
            result_json=result.model_dump_json(),
        )
        db.add(run_record)
        db.commit()
    except Exception:
        db.rollback()

    return result

@router.get("/projects/{project_id}/analysis", response_model=Objective2AnalysisResult)
def get_project_analysis(project_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the latest analysis result for a project.
    """
    if project_id in _LATEST_ANALYSIS_CACHE:
        return _LATEST_ANALYSIS_CACHE[project_id]

    if project_id in ("demo", "demo-project"):
        result = AnalysisPipeline.execute_analysis(DEMO_ARCHITECTURE, project_id="demo-project")
        _LATEST_ANALYSIS_CACHE[project_id] = result
        return result

    # Check database
    run_record = (
        db.query(AnalysisRecord)
        .filter(AnalysisRecord.project_id == project_id)
        .order_by(AnalysisRecord.analyzed_at.desc())
        .first()
    )
    if run_record:
        data = json.loads(run_record.result_json)
        return Objective2AnalysisResult(**data)

    raise HTTPException(status_code=404, detail=f"No analysis found for project '{project_id}'.")

@router.get("/projects/{project_id}/metrics", response_model=Dict[str, ComponentMetrics])
def get_component_metrics(project_id: str, db: Session = Depends(get_db)):
    analysis = get_project_analysis(project_id, db)
    return analysis.component_metrics

@router.get("/projects/{project_id}/critical-components", response_model=List[CriticalComponent])
def get_critical_components(project_id: str, db: Session = Depends(get_db)):
    analysis = get_project_analysis(project_id, db)
    return analysis.critical_components

@router.get("/projects/{project_id}/spofs", response_model=List[SpofAnalysis])
def get_spofs(project_id: str, db: Session = Depends(get_db)):
    analysis = get_project_analysis(project_id, db)
    return analysis.spofs

@router.get("/projects/{project_id}/complexity", response_model=ComplexityAnalysis)
def get_complexity(project_id: str, db: Session = Depends(get_db)):
    analysis = get_project_analysis(project_id, db)
    return analysis.complexity

@router.get("/projects/{project_id}/risk-analysis", response_model=Dict[str, Any])
def get_risk_analysis(project_id: str, db: Session = Depends(get_db)):
    analysis = get_project_analysis(project_id, db)
    return {
        "high_risk_dependencies": analysis.high_risk_dependencies,
        "component_risks": analysis.component_risks,
    }
