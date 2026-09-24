import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { analyzeCodebaseZip } from './src/engine/codebaseAnalyzer';

interface RepoEvaluation {
  repoName: string;
  filesCount: number;
  detectedEntities: number;
  expectedEntities: number;
  tpEntities: number;
  fpEntities: number;
  fnEntities: number;
  entityPrecision: number;
  entityRecall: number;
  entityF1: number;
  detectedEdges: number;
  expectedEdges: number;
  tpEdges: number;
  fpEdges: number;
  fnEdges: number;
  edgePrecision: number;
  edgeRecall: number;
  edgeF1: number;
  totalEvidenceEvaluated: number;
  validEvidenceRecords: number;
  evidenceValidityPct: number;
  falsePositives: string[];
  falseNegatives: string[];
}

// Canonical ground truth per repository based on source inspection
const GROUND_TRUTH: Record<string, {
  expectedEntities: string[];
  expectedEdges: Array<{ source: string; target: string; type?: string }>;
}> = {
  'CurdJavaDemo.zip': {
    expectedEntities: [
      'studentservice', 'studentrepo', 'mysql-database-student', 'studentcontroller',
      'api-post--api-student-create', 'api-get--api-student-get', 'api-get--api-student-getall',
      'api-delete--api-student-delete--id', 'api-delete--api-student-deleteall',
      'api-put--api-student-update--id', 'api-patch--api-student-soft-delete--id'
    ],
    expectedEdges: [
      { source: 'studentcontroller', target: 'studentservice', type: 'CALLS' },
      { source: 'studentservice', target: 'studentrepo', type: 'USES' },
      { source: 'studentrepo', target: 'mysql-database-student', type: 'QUERIES' },
      { source: 'studentcontroller', target: 'api-post--api-student-create', type: 'EXPOSES' },
      { source: 'studentcontroller', target: 'api-get--api-student-get', type: 'EXPOSES' },
      { source: 'studentcontroller', target: 'api-get--api-student-getall', type: 'EXPOSES' },
      { source: 'studentcontroller', target: 'api-delete--api-student-delete--id', type: 'EXPOSES' },
      { source: 'studentcontroller', target: 'api-delete--api-student-deleteall', type: 'EXPOSES' },
      { source: 'studentcontroller', target: 'api-put--api-student-update--id', type: 'EXPOSES' },
      { source: 'studentcontroller', target: 'api-patch--api-student-soft-delete--id', type: 'EXPOSES' },
    ]
  },
  'AI-Customer-Feedback-Analyzer-main.zip': {
    expectedEntities: [
      'streamlit-app', 'google-gemini-api', 'primary-dataset', 'python-service'
    ],
    expectedEdges: [
      { source: 'streamlit-app', target: 'google-gemini-api', type: 'CALLS' },
      { source: 'streamlit-app', target: 'primary-dataset', type: 'QUERIES' },
    ]
  },
  'RAG-Research-Assistant-main.zip': {
    expectedEntities: [
      'streamlit-app', 'google-gemini-api', 'faiss-vector-store', 'python-service'
    ],
    expectedEdges: [
      { source: 'streamlit-app', target: 'google-gemini-api', type: 'CALLS' },
      { source: 'streamlit-app', target: 'faiss-vector-store', type: 'QUERIES' },
    ]
  },
  'Test2-main.zip': {
    expectedEntities: [
      'frontend', 'backend-api', 'multi-agent-orchestrator', 'rag-service',
      'flight_agent', 'hotel_agent', 'research_agent', 'weather_agent', 'itinerary_agent',
      'flight-api-service', 'hotel-api-service', 'tavily-api', 'openweather-api',
      'api-get--health', 'api-post--plan', 'api-post--chat-init', 'api-post--chat-query',
      'python-service'
    ],
    expectedEdges: [
      { source: 'frontend', target: 'backend-api', type: 'CALLS' },
      { source: 'backend-api', target: 'multi-agent-orchestrator', type: 'USES' },
      { source: 'backend-api', target: 'rag-service', type: 'USES' },
      { source: 'backend-api', target: 'api-get--health', type: 'EXPOSES' },
      { source: 'backend-api', target: 'api-post--plan', type: 'EXPOSES' },
      { source: 'backend-api', target: 'api-post--chat-init', type: 'EXPOSES' },
      { source: 'backend-api', target: 'api-post--chat-query', type: 'EXPOSES' },
      { source: 'multi-agent-orchestrator', target: 'flight_agent', type: 'CALLS' },
      { source: 'multi-agent-orchestrator', target: 'hotel_agent', type: 'CALLS' },
      { source: 'multi-agent-orchestrator', target: 'research_agent', type: 'CALLS' },
      { source: 'multi-agent-orchestrator', target: 'weather_agent', type: 'CALLS' },
      { source: 'multi-agent-orchestrator', target: 'itinerary_agent', type: 'CALLS' },
      { source: 'flight_agent', target: 'flight-api-service', type: 'CALLS' },
      { source: 'hotel_agent', target: 'hotel-api-service', type: 'CALLS' },
      { source: 'research_agent', target: 'tavily-api', type: 'CALLS' },
      { source: 'weather_agent', target: 'openweather-api', type: 'CALLS' },
    ]
  },
  'startupsense-main.zip': {
    expectedEntities: [
      'react-example', 'server', 'google-gemini-api', 'github-api',
      'api-get--api-health', 'api-get--api-reports', 'api-get--api-reports--id',
      'api-post--api-reports', 'api-delete--api-reports--id', 'api-post--api-validate',
      'api-post--api-validate-start', 'api-get--api-validate-stream', 'api-post--api-chat-copilot'
    ],
    expectedEdges: [
      { source: 'react-example', target: 'google-gemini-api', type: 'CALLS' },
      { source: 'server', target: 'google-gemini-api', type: 'CALLS' },
      { source: 'server', target: 'github-api', type: 'CALLS' },
      { source: 'server', target: 'api-get--api-health', type: 'EXPOSES' },
      { source: 'server', target: 'api-get--api-reports', type: 'EXPOSES' },
      { source: 'server', target: 'api-get--api-reports--id', type: 'EXPOSES' },
      { source: 'server', target: 'api-post--api-reports', type: 'EXPOSES' },
      { source: 'server', target: 'api-delete--api-reports--id', type: 'EXPOSES' },
      { source: 'server', target: 'api-post--api-validate', type: 'EXPOSES' },
      { source: 'server', target: 'api-post--api-validate-start', type: 'EXPOSES' },
      { source: 'server', target: 'api-get--api-validate-stream', type: 'EXPOSES' },
      { source: 'server', target: 'api-post--api-chat-copilot', type: 'EXPOSES' },
    ]
  },
  'nodejs_microservice-master.zip': {
    expectedEntities: [
      'customer', 'products', 'shopping', 'rabbitmq', 'nosql-db', 'nginx-proxy', 'gateway',
      'api-post--signup', 'api-post--login', 'api-post--address', 'api-get--profile',
      'api-get--shoping-details', 'api-get--wishlist', 'api-get--whoami', 'api-post--product-create',
      'api-get--category--type', 'api-get---id', 'api-post--ids', 'api-put--wishlist',
      'api-delete--wishlist--id', 'api-put--cart', 'api-delete--cart--id', 'api-get',
      'api-post--order', 'api-get--orders'
    ],
    expectedEdges: [
      { source: 'customer', target: 'rabbitmq', type: 'CONNECTS_TO' },
      { source: 'customer', target: 'nosql-db', type: 'QUERIES' },
      { source: 'products', target: 'rabbitmq', type: 'CONNECTS_TO' },
      { source: 'products', target: 'nosql-db', type: 'QUERIES' },
      { source: 'shopping', target: 'rabbitmq', type: 'CONNECTS_TO' },
      { source: 'shopping', target: 'nosql-db', type: 'QUERIES' },
      { source: 'nginx-proxy', target: 'customer', type: 'DEPENDS_ON' },
      { source: 'nginx-proxy', target: 'products', type: 'DEPENDS_ON' },
      { source: 'nginx-proxy', target: 'shopping', type: 'DEPENDS_ON' },
      { source: 'gateway', target: 'customer', type: 'CALLS' },
      { source: 'products', target: 'customer', type: 'CALLS' },
      { source: 'products', target: 'shopping', type: 'CALLS' },
    ]
  },
  'microservices-demo-main.zip': {
    expectedEntities: [
      'adservice', 'checkoutservice', 'currencyservice', 'emailservice', 'frontend',
      'loadgenerator', 'paymentservice', 'productcatalogservice', 'recommendationservice',
      'shippingservice', 'shoppingassistantservice', 'postgres-db', 'cartservice',
      'redis-cart', 'google-gemini-api'
    ],
    expectedEdges: [
      { source: 'checkoutservice', target: 'productcatalogservice', type: 'CALLS' },
      { source: 'checkoutservice', target: 'shippingservice', type: 'CALLS' },
      { source: 'checkoutservice', target: 'paymentservice', type: 'CALLS' },
      { source: 'checkoutservice', target: 'emailservice', type: 'CALLS' },
      { source: 'checkoutservice', target: 'currencyservice', type: 'CALLS' },
      { source: 'checkoutservice', target: 'cartservice', type: 'CALLS' },
      { source: 'frontend', target: 'productcatalogservice', type: 'CALLS' },
      { source: 'frontend', target: 'currencyservice', type: 'CALLS' },
      { source: 'frontend', target: 'cartservice', type: 'CALLS' },
      { source: 'frontend', target: 'recommendationservice', type: 'CALLS' },
      { source: 'frontend', target: 'shippingservice', type: 'CALLS' },
      { source: 'frontend', target: 'checkoutservice', type: 'CALLS' },
      { source: 'frontend', target: 'adservice', type: 'CALLS' },
      { source: 'frontend', target: 'shoppingassistantservice', type: 'CALLS' },
      { source: 'loadgenerator', target: 'frontend', type: 'CALLS' },
      { source: 'recommendationservice', target: 'productcatalogservice', type: 'CALLS' },
      { source: 'emailservice', target: 'productcatalogservice', type: 'CALLS' },
      { source: 'cartservice', target: 'redis-cart', type: 'USES' },
      { source: 'shoppingassistantservice', target: 'postgres-db', type: 'USES' },
      { source: 'shoppingassistantservice', target: 'google-gemini-api', type: 'CALLS' }
    ]
  },
  'phishing-ai-extention-main (1).zip': {
    expectedEntities: [
      'chrome-extension', 'phishing-website-detection-using-xgboost-and-rfm',
      'ml-model-artifacts', 'mod-urlfeatureextraction', 'api--predict',
      'primary-dataset', 'python-service', 'flutter-mobile-app'
    ],
    expectedEdges: [
      { source: 'chrome-extension', target: 'phishing-website-detection-using-xgboost-and-rfm', type: 'CALLS' },
      { source: 'phishing-website-detection-using-xgboost-and-rfm', target: 'ml-model-artifacts', type: 'LOADS' },
      { source: 'phishing-website-detection-using-xgboost-and-rfm', target: 'api--predict', type: 'EXPOSES' },
      { source: 'phishing-website-detection-using-xgboost-and-rfm', target: 'mod-urlfeatureextraction', type: 'USES' },
      { source: 'phishing-website-detection-using-xgboost-and-rfm', target: 'primary-dataset', type: 'QUERIES' }
    ]
  },
  'agent-skills-main.zip': {
    expectedEntities: ['ci-fixture', 'split-payment'],
    expectedEdges: []
  },
  'claude-code-main.zip': {
    expectedEntities: ['hooks', 'mod-gitutil', 'ml-model-artifacts', 'github-api'],
    expectedEdges: [
      { source: 'backend-api', target: 'mod-gitutil', type: 'USES' },
      { source: 'backend-api', target: 'ml-model-artifacts', type: 'LOADS' },
      { source: 'backend-api', target: 'github-api', type: 'CALLS' }
    ]
  }
};

async function evaluate() {
  const dir = 'testing files';
  const archives = [
    'CurdJavaDemo.zip',
    'AI-Customer-Feedback-Analyzer-main.zip',
    'RAG-Research-Assistant-main.zip',
    'Test2-main.zip',
    'startupsense-main.zip',
    'nodejs_microservice-master.zip',
    'microservices-demo-main.zip',
    'phishing-ai-extention-main (1).zip',
    'agent-skills-main.zip',
    'claude-code-main.zip'
  ];

  const results: RepoEvaluation[] = [];

  for (const name of archives) {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }
    const buf = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buf);
    const filesCount = Object.keys(zip.files).filter(k => !zip.files[k].dir).length;

    const analysis = await analyzeCodebaseZip(buf as any);

    const gt = GROUND_TRUTH[name] || { expectedEntities: [], expectedEdges: [] };
    const detectedEntityIds = new Set(analysis.entities.map(e => e.id));
    const expectedEntityIds = new Set(gt.expectedEntities);

    // Entity TP, FP, FN
    let tpEntities = 0;
    const fpEntitiesList: string[] = [];
    for (const dId of detectedEntityIds) {
      if (expectedEntityIds.has(dId)) {
        tpEntities++;
      } else {
        fpEntitiesList.push(dId);
      }
    }
    const fnEntitiesList: string[] = [];
    for (const eId of expectedEntityIds) {
      if (!detectedEntityIds.has(eId)) {
        fnEntitiesList.push(eId);
      }
    }

    const entityPrecision = tpEntities + fpEntitiesList.length > 0
      ? tpEntities / (tpEntities + fpEntitiesList.length)
      : 1.0;
    const entityRecall = tpEntities + fnEntitiesList.length > 0
      ? tpEntities / (tpEntities + fnEntitiesList.length)
      : 1.0;
    const entityF1 = entityPrecision + entityRecall > 0
      ? (2 * entityPrecision * entityRecall) / (entityPrecision + entityRecall)
      : 0.0;

    // Edges evaluation
    const detectedEdges = analysis.relationships;
    let tpEdges = 0;
    const fpEdgesList: string[] = [];
    const matchedGtEdgeIndices = new Set<number>();

    for (const dEdge of detectedEdges) {
      const matchIdx = gt.expectedEdges.findIndex((e, idx) =>
        !matchedGtEdgeIndices.has(idx) &&
        e.source === dEdge.source &&
        e.target === dEdge.target
      );
      if (matchIdx !== -1) {
        tpEdges++;
        matchedGtEdgeIndices.add(matchIdx);
      } else {
        fpEdgesList.push(`${dEdge.source} -${dEdge.type}-> ${dEdge.target}`);
      }
    }

    const fnEdgesList: string[] = [];
    gt.expectedEdges.forEach((e, idx) => {
      if (!matchedGtEdgeIndices.has(idx)) {
        fnEdgesList.push(`${e.source} -${e.type || 'CALLS'}-> ${e.target}`);
      }
    });

    const edgePrecision = tpEdges + fpEdgesList.length > 0
      ? tpEdges / (tpEdges + fpEdgesList.length)
      : 1.0;
    const edgeRecall = tpEdges + fnEdgesList.length > 0
      ? tpEdges / (tpEdges + fnEdgesList.length)
      : 1.0;
    const edgeF1 = edgePrecision + edgeRecall > 0
      ? (2 * edgePrecision * edgeRecall) / (edgePrecision + edgeRecall)
      : 0.0;

    // Evidence Validity: verify file exists in zip, line is positive, snippet non-empty
    let totalEvidenceEvaluated = detectedEdges.length;
    let validEvidenceRecords = 0;

    for (const rel of detectedEdges) {
      const ev = rel.sourceEvidence;
      if (!ev) continue;
      // Check if file exists in zip (accounting for path normalization)
      const normEvFile = ev.file.replace(/\\/g, '/').replace(/^\//, '');
      const fileInZip = Object.keys(zip.files).some(zf =>
        zf === normEvFile || zf.endsWith('/' + normEvFile) || normEvFile.endsWith(zf)
      );

      const hasValidLine = ev.lineRange || (ev.line && ev.line > 0) || ev.file.includes('package.json') || ev.file.includes('requirements.txt') || ev.file.includes('pom.xml');
      const hasValidSnippet = ev.snippet && ev.snippet.length > 0;
      const hasValidMethod = ev.method && ev.method.length > 0;

      if (fileInZip && hasValidSnippet && hasValidMethod && hasValidLine) {
        validEvidenceRecords++;
      }
    }

    const evidenceValidityPct = totalEvidenceEvaluated > 0
      ? (validEvidenceRecords / totalEvidenceEvaluated) * 100
      : 100.0;

    results.push({
      repoName: name,
      filesCount,
      detectedEntities: analysis.entities.length,
      expectedEntities: gt.expectedEntities.length,
      tpEntities,
      fpEntities: fpEntitiesList.length,
      fnEntities: fnEntitiesList.length,
      entityPrecision,
      entityRecall,
      entityF1,
      detectedEdges: detectedEdges.length,
      expectedEdges: gt.expectedEdges.length,
      tpEdges,
      fpEdges: fpEdgesList.length,
      fnEdges: fnEdgesList.length,
      edgePrecision,
      edgeRecall,
      edgeF1,
      totalEvidenceEvaluated,
      validEvidenceRecords,
      evidenceValidityPct,
      falsePositives: fpEdgesList,
      falseNegatives: fnEdgesList
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

evaluate().catch(console.error);
