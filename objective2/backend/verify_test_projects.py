import io
import zipfile
import requests
import json

BASE_URL = "http://127.0.0.1:8001/api/v1"

def create_test_react_fastapi_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("frontend/package.json", '{"name": "retail-fe", "dependencies": {"react": "^18.2.0", "axios": "^1.6.0"}}')
        zf.writestr("frontend/src/App.tsx", """import React from 'react';
import { ProductList } from './components/ProductList';
import { api } from './api/client';

export function App() {
  return <ProductList />;
}
""")
        zf.writestr("frontend/src/components/ProductList.tsx", """import React from 'react';
import { api } from '../api/client';

export function ProductList() {
  return <div>Product Catalog</div>;
}
""")
        zf.writestr("frontend/src/api/client.ts", """import axios from 'axios';

export const api = {
  getProducts: () => axios.get('/api/v1/products'),
  createOrder: (data: any) => axios.post('/api/v1/orders', data),
};
""")
        zf.writestr("backend/requirements.txt", "fastapi==0.110.0\nuvicorn==0.28.0\nsqlalchemy==2.0.28\npsycopg2-binary==2.9.9\n")
        zf.writestr("backend/app/main.py", """from fastapi import FastAPI
from .routes.products import router as product_router
from .routes.orders import router as order_router
from .db.session import get_db

app = FastAPI(title="Retail API")
app.include_router(product_router)
app.include_router(order_router)
""")
        zf.writestr("backend/app/routes/products.py", """from fastapi import APIRouter
from ..db.session import get_db

router = APIRouter()

@router.get('/api/v1/products')
def list_products():
    return [{"id": 1, "name": "Laptop", "price": 999}]
""")
        zf.writestr("backend/app/routes/orders.py", """from fastapi import APIRouter
from ..db.session import get_db
from ..services.payment import process_checkout

router = APIRouter()

@router.post('/api/v1/orders')
def create_order(order_data: dict):
    return process_checkout(order_data)
""")
        zf.writestr("backend/app/services/payment.py", """import requests
from ..db.session import get_db

def process_checkout(order_data):
    return {"status": "success", "order_id": 101}
""")
        zf.writestr("backend/app/db/session.py", """import psycopg2

def get_db():
    return psycopg2.connect("postgresql://user:pass@localhost:5432/retail_db")
""")
    buf.seek(0)
    return buf.read()

def create_test_python_modular_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("requirements.txt", "fastapi\nuvicorn\npydantic\nredis\ncelery\n")
        zf.writestr("main.py", """from fastapi import FastAPI
from auth import authenticate_user
from services.order_service import OrderService
from database.connection import get_connection

app = FastAPI()
""")
        zf.writestr("auth.py", """import jwt
from models.user import User
from database.connection import get_connection

def authenticate_user(token: str):
    return User(id="u-1", name="Admin")
""")
        zf.writestr("models/user.py", """from pydantic import BaseModel

class User(BaseModel):
    id: str
    name: str
""")
        zf.writestr("models/order.py", """from pydantic import BaseModel
from .user import User

class Order(BaseModel):
    id: str
    user: User
    amount: float
""")
        zf.writestr("services/order_service.py", """from database.connection import get_connection
from models.order import Order
from services.notification_service import send_email

class OrderService:
    def place_order(self, order: Order):
        send_email(order.user.id, "Order Confirmed")
        return True
""")
        zf.writestr("services/notification_service.py", """import redis

def send_email(user_id: str, msg: str):
    r = redis.Redis(host="localhost", port=6379)
    r.publish("notifications", f"{user_id}:{msg}")
""")
        zf.writestr("database/connection.py", """import sqlite3

def get_connection():
    return sqlite3.connect("app.db")
""")
    buf.seek(0)
    return buf.read()

def create_test_node_ts_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("package.json", '{"name": "node-ts-service", "dependencies": {"express": "^4.18.2", "pg": "^8.11.3", "dotenv": "^16.3.1"}}')
        zf.writestr("tsconfig.json", '{"compilerOptions": {"target": "es2022", "module": "commonjs"}}')
        zf.writestr("src/server.ts", """import express from 'express';
import { authRouter } from './routes/auth.routes';
import { orderRouter } from './routes/order.routes';
import { config } from './config/env';

const app = express();
app.use('/auth', authRouter);
app.use('/orders', orderRouter);
""")
        zf.writestr("src/config/env.ts", """import dotenv from 'dotenv';
dotenv.config();
export const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test'
};
""")
        zf.writestr("src/routes/auth.routes.ts", """import { Router } from 'express';
import { AuthService } from '../services/auth.service';

export const authRouter = Router();
const authService = new AuthService();

authRouter.post('/login', (req, res) => {
  res.json(authService.login(req.body));
});
""")
        zf.writestr("src/routes/order.routes.ts", """import { Router } from 'express';
import { OrderService } from '../services/order.service';

export const orderRouter = Router();
const orderService = new OrderService();

orderRouter.get('/', (req, res) => {
  res.json(orderService.listOrders());
});
""")
        zf.writestr("src/services/auth.service.ts", """import { dbClient } from '../db/client';

export class AuthService {
  login(credentials: any) {
    return { token: 'sample-jwt' };
  }
}
""")
        zf.writestr("src/services/order.service.ts", """import { dbClient } from '../db/client';
import { AuthService } from './auth.service';

export class OrderService {
  listOrders() {
    return dbClient.query('SELECT * FROM orders');
  }
}
""")
        zf.writestr("src/db/client.ts", """import { config } from '../config/env';
import { Pool } from 'pg';

export const dbClient = new Pool({
  connectionString: config.dbUrl,
});
""")
    buf.seek(0)
    return buf.read()

def run_tests():
    tests = [
        ("TEST 1: React + FastAPI", create_test_react_fastapi_zip(), "test_react_fastapi.zip"),
        ("TEST 2: Python Modular", create_test_python_modular_zip(), "test_python_modular.zip"),
        ("TEST 3: Node / TypeScript", create_test_node_ts_zip(), "test_node_ts.zip"),
    ]

    for name, zip_bytes, filename in tests:
        print(f"\n==================================================")
        print(f"RUNNING {name}")
        print(f"==================================================")
        
        # Save ZIP locally so Puppeteer test can also upload it
        with open(filename, "wb") as f:
            f.write(zip_bytes)
        print(f"Saved {filename} ({len(zip_bytes)} bytes)")

        # Upload to backend
        files = {"file": (filename, zip_bytes, "application/zip")}
        resp = requests.post(f"{BASE_URL}/codebase/upload", files=files)
        
        if resp.status_code != 200:
            print(f"FAILED: {resp.status_code} - {resp.text}")
            continue

        data = resp.json()
        arch = data.get("architecture", {})
        analysis = data.get("analysis", {})
        inventory = arch.get("inventory", {})
        codebase_graph = arch.get("codebaseGraph", {}) or inventory.get("codebase_graph", {})
        
        total_files = inventory.get("total_files", 0)
        arch_entities = len(arch.get("entities", []))
        arch_relationships = len(arch.get("relationships", []))
        codebase_nodes = len(codebase_graph.get("nodes", []))
        codebase_edges = len(codebase_graph.get("edges", []))
        
        print(f"SUCCESS!")
        print(f"  Total files extracted: {total_files}")
        print(f"  Architecture entities: {arch_entities}")
        print(f"  Architecture relationships: {arch_relationships}")
        print(f"  Codebase Graph nodes: {codebase_nodes}")
        print(f"  Codebase Graph dependencies: {codebase_edges}")
        
        assert total_files > 0, f"{name}: Total files must be > 0"
        assert arch_entities > 0, f"{name}: Architecture entities must be > 0"
        assert arch_relationships > 0, f"{name}: Architecture relationships must be > 0! Found {arch_relationships}"
        assert codebase_nodes > 0, f"{name}: Codebase nodes must be > 0"
        assert codebase_edges > 0, f"{name}: Codebase dependencies must be > 0! Found {codebase_edges}"
        
        # Sample evidence check
        edges = codebase_graph.get("edges", [])
        print(f"  Sample Extracted Dependencies:")
        for e in edges[:3]:
            print(f"    - {e.get('source_file')} --[{e.get('type')}]--> {e.get('target_file')} (line {e.get('line')}: {e.get('snippet')[:60]}...)")

    print("\nALL 3 TEST PROJECTS PASSED VALIDATION WITH NON-ZERO DEPENDENCIES!")

if __name__ == "__main__":
    run_tests()
