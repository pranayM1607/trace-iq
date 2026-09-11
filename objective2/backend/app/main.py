from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database.session import engine, Base
from .api.endpoints import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="TraceIQ — Objective 2 Dependency Graph & Quality Metrics Engine",
    description=(
        "Research Prototype for Objective 2: Analyze dependencies and identify critical services, "
        "high-risk dependencies, single points of failure (SPOF), and architectural complexity "
        "using NetworkX graph analysis."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend running on Vite (e.g. localhost:5174 or localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root():
    return {
        "project": "TraceIQ",
        "objective": "Objective 2 — Dependency Analysis & Quality Metrics Platform",
        "status": "online",
        "docs_url": "/docs",
        "api_version": "v1",
    }
