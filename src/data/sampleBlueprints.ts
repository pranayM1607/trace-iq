import type { BlueprintJSON } from '../types/architecture';

export interface SampleBlueprintItem {
  id: string;
  name: string;
  category: string;
  description: string;
  blueprint: BlueprintJSON;
}

export const SAMPLE_BLUEPRINTS: SampleBlueprintItem[] = [
  {
    id: 'ecommerce-microservices',
    name: 'E-Commerce Cloud Architecture',
    category: 'Microservices',
    description: '10 services, 2 datastores, and 2 external integrations for scalable online retail.',
    blueprint: {
      systemName: 'RetailStore Microservices Platform',
      version: '1.2.0',
      entities: [
        { id: 'web-frontend', name: 'Web Storefront', type: 'Service', technology: 'React / Next.js', description: 'Customer shopping portal' },
        { id: 'api-gateway', name: 'Edge Gateway', type: 'Service', technology: 'Kong Gateway', description: 'Central routing and auth' },
        { id: 'auth-service', name: 'Identity Service', type: 'Service', technology: 'Node.js / OAuth2', description: 'User login & sessions' },
        { id: 'product-catalog', name: 'Product Catalog', type: 'Service', technology: 'Go / Fiber', description: 'Search & product queries' },
        { id: 'order-service', name: 'Order Service', type: 'Service', technology: 'Java / Spring Boot', description: 'Checkout & order state machine' },
        { id: 'payment-service', name: 'Payment Service', type: 'Service', technology: 'Python / FastAPI', description: 'Payment processing & ledger' },
        { id: 'postgres-db', name: 'PostgreSQL DB', type: 'Database', technology: 'PostgreSQL 15', description: 'Relational storage' },
        { id: 'redis-cache', name: 'Redis Cache', type: 'Database', technology: 'Redis 7', description: 'Fast session & catalog cache' },
        { id: 'stripe-api', name: 'Stripe Gateway', type: 'External System', technology: 'Stripe REST API', description: 'Card processing' },
      ],
      relationships: [
        { source: 'web-frontend', target: 'api-gateway', type: 'CALLS', protocol: 'HTTPS / REST' },
        { source: 'api-gateway', target: 'auth-service', type: 'CALLS', protocol: 'HTTP / JSON' },
        { source: 'api-gateway', target: 'product-catalog', type: 'CALLS', protocol: 'HTTP / JSON' },
        { source: 'api-gateway', target: 'order-service', type: 'CALLS', protocol: 'HTTP / JSON' },
        { source: 'order-service', target: 'payment-service', type: 'CALLS', protocol: 'HTTP / REST' },
        { source: 'payment-service', target: 'stripe-api', type: 'CALLS', protocol: 'HTTPS / REST' },
        { source: 'order-service', target: 'postgres-db', type: 'USES', protocol: 'JDBC' },
        { source: 'product-catalog', target: 'redis-cache', type: 'USES', protocol: 'Redis TCP' },
        { source: 'auth-service', target: 'postgres-db', type: 'USES', protocol: 'TypeORM' },
      ],
    },
  },
  {
    id: 'fintech-banking',
    name: 'FinTech Banking & Core Ledger',
    category: 'Financial Systems',
    description: 'High-security banking platform with double-entry ledger, KYC, and clearing network.',
    blueprint: {
      systemName: 'ApexCore Banking Engine',
      version: '3.1.0',
      entities: [
        { id: 'mobile-app', name: 'Banking Mobile App', type: 'Service', technology: 'React Native', description: 'iOS and Android client' },
        { id: 'gateway-waf', name: 'WAF & API Gateway', type: 'Service', technology: 'Envoy Proxy', description: 'DDoS mitigation & TLS' },
        { id: 'kyc-service', name: 'KYC & Compliance Service', type: 'Service', technology: 'Python / Flask', description: 'Identity and AML verification' },
        { id: 'accounts-service', name: 'Accounts Service', type: 'Service', technology: 'Java / Quarkus', description: 'Account lifecycle & balances' },
        { id: 'ledger-engine', name: 'Double-Entry Ledger Engine', type: 'Service', technology: 'Rust / Actix', description: 'Immutable transaction ledger' },
        { id: 'settlement-worker', name: 'ACH Settlement Worker', type: 'Service', technology: 'Go / worker', description: 'Batch clearing worker' },
        { id: 'ledger-db', name: 'CockroachDB Cluster', type: 'Database', technology: 'CockroachDB', description: 'Distributed transactional DB' },
        { id: 'audit-vault', name: 'Audit Vault Storage', type: 'Database', technology: 'Encrypted S3 Object Store', description: 'Immutable compliance archive' },
        { id: 'fednow-network', name: 'Federal Reserve Clearing', type: 'External System', technology: 'ISO 20022 Network', description: 'Real-time interbank clearing' },
      ],
      relationships: [
        { source: 'mobile-app', target: 'gateway-waf', type: 'CALLS', protocol: 'mTLS HTTPS' },
        { source: 'gateway-waf', target: 'kyc-service', type: 'CALLS', protocol: 'gRPC' },
        { source: 'gateway-waf', target: 'accounts-service', type: 'CALLS', protocol: 'gRPC' },
        { source: 'accounts-service', target: 'ledger-engine', type: 'CALLS', protocol: 'gRPC / protobuf' },
        { source: 'ledger-engine', target: 'ledger-db', type: 'USES', protocol: 'PostgreSQL Wire' },
        { source: 'ledger-engine', target: 'audit-vault', type: 'USES', protocol: 'S3 API' },
        { source: 'settlement-worker', target: 'ledger-engine', type: 'CALLS', protocol: 'gRPC' },
        { source: 'settlement-worker', target: 'fednow-network', type: 'CONNECTS_TO', protocol: 'ISO 20022 TCP' },
      ],
    },
  },
  {
    id: 'iot-telemetry',
    name: 'IoT Telemetry & Fleet Tracking',
    category: 'IoT & Telemetry',
    description: 'High-throughput sensor ingestion, real-time alerting, and time-series analytics.',
    blueprint: {
      systemName: 'FleetPulse IoT Platform',
      version: '1.0.0',
      entities: [
        { id: 'fleet-devices', name: 'Edge GPS Devices', type: 'External System', technology: 'Embedded C / Cellular', description: 'Vehicle telematics units' },
        { id: 'mqtt-broker', name: 'MQTT Broker (EMQX)', type: 'Service', technology: 'EMQX / Erlang', description: 'Millions of concurrent IoT sockets' },
        { id: 'ingestion-pipeline', name: 'Telemetry Ingestion Service', type: 'Service', technology: 'Go / Kafka Consumer', description: 'Normalizer & validator' },
        { id: 'geofence-service', name: 'Geofence & Alerting Engine', type: 'Service', technology: 'Node.js / TypeScript', description: 'Polygon intersection detector' },
        { id: 'fleet-dashboard', name: 'Operations Dashboard', type: 'Service', technology: 'React / Mapbox GL', description: 'Real-time fleet tracking map' },
        { id: 'timeseries-db', name: 'TimescaleDB', type: 'Database', technology: 'TimescaleDB / PostgreSQL', description: 'Time-series spatial telemetry' },
        { id: 'redis-geospatial', name: 'Redis Geospatial Index', type: 'Database', technology: 'Redis GEO', description: 'Real-time vehicle coordinates' },
      ],
      relationships: [
        { source: 'fleet-devices', target: 'mqtt-broker', type: 'CONNECTS_TO', protocol: 'MQTT over TLS' },
        { source: 'mqtt-broker', target: 'ingestion-pipeline', type: 'CALLS', protocol: 'Kafka Stream' },
        { source: 'ingestion-pipeline', target: 'redis-geospatial', type: 'USES', protocol: 'Redis GEOADD' },
        { source: 'ingestion-pipeline', target: 'timeseries-db', type: 'USES', protocol: 'PostgreSQL TCP' },
        { source: 'ingestion-pipeline', target: 'geofence-service', type: 'CALLS', protocol: 'gRPC' },
        { source: 'fleet-dashboard', target: 'redis-geospatial', type: 'USES', protocol: 'Redis GEORADIUS' },
        { source: 'fleet-dashboard', target: 'timeseries-db', type: 'USES', protocol: 'SQL Query' },
      ],
    },
  },
];
