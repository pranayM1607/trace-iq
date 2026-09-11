import type { ArchitectureModel } from '../types/analysis';

export const FALLBACK_DEMO_ARCHITECTURE: ArchitectureModel = {
  systemName: "Cloud Enterprise Retail & Checkout Ecosystem",
  version: "2.5.0",
  extractedAt: "2026-09-07T10:00:00Z",
  inputType: "demo",
  sourceArtifacts: [
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
  entities: [
    {
      id: "web-client",
      name: "Web Storefront Client",
      type: "Service",
      technology: "React 18 / TypeScript",
      source: "Detected",
      description: "Single-page web application driving consumer cart and catalog browsing.",
      metadata: { port: 3000, framework: "Next.js", runtime: "Node 20" }
    },
    {
      id: "mobile-app",
      name: "Mobile Consumer App",
      type: "Service",
      technology: "React Native / iOS & Android",
      source: "Detected",
      description: "Native mobile retail client interacting via edge gateway.",
      metadata: { framework: "React Native", runtime: "Mobile Client" }
    },
    {
      id: "api-gateway",
      name: "Cloud API Gateway",
      type: "Service",
      technology: "Kong / Envoy Proxy",
      source: "Detected",
      description: "Edge reverse proxy handling JWT validation, throttling, and request routing.",
      metadata: { port: 8080, framework: "Envoy", runtime: "Linux Container" }
    },
    {
      id: "auth-service",
      name: "Authentication & Token Authority",
      type: "Service",
      technology: "Go / JWT",
      source: "Detected",
      description: "Identity verification, OAuth2 tokens, and security policy checks.",
      metadata: { port: 5001, framework: "Gin", runtime: "Go 1.22" }
    },
    {
      id: "user-service",
      name: "User Management Service",
      type: "Service",
      technology: "Node.js / NestJS",
      source: "Detected",
      description: "Customer profiles, preferences, and address book records.",
      metadata: { port: 5002, framework: "NestJS", runtime: "Node.js 20" }
    },
    {
      id: "order-service",
      name: "Order Orchestration Service",
      type: "Service",
      technology: "Java / Spring Boot",
      source: "Detected",
      description: "Checkout state machine orchestrating payment, stock, and confirmation.",
      metadata: { port: 8081, framework: "Spring Boot 3.2", runtime: "OpenJDK 21" }
    },
    {
      id: "payment-service",
      name: "Payment Processing Service",
      type: "Service",
      technology: "Python / FastAPI",
      source: "Detected",
      description: "Transaction ledger, card tokenization, and third-party gateway dispatch.",
      metadata: { port: 8000, framework: "FastAPI", runtime: "Python 3.11" }
    },
    {
      id: "inventory-service",
      name: "Inventory & Warehouse Service",
      type: "Service",
      technology: "Go / gRPC",
      source: "Detected",
      description: "Warehouse SKU reservation, allocation checks, and inventory status.",
      metadata: { port: 9090, framework: "gRPC", runtime: "Go 1.22" }
    },
    {
      id: "notification-service",
      name: "Notification Dispatcher",
      type: "Service",
      technology: "Node.js / RabbitMQ",
      source: "Detected",
      description: "Transactional email, push notifications, and customer alerts.",
      metadata: { port: 5005, framework: "AmqpLib", runtime: "Node.js 20" }
    },
    {
      id: "analytics-worker",
      name: "Event Stream Analytics Worker",
      type: "Module",
      technology: "Python / Celery",
      source: "Detected",
      description: "Background event aggregation worker computing live telemetry and metric alerts.",
      metadata: { runtime: "Python 3.11", queue: "analytics_events" }
    },
    {
      id: "postgres-primary",
      name: "PostgreSQL Primary Cluster",
      type: "Database",
      technology: "PostgreSQL 16",
      source: "Detected",
      description: "Main transactional relational datastore without active automated failover.",
      metadata: { port: 5432, dbType: "Relational SQL", filePath: "docker-compose.yml" }
    },
    {
      id: "redis-cluster",
      name: "Redis Cache & Session Broker",
      type: "Database",
      technology: "Redis 7.2",
      source: "Detected",
      description: "Shared in-memory caching, rate-limiting tokens, and pub/sub message broker.",
      metadata: { port: 6379, dbType: "Key-Value / Cache" }
    },
    {
      id: "stripe-gateway",
      name: "Stripe Payment Gateway",
      type: "External System",
      technology: "Stripe REST API v1",
      source: "User-provided",
      description: "External PCI-compliant credit card processing endpoint.",
      metadata: { protocol: "HTTPS / TLS 1.3", provider: "Stripe Inc." }
    }
  ],
  relationships: [
    { id: "rel-web-gw", source: "web-client", target: "api-gateway", type: "CALLS", protocol: "HTTPS / REST" },
    { id: "rel-mob-gw", source: "mobile-app", target: "api-gateway", type: "CALLS", protocol: "HTTPS / REST" },
    { id: "rel-gw-auth", source: "api-gateway", target: "auth-service", type: "CALLS", protocol: "gRPC / HTTP/2" },
    { id: "rel-gw-user", source: "api-gateway", target: "user-service", type: "CALLS", protocol: "HTTP / REST" },
    { id: "rel-gw-order", source: "api-gateway", target: "order-service", type: "CALLS", protocol: "HTTP / REST" },
    { id: "rel-auth-redis", source: "auth-service", target: "redis-cluster", type: "USES", protocol: "Redis RESP" },
    { id: "rel-auth-pg", source: "auth-service", target: "postgres-primary", type: "USES", protocol: "PostgreSQL TCP" },
    { id: "rel-user-pg", source: "user-service", target: "postgres-primary", type: "USES", protocol: "PostgreSQL TCP" },
    { id: "rel-user-redis", source: "user-service", target: "redis-cluster", type: "USES", protocol: "Redis RESP" },
    { id: "rel-order-payment", source: "order-service", target: "payment-service", type: "CALLS", protocol: "HTTP / REST" },
    { id: "rel-order-inv", source: "order-service", target: "inventory-service", type: "CALLS", protocol: "gRPC / HTTP/2" },
    { id: "rel-order-pg", source: "order-service", target: "postgres-primary", type: "USES", protocol: "PostgreSQL TCP" },
    { id: "rel-order-notif", source: "order-service", target: "notification-service", type: "CALLS", protocol: "AMQP / Event" },
    { id: "rel-pay-stripe", source: "payment-service", target: "stripe-gateway", type: "CALLS", protocol: "HTTPS / TLS 1.3" },
    { id: "rel-pay-pg", source: "payment-service", target: "postgres-primary", type: "USES", protocol: "PostgreSQL TCP" },
    { id: "rel-inv-pg", source: "inventory-service", target: "postgres-primary", type: "USES", protocol: "PostgreSQL TCP" },
    { id: "rel-notif-analytics", source: "notification-service", target: "analytics-worker", type: "CALLS", protocol: "AMQP / Message" },
    { id: "rel-analytics-notif", source: "analytics-worker", target: "notification-service", type: "CALLS", protocol: "HTTP / Webhook" },
    { id: "rel-analytics-pg", source: "analytics-worker", target: "postgres-primary", type: "USES", protocol: "PostgreSQL TCP" },
    { id: "rel-notif-redis", source: "notification-service", target: "redis-cluster", type: "USES", protocol: "Redis Pub/Sub" }
  ],
  stats: {
    services: 8,
    apis: 0,
    databases: 2,
    modules: 1,
    libraries: 0,
    externalSystems: 1,
    totalEntities: 13,
    totalRelationships: 20,
    detectedCount: 12,
    userProvidedCount: 1
  }
};
