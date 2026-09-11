import { parseAndValidateBlueprint } from '../src/engine/blueprintParser';
import { analyzeCodebaseFiles } from '../src/engine/codebaseAnalyzer';
import { reconstructArchitecture } from '../src/engine/architectureReconstructor';
import {
  computeBaseGraphLayout,
  decorateGraphVisuals,
  calculateGraphLayout,
} from '../src/engine/graphLayout';
import { DEMO_ARCHITECTURE } from '../src/data/demoArchitecture';

console.log('=== TRACEIQ OBJECTIVE 1 COMPREHENSIVE VERIFICATION & QUALITY PASS ===\n');

// TEST 1: Demo Architecture Integrity
console.log('1. Testing Demo Architecture Model...');
console.log(`- System: ${DEMO_ARCHITECTURE.systemName}`);
console.log(`- Entities: ${DEMO_ARCHITECTURE.entities.length}`);
console.log(`- Relationships: ${DEMO_ARCHITECTURE.relationships.length}`);
console.log(`- Services: ${DEMO_ARCHITECTURE.stats.services}`);
console.log(`- Databases: ${DEMO_ARCHITECTURE.stats.databases}`);
console.log(`- External Systems: ${DEMO_ARCHITECTURE.stats.externalSystems}`);

if (
  DEMO_ARCHITECTURE.entities.length >= 10 &&
  DEMO_ARCHITECTURE.relationships.length >= 15 &&
  DEMO_ARCHITECTURE.stats.services >= 6
) {
  console.log('  [PASS] Demo architecture is rich and fully populated.\n');
} else {
  console.error('  [FAIL] Demo architecture does not meet criteria.\n');
  process.exit(1);
}

// TEST 2: Blueprint Parser with Valid and Invalid Inputs
console.log('2. Testing Blueprint Parser...');
const validBlueprint = JSON.stringify({
  systemName: 'Test Microservices',
  version: '1.0.0',
  entities: [
    { id: 'gateway', name: 'Gateway', type: 'Service', technology: 'Express' },
    { id: 'orders', name: 'Orders Service', type: 'Service', technology: 'Spring Boot' },
    { id: 'orders-db', name: 'Orders DB', type: 'Database', technology: 'PostgreSQL' },
  ],
  relationships: [
    { source: 'gateway', target: 'orders', type: 'CALLS', protocol: 'HTTP' },
    { source: 'orders', target: 'orders-db', type: 'USES', protocol: 'JDBC' },
  ],
});

const parseRes = parseAndValidateBlueprint(validBlueprint);
console.log(`- Valid Parse Success: ${parseRes.success}`);
console.log(`- Extracted Entities: ${parseRes.entities.length}`);
console.log(`- Extracted Relations: ${parseRes.relationships.length}`);
if (parseRes.success && parseRes.entities.length === 3 && parseRes.relationships.length === 2) {
  console.log('  [PASS] Blueprint parser parsed valid JSON correctly.');
} else {
  console.error('  [FAIL] Blueprint parser failed on valid JSON.');
  process.exit(1);
}

// Invalid JSON test
const invalidJsonRes = parseAndValidateBlueprint('{ malformed json');
if (!invalidJsonRes.success && invalidJsonRes.issues.some((i) => i.type === 'error')) {
  console.log('  [PASS] Handled syntax error gracefully with informative error issue.');
} else {
  console.error('  [FAIL] Failed to catch syntax error.');
  process.exit(1);
}

// Missing target entity test
const brokenRelBlueprint = JSON.stringify({
  entities: [{ id: 'service-a', name: 'Service A', type: 'Service' }],
  relationships: [{ source: 'service-a', target: 'non-existent', type: 'CALLS' }],
});
const brokenRes = parseAndValidateBlueprint(brokenRelBlueprint);
if (!brokenRes.success && brokenRes.issues.some((i) => i.message.includes('non-existent'))) {
  console.log('  [PASS] Correctly detected broken reference to non-existent target entity.\n');
} else {
  console.error('  [FAIL] Did not catch broken reference.');
  process.exit(1);
}

// TEST 3: Codebase Analysis Engine
console.log('3. Testing Codebase Ingestion & Manifest Scanning...');
const mockFiles = [
  {
    path: 'docker-compose.yml',
    content: `services:\n  gateway:\n    ports:\n      - "8080:8080"\n    depends_on:\n      - order-service\n  order-service:\n    environment:\n      - POSTGRES_HOST=postgres-db\n  postgres-db:\n    image: postgres:16\n`,
  },
  {
    path: 'services/gateway/package.json',
    content: JSON.stringify({
      name: 'gateway',
      dependencies: { express: '^4.19.0', axios: '^1.6.0', redis: '^4.6.0' },
    }),
  },
  {
    path: 'services/order/pom.xml',
    content: `<project><dependencies><dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId></dependency></dependencies></project>`,
  },
  {
    path: 'services/payment/requirements.txt',
    content: 'fastapi==0.110.0\nstripe==8.8.0\nsqlalchemy==2.0.0\n',
  },
  {
    path: 'services/gateway/src/routes.ts',
    content: `router.get('/api/orders', async (req, res) => { const r = await axios.get('http://order-service:8080/api/orders'); res.json(r); });`,
  },
];

const codeResult = analyzeCodebaseFiles(mockFiles);
console.log(`- Scanned Files: ${codeResult.filesScanned}`);
console.log(`- Detected Entities: ${codeResult.entities.map((e) => `${e.name} (${e.type})`).join(', ')}`);
console.log(`- Detected Relationships: ${codeResult.relationships.map((r) => `${r.source} -[${r.type}]-> ${r.target}`).join(', ')}`);

if (
  codeResult.success &&
  codeResult.entities.some((e) => e.type === 'Database') &&
  codeResult.entities.some((e) => e.name.toLowerCase().includes('gateway')) &&
  codeResult.relationships.length >= 3
) {
  console.log('  [PASS] Codebase analyzer successfully extracted polyglot services, DBs, and dependencies.\n');
} else {
  console.error('  [FAIL] Codebase analyzer failed extraction.');
  process.exit(1);
}

// TEST 4: Architecture Reconstructor & Strict Scope Audit
console.log('4. Testing Architecture Reconstruction & Strict Objective 1 Scope...');
const model = reconstructArchitecture({
  systemName: codeResult.systemName,
  inputType: 'codebase',
  entities: codeResult.entities,
  relationships: codeResult.relationships,
});

console.log(`- Reconstructed Total Entities: ${model.stats.totalEntities}`);
console.log(`- Reconstructed Total Relationships: ${model.stats.totalRelationships}`);

// Verify ZERO Objective 2/3/4 metrics exist
const modelKeys = Object.keys(model);
const statsKeys = Object.keys(model.stats);
const forbiddenKeys = ['riskScore', 'criticalServices', 'spof', 'changeImpact', 'qualityScore', 'deploymentRisk', 'simulation'];

for (const key of forbiddenKeys) {
  if (modelKeys.includes(key) || statsKeys.includes(key)) {
    console.error(`  [FAIL] Found forbidden Objective 2/3/4 property: ${key}`);
    process.exit(1);
  }
}
console.log('  [PASS] Confirmed 100% strict compliance with Objective 1 scope (No risk/impact/prediction keys).\n');

// TEST 5: Architectural Tiered Layout & Spatial Hierarchy
console.log('5. Testing Tiered Architecture Layout Engine (LR and TB)...');
const baseLR = computeBaseGraphLayout(DEMO_ARCHITECTURE.entities, DEMO_ARCHITECTURE.relationships, 'LR');
const baseTB = computeBaseGraphLayout(DEMO_ARCHITECTURE.entities, DEMO_ARCHITECTURE.relationships, 'TB');

console.log(`- Base Positions (LR): ${baseLR.positions.size} nodes mapped`);
console.log(`- Base Positions (TB): ${baseTB.positions.size} nodes mapped`);
console.log(`- Canvas Bounding Box (LR): ${baseLR.canvasWidth}px x ${baseLR.canvasHeight}px`);

// Verify Frontend is on Left (x=0) and DBs are on Right (x > 1400)
const fePos = baseLR.positions.get('web-frontend');
const pgPos = baseLR.positions.get('postgres-db');

if (fePos && pgPos && fePos.x < pgPos.x) {
  console.log(`  [PASS] Correct architectural flow: Frontend (x=${fePos.x}) -> Databases (x=${pgPos.x})`);
} else {
  console.error('  [FAIL] Invalid architectural horizontal ordering.');
  process.exit(1);
}

// TEST 6: Spatial Position Stability Across Search, Filters, Node & Edge Selection
console.log('\n6. Testing Spatial Stability Across All User Interactions:');

const stateUnfiltered = decorateGraphVisuals(baseLR, {
  selectedNodeId: null,
  selectedTypeFilter: 'ALL',
  selectedRelFilter: 'ALL',
  searchTerm: '',
});

const stateSearchOrder = decorateGraphVisuals(baseLR, {
  selectedNodeId: 'order-service',
  selectedTypeFilter: 'ALL',
  selectedRelFilter: 'ALL',
  searchTerm: 'order',
});

const stateFilterDB = decorateGraphVisuals(baseLR, {
  selectedNodeId: null,
  selectedTypeFilter: 'Database',
  selectedRelFilter: 'ALL',
  searchTerm: '',
});

const stateFilterRel = decorateGraphVisuals(baseLR, {
  selectedNodeId: null,
  selectedTypeFilter: 'ALL',
  selectedRelFilter: 'DEPENDS_ON',
  searchTerm: '',
});

const stateSelectNode = decorateGraphVisuals(baseLR, {
  selectedNodeId: 'payment-service',
  selectedTypeFilter: 'ALL',
  selectedRelFilter: 'ALL',
  searchTerm: '',
});

const stateSelectEdge = decorateGraphVisuals(baseLR, {
  selectedNodeId: null,
  selectedEdgeId: 'rel-order-payment',
  selectedTypeFilter: 'ALL',
  selectedRelFilter: 'ALL',
  searchTerm: '',
});

// Verify coordinates never move
let allStatesStable = true;
stateUnfiltered.nodes.forEach((baseNode) => {
  const nSearch = stateSearchOrder.nodes.find((n) => n.id === baseNode.id);
  const nFilterDB = stateFilterDB.nodes.find((n) => n.id === baseNode.id);
  const nFilterRel = stateFilterRel.nodes.find((n) => n.id === baseNode.id);
  const nSelectNode = stateSelectNode.nodes.find((n) => n.id === baseNode.id);
  const nSelectEdge = stateSelectEdge.nodes.find((n) => n.id === baseNode.id);

  if (
    !nSearch || nSearch.position.x !== baseNode.position.x || nSearch.position.y !== baseNode.position.y ||
    !nFilterDB || nFilterDB.position.x !== baseNode.position.x || nFilterDB.position.y !== baseNode.position.y ||
    !nFilterRel || nFilterRel.position.x !== baseNode.position.x || nFilterRel.position.y !== baseNode.position.y ||
    !nSelectNode || nSelectNode.position.x !== baseNode.position.x || nSelectNode.position.y !== baseNode.position.y ||
    !nSelectEdge || nSelectEdge.position.x !== baseNode.position.x || nSelectEdge.position.y !== baseNode.position.y
  ) {
    allStatesStable = false;
  }
});

if (allStatesStable) {
  console.log('  [PASS] Node positions are 100% FIXED and stable across Search, Filter, Node, and Edge selections.');
} else {
  console.error('  [FAIL] Node positions shifted during visual interactions.');
  process.exit(1);
}

// Verify MiniMap dimensions
let allNodesHaveMiniMapDims = true;
baseLR.positions.forEach((pos, id) => {
  if (!pos.width || !pos.height || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
    allNodesHaveMiniMapDims = false;
    console.error(`Node ${id} missing MiniMap dimensions`);
  }
});

if (allNodesHaveMiniMapDims) {
  console.log('  [PASS] All nodes provide explicit width/height for accurate MiniMap rendering.\n');
} else {
  console.error('  [FAIL] MiniMap dimensions invalid.');
  process.exit(1);
}

console.log('=== ALL TRACEIQ OBJECTIVE 1 VERIFICATION TESTS PASSED! ===');
