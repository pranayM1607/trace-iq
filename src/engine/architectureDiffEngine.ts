import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
  ArchitectureSnapshot,
  ArchitectureDiff,
  DiffNodeItem,
  DiffRelationshipItem,
  CodebaseInventory,
  InventoryFile,
  RepositoryInventoryDiff,
  DiffFileItem,
  DiffFolderItem,
} from '../types/architecture';

/**
 * Deep clones an architecture model to ensure immutable snapshots.
 */
export function cloneArchitectureModel(model: ArchitectureModel): ArchitectureModel {
  return JSON.parse(JSON.stringify(model));
}

/**
 * Creates an immutable snapshot from an existing ArchitectureModel.
 * Preserves both Level 1 (complete repository inventory) and Level 2 (architecture model).
 */
export function createArchitectureSnapshot(
  model: ArchitectureModel,
  label?: string,
  versionOverride?: string,
  sourceIdentifier?: string
): ArchitectureSnapshot {
  const cloned = cloneArchitectureModel(model);
  const version = versionOverride || model.version || '1.0.0';
  const id = `snapshot-${version.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const snapshotLabel = label || `${model.systemName} (v${version})`;

  const fileCount = cloned.inventory ? cloned.inventory.total_files : cloned.entities.length;
  const folderCount = cloned.inventory ? cloned.inventory.total_folders : 0;

  return {
    id,
    version,
    label: snapshotLabel,
    createdAt: new Date().toISOString(),
    sourceIdentifier: sourceIdentifier || (model.sourceArtifacts && model.sourceArtifacts[0]) || model.systemName,
    nodeCount: cloned.entities.length,
    relationshipCount: cloned.relationships.length,
    fileCount,
    folderCount,
    repositoryInventory: cloned.inventory,
    architecture: cloned,
    inputIdentity: cloned.inputIdentity,
    originalJsonPayload: cloned.originalJsonPayload ? JSON.parse(JSON.stringify(cloned.originalJsonPayload)) : undefined,
    rawJsonString: cloned.rawJsonString,
    scope: cloned.scope || 'complete',
    isFrozen: true,
  };
}

/**
 * Generates canonical, deterministic identity key for an architecture entity.
 * Independent of array positions, layout coordinates, or volatile prefixes.
 */
export function getCanonicalNodeKey(entityOrId: ArchitectureEntity | string): string {
  const rawId = typeof entityOrId === 'string' ? entityOrId : entityOrId.id;
  return rawId.toLowerCase().trim();
}

/**
 * Generates canonical, deterministic identity key for a relationship.
 * Preserves direction (A -> B != B -> A) and semantic relationship type (USES != CALLS).
 * Independent of array order or generated UI edge IDs.
 */
export function getCanonicalRelKey(
  rel: ArchitectureRelationship | { source: string; target: string; type: string }
): string {
  const sourceKey = getCanonicalNodeKey(rel.source);
  const targetKey = getCanonicalNodeKey(rel.target);
  return `${sourceKey}->${targetKey}:${rel.type}`;
}

/**
 * Generates canonical identity key for repository files.
 */
export function getCanonicalFileKey(fileOrPath: InventoryFile | string): string {
  const rawPath = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath.path;
  return rawPath
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .trim();
}

/**
 * Detects if all files share a common single root directory prefix.
 */
function detectCommonFolderPrefix(files: InventoryFile[]): string {
  if (files.length <= 1) return '';
  const firstPath = getCanonicalFileKey(files[0]);
  const firstSlash = firstPath.indexOf('/');
  if (firstSlash <= 0) return '';
  const candidate = firstPath.slice(0, firstSlash + 1);
  const standardSourceDirs = ['src/', 'app/', 'lib/', 'pkg/', 'helpers/', 'utils/', 'components/', 'pages/', 'test/', 'tests/'];
  if (standardSourceDirs.includes(candidate.toLowerCase())) {
    return '';
  }
  if (files.every((f) => getCanonicalFileKey(f).startsWith(candidate))) {
    return candidate;
  }
  return '';
}

/**
 * Generates canonical identity key for repository folders.
 */
export function getCanonicalFolderKey(folder: string): string {
  return folder
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .trim();
}

/**
 * Computes a deterministic repository inventory diff between two snapshots.
 * Compares 100% of files and folders without confusing them with semantic architecture components.
 */
export function computeRepositoryInventoryDiff(
  v1Inventory?: CodebaseInventory,
  v2Inventory?: CodebaseInventory
): RepositoryInventoryDiff | undefined {
  if (!v1Inventory && !v2Inventory) return undefined;

  const v1Files = v1Inventory?.files || [];
  const v2Files = v2Inventory?.files || [];

  const v1Prefix = detectCommonFolderPrefix(v1Files);
  const v2Prefix = detectCommonFolderPrefix(v2Files);

  const getCanonicalKey = (f: InventoryFile, prefix: string) => {
    const key = getCanonicalFileKey(f);
    if (prefix && key.startsWith(prefix)) {
      return key.slice(prefix.length);
    }
    return key;
  };

  const v1FileMap = new Map<string, InventoryFile>();
  v1Files.forEach((f) => v1FileMap.set(getCanonicalKey(f, v1Prefix), f));

  const v2FileMap = new Map<string, InventoryFile>();
  v2Files.forEach((f) => v2FileMap.set(getCanonicalKey(f, v2Prefix), f));

  const addedFiles: InventoryFile[] = [];
  const removedFiles: InventoryFile[] = [];
  const modifiedFiles: InventoryFile[] = [];
  const unchangedFiles: InventoryFile[] = [];
  const diffFiles: DiffFileItem[] = [];

  // Identify Added, Modified & Unchanged Files
  v2FileMap.forEach((v2File, key) => {
    const v1File = v1FileMap.get(key);
    if (!v1File) {
      addedFiles.push(v2File);
      diffFiles.push({
        changeType: 'added',
        file: v2File,
        versionOrigin: 'V2',
      });
    } else {
      // Check for modifications via content_hash, size_bytes, or lines_count
      const isModified =
        (Boolean(v1File.content_hash) && Boolean(v2File.content_hash) && v1File.content_hash !== v2File.content_hash) ||
        (v1File.size_bytes !== undefined && v2File.size_bytes !== undefined && v1File.size_bytes !== v2File.size_bytes) ||
        (v1File.lines_count !== undefined && v2File.lines_count !== undefined && v1File.lines_count !== v2File.lines_count);

      if (isModified) {
        modifiedFiles.push(v2File);
        diffFiles.push({
          changeType: 'modified',
          file: v2File,
          previousFile: v1File,
          versionOrigin: 'BOTH',
          diffReason: `File modified (${v1File.lines_count ?? 0} lines -> ${v2File.lines_count ?? 0} lines)`,
        });
      } else {
        unchangedFiles.push(v2File);
        diffFiles.push({
          changeType: 'unchanged',
          file: v2File,
          versionOrigin: 'BOTH',
        });
      }
    }
  });

  // Identify Removed Files
  v1FileMap.forEach((v1File, key) => {
    if (!v2FileMap.has(key)) {
      removedFiles.push(v1File);
      diffFiles.push({
        changeType: 'removed',
        file: v1File,
        versionOrigin: 'V1',
      });
    }
  });

  // Compare Folders
  const v1Folders = v1Inventory?.folders || [];
  const v2Folders = v2Inventory?.folders || [];

  const v1FolderSet = new Set(v1Folders.map(getCanonicalFolderKey));
  const v2FolderSet = new Set(v2Folders.map(getCanonicalFolderKey));

  const addedFolders: string[] = [];
  const removedFolders: string[] = [];
  const unchangedFolders: string[] = [];
  const diffFolders: DiffFolderItem[] = [];

  v2FolderSet.forEach((key) => {
    const originalFolder = v2Folders.find((f) => getCanonicalFolderKey(f) === key) || key;
    if (!v1FolderSet.has(key)) {
      addedFolders.push(originalFolder);
      diffFolders.push({
        changeType: 'added',
        folder: originalFolder,
        versionOrigin: 'V2',
      });
    } else {
      unchangedFolders.push(originalFolder);
      diffFolders.push({
        changeType: 'unchanged',
        folder: originalFolder,
        versionOrigin: 'BOTH',
      });
    }
  });

  v1FolderSet.forEach((key) => {
    if (!v2FolderSet.has(key)) {
      const originalFolder = v1Folders.find((f) => getCanonicalFolderKey(f) === key) || key;
      removedFolders.push(originalFolder);
      diffFolders.push({
        changeType: 'removed',
        folder: originalFolder,
        versionOrigin: 'V1',
      });
    }
  });

  // Sort diffFiles and diffFolders so actionable changes (removed, added, modified) appear before unchanged
  const sortPriority: Record<'removed' | 'added' | 'modified' | 'unchanged', number> = {
    removed: 1,
    added: 2,
    modified: 3,
    unchanged: 4,
  };
  diffFiles.sort((a, b) => {
    const pDiff = (sortPriority[a.changeType] || 99) - (sortPriority[b.changeType] || 99);
    if (pDiff !== 0) return pDiff;
    return a.file.path.localeCompare(b.file.path);
  });
  diffFolders.sort((a, b) => {
    const pDiff = (sortPriority[a.changeType] || 99) - (sortPriority[b.changeType] || 99);
    if (pDiff !== 0) return pDiff;
    return a.folder.localeCompare(b.folder);
  });

  return {
    summary: {
      addedFilesCount: addedFiles.length,
      removedFilesCount: removedFiles.length,
      modifiedFilesCount: modifiedFiles.length,
      unchangedFilesCount: unchangedFiles.length,
      addedFoldersCount: addedFolders.length,
      removedFoldersCount: removedFolders.length,
      unchangedFoldersCount: unchangedFolders.length,
    },
    addedFiles,
    removedFiles,
    modifiedFiles,
    unchangedFiles,
    addedFolders,
    removedFolders,
    unchangedFolders,
    diffFiles,
    diffFolders,
  };
}

/**
 * Computes a deterministic architecture diff between two immutable snapshots.
 *
 * Requirements:
 * 1. Strictly distinguishes node changes from relationship changes.
 * 2. Direction-sensitive and semantic-type sensitive for relationships.
 * 3. Preserves authentic source evidence (V2 evidence for additions, V1 evidence for removals).
 * 4. Zero fabricated evidence (marks unavailable if missing).
 * 5. Returns a unified union graph (diffNodes, diffRelationships) for visual diff rendering.
 */
export function computeArchitectureDiff(
  v1Snapshot: ArchitectureSnapshot,
  v2Snapshot: ArchitectureSnapshot
): ArchitectureDiff {
  const v1Arch = v1Snapshot.architecture;
  const v2Arch = v2Snapshot.architecture;

  // 1. Index V1 and V2 Entities
  const v1NodeMap = new Map<string, ArchitectureEntity>();
  v1Arch.entities.forEach((entity) => {
    v1NodeMap.set(getCanonicalNodeKey(entity), entity);
  });

  const v2NodeMap = new Map<string, ArchitectureEntity>();
  v2Arch.entities.forEach((entity) => {
    v2NodeMap.set(getCanonicalNodeKey(entity), entity);
  });

  const addedNodes: ArchitectureEntity[] = [];
  const removedNodes: ArchitectureEntity[] = [];
  const modifiedNodes: ArchitectureEntity[] = [];
  const unchangedNodes: ArchitectureEntity[] = [];
  const diffNodes: DiffNodeItem[] = [];

  // Identify Added, Modified & Unchanged Nodes
  v2NodeMap.forEach((v2Entity, key) => {
    const v1Entity = v1NodeMap.get(key);
    if (!v1Entity) {
      addedNodes.push(v2Entity);
      diffNodes.push({
        changeType: 'added',
        entity: v2Entity,
        versionOrigin: 'V2',
      });
    } else {
      const isEntityModified =
        v1Entity.type !== v2Entity.type ||
        v1Entity.name !== v2Entity.name ||
        (Boolean(v1Entity.technology) && Boolean(v2Entity.technology) && v1Entity.technology !== v2Entity.technology) ||
        (Boolean(v1Entity.description) && Boolean(v2Entity.description) && v1Entity.description !== v2Entity.description);

      if (isEntityModified) {
        modifiedNodes.push(v2Entity);
        diffNodes.push({
          changeType: 'modified',
          entity: v2Entity,
          previousEntity: v1Entity,
          versionOrigin: 'BOTH',
        });
      } else {
        unchangedNodes.push(v2Entity);
        diffNodes.push({
          changeType: 'unchanged',
          entity: v2Entity,
          versionOrigin: 'BOTH',
        });
      }
    }
  });

  // Identify Removed Nodes
  v1NodeMap.forEach((v1Entity, key) => {
    if (!v2NodeMap.has(key)) {
      removedNodes.push(v1Entity);
      diffNodes.push({
        changeType: 'removed',
        entity: v1Entity,
        versionOrigin: 'V1',
      });
    }
  });

  // 2. Index V1 and V2 Relationships
  const v1RelMap = new Map<string, ArchitectureRelationship>();
  v1Arch.relationships.forEach((rel) => {
    v1RelMap.set(getCanonicalRelKey(rel), rel);
  });

  const v2RelMap = new Map<string, ArchitectureRelationship>();
  v2Arch.relationships.forEach((rel) => {
    v2RelMap.set(getCanonicalRelKey(rel), rel);
  });

  const addedRelationships: DiffRelationshipItem[] = [];
  const removedRelationships: DiffRelationshipItem[] = [];
  const unchangedRelationships: DiffRelationshipItem[] = [];
  const diffRelationships: DiffRelationshipItem[] = [];

  const allUnionNodesMap = new Map<string, ArchitectureEntity>();
  diffNodes.forEach((dn) => allUnionNodesMap.set(getCanonicalNodeKey(dn.entity), dn.entity));

  // Helper to resolve entity by key
  const resolveEntity = (id: string): ArchitectureEntity | undefined => {
    return allUnionNodesMap.get(getCanonicalNodeKey(id));
  };

  // Identify Added & Unchanged Relationships
  v2RelMap.forEach((v2Rel, key) => {
    const sourceEnt = resolveEntity(v2Rel.source);
    const targetEnt = resolveEntity(v2Rel.target);

    if (!v1RelMap.has(key)) {
      // ADDED RELATIONSHIP
      const item: DiffRelationshipItem = {
        id: `diff-rel-added-${key}`,
        changeType: 'added',
        relationship: v2Rel,
        versionOrigin: 'V2',
        sourceEntity: sourceEnt,
        targetEntity: targetEnt,
        sourceEvidence: v2Rel.sourceEvidence || {
          file: 'unavailable',
          description: `Added in ${v2Snapshot.version}`,
          method: 'Architecture Diff',
          confidence: 'LOW',
        },
      };
      addedRelationships.push(item);
      diffRelationships.push(item);
    } else {
      // UNCHANGED RELATIONSHIP
      const item: DiffRelationshipItem = {
        id: `diff-rel-unchanged-${key}`,
        changeType: 'unchanged',
        relationship: v2Rel,
        versionOrigin: 'BOTH',
        sourceEntity: sourceEnt,
        targetEntity: targetEnt,
        sourceEvidence: v2Rel.sourceEvidence || v1RelMap.get(key)?.sourceEvidence,
      };
      unchangedRelationships.push(item);
      diffRelationships.push(item);
    }
  });

  // Identify Removed Relationships
  v1RelMap.forEach((v1Rel, key) => {
    if (!v2RelMap.has(key)) {
      // REMOVED RELATIONSHIP
      const sourceEnt = resolveEntity(v1Rel.source);
      const targetEnt = resolveEntity(v1Rel.target);

      const item: DiffRelationshipItem = {
        id: `diff-rel-removed-${key}`,
        changeType: 'removed',
        relationship: v1Rel,
        versionOrigin: 'V1',
        sourceEntity: sourceEnt,
        targetEntity: targetEnt,
        sourceEvidence: v1Rel.sourceEvidence || {
          file: 'unavailable',
          description: `Decommissioned from ${v1Snapshot.version}`,
          method: 'Architecture Diff',
          confidence: 'LOW',
        },
      };
      removedRelationships.push(item);
      diffRelationships.push(item);
    }
  });

  // Compute Level 1 Repository Inventory Diff
  const v1Inventory = v1Snapshot.repositoryInventory || v1Arch.inventory;
  const v2Inventory = v2Snapshot.repositoryInventory || v2Arch.inventory;
  const repositoryDiff = computeRepositoryInventoryDiff(v1Inventory, v2Inventory);

  return {
    fromSnapshotId: v1Snapshot.id,
    toSnapshotId: v2Snapshot.id,
    fromVersion: v1Snapshot.version,
    toVersion: v2Snapshot.version,
    fromLabel: v1Snapshot.label,
    toLabel: v2Snapshot.label,
    summary: {
      addedNodesCount: addedNodes.length,
      removedNodesCount: removedNodes.length,
      modifiedNodesCount: modifiedNodes.length,
      unchangedNodesCount: unchangedNodes.length,
      addedRelationshipsCount: addedRelationships.length,
      removedRelationshipsCount: removedRelationships.length,
      modifiedRelationshipsCount: 0,
      unchangedRelationshipsCount: unchangedRelationships.length,
    },
    addedNodes,
    removedNodes,
    modifiedNodes,
    unchangedNodes,
    addedRelationships,
    removedRelationships,
    modifiedRelationships: [],
    unchangedRelationships,
    diffNodes,
    diffRelationships,
    repositoryDiff,
  };
}
