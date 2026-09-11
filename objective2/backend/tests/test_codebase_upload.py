import io
import zipfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.codebase_service import CodebaseService

def create_sample_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Docker compose
        docker_compose = """
version: '3.8'
services:
  api-gateway:
    image: nginx:alpine
    depends_on:
      - user-service
      - order-service
  user-service:
    image: python:3.11
    depends_on:
      - user-db
    environment:
      - DATABASE_URL=postgres://user:pass@user-db:5432/users
  order-service:
    image: node:20
    depends_on:
      - redis-cache
  user-db:
    image: postgres:15
  redis-cache:
    image: redis:7
"""
        zf.writestr("docker-compose.yml", docker_compose.strip())

        # package.json for order-service
        pkg_json = """
{
  "name": "order-service",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "redis": "^4.6.7",
    "stripe": "^12.0.0"
  }
}
"""
        zf.writestr("order-service/package.json", pkg_json.strip())

        # order-service source code
        order_js = """
const express = require('express');
const app = express();
const axios = require('axios');

app.post('/api/orders/create', async (req, res) => {
    const user = await axios.get('http://user-service:8000/api/users/' + req.body.userId);
    res.json({ status: 'ok', user: user.data });
});
"""
        zf.writestr("order-service/src/server.js", order_js.strip())

        # requirements.txt for user-service
        reqs = """
fastapi==0.100.0
uvicorn==0.22.0
psycopg2-binary==2.9.6
"""
        zf.writestr("user-service/requirements.txt", reqs.strip())

        # user-service source code
        user_py = """
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/users/{user_id}")
def get_user(user_id: str):
    return {"id": user_id, "name": "Test User"}
"""
        zf.writestr("user-service/main.py", user_py.strip())

    return buf.getvalue()

def test_codebase_service_extraction():
    zip_bytes = create_sample_zip()
    arch = CodebaseService.extract_from_zip(zip_bytes, filename="sample-microservices.zip")

    entity_ids = {e.id for e in arch.entities}
    # Gateway, user-service, order-service, user-db, redis-cache, stripe-api, etc.
    assert "api-gateway" in entity_ids
    assert "user-service" in entity_ids
    assert "order-service" in entity_ids
    assert "redis-cache" in entity_ids
    assert "stripe-api" in entity_ids

    # Relationships
    rel_pairs = {(r.source, r.target) for r in arch.relationships}
    assert ("api-gateway", "user-service") in rel_pairs
    assert ("order-service", "user-service") in rel_pairs
    assert ("order-service", "stripe-api") in rel_pairs

def test_codebase_service_security_rejections():
    # Test empty bytes
    with pytest.raises(ValueError, match="empty"):
        CodebaseService.extract_from_zip(b"", "empty.zip")

    # Test invalid magic bytes
    with pytest.raises(ValueError, match="signature"):
        CodebaseService.extract_from_zip(b"not a zip file", "bad.zip")

    # Test path traversal attack
    bad_buf = io.BytesIO()
    with zipfile.ZipFile(bad_buf, "w") as zf:
        zf.writestr("../evil.py", "print('hacked')")
    bad_bytes = bad_buf.getvalue()

    with pytest.raises(ValueError, match="Security error"):
        CodebaseService.extract_from_zip(bad_bytes, "malicious.zip")

def test_upload_codebase_endpoint():
    client = TestClient(app)
    zip_bytes = create_sample_zip()

    response = client.post(
        "/api/v1/codebase/upload",
        files={"file": ("sample-microservices.zip", zip_bytes, "application/zip")},
    )

    assert response.status_code == 200
    data = response.json()
    assert "architecture" in data
    assert "analysis" in data
    assert len(data["architecture"]["entities"]) >= 5
    assert len(data["analysis"]["component_metrics"]) >= 5
    assert "critical_components" in data["analysis"]
    assert "spofs" in data["analysis"]
    assert "complexity" in data["analysis"]

def test_upload_invalid_file_extension():
    client = TestClient(app)
    response = client.post(
        "/api/v1/codebase/upload",
        files={"file": ("test.txt", b"some text", "text/plain")},
    )
    assert response.status_code == 400
    assert "zip" in response.json()["detail"].lower()
