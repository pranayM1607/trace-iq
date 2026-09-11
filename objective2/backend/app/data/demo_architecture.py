from ..models.schemas import (
    ArchitectureModel,
    ArchitectureEntity,
    ArchitectureRelationship,
    ArchitectureStats,
    SourceEvidence,
    CodebaseInventory,
    InventoryFile,
    DetectedModule,
    CodebaseFileDependency,
    CodebaseModuleDependency,
    CodebaseNode,
    CodebaseGraph,
)

DEMO_INVENTORY_FILES = [
    InventoryFile(path="services/storefront/package.json", category="manifest", extension=".json", size_bytes=1420, lines_count=45, language="JSON", associated_entity_id="web-client"),
    InventoryFile(path="services/storefront/src/App.tsx", category="source", extension=".tsx", size_bytes=3840, lines_count=120, language="TypeScript", associated_entity_id="web-client"),
    InventoryFile(path="services/storefront/src/api/client.ts", category="source", extension=".ts", size_bytes=1980, lines_count=65, language="TypeScript", associated_entity_id="web-client"),
    InventoryFile(path="services/mobile/package.json", category="manifest", extension=".json", size_bytes=1250, lines_count=38, language="JSON", associated_entity_id="mobile-app"),
    InventoryFile(path="services/mobile/App.tsx", category="source", extension=".tsx", size_bytes=4200, lines_count=135, language="TypeScript", associated_entity_id="mobile-app"),
    InventoryFile(path="services/gateway/envoy.yaml", category="config", extension=".yaml", size_bytes=2890, lines_count=88, language="YAML", associated_entity_id="api-gateway"),
    InventoryFile(path="services/auth/go.mod", category="manifest", extension="no-ext", size_bytes=860, lines_count=24, language="Go", associated_entity_id="auth-service"),
    InventoryFile(path="services/auth/main.go", category="source", extension=".go", size_bytes=4520, lines_count=145, language="Go", associated_entity_id="auth-service"),
    InventoryFile(path="services/auth/jwt/token.go", category="source", extension=".go", size_bytes=2100, lines_count=72, language="Go", associated_entity_id="auth-service"),
    InventoryFile(path="services/user/package.json", category="manifest", extension=".json", size_bytes=1320, lines_count=42, language="JSON", associated_entity_id="user-service"),
    InventoryFile(path="services/user/src/user.service.ts", category="source", extension=".ts", size_bytes=3600, lines_count=110, language="TypeScript", associated_entity_id="user-service"),
    InventoryFile(path="services/order/pom.xml", category="manifest", extension=".xml", size_bytes=4800, lines_count=155, language="XML", associated_entity_id="order-service"),
    InventoryFile(path="services/order/src/OrderController.java", category="source", extension=".java", size_bytes=5200, lines_count=165, language="Java", associated_entity_id="order-service"),
    InventoryFile(path="services/payment/requirements.txt", category="manifest", extension=".txt", size_bytes=680, lines_count=18, language="Python", associated_entity_id="payment-service"),
    InventoryFile(path="services/payment/main.py", category="source", extension=".py", size_bytes=4100, lines_count=130, language="Python", associated_entity_id="payment-service"),
    InventoryFile(path="services/inventory/go.mod", category="manifest", extension="no-ext", size_bytes=910, lines_count=26, language="Go", associated_entity_id="inventory-service"),
    InventoryFile(path="services/inventory/main.go", category="source", extension=".go", size_bytes=3900, lines_count=125, language="Go", associated_entity_id="inventory-service"),
    InventoryFile(path="services/notification/worker.ts", category="source", extension=".ts", size_bytes=2800, lines_count=90, language="TypeScript", associated_entity_id="notification-service"),
    InventoryFile(path="services/analytics/tasks.py", category="source", extension=".py", size_bytes=3100, lines_count=98, language="Python", associated_entity_id="analytics-worker"),
    InventoryFile(path="docker-compose.yml", category="manifest", extension=".yml", size_bytes=3200, lines_count=95, language="YAML"),
    InventoryFile(path="README.md", category="documentation", extension=".md", size_bytes=2400, lines_count=75),
]

DEMO_FILE_DEPENDENCIES = [
    CodebaseFileDependency(
        id="dep-1",
        source_file="services/storefront/src/App.tsx",
        target_file="services/storefront/src/api/client.ts",
        type="IMPORTS",
        line=4,
        snippet="import { apiClient } from './api/client';",
        statement="./api/client",
        detectionMethod="TypeScript Import Extractor"
    ),
    CodebaseFileDependency(
        id="dep-2",
        source_file="services/auth/main.go",
        target_file="services/auth/jwt/token.go",
        type="IMPORTS",
        line=8,
        snippet='import "services/auth/jwt"',
        statement="services/auth/jwt",
        detectionMethod="Go Package Import Extractor"
    ),
    CodebaseFileDependency(
        id="dep-3",
        source_file="services/storefront/src/api/client.ts",
        target_file="services/gateway/envoy.yaml",
        type="CALLS",
        line=12,
        snippet="const res = await axios.get('/api/v1/health');",
        statement="/api/v1/health",
        detectionMethod="REST Route & API Call Extractor"
    ),
    CodebaseFileDependency(
        id="dep-4",
        source_file="services/user/src/user.service.ts",
        target_file="services/auth/jwt/token.go",
        type="DEPENDS_ON",
        line=6,
        snippet="import { verifyToken } from '../auth/jwt';",
        statement="../auth/jwt",
        detectionMethod="TypeScript Import Extractor"
    ),
    CodebaseFileDependency(
        id="dep-5",
        source_file="services/order/src/OrderController.java",
        target_file="services/payment/main.py",
        type="CALLS",
        line=45,
        snippet="restTemplate.postForObject('/api/v1/payments', req, Res.class);",
        statement="/api/v1/payments",
        detectionMethod="REST Route & API Call Extractor"
    ),
    CodebaseFileDependency(
        id="dep-6",
        source_file="services/notification/worker.ts",
        target_file="services/analytics/tasks.py",
        type="CALLS",
        line=32,
        snippet="channel.publish('events', 'receipt', data);",
        statement="events/receipt",
        detectionMethod="Async Message Bus Extractor"
    ),
    CodebaseFileDependency(
        id="dep-7",
        source_file="services/analytics/tasks.py",
        target_file="services/notification/worker.ts",
        type="CALLS",
        line=54,
        snippet="requests.post('http://notification-service:8080/alerts', json=data)",
        statement="http://notification-service:8080/alerts",
        detectionMethod="HTTP Client Request Extractor"
    )
]

DEMO_MODULE_DEPENDENCIES = [
    CodebaseModuleDependency(
        id="mod-dep-1",
        source_module="services/storefront",
        target_module="services/gateway",
        type="CALLS",
        count=1,
        sample_evidence=SourceEvidence(
            file="services/storefront/src/api/client.ts",
            line=12,
            snippet="const res = await axios.get('/api/v1/health');",
            confidence=0.95
        )
    ),
    CodebaseModuleDependency(
        id="mod-dep-2",
        source_module="services/user",
        target_module="services/auth",
        type="DEPENDS_ON",
        count=1,
        sample_evidence=SourceEvidence(
            file="services/user/src/user.service.ts",
            line=6,
            snippet="import { verifyToken } from '../auth/jwt';",
            confidence=0.9
        )
    ),
    CodebaseModuleDependency(
        id="mod-dep-3",
        source_module="services/order",
        target_module="services/payment",
        type="CALLS",
        count=1,
        sample_evidence=SourceEvidence(
            file="services/order/src/OrderController.java",
            line=45,
            snippet="restTemplate.postForObject('/api/v1/payments', req, Res.class);",
            confidence=0.92
        )
    ),
    CodebaseModuleDependency(
        id="mod-dep-4",
        source_module="services/notification",
        target_module="services/analytics",
        type="CALLS",
        count=1,
        sample_evidence=SourceEvidence(
            file="services/notification/worker.ts",
            line=32,
            snippet="channel.publish('events', 'receipt', data);",
            confidence=0.9
        )
    ),
    CodebaseModuleDependency(
        id="mod-dep-5",
        source_module="services/analytics",
        target_module="services/notification",
        type="CALLS",
        count=1,
        sample_evidence=SourceEvidence(
            file="services/analytics/tasks.py",
            line=54,
            snippet="requests.post('http://notification-service:8080/alerts', json=data)",
            confidence=0.95
        )
    )
]

DEMO_CODEBASE_NODES = [
    CodebaseNode(
        id=f.path,
        name=f.path.split("/")[-1],
        type="file",
        path=f.path,
        extension=f.extension,
        language=f.language,
        category=f.category,
        size_bytes=f.size_bytes,
        lines_count=f.lines_count or 0,
        service_id=f.associated_entity_id,
        imports=[d.target_file for d in DEMO_FILE_DEPENDENCIES if d.source_file == f.path],
        imported_by=[d.source_file for d in DEMO_FILE_DEPENDENCIES if d.target_file == f.path]
    )
    for f in DEMO_INVENTORY_FILES
]

DEMO_CODEBASE_GRAPH = CodebaseGraph(
    nodes=DEMO_CODEBASE_NODES,
    edges=DEMO_FILE_DEPENDENCIES,
    module_dependencies=DEMO_MODULE_DEPENDENCIES,
    total_nodes=len(DEMO_CODEBASE_NODES),
    total_edges=len(DEMO_FILE_DEPENDENCIES),
    total_imports=len(DEMO_FILE_DEPENDENCIES)
)

DEMO_INVENTORY = CodebaseInventory(
    total_files=len(DEMO_INVENTORY_FILES),
    total_folders=14,
    total_lines=sum(f.lines_count or 0 for f in DEMO_INVENTORY_FILES),
    languages={"TypeScript": 6, "Python": 4, "Go": 4, "Java": 2, "YAML": 2, "JSON": 3, "XML": 1},
    frameworks=["React 18", "Spring Boot 3.2", "FastAPI", "Gin Web Framework", "NestJS", "gRPC", "PostgreSQL", "Redis", "RabbitMQ", "Docker Compose"],
    categories_breakdown={"source": 10, "manifest": 8, "config": 1, "documentation": 1, "other": 1},
    manifests=[
        "docker-compose.yml", "services/storefront/package.json", "services/mobile/package.json",
        "services/auth/go.mod", "services/user/package.json", "services/order/pom.xml",
        "services/payment/requirements.txt", "services/inventory/go.mod"
    ],
    config_files=["services/gateway/envoy.yaml"],
    modules=[
        DetectedModule(id="mod-storefront", name="Storefront Module", path="services/storefront", files_count=3, languages=["TypeScript", "JSON"]),
        DetectedModule(id="mod-mobile", name="Mobile Module", path="services/mobile", files_count=2, languages=["TypeScript", "JSON"]),
        DetectedModule(id="mod-gateway", name="Gateway Module", path="services/gateway", files_count=1, languages=["YAML"]),
        DetectedModule(id="mod-auth", name="Auth Module", path="services/auth", files_count=3, languages=["Go"]),
        DetectedModule(id="mod-user", name="User Module", path="services/user", files_count=2, languages=["TypeScript", "JSON"]),
        DetectedModule(id="mod-order", name="Order Module", path="services/order", files_count=2, languages=["Java", "XML"]),
        DetectedModule(id="mod-payment", name="Payment Module", path="services/payment", files_count=2, languages=["Python"]),
        DetectedModule(id="mod-inventory", name="Inventory Module", path="services/inventory", files_count=2, languages=["Go"]),
        DetectedModule(id="mod-notification", name="Notification Module", path="services/notification", files_count=1, languages=["TypeScript"]),
        DetectedModule(id="mod-analytics", name="Analytics Module", path="services/analytics", files_count=1, languages=["Python"]),
    ],
    packages=["express", "fastapi", "spring-boot-starter-web", "grpc", "pg", "redis", "pika", "stripe"],
    libraries=["jsonwebtoken", "pino", "bcrypt"],
    endpoints_count=0,
    datastores_count=2,
    external_integrations_count=1,
    files=DEMO_INVENTORY_FILES,
    folders=[
        "services", "services/storefront", "services/storefront/src", "services/storefront/src/api",
        "services/mobile", "services/gateway", "services/auth", "services/auth/jwt",
        "services/user", "services/user/src", "services/order", "services/order/src",
        "services/payment", "services/inventory", "services/notification", "services/analytics"
    ],
    file_dependencies=DEMO_FILE_DEPENDENCIES,
    codebase_graph=DEMO_CODEBASE_GRAPH,
    detection_summary="Extracted 13 components from 21 repository files across 14 directories in multi-service microservice layout.",
    is_limited_architecture=False,
    limited_architecture_reason=None
)

DEMO_ARCHITECTURE = ArchitectureModel(
    systemName="Cloud Enterprise Retail & Checkout Ecosystem",
    version="2.5.0",
    extractedAt="2026-09-07T10:00:00Z",
    inputType="demo",
    sourceArtifacts=[
        "services/storefront/package.json",
        "services/mobile/package.json",
        "services/gateway/envoy.yaml",
        "services/auth/go.mod",
        "services/user/package.json",
        "services/order/pom.xml",
        "services/payment/requirements.txt",
        "services/inventory/main.go",
        "services/notification/worker.ts",
        "services/analytics/tasks.py",
        "docker-compose.yml"
    ],
    entities=[
        ArchitectureEntity(
            id="web-client",
            name="Web Storefront Client",
            type="Service",
            technology="React 18 / TypeScript",
            source="Detected",
            description="Single-page web application driving consumer cart and catalog browsing.",
            sourceEvidence=SourceEvidence(
                file="services/storefront/package.json",
                line=1,
                snippet='"name": "storefront-client", "dependencies": { "react": "^18.2.0" }',
                description="Declared React application package",
                detectionMethod="Manifest Analysis (package.json)",
                folderModule="services/storefront"
            ),
            associatedFiles=["services/storefront/package.json", "services/storefront/src/App.tsx", "services/storefront/src/api/client.ts"],
            metadata={"port": 3000, "framework": "Next.js", "runtime": "Node 20"}
        ),
        ArchitectureEntity(
            id="mobile-app",
            name="Mobile Consumer App",
            type="Service",
            technology="React Native / iOS & Android",
            source="Detected",
            description="Native mobile retail client interacting via edge gateway.",
            sourceEvidence=SourceEvidence(
                file="services/mobile/package.json",
                line=1,
                snippet='"name": "mobile-consumer-app"',
                description="React Native mobile application",
                detectionMethod="Manifest Analysis (package.json)",
                folderModule="services/mobile"
            ),
            associatedFiles=["services/mobile/package.json", "services/mobile/App.tsx"],
            metadata={"framework": "React Native", "runtime": "Mobile Client"}
        ),
        ArchitectureEntity(
            id="api-gateway",
            name="Cloud API Gateway",
            type="Service",
            technology="Kong / Envoy Proxy",
            source="Detected",
            description="Edge reverse proxy handling JWT validation, throttling, and request routing.",
            sourceEvidence=SourceEvidence(
                file="services/gateway/envoy.yaml",
                line=1,
                snippet="static_resources:\n  listeners:\n  - address: 0.0.0.0:8080",
                description="Envoy proxy routing declaration",
                detectionMethod="Config Analysis (envoy.yaml)",
                folderModule="services/gateway"
            ),
            associatedFiles=["services/gateway/envoy.yaml"],
            metadata={"port": 8080, "framework": "Envoy", "runtime": "Linux Container"}
        ),
        ArchitectureEntity(
            id="auth-service",
            name="Authentication & Token Authority",
            type="Service",
            technology="Go / JWT",
            source="Detected",
            description="Identity verification, OAuth2 tokens, and security policy checks.",
            sourceEvidence=SourceEvidence(
                file="services/auth/go.mod",
                line=1,
                snippet="module auth-service\n\ngo 1.22",
                description="Go auth module with JWT signing",
                detectionMethod="Manifest Analysis (go.mod)",
                folderModule="services/auth"
            ),
            associatedFiles=["services/auth/go.mod", "services/auth/main.go", "services/auth/jwt/token.go"],
            metadata={"port": 5001, "framework": "Gin", "runtime": "Go 1.22"}
        ),
        ArchitectureEntity(
            id="user-service",
            name="User Management Service",
            type="Service",
            technology="Node.js / NestJS",
            source="Detected",
            description="Customer profiles, preferences, and address book records.",
            sourceEvidence=SourceEvidence(
                file="services/user/package.json",
                line=1,
                snippet='"name": "user-service"',
                description="NestJS microservice",
                detectionMethod="Manifest Analysis (package.json)",
                folderModule="services/user"
            ),
            associatedFiles=["services/user/package.json", "services/user/src/user.service.ts"],
            metadata={"port": 5002, "framework": "NestJS", "runtime": "Node.js 20"}
        ),
        ArchitectureEntity(
            id="order-service",
            name="Order Orchestration Service",
            type="Service",
            technology="Java / Spring Boot",
            source="Detected",
            description="Checkout state machine orchestrating payment, stock, and confirmation.",
            sourceEvidence=SourceEvidence(
                file="services/order/pom.xml",
                line=1,
                snippet="<artifactId>order-service</artifactId>",
                description="Spring Boot checkout microservice",
                detectionMethod="Manifest Analysis (pom.xml)",
                folderModule="services/order"
            ),
            associatedFiles=["services/order/pom.xml", "services/order/src/OrderController.java"],
            metadata={"port": 8081, "framework": "Spring Boot 3.2", "runtime": "OpenJDK 21"}
        ),
        ArchitectureEntity(
            id="payment-service",
            name="Payment Processing Service",
            type="Service",
            technology="Python / FastAPI",
            source="Detected",
            description="Transaction ledger, card tokenization, and third-party gateway dispatch.",
            sourceEvidence=SourceEvidence(
                file="services/payment/requirements.txt",
                line=1,
                snippet="fastapi>=0.100.0\nstripe>=5.0.0",
                description="FastAPI payment microservice",
                detectionMethod="Manifest Analysis (requirements.txt)",
                folderModule="services/payment"
            ),
            associatedFiles=["services/payment/requirements.txt", "services/payment/main.py"],
            metadata={"port": 8000, "framework": "FastAPI", "runtime": "Python 3.11"}
        ),
        ArchitectureEntity(
            id="inventory-service",
            name="Inventory & Warehouse Service",
            type="Service",
            technology="Go / gRPC",
            source="Detected",
            description="Warehouse SKU reservation, allocation checks, and inventory status.",
            sourceEvidence=SourceEvidence(
                file="services/inventory/main.go",
                line=1,
                snippet="package main\n\nimport \"google.golang.org/grpc\"",
                description="gRPC warehouse service",
                detectionMethod="Source File Enclosure",
                folderModule="services/inventory"
            ),
            associatedFiles=["services/inventory/go.mod", "services/inventory/main.go"],
            metadata={"port": 9090, "framework": "gRPC", "runtime": "Go 1.22"}
        ),
        ArchitectureEntity(
            id="notification-service",
            name="Notification Dispatcher",
            type="Service",
            technology="Node.js / RabbitMQ",
            source="Detected",
            description="Transactional email, push notifications, and customer alerts.",
            sourceEvidence=SourceEvidence(
                file="services/notification/worker.ts",
                line=1,
                snippet="import amqp from 'amqplib';",
                description="Node.js AMQP worker",
                detectionMethod="Source File Enclosure",
                folderModule="services/notification"
            ),
            associatedFiles=["services/notification/worker.ts"],
            metadata={"port": 5005, "framework": "AmqpLib", "runtime": "Node.js 20"}
        ),
        ArchitectureEntity(
            id="analytics-worker",
            name="Event Stream Analytics Worker",
            type="Module",
            technology="Python / Celery",
            source="Detected",
            description="Background event aggregation worker computing live telemetry and metric alerts.",
            sourceEvidence=SourceEvidence(
                file="services/analytics/tasks.py",
                line=1,
                snippet="from celery import Celery\napp = Celery('analytics')",
                description="Celery analytics background task",
                detectionMethod="Source File Enclosure",
                folderModule="services/analytics"
            ),
            associatedFiles=["services/analytics/tasks.py"],
            metadata={"runtime": "Python 3.11", "queue": "analytics_events"}
        ),
        ArchitectureEntity(
            id="postgres-primary",
            name="PostgreSQL Primary Cluster",
            type="Database",
            technology="PostgreSQL 16",
            source="Detected",
            description="Main transactional relational datastore without active automated failover.",
            sourceEvidence=SourceEvidence(
                file="docker-compose.yml",
                line=15,
                snippet="postgres-primary:\n  image: postgres:16-alpine",
                description="Primary transactional relational database",
                detectionMethod="Docker Compose Declaration",
                folderModule="root"
            ),
            associatedFiles=["docker-compose.yml"],
            metadata={"port": 5432, "dbType": "Relational SQL", "filePath": "docker-compose.yml"}
        ),
        ArchitectureEntity(
            id="redis-cluster",
            name="Redis Cache & Session Broker",
            type="Database",
            technology="Redis 7.2",
            source="Detected",
            description="Shared in-memory caching, rate-limiting tokens, and pub/sub message broker.",
            sourceEvidence=SourceEvidence(
                file="docker-compose.yml",
                line=25,
                snippet="redis-cluster:\n  image: redis:7.2-alpine",
                description="Key-value cache and pub-sub broker",
                detectionMethod="Docker Compose Declaration",
                folderModule="root"
            ),
            associatedFiles=["docker-compose.yml"],
            metadata={"port": 6379, "dbType": "Key-Value / Cache"}
        ),
        ArchitectureEntity(
            id="stripe-gateway",
            name="Stripe Payment Gateway",
            type="External System",
            technology="Stripe REST API v1",
            source="User-provided",
            description="External PCI-compliant credit card processing endpoint.",
            sourceEvidence=SourceEvidence(
                file="services/payment/requirements.txt",
                line=2,
                snippet="stripe>=5.0.0",
                description="External payment settlement gateway",
                detectionMethod="Manifest Dependency",
                folderModule="services/payment"
            ),
            associatedFiles=["services/payment/requirements.txt"],
            metadata={"protocol": "HTTPS / TLS 1.3", "provider": "Stripe Inc."}
        )
    ],
    relationships=[
        ArchitectureRelationship(
            id="rel-web-gw",
            source="web-client",
            target="api-gateway",
            type="CALLS",
            protocol="HTTPS / REST",
            description="Web client routes customer queries through edge gateway."
        ),
        ArchitectureRelationship(
            id="rel-mob-gw",
            source="mobile-app",
            target="api-gateway",
            type="CALLS",
            protocol="HTTPS / REST",
            description="Mobile client dispatches actions to edge gateway."
        ),
        ArchitectureRelationship(
            id="rel-gw-auth",
            source="api-gateway",
            target="auth-service",
            type="CALLS",
            protocol="gRPC / Internal",
            description="Gateway verifies JWT bearer signatures with Auth Service."
        ),
        ArchitectureRelationship(
            id="rel-gw-user",
            source="api-gateway",
            target="user-service",
            type="CALLS",
            protocol="HTTPS / REST",
            description="Gateway forwards profile mutations to User Service."
        ),
        ArchitectureRelationship(
            id="rel-gw-order",
            source="api-gateway",
            target="order-service",
            type="CALLS",
            protocol="HTTPS / REST",
            description="Gateway routes cart checkouts to Order Orchestrator."
        ),
        ArchitectureRelationship(
            id="rel-auth-redis",
            source="auth-service",
            target="redis-cluster",
            type="USES",
            protocol="Redis Protocol",
            description="Auth Service caches session tokens and revoke lists in Redis."
        ),
        ArchitectureRelationship(
            id="rel-auth-pg",
            source="auth-service",
            target="postgres-primary",
            type="USES",
            protocol="PostgreSQL TCP",
            description="Auth Service queries user credentials and RBAC scopes."
        ),
        ArchitectureRelationship(
            id="rel-user-pg",
            source="user-service",
            target="postgres-primary",
            type="USES",
            protocol="PostgreSQL TCP",
            description="User Service performs CRUD operations against PostgreSQL."
        ),
        ArchitectureRelationship(
            id="rel-user-redis",
            source="user-service",
            target="redis-cluster",
            type="USES",
            protocol="Redis RESP",
            description="User Service caches customer profiles and sessions in Redis."
        ),
        ArchitectureRelationship(
            id="rel-order-payment",
            source="order-service",
            target="payment-service",
            type="CALLS",
            protocol="HTTPS / REST",
            description="Order Service triggers credit authorization in Payment Service."
        ),
        ArchitectureRelationship(
            id="rel-order-inventory",
            source="order-service",
            target="inventory-service",
            type="CALLS",
            protocol="gRPC",
            description="Order Service places locks on inventory stock."
        ),
        ArchitectureRelationship(
            id="rel-order-notif",
            source="order-service",
            target="notification-service",
            type="CALLS",
            protocol="AMQP / RabbitMQ",
            description="Order Service enqueues customer order receipt emails."
        ),
        ArchitectureRelationship(
            id="rel-order-pg",
            source="order-service",
            target="postgres-primary",
            type="USES",
            protocol="PostgreSQL TCP",
            description="Order Service writes transactional order states to PostgreSQL."
        ),
        ArchitectureRelationship(
            id="rel-pay-stripe",
            source="payment-service",
            target="stripe-gateway",
            type="CALLS",
            protocol="HTTPS / TLS 1.3",
            description="Payment Service executes credit card charges via Stripe API."
        ),
        ArchitectureRelationship(
            id="rel-pay-pg",
            source="payment-service",
            target="postgres-primary",
            type="USES",
            protocol="PostgreSQL TCP",
            description="Payment Service writes transaction audit records to PostgreSQL."
        ),
        ArchitectureRelationship(
            id="rel-inv-pg",
            source="inventory-service",
            target="postgres-primary",
            type="USES",
            protocol="PostgreSQL TCP",
            description="Inventory Service updates SKU inventory levels in PostgreSQL."
        ),
        ArchitectureRelationship(
            id="rel-notif-analytics",
            source="notification-service",
            target="analytics-worker",
            type="CALLS",
            protocol="AMQP / Message",
            description="Notification Service pushes delivery receipts to Analytics Worker."
        ),
        ArchitectureRelationship(
            id="rel-analytics-notif",
            source="analytics-worker",
            target="notification-service",
            type="CALLS",
            protocol="HTTP / Webhook",
            description="Analytics Worker calls Notification Service on anomaly alerts (Circular Loop)."
        ),
        ArchitectureRelationship(
            id="rel-analytics-pg",
            source="analytics-worker",
            target="postgres-primary",
            type="USES",
            protocol="PostgreSQL TCP",
            description="Analytics Worker queries historical baseline metrics from PostgreSQL."
        ),
        ArchitectureRelationship(
            id="rel-notif-redis",
            source="notification-service",
            target="redis-cluster",
            type="USES",
            protocol="Redis Pub/Sub",
            description="Notification Service coordinates worker task queues on Redis."
        )
    ],
    stats=ArchitectureStats(
        services=8,
        apis=0,
        databases=2,
        modules=1,
        libraries=0,
        externalSystems=1,
        totalEntities=13,
        totalRelationships=20,
        detectedCount=12,
        userProvidedCount=1
    ),
    inventory=DEMO_INVENTORY,
    codebaseGraph=DEMO_CODEBASE_GRAPH,
    isLimitedArchitecture=False,
    limitedArchitectureReason=None
)
