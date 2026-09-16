import type {
  ArchitectureModel,
  ArchitectureComparisonResult,
  InputIdentity,
} from '../types/architecture';
import { parseAndValidateBlueprint } from './blueprintParser';
import { analyzeCodebaseZip } from './codebaseAnalyzer';
import { reconstructArchitecture } from './architectureReconstructor';
import { createArchitectureSnapshot, computeArchitectureDiff } from './architectureDiffEngine';
import {
  computeImpactAnalysis,
  computeStructuralRiskDelta,
  generateChangeStory,
} from './structuralRiskEngine';

/**
 * Ingests a raw file (ZIP or JSON), parses it completely with 100% input preservation,
 * and reconstructs its ArchitectureModel.
 */
export async function ingestInputFile(file: File): Promise<ArchitectureModel> {
  const isZip = file.name.endsWith('.zip') || file.type.includes('zip');
  const isJson = file.name.endsWith('.json') || file.type.includes('json');

  const inputId = `input_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

  if (isZip) {
    const analysis = await analyzeCodebaseZip(file);
    if (!analysis.success && analysis.filesScanned === 0) {
      throw new Error(`Failed to ingest ZIP archive: ${analysis.issues[0]?.message || 'Unknown error'}`);
    }

    const inputIdentity: InputIdentity = {
      id: inputId,
      filename: file.name,
      inputType: 'codebase',
      uploadedAt: new Date().toISOString(),
      filesCount: analysis.inventory?.total_files || analysis.filesScanned,
      foldersCount: analysis.inventory?.total_folders || 0,
      scope: analysis.scope || (analysis.isLimitedArchitecture ? 'partial' : 'complete'),
    };

    return reconstructArchitecture({
      systemName: analysis.systemName || file.name.replace(/\.zip$/i, ''),
      inputType: 'codebase',
      entities: analysis.entities,
      relationships: analysis.relationships,
      sourceArtifacts: [file.name],
      inventory: analysis.inventory,
      codebaseGraph: analysis.codebaseGraph,
      isLimitedArchitecture: analysis.isLimitedArchitecture,
      limitedArchitectureReason: analysis.limitedArchitectureReason,
      inputIdentity,
      scope: inputIdentity.scope,
    });
  } else if (isJson) {
    const content = await file.text();
    const parseResult = parseAndValidateBlueprint(content);

    if (!parseResult.success) {
      throw new Error(
        `Failed to parse blueprint JSON: ${parseResult.issues.map((i) => i.message).join('; ') || 'Invalid format'}`
      );
    }

    const inputIdentity: InputIdentity = {
      id: inputId,
      filename: file.name,
      inputType: 'blueprint',
      uploadedAt: new Date().toISOString(),
      filesCount: 1,
      foldersCount: 1,
      scope: 'complete',
    };

    return reconstructArchitecture({
      systemName: parseResult.systemName || file.name.replace(/\.json$/i, ''),
      version: parseResult.version || '1.0.0',
      inputType: 'blueprint',
      entities: parseResult.entities,
      relationships: parseResult.relationships,
      sourceArtifacts: [file.name],
      inputIdentity,
      originalJsonPayload: parseResult.originalJsonPayload,
      rawJsonString: parseResult.rawJsonString,
      scope: 'complete',
    });
  } else {
    throw new Error(`Unsupported file type: "${file.name}". Please upload a .zip repository or .json blueprint.`);
  }
}

/**
 * Compares two ArchitectureModels directly without any demo fallback.
 */
export function compareRealModels(
  originalModel: ArchitectureModel,
  changedModel: ArchitectureModel
): ArchitectureComparisonResult {
  const origIdent: InputIdentity = originalModel.inputIdentity || {
    id: `input_orig_${Date.now()}`,
    filename: originalModel.sourceArtifacts?.[0] || originalModel.systemName,
    inputType: originalModel.inputType,
    uploadedAt: new Date().toISOString(),
    filesCount: originalModel.inventory?.total_files || originalModel.entities.length,
    foldersCount: originalModel.inventory?.total_folders || 0,
    scope: originalModel.scope || 'complete',
  };

  const chgIdent: InputIdentity = changedModel.inputIdentity || {
    id: `input_chg_${Date.now()}`,
    filename: changedModel.sourceArtifacts?.[0] || changedModel.systemName,
    inputType: changedModel.inputType,
    uploadedAt: new Date().toISOString(),
    filesCount: changedModel.inventory?.total_files || changedModel.entities.length,
    foldersCount: changedModel.inventory?.total_folders || 0,
    scope: changedModel.scope || 'complete',
  };

  const v1Snapshot = createArchitectureSnapshot(
    originalModel,
    `${origIdent.filename} (Original)`,
    originalModel.version || '1.0.0'
  );

  const v2Snapshot = createArchitectureSnapshot(
    changedModel,
    `${chgIdent.filename} (Changed)`,
    changedModel.version || '2.0.0'
  );

  const architectureDiff = computeArchitectureDiff(v1Snapshot, v2Snapshot);
  const repositoryDiff = architectureDiff.repositoryDiff;

  const impactAnalysis = computeImpactAnalysis(originalModel, changedModel, architectureDiff);
  const structuralRisk = computeStructuralRiskDelta(originalModel, changedModel, architectureDiff, impactAnalysis);
  const changeStory = generateChangeStory(originalModel, changedModel, architectureDiff, impactAnalysis, structuralRisk);

  return {
    originalIdentity: origIdent,
    changedIdentity: chgIdent,
    originalModel,
    changedModel,
    repositoryDiff,
    architectureDiff,
    impactAnalysis,
    structuralRisk,
    changeStory,
  };
}

/**
 * Dual independent ingestion & direct comparison for uploaded files.
 */
export async function compareRealInputs(
  originalFile: File,
  changedFile: File
): Promise<ArchitectureComparisonResult> {
  const [originalModel, changedModel] = await Promise.all([
    ingestInputFile(originalFile),
    ingestInputFile(changedFile),
  ]);

  return compareRealModels(originalModel, changedModel);
}
