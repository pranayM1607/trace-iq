import os
import io
import zipfile
import pytest
from app.services.codebase_service import CodebaseService
from app.services.pipeline_service import AnalysisPipeline

REAL_ZIP_PATHS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'testing files', 'phishing-ai-extention-main (1).zip')),
    r'C:\Users\prana\Downloads\phishing-ai-extention-main (1).zip',
]
REAL_ZIP_PATH = next((p for p in REAL_ZIP_PATHS if os.path.exists(p)), REAL_ZIP_PATHS[0])

@pytest.mark.skipif(not os.path.exists(REAL_ZIP_PATH), reason='Real test zip not present on machine')
def test_real_phishing_zip_ingestion_and_relationship_extraction():
    with open(REAL_ZIP_PATH, 'rb') as f:
        zip_bytes = f.read()

    arch = CodebaseService.extract_from_zip(zip_bytes, 'phishing-ai-extention-main (1).zip')

    # 1. Total file retention
    assert arch.inventory is not None
    assert arch.inventory.total_files >= 50, f'Expected >= 50 files, got {arch.inventory.total_files}'

    # 2. Multi-subsystem entity diversity
    types_present = {e.type for e in arch.entities}
    assert 'Application' in types_present, 'Expected Application entity (e.g. Chrome Extension or Mobile App)'
    assert 'Service' in types_present, 'Expected Service entity (e.g. Flask API)'
    assert 'Infrastructure' in types_present, 'Expected Infrastructure entity (e.g. ML Models)'
    assert 'Database' in types_present, 'Expected Database entity (e.g. Datasets)'
    assert 'Worker' in types_present or 'Module' in types_present

    # 3. NOT 0 dependencies: Architecture relationships must exist
    assert len(arch.relationships) > 0, f'Expected real architectural relationships, got {len(arch.relationships)}'
    assert len(arch.relationships) >= 5, f'Expected >= 5 relationships, got {len(arch.relationships)}'

    # Check specific architectural edges
    rel_signatures = {(r.source, r.target, r.type) for r in arch.relationships}
    
    # Extension should call an API
    has_extension_call = any(
        'ext' in s and 'predict' in r.description.lower() for s, t, typ in rel_signatures for r in arch.relationships if r.source == s and r.target == t
    )
    assert has_extension_call, 'Expected Browser Extension to call API (/predict)'

    # Pipeline should query datasets and publish models
    has_model_dep = any(t == 'ml-model-artifacts' for s, t, typ in rel_signatures)
    assert has_model_dep, 'Expected dependency on ML model artifacts'

    # 4. Codebase Graph: File-level dependencies
    assert len(arch.inventory.file_dependencies) >= 10, f'Expected >= 10 file dependencies, got {len(arch.inventory.file_dependencies)}'
    file_dep_types = {d.type for d in arch.inventory.file_dependencies}
    assert 'CALLS' in file_dep_types or 'IMPORTS' in file_dep_types or 'USES' in file_dep_types

    # 5. Non-arbitrary Criticality & Risk Tiers (NOT all 8 High!)
    analysis = AnalysisPipeline.execute_analysis(arch)
    crit_tiers = {c.criticality_tier for c in analysis.critical_components}
    
    # Must have both high/critical AND low components
    assert 'LOW' in crit_tiers, 'Peripheral/leaf components must receive LOW criticality'
    assert 'HIGH' in crit_tiers or 'CRITICAL' in crit_tiers, 'Central hubs must receive HIGH/CRITICAL criticality'
    
    # Verify SPOF detection on central hubs
    spofs = [s for s in analysis.spofs if s.is_spof]
    assert len(spofs) > 0, 'Expected real SPOFs detected on single central bottlenecks'
