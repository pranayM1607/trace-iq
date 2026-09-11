# TraceIQ — Objective 2: Dependency Graph Analysis & Quality Metrics Platform

**Research Prototype for Objective 2:**
> *"Analyze dependencies and identify critical services, high-risk dependencies, single points of failure, and architectural complexity using dependency-graph analysis and engineering quality metrics."*

---

## 1. Project Structure

This prototype is completely isolated within `objective2/` and does not overwrite or modify Objective 1 or any other repository code.

```
objective2/
├── backend/
│   ├── .venv/                      # Python virtual environment
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py        # REST API endpoints
│   │   ├── data/
│   │   │   └── demo_architecture.py# 13-node, 20-edge realistic microservice scenario
│   │   ├── database/
│   │   │   └── session.py          # SQLAlchemy SQLite connection
│   │   ├── models/
│   │   │   ├── database.py         # Persistence records
│   │   │   └── schemas.py          # Pydantic data schemas
│   │   ├── services/
│   │   │   ├── complexity_service.py  # Graph density, cyclomatic complexity, cycles
│   │   │   ├── criticality_service.py # Multi-signal normalized scoring formula
│   │   │   ├── graph_service.py       # NetworkX DiGraph builder & validator
│   │   │   ├── metrics_service.py     # Centrality, degrees, PageRank, blast radius
│   │   │   ├── pipeline_service.py    # Master coordinator
│   │   │   ├── risk_service.py        # Edge & component risk analysis
│   │   │   └── spof_service.py        # Counterfactual vertex removal algorithm
│   │   └── main.py                 # FastAPI application with CORS
│   ├── tests/
│   │   └── test_graph_analysis.py  # Pytest suite on deterministic test graphs
│   ├── requirements.txt            # Python dependencies
│   ├── run_backend.py              # Server launcher (default port 8001)
│   └── verify_objective2.py        # E2E automated verification script
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── details/
│   │   │   │   └── ComponentInspectionDrawer.tsx  # Drawer with NetworkX metrics & evidence
│   │   │   ├── graph/
│   │   │   │   ├── edges/
│   │   │   │   │   └── TypedRiskEdge.tsx          # Risk badges & animated pulse
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── ApiNode.tsx                # Edge Gateway custom node
│   │   │   │   │   ├── DatabaseNode.tsx           # Database custom node
│   │   │   │   │   ├── ExternalNode.tsx           # External System custom node
│   │   │   │   │   └── ServiceNode.tsx            # Service custom node
│   │   │   │   └── ArchitectureGraph.tsx          # React Flow canvas with stable layout
│   │   │   ├── header/
│   │   │   │   └── Header.tsx                     # Actions, views, backend status
│   │   │   ├── modals/
│   │   │   │   └── JsonImportModal.tsx            # Objective-1 JSON importer
│   │   │   └── triage/
│   │   │       └── RiskTriageView.tsx             # Dedicated Triage & Ranking Dashboard
│   │   ├── data/
│   │   │   └── demoScenario.ts                    # Client-side fallback architecture
│   │   ├── engine/
│   │   │   └── graphLayout.ts                     # Dagre stable tiered layout & visual decorator
│   │   ├── services/
│   │   │   └── api.ts                             # Fetch client for FastAPI backend
│   │   ├── types/
│   │   │   └── analysis.ts                        # TypeScript interfaces
│   │   ├── App.tsx                                # Root state coordinator
│   │   ├── index.css                              # Tailwind CSS v4 styles
│   │   └── main.tsx                               # React DOM entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts                             # Vite on port 5174
│
└── README.md
```

---

## 2. Technologies Used

- **Backend**:
  - Python 3.13
  - **FastAPI**: Asynchronous REST API framework
  - **NetworkX (v3.6+)**: Graph-theoretic algorithms ($G = (V, E)$)
  - **Pydantic (v2.13+)**: Strict data schema validation
  - **SQLAlchemy (v2.0+)** & **SQLite**: Project & analysis persistence
  - **Pytest**: Deterministic test suite
  - **Uvicorn**: ASGI web server
- **Frontend**:
  - **React 19** + **TypeScript 5.8**
  - **Vite 8**: Ultra-fast bundler & dev server
  - **@xyflow/react (v12)**: Interactive graph visualization
  - **@dagrejs/dagre**: Tiered hierarchical positioning engine
  - **Tailwind CSS v4**: Modern dark-theme engineering styling
  - **Lucide React**: Clean technical iconography

---

## 3. Architecture & Data Flow

$$\begin{matrix}
\textbf{Architecture Model} & \longrightarrow & \textbf{NetworkX DiGraph} & \longrightarrow & \textbf{Topological Metrics} \\
(\text{JSON / Demo}) & & G = (V, E) & & (\text{Degrees, Centrality, PageRank}) \\
& & & & \downarrow \\
\textbf{Frontend Canvas} & \longleftarrow & \textbf{Structured Analysis} & \longleftarrow & \textbf{SPOF \& Criticality \& Risk} \\
(\text{React Flow + MiniMap}) & & (\text{Rankings, Insights, Evidence}) & & (\text{Counterfactual } G \setminus \{v\}, \text{ Cycles})
\end{matrix}$$

---

## 4. Mathematical Analysis Formulas

Every metric and score in TraceIQ Objective 2 is mathematically computed from the directed graph $G = (V, E)$ without heuristics or random values:

### A. Graph Metrics
1. **In-Degree ($k_{\text{in}}$)**: Number of direct incoming callers depending on $v$.
2. **Out-Degree ($k_{\text{out}}$)**: Number of direct dependencies $v$ requires.
3. **Betweenness Centrality ($C_B$)**:
   $$C_B(v) = \sum_{s \ne v \ne t} \frac{\sigma_{st}(v)}{\sigma_{st}}$$
4. **PageRank ($PR$)**:
   $$PR(v) = \frac{1-d}{|V|} + d \sum_{u \in M(v)} \frac{PR(u)}{k_{\text{out}}(u)}$$
5. **Upstream Failure Blast Radius**:
   $$\text{Ancestors}(v) = \{ u \in V \mid \exists \text{ path } u \rightarrow v \}$$
   Components that break or degrade if $v$ fails.
6. **Downstream Footprint**:
   $$\text{Descendants}(v) = \{ w \in V \mid \exists \text{ path } v \rightarrow w \}$$

### B. Counterfactual SPOF Detection Algorithm
For each candidate node $v$:
1. Calculate baseline reachability pairs $R_G(s, t) = 1$.
2. Form the subgraph $G' = G \setminus \{v\}$.
3. Recompute reachability $R_{G'}(s, t)$.
4. Disconnected path delta: $\Delta R(v) = \sum_{(s, t)} [R_G(s, t) - R_{G'}(s, t)]$.
5. A component is a **Structural SPOF** if $\Delta R(v) > 0$ or if it is an un-replicated datastore shared by multiple services ($k_{\text{in}} \ge 2$).

### C. Multi-Signal Criticality Score
$$\text{Criticality Score}(v) = 0.30 \cdot \tilde{C}_B(v) + 0.25 \cdot \tilde{PR}(v) + 0.20 \cdot \tilde{k}_{\text{in}}(v) + 0.15 \cdot \tilde{N}_{\text{blast}}(v) + 0.10 \cdot \mathbb{I}_{\text{SPOF}}(v)$$
- Weights rationale:
  - $C_B$ ($30\%$): Traffic routing bottleneck.
  - $PR$ ($25\%$): Recursive architectural significance.
  - $k_{\text{in}}$ ($20\%$): Direct client dependency load.
  - $N_{\text{blast}}$ ($15\%$): Failure propagation reach.
  - $\mathbb{I}_{\text{SPOF}}$ ($10\%$): Structural severance penalty.
- Classification:
  - $\ge 0.70 \rightarrow \text{CRITICAL}$
  - $\ge 0.45 \rightarrow \text{HIGH}$
  - $\ge 0.25 \rightarrow \text{MEDIUM}$
  - $< 0.25 \rightarrow \text{LOW}$

### D. Architectural Complexity Metrics
- **Density**: $D = \frac{|E|}{|V|(|V| - 1)}$
- **Average Degree**: $\langle k \rangle = \frac{2|E|}{|V|}$
- **Cyclomatic Complexity**: $M = |E| - |V| + 2P$
- **Cycle Detection**: Johnson's simple cycles algorithm (`nx.simple_cycles(G)`)
- **Max Dependency Depth**: Longest path in DAG reduction.

---

## 5. API Endpoints

FastAPI backend runs on `http://127.0.0.1:8001`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health status |
| `GET` | `/api/v1/demo` | Retrieves realistic 13-node demo architecture |
| `POST` | `/api/v1/architecture/import` | Imports and stores custom architecture JSON |
| `POST` | `/api/v1/analyze` | Executes complete NetworkX analysis pipeline |
| `GET` | `/api/v1/projects/{id}/analysis` | Fetches cached or stored analysis result |
| `GET` | `/api/v1/projects/{id}/metrics` | Returns component-level metrics map |
| `GET` | `/api/v1/projects/{id}/critical-components` | Returns ranked critical components |
| `GET` | `/api/v1/projects/{id}/spofs` | Returns SPOF detection results |
| `GET` | `/api/v1/projects/{id}/complexity` | Returns architectural complexity indicators |
| `GET` | `/api/v1/projects/{id}/risk-analysis` | Returns high-risk dependencies and component risks |

---

## 6. How to Run the Backend

From the repository root:

```powershell
# 1. Activate the Python virtual environment
.\objective2\backend\.venv\Scripts\Activate.ps1

# 2. Start the FastAPI server
python objective2\backend\run_backend.py
```

- Server URL: **`http://127.0.0.1:8001`**
- Interactive Swagger API Docs: **`http://127.0.0.1:8001/docs`**

---

## 7. How to Run the Frontend

From the repository root:

```powershell
# 1. Change to frontend directory
cd objective2\frontend

# 2. Start Vite dev server on port 5174
npm run dev -- --host 127.0.0.1 --port 5174
```

- Application Web URL: **`http://127.0.0.1:5174`**

---

## 8. Test & Verification Results

### Backend Pytest Suite:
```powershell
.\objective2\backend\.venv\Scripts\pytest.exe -o pythonpath=objective2/backend .\objective2\backend\tests\test_graph_analysis.py -v
```
- `test_linear_dependency_chain`: **PASSED**
- `test_circular_dependency_detection`: **PASSED**
- `test_hub_topology_centrality`: **PASSED**
- `test_spof_bridge_detection`: **PASSED**
- `test_demo_architecture_complete_analysis`: **PASSED**
- **Result**: 5 passed in 0.24s (100% pass rate).

### Frontend Production Build:
```powershell
npm --prefix objective2\frontend run build
```
- **Result**: Compiled with **0 errors**.

### End-to-End Verification:
```powershell
.\objective2\backend\.venv\Scripts\python.exe objective2\backend\verify_objective2.py
```
- **Result**: All 8 validation checks passed.

---

## 9. 2-Minute Mentor Demonstration Flow

1. **Step 1: Open the App**:
   - Open browser at **`http://127.0.0.1:5174`**.
   - Notice the green status pill: `FastAPI :8001` (confirming connection to Python NetworkX engine).
2. **Step 2: Inspect Initial Architecture Graph**:
   - The graph automatically loads the realistic 13-component e-commerce checkout architecture.
   - Observe the Left-to-Right topological flow: Ingress Clients (Left) $\rightarrow$ API Gateway $\rightarrow$ Services $\rightarrow$ Sinks / Databases (Right).
3. **Step 3: Trigger "Analyze Architecture"**:
   - Click the blue **Analyze Architecture** button in the header.
   - The system sends the graph to FastAPI, executes NetworkX algorithms, and decorates the graph with risk halos, SPOF badges, and centrality metrics.
4. **Step 4: Inspect a Critical Service**:
   - Click on **Cloud API Gateway** or **Payment Processing Service**.
   - The right drawer slides out showing:
     - Exact NetworkX metrics: In-degree, Out-degree, Betweenness Centrality, PageRank, Blast Radius.
     - Mathematical explanation: *"Why is this component high risk?"*
     - List of inbound callers and outbound dependencies.
5. **Step 5: Inspect a Single Point of Failure (SPOF)**:
   - Click on **PostgreSQL Primary Cluster** or **Cloud API Gateway**.
   - Notice the distinct red SPOF badge.
   - Drawer displays the counterfactual severance result: *"Structural SPOF: Loss severs X paths and isolates Y services."*
6. **Step 6: Switch to "Risk & Triage View"**:
   - In the top header view switcher, click **Risk & Triage View**.
   - Review:
     - **Architectural Complexity Card**: Density ($12.82\%$), Cyclomatic Index ($9$), Max Chain Depth ($4$ tiers).
     - **Ranked Critical Components Table**: `#1 Cloud API Gateway`, `#2 PostgreSQL Primary`, `#3 Order Service`.
     - **SPOF Inspector**: Detailed breakdown of severed paths and disrupted services.
     - **Circular Dependency Alert**: Shows the circular loop `Notification Dispatcher -> Analytics Worker -> Notification Dispatcher`.
7. **Step 7: Test Interactive Filtering & Search**:
   - Return to **Architecture Graph**.
   - In the filter bar, click **Critical** or **SPOFs Only**.
   - Observe that non-matching nodes are dimmed to $40\%$ opacity while all node $(x, y)$ positions remain **100% stable** without layout recalculation.
   - Type `"Order"` in the search bar: the camera smoothly centers on Order Service with zero layout disruption.

---

## 10. Strict Scope Boundary & Known Limitations

- **Objective 2 Only**: This prototype strictly implements dependency graph analysis, structural metrics, criticality ranking, SPOF detection, and complexity scoring.
- **Excluded Features (Out of Scope)**:
  - No change-impact prediction (Objective 3)
  - No code modification simulation or automated remediation (Objective 4)
  - No AI chatbot or LLM hallucinations (all metrics and evidence are deterministic graph math).
- **Known Limitations**:
  - The demo uses directed static architectures; real-time dynamic runtime traffic sampling is not part of Objective 2.
  - Cycle detection displays up to the first 10 simple cycles for performance on larger topologies.
