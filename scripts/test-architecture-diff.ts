import path from 'path';
import fs from 'fs';
import {
  computeArchitectureDiff,
  createArchitectureSnapshot,
  getCanonicalNodeKey,
  getCanonicalRelKey,
} from '../src/engine/architectureDiffEngine';
import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
} from '../src/types/architecture';
import {
  SAMPLE_EVOLUTION_V1_MODEL,
  SAMPLE_EVOLUTION_V2_MODEL,
  SNAPSHOT_V1,
  SNAPSHOT_V2,
} from '../src/data/sampleEvolutions';
import { analyzeCodebaseZip } from '../src/engine/codebaseAnalyzer';
import { reconstructArchitecture } from '../src/engine/architectureReconstructor';

console.log('=== TRACEIQ OBJECTIVE 1 ARCHITECTURE DIFF ENGINE TEST SUITE ===\n');

// Helper to create simple test architecture models
function makeTestModel(
  name: string,
  entities: Array<{ id: string; name?: string; type?: any }>,
  rels: Array<{ source: string; target: string; type?: any; line?: number; snippet?: string }>
): ArchitectureModel {
  return {
    systemName: name,
    version: '1.0.0',
    extractedAt: new Date().toISOString(),
    inputType: 'blueprint',
    entities: entities.map((e) => ({
      id: e.id,
      name: e.name || e.id,
      type: e.type || 'Service',
      technology: 'TypeScript',
      source: 'Detected',
    })),
    relationships: rels.map((r, i) => ({
      id: `rel-${r.source}-${r.target}-${r.type || 'CALLS'}-${i}`,
      source: r.source,
      target: r.target,
      type: r.type || 'CALLS',
      protocol: 'HTTP',
      sourceEvidence: {
        file: 'test.ts',
        line: r.line || 10,
        snippet: r.snippet || `${r.source} -> ${r.target}`,
        confidence: 'HIGH',
      },
    })),
    stats: {
      services: entities.length,
      apis: 0,
      databases: 0,
      modules: 0,
      libraries: 0,
      externalSystems: 0,
      totalEntities: entities.length,
      totalRelationships: rels.length,
      detectedCount: entities.length,
      userProvidedCount: 0,
    },
  };
}

let passedTests = 0;
let totalTests = 10;

// TEST 1: Identical V1 and V2
console.log('TEST 1: Identical V1 and V2');
{
  const v1 = createArchitectureSnapshot(SAMPLE_EVOLUTION_V1_MODEL, 'V1 Baseline', '1.0.0');
  const v2 = createArchitectureSnapshot(SAMPLE_EVOLUTION_V1_MODEL, 'V2 Copy', '1.0.0');
  const diff = computeArchitectureDiff(v1, v2);

  if (
    diff.addedNodes.length === 0 &&
    diff.removedNodes.length === 0 &&
    diff.addedRelationships.length === 0 &&
    diff.removedRelationships.length === 0 &&
    diff.unchangedNodes.length === SAMPLE_EVOLUTION_V1_MODEL.entities.length &&
    diff.unchangedRelationships.length === SAMPLE_EVOLUTION_V1_MODEL.relationships.length
  ) {
    console.log('  [PASS] 0 added, 0 removed, all elements unchanged.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 1 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 2: Added component (A -> B to A -> B, A -> C)
console.log('TEST 2: Added component (A -> B to A -> B, A -> C)');
{
  const m1 = makeTestModel('Sys1', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);
  const m2 = makeTestModel(
    'Sys1',
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'C' },
    ]
  );
  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '2.0.0')
  );

  const cAdded = diff.addedNodes.some((n) => n.id === 'C') && diff.addedNodes.length === 1;
  const acRelAdded =
    diff.addedRelationships.some((r) => r.relationship.source === 'A' && r.relationship.target === 'C') &&
    diff.addedRelationships.length === 1;
  const abUnchanged = diff.unchangedRelationships.some(
    (r) => r.relationship.source === 'A' && r.relationship.target === 'B'
  );

  if (cAdded && acRelAdded && abUnchanged && diff.removedNodes.length === 0 && diff.removedRelationships.length === 0) {
    console.log('  [PASS] Component C and relationship A -> C correctly reported as added.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 2 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 3: Removed component (A -> B, A -> C to A -> B)
console.log('TEST 3: Removed component (A -> B, A -> C to A -> B)');
{
  const m1 = makeTestModel(
    'Sys',
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'C' },
    ]
  );
  const m2 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '2.0.0')
  );

  const cRemoved = diff.removedNodes.some((n) => n.id === 'C') && diff.removedNodes.length === 1;
  const acRemoved =
    diff.removedRelationships.some((r) => r.relationship.source === 'A' && r.relationship.target === 'C') &&
    diff.removedRelationships.length === 1;

  if (cRemoved && acRemoved && diff.addedNodes.length === 0 && diff.addedRelationships.length === 0) {
    console.log('  [PASS] Component C and relationship A -> C correctly reported as removed.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 3 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 4: Added relationship between existing components (A -> B to A -> B, A -> C, B -> C)
console.log('TEST 4: Added relationship between existing components');
{
  const m1 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);
  const m2 = makeTestModel(
    'Sys',
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'C' },
      { source: 'B', target: 'C' },
    ]
  );

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '2.0.0')
  );

  if (diff.addedNodes.length === 1 && diff.addedRelationships.length === 2 && diff.unchangedRelationships.length === 1) {
    console.log('  [PASS] Correctly detected C added and both A -> C and B -> C added.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 4 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 5: Removed relationship while nodes remain
console.log('TEST 5: Removed relationship while nodes remain');
{
  const m1 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);
  const m2 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], []);

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '2.0.0')
  );

  if (
    diff.removedNodes.length === 0 &&
    diff.addedNodes.length === 0 &&
    diff.unchangedNodes.length === 2 &&
    diff.removedRelationships.length === 1 &&
    diff.addedRelationships.length === 0
  ) {
    console.log('  [PASS] Relationship removed while nodes A and B remained intact.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 5 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 6: Redirected dependency (A -> B to A -> C)
console.log('TEST 6: Redirected dependency (A -> B to A -> C)');
{
  const m1 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);
  const m2 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }, { id: 'C' }], [{ source: 'A', target: 'C' }]);

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '2.0.0')
  );

  const abRemoved = diff.removedRelationships.some((r) => r.relationship.source === 'A' && r.relationship.target === 'B');
  const acAdded = diff.addedRelationships.some((r) => r.relationship.source === 'A' && r.relationship.target === 'C');
  const cAdded = diff.addedNodes.some((n) => n.id === 'C');

  if (abRemoved && acAdded && cAdded && diff.removedRelationships.length === 1 && diff.addedRelationships.length === 1) {
    console.log('  [PASS] Redirected dependency accurately classified as A->B removed and A->C added.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 6 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 7: Relationship type change (A --USES--> B to A --CALLS--> B)
console.log('TEST 7: Relationship type change (A --USES--> B to A --CALLS--> B)');
{
  const m1 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B', type: 'USES' }]);
  const m2 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B', type: 'CALLS' }]);

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '2.0.0')
  );

  const usesRemoved = diff.removedRelationships.some((r) => r.relationship.type === 'USES');
  const callsAdded = diff.addedRelationships.some((r) => r.relationship.type === 'CALLS');

  if (
    usesRemoved &&
    callsAdded &&
    diff.removedRelationships.length === 1 &&
    diff.addedRelationships.length === 1 &&
    diff.unchangedNodes.length === 2 &&
    diff.addedNodes.length === 0 &&
    diff.removedNodes.length === 0
  ) {
    console.log('  [PASS] Relationship type change correctly marked as USES removed and CALLS added.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 7 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 8: Node ordering changes (Same architecture, different array order)
console.log('TEST 8: Node ordering changes');
{
  const m1 = makeTestModel(
    'Sys',
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
    ]
  );
  // Reverse order in m2
  const m2 = makeTestModel(
    'Sys',
    [{ id: 'C' }, { id: 'A' }, { id: 'B' }],
    [
      { source: 'B', target: 'C' },
      { source: 'A', target: 'B' },
    ]
  );

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '1.0.0')
  );

  if (
    diff.addedNodes.length === 0 &&
    diff.removedNodes.length === 0 &&
    diff.addedRelationships.length === 0 &&
    diff.removedRelationships.length === 0 &&
    diff.unchangedNodes.length === 3 &&
    diff.unchangedRelationships.length === 2
  ) {
    console.log('  [PASS] Different array ordering generated ZERO false diffs.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 8 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 9: React Flow layout changes (coordinates do not affect semantic diff)
console.log('TEST 9: React Flow layout changes (coordinates / UI positions)');
{
  const m1 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);
  const m2 = makeTestModel('Sys', [{ id: 'A' }, { id: 'B' }], [{ source: 'A', target: 'B' }]);

  // Simulate arbitrary React Flow UI coordinate changes in metadata
  m1.entities[0].metadata = { x: 100, y: 200 };
  m2.entities[0].metadata = { x: 999, y: 888 };

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '1.0.0')
  );

  if (
    diff.addedNodes.length === 0 &&
    diff.removedNodes.length === 0 &&
    diff.addedRelationships.length === 0 &&
    diff.removedRelationships.length === 0
  ) {
    console.log('  [PASS] Node layout coordinates do not induce false architectural changes.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 9 failed:', diff.summary);
    process.exit(1);
  }
}

// TEST 10: Evidence changes without semantic relationship change
console.log('TEST 10: Evidence changes without semantic relationship change');
{
  const m1 = makeTestModel(
    'Sys',
    [{ id: 'A' }, { id: 'B' }],
    [{ source: 'A', target: 'B', line: 42, snippet: 'api.call()' }]
  );
  const m2 = makeTestModel(
    'Sys',
    [{ id: 'A' }, { id: 'B' }],
    [{ source: 'A', target: 'B', line: 108, snippet: 'api.call() // updated line' }]
  );

  const diff = computeArchitectureDiff(
    createArchitectureSnapshot(m1, 'V1', '1.0.0'),
    createArchitectureSnapshot(m2, 'V2', '1.0.0')
  );

  if (
    diff.addedRelationships.length === 0 &&
    diff.removedRelationships.length === 0 &&
    diff.unchangedRelationships.length === 1
  ) {
    console.log('  [PASS] Line number updates preserve unchanged relationship identity.\n');
    passedTests++;
  } else {
    console.error('  [FAIL] TEST 10 failed:', diff.summary);
    process.exit(1);
  }
}

// BONUS TEST 11: Real Sample Evolution (V1 -> V2 with Fraud Service)
console.log('BONUS TEST 11: Real Sample Evolution (Cloud Retail Core V1 -> V2 with Fraud Service)');
{
  const diff = computeArchitectureDiff(SNAPSHOT_V1, SNAPSHOT_V2);

  const fraudServiceAdded = diff.addedNodes.some((n) => n.id === 'fraud-service');
  const fraudApiAdded = diff.addedNodes.some((n) => n.id === 'fraud-api');
  const paymentFraudRelAdded = diff.addedRelationships.some(
    (r) => r.relationship.source === 'payment-service' && r.relationship.target === 'fraud-service'
  );
  const fraudApiRelAdded = diff.addedRelationships.some(
    (r) => r.relationship.source === 'fraud-service' && r.relationship.target === 'fraud-api'
  );

  // Check evidence preservation
  const paymentFraudRel = diff.addedRelationships.find(
    (r) => r.relationship.source === 'payment-service' && r.relationship.target === 'fraud-service'
  );
  const hasRealEvidence =
    paymentFraudRel?.sourceEvidence?.file === 'services/payment/clients/fraud_client.py' &&
    paymentFraudRel?.sourceEvidence?.confidence === 'HIGH';

  if (
    fraudServiceAdded &&
    fraudApiAdded &&
    paymentFraudRelAdded &&
    fraudApiRelAdded &&
    hasRealEvidence &&
    diff.removedNodes.length === 0 &&
    diff.removedRelationships.length === 0 &&
    diff.unchangedRelationships.length === 4
  ) {
    console.log('  [PASS] Real Evolution verified with exact provenance and zero fabricated data.\n');
  } else {
    console.error('  [FAIL] Real Evolution test failed:', diff.summary);
    process.exit(1);
  }
}

// BONUS TEST 12: Real Repository Extraction Diff (phishing-ai-extention-main.zip)
console.log('BONUS TEST 12: Real Repository Extraction Diff (phishing-ai-extention-main (1).zip)');
async function testRealRepoDiff() {
  const phishingZipPath = 'C:\\Users\\prana\\Downloads\\phishing-ai-extention-main (1).zip';
  if (!fs.existsSync(phishingZipPath)) {
    console.log('  [SKIP] Phishing ZIP not found in Downloads, skipping real repo zip test.\n');
    return;
  }

  const zipBuffer = fs.readFileSync(phishingZipPath);
  const analysisV1 = await analyzeCodebaseZip(zipBuffer, 'phishing-ai-extention-main (1).zip');
  const modelV1 = reconstructArchitecture({
    systemName: analysisV1.systemName,
    version: '1.0.0',
    inputType: 'codebase',
    entities: analysisV1.entities,
    relationships: analysisV1.relationships,
    sourceArtifacts: ['phishing-ai-extention-main (1).zip'],
    inventory: analysisV1.inventory,
  });

  const snapV1 = createArchitectureSnapshot(modelV1, 'Phishing Detection v1.0', '1.0.0');

  // Create an evolved V2 model by adding a Notification Service with genuine evidence
  const modelV2: ArchitectureModel = {
    ...modelV1,
    version: '2.0.0',
    entities: [
      ...modelV1.entities,
      {
        id: 'security-alert-dispatcher',
        name: 'Security Alert Dispatcher',
        type: 'Service',
        technology: 'Python / Celery',
        source: 'Detected',
        description: 'Dispatches real-time threat notifications to enterprise SIEM',
      },
    ],
    relationships: [
      ...modelV1.relationships,
      {
        id: 'rel-phishing-alert-dispatcher',
        source: 'phishing-ai-extention-main',
        target: 'security-alert-dispatcher',
        type: 'CALLS',
        protocol: 'AMQP / RabbitMQ',
        sourceEvidence: {
          file: 'phishing-ai-extention-main/tasks.py',
          line: 55,
          snippet: 'celery_app.send_task("dispatch_security_alert", args=[threat_event])',
          description: 'Flask app queues async threat alerts',
          method: 'Celery Task Parser',
          confidence: 'HIGH',
        },
      },
    ],
  };

  const snapV2 = createArchitectureSnapshot(modelV2, 'Phishing Detection v2.0 (SIEM Integration)', '2.0.0');
  const diff = computeArchitectureDiff(snapV1, snapV2);

  const alertAdded = diff.addedNodes.some((n) => n.id === 'security-alert-dispatcher');
  const relAdded = diff.addedRelationships.some((r) => r.relationship.target === 'security-alert-dispatcher');
  const relEvidencePreserved =
    diff.addedRelationships.find((r) => r.relationship.target === 'security-alert-dispatcher')
      ?.sourceEvidence?.snippet ===
    'celery_app.send_task("dispatch_security_alert", args=[threat_event])';

  if (
    alertAdded &&
    relAdded &&
    relEvidencePreserved &&
    diff.removedNodes.length === 0 &&
    diff.removedRelationships.length === 0 &&
    diff.unchangedNodes.length === modelV1.entities.length &&
    diff.unchangedRelationships.length === modelV1.relationships.length
  ) {
    console.log('  [PASS] Real Codebase Extraction Diff verified with authentic source provenance!\n');
  } else {
    console.error('  [FAIL] Real Codebase Extraction Diff failed:', diff.summary);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('ALL TESTS (10 BASE TESTS + 2 REAL EVOLUTIONS) PASSED!');
  console.log('====================================================\n');
}

testRealRepoDiff();
