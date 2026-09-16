import JSZip from 'jszip';
import { analyzeCodebaseZip } from '../src/engine/codebaseAnalyzer';
import { reconstructArchitecture } from '../src/engine/architectureReconstructor';
import {
  computeArchitectureDiff,
  createArchitectureSnapshot,
} from '../src/engine/architectureDiffEngine';
import { parseAndValidateBlueprint } from '../src/engine/blueprintParser';

console.log('=== TRACEIQ OBJECTIVE 1: REPOSITORY INVENTORY & DUAL DIFF TEST SUITE ===\n');

let passedTests = 0;
const totalTests = 4;

async function runTests() {
  // =========================================================================
  // TEST 1: Section 8 - 10-File Mixed Repository Archive & 100% Retention
  // =========================================================================
  console.log('TEST 1: Section 8 - 10-File Mixed Repository Archive Ingestion & 100% Retention');
  {
    const zip = new JSZip();
    zip.file('project/src/app.py', 'from payment import process_payment\nprint("App running")\n');
    zip.file('project/src/payment.py', 'from fraud import check_fraud\ndef process_payment():\n    return check_fraud()\n');
    zip.file('project/src/fraud.py', 'def check_fraud():\n    return True\n');
    zip.file('project/config/settings.json', JSON.stringify({ database_url: 'postgres://localhost:5432', timeout: 30 }));
    zip.file('project/data/users.csv', 'id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com\n');
    zip.file('project/docs/README.md', '# Sample Retail Project\nArchitectural documentation and guides.\n');
    zip.file('project/assets/logo.png', 'PNG_BINARY_MOCK_DATA');
    zip.file('project/tests/test_payment.py', 'def test_payment():\n    assert True\n');
    zip.file('project/requirements.txt', 'requests==2.28.0\npytest==7.0.0\n');
    zip.file('project/Dockerfile', 'FROM python:3.11\nWORKDIR /app\nCOPY . .\nCMD ["python", "src/app.py"]\n');

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const analysis = await analyzeCodebaseZip(zipBuffer as any);

    if (!analysis.success || !analysis.inventory) {
      console.error('  [FAIL] Analysis failed on 10-file test archive');
      process.exit(1);
    }

    const inv = analysis.inventory;
    console.log(`  - Total Files: ${inv.total_files} (expected: 10)`);
    console.log(`  - Total Folders: ${inv.total_folders}`);
    console.log(`  - Categories Breakdown:`, inv.categories_breakdown);

    if (inv.total_files !== 10 || inv.files.length !== 10) {
      console.error(`  [FAIL] Expected exactly 10 files retained, got ${inv.total_files}`);
      process.exit(1);
    }

    // Verify 100% of files have analysis status
    const allHaveStatus = inv.files.every((f) => !!f.analysis_status && f.analysis_status.trim().length > 0);
    if (!allHaveStatus) {
      console.error('  [FAIL] Some files are missing analysis_status');
      process.exit(1);
    }

    // Verify categories
    const categories = new Map(inv.files.map((f) => [f.path, f.category]));
    const statuses = new Map(inv.files.map((f) => [f.path, f.analysis_status]));

    console.log('  - File Ingestion & Classification Table:');
    inv.files.forEach((f) => {
      console.log(`    * ${f.path.padEnd(30)} [${f.category.padEnd(14)}] -> ${f.analysis_status}`);
    });

    const getCat = (suffix: string) => Array.from(categories.entries()).find(([p]) => p.endsWith(suffix))?.[1];
    const getStat = (suffix: string) => Array.from(statuses.entries()).find(([p]) => p.endsWith(suffix))?.[1];

    if (
      getCat('src/app.py') !== 'source' ||
      getCat('config/settings.json') !== 'config' ||
      getCat('data/users.csv') !== 'dataset' ||
      getCat('docs/README.md') !== 'documentation' ||
      getCat('assets/logo.png') !== 'asset' ||
      getCat('requirements.txt') !== 'manifest' ||
      getCat('Dockerfile') !== 'manifest'
    ) {
      console.error('  [FAIL] Category assignments did not match expected categories');
      process.exit(1);
    }

    // Verify non-architectural files are retained with appropriate status
    if (
      !getStat('assets/logo.png')?.includes('Retained') ||
      !getStat('docs/README.md')?.includes('Retained')
    ) {
      console.error('  [FAIL] Unanalyzable files must be marked as Retained');
      process.exit(1);
    }

    console.log('  [PASS] 100% file retention (10/10) with exact category and status breakdown.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 2: Section 9 - V1 ZIP vs V2 ZIP Dual Diffing (Repository + Architecture)
  // =========================================================================
  console.log('TEST 2: Section 9 - V1 ZIP vs V2 ZIP Dual Diffing (Repository + Architecture)');
  {
    const v1Zip = new JSZip();
    v1Zip.file('src/app.py', 'from payment import process_payment\nprint("App running")\n');
    v1Zip.file('src/payment.py', 'def process_payment():\n    return True\n');
    v1Zip.file('config/settings.json', JSON.stringify({ env: 'staging' }));
    v1Zip.file('requirements.txt', 'requests==2.28.0\n');

    const v2Zip = new JSZip();
    v2Zip.file('src/app.py', 'from payment import process_payment\nprint("App running")\n');
    v2Zip.file('src/payment.py', 'from fraud import check_fraud\ndef process_payment():\n    return check_fraud()\n');
    v2Zip.file('src/fraud.py', 'def check_fraud():\n    return True\n');
    v2Zip.file('config/settings.json', JSON.stringify({ env: 'staging' }));
    v2Zip.file('requirements.txt', 'requests==2.28.0\n');
    v2Zip.file('tests/test_fraud.py', 'def test_fraud():\n    assert True\n');

    const [v1Buf, v2Buf] = await Promise.all([
      v1Zip.generateAsync({ type: 'nodebuffer' }),
      v2Zip.generateAsync({ type: 'nodebuffer' }),
    ]);

    const [v1Analysis, v2Analysis] = await Promise.all([
      analyzeCodebaseZip(v1Buf as any),
      analyzeCodebaseZip(v2Buf as any),
    ]);

    const v1Model = reconstructArchitecture({
      entities: v1Analysis.entities,
      relationships: v1Analysis.relationships,
      systemName: 'Retail System V1',
      version: '1.0.0',
      inputType: 'codebase',
      inventory: v1Analysis.inventory,
    });

    const v2Model = reconstructArchitecture({
      entities: v2Analysis.entities,
      relationships: v2Analysis.relationships,
      systemName: 'Retail System V2',
      version: '2.0.0',
      inputType: 'codebase',
      inventory: v2Analysis.inventory,
    });

    const v1Snap = createArchitectureSnapshot(v1Model, 'Retail V1 Baseline', '1.0.0');
    const v2Snap = createArchitectureSnapshot(v2Model, 'Retail V2 Fraud Release', '2.0.0');

    const diff = computeArchitectureDiff(v1Snap, v2Snap);

    console.log(`  - Semantic Architecture Diff:`);
    console.log(`    * Added Nodes (${diff.summary.addedNodesCount}): ${diff.addedNodes.map((n) => n.name).join(', ')}`);
    console.log(`    * Removed Nodes (${diff.summary.removedNodesCount}): ${diff.removedNodes.map((n) => n.name).join(', ')}`);
    console.log(`    * Added Relationships (${diff.summary.addedRelationshipsCount}): ${diff.addedRelationships.map((r) => `${r.relationship.source} -> ${r.relationship.target}`).join(', ')}`);
    console.log(`    * Unchanged Nodes (${diff.summary.unchangedNodesCount}): ${diff.unchangedNodes.map((n) => n.name).join(', ')}`);

    console.log(`  - Repository Inventory Diff:`);
    const repoDiff = diff.repositoryDiff!;
    console.log(`    * Added Files (${repoDiff.summary.addedFilesCount}): ${repoDiff.addedFiles.map((f) => f.path).join(', ')}`);
    console.log(`    * Removed Files (${repoDiff.summary.removedFilesCount}): ${repoDiff.removedFiles.map((f) => f.path).join(', ')}`);
    console.log(`    * Unchanged Files (${repoDiff.summary.unchangedFilesCount}): ${repoDiff.unchangedFiles.map((f) => f.path).join(', ')}`);

    // Verify Repository Diff
    const addedFilePaths = repoDiff.addedFiles.map((f) => f.path);
    const hasExpectedDiff =
      repoDiff.summary.addedFilesCount === 2 &&
      addedFilePaths.includes('src/fraud.py') &&
      addedFilePaths.includes('tests/test_fraud.py') &&
      repoDiff.summary.removedFilesCount === 0 &&
      (repoDiff.summary.unchangedFilesCount === 3 && repoDiff.summary.modifiedFilesCount === 1);

    if (!hasExpectedDiff) {
      console.error('  [FAIL] Repository inventory diff mismatch');
      process.exit(1);
    }

    // Verify Architecture Diff
    const addedNodeNames = diff.addedNodes.map((n) => n.name);
    if (
      !addedNodeNames.includes('Fraud Service') ||
      diff.summary.removedNodesCount !== 0 ||
      diff.addedRelationships.length === 0
    ) {
      console.error('  [FAIL] Architecture diff mismatch: Fraud Service or relationship missing');
      process.exit(1);
    }

    // Crucial check: tests/test_fraud.py must NEVER be an architecture entity!
    const isTestNodePresent = [...diff.addedNodes, ...diff.unchangedNodes].some(
      (n) => n.name.toLowerCase().includes('test') || n.id.toLowerCase().includes('test')
    );
    if (isTestNodePresent) {
      console.error('  [FAIL] Test file was falsely promoted to an architecture node!');
      process.exit(1);
    }

    console.log('  [PASS] Repository diff and Architecture diff operate correctly without cross-contamination.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 3: Section 10 - JSON Blueprint V1 vs V2 Semantic & Synthesized Inventory Diff
  // =========================================================================
  console.log('TEST 3: Section 10 - JSON Blueprint V1 vs V2 Semantic & Synthesized Inventory Diff');
  {
    const bpV1 = JSON.stringify({
      systemName: 'Payment Network',
      version: '1.0.0',
      entities: [
        { id: 'gateway', name: 'API Gateway', type: 'Service', technology: 'Node.js' },
        { id: 'billing', name: 'Billing Service', type: 'Service', technology: 'Java' },
        { id: 'legacy-db', name: 'Legacy SQL Database', type: 'Database', technology: 'Oracle' },
      ],
      relationships: [
        { source: 'gateway', target: 'billing', type: 'CALLS', protocol: 'HTTP' },
        { source: 'billing', target: 'legacy-db', type: 'USES', protocol: 'JDBC' },
      ],
    });

    const bpV2 = JSON.stringify({
      systemName: 'Payment Network',
      version: '2.0.0',
      entities: [
        { id: 'gateway', name: 'API Gateway', type: 'Service', technology: 'Node.js' },
        { id: 'billing', name: 'Billing Service', type: 'Service', technology: 'Java' },
        { id: 'modern-db', name: 'Modern Cloud Spanner', type: 'Database', technology: 'Cloud Spanner' },
      ],
      relationships: [
        { source: 'gateway', target: 'billing', type: 'CALLS', protocol: 'HTTP' },
        { source: 'billing', target: 'modern-db', type: 'USES', protocol: 'gRPC' },
      ],
    });

    const p1 = parseAndValidateBlueprint(bpV1);
    const p2 = parseAndValidateBlueprint(bpV2);

    const m1 = reconstructArchitecture({
      entities: p1.entities,
      relationships: p1.relationships,
      systemName: 'Payment Network V1',
      version: '1.0.0',
      inputType: 'blueprint',
    });

    const m2 = reconstructArchitecture({
      entities: p2.entities,
      relationships: p2.relationships,
      systemName: 'Payment Network V2',
      version: '2.0.0',
      inputType: 'blueprint',
    });

    const snap1 = createArchitectureSnapshot(m1, 'V1 Baseline Blueprint', '1.0.0');
    const snap2 = createArchitectureSnapshot(m2, 'V2 Modernized Blueprint', '2.0.0');

    // Verify synthesized inventory exists for blueprint
    if (!snap1.repositoryInventory || snap1.fileCount !== 1) {
      console.error('  [FAIL] Blueprint snapshot missing synthesized inventory');
      process.exit(1);
    }

    const diff = computeArchitectureDiff(snap1, snap2);

    console.log(`  - Semantic Blueprint Diff:`);
    console.log(`    * Added Nodes: ${diff.addedNodes.map((n) => n.name).join(', ')}`);
    console.log(`    * Removed Nodes: ${diff.removedNodes.map((n) => n.name).join(', ')}`);
    console.log(`    * Added Relationships: ${diff.addedRelationships.map((r) => `${r.relationship.source} -> ${r.relationship.target}`).join(', ')}`);
    console.log(`    * Removed Relationships: ${diff.removedRelationships.map((r) => `${r.relationship.source} -> ${r.relationship.target}`).join(', ')}`);

    if (
      diff.summary.addedNodesCount !== 1 ||
      diff.addedNodes[0].name !== 'Modern Cloud Spanner' ||
      diff.summary.removedNodesCount !== 1 ||
      diff.removedNodes[0].name !== 'Legacy SQL Database' ||
      diff.summary.addedRelationshipsCount !== 1 ||
      diff.summary.removedRelationshipsCount !== 1
    ) {
      console.error('  [FAIL] Blueprint semantic diff mismatch');
      process.exit(1);
    }

    console.log('  [PASS] Blueprint V1 to V2 diff accurately tracks added/removed nodes and edges with synthesized inventory.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 4: Non-architectural files do not affect architecture diff
  // =========================================================================
  console.log('TEST 4: Non-Architectural File Additions (README, logo.png, settings.json)');
  {
    const zipV1 = new JSZip();
    zipV1.file('src/app.py', 'print("Hello World")\n');

    const zipV2 = new JSZip();
    zipV2.file('src/app.py', 'print("Hello World")\n');
    zipV2.file('docs/README.md', '# Documentation\n');
    zipV2.file('assets/logo.png', 'IMAGE_BYTES');
    zipV2.file('config/settings.json', '{"debug": false}');

    const [buf1, buf2] = await Promise.all([
      zipV1.generateAsync({ type: 'nodebuffer' }),
      zipV2.generateAsync({ type: 'nodebuffer' }),
    ]);

    const [a1, a2] = await Promise.all([
      analyzeCodebaseZip(buf1 as any),
      analyzeCodebaseZip(buf2 as any),
    ]);

    const m1 = reconstructArchitecture({
      entities: a1.entities,
      relationships: a1.relationships,
      systemName: 'System V1',
      version: '1.0.0',
      inputType: 'codebase',
      inventory: a1.inventory,
    });

    const m2 = reconstructArchitecture({
      entities: a2.entities,
      relationships: a2.relationships,
      systemName: 'System V2',
      version: '2.0.0',
      inputType: 'codebase',
      inventory: a2.inventory,
    });

    const s1 = createArchitectureSnapshot(m1, 'V1', '1.0.0');
    const s2 = createArchitectureSnapshot(m2, 'V2', '2.0.0');

    const diff = computeArchitectureDiff(s1, s2);

    console.log(`  - Repository Diff: Added files = ${diff.repositoryDiff?.summary.addedFilesCount}, Unchanged = ${diff.repositoryDiff?.summary.unchangedFilesCount}`);
    console.log(`  - Architecture Diff: Added nodes = ${diff.summary.addedNodesCount}, Added rels = ${diff.summary.addedRelationshipsCount}`);

    if (diff.repositoryDiff?.summary.addedFilesCount !== 3) {
      console.error('  [FAIL] Repository diff did not detect 3 added non-code files');
      process.exit(1);
    }

    if (diff.summary.addedNodesCount !== 0 || diff.summary.addedRelationshipsCount !== 0) {
      console.error('  [FAIL] Non-architectural files falsely generated architecture nodes/edges!');
      process.exit(1);
    }

    console.log('  [PASS] Non-architectural files strictly isolate to repository diff with ZERO false architecture mutations.\n');
    passedTests++;
  }

  console.log(`====================================================`);
  console.log(`ALL ${passedTests}/${totalTests} REPOSITORY & DUAL DIFF TESTS PASSED!`);
  console.log(`====================================================\n`);
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
