# TraceIQ: Complete Architectural Reference, Algorithmic Specifications, and Technical Manual

---

## 1. Executive Summary & Core Mission

**TraceIQ** is an automated software architecture extraction, graph reconstruction, topological risk evaluation, and hypothetical change simulation platform. It bridges the gap between static source code repositories, deployment blueprints, and high-level architectural designs.

### The Architectural Problem Space
In modern software engineering, architectures degrade through continuous iteration—a phenomenon known as **architectural drift** or **software erosion**. As features are rapidly delivered:
1. **Hidden Dependencies**: Components acquire direct connections, cyclic dependencies, and third-party bindings that are absent from design documents.
2. **Single Points of Failure (SPOFs)**: Services or shared databases become bottlenecks without team awareness.
3. **Risky Refactoring**: Engineering teams cannot accurately forecast the blast radius of modifying, decoupling, or decommissioning a service.
4. **Disconnection from Reality**: Design blueprints (JSON/YAML) describe *intended* architecture, while codebases contain *actual* architecture. Discrepancies between the two lead to outages, security gaps, and technical debt.

### The Three Foundational Objectives
TraceIQ solves these challenges through three mathematically grounded, deterministic objectives:

* **OBJECTIVE 1: Ingestion, 100% Repository Inventory Retention, Semantic Reconstruction, and Side-by-Side Comparison**
  * Ingests heterogeneous inputs: ZIP archives of raw multi-language codebases or JSON architecture blueprints.
  * Preserves 100% of the repository file tree in a **Level 1 Repository Inventory**—no file or asset is discarded.
  * Reconstructs an abstraction-level **Level 2 Semantic Architecture Model** via multi-language AST/regex scanning, endpoint extraction, ORM analysis, and dependency resolution.
  * Computes mathematical diff reconciliations between baseline and target architectures ($Original = Removed + Modified + Unchanged$; $Target = Added + Modified + Unchanged$).
  * Provides immutable snapshot versioning to freeze and inspect architecture states over time.

* **OBJECTIVE 2: Graph Theory-Based Dependency Risk Analysis & Engineering Quality Metrics**
  * Maps the reconstructed architecture into a formal directed graph $G = (V, E)$.
  * Evaluates structural health using exact graph theory algorithms:
    * **Brandes Betweenness Centrality** (transit bottleneck identification).
    * **PageRank with Power Iteration** (structural importance).
    * **McCabe Cyclomatic Complexity** adapted for directed dependency topologies ($M = E - V + 2P$).
    * **Graph Density** and **Average Degree**.
    * **Tarjan's Articulation Points & Counterfactual Subgraph Analysis** for Single Points of Failure (SPOFs).
    * **Normalized Multi-Signal Component Criticality Score** ($0.0 - 1.0$).
    * **Composite Structural Risk Score** ($0 - 100$) derived deterministically without stochastic LLM hallucinations.
  * Delivers a **Progressive Disclosure Modal** displaying exact in-degree, out-degree, betweenness, PageRank, and concrete dependency propagation paths.

* **OBJECTIVE 3: Hypothetical Architecture Change Simulator & Causal Risk Ledger**
  * Provides a strictly isolated sandbox executing on a non-mutating deep copy of the active architecture:
    $$M_{hypo} = \text{clone}(M_{active})$$
  * Allows architects to stage speculative changes (`add_component`, `remove_component`, `add_dependency`, `remove_dependency`) without altering active data, saved snapshots, or disk files.
  * Evaluates **Dependency Propagation Semantics**: directed edge $A \to B$ denotes $A$ depends on $B$; modifying $B$ radiates impact upstream to caller $A$ and transitive callers along $G^T$.
  * Generates a **Deterministic Causal Risk Ledger** attributing exact point deltas ($\pm$ points) to specific architectural modifications (e.g., $+12.0$ pts for introducing a SPOF, $-3.5$ pts for decoupling a dependency).
  * Synthesizes a structured 4-step **Human-Readable Change Story** explaining scope, blast radius, risk delta, and root drivers.

---

## 2. High-Level System Architecture & Dual-Engine Paradigm

TraceIQ operates as a single unified web application powered by a hybrid client-server execution model.

```
+----------------------------------------------------------------------------------------------------+
|                                    TRACEIQ UNIFIED PLATFORM                                        |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|   +--------------------------------------------------------------------------------------------+   |
|   |                         REACT 19 + TYPESCRIPT FRONTEND (Vite @ Port 5173)                  |   |
|   |                                                                                            |   |
|   |   +------------------------------------------------------------------------------------+   |   |
|   |   | UI & Presentation Layer:                                                           |   |   |
|   |   | - CodeAnt-Inspired Persistent Navigation Sidebar & TopHeader                       |   |   |
|   |   | - Interactive Graph Canvas (@xyflow/react + Dagre Layout)                          |   |   |
|   |   | - Progressive Disclosure Modals, Global Search (Ctrl+K), TraceIQ Assistant         |   |   |
|   |   | - Dedicated Pages: Analyze, Architecture, Dependencies, Inventory, Risk, Impact,   |   |   |
|   |   |   Compare, Simulator, Snapshots, Evidence, Reports                                 |   |   |
|   |   +------------------------------------------------------------------------------------+   |   |
|   |                                                                                            |   |
|   |   +-----------------------------------+    +-------------------------------------------+   |   |
|   |   | Client-Side Ingestion & Analysis: |    | Client-Side In-Browser Fallback Engine:   |   |   |
|   |   | - JSZip Ingestion Engine          |    | - Objective2AnalysisEngine (TypeScript)   |   |   |
|   |   | - Root Container Envelope Stripper|    | - ChangeSimulatorEngine (TypeScript)      |   |   |
|   |   | - Deterministic Content Hashers   |    | - Full Brandes, PageRank, Tarjan, McCabe  |   |   |
|   |   | - Multi-Language AST/Regex Parser |    |   implementations for 100% offline parity |   |   |
|   |   | - Architecture Reconstructor      |    |                                           |   |   |
|   |   +-----------------------------------+    +-------------------------------------------+   |   |
|   +--------------------------------------------------------------------------------------------+   |
|                                         |                                                          |
|                    Vite Reverse Proxy:  | `/api/v2/*` & `/api/v3/*`                                |
|                                         v                                                          |
|   +--------------------------------------------------------------------------------------------+   |
|   |                         FASTAPI PYTHON BACKEND (Uvicorn @ Port 8001)                       |   |
|   |                                                                                            |   |
|   |   +--------------------------+  +--------------------------+  +------------------------+   |   |
|   |   | MetricsService           |  | SpofService              |  | CriticalityService     |   |   |
|   |   | - NetworkX Graph Builder |  | - Counterfactual Removal |  | - Normalized 5-Signal  |   |   |
|   |   | - Betweenness Centrality |  | - Transit SPOF Detection |  |   Weighted Criticality |   |   |
|   |   | - PageRank Iteration     |  | - Shared Datastore Sinks |  |   Derivation           |   |   |
|   |   +--------------------------+  +--------------------------+  +------------------------+   |   |
|   |   +--------------------------+  +--------------------------+  +------------------------+   |   |
|   |   | ComplexityService        |  | RiskService              |  | SimulationService      |   |   |
|   |   | - Density & Avg Degree   |  | - Deterministic 0-100    |  | - Isolated Deep-Copy   |   |   |
|   |   | - Cyclomatic Complexity  |  |   Composite Structural   |  | - Transposed BFS Blast |   |   |
|   |   | - Johnson's Cycle Search |  |   Risk Score Calculation |  | - Causal Ledger Engine  |   |   |
|   |   +--------------------------+  +--------------------------+  +------------------------+   |   |
|   +--------------------------------------------------------------------------------------------+   |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### Why a Dual-Engine Strategy?
TraceIQ implements its core graph analysis algorithms identically in both **TypeScript** (client-side) and **Python NetworkX** (FastAPI backend):
1. **Zero-Setup Offline Resilience**: Users can run TraceIQ purely in modern browsers without setting up Python virtual environments. All parsing, graph layout, betweenness calculation, Tarjan SPOF detection, and simulations run smoothly in WebAssembly/JS.
2. **Scientific Precision & Heavy Computation**: When the FastAPI service is online, heavy analysis, large repository parsing, and deep topological explorations can be offloaded to optimized Python NetworkX routines.
3. **Algorithmic Parity**: Both engines share identical mathematical definitions, normalization bounds, and scoring weights. A graph analyzed in TypeScript yields the exact same metric values as in Python.

---

## 3. Ingestion & Level 1 Repository Inventory Pipeline

The ingestion pipeline handles raw, unstructured files from ZIP archives or structured blueprint JSON files.

```
       [ Upload ZIP Archive ]
                 |
                 v
   +---------------------------+
   | JSZip Decompression &     |
   | Path Normalization        |
   +---------------------------+
                 |
                 v
   +---------------------------+
   | Canonical Root Container  |  --> Strips enclosing folders (e.g., `repo-main/`)
   | Envelope Detection        |      to prevent false-positive path mismatches
   +---------------------------+
                 |
                 v
   +---------------------------+
   | Binary vs Text Detection  |
   | & Deterministic Hashing   |
   +---------------------------+
         |               |
         | (Text)        | (Binary)
         v               v
   [ DJB2 Hash ]   [ 3-Sample Buffer Hash ]
         \               /
          v             v
   +-------------------------------------------------------------+
   | LEVEL 1 REPOSITORY INVENTORY (100% Retention)               |
   | - Total files, folders, lines of code, byte sizes           |
   | - File taxonomy categorization                              |
   | - Explicit `analysis_status` for every single file          |
   +-------------------------------------------------------------+
```

### 3.1. JSZip Ingestion & Path Canonicalization
When a user uploads a `.zip` archive:
1. `JSZip.loadAsync(zipFile)` extracts the raw uncompressed entries.
2. Windows backslashes (`\`) are normalized to standard POSIX forward slashes (`/`).
3. Redundant leading relative tokens (`./` and `/`) are stripped.
4. All intermediate directory paths are added to a `foldersSet` to reconstruct the complete folder hierarchy.

### 3.2. Canonical Root Container Envelope Stripping
A major source of false-positive diffs occurs when GitHub or GitLab packages repositories with an enclosing top-level directory (e.g., `Project-main/src/...` vs `Project-v2/src/...`).
* TraceIQ inspects all entry paths:
  ```typescript
  const rootCandidates = Array.from(
    new Set(files.map(f => f.path.split('/')[0]).filter(Boolean))
  );
  if (rootCandidates.length === 1 && files.every(f => f.path.startsWith(rootCandidates[0] + '/'))) {
    const commonPrefix = rootCandidates[0] + '/';
    // Strip commonPrefix from all file and folder paths
  }
  ```
* This ensures that `Project-main/server.py` and `Project-v2/server.py` both normalize to `server.py`, allowing direct, truthful comparison.

### 3.3. Binary vs. Text Classification & Deterministic Hashing
To prevent memory crashes from multi-megabyte binary assets while maintaining exact diff capabilities:
* **Binary Detection**: Files matching binary extensions (`.png`, `.jpg`, `.pdf`, `.zip`, `.exe`, `.pyc`, `.pkl`, `.h5`, `.so`, `.dll`, `.bin`, `.xyz`, etc.) are tagged as binary.
* **Deterministic Text Hashing (DJB2 32-bit Variant)**:
  For text files, an unrolled DJB2 hash is computed:
  $$\text{hash}_{i} = ((\text{hash}_{i-1} \ll 5) + \text{hash}_{i-1}) + \text{charCode}(c_i)$$
  Initialized with seed `5381` and formatted as an 8-character zero-padded hexadecimal string.
* **Deterministic Binary Hashing (3-Chunk Sampling)**:
  For binary buffers $\ge 64\text{ KB}$, hashing the entire multi-megabyte array on the UI thread causes stutter. TraceIQ samples three 4096-byte segments:
  1. The first 4096 bytes (file header).
  2. The middle 4096 bytes ($\lfloor \frac{\text{len}}{2} \rfloor$).
  3. The final 4096 bytes (file trailer).
  The resulting fingerprint is formatted as `bin-[hash]-[length]`.

### 3.4. The 100% Retention Guarantee & File Categorization
TraceIQ guarantees **zero file loss** in Level 1. Every entry in the ZIP is cataloged into one of 11 categories:
* `source`: Compilable or interpreted program code (`.ts`, `.js`, `.py`, `.java`, `.go`, `.dart`, `.cpp`, `.rs`).
* `config`: System settings and environment files (`.env`, `.yaml`, `.yml`, `.json`, `.toml`, `.xml`).
* `manifest`: Dependency and build declarations (`package.json`, `pom.xml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `Dockerfile`, `docker-compose.yml`).
* `dataset`: Tabular and training data (`.csv`, `.tsv`, `.parquet`, `.sqlite`).
* `model_artifact`: Machine learning serialized weights (`.pkl`, `.onnx`, `.pt`, `.h5`, `.joblib`).
* `documentation`: Human-readable manuals (`.md`, `.txt`, `.rst`, `.pdf`).
* `asset`: Visual and static UI resources (`.svg`, `.png`, `.ico`, `.css`, `.html`).
* `unanalyzed` / `unsupported` / `unknown` / `other`: Files whose structure is retained but not semantically decompiled.

**Explicit Analysis Status**: Every single file receives a transparent status:
* `"Analyzed — mapped to [Service Name]"`
* `"Analyzed — package / build manifest"`
* `"Analyzed — internal code dependency"`
* `"Retained / Not Analyzed (Reason: Unsupported or binary format)"`

---

## 4. Level 2 Semantic Architecture Reconstruction Engine

While Level 1 stores the physical file inventory, Level 2 reconstructs the logical software architecture.

```
       [ Level 1 File Inventory ]
                   |
     +-------------+-------------+
     |                           |
     v                           v
[ Manifest Scanners ]    [ Source AST & Regex Parsers ]
  - package.json           - Python imports & route decorators
  - pom.xml / gradle       - JS/TS imports & fetch/axios calls
  - requirements.txt       - Dart package imports
  - go.mod / Cargo         - Express / Flask / FastAPI endpoints
  - docker-compose         - ORM & database queries (Prisma, SQLAlchemy)
     |                           |
     +-------------+-------------+
                   |
                   v
   +-------------------------------+
   | Entity Extraction & Merging   |  --> Consolidates files into logical Services,
   | & Deduplication               |      APIs, Databases, and External Systems
   +-------------------------------+
                   |
                   v
   +-------------------------------+
   | Relationship Synthesis        |  --> Connects components via CALLS, USES,
   | & Confidence Scoring          |      QUERIES, EXPOSES, LOADS with evidence
   +-------------------------------+
                   |
                   v
   +-------------------------------+
   | Dangling Edge Pruning &       |  --> Removes broken references; checks for
   | Limited Architecture Fallback |      single-file / minimal repo degradation
   +-------------------------------+
                   |
                   v
   [ LEVEL 2 SEMANTIC ARCHITECTURE MODEL ]
```

### 4.1. Manifest Scanners
1. **Docker Compose (`docker-compose.yml`)**:
   * Scans `services:` definitions.
   * Classifies containers into `Service` or `Database` (matching regex for `postgres`, `mysql`, `mongo`, `redis`, `mariadb`, `cockroach`, `dynamodb`).
   * Extracts network dependencies from `depends_on:` declarations.
   * Extracts data dependencies from environment variables like `DATABASE_URL`, `POSTGRES_HOST`, `REDIS_HOST`.
2. **Node.js (`package.json`)**:
   * Scans `dependencies` and `devDependencies`.
   * Maps drivers (`pg`, `mysql2`, `mongoose`, `redis`, `@prisma/client`) to datastores.
   * Detects cloud and API SDKs (`@aws-sdk`, `stripe`, `openai`, `@google/genai`).
3. **Python (`requirements.txt`, `pyproject.toml`)**:
   * Scans package declarations: `flask`, `fastapi`, `django`, `sqlalchemy`, `psycopg2`, `pymongo`, `celery`, `google-generativeai`.
4. **Java / Go / Rust (`pom.xml`, `go.mod`, `Cargo.toml`)**:
   * Extracts artifacts, group IDs, modules, and database connectors.

### 4.2. Multi-Language Source Code Parsing & AST-Style Extraction
The analyzer performs token and pattern extraction across source files:
* **Python**:
  * Import resolution: `import X`, `from X import Y`. Distinguishes internal module references from standard libraries.
  * Route decorators: `@app.route('/predict')`, `@router.get('/items')`, `@bp.post('/auth')` $\implies$ generates `API` entities and links caller service via `EXPOSES`.
  * Generative AI SDKs: `google.generativeai` $\implies$ registers `Google Gemini Generative AI API` (`External System`); `openai` $\implies$ registers `OpenAI API`.
  * Vector Databases: `faiss` $\implies$ registers `FAISS Vector Index` (`Database`).
  * Deserialization: `pickle.load()` / `joblib.load()` $\implies$ registers `ML Model Artifacts` (`Database`) with `LOADS` relationship.
  * Tabular Ingestion: `pd.read_csv()` $\implies$ maps CSV files from Level 1 to a `Tabular Dataset Store` (`Database`) with `QUERIES` relationship.
* **JavaScript / TypeScript**:
  * Module imports: ES6 `import ... from './service'` and CommonJS `require('./service')`.
  * Client API Calls: regex matches `fetch('http://localhost:5000/...')`, `axios.post('http://127.0.0.1:8000/...')` $\implies$ creates `CALLS` relationship to the target service.
  * Express Route Extraction: `app.get('/api/users')`, `router.post('/login')`.
* **Dart / Flutter**:
  * Parses `import 'package:.../feature.dart'`.
  * Identifies mobile entry points (`main.dart`, `runApp`) $\implies$ generates `Application` entity.
* **Chrome Extensions**:
  * Detects `manifest.json` with `manifest_version` $\implies$ generates `Chrome Extension Application`.

### 4.3. Entity & Relationship Provenance Tracking
Every extracted relationship includes a complete `sourceEvidence` record:
* `file`: Relative file path where the dependency was discovered.
* `line`: Exact 1-indexed line number.
* `snippet`: Raw code statement (e.g., `import requests; requests.post('http://api-service')`).
* `method`: Extraction technique (e.g., `"Python Import Extractor"`, `"Route Decorator Extractor"`).
* `confidence`:
  * `HIGH`: Concrete syntactic import, route decorator, or explicit manifest declaration.
  * `MEDIUM`: Inferred endpoint matching or heuristic environment variable link.
  * `LOW`: Fuzzy string pattern or unverified dynamic invocation.

### 4.4. Deduplication & Dangling Reference Pruning
* Entities sharing identical canonical identifiers are merged; metadata, endpoint lists, and tags are combined without creating duplicate nodes.
* Any relationship whose `source` or `target` fails to resolve to a recognized entity is pruned, preventing broken edges in the graph.

### 4.5. Graceful Degradation for Minimal Repositories
TraceIQ handles small or partial codebases gracefully:
* If a repository has $\le 3$ files or lacks build manifests, it activates **Partial Repository Mode**:
  `"PARTIAL REPOSITORY / LIMITED CONTEXT: Repository contains only 3 or fewer files with no package/build manifests. Displaying available code structures; full system boundaries cannot be guaranteed."`
* If no services are detected, it synthesizes a single `Application Core` service mapped to the source files rather than generating fake microservices.

---

## 5. Mathematical Formulations & Graph Evaluation Algorithms

TraceIQ represents the reconstructed software architecture as a directed multigraph $G = (V, E)$, where $V$ is the set of architectural entities (services, databases, APIs, external systems) and $E$ is the set of directed dependency edges ($u \to v$ indicating $u$ calls, queries, or depends on $v$).

### 5.1. Graph Density
Measures how interconnected the architecture is relative to a fully connected network:
$$D = \frac{|E|}{|V|(|V| - 1)} \quad (\text{for } |V| > 1)$$
* **Interpretation**: Values above $0.20$ indicate high coupling, where services are tightly bound and changes have wide ripple effects.

### 5.2. Average Degree
The average number of architectural connections per component:
$$\langle k \rangle = \frac{2|E|}{|V|}$$
* Represents the mean connectivity load handled by services in the system.

### 5.3. McCabe Cyclomatic Complexity for Architectural Topologies
Adapted from control-flow complexity to system-level dependency topologies:
$$M = |E| - |V| + 2P$$
Where:
* $|E|$ is the total number of dependency edges.
* $|V|$ is the total number of architectural entities.
* $P$ is the number of weakly connected components (independent subgraphs).
* **Rating**:
  * $M \le 4$: **LOW** complexity (cleanly decoupled).
  * $5 \le M \le 10$: **MEDIUM** complexity.
  * $M > 10$ or presence of circular cycles: **HIGH** complexity (architectural entanglement).

### 5.4. Brandes Betweenness Centrality
Betweenness Centrality identifies bottleneck components that act as bridges along architectural paths:
$$C_B(v) = \sum_{s \neq v \neq t \in V} \frac{\sigma_{st}(v)}{\sigma_{st}}$$
Where:
* $\sigma_{st}$ is the total number of shortest dependency paths from node $s$ to node $t$.
* $\sigma_{st}(v)$ is the number of those shortest paths that pass through node $v$.

**Normalized Betweenness for Directed Topologies**:
$$\widetilde{C}_B(v) = \frac{C_B(v)}{(|V| - 1)(|V| - 2)} \quad (\text{for } |V| > 2)$$
TraceIQ implements Brandes' algorithm with time complexity $\mathcal{O}(|V| \cdot |E|)$, using BFS for unweighted edge traversal and reverse path accumulation.

### 5.5. PageRank via Power Iteration
PageRank measures recursive structural importance—a component is important if it is depended upon by other important components:
$$PR^{(k+1)}(v) = \frac{1 - \alpha}{|V|} + \alpha \left( \sum_{u \in \text{Pred}(v)} \frac{PR^{(k)}(u)}{d_{out}(u)} + \frac{\sum_{w \in \text{Dangling}} PR^{(k)}(w)}{|V|} \right)$$
Where:
* $\alpha = 0.85$ is the damping factor.
* $\text{Pred}(v)$ is the set of direct callers pointing to $v$.
* $d_{out}(u)$ is the out-degree (number of outbound dependencies) of caller $u$.
* $\text{Dangling}$ is the set of sink nodes where $d_{out}(w) = 0$ (e.g., databases, third-party APIs).
* Iteration terminates when $\sum_{v \in V} |PR^{(k+1)}(v) - PR^{(k)}(v)| < 10^{-5}$ or at 50 iterations.

### 5.6. Single Points of Failure (SPOF) Algorithmic Detection
TraceIQ identifies SPOFs through counterfactual subgraph analysis and articulation point algorithms:

```
[ Baseline Graph G ] -------------------> Compute pairwise reachability R_G(s, t)
        |
        v (For each component v in G)
[ Subgraph G' = G \ {v} ] -------------> Compute counterfactual reachability R_G'(s, t)
        |
        v
[ Severed Path Check ]
  - Is there any pair (s, t) where path exists in G, but NOT in G'?  --> TRANSIT SPOF
  - Is v a shared datastore/sink with in-degree >= 2?                --> SHARED DATASTORE SPOF
```

#### Category A: Transit SPOF (Articulation Bridge)
A component $v$ is a Transit SPOF if removing $v$ disconnects reachability between two other components:
$$\exists s, t \in V \setminus \{v\} \text{ such that } s \rightsquigarrow t \text{ in } G \land \neg(s \rightsquigarrow t) \text{ in } G \setminus \{v\}$$
TraceIQ evaluates this using Tarjan's DFS Articulation Points algorithm on the undirected projection of $G$:
* Maintains discovery time $tin[v]$ and lowest reachable ancestor $low[v]$.
* A non-root node $v$ is an articulation point if it has a child $to$ satisfying:
  $$low[to] \ge tin[v]$$

#### Category B: Shared Datastore Sink SPOF
Terminal nodes ($d_{out}(v) = 0$ or type `Database` / `External System`) do not have downstream targets, so removing them would not sever a path *between* other nodes. However, if multiple services depend directly on an un-replicated datastore, its failure disables all callers simultaneously:
$$\text{Type}(v) \in \{\text{Database}, \text{External System}\} \land d_{in}(v) \ge 2 \implies v \text{ is a SHARED\_DATASTORE SPOF}$$

**Severity Classification**:
* **CRITICAL**: $\ge 5$ severed paths OR shared sink with $\ge 4$ callers.
* **HIGH**: $\ge 2$ severed paths OR shared sink with $\ge 2$ callers.
* **MEDIUM**: Minor localized articulation point.
* **NONE**: Fully redundant routing or leaf node.

### 5.7. Multi-Signal Normalized Component Criticality Score
Combines five graph signals into a single bounded score ($0.0 - 1.0$):

$$\text{Crit}(v) = w_1 \cdot \widetilde{C}_B(v) + w_2 \cdot \widetilde{PR}(v) + w_3 \cdot \tilde{d}_{in}(v) + w_4 \cdot \widetilde{\text{Blast}}(v) + w_5 \cdot SPOF(v)$$

Where:
* $w_1 = 0.30$: Normalized Betweenness Centrality (transit bottleneck load).
* $w_2 = 0.25$: Normalized PageRank (recursive architectural authority).
* $w_3 = 0.20$: Normalized In-Degree (direct incoming caller fan-in).
* $w_4 = 0.15$: Normalized Blast Radius (upstream transitive reachability).
* $w_5 = 0.10$: Single Point of Failure indicator ($1.0$ if SPOF, $0.0$ otherwise).

**Min-Max Linear Normalization**:
For any raw metric $X(v)$:
$$\widetilde{X}(v) = \begin{cases}
0.0 & \text{if } X_{max} < 10^{-9} \\
0.5 & \text{if } X_{max} - X_{min} < 10^{-9} \text{ (uniform non-zero distribution)} \\
\frac{X(v) - X_{min}}{X_{max} - X_{min}} & \text{otherwise}
\end{cases}$$

**Criticality Tiers**:
* **CRITICAL**: $\text{Crit}(v) \ge 0.70$
* **HIGH**: $0.45 \le \text{Crit}(v) < 0.70$
* **MEDIUM**: $0.25 \le \text{Crit}(v) < 0.45$
* **LOW**: $\text{Crit}(v) < 0.25$

### 5.8. Composite Structural Risk Score ($0 - 100$)
TraceIQ calculates a single composite structural risk index for the entire architecture. Unlike LLM-generated scores, this value is 100% deterministic and reproducible:

$$\text{Score} = \min\left(100.0, \max\left(5.0, S_{coupling} + S_{spof} + S_{cycles} + S_{deps} + S_{external}\right)\right)$$

| Sub-Score Component | Formula | Cap | Rationale |
| :--- | :--- | :--- | :--- |
| **1. Base Density & Coupling** | $\min(25.0, D \cdot 30.0 + \langle k \rangle \cdot 2.5)$ | **25 pts** | High edge density and high average degree increase coordination complexity. |
| **2. Single Points of Failure** | $\min(30.0, |SPOFs| \cdot 12.0)$ | **30 pts** | Structural bottlenecks directly threaten system uptime. |
| **3. Circular Cycles** | $\min(20.0, |Cycles| \cdot 10.0)$ | **20 pts** | Cyclic dependencies cause deadlock, tight coupling, and testing nightmares. |
| **4. High-Risk Dependencies** | $\min(15.0, |HighRiskDeps| \cdot 3.5)$ | **15 pts** | Direct links pointing to critical nodes or SPOFs. |
| **5. External Exposure & Depth** | $\min(10.0, |ExtNodes| \cdot 3.0 + \max(0, \text{Depth} - 3) \cdot 1.5)$ | **10 pts** | Third-party API boundaries and deep cascading call chains. |

---

## 6. Objective 3: Hypothetical Change Simulator Engine

The Change Simulator lets architects answer: *"What happens if we remove this service, add this database connection, or break this API call?"*

```
[ Active Architecture Model M_active ]
                 |
                 v (Deep Copy Clone)
   +-------------------------------+
   | Non-Mutating Isolated Sandbox |  --> Active model, disk files, and saved
   | M_hypo = clone(M_active)      |      snapshots are NEVER modified
   +-------------------------------+
                 |
                 v
   +-------------------------------+
   | Apply Proposed Mutations:     |
   | - add_component               |
   | - remove_component            |
   | - add_dependency              |
   | - remove_dependency           |
   +-------------------------------+
                 |
                 v
   +-------------------------------+
   | Dependency Propagation Engine |  --> Traverses transposed graph G^T:
   | (Blast Radius Calculation)    |      A -> B means modifying B impacts caller A!
   +-------------------------------+
                 |
                 v
   +-------------------------------+
   | Dual Objective 2 Evaluation   |  --> Runs graph analysis on both M_active and
   | & Causal Risk Ledger Engine   |      M_hypo; computes delta S_hypo - S_active
   +-------------------------------+
                 |
                 v
   +-------------------------------+
   | Human-Readable Change Story   |  --> 4-step structured explanation
   +-------------------------------+
```

### 6.1. The Deep-Copy Non-Mutating Isolation Guarantee
The simulator strictly enforces runtime immutability:
```typescript
const hypothetical: ArchitectureModel = JSON.parse(JSON.stringify(currentArchitecture));
```
Any operation staged in the simulator exists only in memory within the simulator view. The user's active workspace, loaded snapshots, and original source files remain unaltered.

### 6.2. Dependency Propagation Semantics ($A \to B \implies$ impact on $A$)
A common error in architecture analysis is reversing dependency direction.
* In TraceIQ: **A directed edge $A \to B$ denotes that component $A$ calls, queries, or depends on component $B$**.
* Therefore, if component $B$ is modified, removed, or degraded, **component $A$ is the one that breaks or requires updating**.
* **Propagation Algorithm**:
  1. Initialize queue with directly changed component IDs.
  2. Perform Breadth-First Search (BFS) against the **transposed graph** $G^T$ (following incoming edges backwards).
  3. Every ancestor reached along incoming paths is flagged as **indirectly affected**.
  4. Record the full propagation path sequence: $A \to \dots \to B$.

### 6.3. Deterministic Causal Risk Ledger Point Attribution
The simulator attributes risk deltas ($\Delta S = S_{hypo} - S_{base}$) to specific actions using an explicit causal ledger:

| Architectural Event | Point Delta | Causal Explanation |
| :--- | :--- | :--- |
| **New Outbound Dependency Added** | $+4.0$ pts per edge | Increases coupling, edge density, and architectural coordination load. |
| **Dependency Decommissioned** | $-3.5$ pts per edge | Decouples components, reducing blast radius and graph density. |
| **New Single Point of Failure Created** | $+12.0$ pts per SPOF | Creates a structural bottleneck whose outage disrupts dependent callers. |
| **Single Point of Failure Resolved** | $-10.0$ pts per SPOF | Eliminates a bottleneck via redundant routing or replication. |
| **Circular Dependency Loop Created** | $+15.0$ pts per cycle | Introduces a recursive cycle with deadlock and distributed state risk. |
| **Circular Dependency Cycle Broken** | $-12.0$ pts per cycle | Restores acyclic directed flow, improving modularity. |
| **Third-Party External Integration Added**| $+6.0$ pts per integration | Introduces external boundary latency, network failure modes, and SLA risk. |
| **External Integration Decommissioned** | $-5.0$ pts per integration | Removes third-party perimeter vulnerabilities. |

### 6.4. Structured Human-Readable Change Story
The simulation output includes a 4-step narrative:
1. **Scope & Staging**: Number of applied changes and directly affected nodes.
2. **Blast Radius & Propagation**: Upstream callers affected across transitive propagation paths.
3. **Risk Posture Transition**: Initial score vs hypothetical score with net delta.
4. **Primary Causal Driver**: The leading contributor from the Causal Risk Ledger.

---

## 7. Graph Visualization & Dynamic Tiered Layout Engine

TraceIQ renders architecture graphs using **React Flow** (`@xyflow/react`) coupled with a custom dynamic tiering and positioning algorithm based on **Dagre**.

```
[ Tier 0: Clients / UI ]   -->   [ Tier 1: Gateways ]   -->   [ Tier 2: Domain Services ]   -->   [ Tier 3: Sinks / DBs ]
  - Web Application                - API Gateway                - Order Service                     - PostgreSQL
  - Mobile App (Flutter)           - Nginx Reverse Proxy        - Payment Service                   - Redis Cache
  - Chrome Extension                                            - Recommendation ML                 - External APIs
```

### 7.1. Dynamic Tiering Algorithm
To prevent visual clutter, nodes are placed into logical architectural tiers:
1. **Sink Identification**: Nodes of type `Database` or `External System`, or nodes with zero out-degree ($d_{out}(v) = 0$), are placed in the rightmost/bottom tier.
2. **Entry Point Identification**: Nodes of type `Application`, nodes with zero in-degree ($d_{in}(v) = 0$), or nodes with names containing `client`, `frontend`, `ui`, or `extension` are placed in **Tier 0**.
3. **Topological BFS Traversal**: Intermediate domain services are assigned tiers based on their longest path from Tier 0.
4. **Sink Placement**: Sinks are assigned tier index $\text{Tier}_{max\_service} + 1$.

### 7.2. Geometric Coordinates & Centered Column Layout
TraceIQ computes explicit $(x, y)$ coordinates to guarantee visual stability:
* **Node Dimensions**:
  * Service / Application: $260 \times 105\text{ px}$
  * Database: $250 \times 105\text{ px}$
  * API: $240 \times 95\text{ px}$
  * Module / Library: $230 \times 90\text{ px}$
* **Separation**:
  * Rank gap (between columns in LR mode): $150\text{ px}$
  * Node gap (between rows in a column): $45\text{ px}$
* **Vertical Centering**: Columns with fewer nodes are centered relative to the tall column:
  $$\text{crossOffset} = \frac{\text{maxCrossDimension} - \text{columnCrossDimension}}{2}$$
* **Layout Immutability**: Node coordinates are computed once upon model load and cached. Searching, filtering, or selecting nodes does **not** trigger layout shifts or node repositioning.

### 7.3. Edge Routing & Color Coding
Edges are rendered as smooth bezier curves with directional arrowheads:
* `CALLS`: Blue (`#2563eb`) — Synchronous HTTP/gRPC invocation.
* `DEPENDS_ON`: Purple (`#7c3aed`) — Orchestration or startup dependency.
* `USES`: Emerald Green (`#059669`) — Internal library or utility usage.
* `CONNECTS_TO`: Amber (`#d97706`) — Network or socket connection.
* `IMPORTS`: Indigo (`#6366f1`) — Code-level source import.
* `QUERIES`: Cyan (`#0891b2`) — Database read/write operation.
* `LOADS`: Amber (`#d97706`) — Serialized model or asset deserialization.
* `EXPOSES`: Sky Blue (`#0284c7`) — Route or endpoint declaration.
* `CONTAINS`: Slate (`#64748b`) — Parent package containment.

---

## 8. Level 1 vs Level 2 Comparison & Diff Reconciliation Engine

The Compare engine performs side-by-side evaluations between two architecture snapshots, comparing both the raw file inventory (Level 1) and the semantic graph (Level 2).

```
   [ Snapshot V1 / Original ]                  [ Snapshot V2 / Target ]
              |                                           |
              +---------------------+---------------------+
                                    |
                                    v
                 +--------------------------------------+
                 | Mathematical Identity Reconciliation |
                 +--------------------------------------+
                        /                        \
                       v                          v
       [ LEVEL 1 REPOSITORY DIFF ]      [ LEVEL 2 ARCHITECTURE DIFF ]
       - Added files                    - Added entities
       - Removed files                  - Removed entities
       - Modified files (by hash)       - Modified entities
       - Unchanged files                - Unchanged entities
       - Folders added/removed          - Relationship changes
```

### 8.1. Mathematical Invariant Reconciliation
TraceIQ enforces strict mathematical identities across all comparisons:

$$\begin{aligned}
\text{Original Count} &= \text{Removed} + \text{Modified} + \text{Unchanged} \\
\text{Target Count} &= \text{Added} + \text{Modified} + \text{Unchanged}
\end{aligned}$$

Every item in both versions is accounted for:
1. **Added**: Present in Target but absent from Original.
2. **Removed**: Present in Original but absent from Target.
3. **Modified**: Present in both versions under the same path/ID, but with differing content hashes or configuration metadata.
4. **Unchanged**: Present in both versions with identical content hashes and properties.

### 8.2. Level 1 Repository Inventory Diff
* Compares file paths and deterministic content hashes.
* If `file.content_hash` differs between V1 and V2, the file is classified as `modified` with the exact hash transition recorded.
* Visual presentation includes file extensions, byte sizes, line count deltas, and file category badges.

### 8.3. Level 2 Architecture Topology Diff
* Compares entities by canonical ID.
* Compares relationships by compound key: `source->target:type`.
* Renders a **Unified Visual Diff Graph**:
  * **Added** elements: Green border, green badge, solid green line.
  * **Removed** elements: Red border, red badge, dashed red line.
  * **Modified** elements: Amber border, amber badge.
  * **Unchanged** elements: Standard slate styling.

### 8.4. Immutable Snapshot Management
Architectures can be frozen into immutable snapshots:
* Snapshots store deep-copied clones of the architecture model and repository inventory.
* Once saved, snapshots cannot be altered by ongoing analysis or simulator runs.
* Users can switch active snapshots, rename labels, or launch comparisons between any two saved snapshots.

---

## 9. Frontend Information Architecture & Navigation

The user interface follows clean, modern information architecture principles designed for complex engineering workflows:

```
+----------------------------------------------------------------------------------------------------+
| TRACEIQ TopHeader: System Name | Version | Files Count | Demo | Blueprint | Upload | Reset | (Ctrl+K)  |
+-----------+----------------------------------------------------------------------------------------+
| SIDEBAR   | MAIN WORKSPACE CONTENT                                                                 |
|           |                                                                                        |
| Analyze   | Dedicated view rendered according to the active route.                                |
| Architect.| Provides progressive disclosure, structured tables, interactive graph canvases,         |
| Dependen. | and contextual details without cluttering the screen.                                  |
| Inventory |                                                                                        |
| Risk      |                                                                                        |
| Impact    |                                                                                        |
| Compare   |                                                                                        |
| Simulator |                                                                                        |
| Snapshots |                                                                                        |
| Evidence  |                                                                                        |
| Reports   |                                                                                        |
|           |                                                                                        |
+-----------+----------------------------------------------------------------------------------------+
| (Assistant: Floating bottom-right contextual panel)                                                |
+----------------------------------------------------------------------------------------------------+
```

### 9.1. Navigation Routes
1. **Analyze (`/analyze`)**: Ingestion hub. Drag-and-drop dropzones for ZIP and JSON files, live 5-step processing progress, and quick-start scenario switcher.
2. **Architecture (`/architecture`)**: Full-screen interactive graph canvas with minimap, zoom controls, tier alignment, entity inspector panel, and edge filter pills.
3. **Dependencies (`/dependencies`)**: Tabular dependency matrix showing caller, target, relationship type, protocol, risk flag, and link to code evidence.
4. **Repository Inventory (`/inventory`)**: Level 1 explorer with file categorization charts, language distribution, line counts, search bar, and full file-table with analysis statuses.
5. **Risk Analysis (`/risk`)**: Objective 2 risk table with severity filters, blast radius indicators, and the **Progressive Disclosure Modal** showing exact graph metrics.
6. **Impact Analysis (`/impact`)**: Interactive blast radius visualizer. Selecting any component highlights all upstream callers and transitive failure paths.
7. **Compare (`/compare`)**: Side-by-side diff workspace. Displays unified reconciliation metrics, Level 1 file diffs, and Level 2 topological changes.
8. **Change Simulator (`/simulator`)**: Objective 3 sandbox. Stage component/dependency modifications, run isolated simulations, inspect propagation paths, and view the Causal Risk Ledger and Change Story.
9. **Snapshots (`/snapshots`)**: Snapshot management gallery. Inspect, rename, delete, and restore immutable architecture versions.
10. **Evidence (`/evidence`)**: Audit log containing all extracted code snippets, line numbers, extraction methods, and confidence ratings.
11. **Reports (`/reports`)**: Executive summary and architectural compliance report, complete with risk breakdowns, structural metrics, and export capabilities.

### 9.2. Floating Contextual Assistant
* Positioned in the bottom-right corner as a collapsible panel.
* Dynamically inspects the currently selected component, active risk findings, and loaded architecture model.
* Answers questions regarding why a component is high-risk, what dependencies need refactoring, and how to resolve detected SPOFs.

---

## 10. Complete Project Directory Structure & File Map

```
TRACEIQ/
├── package.json                   # Frontend dependencies: React 19, Vite, Tailwind CSS, @xyflow/react, JSZip
├── tsconfig.json                  # TypeScript compiler configuration
├── vite.config.ts                 # Vite server config & reverse proxy (/api/v2, /api/v3 -> localhost:8001)
├── content.md                     # Complete project documentation and architectural reference (this file)
│
├── src/
│   ├── App.tsx                    # Master application state, view routing, and modal management
│   ├── main.tsx                   # React root entry point
│   ├── index.css                  # Global styles, Tailwind directives, font imports
│   │
│   ├── types/
│   │   └── architecture.ts        # Core TypeScript interfaces: Entities, Relationships, Inventory, Diff,
│   │                              # Objective 2 metrics, Objective 3 simulation, Snapshots, Causal Ledger
│   │
│   ├── engine/
│   │   ├── codebaseAnalyzer.ts    # Level 1 JSZip reader, hashing, AST/regex multi-language scanner
│   │   ├── blueprintParser.ts     # Blueprint JSON parser and schema validator
│   │   ├── architectureReconstructor.ts # Entity deduplication, normalization, stats synthesizer
│   │   ├── graphLayout.ts         # Dagre-based dynamic tiered layout, node sizing, edge coloring
│   │   ├── architectureDiffEngine.ts    # Level 1 & Level 2 diff reconciler, snapshot creator
│   │   ├── objective2AnalysisEngine.ts  # Client-side Brandes, PageRank, Tarjan SPOF, McCabe complexity
│   │   └── changeSimulatorEngine.ts     # Objective 3 deep-copy sandbox, propagation BFS, causal risk ledger
│   │
│   ├── data/
│   │   ├── demoArchitecture.ts    # Built-in e-commerce microservices architecture demo
│   │   ├── sampleBlueprints.ts    # Sample architectural blueprint JSON specifications
│   │   └── sampleEvolutions.ts    # Pre-packaged V1 and V2 evolution snapshots for comparison demos
│   │
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx        # Persistent left navigation bar with badge counters
│       │   └── TopHeader.tsx      # System overview, quick action buttons, search trigger
│       │
│       ├── pages/
│       │   ├── AnalyzePage.tsx    # Upload dropzone and 5-stage pipeline progress view
│       │   ├── ArchitecturePage.tsx # Interactive React Flow canvas with tiering and inspector
│       │   ├── DependenciesPage.tsx # Dependency matrix table with protocol filters
│       │   ├── RepositoryInventoryPage.tsx # Level 1 file tree, categories, size/line counts
│       │   ├── RiskAnalysisPage.tsx # Objective 2 risk table & Progressive Disclosure Modal
│       │   ├── ImpactAnalysisPage.tsx # Blast radius visualizer and propagation path explorer
│       │   ├── ComparePage.tsx    # Level 1 vs Level 2 side-by-side comparison workspace
│       │   ├── ChangeSimulatorPage.tsx # Objective 3 change simulator, causal ledger, change story
│       │   ├── SnapshotsPage.tsx  # Immutable snapshot management gallery
│       │   ├── EvidencePage.tsx   # Code snippet provenance and extraction audit log
│       │   └── ReportsPage.tsx    # Architecture compliance report and executive summary
│       │
│       ├── graph/
│       │   ├── ArchitectureGraph.tsx # React Flow canvas implementation with minimap and controls
│       │   ├── CustomNode.tsx     # Custom styled entity node with badges, icons, and diff rings
│       │   └── CustomEdge.tsx     # Custom bezier edge with protocol labels and diff colors
│       │
│       ├── input/
│       │   ├── CodebaseUploadModal.tsx # Drag-and-drop ZIP archive upload modal
│       │   ├── BlueprintEditorModal.tsx # Interactive JSON blueprint editor and validator
│       │   └── ScenarioSwitcherModal.tsx # Preset architecture scenario selector
│       │
│       ├── inventory/
│       │   └── CodebaseInventoryModal.tsx # Popup file inventory table with search and filtering
│       │
│       ├── search/
│       │   └── GlobalSearchModal.tsx # Global search (Ctrl+K) across files, entities, relationships
│       │
│       └── assistant/
│           └── TraceIQAssistant.tsx # Floating contextual assistant with graph-aware guidance
│
└── objective2/
    └── backend/
        ├── run_backend.py         # Entry point script to launch FastAPI server on port 8001
        ├── requirements.txt       # Python dependencies: fastapi, uvicorn, networkx, pydantic
        │
        └── app/
            ├── main.py            # FastAPI application definition with CORS and routers
            │
            ├── api/
            │   └── endpoints.py   # REST routes: /api/v2/analyze, /api/v2/criticality,
            │                      # /api/v2/spof, /api/v2/complexity, /api/v3/simulate
            │
            ├── models/
            │   └── schemas.py     # Pydantic schemas mirroring TypeScript architecture interfaces
            │
            └── services/
                ├── graph_service.py       # NetworkX DiGraph builder from entity/relationship payloads
                ├── metrics_service.py     # Centrality, degree, and path analysis via NetworkX
                ├── spof_service.py        # Counterfactual removal and Tarjan articulation detection
                ├── criticality_service.py # 5-signal normalized component criticality calculation
                ├── complexity_service.py  # Density, average degree, McCabe complexity, cycles
                ├── risk_service.py        # Deterministic composite structural risk score (0-100)
                └── simulation_service.py  # Objective 3 change simulator and causal ledger
```

---

## 11. Verification, Running the Project & API Reference

### 11.1. How to Run the Application
TraceIQ runs with two local processes:

1. **Start the FastAPI Backend (Port 8001)**:
   ```powershell
   cd "c:\Users\prana\Desktop\final year project\TRACEIQ"
   .\objective2\backend\.venv\Scripts\python.exe .\objective2\backend\run_backend.py
   ```
   * Runs at `http://127.0.0.1:8001`
   * Interactive OpenAPI documentation available at `http://127.0.0.1:8001/docs`

2. **Start the React Frontend (Port 5173)**:
   ```powershell
   cd "c:\Users\prana\Desktop\final year project\TRACEIQ"
   npm run dev -- --host 127.0.0.1 --port 5173
   ```
   * Accessible in the browser at `http://127.0.0.1:5173`
   * Requests to `/api/v2/*` and `/api/v3/*` are automatically proxied to port 8001.

### 11.2. Backend REST API Endpoints

#### `POST /api/v2/analyze`
Accepts an `ArchitectureModel` JSON payload. Returns complete Objective 2 graph metrics:
* `component_metrics`: Per-node in-degree, out-degree, betweenness, PageRank, longest paths.
* `critical_components`: Ranked list of critical components with score breakdown.
* `spofs`: Detected transit and shared datastore SPOFs with severed paths.
* `complexity`: Density, cyclomatic index, average degree, simple cycles.
* `composite_risk_score`: Deterministic 0-100 structural risk score.

#### `POST /api/v2/criticality`
Evaluates only the 5-signal component criticality ranking for a given model.

#### `POST /api/v2/spof`
Runs counterfactual node removal to identify all Single Points of Failure and affected paths.

#### `POST /api/v2/complexity`
Calculates graph density, cyclomatic complexity, circular dependency cycles, and maximum depth.

#### `POST /api/v3/simulate`
Accepts `current_architecture` and a list of `changes` (`add_component`, `remove_component`, `add_dependency`, `remove_dependency`). Returns:
* `current_risk_score` vs `hypothetical_risk_score` and `risk_delta`.
* `directly_affected_nodes` and `indirectly_affected_nodes`.
* `propagation_paths`: Transitive upstream impact chains.
* `causal_risk_ledger`: Point-by-point causal attribution list.
* `change_story`: 4-step structured explanation of the modification.

---

## 12. Summary: Why TraceIQ is Architecturally Truthful

TraceIQ adheres to four core guarantees:
1. **No Data Loss**: Level 1 catalogs 100% of files from ingested archives. Every single file has a verified status and content hash.
2. **No Hallucinations**: All metrics, centrality scores, SPOF classifications, and risk indices are mathematically derived from graph theory—not estimated by probabilistic models.
3. **Strict Immutability**: Simulations and hypothetical changes execute on deep copies and never mutate active architectures, saved snapshots, or disk files.
4. **Mathematical Reconciliation**: Every comparison between two states satisfies exact accounting identities ($Orig = Rem + Mod + Unch$ and $Tgt = Add + Mod + Unch$).
