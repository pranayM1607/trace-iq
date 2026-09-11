import zipfile
import io
import os

buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
    docker_compose = """version: '3.8'
services:
  edge-gateway:
    image: traefik:v2.10
    depends_on:
      - auth-service
      - order-service
      - product-catalog
  auth-service:
    image: node:20-alpine
    depends_on:
      - redis-cache
      - user-db
    environment:
      - DATABASE_URL=postgres://user:pass@user-db:5432/users
  order-service:
    image: python:3.11-slim
    depends_on:
      - payment-service
      - inventory-service
      - postgres-db
    environment:
      - PAYMENT_SERVICE_URL=http://payment-service:8080
      - INVENTORY_SERVICE_URL=http://inventory-service:8081
  product-catalog:
    image: golang:1.21-alpine
    depends_on:
      - mongo-store
  payment-service:
    image: node:20-alpine
  inventory-service:
    image: openjdk:17-alpine
    depends_on:
      - postgres-db
  user-db:
    image: postgres:15
  postgres-db:
    image: postgres:15
  redis-cache:
    image: redis:7-alpine
  mongo-store:
    image: mongo:6.0
"""
    zf.writestr("docker-compose.yml", docker_compose.strip())

    auth_pkg = """{
  "name": "auth-service",
  "version": "2.1.0",
  "dependencies": {
    "express": "^4.19.2",
    "ioredis": "^5.3.2",
    "pg": "^8.11.3",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1"
  }
}"""
    zf.writestr("services/auth-service/package.json", auth_pkg.strip())

    auth_code = """const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');

app.post('/api/auth/login', (req, res) => {
  res.json({ token: 'jwt-token-xyz' });
});

app.get('/api/auth/verify', (req, res) => {
  res.json({ valid: true });
});
"""
    zf.writestr("services/auth-service/src/index.js", auth_code.strip())

    order_reqs = """fastapi>=0.104.0
uvicorn>=0.23.2
sqlalchemy>=2.0.23
psycopg2-binary>=2.9.9
requests>=2.31.0
"""
    zf.writestr("services/order-service/requirements.txt", order_reqs.strip())

    order_code = """from fastapi import FastAPI
import requests

app = FastAPI()

@app.post("/api/orders/checkout")
def create_order(payload: dict):
    # Verify payment with external payment service
    res = requests.post("http://payment-service:8080/api/payments/charge", json=payload)
    # Check inventory
    inv = requests.get("http://inventory-service:8081/api/inventory/check")
    return {"status": "confirmed", "payment": res.json()}
"""
    zf.writestr("services/order-service/app/main.py", order_code.strip())

    payment_pkg = """{
  "name": "payment-service",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "stripe": "^13.10.0",
    "@sendgrid/mail": "^7.7.0"
  }
}"""
    zf.writestr("services/payment-service/package.json", payment_pkg.strip())

    payment_code = """const express = require('express');
const app = express();

app.post('/api/payments/charge', (req, res) => {
  res.json({ id: 'ch_123', status: 'succeeded' });
});
"""
    zf.writestr("services/payment-service/index.js", payment_code.strip())

zip_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test_codebase.zip"))
with open(zip_path, "wb") as f:
    f.write(buf.getvalue())

print(f"Wrote test zip to {zip_path} ({len(buf.getvalue())} bytes)")
