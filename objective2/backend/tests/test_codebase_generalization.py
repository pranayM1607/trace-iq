import io
import zipfile
import pytest
from app.services.codebase_service import CodebaseService
from app.services.pipeline_service import AnalysisPipeline
from app.models.schemas import ArchitectureModel

def create_in_memory_zip(file_dict: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in file_dict.items():
            if isinstance(content, str):
                zf.writestr(path, content.encode("utf-8"))
            else:
                zf.writestr(path, content)
    return buf.getvalue()

def test_multi_service_extraction():
    files = {
        "docker-compose.yml": """
services:
  gateway:
    image: envoy:latest
    depends_on:
      - auth-service
      - order-service
  auth-service:
    image: auth-service:latest
    environment:
      - REDIS_URL=redis://redis-broker:6379
  order-service:
    image: order-service:latest
    environment:
      - DATABASE_URL=postgres://order-db:5432/orders
  order-db:
    image: postgres:15
  redis-broker:
    image: redis:7
""",
        "services/gateway/Dockerfile": "FROM envoy:latest",
        "services/auth/go.mod": "module auth-service\ngo 1.22",
        "services/auth/main.go": 'package main\nimport "github.com/gin-gonic/gin"\nfunc main() {}',
        "services/order/package.json": '{"name": "order-service", "dependencies": {"express": "^4.18.0", "pg": "^8.11.0"}}',
        "services/order/index.js": 'const express = require("express");\nconst app = express();\napp.post("/api/orders", (req, res) => {});',
        "README.md": "# Retail Architecture",
    }
    zip_bytes = create_in_memory_zip(files)
    arch = CodebaseService.extract_from_zip(zip_bytes, "ecommerce.zip")

    assert arch.inventory is not None
    assert arch.inventory.total_files == 7
    assert "TypeScript" not in arch.inventory.languages
    assert "Go" in arch.inventory.languages
    assert "JavaScript" in arch.inventory.languages

    # Check entities
    entity_ids = {e.id for e in arch.entities}
    assert "gateway" in entity_ids
    assert "auth-service" in entity_ids
    assert "order-service" in entity_ids
    assert "order-db" in entity_ids or "postgres-db" in entity_ids
    assert "redis-broker" in entity_ids or "redis-cache" in entity_ids

    # Run analysis
    analysis = AnalysisPipeline.execute_analysis(arch, project_id="multisvc-test")
    assert len(analysis.critical_components) == len(arch.entities)
    assert analysis.complexity.node_count == len(arch.entities)

def test_monolith_module_extraction_with_imports():
    files = {
        "package.json": '{"name": "monolith-app", "version": "1.0.0", "dependencies": {"express": "^4.18.0"}}',
        "src/auth/authService.ts": """
import { db } from '../db/connection';
export class AuthService {
    login() { return db.query('SELECT 1'); }
}
""",
        "src/users/userService.ts": """
import { db } from '../db/connection';
export class UserService {
    getUser() { return db.query('SELECT * FROM users'); }
}
""",
        "src/orders/orderService.ts": """
import { db } from '../db/connection';
import { UserService } from '../users/userService';
export class OrderService {
    createOrder() { return db.query('INSERT'); }
}
""",
        "src/db/connection.ts": """
export const db = { query: (q: string) => {} };
""",
        "tests/auth.test.ts": "test('auth works', () => {});",
        "tests/orders.test.ts": "test('order works', () => {});",
        ".env.example": "PORT=3000\nDB_URL=postgres://localhost:5432",
        "README.md": "# Modular Monolith",
        "config.json": '{"app": "monolith"}',
        "custom_assets/logo.png": b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR",
    }
    zip_bytes = create_in_memory_zip(files)
    arch = CodebaseService.extract_from_zip(zip_bytes, "monolith.zip")

    assert arch.inventory is not None
    # 100% file retention (all 11 files cataloged)
    assert arch.inventory.total_files == 11
    assert arch.inventory.categories_breakdown["source"] == 4
    assert arch.inventory.categories_breakdown["test"] == 2
    assert arch.inventory.categories_breakdown["manifest"] == 1
    assert arch.inventory.categories_breakdown["config"] == 2
    assert arch.inventory.categories_breakdown["documentation"] == 1
    assert arch.inventory.categories_breakdown["other"] == 1

    # Detected modules
    entity_names = [e.name for e in arch.entities]
    assert any("Auth" in name for name in entity_names)
    assert any("Users" in name for name in entity_names)
    assert any("Orders" in name for name in entity_names)
    assert any("Db" in name or "Database" in name for name in entity_names)

    # Relationships between modules based on imports
    rel_pairs = {(r.source, r.target) for r in arch.relationships}
    assert len(rel_pairs) >= 2, f"Expected cross-module relationships, got {rel_pairs}"

    # Verify each entity has source evidence provenance
    for e in arch.entities:
        assert e.sourceEvidence is not None
        assert e.sourceEvidence.file is not None
        assert e.sourceEvidence.detectionMethod is not None

    # Run analysis
    analysis = AnalysisPipeline.execute_analysis(arch, project_id="monolith-test")
    assert analysis.complexity.node_count == len(arch.entities)

def test_minimal_codebase_graceful_degradation():
    """
    When a codebase contains only loose files without distinct service boundaries,
    TraceIQ gracefully marks it as limited architecture instead of inventing fake nodes.
    """
    files = {
        "calculator.py": "def add(a, b):\n    return a + b\n",
        "utils.py": "def format_num(n):\n    return str(n)\n",
        "test_calc.py": "import calculator\ndef test_add(): assert calculator.add(1, 2) == 3",
        "LICENSE.txt": "MIT License",
        "data.bin": b"\x00\x01\x02\x03\x04\x05",
    }
    zip_bytes = create_in_memory_zip(files)
    arch = CodebaseService.extract_from_zip(zip_bytes, "simple_calc.zip")

    # All 5 files cataloged
    assert arch.inventory is not None
    assert arch.inventory.total_files == 5
    assert arch.inventory.categories_breakdown["other"] == 1  # data.bin retained!
    assert arch.inventory.categories_breakdown["test"] == 1

    # Graceful degradation flag
    assert arch.isLimitedArchitecture is True
    assert "Service-level boundaries could not be confidently inferred" in (arch.limitedArchitectureReason or "")
    assert len(arch.entities) == 1
    assert arch.entities[0].type == "Application"

    # Analysis runs smoothly without crashing on 1-node graph
    analysis = AnalysisPipeline.execute_analysis(arch, project_id="minimal-test")
    assert analysis.complexity.node_count == 1
    assert analysis.complexity.edge_count == 0

def test_provenance_and_zero_file_dropping():
    files = {
        "Cargo.toml": '[package]\nname = "rust-engine"\nversion = "0.1.0"',
        "src/main.rs": 'fn main() { println!("Hello"); }',
        "pkg/parser/parser.go": 'package parser\nfunc Parse() {}',
        "pkg/utils/helper.go": 'package utils\nfunc Help() {}',
        "scripts/deploy.sh": '#!/bin/bash\necho "deploying"',
        "docs/architecture.md": "# Rust & Go System",
        "arbitrary.customext": "some custom data format",
    }
    zip_bytes = create_in_memory_zip(files)
    arch = CodebaseService.extract_from_zip(zip_bytes, "mixed_system.zip")

    assert arch.inventory.total_files == 7
    # arbitrary.customext is NOT dropped
    file_paths = [f.path for f in arch.inventory.files]
    assert "arbitrary.customext" in file_paths
    assert "scripts/deploy.sh" in file_paths
    assert "docs/architecture.md" in file_paths

    for e in arch.entities:
        assert e.sourceEvidence is not None
        assert e.sourceEvidence.file in file_paths
