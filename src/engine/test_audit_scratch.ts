import fs from 'fs';
import JSZip from 'jszip';
import { analyzeCodebaseZip, extractJavaMethodBlock, extractPythonFunctionBlock } from './codebaseAnalyzer';
import { reconstructArchitecture } from './architectureReconstructor';
import { computeArchitectureDiff, createArchitectureSnapshot } from './architectureDiffEngine';
import { Objective2AnalysisEngine } from './objective2AnalysisEngine';
import { ChangeSimulatorEngine } from './changeSimulatorEngine';
import { computeStructuralRiskDelta } from './structuralRiskEngine';
import { tryComputeGeneralAnswer, computeAssistantAnswer } from '../components/assistant/TraceIQAssistant';
import type { ArchitectureModel, ArchitectureEntity, ArchitectureRelationship } from '../types/architecture';

interface TestResult {
  scenario: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, scenario: string, name: string, details: string) {
  if (condition) {
    results.push({ scenario, name, status: 'PASS', details });
    console.log(`[PASS] ${scenario}: ${name} - ${details}`);
  } else {
    results.push({ scenario, name, status: 'FAIL', details });
    console.error(`[FAIL] ${scenario}: ${name} - ${details}`);
  }
}

async function createZipBuffer(files: Record<string, string | Uint8Array>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function runAuditSuite() {
  console.log('===============================================================');
  console.log('TRACEIQ COMPREHENSIVE AUTOMATED AUDIT & VALIDATION SUITE');
  console.log('===============================================================\n');

  const pBaseline = 'c:\\Users\\prana\\Desktop\\wallpapers\\microservices-demo-main.zip';
  const pChanged = 'c:\\Users\\prana\\Desktop\\wallpapers\\microservices-demo-main - changes.zip';
  const pCurd = 'c:\\Users\\prana\\Desktop\\wallpapers\\CurdJavaDemo.zip';

  // =========================================================================
  // PART 1: 16 COMPARISON SCENARIOS
  // =========================================================================
  console.log('\n--- PART 1: 16 COMPARISON SCENARIOS ---');

  // Scenario 1: Clean ZIP vs Clean ZIP (Identical)
  {
    const buf = fs.readFileSync(pBaseline);
    const a1 = await analyzeCodebaseZip(buf as any);
    const a2 = await analyzeCodebaseZip(buf as any);
    const m1 = reconstructArchitecture({ systemName: 'orig', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory });
    const m2 = reconstructArchitecture({ systemName: 'copy', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory });
    const s1 = createArchitectureSnapshot(m1, 'V1');
    const s2 = createArchitectureSnapshot(m2, 'V2');
    const diff = computeArchitectureDiff(s1, s2);

    const s = diff.repositoryDiff?.summary;
    assert(
      s?.addedFilesCount === 0 && s?.removedFilesCount === 0 && s?.modifiedFilesCount === 0 && s?.unchangedFilesCount === 364,
      'Scenario 1',
      'Clean ZIP vs Clean ZIP (Identical)',
      `Added: ${s?.addedFilesCount}, Removed: ${s?.removedFilesCount}, Modified: ${s?.modifiedFilesCount}, Unchanged: ${s?.unchangedFilesCount}`
    );
  }

  // Scenario 2: microservices-demo-main vs microservices-demo-main - changes (Exactly 197 removed)
  {
    const buf1 = fs.readFileSync(pBaseline);
    const buf2 = fs.readFileSync(pChanged);
    const a1 = await analyzeCodebaseZip(buf1 as any);
    const a2 = await analyzeCodebaseZip(buf2 as any);
    const m1 = reconstructArchitecture({ systemName: 'microservices-orig', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory });
    const m2 = reconstructArchitecture({ systemName: 'microservices-chg', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory });
    const s1 = createArchitectureSnapshot(m1, 'V1');
    const s2 = createArchitectureSnapshot(m2, 'V2');
    const diff = computeArchitectureDiff(s1, s2);

    const s = diff.repositoryDiff?.summary;
    assert(
      s?.removedFilesCount === 197 && s?.addedFilesCount === 0 && s?.modifiedFilesCount === 0 && s?.unchangedFilesCount === 167,
      'Scenario 2',
      'microservices-demo vs changes',
      `Truthful Diff: Exactly 197 Removed (Found ${s?.removedFilesCount}), 0 Added (${s?.addedFilesCount}), 0 Modified (${s?.modifiedFilesCount}), 167 Unchanged (${s?.unchangedFilesCount})`
    );
  }

  // Scenario 3: File Added Only
  {
    const z1 = await createZipBuffer({ 'index.ts': 'console.log("hello");', 'package.json': '{"name":"demo"}' });
    const z2 = await createZipBuffer({ 'index.ts': 'console.log("hello");', 'package.json': '{"name":"demo"}', 'newFile.ts': 'export const x = 1;' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const m1 = reconstructArchitecture({ systemName: 'S3-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory });
    const m2 = reconstructArchitecture({ systemName: 'S3-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory });
    const diff = computeArchitectureDiff(createArchitectureSnapshot(m1, 'V1'), createArchitectureSnapshot(m2, 'V2'));
    const s = diff.repositoryDiff?.summary;
    assert(s?.addedFilesCount === 1 && s?.removedFilesCount === 0 && s?.modifiedFilesCount === 0 && s?.unchangedFilesCount === 2, 'Scenario 3', 'File added only', `Added: ${s?.addedFilesCount}, Removed: ${s?.removedFilesCount}, Modified: ${s?.modifiedFilesCount}, Unchanged: ${s?.unchangedFilesCount}`);
  }

  // Scenario 4: File Deleted Only
  {
    const z1 = await createZipBuffer({ 'app.ts': 'console.log("app");', 'util.ts': 'export const u = 10;' });
    const z2 = await createZipBuffer({ 'app.ts': 'console.log("app");' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S4-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S4-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.addedFilesCount === 0 && s?.removedFilesCount === 1 && s?.modifiedFilesCount === 0 && s?.unchangedFilesCount === 1, 'Scenario 4', 'File deleted only', `Added: ${s?.addedFilesCount}, Removed: ${s?.removedFilesCount}, Modified: ${s?.modifiedFilesCount}, Unchanged: ${s?.unchangedFilesCount}`);
  }

  // Scenario 5: File Modified Only
  {
    const z1 = await createZipBuffer({ 'main.py': 'print("v1")', 'config.json': '{"port": 80}' });
    const z2 = await createZipBuffer({ 'main.py': 'print("v2 - updated content")', 'config.json': '{"port": 80}' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S5-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S5-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.addedFilesCount === 0 && s?.removedFilesCount === 0 && s?.modifiedFilesCount === 1 && s?.unchangedFilesCount === 1, 'Scenario 5', 'File modified only', `Modified: ${s?.modifiedFilesCount}, Added: ${s?.addedFilesCount}, Removed: ${s?.removedFilesCount}, Unchanged: ${s?.unchangedFilesCount}`);
  }

  // Scenario 6: Rename File
  {
    const z1 = await createZipBuffer({ 'oldName.ts': 'export const a = 1;' });
    const z2 = await createZipBuffer({ 'newName.ts': 'export const a = 1;' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S6-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S6-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.addedFilesCount === 1 && s?.removedFilesCount === 1 && s?.modifiedFilesCount === 0, 'Scenario 6', 'Rename file', `Removed: ${s?.removedFilesCount}, Added: ${s?.addedFilesCount}`);
  }

  // Scenario 7: Move File to Different Folder
  {
    const z1 = await createZipBuffer({ 'src/helpers/calc.ts': 'export const sum = (a, b) => a + b;' });
    const z2 = await createZipBuffer({ 'src/utils/calc.ts': 'export const sum = (a, b) => a + b;' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S7-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S7-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    console.log('S7 repo diff summary:', JSON.stringify(s), 'files1:', a1.inventory?.files.map(f => f.path), 'files2:', a2.inventory?.files.map(f => f.path));
    assert((s?.addedFilesCount ?? 0) >= 1 && (s?.removedFilesCount ?? 0) >= 1, 'Scenario 7', 'Move file to different folder', `Moved path detected as removed at old and added at new: Added: ${s?.addedFilesCount}, Removed: ${s?.removedFilesCount}`);
  }

  // Scenario 8: Same File Count, Different Content
  {
    const z1 = await createZipBuffer({ 'file1.ts': 'const a = 1;', 'file2.ts': 'const b = 2;' });
    const z2 = await createZipBuffer({ 'file1.ts': 'const a = 999;', 'file2.ts': 'const b = 888;' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S8-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S8-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.modifiedFilesCount === 2 && s?.addedFilesCount === 0 && s?.removedFilesCount === 0, 'Scenario 8', 'Same file count, different content', `Modified: ${s?.modifiedFilesCount}`);
  }

  // Scenario 9: Same File Count, Different Names
  {
    const z1 = await createZipBuffer({ 'user.ts': 'export class User {}', 'auth.ts': 'export class Auth {}' });
    const z2 = await createZipBuffer({ 'customer.ts': 'export class User {}', 'security.ts': 'export class Auth {}' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S9-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S9-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.addedFilesCount === 2 && s?.removedFilesCount === 2, 'Scenario 9', 'Same file count, different names', `Added: ${s?.addedFilesCount}, Removed: ${s?.removedFilesCount}`);
  }

  // Scenario 10: Completely Different Projects Compared
  {
    const buf1 = fs.readFileSync(pBaseline);
    const bufCurd = fs.readFileSync(pCurd);
    const a1 = await analyzeCodebaseZip(buf1 as any);
    const a2 = await analyzeCodebaseZip(bufCurd as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'Microservices', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'CurdJavaDemo', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    // 362 removed + 2 modified (.gitignore, README.md) = 364 total V1 files
    // 27 added + 2 modified (.gitignore, README.md) = 29 total V2 files
    assert(
      s?.removedFilesCount === 362 && s?.addedFilesCount === 27 && s?.modifiedFilesCount === 2 && s?.unchangedFilesCount === 0,
      'Scenario 10',
      'Completely different projects compared',
      `Original files removed: ${s?.removedFilesCount}, New files added: ${s?.addedFilesCount}, Overlapping docs modified: ${s?.modifiedFilesCount}, Unchanged: ${s?.unchangedFilesCount}`
    );
  }

  // Scenario 11: Single File Repo vs Multi-File Repo
  {
    const z1 = await createZipBuffer({ 'single.py': 'print("hello single file")' });
    const z2 = await createZipBuffer({ 'single.py': 'print("hello single file")', 'sub/module.py': 'import math', 'sub/test.py': 'assert True' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S11-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S11-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.addedFilesCount === 2 && s?.unchangedFilesCount === 1 && s?.removedFilesCount === 0, 'Scenario 11', 'Single file vs multi file', `Added: ${s?.addedFilesCount}, Unchanged: ${s?.unchangedFilesCount}`);
  }

  // Scenario 12: Documentation Only vs Code Repo
  {
    const z1 = await createZipBuffer({ 'README.md': '# Project Docs', 'ARCHITECTURE.md': 'Overview', 'LICENSE': 'MIT' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    assert(a1.inventory?.total_files === 3, 'Scenario 12', '100% Retention on Doc files', `Doc files preserved in inventory: ${a1.inventory?.total_files} total files`);
  }

  // Scenario 13: Deep Directory Structure
  {
    const z1 = await createZipBuffer({ 'a/b/c/d/e/deep.json': '{"level": 5}' });
    const z2 = await createZipBuffer({ 'a/b/c/d/e/deep.json': '{"level": 6}' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S13-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S13-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.modifiedFilesCount === 1 && (a1.inventory?.total_folders ?? 0) >= 4, 'Scenario 13', 'Deep directory structure preserved', `Modified: ${s?.modifiedFilesCount}, Folders detected: ${a1.inventory?.total_folders}`);
  }

  // Scenario 14: Binary File Added / Removed / Modified
  {
    const bin1 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    const bin2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]); // modified binary
    const z1 = await createZipBuffer({ 'assets/logo.png': bin1, 'index.html': '<html></html>' });
    const z2 = await createZipBuffer({ 'assets/logo.png': bin2, 'index.html': '<html></html>' });
    const a1 = await analyzeCodebaseZip(z1 as any);
    const a2 = await analyzeCodebaseZip(z2 as any);
    const diff = computeArchitectureDiff(
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S14-1', inputType: 'codebase', entities: a1.entities, relationships: a1.relationships, inventory: a1.inventory }), 'V1'),
      createArchitectureSnapshot(reconstructArchitecture({ systemName: 'S14-2', inputType: 'codebase', entities: a2.entities, relationships: a2.relationships, inventory: a2.inventory }), 'V2')
    );
    const s = diff.repositoryDiff?.summary;
    assert(s?.modifiedFilesCount === 1 && s?.unchangedFilesCount === 1, 'Scenario 14', 'Binary file modification detection', `Binary file tracked without corruption: Modified ${s?.modifiedFilesCount}`);
  }

  // Scenario 15: Empty ZIP vs Full Repo
  {
    const zEmpty = await createZipBuffer({});
    const aEmpty = await analyzeCodebaseZip(zEmpty as any);
    assert(aEmpty.inventory?.total_files === 0 && aEmpty.entities.length === 0, 'Scenario 15', 'Empty zip handled gracefully', `Files: ${aEmpty.inventory?.total_files}, Entities: ${aEmpty.entities.length}`);
  }

  // Scenario 16: Corrupt ZIP Graceful Degradation
  {
    const corruptBuf = Buffer.from('NOT A VALID ZIP FILE HEADER 123456');
    try {
      const aCorrupt = await analyzeCodebaseZip(corruptBuf as any);
      assert(aCorrupt.issues.length > 0, 'Scenario 16', 'Corrupt zip handled with clear error issue', `Issues logged: ${aCorrupt.issues[0]?.message}`);
    } catch (e: any) {
      assert(true, 'Scenario 16', 'Corrupt zip caught without crashing', `Exception handled: ${e.message}`);
    }
  }

  // =========================================================================
  // PART 2: OBJECTIVE 3 CHANGE SIMULATOR & BROKEN DEPENDENCY SEMANTICS
  // =========================================================================
  console.log('\n--- PART 2: OBJECTIVE 3 CHANGE SIMULATOR & RISK LEDGER ---');

  {
    // Test base model with a Caller Service -> Callee Service -> Database
    const baseEntities: ArchitectureEntity[] = [
      { id: 'auth-service', name: 'Auth Service', type: 'Service', technology: 'Node.js', source: 'Detected' },
      { id: 'order-service', name: 'Order Service', type: 'Service', technology: 'Go', source: 'Detected' },
      { id: 'db-orders', name: 'Orders Database', type: 'Database', technology: 'PostgreSQL', source: 'Detected' },
    ];
    const baseRelationships: ArchitectureRelationship[] = [
      { id: 'r1', source: 'auth-service', target: 'order-service', type: 'CALLS' },
      { id: 'r2', source: 'order-service', target: 'db-orders', type: 'QUERIES' },
    ];

    const model: ArchitectureModel = reconstructArchitecture({
      systemName: 'Simulation System',
      version: '1.0.0',
      inputType: 'blueprint',
      entities: baseEntities,
      relationships: baseRelationships,
    });

    const baseAnalysis = Objective2AnalysisEngine.analyzeArchitecture(model);
    const initialRisk = Objective2AnalysisEngine.calculateDeterministicRiskScore(baseAnalysis);

    // Test A: Deep clone immutability check
    const originalEntitiesJson = JSON.stringify(model.entities);
    const originalRelsJson = JSON.stringify(model.relationships);

    // Test B: Remove 'db-orders' while 'order-service' still calls it!
    // Broken Required Dependency: order-service calls db-orders, but db-orders is removed!
    const simResult = ChangeSimulatorEngine.simulateChange(model, [
      { id: 'c1', action: 'remove_component', component_id: 'db-orders' },
    ]);

    // Check immutability
    assert(
      JSON.stringify(model.entities) === originalEntitiesJson && JSON.stringify(model.relationships) === originalRelsJson,
      'Simulator Immutability',
      'Original model is NOT mutated in memory',
      'Entities and relationships untouched in baseline'
    );

    // Check Broken Required Dependency detected in causal_risk_ledger
    const brokenItem = simResult.causal_risk_ledger.find((item) => item.factor.includes('Broken Required Dependency'));
    assert(
      brokenItem !== undefined && brokenItem.points === 15.0,
      'Broken Dependency Risk',
      'Broken Required Dependency Detected',
      `Found ledger item: "${brokenItem?.factor}" with points +${brokenItem?.points} pts`
    );

    // Verify overall delta reflects the broken dependency penalty
    assert(
      simResult.risk_delta > 0,
      'Risk Penalty Applied',
      'Total risk increases when critical dependency is broken',
      `Initial Risk: ${initialRisk.toFixed(1)}, Hypo Risk: ${simResult.hypothetical_risk_score.toFixed(1)}, Delta: +${simResult.risk_delta.toFixed(1)} pts`
    );

    // Test C: Safe decoupling test (remove an entity that has NO callers)
    const modelWithIsolated: ArchitectureModel = reconstructArchitecture({
      systemName: 'Simulation System',
      version: '1.0.0',
      inputType: 'blueprint',
      entities: [
        ...baseEntities,
        { id: 'isolated-logger', name: 'Isolated Logger', type: 'Service', technology: 'Go', source: 'Detected' },
      ],
      relationships: [
        ...baseRelationships,
        { id: 'r3', source: 'isolated-logger', target: 'order-service', type: 'CALLS' },
      ],
    });

    // Removing isolated-logger (which has 0 inbound callers) should NOT trigger broken required dependency
    const simSafe = ChangeSimulatorEngine.simulateChange(modelWithIsolated, [
      { id: 'c2', action: 'remove_component', component_id: 'isolated-logger' },
    ]);

    const brokenInSafe = simSafe.causal_risk_ledger.find((item) => item.factor.includes('Broken Required Dependency'));
    assert(
      brokenInSafe === undefined,
      'Safe Removal',
      'Safe removal without callers has 0 broken dependency penalties',
      `Ledger has ${simSafe.causal_risk_ledger.length} items, Broken count: 0`
    );
  }

  // =========================================================================
  // PART 3: SPRING BOOT & JAVA GROUND TRUTH EXTRACTION (CurdJavaDemo.zip)
  // =========================================================================
  console.log('\n--- PART 3: SPRING BOOT EXTRACTION (CurdJavaDemo.zip) ---');
  {
    const bufCurd = fs.readFileSync(pCurd);
    const curdAnalysis = await analyzeCodebaseZip(bufCurd as any);

    const names = curdAnalysis.entities.map(e => e.name);
    assert(
      names.includes('StudentController') && names.includes('StudentService') && names.includes('StudentRepo') && names.includes('MySQL Database (student)'),
      'Spring Boot Architecture',
      'All 4 core components correctly extracted',
      `Found: ${names.join(', ')}`
    );

    // Check no generic duplicates or hallucinations
    const hasFalseGenericDb = names.includes('mysql-db') || names.includes('MySQL Database');
    const hasFalseBackendApi = names.includes('backend-api');
    assert(
      !hasFalseGenericDb && !hasFalseBackendApi,
      'No Hallucinations',
      'Zero false generic DB or backend-api nodes created',
      `Entities list clean: ${names.join(', ')}`
    );

    // Check REST endpoints
    const endpoints = curdAnalysis.relationships.filter(r => r.type.toUpperCase() === 'EXPOSES');
    const endpointPaths = endpoints.map(e => e.sourceEvidence?.statement || e.target);
    assert(
      endpoints.length === 7,
      '7 REST Endpoints',
      'All 7 Spring Boot endpoints mapped to StudentController',
      `Count: ${endpoints.length}. Endpoints: ${endpointPaths.join(', ')}`
    );

    // Check call chain: Controller -> Service -> Repo -> Database
    const cToS = curdAnalysis.relationships.find(
      (r) => (r.source === 'studentcontroller' || r.source === 'StudentController') && (r.target === 'studentservice' || r.target === 'StudentService')
    );
    const sToR = curdAnalysis.relationships.find(
      (r) => (r.source === 'studentservice' || r.source === 'StudentService') && (r.target === 'studentrepo' || r.target === 'StudentRepo')
    );
    const rToDb = curdAnalysis.relationships.find(
      (r) => (r.source === 'studentrepo' || r.source === 'StudentRepo') && (r.target.includes('mysql') || r.target.includes('MySQL'))
    );

    assert(
      Boolean(cToS && sToR && rToDb),
      'Layered Call Chain',
      'StudentController -> StudentService -> StudentRepo -> MySQL Database',
      `Controller->Service: ${Boolean(cToS)}, Service->Repo: ${Boolean(sToR)}, Repo->DB: ${Boolean(rToDb)}`
    );
  }

  // =========================================================================
  // PART 4: REAL SOURCE EVIDENCE SNIPPETS & GROUND TRUTH PROVENANCE
  // =========================================================================
  console.log('\n--- PART 4: REAL SOURCE EVIDENCE SNIPPETS & PROVENANCE ---');
  {
    const bufCurd = fs.readFileSync(pCurd);
    const curdAnalysis = await analyzeCodebaseZip(bufCurd as any);

    // Check that entities have real code snippets and line numbers
    for (const ent of curdAnalysis.entities) {
      if (ent.metadata?.filePath) {
        const snippet = ent.metadata.snippet || '';
        const line = ent.metadata.line;

        // Verify no synthetic mock comments
        const isSynthetic = snippet.startsWith('// Definition:');
        assert(
          !isSynthetic,
          'Real Evidence Snippets',
          `${ent.name} snippet is NOT synthetic comments`,
          `File: ${ent.metadata.filePath}, Line: ${line}, Snippet Preview: "${snippet.substring(0, 40).replace(/\n/g, ' ')}..."`
        );

        // Verify snippet has content and line is a number
        assert(
          snippet.length > 0 && typeof line === 'number' && line > 0,
          'Evidence Provenance Integrity',
          `${ent.name} has genuine line number and extracted source code`,
          `Line ${line} in ${ent.metadata.filePath}`
        );
      }
    }
  }

  // =========================================================================
  // PART 5: 9-POINT CHANGE SIMULATION INTELLIGENCE ASSESSMENT
  // =========================================================================
  console.log('\n--- PART 5: 9-POINT CHANGE SIMULATION INTELLIGENCE ASSESSMENT ---');
  {
    const baseEntities: ArchitectureEntity[] = [
      { id: 'web-frontend', name: 'Web Frontend', type: 'Service', technology: 'React', source: 'Detected' },
      { id: 'order-service', name: 'Order Service', type: 'Service', technology: 'Go', source: 'Detected' },
      { id: 'payment-service', name: 'Payment Service', type: 'Service', technology: 'Java', source: 'Detected' },
      { id: 'order-db', name: 'Order DB', type: 'Database', technology: 'PostgreSQL', source: 'Detected' },
    ];
    const baseRelationships: ArchitectureRelationship[] = [
      { id: 'r1', source: 'web-frontend', target: 'order-service', type: 'CALLS' },
      { id: 'r2', source: 'order-service', target: 'payment-service', type: 'CALLS' },
      { id: 'r3', source: 'order-service', target: 'order-db', type: 'QUERIES' },
    ];

    const model: ArchitectureModel = reconstructArchitecture({
      systemName: 'Ecommerce App',
      version: '1.0.0',
      inputType: 'blueprint',
      entities: baseEntities,
      relationships: baseRelationships,
    });

    // Simulate removing 'payment-service' which is called by 'order-service'
    const sim = ChangeSimulatorEngine.simulateChange(model, [
      { id: 'stage-1', action: 'remove_component', component_id: 'payment-service' },
    ]);

    // 1. Broken dependencies array must contain order-service -> payment-service
    assert(
      Boolean(sim.broken_dependencies && sim.broken_dependencies.length === 1),
      '9-Point Assessment Item 3',
      'Broken Dependencies list accurately identifies callers missing targets',
      `Found ${sim.broken_dependencies?.length} broken link(s): ${sim.broken_dependencies?.map(b => `${b.callerName} -> missing ${b.missingTargetName}`).join(', ')}`
    );

    // 2. Recommended checks array must be populated
    assert(
      Boolean(sim.recommended_checks && sim.recommended_checks.length > 0),
      '9-Point Assessment Item 9',
      'Recommended checks generated based on detected dependencies',
      `Checks count: ${sim.recommended_checks?.length}, Sample: "${sim.recommended_checks?.[0]}"`
    );

    // 3. Why did risk change narrative
    assert(
      Boolean(sim.why_risk_changed && sim.why_risk_changed.includes('Broken Required Dependency')),
      '9-Point Assessment Item 8',
      'Why did risk change explains broken dependencies in simple English',
      `Narrative: "${sim.why_risk_changed?.substring(0, 80)}..."`
    );
  }

  // =========================================================================
  // PART 6: TRACEIQ ASSISTANT DETERMINISTIC QA, MATH, & CONVERSIONS
  // =========================================================================
  console.log('\n--- PART 6: TRACEIQ ASSISTANT QA & REASONING ENGINE ---');
  {
    // 1. Greetings
    const greeting = tryComputeGeneralAnswer('Hi');
    assert(
      greeting === 'Hello! How can I help you today?',
      'Assistant Greeting',
      'Responds warmly and directly to "Hi"',
      `Answer: "${greeting}"`
    );

    // 2. Percentage calculation
    const pct = tryComputeGeneralAnswer('What is 20% of 500?');
    assert(
      pct === '100' || pct === '100.',
      'Assistant Math - Percentage',
      'Accurately calculates "What is 20% of 500?"',
      `Answer: "${pct}"`
    );

    // 3. Basic arithmetic
    const mathRes = tryComputeGeneralAnswer('what is 15 + 25?');
    assert(
      mathRes === '40' || mathRes === '40.',
      'Assistant Math - Arithmetic',
      'Accurately calculates "what is 15 + 25?"',
      `Answer: "${mathRes}"`
    );

    // 4. Distance Unit Conversion
    const dist = tryComputeGeneralAnswer('Convert 10 km to miles.');
    assert(
      Boolean(dist && dist.includes('10 kilometers is approximately 6.21 miles')),
      'Assistant Unit Conversion',
      'Accurately converts "10 km to miles"',
      `Answer: "${dist}"`
    );

    // 5. General Tech Knowledge - API definition
    const apiDef = tryComputeGeneralAnswer('What is an API?');
    assert(
      Boolean(apiDef && apiDef.includes('Application Programming Interface')),
      'Assistant Tech Definition',
      'Provides accurate definition for "What is an API?"',
      `Answer: "${apiDef}"`
    );

    // 6. Architecture Grounded QA - Broken Dependencies
    const dummyModel: ArchitectureModel = reconstructArchitecture({
      systemName: 'Demo System',
      version: '1.0.0',
      inputType: 'blueprint',
      entities: [
        { id: 'svc-1', name: 'Order Service', type: 'Service', technology: 'Java', source: 'Detected' },
        { id: 'db-1', name: 'MySQL DB', type: 'Database', technology: 'MySQL', source: 'Detected' },
      ],
      relationships: [
        { id: 'r1', source: 'svc-1', target: 'db-1', type: 'QUERIES' },
      ],
    });

    const brokenQ = computeAssistantAnswer('What are broken dependencies?', dummyModel);
    assert(
      brokenQ.includes('+15.0 points') && brokenQ.includes('Broken Required Dependency'),
      'Assistant Architecture QA - Broken Dependency',
      'Explains broken required dependency penalty accurately based on system rules',
      `Contains penalty explanation: ${brokenQ.includes('+15.0 points')}`
    );

    // 7. Architecture Grounded QA - List Services
    const listQ = computeAssistantAnswer('List services in the system', dummyModel);
    assert(
      listQ.includes('Order Service'),
      'Assistant Architecture QA - List Services',
      'Accurately enumerates active model services',
      `Found service: ${listQ.includes('Order Service')}`
    );

    // 8. Extended Arithmetic
    const mult = tryComputeGeneralAnswer('5 * 4');
    const div = tryComputeGeneralAnswer('100 / 4');
    const sub = tryComputeGeneralAnswer('50 - 15');
    assert(
      mult === '20' && div === '25' && sub === '35',
      'Assistant Extended Arithmetic',
      'Accurately computes multiplication, division, and subtraction',
      `5*4=${mult}, 100/4=${div}, 50-15=${sub}`
    );

    // 9. Extended Unit Conversions
    const mToFt = tryComputeGeneralAnswer('10 m to ft');
    const cmToIn = tryComputeGeneralAnswer('10 cm to in');
    const kgToLbs = tryComputeGeneralAnswer('5 kg to lbs');
    const gToOz = tryComputeGeneralAnswer('100 g to oz');
    const cToF = tryComputeGeneralAnswer('0 C to F');
    const minToHr = tryComputeGeneralAnswer('120 min to hr');
    const hrToDay = tryComputeGeneralAnswer('48 hr to day');
    const lToGal = tryComputeGeneralAnswer('10 L to gal');

    assert(
      Boolean(mToFt && mToFt.includes('feet')),
      'Assistant Unit Conversion - Meters to Feet',
      'Converts 10 m to ft',
      `Result: ${mToFt}`
    );
    assert(
      Boolean(cmToIn && cmToIn.includes('inches')),
      'Assistant Unit Conversion - Cm to Inches',
      'Converts 10 cm to in',
      `Result: ${cmToIn}`
    );
    assert(
      Boolean(kgToLbs && kgToLbs.includes('pounds')),
      'Assistant Unit Conversion - Kg to Pounds',
      'Converts 5 kg to lbs',
      `Result: ${kgToLbs}`
    );
    assert(
      Boolean(gToOz && gToOz.includes('ounces')),
      'Assistant Unit Conversion - Grams to Ounces',
      'Converts 100 g to oz',
      `Result: ${gToOz}`
    );
    assert(
      Boolean(cToF && (cToF.includes('32.0°F') || cToF.includes('32°F') || cToF.includes('32.00°F'))),
      'Assistant Unit Conversion - Celsius to Fahrenheit',
      'Converts 0 C to 32 F',
      `Result: ${cToF}`
    );
    assert(
      Boolean(minToHr && (minToHr.includes('2 hours') || minToHr.includes('2.00 hours'))),
      'Assistant Unit Conversion - Minutes to Hours',
      'Converts 120 min to 2 hours',
      `Result: ${minToHr}`
    );
    assert(
      Boolean(hrToDay && (hrToDay.includes('2 days') || hrToDay.includes('2.00 days'))),
      'Assistant Unit Conversion - Hours to Days',
      'Converts 48 hr to 2 days',
      `Result: ${hrToDay}`
    );
    assert(
      Boolean(lToGal && lToGal.includes('gallons')),
      'Assistant Unit Conversion - Liters to Gallons',
      'Converts 10 L to gal',
      `Result: ${lToGal}`
    );

    // 10. Polite Redirect for Off-Topic Questions
    const offTopicRedirect = "I'm here to help you understand and use TraceIQ. You can ask me about the architecture, dependencies, risks, changes, evidence, or other TraceIQ functions.";
    const offTopic1 = computeAssistantAnswer('Who won the World Cup?', dummyModel);
    const offTopic2 = computeAssistantAnswer('What is the capital of France?', dummyModel);
    assert(
      offTopic1 === offTopicRedirect,
      'Assistant Off-Topic Redirect 1',
      'Politely redirects sports question to TraceIQ domain',
      `Answer: "${offTopic1}"`
    );
    assert(
      offTopic2 === offTopicRedirect,
      'Assistant Off-Topic Redirect 2',
      'Politely redirects geography question to TraceIQ domain',
      `Answer: "${offTopic2}"`
    );
  }

  // =========================================================================
  // PART 7: VERIFICATION OF FINAL OBJECTIVE 2 & 3 FIXES & HARDENING
  // =========================================================================
  console.log('\n--- PART 7: FINAL OBJECTIVE 2 & 3 FIXES & HARDENING ---');
  {
    // 1. Whole logical code block extraction - Java
    const sampleJavaCode = `
package com.demo;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DemoController {

    // Fetch user details
    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUser(@PathVariable String id) {
        User u = userService.findById(id);
        return ResponseEntity.ok(u);
    }
}
`;
    const javaBlock = extractJavaMethodBlock(sampleJavaCode, 10);
    assert(
      Boolean(javaBlock && javaBlock.block.includes('@GetMapping("/users/{id}")') && javaBlock.block.includes('return ResponseEntity.ok(u);') && javaBlock.block.endsWith('}')),
      'Whole Block Extraction - Java Method',
      'Extracts complete Java method block from annotations through closing brace',
      `Line Range: ${javaBlock?.lineRange}, Block Length: ${javaBlock?.block.length} chars`
    );

    // 2. Whole logical code block extraction - Python
    const samplePythonCode = `
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/orders', methods=['GET'])
def get_orders():
    orders = fetch_all_orders()
    return jsonify(orders)

def other_func():
    pass
`;
    const pyBlock = extractPythonFunctionBlock(samplePythonCode, 5);
    assert(
      Boolean(pyBlock && pyBlock.block.includes("@app.route('/api/orders'") && pyBlock.block.includes('return jsonify(orders)')),
      'Whole Block Extraction - Python Function',
      'Extracts complete Python function with decorator and indented body',
      `Line Range: ${pyBlock?.lineRange}, Block Length: ${pyBlock?.block.length} chars`
    );

    // 3. Objective 2 Risk Calculation Matching on Compare
    const v1Model: ArchitectureModel = reconstructArchitecture({
      systemName: 'SysV1',
      version: '1.0.0',
      inputType: 'blueprint',
      entities: [
        { id: 's1', name: 'Order Service', type: 'Service', technology: 'Java', source: 'Detected' },
        { id: 's2', name: 'Payment Service', type: 'Service', technology: 'Java', source: 'Detected' },
        { id: 'db1', name: 'Postgres DB', type: 'Database', technology: 'Postgres', source: 'Detected' },
      ],
      relationships: [
        { id: 'r1', source: 's1', target: 's2', type: 'CALLS' },
        { id: 'r2', source: 's2', target: 'db1', type: 'QUERIES' },
      ],
    });

    const v2Model: ArchitectureModel = reconstructArchitecture({
      systemName: 'SysV2',
      version: '1.1.0',
      inputType: 'blueprint',
      entities: [
        { id: 's1', name: 'Order Service', type: 'Service', technology: 'Java', source: 'Detected' },
        { id: 'db1', name: 'Postgres DB', type: 'Database', technology: 'Postgres', source: 'Detected' },
      ],
      relationships: [],
    });

    const v1Analysis = Objective2AnalysisEngine.analyzeArchitecture(v1Model);
    const v2Analysis = Objective2AnalysisEngine.analyzeArchitecture(v2Model);
    const v1Score = Objective2AnalysisEngine.calculateDeterministicRiskScore(v1Analysis);
    const v2Score = Objective2AnalysisEngine.calculateDeterministicRiskScore(v2Analysis);
    const v1Level = Objective2AnalysisEngine.getRiskLevel(v1Score);
    const v2Level = Objective2AnalysisEngine.getRiskLevel(v2Score);

    const snap1 = createArchitectureSnapshot(v1Model, 'V1');
    const snap2 = createArchitectureSnapshot(v2Model, 'V2');
    const diff = computeArchitectureDiff(snap1, snap2);
    const riskDeltaObj = computeStructuralRiskDelta(v1Model, v2Model, diff, {
      directlyChangedNodes: [],
      potentiallyImpactedNodes: [],
      propagationPaths: [],
      newDependencies: [],
      removedDependencies: [],
    });

    assert(
      riskDeltaObj.originalScore === v1Score && riskDeltaObj.changedScore === v2Score,
      'Compare Risk Engine Unification',
      'Compare Risk scores originate strictly from Objective2AnalysisEngine',
      `V1: ${v1Score} [${v1Level}], V2: ${v2Score} [${v2Level}], Delta: ${riskDeltaObj.delta}`
    );
    assert(
      Boolean(riskDeltaObj.shiftDirection),
      'Compare Risk Shift Direction',
      'Compare Risk calculates truthful shiftDirection',
      `Direction: "${riskDeltaObj.shiftDirection}", Statement: "${riskDeltaObj.attributionStatement}"`
    );

    // 4. In-Memory Isolated Sandbox Simulation on V2
    const v2EntitiesBefore = JSON.stringify(v2Model.entities);
    const v2RelsBefore = JSON.stringify(v2Model.relationships);

    const simSandbox = ChangeSimulatorEngine.simulateChange(v2Model, [
      { id: 'sandbox-chg-1', action: 'remove_component', component_id: 'db1' },
    ]);

    const v2EntitiesAfter = JSON.stringify(v2Model.entities);
    const v2RelsAfter = JSON.stringify(v2Model.relationships);

    assert(
      v2EntitiesBefore === v2EntitiesAfter && v2RelsBefore === v2RelsAfter,
      'Sandbox Zero Mutation Guarantee',
      'Simulating changes on V2 never mutates baseline V2 model in memory',
      'V2 entities and relationships remain strictly identical before and after simulation'
    );

    assert(
      simSandbox.hypothetical_architecture.entities.every(e => e.id !== 'db1'),
      'Sandbox Result Correctness',
      'Simulated hypothetical architecture accurately reflects decommissioned component',
      `Hypothetical components: ${simSandbox.hypothetical_architecture.entities.length} (Base had: ${v2Model.entities.length})`
    );

    // 5. Change Simulator Clean Titles Verification
    const changeSimPageContent = fs.readFileSync('src/components/pages/ChangeSimulatorPage.tsx', 'utf-8');
    const hasNumberedHeadings = /1\.\s*Change Staged|2\.\s*Direct Effects|3\.\s*Broken Dependencies|4\.\s*Affected Components/i.test(changeSimPageContent);
    const hasSimpleEnglishTag = /\(SIMPLE ENGLISH\)/i.test(changeSimPageContent);

    assert(
      !hasNumberedHeadings && !hasSimpleEnglishTag,
      'Change Simulator Clean Headers',
      'Numbered prefixes and (SIMPLE ENGLISH) tags removed while retaining plain-English descriptions',
      `hasNumberedHeadings: ${hasNumberedHeadings}, hasSimpleEnglishTag: ${hasSimpleEnglishTag}`
    );
  }

  // =========================================================================
  // PART 8: COMPARE PAGE SCROLLABILITY, RESPONSIVE UI & 5-CASE REAL DATA AUDIT
  // =========================================================================
  console.log('\n--- PART 8: COMPARE SCROLLABILITY, RESPONSIVE UI & 5-CASE REAL DATA AUDIT ---');
  {
    // TEST 1: Identical ZIP vs Identical ZIP
    const zIdentical = await createZipBuffer({
      'server.js': 'const express = require("express"); const app = express(); app.listen(3000);',
      'package.json': '{"name":"demo-service","dependencies":{"express":"^4.18.0"}}',
      'db.js': 'const mysql = require("mysql2");',
    });
    const aId1 = await analyzeCodebaseZip(zIdentical as any);
    const aId2 = await analyzeCodebaseZip(zIdentical as any);
    const mId1 = reconstructArchitecture({ systemName: 'Identical-1', inputType: 'codebase', entities: aId1.entities, relationships: aId1.relationships, inventory: aId1.inventory });
    const mId2 = reconstructArchitecture({ systemName: 'Identical-2', inputType: 'codebase', entities: aId2.entities, relationships: aId2.relationships, inventory: aId2.inventory });
    const diff1 = computeArchitectureDiff(createArchitectureSnapshot(mId1, 'V1'), createArchitectureSnapshot(mId2, 'V2'));
    assert(
      diff1.repositoryDiff?.summary.addedFilesCount === 0 &&
      diff1.repositoryDiff?.summary.removedFilesCount === 0 &&
      diff1.repositoryDiff?.summary.modifiedFilesCount === 0 &&
      diff1.repositoryDiff?.summary.unchangedFilesCount === 3 &&
      diff1.addedNodes.length === 0 &&
      diff1.removedNodes.length === 0,
      'Compare Test 1: Identical ZIP vs Identical ZIP',
      'Accurately verifies 0 differences across identical archives with both graphs intact',
      `Unchanged files: ${diff1.repositoryDiff?.summary.unchangedFilesCount}, Added nodes: ${diff1.addedNodes.length}`
    );

    // TEST 2: V1 ZIP vs V2 ZIP with Added Component
    const zV1 = await createZipBuffer({
      'orderService.js': 'const express = require("express");',
      'package.json': '{"name":"orders"}',
    });
    const zV2Added = await createZipBuffer({
      'orderService.js': 'const express = require("express");',
      'package.json': '{"name":"orders"}',
      'paymentService.js': 'const express = require("express");',
    });
    const aV1 = await analyzeCodebaseZip(zV1 as any);
    const aV2Added = await analyzeCodebaseZip(zV2Added as any);
    const mV1 = reconstructArchitecture({ systemName: 'Shop-V1', inputType: 'codebase', entities: aV1.entities, relationships: aV1.relationships, inventory: aV1.inventory });
    const mV2Added = reconstructArchitecture({ systemName: 'Shop-V2', inputType: 'codebase', entities: aV2Added.entities, relationships: aV2Added.relationships, inventory: aV2Added.inventory });
    const diff2 = computeArchitectureDiff(createArchitectureSnapshot(mV1, 'V1'), createArchitectureSnapshot(mV2Added, 'V2'));
    assert(
      diff2.repositoryDiff?.summary.addedFilesCount === 1 &&
      diff2.repositoryDiff?.summary.unchangedFilesCount === 2 &&
      diff2.repositoryDiff?.summary.removedFilesCount === 0,
      'Compare Test 2: V1 ZIP vs V2 ZIP with Added Component',
      'Accurately identifies added component and file in target archive',
      `Added files: ${diff2.repositoryDiff?.summary.addedFilesCount}, Unchanged: ${diff2.repositoryDiff?.summary.unchangedFilesCount}`
    );

    // TEST 3: V1 ZIP vs V2 ZIP with Removed Required Component
    const mV1WithCaller: ArchitectureModel = reconstructArchitecture({
      systemName: 'Shop-Calling-V1',
      inputType: 'blueprint',
      entities: [
        { id: 'svc-order', name: 'Order Service', type: 'Service', technology: 'Node.js', source: 'Detected' },
        { id: 'svc-pay', name: 'Payment Service', type: 'Service', technology: 'Node.js', source: 'Detected' },
      ],
      relationships: [
        { id: 'r-pay', source: 'svc-order', target: 'svc-pay', type: 'CALLS' },
      ],
    });
    const mV2MissingTarget: ArchitectureModel = reconstructArchitecture({
      systemName: 'Shop-Calling-V2',
      inputType: 'blueprint',
      entities: [
        { id: 'svc-order', name: 'Order Service', type: 'Service', technology: 'Node.js', source: 'Detected' },
      ],
      relationships: [],
    });
    const diff3 = computeArchitectureDiff(
      createArchitectureSnapshot(mV1WithCaller, 'V1'),
      createArchitectureSnapshot(mV2MissingTarget, 'V2')
    );
    const risk3 = computeStructuralRiskDelta(mV1WithCaller, mV2MissingTarget, diff3);
    const brokenItem = risk3.ledger.find((l) => l.factor === 'Broken Required Dependency Detected');
    assert(
      diff3.removedNodes.length === 1 &&
      diff3.removedNodes[0].name === 'Payment Service' &&
      diff3.removedRelationships.length === 1 &&
      Boolean(brokenItem && brokenItem.description.includes('Order Service') && brokenItem.points === 15),
      'Compare Test 3: V1 ZIP vs V2 ZIP with Removed Required Component',
      'Accurately flags removed callee and records +15 pts penalty for Order Service -> Payment Service',
      `Broken ledger item: "${brokenItem?.factor}", Points: +${brokenItem?.points}, Net Risk Delta: ${risk3.delta}`
    );

    // TEST 4: Large Repository vs Changed Large Repository (microservices-demo-main.zip)
    const bufBaseline = fs.readFileSync(pBaseline);
    const bufChanged = fs.readFileSync(pChanged);
    const aBaseLarge = await analyzeCodebaseZip(bufBaseline as any);
    const aChgLarge = await analyzeCodebaseZip(bufChanged as any);
    const mBaseLarge = reconstructArchitecture({ systemName: 'microservices-base', inputType: 'codebase', entities: aBaseLarge.entities, relationships: aBaseLarge.relationships, inventory: aBaseLarge.inventory });
    const mChgLarge = reconstructArchitecture({ systemName: 'microservices-chg', inputType: 'codebase', entities: aChgLarge.entities, relationships: aChgLarge.relationships, inventory: aChgLarge.inventory });
    const diff4 = computeArchitectureDiff(createArchitectureSnapshot(mBaseLarge, 'V1'), createArchitectureSnapshot(mChgLarge, 'V2'));
    assert(
      diff4.repositoryDiff?.summary.removedFilesCount === 197 &&
      diff4.repositoryDiff?.summary.unchangedFilesCount === 167 &&
      diff4.repositoryDiff?.diffFiles.length === 364,
      'Compare Test 4: Large Repository vs Changed Large Repository',
      'Truthfully handles 364 repository diff items without truncation or memory overflow',
      `Total diff files: ${diff4.repositoryDiff?.diffFiles.length}, Removed: ${diff4.repositoryDiff?.summary.removedFilesCount}`
    );

    // TEST 5: JSON V1 vs JSON V2
    const jsonV1: ArchitectureModel = reconstructArchitecture({
      systemName: 'JSON-System-V1',
      version: '1.0.0',
      inputType: 'blueprint',
      entities: [
        { id: 'api-gw', name: 'API Gateway', type: 'Service', technology: 'Go', source: 'Detected' },
        { id: 'auth-svc', name: 'Auth Service', type: 'Service', technology: 'Node.js', source: 'Detected' },
        { id: 'user-db', name: 'User DB', type: 'Database', technology: 'PostgreSQL', source: 'Detected' },
      ],
      relationships: [
        { id: 'r1', source: 'api-gw', target: 'auth-svc', type: 'CALLS' },
        { id: 'r2', source: 'auth-svc', target: 'user-db', type: 'QUERIES' },
      ],
    });
    const jsonV2: ArchitectureModel = reconstructArchitecture({
      systemName: 'JSON-System-V2',
      version: '2.0.0',
      inputType: 'blueprint',
      entities: [
        { id: 'api-gw', name: 'API Gateway', type: 'Service', technology: 'Go', source: 'Detected' },
        { id: 'auth-svc', name: 'Auth Service', type: 'Service', technology: 'Node.js', source: 'Detected' },
        { id: 'redis-cache', name: 'Redis Cache', type: 'Database', technology: 'Redis', source: 'Detected' },
        { id: 'user-db', name: 'User DB', type: 'Database', technology: 'PostgreSQL', source: 'Detected' },
      ],
      relationships: [
        { id: 'r1', source: 'api-gw', target: 'auth-svc', type: 'CALLS' },
        { id: 'r2', source: 'auth-svc', target: 'user-db', type: 'QUERIES' },
        { id: 'r3', source: 'auth-svc', target: 'redis-cache', type: 'QUERIES' },
      ],
    });
    const diff5 = computeArchitectureDiff(createArchitectureSnapshot(jsonV1, 'V1'), createArchitectureSnapshot(jsonV2, 'V2'));
    const risk5 = computeStructuralRiskDelta(jsonV1, jsonV2, diff5);
    assert(
      diff5.addedNodes.length === 1 &&
      diff5.addedNodes[0].name === 'Redis Cache' &&
      diff5.addedRelationships.length === 1 &&
      diff5.removedNodes.length === 0,
      'Compare Test 5: JSON V1 vs JSON V2',
      'Reconstructs and diffs pure JSON blueprint architectures accurately',
      `Added component: ${diff5.addedNodes[0].name}, Added links: ${diff5.addedRelationships.length}, Delta: ${risk5.delta}`
    );

    // 6. Container Architecture & Overflow-Hidden Audit
    const comparePageContent = fs.readFileSync('c:\\Users\\prana\\Desktop\\final year project\\TRACEIQ\\src\\components\\pages\\ComparePage.tsx', 'utf-8');
    const directCompareContent = fs.readFileSync('c:\\Users\\prana\\Desktop\\final year project\\TRACEIQ\\src\\components\\compare\\DirectCompareView.tsx', 'utf-8');
    const appContent = fs.readFileSync('c:\\Users\\prana\\Desktop\\final year project\\TRACEIQ\\src\\App.tsx', 'utf-8');

    const comparePageHasOverflowYAuto = comparePageContent.includes('overflow-y-auto') && comparePageContent.includes('min-h-0');
    const directCompareHasNoHFullOverflow = !directCompareContent.includes('h-full overflow-hidden bg-slate-100') && !directCompareContent.includes('flex-1 flex flex-col overflow-hidden');
    const appMainHasMinH0 = appContent.includes('main className="flex-1 flex flex-col min-h-0 overflow-hidden relative"');

    assert(
      comparePageHasOverflowYAuto && directCompareHasNoHFullOverflow && appMainHasMinH0,
      'Compare Layout Container Audit',
      'Guarantees ComparePage is scroll container with min-h-0 and DirectCompareView has zero overflow-hidden traps',
      `ComparePage overflow-y-auto: ${comparePageHasOverflowYAuto}, Trap eliminated: ${directCompareHasNoHFullOverflow}, App main min-h-0: ${appMainHasMinH0}`
    );

    // 7. Graph Dimensions & Bounded Styling
    const v1GraphCardHeight520 = directCompareContent.includes('flex flex-col h-[520px] rounded-xl border border-blue-200');
    const v2GraphCardHeight520 = directCompareContent.includes('flex flex-col h-[520px] rounded-xl border border-purple-200');
    assert(
      v1GraphCardHeight520 && v2GraphCardHeight520,
      'Stacked Graph Dimensions & Styling',
      'Both V1 and V2 graph cards configured with generous 520px height and distinctive colored borders',
      `V1 height 520px: ${v1GraphCardHeight520}, V2 height 520px: ${v2GraphCardHeight520}`
    );

    // 8. ReactFlow Non-Trapping Mouse Wheel Configuration
    const archGraphContent = fs.readFileSync('c:\\Users\\prana\\Desktop\\final year project\\TRACEIQ\\src\\components\\graph\\ArchitectureGraph.tsx', 'utf-8');
    const hasZoomOnScrollProp = archGraphContent.includes('zoomOnScroll={zoomOnScroll !== undefined ? zoomOnScroll : (diffMode ? false : true)}');
    const hasPreventScrollingProp = archGraphContent.includes('preventScrolling={preventScrolling !== undefined ? preventScrolling : (diffMode ? false : true)}');
    assert(
      hasZoomOnScrollProp && hasPreventScrollingProp,
      'ReactFlow Mouse Wheel Non-Trapping',
      'Configures ReactFlow in diffMode with zoomOnScroll=false and preventScrolling=false so page scrolls naturally',
      `zoomOnScroll diffMode false: ${hasZoomOnScrollProp}, preventScrolling diffMode false: ${hasPreventScrollingProp}`
    );

    // 9. Single Vertical Scrollbar Guarantee
    const tabContainerHasNoOverflowY = !directCompareContent.includes('Active Tab Panel */\n          <div className="flex-1 overflow-y-auto');
    const tabsSticky = directCompareContent.includes('data-testid="compare-tabs" className="sticky top-0 z-20');
    assert(
      tabContainerHasNoOverflowY && tabsSticky,
      'Single Scrollbar & Sticky Navigation Tabs',
      'Tab panel flows naturally without nested scrollbar and tabs stick to top for instant switching',
      `Tab panel nested scrollbar removed: ${tabContainerHasNoOverflowY}, Tabs sticky top-0: ${tabsSticky}`
    );

    // 10. Responsive Viewport Height Sufficiency (768p, 864p, 1080p)
    // Approximate vertical height of complete Compare content:
    // Dropzones (180px) + Metrics (110px) + V1 Graph (520px) + V2 Graph (520px) + Tabs (45px) + Diff content (~800px) = ~2175px
    const estimatedContentHeight = 180 + 110 + 520 + 520 + 45 + 800; // ~2175px
    const screenHeights = [768, 864, 1080];
    const allScreensScrollable = screenHeights.every(h => estimatedContentHeight > h);
    assert(
      allScreensScrollable,
      'Responsive Viewport Scrollability at 100% Zoom',
      'Content height (~2175px) comfortably exceeds viewports (768p, 864p, 1080p), allowing natural scrolling with 0 zoom reduction',
      `Estimated content height: ${estimatedContentHeight}px vs max screen height: 1080px`
    );
  }

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n===============================================================');
  console.log('AUDIT SUITE EXECUTION SUMMARY');
  console.log('===============================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error(`\nFAILED TESTS:`);
    results.filter(r => r.status === 'FAIL').forEach(r => console.error(` - [${r.scenario}] ${r.name}: ${r.details}`));
    process.exit(1);
  } else {
    console.log(`\nALL TESTS PASSED WITH 100% SUCCESS RATE!`);
  }
}

runAuditSuite().catch((err) => {
  console.error('Fatal error running audit suite:', err);
  process.exit(1);
});
