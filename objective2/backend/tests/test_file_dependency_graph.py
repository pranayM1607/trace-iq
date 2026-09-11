import io
import zipfile
import pytest
from app.services.dependency_extractor import DependencyExtractor
from app.services.codebase_service import CodebaseService
from app.models.schemas import CodebaseFileDependency, CodebaseGraph


def test_js_ts_dependency_extraction():
    files = [
        {"path": "src/App.tsx", "content": """import React from 'react';
import { Header } from './components/Header';
import { fetchUser } from './services/api';
const helpers = require('./utils/helpers');

export default function App() { return null; }
""", "category": "source", "language": "TypeScript", "extension": ".tsx"},
        {"path": "src/components/Header.tsx", "content": "export const Header = () => null;", "category": "source", "language": "TypeScript", "extension": ".tsx"},
        {"path": "src/components/Button.tsx", "content": "export const Button = () => null;", "category": "source", "language": "TypeScript", "extension": ".tsx"},
        {"path": "src/services/api.ts", "content": "export const fetchUser = async () => ({});", "category": "source", "language": "TypeScript", "extension": ".ts"},
        {"path": "src/utils/helpers.js", "content": "module.exports = {};", "category": "source", "language": "JavaScript", "extension": ".js"},
    ]
    
    file_deps, graph, _ = DependencyExtractor.extract_dependencies(files)
    assert len(file_deps) >= 3
    targets = [d.target_file for d in file_deps]
    assert "src/components/Header.tsx" in targets
    assert "src/services/api.ts" in targets
    assert "src/utils/helpers.js" in targets
    
    for d in file_deps:
        assert d.line is not None and d.line > 0
        assert d.snippet is not None
        assert d.type in ("IMPORTS", "CALLS", "DEPENDS_ON")


def test_python_dependency_extraction():
    files = [
        {"path": "app/main.py", "content": """from .auth import authenticate_user
from app.services.payment import process_payment
import app.models.user as user_model
from ..db.session import get_db

app = FastAPI()
""", "category": "source", "language": "Python", "extension": ".py"},
        {"path": "app/auth.py", "content": "def authenticate_user(): pass", "category": "source", "language": "Python", "extension": ".py"},
        {"path": "app/services/payment.py", "content": "def process_payment(): pass", "category": "source", "language": "Python", "extension": ".py"},
        {"path": "app/models/user.py", "content": "class User: pass", "category": "source", "language": "Python", "extension": ".py"},
        {"path": "app/db/session.py", "content": "def get_db(): pass", "category": "source", "language": "Python", "extension": ".py"},
    ]
    
    file_deps, graph, _ = DependencyExtractor.extract_dependencies(files)
    targets = [d.target_file for d in file_deps]
    assert "app/auth.py" in targets
    assert "app/services/payment.py" in targets
    assert "app/models/user.py" in targets
    assert "app/db/session.py" in targets


def test_multi_language_dependency_extraction():
    files = [
        # Java
        {"path": "src/main/java/com/corp/OrderService.java", "content": """package com.corp;
import com.corp.PaymentClient;
public class OrderService {}
""", "category": "source", "language": "Java", "extension": ".java"},
        {"path": "src/main/java/com/corp/PaymentClient.java", "content": "package com.corp; public class PaymentClient {}", "category": "source", "language": "Java", "extension": ".java"},
        
        # Go
        {"path": "cmd/server/main.go", "content": """package main
import (
    "fmt"
    "github.com/corp/myapp/pkg/auth"
)
func main() {}
""", "category": "source", "language": "Go", "extension": ".go"},
        {"path": "pkg/auth/jwt.go", "content": "package auth", "category": "source", "language": "Go", "extension": ".go"},
        
        # C/C++
        {"path": "src/main.cpp", "content": """#include <iostream>
#include "include/database.h"
int main() { return 0; }
""", "category": "source", "language": "C++", "extension": ".cpp"},
        {"path": "include/database.h", "content": "#pragma once", "category": "source", "language": "C/C++ Header", "extension": ".h"},

        # C#
        {"path": "Controllers/OrdersController.cs", "content": """using System;
using Services.PaymentService;
namespace Controllers { public class OrdersController {} }
""", "category": "source", "language": "C#", "extension": ".cs"},
        {"path": "Services/PaymentService.cs", "content": "namespace Services { public class PaymentService {} }", "category": "source", "language": "C#", "extension": ".cs"}
    ]
    
    file_deps, graph, _ = DependencyExtractor.extract_dependencies(files)
    targets = [d.target_file for d in file_deps]
    assert "src/main/java/com/corp/PaymentClient.java" in targets
    assert "pkg/auth/jwt.go" in targets
    assert "include/database.h" in targets
    assert "Services/PaymentService.cs" in targets


def test_api_route_matching():
    files = [
        {"path": "backend/app/routes/orders.py", "content": """from fastapi import APIRouter
router = APIRouter()
@router.get("/api/v1/orders")
def get_orders():
    return []
""", "category": "source", "language": "Python", "extension": ".py"},
        {"path": "frontend/src/api.ts", "content": """import axios from 'axios';
export async function loadOrders() {
    return await axios.get('/api/v1/orders');
}
""", "category": "source", "language": "TypeScript", "extension": ".ts"}
    ]
    
    file_deps, graph, _ = DependencyExtractor.extract_dependencies(files)
    assert any(d.target_file == "backend/app/routes/orders.py" and d.type == "CALLS" for d in file_deps)


def test_end_to_end_zip_codebase_graph_generation():
    """Verify that uploading a ZIP with frontend and backend creates > 0 dependencies and a rich codebase graph."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("frontend/package.json", '{"name": "frontend", "dependencies": {"axios": "^1.0.0"}}')
        zf.writestr("frontend/src/App.tsx", """import React from 'react';
import { UserList } from './components/UserList';
import { api } from './api/client';
export function App() { return <UserList />; }
""")
        zf.writestr("frontend/src/components/UserList.tsx", """import React from 'react';
import { api } from '../api/client';
export function UserList() { return <div>Users</div>; }
""")
        zf.writestr("frontend/src/api/client.ts", """import axios from 'axios';
export const api = {
    getUsers: () => axios.get('/api/users'),
    getHealth: () => axios.get('/api/health')
};
""")
        zf.writestr("backend/requirements.txt", "fastapi\nuvicorn\nsqlalchemy\npsycopg2-binary\n")
        zf.writestr("backend/app/main.py", """from fastapi import FastAPI
from .routes.users import router as user_router
from .db.session import get_db

app = FastAPI()
app.include_router(user_router)
""")
        zf.writestr("backend/app/routes/users.py", """from fastapi import APIRouter
from ..db.session import get_db

router = APIRouter()
@router.get('/api/users')
def list_users():
    return [{"id": 1, "name": "Alice"}]
""")
        zf.writestr("backend/app/db/session.py", """import psycopg2
def get_db():
    return psycopg2.connect("postgresql://user:pass@localhost:5432/db")
""")

    buf.seek(0)
    zip_bytes = buf.read()
    
    arch = CodebaseService.extract_from_zip(zip_bytes, "test_repo.zip")
    
    # 1. Architecture level validation
    assert len(arch.entities) >= 2
    # Ensure dependencies were found! NOT 0 dependencies!
    assert len(arch.relationships) > 0, f"Architecture relationships must not be 0! Got {len(arch.relationships)}"
    
    # 2. Codebase graph validation
    assert arch.codebaseGraph is not None
    assert len(arch.codebaseGraph.nodes) == len(arch.inventory.files)
    assert len(arch.codebaseGraph.edges) > 0, "Codebase graph edges must not be 0!"
    
    # Check that file dependencies have evidence
    for edge in arch.codebaseGraph.edges:
        assert edge.source_file is not None
        assert edge.target_file is not None
        assert edge.type in ("IMPORTS", "CALLS", "USES", "DEPENDS_ON", "CONNECTS_TO")
        assert edge.line is not None and edge.line > 0
        assert edge.snippet is not None and len(edge.snippet) > 0

    # Verify cross-service or inter-module edges exist
    assert any(e.type == "CALLS" for e in arch.codebaseGraph.edges)
    assert any(e.type == "IMPORTS" for e in arch.codebaseGraph.edges)
