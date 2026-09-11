import JSZip from 'jszip';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  RelationshipType,
  ValidationIssue,
} from '../types/architecture';

export interface CodebaseAnalysisResult {
  success: boolean;
  systemName: string;
  filesScanned: number;
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  issues: ValidationIssue[];
  manifestsFound: string[];
}

export interface FileRecord {
  path: string;
  content: string;
}

export async function analyzeCodebaseZip(zipFile: File | Blob): Promise<CodebaseAnalysisResult> {
  const zip = new JSZip();
  let zipContent: JSZip;

  try {
    zipContent = await zip.loadAsync(zipFile);
  } catch (err: any) {
    return {
      success: false,
      systemName: 'Unknown Codebase',
      filesScanned: 0,
      entities: [],
      relationships: [],
      issues: [
        {
          type: 'error',
          message: `Failed to read ZIP archive: ${err.message || 'Invalid or corrupted ZIP file'}`,
        },
      ],
      manifestsFound: [],
    };
  }

  const files: FileRecord[] = [];
  const entries = Object.keys(zipContent.files);

  for (const relativePath of entries) {
    const entry = zipContent.files[relativePath];
    if (entry.dir) continue;

    // Filter out binary / heavy assets
    const lower = relativePath.toLowerCase();
    const isCodeOrConfig =
      lower.endsWith('.json') ||
      lower.endsWith('.js') ||
      lower.endsWith('.ts') ||
      lower.endsWith('.jsx') ||
      lower.endsWith('.tsx') ||
      lower.endsWith('.py') ||
      lower.endsWith('.java') ||
      lower.endsWith('.go') ||
      lower.endsWith('.xml') ||
      lower.endsWith('.yml') ||
      lower.endsWith('.yaml') ||
      lower.endsWith('.toml') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.env') ||
      lower.endsWith('dockerfile');

    if (!isCodeOrConfig) continue;

    try {
      const text = await entry.async('string');
      files.push({ path: relativePath, content: text });
    } catch {
      // Ignore unreadable entries
    }
  }

  return analyzeCodebaseFiles(files);
}

export function analyzeCodebaseFiles(files: FileRecord[]): CodebaseAnalysisResult {
  const entities: ArchitectureEntity[] = [];
  const relationships: ArchitectureRelationship[] = [];
  const issues: ValidationIssue[] = [];
  const manifestsFound: string[] = [];

  const entityMap = new Map<string, ArchitectureEntity>();

  function registerEntity(entity: ArchitectureEntity) {
    if (!entityMap.has(entity.id)) {
      entityMap.set(entity.id, entity);
      entities.push(entity);
    } else {
      // Merge metadata
      const existing = entityMap.get(entity.id)!;
      existing.metadata = { ...existing.metadata, ...entity.metadata };
      if (entity.description && !existing.description) existing.description = entity.description;
    }
  }

  function registerRel(
    source: string,
    target: string,
    type: RelationshipType,
    protocol: string,
    evidenceFile: string,
    evidenceSnippet: string,
    evidenceLine?: number
  ) {
    if (source === target) return;
    const relId = `rel-${source}-${target}-${type}`;
    if (!relationships.some((r) => r.source === source && r.target === target && r.type === type)) {
      relationships.push({
        id: relId,
        source,
        target,
        type,
        protocol,
        sourceEvidence: {
          file: evidenceFile,
          line: evidenceLine,
          snippet: evidenceSnippet,
          description: `Detected from ${evidenceFile}`,
        },
        description: `${source} ${type} ${target} via ${protocol}`,
      });
    }
  }

  // 1. Scan Docker Compose / Orchestration
  for (const file of files) {
    const filename = file.path.toLowerCase();
    if (filename.endsWith('docker-compose.yml') || filename.endsWith('docker-compose.yaml')) {
      manifestsFound.push(file.path);
      parseDockerCompose(file, registerEntity, registerRel);
    }
  }

  // 2. Scan Manifest Files (package.json, requirements.txt, pom.xml, go.mod)
  for (const file of files) {
    const filename = file.path.toLowerCase();
    if (filename.endsWith('package.json')) {
      manifestsFound.push(file.path);
      parsePackageJson(file, registerEntity, registerRel);
    } else if (filename.endsWith('requirements.txt') || filename.endsWith('pyproject.toml')) {
      manifestsFound.push(file.path);
      parsePythonManifest(file, registerEntity, registerRel);
    } else if (filename.endsWith('pom.xml') || filename.endsWith('build.gradle')) {
      manifestsFound.push(file.path);
      parseJavaManifest(file, registerEntity, registerRel);
    } else if (filename.endsWith('go.mod')) {
      manifestsFound.push(file.path);
      parseGoMod(file, registerEntity, registerRel);
    }
  }

  // 3. Scan Source Code for APIs, HTTP Calls, and Database queries
  for (const file of files) {
    const filename = file.path.toLowerCase();
    if (
      filename.endsWith('.js') ||
      filename.endsWith('.ts') ||
      filename.endsWith('.jsx') ||
      filename.endsWith('.tsx') ||
      filename.endsWith('.py') ||
      filename.endsWith('.java') ||
      filename.endsWith('.go')
    ) {
      parseSourceCode(file, entityMap, registerEntity, registerRel);
    }
  }

  // Fallback: If nothing detected or minimal, synthesize discovered root service
  if (entities.length === 0 && files.length > 0) {
    const rootServiceId = 'app-core';
    registerEntity({
      id: rootServiceId,
      name: 'Application Core',
      type: 'Service',
      technology: 'Source Project',
      source: 'Detected',
      description: `Reconstructed primary application module (${files.length} source files detected)`,
      metadata: {
        filePath: files[0]?.path || 'root',
        filesScanned: files.length,
      },
    });
  }

  // Clean dangling relationships where entity wasn't created
  const validEntities = new Set(entities.map((e) => e.id));
  const validRelationships = relationships.filter((r) => {
    if (!validEntities.has(r.source) || !validEntities.has(r.target)) {
      issues.push({
        type: 'warning',
        message: `Pruned unresolvable relationship between "${r.source}" and "${r.target}".`,
      });
      return false;
    }
    return true;
  });

  return {
    success: entities.length > 0,
    systemName: entities[0]?.name ? `${entities[0].name} System` : 'Reconstructed Codebase',
    filesScanned: files.length,
    entities,
    relationships: validRelationships,
    issues,
    manifestsFound,
  };
}

// -------------------------------------------------------------
// Docker Compose Parser
// -------------------------------------------------------------
function parseDockerCompose(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  const lines = file.content.split('\n');
  let currentService = '';
  let inServices = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('services:')) {
      inServices = true;
      continue;
    }

    if (inServices) {
      const serviceMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):/);
      if (serviceMatch) {
        currentService = serviceMatch[1];
        const isDb = /postgres|mysql|mongo|redis|mariadb|cockroach|dynamodb/i.test(currentService);
        const entityType: EntityType = isDb ? 'Database' : 'Service';
        registerEntity({
          id: currentService,
          name: formatComponentName(currentService),
          type: entityType,
          technology: isDb ? currentService : 'Docker Container',
          source: 'Detected',
          description: `Containerized ${entityType.toLowerCase()} defined in ${file.path}`,
          metadata: { filePath: file.path },
        });
      }

      if (currentService) {
        // Look for depends_on
        const dependsMatch = line.match(/-(?: |\t)+([a-zA-Z0-9_-]+)/);
        if (dependsMatch && lines[i - 1]?.includes('depends_on:')) {
          const target = dependsMatch[1];
          registerRel(currentService, target, 'DEPENDS_ON', 'Docker Network', file.path, line.trim(), i + 1);
        }

        // Look for DB connections in env vars
        const envMatch = line.match(/(?:DATABASE_URL|POSTGRES_HOST|REDIS_HOST|DB_HOST):\s*([a-zA-Z0-9_-]+)/i);
        if (envMatch) {
          const target = envMatch[1];
          registerRel(currentService, target, 'USES', 'TCP/Socket', file.path, line.trim(), i + 1);
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Package.json Parser (Node / TypeScript)
// -------------------------------------------------------------
function parsePackageJson(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  try {
    const pkg = JSON.parse(file.content);
    const serviceName = pkg.name || extractServiceNameFromPath(file.path) || 'node-service';
    const serviceId = sanitizeId(serviceName);

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const hasExpress = !!deps['express'] || !!deps['@nestjs/core'] || !!deps['fastify'] || !!deps['koa'];
    const hasReact = !!deps['react'] || !!deps['vue'] || !!deps['@angular/core'] || !!deps['svelte'] || !!deps['next'];

    const tech = hasReact
      ? 'React / Web UI'
      : hasExpress
      ? 'Node.js / Express'
      : 'Node.js / JavaScript';

    registerEntity({
      id: serviceId,
      name: formatComponentName(serviceName),
      type: 'Service',
      technology: tech,
      source: 'Detected',
      description: pkg.description || `Node.js module defined in ${file.path}`,
      metadata: {
        filePath: file.path,
        version: pkg.version,
        packageManager: 'npm / yarn',
        scripts: Object.keys(pkg.scripts || {}),
      },
    });

    // Detect PostgreSQL
    if (deps['pg'] || deps['typeorm'] || deps['prisma'] || deps['sequelize']) {
      const dbId = 'postgres-db';
      registerEntity({
        id: dbId,
        name: 'PostgreSQL Database',
        type: 'Database',
        technology: 'PostgreSQL',
        source: 'Detected',
        description: 'Relational database client detected in dependencies',
        metadata: { filePath: file.path, dbType: 'SQL / Relational' },
      });
      registerRel(serviceId, dbId, 'USES', 'PostgreSQL Driver', file.path, `package.json dependencies`);
    }

    // Detect Redis
    if (deps['redis'] || deps['ioredis']) {
      const redisId = 'redis-cache';
      registerEntity({
        id: redisId,
        name: 'Redis Cache',
        type: 'Database',
        technology: 'Redis',
        source: 'Detected',
        description: 'In-memory key-value cache detected in dependencies',
        metadata: { filePath: file.path, dbType: 'In-Memory Cache' },
      });
      registerRel(serviceId, redisId, 'USES', 'Redis Protocol', file.path, `package.json dependencies`);
    }

    // Detect MongoDB
    if (deps['mongodb'] || deps['mongoose']) {
      const mongoId = 'mongodb-cluster';
      registerEntity({
        id: mongoId,
        name: 'MongoDB Cluster',
        type: 'Database',
        technology: 'MongoDB',
        source: 'Detected',
        description: 'Document database client detected in dependencies',
        metadata: { filePath: file.path, dbType: 'Document NoSQL' },
      });
      registerRel(serviceId, mongoId, 'USES', 'MongoDB Wire Protocol', file.path, `package.json dependencies`);
    }

    // Detect Stripe API
    if (deps['stripe']) {
      const stripeId = 'stripe-api';
      registerEntity({
        id: stripeId,
        name: 'Stripe Payment Gateway',
        type: 'External System',
        technology: 'Stripe REST API',
        source: 'Detected',
        description: 'Third-party payment processor',
        metadata: { filePath: file.path },
      });
      registerRel(serviceId, stripeId, 'CALLS', 'HTTPS / REST', file.path, `package.json: "stripe": "${deps['stripe']}"`);
    }

    // Detect AWS SDK
    if (deps['aws-sdk'] || deps['@aws-sdk/client-s3']) {
      const awsId = 'aws-cloud-services';
      registerEntity({
        id: awsId,
        name: 'AWS Cloud Services',
        type: 'External System',
        technology: 'AWS SDK',
        source: 'Detected',
        description: 'Cloud storage and cloud services integration',
        metadata: { filePath: file.path },
      });
      registerRel(serviceId, awsId, 'CALLS', 'AWS HTTPS API', file.path, `package.json: aws-sdk`);
    }

    // Detect SendGrid / Mail
    if (deps['@sendgrid/mail'] || deps['nodemailer']) {
      const mailId = 'email-service';
      registerEntity({
        id: mailId,
        name: 'Email Delivery Gateway',
        type: 'External System',
        technology: 'SendGrid / SMTP',
        source: 'Detected',
        description: 'External notification / transactional mailer',
        metadata: { filePath: file.path },
      });
      registerRel(serviceId, mailId, 'CALLS', 'REST / SMTP', file.path, `package.json: mail dependency`);
    }
  } catch (_err) {
    // Malformed package.json handled gracefully
  }
}

// -------------------------------------------------------------
// Python Manifest Parser
// -------------------------------------------------------------
function parsePythonManifest(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  const serviceName = extractServiceNameFromPath(file.path) || 'python-service';
  const serviceId = sanitizeId(serviceName);
  const content = file.content.toLowerCase();

  const isFastAPI = content.includes('fastapi');
  const isFlask = content.includes('flask');
  const isDjango = content.includes('django');

  const tech = isFastAPI
    ? 'Python / FastAPI'
    : isFlask
    ? 'Python / Flask'
    : isDjango
    ? 'Python / Django'
    : 'Python 3.x';

  registerEntity({
    id: serviceId,
    name: formatComponentName(serviceName),
    type: 'Service',
    technology: tech,
    source: 'Detected',
    description: `Python microservice detected in ${file.path}`,
    metadata: { filePath: file.path, language: 'Python' },
  });

  if (content.includes('psycopg2') || content.includes('asyncpg') || content.includes('sqlalchemy')) {
    const dbId = 'postgres-db';
    registerEntity({
      id: dbId,
      name: 'PostgreSQL Database',
      type: 'Database',
      technology: 'PostgreSQL',
      source: 'Detected',
      description: 'Relational database driver detected in Python requirements',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, dbId, 'USES', 'SQLAlchemy / asyncpg', file.path, 'requirements.txt dependencies');
  }

  if (content.includes('redis') || content.includes('celery')) {
    const redisId = 'redis-cache';
    registerEntity({
      id: redisId,
      name: 'Redis Cache & Message Broker',
      type: 'Database',
      technology: 'Redis / Celery',
      source: 'Detected',
      description: 'Cache and task queue broker detected in Python requirements',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, redisId, 'USES', 'Redis Protocol', file.path, 'requirements.txt dependencies');
  }

  if (content.includes('stripe')) {
    const stripeId = 'stripe-api';
    registerEntity({
      id: stripeId,
      name: 'Stripe Payment Gateway',
      type: 'External System',
      technology: 'Stripe REST API',
      source: 'Detected',
      description: 'Payment API integration',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, stripeId, 'CALLS', 'HTTPS / REST', file.path, 'requirements.txt: stripe');
  }
}

// -------------------------------------------------------------
// Java Manifest Parser (Maven / Gradle)
// -------------------------------------------------------------
function parseJavaManifest(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  const serviceName = extractServiceNameFromPath(file.path) || 'spring-boot-service';
  const serviceId = sanitizeId(serviceName);
  const content = file.content;

  const isSpringBoot = content.includes('spring-boot') || content.includes('org.springframework');

  registerEntity({
    id: serviceId,
    name: formatComponentName(serviceName),
    type: 'Service',
    technology: isSpringBoot ? 'Java / Spring Boot' : 'Java',
    source: 'Detected',
    description: `Java service discovered in ${file.path}`,
    metadata: { filePath: file.path, language: 'Java', buildTool: file.path.endsWith('.xml') ? 'Maven' : 'Gradle' },
  });

  if (content.includes('postgresql') || content.includes('spring-boot-starter-data-jpa')) {
    const dbId = 'postgres-db';
    registerEntity({
      id: dbId,
      name: 'PostgreSQL Database',
      type: 'Database',
      technology: 'PostgreSQL / Hibernate',
      source: 'Detected',
      description: 'Spring Data JPA / PostgreSQL driver in pom.xml',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, dbId, 'USES', 'JDBC / Hibernate', file.path, 'pom.xml dependencies');
  }

  if (content.includes('spring-cloud-starter-gateway') || content.includes('zuul')) {
    const apiGwId = 'api-gateway';
    registerEntity({
      id: apiGwId,
      name: 'API Gateway',
      type: 'Service',
      technology: 'Spring Cloud Gateway',
      source: 'Detected',
      description: 'Reverse proxy and routing gateway',
      metadata: { filePath: file.path },
    });
    registerRel(apiGwId, serviceId, 'CALLS', 'HTTP / REST', file.path, 'Gateway routing config');
  }
}

// -------------------------------------------------------------
// Go Mod Parser
// -------------------------------------------------------------
function parseGoMod(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  const serviceName = extractServiceNameFromPath(file.path) || 'go-microservice';
  const serviceId = sanitizeId(serviceName);
  const content = file.content;

  const hasGin = content.includes('gin-gonic/gin');
  const hasGrpc = content.includes('google.golang.org/grpc');

  registerEntity({
    id: serviceId,
    name: formatComponentName(serviceName),
    type: 'Service',
    technology: hasGrpc ? 'Go / gRPC' : hasGin ? 'Go / Gin' : 'Go',
    source: 'Detected',
    description: `Go microservice module detected in ${file.path}`,
    metadata: { filePath: file.path, language: 'Go' },
  });

  if (content.includes('go-redis') || content.includes('gomodule/redigo')) {
    const redisId = 'redis-cache';
    registerEntity({
      id: redisId,
      name: 'Redis Cache',
      type: 'Database',
      technology: 'Redis',
      source: 'Detected',
      description: 'Redis client library in go.mod',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, redisId, 'USES', 'Redis Go Driver', file.path, 'go.mod dependencies');
  }

  if (content.includes('gorm.io/driver/postgres') || content.includes('lib/pq')) {
    const dbId = 'postgres-db';
    registerEntity({
      id: dbId,
      name: 'PostgreSQL Database',
      type: 'Database',
      technology: 'PostgreSQL',
      source: 'Detected',
      description: 'GORM PostgreSQL driver in go.mod',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, dbId, 'USES', 'GORM / pgx', file.path, 'go.mod dependencies');
  }
}

// -------------------------------------------------------------
// Source Code Scanner (APIs, HTTP Cross-Calls, Modules)
// -------------------------------------------------------------
function parseSourceCode(
  file: FileRecord,
  entityMap: Map<string, ArchitectureEntity>,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  const lines = file.content.split('\n');
  const pathParts = file.path.split(/[\/\\]/);
  const currentServiceId = findEnclosingServiceId(file.path, entityMap) || 'application-core';

  // Make sure current service is registered
  if (!entityMap.has(currentServiceId)) {
    const fallbackName = formatComponentName(pathParts[0] || 'App Service');
    registerEntity({
      id: currentServiceId,
      name: fallbackName,
      type: 'Service',
      technology: detectTechFromFilename(file.path),
      source: 'Detected',
      description: `Discovered from codebase source files in /${pathParts[0] || ''}`,
      metadata: { filePath: file.path },
    });
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // 1. Detect API Endpoints
    const restMatch = trimmed.match(
      /(?:app|router)\.(get|post|put|delete|patch)\(['"`](\/api\/[a-zA-Z0-9_\-\/]+)['"`]/i
    ) || trimmed.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping)\(['"`](\/api\/[a-zA-Z0-9_\-\/]+)['"`]/i);

    if (restMatch) {
      const method = (restMatch[1] || 'GET').toUpperCase().replace('MAPPING', '');
      const endpoint = restMatch[2];
      const apiId = sanitizeId(`api-${method}-${endpoint}`);

      registerEntity({
        id: apiId,
        name: `${method} ${endpoint}`,
        type: 'API',
        technology: 'REST API Endpoint',
        source: 'Detected',
        description: `Exposed API endpoint in ${file.path}`,
        metadata: {
          filePath: file.path,
          method,
          endpoint,
          parentService: currentServiceId,
        },
      });

      registerRel(currentServiceId, apiId, 'USES', 'Internal Route', file.path, trimmed, lineNum);
    }

    // 2. Detect Cross-Service HTTP Client calls (axios, fetch, requests, RestTemplate)
    const httpCallMatch =
      trimmed.match(/(?:axios|fetch|http|requests)\.(?:get|post|put|delete)\(['"`](?:http:\/\/)?([a-zA-Z0-9_-]+)(?::\d+)?(\/[a-zA-Z0-9_\-\/]+)?['"`]/i) ||
      trimmed.match(/restTemplate\.(?:getForObject|postForObject)\(['"`](?:http:\/\/)?([a-zA-Z0-9_-]+)(?::\d+)?(\/[a-zA-Z0-9_\-\/]+)?['"`]/i);

    if (httpCallMatch) {
      const targetCandidate = sanitizeId(httpCallMatch[1]);
      if (
        targetCandidate &&
        !['localhost', '127', 'window', 'process', 'url', 'api', 'v1'].includes(targetCandidate)
      ) {
        // If target exists in entityMap or represents a service name
        if (targetCandidate !== currentServiceId) {
          if (!entityMap.has(targetCandidate)) {
            registerEntity({
              id: targetCandidate,
              name: formatComponentName(targetCandidate),
              type: 'Service',
              technology: 'HTTP Microservice',
              source: 'Detected',
              description: `Target service invoked via HTTP in ${file.path}`,
              metadata: { filePath: file.path },
            });
          }
          registerRel(currentServiceId, targetCandidate, 'CALLS', 'HTTP / JSON', file.path, trimmed, lineNum);
        }
      }
    }

    // 3. Detect Internal Modules / Libraries
    const importLibMatch = trimmed.match(
      /(?:import|require)\s*\(?['"](@?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)['"]/
    );
    if (importLibMatch) {
      const libName = importLibMatch[1];
      if (
        ['jsonwebtoken', 'bcrypt', 'crypto-js', 'pino', 'winston', 'joi', 'zod'].includes(libName)
      ) {
        const libId = sanitizeId(`lib-${libName}`);
        registerEntity({
          id: libId,
          name: libName,
          type: 'Library',
          technology: 'Utility Library',
          source: 'Detected',
          description: `Internal shared library utilized by ${currentServiceId}`,
          metadata: { filePath: file.path },
        });
        registerRel(currentServiceId, libId, 'DEPENDS_ON', 'Import / Link', file.path, trimmed, lineNum);
      }
    }
  });
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function sanitizeId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatComponentName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function extractServiceNameFromPath(filePath: string): string | null {
  const parts = filePath.split(/[\/\\]/);
  if (parts.length > 1) {
    const parent = parts[parts.length - 2];
    if (!['src', 'dist', 'build', 'node_modules', 'app', 'pkg'].includes(parent.toLowerCase())) {
      return parent;
    }
  }
  return null;
}

function findEnclosingServiceId(filePath: string, entityMap: Map<string, ArchitectureEntity>): string | null {
  const parts = filePath.split(/[\/\\]/);
  for (const part of parts) {
    const id = sanitizeId(part);
    if (entityMap.has(id)) {
      return id;
    }
  }
  if (parts.length > 0 && parts[0] !== 'src') {
    return sanitizeId(parts[0]);
  }
  return null;
}

function detectTechFromFilename(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'TypeScript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'JavaScript';
  if (lower.endsWith('.py')) return 'Python';
  if (lower.endsWith('.java')) return 'Java';
  if (lower.endsWith('.go')) return 'Go';
  return 'Polyglot';
}
