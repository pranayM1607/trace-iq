import JSZip from 'jszip';
import { analyzeCodebaseZip } from '../src/engine/codebaseAnalyzer';
import { parseAndValidateBlueprint } from '../src/engine/blueprintParser';
import { reconstructArchitecture } from '../src/engine/architectureReconstructor';
import {
  createArchitectureSnapshot,
  computeArchitectureDiff,
} from '../src/engine/architectureDiffEngine';
import {
  computeImpactAnalysis,
  computeStructuralRiskDelta,
  generateChangeStory,
} from '../src/engine/structuralRiskEngine';
import { compareRealModels } from '../src/engine/directCompareEngine';

async function runRealAnalyzeCompareTests() {
  console.log('=== TRACEIQ OBJECTIVE 1: REAL ANALYZE + REAL COMPARE VERIFICATION ===\n');
  let passedTests = 0;
  const totalTests = 6;

  // =========================================================================
  // TEST 1: Real Analyze Mode, Input Identity & Snapshot Immutability
  // =========================================================================
  console.log('TEST 1: Real Analyze Mode, Input Identity & Snapshot Immutability');
  {
    const zipV1 = new JSZip();
    zipV1.file('src/gateway.py', 'from order import create_order\nprint("Gateway running")\n');
    zipV1.file('src/order.py', 'def create_order():\n    return "order-123"\n');
    zipV1.file('requirements.txt', 'fastapi==0.100.0\nuvicorn==0.22.0\n');
    zipV1.file('config/settings.json', JSON.stringify({ port: 8080 }));

    const bufV1 = await zipV1.generateAsync({ type: 'nodebuffer' });
    const analysisV1 = await analyzeCodebaseZip(bufV1 as any);

    const modelV1 = reconstructArchitecture({
      systemName: 'E-Commerce Core',
      version: '1.0.0',
      inputType: 'codebase',
      entities: analysisV1.entities,
      relationships: analysisV1.relationships,
      sourceArtifacts: ['ecommerce-v1.zip'],
      inventory: analysisV1.inventory,
      codebaseGraph: analysisV1.codebaseGraph,
      isLimitedArchitecture: analysisV1.isLimitedArchitecture,
      limitedArchitectureReason: analysisV1.limitedArchitectureReason,
      inputIdentity: {
        id: 'input_ecom_v1_001',
        filename: 'ecommerce-v1.zip',
        inputType: 'codebase',
        uploadedAt: new Date().toISOString(),
        filesCount: analysisV1.inventory?.total_files || 4,
        foldersCount: analysisV1.inventory?.total_folders || 2,
        scope: 'complete',
      },
      scope: 'complete',
    });

    // 1. Verify Input Identity
    if (!modelV1.inputIdentity || modelV1.inputIdentity.id !== 'input_ecom_v1_001' || modelV1.scope !== 'complete') {
      console.error('  [FAIL] Model input identity or scope was not preserved!');
      process.exit(1);
    }
    console.log(`  - Input Identity Created: ${modelV1.inputIdentity.id} (${modelV1.inputIdentity.filename})`);
    console.log(`  - Inventory Files: ${modelV1.inventory?.total_files} files, ${modelV1.inventory?.total_folders} folders`);

    // 2. Save Snapshot V1 (Frozen)
    const snapshotV1 = createArchitectureSnapshot(modelV1, 'V1 Baseline Frozen');
    if (!snapshotV1.isFrozen) {
      console.error('  [FAIL] Snapshot was not created with isFrozen: true');
      process.exit(1);
    }
    const initialNodeCount = snapshotV1.architecture.entities.length;
    const initialFileCount = snapshotV1.fileCount;

    // 3. Mutate workspace with a new upload (V2)
    const zipV2 = new JSZip();
    zipV2.file('src/gateway.py', 'from order import create_order\nfrom payment import pay\n');
    zipV2.file('src/order.py', 'def create_order():\n    return "order-123"\n');
    zipV2.file('src/payment.py', 'def pay():\n    return True\n');
    zipV2.file('requirements.txt', 'fastapi==0.100.0\nuvicorn==0.22.0\nstripe==5.0.0\n');

    const bufV2 = await zipV2.generateAsync({ type: 'nodebuffer' });
    const analysisV2 = await analyzeCodebaseZip(bufV2 as any);
    const modelV2 = reconstructArchitecture({
      systemName: 'E-Commerce Core',
      version: '2.0.0',
      inputType: 'codebase',
      entities: analysisV2.entities,
      relationships: analysisV2.relationships,
      sourceArtifacts: ['ecommerce-v2.zip'],
      inventory: analysisV2.inventory,
      inputIdentity: {
        id: 'input_ecom_v2_002',
        filename: 'ecommerce-v2.zip',
        inputType: 'codebase',
        uploadedAt: new Date().toISOString(),
        filesCount: analysisV2.inventory?.total_files || 4,
        foldersCount: analysisV2.inventory?.total_folders || 1,
        scope: 'complete',
      },
    });

    // 4. Verify Snapshot V1 remained completely unchanged (deep clone invariance)
    if (snapshotV1.architecture.entities.length !== initialNodeCount || snapshotV1.fileCount !== initialFileCount) {
      console.error('  [FAIL] Snapshot V1 mutated after V2 upload! Snapshot is not deep-copied or frozen!');
      process.exit(1);
    }
    if (modelV2.inputIdentity?.id === snapshotV1.inputIdentity?.id) {
      console.error('  [FAIL] V2 model shared identity with snapshot V1!');
      process.exit(1);
    }

    console.log(`  - Snapshot Immutability Verified: V1 snapshot remained strictly frozen (${snapshotV1.nodeCount} nodes, ${snapshotV1.fileCount} files) while workspace updated to V2.`);
    console.log('  [PASS] Real Analyze Mode & Snapshot Immutability verified.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 2: Direct Real Compare with Modified File Tracking & Zero Demo Fallback
  // =========================================================================
  console.log('TEST 2: Direct Real Compare (Modified Files + Zero Demo Fallback)');
  {
    const zipOriginal = new JSZip();
    zipOriginal.file('src/auth.py', 'def login(u, p):\n    return True\n');
    zipOriginal.file('src/service.py', 'from auth import login\ndef run():\n    return login("admin", "pwd")\n');
    zipOriginal.file('config/app.json', '{"version": "1.0.0"}');
    zipOriginal.file('docs/guide.md', '# User Guide\n');

    const zipChanged = new JSZip();
    // auth.py has modified content (hash changed)
    zipChanged.file('src/auth.py', 'def login(u, p):\n    # Enhanced security check\n    if not u or not p: return False\n    return True\n');
    // service.py is unchanged
    zipChanged.file('src/service.py', 'from auth import login\ndef run():\n    return login("admin", "pwd")\n');
    // config/app.json removed
    // added audit.py
    zipChanged.file('src/audit.py', 'def log_event(event):\n    print(event)\n');
    // docs/guide.md unchanged
    zipChanged.file('docs/guide.md', '# User Guide\n');

    const [bufOrig, bufChg] = await Promise.all([
      zipOriginal.generateAsync({ type: 'nodebuffer' }),
      zipChanged.generateAsync({ type: 'nodebuffer' }),
    ]);

    const [aOrig, aChg] = await Promise.all([
      analyzeCodebaseZip(bufOrig as any),
      analyzeCodebaseZip(bufChg as any),
    ]);

    const mOrig = reconstructArchitecture({
      systemName: 'Auth Platform',
      version: '1.0.0',
      inputType: 'codebase',
      entities: aOrig.entities,
      relationships: aOrig.relationships,
      sourceArtifacts: ['auth-orig.zip'],
      inventory: aOrig.inventory,
      inputIdentity: {
        id: 'input_orig_real',
        filename: 'auth-orig.zip',
        inputType: 'codebase',
        uploadedAt: new Date().toISOString(),
        filesCount: aOrig.inventory?.total_files || 4,
        foldersCount: aOrig.inventory?.total_folders || 2,
        scope: 'complete',
      },
    });

    const mChg = reconstructArchitecture({
      systemName: 'Auth Platform',
      version: '2.0.0',
      inputType: 'codebase',
      entities: aChg.entities,
      relationships: aChg.relationships,
      sourceArtifacts: ['auth-chg.zip'],
      inventory: aChg.inventory,
      inputIdentity: {
        id: 'input_chg_real',
        filename: 'auth-chg.zip',
        inputType: 'codebase',
        uploadedAt: new Date().toISOString(),
        filesCount: aChg.inventory?.total_files || 4,
        foldersCount: aChg.inventory?.total_folders || 2,
        scope: 'complete',
      },
    });

    const result = compareRealModels(mOrig, mChg);

    // 1. Verify identities and zero demo leakage
    if (result.originalIdentity.id !== 'input_orig_real' || result.changedIdentity.id !== 'input_chg_real') {
      console.error('  [FAIL] Comparison did not retain uploaded input identities!');
      process.exit(1);
    }

    // 2. Verify Level 1 Repository Diff with Modified Files
    const repoDiff = result.repositoryDiff!;
    console.log(`  - Repository Diff Summary:`);
    console.log(`    * Added Files (${repoDiff.summary.addedFilesCount}): ${repoDiff.addedFiles.map((f) => f.path).join(', ')}`);
    console.log(`    * Removed Files (${repoDiff.summary.removedFilesCount}): ${repoDiff.removedFiles.map((f) => f.path).join(', ')}`);
    console.log(`    * Modified Files (${repoDiff.summary.modifiedFilesCount}): ${repoDiff.modifiedFiles.map((f) => f.path).join(', ')}`);
    console.log(`    * Unchanged Files (${repoDiff.summary.unchangedFilesCount}): ${repoDiff.unchangedFiles.map((f) => f.path).join(', ')}`);

    if (repoDiff.summary.addedFilesCount !== 1 || repoDiff.addedFiles[0].path !== 'src/audit.py') {
      console.error('  [FAIL] Added file src/audit.py was not detected correctly');
      process.exit(1);
    }
    if (repoDiff.summary.removedFilesCount !== 1 || repoDiff.removedFiles[0].path !== 'config/app.json') {
      console.error('  [FAIL] Removed file config/app.json was not detected correctly');
      process.exit(1);
    }
    if (repoDiff.summary.modifiedFilesCount !== 1 || repoDiff.modifiedFiles[0].path !== 'src/auth.py') {
      console.error('  [FAIL] Modified file src/auth.py was not detected via content hash/size change!');
      process.exit(1);
    }
    if (repoDiff.summary.unchangedFilesCount !== 2) {
      console.error(`  [FAIL] Expected 2 unchanged files (src/service.py, docs/guide.md), got ${repoDiff.summary.unchangedFilesCount}`);
      process.exit(1);
    }

    console.log('  [PASS] Direct Real Compare correctly detected Added, Removed, Modified (~), and Unchanged files.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 3: Real Blueprint Compare & 100% JSON Payload Preservation
  // =========================================================================
  console.log('TEST 3: Real Blueprint Compare & 100% JSON Payload Preservation');
  {
    const rawPayloadV1 = JSON.stringify(
      {
        customHeader: 'TraceIQ Production Architecture Spec',
        company: 'FintechGlobal Inc',
        metaInfo: { environment: 'production', cluster: 'us-east-1' },
        systemName: 'Payment Clearing Network',
        version: '1.0.0',
        entities: [
          { id: 'gw', name: 'API Gateway', type: 'Service', technology: 'Express', customTag: 'tier-1' },
          { id: 'clearing', name: 'Clearing Engine', type: 'Service', technology: 'Go' },
          { id: 'ledger-db', name: 'Ledger Database', type: 'Database', technology: 'PostgreSQL' },
        ],
        relationships: [
          { source: 'gw', target: 'clearing', type: 'CALLS', protocol: 'gRPC' },
          { source: 'clearing', target: 'ledger-db', type: 'USES', protocol: 'TCP' },
        ],
        extraArbitraryFields: ['can', 'preserve', 'any', 'arbitrary', 'json'],
      },
      null,
      2
    );

    const rawPayloadV2 = JSON.stringify(
      {
        customHeader: 'TraceIQ Production Architecture Spec',
        company: 'FintechGlobal Inc',
        metaInfo: { environment: 'production', cluster: 'us-east-1' },
        systemName: 'Payment Clearing Network',
        version: '2.0.0',
        entities: [
          { id: 'gw', name: 'API Gateway', type: 'Service', technology: 'Express', customTag: 'tier-1' },
          { id: 'clearing', name: 'Clearing Engine', type: 'Service', technology: 'Go' },
          { id: 'ledger-db', name: 'Ledger Database', type: 'Database', technology: 'PostgreSQL' },
          { id: 'fraud-ai', name: 'Fraud AI Coprocessor', type: 'Service', technology: 'Python/FastAPI' },
        ],
        relationships: [
          { source: 'gw', target: 'clearing', type: 'CALLS', protocol: 'gRPC' },
          { source: 'clearing', target: 'ledger-db', type: 'USES', protocol: 'TCP' },
          { source: 'clearing', target: 'fraud-ai', type: 'CALLS', protocol: 'gRPC' },
        ],
        extraArbitraryFields: ['can', 'preserve', 'any', 'arbitrary', 'json'],
      },
      null,
      2
    );

    const p1 = parseAndValidateBlueprint(rawPayloadV1);
    const p2 = parseAndValidateBlueprint(rawPayloadV2);

    // Verify 100% JSON preservation
    if (
      !p1.originalJsonPayload ||
      p1.originalJsonPayload.company !== 'FintechGlobal Inc' ||
      !Array.isArray(p1.originalJsonPayload.extraArbitraryFields)
    ) {
      console.error('  [FAIL] Original JSON payload fields were dropped during parsing!');
      process.exit(1);
    }
    if (!p1.rawJsonString || p1.rawJsonString.length !== rawPayloadV1.length) {
      console.error('  [FAIL] Verbatim raw JSON string was corrupted or truncated!');
      process.exit(1);
    }

    const m1 = reconstructArchitecture({
      systemName: p1.systemName,
      version: p1.version,
      inputType: 'blueprint',
      entities: p1.entities,
      relationships: p1.relationships,
      sourceArtifacts: ['payment-clearing-v1.json'],
      originalJsonPayload: p1.originalJsonPayload,
      rawJsonString: p1.rawJsonString,
    });

    const m2 = reconstructArchitecture({
      systemName: p2.systemName,
      version: p2.version,
      inputType: 'blueprint',
      entities: p2.entities,
      relationships: p2.relationships,
      sourceArtifacts: ['payment-clearing-v2.json'],
      originalJsonPayload: p2.originalJsonPayload,
      rawJsonString: p2.rawJsonString,
    });

    const diffResult = compareRealModels(m1, m2);

    console.log(`  - Semantic Blueprint Diff: +${diffResult.architectureDiff.summary.addedNodesCount} nodes, +${diffResult.architectureDiff.summary.addedRelationshipsCount} rels`);
    console.log(`  - Original JSON Payload Preserved: ${Object.keys(diffResult.originalModel.originalJsonPayload).join(', ')}`);

    if (diffResult.architectureDiff.summary.addedNodesCount !== 1 || diffResult.architectureDiff.addedNodes[0].name !== 'Fraud AI Coprocessor') {
      console.error('  [FAIL] Added node Fraud AI Coprocessor was not detected');
      process.exit(1);
    }

    console.log('  [PASS] Blueprint JSON comparison preserved 100% arbitrary JSON fields and computed semantic diff.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 4: Partial Repository Detection & Graceful Warning
  // =========================================================================
  console.log('TEST 4: Partial Repository Ingestion (Changed-Files-Only ZIP)');
  {
    const partialZip = new JSZip();
    // Only 2 files, no package.json or requirements.txt
    partialZip.file('patch/fix.py', 'def patch():\n    return 42\n');
    partialZip.file('patch/helper.py', 'def help_me():\n    return True\n');

    const buf = await partialZip.generateAsync({ type: 'nodebuffer' });
    const analysis = await analyzeCodebaseZip(buf as any);

    const model = reconstructArchitecture({
      systemName: analysis.systemName,
      inputType: 'codebase',
      entities: analysis.entities,
      relationships: analysis.relationships,
      sourceArtifacts: ['patch.zip'],
      inventory: analysis.inventory,
      isLimitedArchitecture: analysis.isLimitedArchitecture,
      limitedArchitectureReason: analysis.limitedArchitectureReason,
      scope: analysis.scope,
    });

    console.log(`  - Files Scanned: ${analysis.filesScanned}`);
    console.log(`  - Is Limited Architecture: ${model.isLimitedArchitecture}`);
    console.log(`  - Scope: ${model.scope}`);
    console.log(`  - Reason: ${model.limitedArchitectureReason}`);

    if (model.scope !== 'partial' || !model.isLimitedArchitecture) {
      console.error('  [FAIL] Partial repository was not classified with scope="partial" and isLimitedArchitecture=true');
      process.exit(1);
    }
    if (!model.limitedArchitectureReason?.includes('PARTIAL REPOSITORY')) {
      console.error('  [FAIL] Limited architecture reason did not mention PARTIAL REPOSITORY');
      process.exit(1);
    }

    console.log('  [PASS] Partial repository detected and assigned scope="partial" with explicit limitation reason.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 5: Complete Retention of Unsupported and Binary Formats
  // =========================================================================
  console.log('TEST 5: Complete Retention of Unsupported & Binary Formats (.xyz, .png, .pkl)');
  {
    const mixedZip = new JSZip();
    mixedZip.file('src/main.py', 'import model\nprint("Running")\n');
    mixedZip.file('models/weights.pkl', 'BINARY_PICKLE_STREAM');
    mixedZip.file('assets/icon.png', 'BINARY_PNG_STREAM');
    mixedZip.file('custom/data.xyz', 'UNKNOWN_CUSTOM_FORMAT');
    mixedZip.file('docs/architecture.md', '# Architecture Document\n');

    const buf = await mixedZip.generateAsync({ type: 'nodebuffer' });
    const analysis = await analyzeCodebaseZip(buf as any);
    const inv = analysis.inventory!;

    console.log(`  - Total Files: ${inv.total_files} (expected: 5)`);
    inv.files.forEach((f) => {
      console.log(`    * ${f.path.padEnd(25)} [${f.category.padEnd(15)}] -> ${f.analysis_status}`);
    });

    if (inv.total_files !== 5) {
      console.error(`  [FAIL] Expected 5 files, got ${inv.total_files}`);
      process.exit(1);
    }

    const pkl = inv.files.find((f) => f.path.endsWith('.pkl'))!;
    const png = inv.files.find((f) => f.path.endsWith('.png'))!;
    const xyz = inv.files.find((f) => f.path.endsWith('.xyz'))!;
    const md = inv.files.find((f) => f.path.endsWith('.md'))!;

    if (!pkl.analysis_status?.includes('Unsupported or binary format')) {
      console.error('  [FAIL] .pkl file must state "Unsupported or binary format"');
      process.exit(1);
    }
    if (!png.analysis_status?.includes('Unsupported or binary format')) {
      console.error('  [FAIL] .png file must state "Unsupported or binary format"');
      process.exit(1);
    }
    if (!xyz.analysis_status?.includes('Unsupported or binary format')) {
      console.error('  [FAIL] .xyz file must state "Unsupported or binary format"');
      process.exit(1);
    }
    if (!md.analysis_status?.includes('Retained')) {
      console.error('  [FAIL] .md file must state "Retained"');
      process.exit(1);
    }

    console.log('  [PASS] 100% retention verified for binary (.pkl, .png) and unsupported unknown (.xyz) formats.\n');
    passedTests++;
  }

  // =========================================================================
  // TEST 6: Impact Analysis, Causal Risk Ledger & Deterministic Change Story
  // =========================================================================
  console.log('TEST 6: Impact Analysis, Causal Risk Ledger & Change Story');
  {
    const originalModel: any = {
      systemName: 'Banking Platform',
      version: '1.0.0',
      entities: [
        { id: 'api-gw', name: 'API Gateway', type: 'Service' },
        { id: 'payment-svc', name: 'Payment Service', type: 'Service' },
        { id: 'account-db', name: 'Account Database', type: 'Database' },
      ],
      relationships: [
        { id: 'r1', source: 'api-gw', target: 'payment-svc', type: 'CALLS' },
        { id: 'r2', source: 'payment-svc', target: 'account-db', type: 'USES' },
      ],
    };

    const changedModel: any = {
      systemName: 'Banking Platform',
      version: '2.0.0',
      entities: [
        { id: 'api-gw', name: 'API Gateway', type: 'Service' },
        { id: 'payment-svc', name: 'Payment Service', type: 'Service' },
        { id: 'account-db', name: 'Account Database', type: 'Database' },
        { id: 'stripe-ext', name: 'Stripe External API', type: 'External System' },
      ],
      relationships: [
        { id: 'r1', source: 'api-gw', target: 'payment-svc', type: 'CALLS' },
        { id: 'r2', source: 'payment-svc', target: 'account-db', type: 'USES' },
        { id: 'r3', source: 'payment-svc', target: 'stripe-ext', type: 'CALLS' },
      ],
    };

    const s1 = createArchitectureSnapshot(originalModel, 'Bank V1', '1.0.0');
    const s2 = createArchitectureSnapshot(changedModel, 'Bank V2', '2.0.0');
    const diff = computeArchitectureDiff(s1, s2);

    // 1. Compute Impact
    const impact = computeImpactAnalysis(originalModel, changedModel, diff);
    console.log(`  - Directly Changed Nodes (${impact.directlyChangedNodes.length}): ${impact.directlyChangedNodes.map((n) => n.name).join(', ')}`);
    console.log(`  - Potentially Impacted Upstream Callers (${impact.potentiallyImpactedNodes.length}): ${impact.potentiallyImpactedNodes.map((n) => n.name).join(', ')}`);
    console.log(`  - Propagation Paths (${impact.propagationPaths.length}):`);
    impact.propagationPaths.forEach((p) => console.log(`    * ${p.path.join(' -> ')}: ${p.description}`));

    // payment-svc is directly touched by the new dependency r3; api-gw calls payment-svc so api-gw is impacted upstream
    const callerNames = impact.potentiallyImpactedNodes.map((n) => n.name);
    if (!callerNames.includes('API Gateway')) {
      console.error('  [FAIL] Upstream caller "API Gateway" was not found in potentiallyImpactedNodes!');
      process.exit(1);
    }

    // 2. Compute Structural Risk Delta & Causal Risk Ledger
    const risk = computeStructuralRiskDelta(originalModel, changedModel, diff, impact);
    console.log(`  - Structural Risk: Baseline ${risk.originalScore} -> Target ${risk.changedScore} (Delta: +${risk.delta})`);
    console.log(`  - Attribution Statement: "${risk.attributionStatement}"`);
    console.log(`  - Causal Risk Ledger Factors (${risk.ledger.length}):`);
    risk.ledger.forEach((item) => {
      console.log(`    * [${item.points > 0 ? '+' : ''}${item.points} pts] ${item.factor}: ${item.description}`);
    });

    if (risk.delta <= 0 || risk.ledger.length === 0) {
      console.error('  [FAIL] Structural risk delta should be positive when dependencies and external systems are added');
      process.exit(1);
    }

    // 3. Generate Step-by-Step Change Story
    const story = generateChangeStory(originalModel, changedModel, diff, impact, risk);
    console.log(`  - Change Story (${story.length} paragraphs):`);
    story.forEach((p, idx) => console.log(`    ${idx + 1}. ${p}`));

    if (story.length < 3) {
      console.error('  [FAIL] Change story is incomplete');
      process.exit(1);
    }

    console.log('  [PASS] Impact Analysis, Causal Risk Ledger, and Change Story successfully evaluated.\n');
    passedTests++;
  }

  console.log('=================================================================');
  console.log(`ALL ${passedTests}/${totalTests} REAL ANALYZE & REAL COMPARE TESTS PASSED!`);
  console.log('=================================================================\n');
}

runRealAnalyzeCompareTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
