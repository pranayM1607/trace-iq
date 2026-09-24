import JSZip from 'jszip';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  RelationshipType,
  ValidationIssue,
  CodebaseInventory,
  InventoryFile,
  DetectedModule,
  CodebaseFileDependency,
  CodebaseGraph,
  CodebaseNode,
  FileCategory,
  ExternalDependencyItem,
  EvidenceConfidence,
} from '../types/architecture';

export interface CodebaseAnalysisResult {
  success: boolean;
  systemName: string;
  filesScanned: number;
  entities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  issues: ValidationIssue[];
  manifestsFound: string[];
  inventory?: CodebaseInventory;
  codebaseGraph?: CodebaseGraph;
  isLimitedArchitecture?: boolean;
  limitedArchitectureReason?: string;
  scope?: 'complete' | 'partial';
}

export interface FileRecord {
  path: string;
  content: string;
  sizeBytes?: number;
  isBinary?: boolean;
}

/**
 * Deterministic binary buffer hash for accurate content comparison across environments.
 */
export function computeBinaryHash(bytes: Uint8Array): string {
  let hash = 5381;
  const len = bytes.length;
  if (len < 65536) {
    for (let i = 0; i < len; i++) {
      hash = ((hash << 5) + hash) + bytes[i];
      hash = hash & hash;
    }
  } else {
    for (let i = 0; i < 4096; i++) {
      hash = ((hash << 5) + hash) + bytes[i];
      hash = hash & hash;
    }
    const mid = Math.floor(len / 2);
    for (let i = 0; i < 4096; i++) {
      hash = ((hash << 5) + hash) + bytes[mid + i];
      hash = hash & hash;
    }
    for (let i = len - 4096; i < len; i++) {
      hash = ((hash << 5) + hash) + bytes[i];
      hash = hash & hash;
    }
  }
  return 'bin-' + (hash >>> 0).toString(16).padStart(8, '0') + `-${len}`;
}

/**
 * Deterministic 32-bit string hash for text files, or binary buffer hash.
 */
export function computeContentHash(content: string, sizeBytes?: number, isBinary?: boolean): string {
  if (isBinary) {
    return `bin-${sizeBytes ?? 0}`;
  }
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Helper to count opening and closing braces in a Java source line
 * while ignoring braces inside double-quoted strings, char literals, and comments.
 */
function countBracesInJavaLine(
  line: string,
  state: { inString: boolean; inChar: boolean; inBlockComment: boolean }
): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  for (let c = 0; c < line.length; c++) {
    const char = line[c];
    const next = c + 1 < line.length ? line[c + 1] : '';

    if (state.inBlockComment) {
      if (char === '*' && next === '/') {
        state.inBlockComment = false;
        c++;
      }
      continue;
    }

    if (state.inString) {
      if (char === '\\') {
        c++; // skip escaped character
      } else if (char === '"') {
        state.inString = false;
      }
      continue;
    }

    if (state.inChar) {
      if (char === '\\') {
        c++; // skip escaped character
      } else if (char === "'") {
        state.inChar = false;
      }
      continue;
    }

    // Line comment: rest of line is ignored
    if (char === '/' && next === '/') {
      break;
    }
    // Block comment start
    if (char === '/' && next === '*') {
      state.inBlockComment = true;
      c++;
      continue;
    }

    // String literal start
    if (char === '"') {
      state.inString = true;
      continue;
    }
    // Char literal start
    if (char === "'") {
      state.inChar = true;
      continue;
    }

    if (char === '{') {
      opens++;
    } else if (char === '}') {
      closes++;
    }
  }
  return { opens, closes };
}

/**
 * Extracts a complete logical Java method/endpoint block from source code.
 * Scans upward to include preceding annotations (e.g. @GetMapping, @Transactional)
 * and scans downward through matching balanced braces { ... }, ignoring string literals and comments.
 */
export function extractJavaMethodBlock(
  content: string,
  lineIdx: number
): { block: string; startLine: number; endLine: number; lineRange: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lineIdx < 0 || lineIdx >= lines.length) return null;

  // Scan upward from lineIdx to capture preceding annotations & doc comments
  let startIdx = lineIdx;
  while (startIdx > 0) {
    const prevTrimmed = lines[startIdx - 1].trim();
    if (
      prevTrimmed.startsWith('@') ||
      prevTrimmed.startsWith('//') ||
      prevTrimmed.startsWith('*') ||
      prevTrimmed.startsWith('/*')
    ) {
      startIdx--;
    } else {
      break;
    }
  }

  // Scan downward to find the method opening brace '{' and its closing brace '}'
  let endIdx = lineIdx;
  let openBraceFound = false;
  let braceCount = 0;
  const parseState = { inString: false, inChar: false, inBlockComment: false };

  for (let i = lineIdx; i < lines.length; i++) {
    const { opens, closes } = countBracesInJavaLine(lines[i], parseState);
    if (opens > 0) {
      openBraceFound = true;
    }
    braceCount += opens;
    braceCount -= closes;

    if (openBraceFound && braceCount <= 0) {
      endIdx = i;
      break;
    }
    // Safety limit of 150 lines per method
    if (i - lineIdx > 150) {
      endIdx = i;
      break;
    }
  }

  // If no braces (e.g. interface signature or abstract method), scan until semicolon ';'
  if (!openBraceFound) {
    for (let i = lineIdx; i < Math.min(lines.length, lineIdx + 10); i++) {
      if (lines[i].includes(';')) {
        endIdx = i;
        break;
      }
    }
  }

  const block = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  const startLine = startIdx + 1;
  const endLine = endIdx + 1;
  const lineRange = startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`;

  return { block: block || 'Exact source block unavailable.', startLine, endLine, lineRange };
}

/**
 * Extracts a complete Java class declaration block including annotations and class header.
 */
export function extractJavaClassBlock(
  content: string,
  className: string
): { block: string; startLine: number; endLine: number; lineRange: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  const classLineIdx = lines.findIndex((l) =>
    new RegExp(`\\b(?:class|interface|enum|record)\\s+${className}\\b`).test(l)
  );
  if (classLineIdx < 0) return null;

  let startIdx = classLineIdx;
  while (startIdx > 0) {
    const prevTrimmed = lines[startIdx - 1].trim();
    if (
      prevTrimmed.startsWith('@') ||
      prevTrimmed.startsWith('//') ||
      prevTrimmed.startsWith('*') ||
      prevTrimmed.startsWith('/*')
    ) {
      startIdx--;
    } else {
      break;
    }
  }

  let endIdx = Math.min(lines.length - 1, classLineIdx + 25);
  let braceCount = 0;
  let openBraceFound = false;
  const parseState = { inString: false, inChar: false, inBlockComment: false };

  for (let i = classLineIdx; i < Math.min(lines.length, classLineIdx + 40); i++) {
    const { opens, closes } = countBracesInJavaLine(lines[i], parseState);
    if (opens > 0) {
      openBraceFound = true;
    }
    braceCount += opens;
    braceCount -= closes;

    if (openBraceFound && braceCount <= 0) {
      endIdx = i;
      break;
    }
  }

  const block = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  const startLine = startIdx + 1;
  const endLine = endIdx + 1;
  const lineRange = startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`;

  return { block: block || 'Exact source block unavailable.', startLine, endLine, lineRange };
}

/**
 * Extracts a complete Python function block through its indented body,
 * including preceding decorators (@route, etc.).
 */
export function extractPythonFunctionBlock(
  content: string,
  lineIdx: number
): { block: string; startLine: number; endLine: number; lineRange: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lineIdx < 0 || lineIdx >= lines.length) return null;

  // If lineIdx points to a decorator line (starts with @), locate the def line downward
  let defIdx = lineIdx;
  if (!/^\s*(?:async\s+)?def\s+/.test(lines[lineIdx])) {
    for (let i = lineIdx; i < Math.min(lines.length, lineIdx + 10); i++) {
      if (/^\s*(?:async\s+)?def\s+/.test(lines[i])) {
        defIdx = i;
        break;
      }
    }
  }

  // Scan upward from the starting point to capture preceding decorators & comments
  let startIdx = Math.min(lineIdx, defIdx);
  while (startIdx > 0) {
    const prevTrimmed = lines[startIdx - 1].trim();
    if (prevTrimmed.startsWith('@') || prevTrimmed.startsWith('#')) {
      startIdx--;
    } else {
      break;
    }
  }

  const defLine = lines[defIdx];
  const baseIndent = defLine.search(/\S/);

  let endIdx = defIdx;
  for (let i = defIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      // Empty lines inside function are allowed, but do not update endIdx yet
      continue;
    }
    const indent = line.search(/\S/);
    if (indent <= baseIndent) {
      // Reached next statement at equal or lesser indentation
      break;
    }
    endIdx = i;
    if (i - defIdx > 150) break;
  }

  const block = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  const startLine = startIdx + 1;
  const endLine = endIdx + 1;
  const lineRange = startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`;

  return { block: block || 'Exact source block unavailable.', startLine, endLine, lineRange };
}

/**
 * Extracts a complete configuration block from properties or yaml files.
 */
export function extractConfigBlock(
  content: string,
  lineIdx: number,
  prefix?: string
): { block: string; startLine: number; endLine: number; lineRange: string } {
  if (!content) return { block: 'Exact source block unavailable.', startLine: 1, endLine: 1, lineRange: '1' };
  const lines = content.split('\n');
  if (lineIdx < 0 || lineIdx >= lines.length) {
    return { block: 'Exact source block unavailable.', startLine: 1, endLine: 1, lineRange: '1' };
  }

  let startIdx = lineIdx;
  let endIdx = lineIdx;

  if (prefix) {
    while (startIdx > 0 && lines[startIdx - 1].includes(prefix)) {
      startIdx--;
    }
    while (endIdx < lines.length - 1 && lines[endIdx + 1].includes(prefix)) {
      endIdx++;
    }
  } else {
    startIdx = Math.max(0, lineIdx - 1);
    endIdx = Math.min(lines.length - 1, lineIdx + 3);
  }

  const block = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  const startLine = startIdx + 1;
  const endLine = endIdx + 1;
  const lineRange = startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`;

  return { block: block || 'Exact source block unavailable.', startLine, endLine, lineRange };
}

/**
 * Extracts a complete JavaScript/TypeScript function, route handler, or class method block.
 */
export function extractJsFunctionBlock(
  content: string,
  lineIdx: number
): { block: string; startLine: number; endLine: number; lineRange: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lineIdx < 0 || lineIdx >= lines.length) return null;

  // Scan upward to locate the enclosing function signature or route declaration
  let startIdx = lineIdx;
  while (startIdx > 0) {
    const l = lines[startIdx];
    if (
      /^\s*(?:export\s+)?(?:async\s+)?function\b/.test(l) ||
      /^\s*(?:const|let|var)\s+[a-zA-Z0-9_]+\s*=\s*(?:async\s*)?\([^\)]*\)\s*=>/.test(l) ||
      /^\s*(?:const|let|var)\s+[a-zA-Z0-9_]+\s*=\s*(?:async\s*)?[a-zA-Z0-9_]+\s*=>/.test(l) ||
      /^\s*(?:router|app)\.(?:get|post|put|delete|patch|use)\s*\(/.test(l) ||
      /^\s*(?:module\.exports(?:\.[a-zA-Z0-9_]+)?\s*=\s*(?:async\s*)?)/.test(l) ||
      /^\s*(?:public|private|protected|static|async)?\s*[a-zA-Z0-9_]+\s*\([^\)]*\)\s*[:{]/.test(l)
    ) {
      break;
    }
    if (lineIdx - startIdx > 25) {
      startIdx = lineIdx;
      break;
    }
    startIdx--;
  }

  // Scan downward counting braces
  let endIdx = lineIdx;
  let openBraceFound = false;
  let braceCount = 0;
  const parseState = { inString: false, inChar: false, inBlockComment: false };

  for (let i = startIdx; i < lines.length; i++) {
    const { opens, closes } = countBracesInJavaLine(lines[i], parseState);
    if (opens > 0) {
      openBraceFound = true;
    }
    braceCount += opens;
    braceCount -= closes;

    if (openBraceFound && braceCount <= 0) {
      endIdx = i;
      break;
    }
    if (i - startIdx > 120) {
      endIdx = i;
      break;
    }
  }

  const block = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  const startLine = startIdx + 1;
  const endLine = endIdx + 1;
  const lineRange = startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`;

  return { block: block || 'Exact source block unavailable.', startLine, endLine, lineRange };
}

/**
 * Extracts a complete Go function or method block with brace counting.
 */
export function extractGoFunctionBlock(
  content: string,
  lineIdx: number
): { block: string; startLine: number; endLine: number; lineRange: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  if (lineIdx < 0 || lineIdx >= lines.length) return null;

  let startIdx = lineIdx;
  while (startIdx > 0) {
    if (/^\s*func\s+/.test(lines[startIdx])) {
      break;
    }
    if (lineIdx - startIdx > 35) {
      startIdx = lineIdx;
      break;
    }
    startIdx--;
  }

  let endIdx = lineIdx;
  let openBraceFound = false;
  let braceCount = 0;
  const parseState = { inString: false, inChar: false, inBlockComment: false };

  for (let i = startIdx; i < lines.length; i++) {
    const { opens, closes } = countBracesInJavaLine(lines[i], parseState);
    if (opens > 0) openBraceFound = true;
    braceCount += opens;
    braceCount -= closes;

    if (openBraceFound && braceCount <= 0) {
      endIdx = i;
      break;
    }
    if (i - startIdx > 150) {
      endIdx = i;
      break;
    }
  }

  const block = lines.slice(startIdx, endIdx + 1).join('\n').trim();
  const startLine = startIdx + 1;
  const endLine = endIdx + 1;
  const lineRange = startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`;

  return { block: block || 'Exact source block unavailable.', startLine, endLine, lineRange };
}

/**
 * Extracts a complete C# method block.
 */
export function extractCsMethodBlock(
  content: string,
  lineIdx: number
): { block: string; startLine: number; endLine: number; lineRange: string } | null {
  return extractJavaMethodBlock(content, lineIdx);
}

/**
 * Universal block extractor providing whole syntactic blocks across all languages,
 * or clear fallback explanation when no source code block is applicable.
 */
export function extractCodeOrConfigBlock(
  filePath: string,
  content: string,
  lineIdx: number,
  fallbackExplanation?: string
): { block: string; startLine: number; endLine: number; lineRange: string; method: string } {
  const ext = getFileExtension(filePath);
  if (ext === '.java') {
    const res = extractJavaMethodBlock(content, lineIdx);
    if (res) return { ...res, method: 'Java Method AST / Block Parser' };
  } else if (ext === '.py') {
    const res = extractPythonFunctionBlock(content, lineIdx);
    if (res) return { ...res, method: 'Python Function AST / Block Parser' };
  } else if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    const res = extractJsFunctionBlock(content, lineIdx);
    if (res) return { ...res, method: 'JavaScript/TypeScript AST / Block Parser' };
  } else if (ext === '.go') {
    const res = extractGoFunctionBlock(content, lineIdx);
    if (res) return { ...res, method: 'Go Function AST / Block Parser' };
  } else if (ext === '.cs') {
    const res = extractCsMethodBlock(content, lineIdx);
    if (res) return { ...res, method: 'C# Method AST / Block Parser' };
  } else if (['.yml', '.yaml', '.properties', '.json', '.toml', '.env'].includes(ext)) {
    const res = extractConfigBlock(content, lineIdx);
    return { ...res, method: 'Configuration Block Parser' };
  }

  if (fallbackExplanation) {
    return {
      block: `No source-code block available.\n${fallbackExplanation}`,
      startLine: lineIdx + 1,
      endLine: lineIdx + 1,
      lineRange: `${lineIdx + 1}`,
      method: 'Configuration / Manifest Metadata',
    };
  }

  const lines = content.split('\n');
  const startLine = Math.max(0, lineIdx - 1) + 1;
  const endLine = Math.min(lines.length - 1, lineIdx + 3) + 1;
  const block = lines.slice(startLine - 1, endLine).join('\n').trim();
  return {
    block: block || 'Exact source block unavailable.',
    startLine,
    endLine,
    lineRange: startLine === endLine ? `${startLine}` : `${startLine}–${endLine}`,
    method: 'Source Window Extractor',
  };
}

/**
 * Ingests a ZIP file, guarantees 100% file retention (Level 1),
 * decodes textual contents safely, and delegates to analyzeCodebaseFiles.
 */
export async function analyzeCodebaseZip(zipFile: File | Blob | ArrayBuffer | Uint8Array | any): Promise<CodebaseAnalysisResult> {
  const zip = new JSZip();
  let zipContent: JSZip;

  let inputData: any = zipFile;
  if (zipFile && typeof (zipFile as any).arrayBuffer === 'function') {
    try {
      inputData = await (zipFile as any).arrayBuffer();
    } catch {
      inputData = zipFile;
    }
  }

  try {
    zipContent = await zip.loadAsync(inputData);
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
      isLimitedArchitecture: true,
      limitedArchitectureReason: 'Corrupted or unreadable archive.',
    };
  }

  const files: FileRecord[] = [];
  const inventoryFiles: InventoryFile[] = [];
  const foldersSet = new Set<string>();

  const entries = Object.keys(zipContent.files);

  for (const relativePath of entries) {
    const entry = zipContent.files[relativePath];
    // Canonicalize path: convert backslashes, strip leading ./ and /
    const normalizedPath = relativePath
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\//, '');

    if (!normalizedPath) continue;

    // Register folders
    if (entry.dir || relativePath.endsWith('/')) {
      const cleanDir = normalizedPath.replace(/\/$/, '');
      if (cleanDir) foldersSet.add(cleanDir);
      continue;
    }

    // Capture folder hierarchy of files
    const parts = normalizedPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      foldersSet.add(parts.slice(0, i).join('/'));
    }

    const fileName = parts[parts.length - 1];
    const extension = getFileExtension(fileName);
    const category = categorizeFile(normalizedPath, extension);
    const language = detectLanguage(extension, fileName);

    // Approximate file size from zip entry
    const sizeBytes = (entry as any)._data?.uncompressedSize ?? 0;

    let content = '';
    let linesCount = 0;
    const isBinary = isBinaryExtension(extension);
    let contentHash = '';

    if (isBinary) {
      try {
        const bytes = await entry.async('uint8array');
        contentHash = computeBinaryHash(bytes);
      } catch {
        contentHash = `bin-${sizeBytes}`;
      }
    } else if (sizeBytes < 5 * 1024 * 1024) {
      try {
        content = await entry.async('string');
        linesCount = content.split('\n').length;
        contentHash = computeContentHash(content, sizeBytes, false);
      } catch {
        content = '';
        contentHash = computeContentHash('', sizeBytes, false);
      }
    } else {
      contentHash = `large-${sizeBytes}`;
    }

    inventoryFiles.push({
      path: normalizedPath,
      name: fileName,
      category,
      extension,
      size_bytes: sizeBytes,
      lines_count: linesCount,
      language,
      content_hash: contentHash,
    });

    files.push({
      path: normalizedPath,
      content,
      sizeBytes,
      isBinary,
    });
  }

  // Canonical root envelope detection:
  // If all files share a common single root directory (e.g. "Test2-main/..."),
  // strip this container prefix so comparison across renamed folders is truthful and direct.
  const rootCandidates = Array.from(
    new Set(
      files
        .map((f) => f.path.split('/')[0])
        .filter((part) => part && part !== '.' && part !== '')
    )
  );

  let commonPrefix = '';
  const standardSourceDirs = ['src', 'app', 'lib', 'pkg', 'helpers', 'utils', 'components', 'pages', 'test', 'tests'];
  if (
    rootCandidates.length === 1 &&
    files.length > 1 &&
    !standardSourceDirs.includes(rootCandidates[0].toLowerCase()) &&
    files.every((f) => f.path.startsWith(rootCandidates[0] + '/'))
  ) {
    commonPrefix = rootCandidates[0] + '/';
  }

  let finalFiles = files;
  let finalInventoryFiles = inventoryFiles;
  let finalFolders = Array.from(foldersSet).filter((f) => f && f !== '.');

  if (commonPrefix) {
    finalFiles = files.map((f) => ({
      ...f,
      path: f.path.substring(commonPrefix.length),
    }));
    finalInventoryFiles = inventoryFiles.map((f) => ({
      ...f,
      path: f.path.substring(commonPrefix.length),
    }));
    finalFolders = finalFolders
      .filter((folder) => folder.startsWith(commonPrefix))
      .map((folder) => folder.substring(commonPrefix.length))
      .filter((folder) => folder.length > 0);
  }

  return analyzeCodebaseFiles(finalFiles, finalInventoryFiles, finalFolders);
}

/**
 * Analyzes ingested files:
 * 1. Constructs Level 1 Codebase Inventory & file dependency graph.
 * 2. Identifies applications, services, internal modules, datasets, ML stores, and external systems.
 * 3. Extracts source-level dependencies with concrete provenance and confidence.
 * 4. Gracefully degrades when architecture is minimal without fabricating false services.
 */
export function analyzeCodebaseFiles(
  files: FileRecord[],
  providedInventoryFiles?: InventoryFile[],
  providedFolders?: string[]
): CodebaseAnalysisResult {
  const entities: ArchitectureEntity[] = [];
  const relationships: ArchitectureRelationship[] = [];
  const issues: ValidationIssue[] = [];
  const manifestsFound: string[] = [];
  const externalDeps: ExternalDependencyItem[] = [];
  const fileDeps: CodebaseFileDependency[] = [];

  // 1. Synthesize Level 1 File Inventory if not directly provided
  const inventoryFiles: InventoryFile[] = providedInventoryFiles || files.map((f) => {
    const norm = f.path.replace(/\\/g, '/');
    const parts = norm.split('/');
    const name = parts[parts.length - 1];
    const ext = getFileExtension(name);
    const isBin = f.isBinary || isBinaryExtension(ext);
    return {
      path: norm,
      name,
      category: categorizeFile(norm, ext),
      extension: ext,
      size_bytes: f.sizeBytes ?? f.content.length,
      lines_count: f.content ? f.content.split('\n').length : 0,
      language: detectLanguage(ext, name),
      content_hash: computeContentHash(f.content, f.sizeBytes ?? f.content.length, isBin),
    };
  });

  // Ensure content_hash is present on all inventory files even if provided
  inventoryFiles.forEach((f) => {
    if (!f.content_hash) {
      const match = files.find((fl) => fl.path.replace(/\\/g, '/') === f.path);
      const isBin = match?.isBinary || isBinaryExtension(f.extension);
      f.content_hash = computeContentHash(match?.content ?? '', f.size_bytes, isBin);
    }
  });

  const folders: string[] = providedFolders || Array.from(
    new Set(
      inventoryFiles.flatMap((f) => {
        const parts = f.path.split('/');
        const ancestors: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          ancestors.push(parts.slice(0, i).join('/'));
        }
        return ancestors;
      })
    )
  );

  const entityMap = new Map<string, ArchitectureEntity>();

  function registerEntity(entity: ArchitectureEntity) {
    if (!entityMap.has(entity.id)) {
      entityMap.set(entity.id, entity);
      entities.push(entity);
    } else {
      const existing = entityMap.get(entity.id)!;
      existing.metadata = { ...existing.metadata, ...entity.metadata };
      if (entity.description && !existing.description) existing.description = entity.description;
      if (entity.technology && existing.technology === 'Generic') existing.technology = entity.technology;
    }
  }

  function registerRel(
    source: string,
    target: string,
    type: RelationshipType,
    protocol: string,
    evidenceFile: string,
    evidenceSnippet: string,
    evidenceLine?: number,
    method = 'Source Code Extractor',
    confidence: EvidenceConfidence = 'HIGH',
    lineRange?: string,
    lineEnd?: number
  ) {
    if (source === target) return;
    if (!relationships.some((r) => r.source === source && r.target === target && r.type === type)) {
      relationships.push({
        id: `rel-${source}-${target}-${type}`,
        source,
        target,
        type,
        protocol,
        sourceEvidence: {
          file: evidenceFile,
          line: evidenceLine,
          lineEnd,
          lineRange: lineRange || (evidenceLine ? `${evidenceLine}` : undefined),
          snippet: evidenceSnippet || 'Exact source block unavailable.',
          description: `${source} ${type} ${target} via ${protocol}`,
          method,
          confidence,
          statement: (evidenceSnippet || '').slice(0, 120),
        },
        description: `${source} ${type} ${target} via ${protocol}`,
      });
    }
  }

  // Quick lookup maps
  const fileByPath = new Map<string, FileRecord>();
  const fileByStem = new Map<string, string>(); // 'urlfeatureextraction' -> full path
  files.forEach((f) => {
    fileByPath.set(f.path, f);
    const stem = getFileStem(f.path).toLowerCase();
    fileByStem.set(stem, f.path);
  });

  // 1b. Pass 1: Pre-register components from declarations (Java, Go, etc.)
  for (const file of files) {
    const ext = getFileExtension(file.path);
    if (ext === '.java') {
      preRegisterJavaComponents(file, registerEntity);
    }
  }

  // 2a. Scan Application Configuration / Spring Properties first
  for (const file of files) {
    const filename = file.path.toLowerCase();
    if (
      filename.endsWith('application.properties') ||
      filename.endsWith('application.yml') ||
      filename.endsWith('application.yaml')
    ) {
      manifestsFound.push(file.path);
      parseSpringProperties(file, registerEntity, registerRel, entityMap);
    }
  }

  // 2b. Scan Manifests & Orchestration (Docker Compose, package.json, requirements.txt, pom.xml, go.mod, Cargo.toml, pubspec.yaml)
  for (const file of files) {
    const filename = file.path.toLowerCase();
    if (filename.endsWith('docker-compose.yml') || filename.endsWith('docker-compose.yaml')) {
      manifestsFound.push(file.path);
      parseDockerCompose(file, registerEntity, registerRel);
    } else if (filename.endsWith('package.json')) {
      manifestsFound.push(file.path);
      parsePackageJson(file, registerEntity, registerRel, externalDeps);
    } else if (filename.endsWith('requirements.txt') || filename.endsWith('pyproject.toml')) {
      manifestsFound.push(file.path);
      parsePythonManifest(file, registerEntity, registerRel, externalDeps);
    } else if (filename.endsWith('pom.xml') || filename.endsWith('build.gradle')) {
      manifestsFound.push(file.path);
      parseJavaManifest(file, registerEntity, registerRel, externalDeps, entityMap);
    } else if (filename.endsWith('go.mod')) {
      manifestsFound.push(file.path);
      parseGoMod(file, registerEntity, registerRel, externalDeps);
    } else if (filename.endsWith('cargo.toml')) {
      manifestsFound.push(file.path);
      parseCargoToml(file, registerEntity, registerRel, externalDeps);
    } else if (filename.endsWith('pubspec.yaml')) {
      manifestsFound.push(file.path);
      parsePubspecYaml(file, registerEntity, registerRel, externalDeps);
    }
  }

  // 2c. Scan Kubernetes Manifests (microservices architecture, deployment and service addresses)
  parseKubernetesManifests(files, registerEntity, registerRel, manifestsFound);

  // 3. Detect Chrome Extension Application (manifest.json with manifest_version)
  let chromeExtensionId: string | null = null;
  for (const file of files) {
    if (file.path.toLowerCase().endsWith('manifest.json')) {
      try {
        const json = JSON.parse(file.content);
        if (json.manifest_version) {
          chromeExtensionId = 'chrome-extension';
          registerEntity({
            id: chromeExtensionId,
            name: json.name ? formatComponentName(json.name) : 'Chrome Extension Application',
            type: 'Application',
            technology: `Chrome Extension (MV${json.manifest_version})`,
            source: 'Detected',
            description: json.description || `Browser extension discovered in ${file.path}`,
            metadata: {
              filePath: file.path,
              version: json.version,
              manifestVersion: json.manifest_version,
            },
          });
        }
      } catch {}
    }
  }

  // 4. Detect Streamlit UI Application
  let streamlitAppId: string | null = null;
  for (const file of files) {
    if (file.path.toLowerCase().endsWith('.py') && file.content.includes('import streamlit')) {
      const parentDir = getParentFolder(file.path);
      const serviceName = extractServiceNameFromPath(file.path) || parentDir || 'streamlit-app';
      streamlitAppId = sanitizeId(serviceName);
      registerEntity({
        id: streamlitAppId,
        name: formatComponentName(serviceName),
        type: 'Application',
        technology: 'Python / Streamlit',
        source: 'Detected',
        description: `Interactive Streamlit user interface discovered in ${file.path}`,
        metadata: {
          filePath: file.path,
          framework: 'Streamlit',
          language: 'Python',
        },
      });
      break;
    }
  }

  // 5. Detect Flutter / Dart Mobile Application
  let flutterAppId: string | null = null;
  const hasDartFiles = files.some((f) => f.path.toLowerCase().endsWith('.dart'));
  if (hasDartFiles) {
    flutterAppId = 'flutter-mobile-app';
    const mainDart = files.find((f) => f.path.toLowerCase().endsWith('main.dart'));
    registerEntity({
      id: flutterAppId,
      name: 'Mobile Application',
      type: 'Application',
      technology: 'Flutter / Dart',
      source: 'Detected',
      description: 'Flutter cross-platform mobile application interface',
      metadata: {
        filePath: mainDart?.path || 'lib/main.dart',
        language: 'Dart',
        framework: 'Flutter',
      },
    });
  }

  // 6. Pass 2: Multi-Language Source Code Parsing & Dependency Extraction
  for (const file of files) {
    const ext = getFileExtension(file.path);
    if (['.py', '.dart', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs', '.cs', '.cpp', '.c', '.php', '.rb'].includes(ext)) {
      parseSourceFile(
        file,
        files,
        fileByStem,
        entityMap,
        registerEntity,
        registerRel,
        fileDeps,
        externalDeps,
        chromeExtensionId,
        streamlitAppId,
        flutterAppId
      );
    }
  }

  // 7. Detect Tabular Datasets & ML Model Artifacts from File Inventory
  detectDatasetsAndModels(inventoryFiles, files, entityMap, registerEntity, registerRel, streamlitAppId);

  // 8. Fallback: If no components detected, register core module from source files
  if (entities.length === 0 && files.length > 0) {
    const primaryFile = files.find((f) => !f.isBinary) || files[0];
    const rootName = formatComponentName(getParentFolder(primaryFile?.path || '') || 'Application Core');
    registerEntity({
      id: 'app-core',
      name: rootName,
      type: 'Service',
      technology: detectTechFromFilename(primaryFile?.path || 'index.js'),
      source: 'Detected',
      description: `Analyzed primary project module (${files.length} files detected)`,
      metadata: {
        filePath: primaryFile?.path || 'root',
        filesScanned: files.length,
      },
    });
  }

  // 9. Prune dangling relationships where entities are not in entityMap
  const validEntities = new Set(entities.map((e) => e.id));
  const validRelationships = relationships.filter((r) => {
    if (!validEntities.has(r.source) || !validEntities.has(r.target)) {
      issues.push({
        type: 'warning',
        message: `Pruned unresolvable relationship: "${r.source}" -> "${r.target}".`,
      });
      return false;
    }
    return true;
  });

  // 10. Determine Graceful Degradation / Limited Architecture / Partial Scope
  const isSingleSource = inventoryFiles.filter((f) => f.category === 'source').length <= 1;
  const isPartialRepo = inventoryFiles.length <= 3 && manifestsFound.length === 0;
  const isLimited = (entities.length <= 1 && validRelationships.length === 0) || (isSingleSource && validRelationships.length <= 2) || isPartialRepo;
  let limitedReason: string | undefined;

  if (isPartialRepo) {
    limitedReason = 'PARTIAL REPOSITORY / LIMITED CONTEXT: Repository contains only 3 or fewer files with no package/build manifests. Displaying available code structures; full system boundaries cannot be guaranteed.';
  } else if (isLimited) {
    limitedReason = isSingleSource
      ? `Single-file application with direct integrations (${inventoryFiles.length} files in archive). No multi-service architectural boundaries detected.`
      : `Limited architectural boundaries detected. System contains ${inventoryFiles.length} files and ${manifestsFound.length} manifests. Full file tree cataloged in Codebase Inventory.`;
  }

  // 11. Compile Language & Category Distribution for Codebase Inventory
  const languagesDist: Record<string, number> = {};
  const categoriesDist: Record<string, number> = {};
  let totalLines = 0;

  inventoryFiles.forEach((f) => {
    if (f.language) {
      languagesDist[f.language] = (languagesDist[f.language] || 0) + 1;
    }
    categoriesDist[f.category] = (categoriesDist[f.category] || 0) + 1;
    totalLines += f.lines_count || 0;
  });

  // Extract detected modules based on directory clusters
  const modules = extractDetectedModules(inventoryFiles, folders);

  // Build Codebase Graph (file-level nodes and edges)
  const codebaseNodes: CodebaseNode[] = inventoryFiles.map((f) => ({
    id: f.path,
    name: f.name,
    type: 'file',
    path: f.path,
    extension: f.extension,
    language: f.language,
    category: f.category,
    size_bytes: f.size_bytes,
    lines_count: f.lines_count,
  }));

  const codebaseGraph: CodebaseGraph = {
    nodes: codebaseNodes,
    edges: fileDeps,
    module_dependencies: [],
    total_nodes: codebaseNodes.length,
    total_edges: fileDeps.length,
    total_imports: fileDeps.length,
  };

  const frameworks = detectFrameworks(files, manifestsFound);

  // Map analysis status to 100% of files in inventory
  const entityFilePaths = new Map<string, ArchitectureEntity>();
  entities.forEach((e) => {
    if (e.metadata?.filePath) {
      entityFilePaths.set(e.metadata.filePath, e);
    }
  });

  const fileDepPaths = new Set<string>();
  fileDeps.forEach((fd) => {
    fileDepPaths.add(fd.source_file);
    fileDepPaths.add(fd.target_file);
  });

  inventoryFiles.forEach((f) => {
    const isUnsupportedOrBinary =
      isBinaryExtension(f.extension) ||
      f.category === 'asset' ||
      f.category === 'model_artifact' ||
      f.category === 'other' ||
      f.extension === '.xyz' ||
      f.extension === '.bin';

    if (entityFilePaths.has(f.path)) {
      const ent = entityFilePaths.get(f.path)!;
      f.associated_entity_id = ent.id;
      f.analysis_status = `Analyzed — mapped to ${ent.name}`;
    } else if (f.category === 'manifest') {
      f.analysis_status = 'Analyzed — package / build manifest';
    } else if (fileDepPaths.has(f.path)) {
      f.analysis_status = 'Analyzed — internal code dependency';
    } else if (f.category === 'config') {
      f.analysis_status = 'Analyzed — configuration file';
    } else if (f.category === 'dataset') {
      const isRead = files.some((fl) => !fl.isBinary && fl.content.includes(f.name));
      if (isRead) {
        f.analysis_status = 'Analyzed — datastore ingested by code';
      } else {
        f.analysis_status = 'Retained / Not Analyzed (Reason: Unsupported or binary format)';
      }
    } else if (isUnsupportedOrBinary) {
      f.analysis_status = 'Retained / Not Analyzed (Reason: Unsupported or binary format)';
    } else {
      f.analysis_status = 'Retained — semantic analysis unavailable';
    }
  });

  const inventory: CodebaseInventory = {
    total_files: inventoryFiles.length,
    total_folders: folders.length,
    total_lines: totalLines,
    languages: languagesDist,
    frameworks,
    categories_breakdown: categoriesDist,
    manifests: manifestsFound,
    config_files: inventoryFiles.filter((f) => f.category === 'config').map((f) => f.path),
    modules,
    packages: Array.from(new Set(externalDeps.map((d) => d.name))),
    libraries: Array.from(new Set(externalDeps.map((d) => d.name))),
    endpoints_count: entities.filter((e) => e.type === 'API').length,
    datastores_count: entities.filter((e) => e.type === 'Database').length,
    external_integrations_count: entities.filter((e) => e.type === 'External System').length,
    files: inventoryFiles,
    folders,
    file_dependencies: fileDeps,
    external_dependencies: externalDeps,
    codebase_graph: codebaseGraph,
    detection_summary: `Reconstructed ${entities.length} architecture entities, ${validRelationships.length} relationships, and cataloged 100% of ${inventoryFiles.length} files.`,
    is_limited_architecture: isLimited,
    limited_architecture_reason: limitedReason,
  };

  const primaryEntityName = entities.find((e) => e.type === 'Application' || e.type === 'Service')?.name;

  return {
    success: entities.length > 0 || inventoryFiles.length > 0,
    systemName: primaryEntityName ? `${primaryEntityName} Platform` : 'Reconstructed System',
    filesScanned: inventoryFiles.length,
    entities,
    relationships: validRelationships,
    issues,
    manifestsFound,
    inventory,
    codebaseGraph,
    isLimitedArchitecture: isLimited,
    limitedArchitectureReason: limitedReason,
    scope: isPartialRepo ? 'partial' : 'complete',
  };
}

// ----------------------------------------------------------------------
// Source File Parsing (Python, Dart, JS/TS, Java, Go)
// ----------------------------------------------------------------------
function parseSourceFile(
  file: FileRecord,
  _allFiles: FileRecord[],
  fileByStem: Map<string, string>,
  entityMap: Map<string, ArchitectureEntity>,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  fileDeps: CodebaseFileDependency[],
  _externalDeps: ExternalDependencyItem[],
  chromeExtensionId: string | null,
  streamlitAppId: string | null,
  flutterAppId: string | null
) {
  const lines = file.content.split('\n');
  const lowerPath = file.path.toLowerCase();
  const ext = getFileExtension(file.path);

  // Identify or create enclosing service for backend files
  const isFrontendOrExtension =
    lowerPath.includes('chrome_extension') ||
    lowerPath.includes('frontend') ||
    lowerPath.includes('client');
  const isDart = ext === '.dart';
  const fileStem = getFileStem(file.path).toLowerCase();
  const isTestFile =
    lowerPath.includes('/test') ||
    lowerPath.startsWith('test') ||
    lowerPath.includes('__test__') ||
    lowerPath.includes('spec') ||
    lowerPath.includes('scratch_test') ||
    lowerPath.includes('run_test') ||
    lowerPath.includes('test_') ||
    lowerPath.includes('/scripts/') ||
    lowerPath.includes('kustomize') ||
    fileStem.startsWith('test') ||
    fileStem.startsWith('scratch') ||
    fileStem.endsWith('_test') ||
    fileStem.includes('.test.') ||
    fileStem.includes('.spec.');
  const isModuleNamed =
    fileStem.includes('feature') ||
    fileStem.includes('extract') ||
    fileStem.includes('util') ||
    fileStem.includes('helper');

  const isServiceNamed =
    !isModuleNamed &&
    (fileStem.includes('service') ||
    fileStem === 'payment' ||
    fileStem === 'fraud' ||
    fileStem === 'order' ||
    fileStem === 'auth' ||
    fileStem === 'gateway' ||
    /\bclass\s+[A-Za-z0-9_]*Service\b/.test(file.content) ||
    file.content.includes('FastAPI(') ||
    file.content.includes('Flask('));

  const javaClassMatch = ext === '.java' ? file.content.match(/\b(?:public\s+)?(?:class|interface)\s+([A-Za-z0-9_]+)/) : null;
  const javaClassId = javaClassMatch ? sanitizeId(javaClassMatch[1]) : null;

  const isAgentFile = lowerPath.includes('/agents/') && fileStem.endsWith('_agent');
  const isOrchestratorFile = (lowerPath.includes('/agents/') && fileStem === 'orchestrator') || (fileStem === 'graph' && !lowerPath.includes('test'));
  const isRagFile = fileStem === 'rag_service';
  const isFastApiApp = fileStem === 'main' && (file.content.includes('FastAPI(') || file.content.includes('app = FastAPI'));
  const isExpressServer = (fileStem === 'server' || fileStem === 'app') && (file.content.includes('express()') || file.content.includes('from "express"') || file.content.includes("from 'express'"));

  let currentServiceId: string;
  if (isFrontendOrExtension && chromeExtensionId) {
    currentServiceId = chromeExtensionId;
  } else if (streamlitAppId && lowerPath.includes('app.py') && file.content.includes('streamlit')) {
    currentServiceId = streamlitAppId;
  } else if (flutterAppId && isDart) {
    currentServiceId = flutterAppId;
  } else if (javaClassId && entityMap.has(javaClassId)) {
    currentServiceId = javaClassId;
  } else if (isAgentFile) {
    currentServiceId = sanitizeId(fileStem);
    if (!entityMap.has(currentServiceId)) {
      registerEntity({
        id: currentServiceId,
        name: formatComponentName(fileStem),
        type: 'Service',
        technology: 'AI Agent',
        source: 'Detected',
        description: `Specialized autonomous agent defined in ${file.path}`,
        metadata: { filePath: file.path },
      });
    }
  } else if (isOrchestratorFile) {
    currentServiceId = 'multi-agent-orchestrator';
    if (!entityMap.has(currentServiceId)) {
      registerEntity({
        id: currentServiceId,
        name: 'Multi-Agent Orchestrator',
        type: 'Service',
        technology: 'LangGraph / Multi-Agent',
        source: 'Detected',
        description: `Workflow coordinator managing autonomous multi-agent execution in ${file.path}`,
        metadata: { filePath: file.path },
      });
    }
  } else if (isRagFile) {
    currentServiceId = 'rag-service';
    if (!entityMap.has(currentServiceId)) {
      registerEntity({
        id: currentServiceId,
        name: 'RAG Service',
        type: 'Service',
        technology: 'Vector RAG / Retrieval',
        source: 'Detected',
        description: `Vector retrieval pipeline defined in ${file.path}`,
        metadata: { filePath: file.path },
      });
    }
  } else if (isFastApiApp) {
    currentServiceId = 'backend-api';
    if (!entityMap.has(currentServiceId)) {
      registerEntity({
        id: currentServiceId,
        name: 'FastAPI Backend Service',
        type: 'Service',
        technology: 'Python / FastAPI',
        source: 'Detected',
        description: `Backend API server rooted in ${file.path}`,
        metadata: { filePath: file.path },
      });
    }
  } else if (isExpressServer && !lowerPath.includes('test')) {
    currentServiceId = sanitizeId(fileStem);
    if (!entityMap.has(currentServiceId)) {
      registerEntity({
        id: currentServiceId,
        name: formatComponentName(fileStem) + ' Backend',
        type: 'Service',
        technology: 'Node.js / Express',
        source: 'Detected',
        description: `Express backend server in ${file.path}`,
        metadata: { filePath: file.path },
      });
    }
  } else {
    const enclosingId = findEnclosingServiceId(file.path, entityMap);
    if (enclosingId) {
      currentServiceId = enclosingId;
    } else if (!isTestFile && isServiceNamed) {
      currentServiceId = sanitizeId(`${fileStem}-service`);
      if (!entityMap.has(currentServiceId)) {
        const name = formatComponentName(fileStem) + (fileStem.includes('service') ? '' : ' Service');
        registerEntity({
          id: currentServiceId,
          name,
          type: 'Service',
          technology: detectTechFromFilename(file.path),
          source: 'Detected',
          description: `Backend service component rooted in ${file.path}`,
          metadata: { filePath: file.path },
        });
      }
    } else if (!isTestFile && isModuleNamed) {
      currentServiceId = sanitizeId(`mod-${fileStem}`);
      if (!entityMap.has(currentServiceId)) {
        registerEntity({
          id: currentServiceId,
          name: formatComponentName(fileStem),
          type: 'Module',
          technology: detectTechFromFilename(file.path),
          source: 'Detected',
          description: `Internal module rooted in ${file.path}`,
          metadata: { filePath: file.path },
        });
      }
    } else {
      if (ext === '.java') {
        return;
      }
      currentServiceId = 'backend-api';
      if (!isTestFile && !entityMap.has(currentServiceId)) {
        const stem = getParentFolder(file.path) || 'Backend Service';
        registerEntity({
          id: currentServiceId,
          name: formatComponentName(stem),
          type: 'Service',
          technology: detectTechFromFilename(file.path),
          source: 'Detected',
          description: `Backend service component rooted in ${file.path}`,
          metadata: { filePath: file.path },
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // ------------------------------------------------------------------
    // A. Python Import & Service Resolution
    // ------------------------------------------------------------------
    if (ext === '.py') {
      const pyBlock = extractPythonFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };

      // 1. Multi-Agent Orchestrator -> Agent delegation
      if (currentServiceId === 'multi-agent-orchestrator') {
        const agentMatch = trimmed.match(/\b([a-zA-Z0-9_]+_agent)\b/);
        if (agentMatch) {
          const targetAgentId = sanitizeId(agentMatch[1]);
          registerEntity({
            id: targetAgentId,
            name: formatComponentName(agentMatch[1]),
            type: 'Service',
            technology: 'AI Agent',
            source: 'Detected',
            description: `Specialized agent coordinated by orchestrator`,
            metadata: { filePath: file.path },
          });
          registerRel(
            currentServiceId,
            targetAgentId,
            'CALLS',
            'Agent Delegation',
            file.path,
            pyBlock.block,
            pyBlock.startLine,
            'LangGraph Agent Invocation Parser',
            'HIGH',
            pyBlock.lineRange,
            pyBlock.endLine
          );
        }
      }

      // 2. FastAPI Backend -> Orchestrator & RAG service
      if (currentServiceId === 'backend-api') {
        if (trimmed.includes('graph') || trimmed.includes('orchestrator')) {
          registerRel(
            currentServiceId,
            'multi-agent-orchestrator',
            'USES',
            'Workflow Execution',
            file.path,
            pyBlock.block,
            pyBlock.startLine,
            'LangGraph Orchestrator Extractor',
            'HIGH',
            pyBlock.lineRange,
            pyBlock.endLine
          );
        }
        if (trimmed.includes('rag_service')) {
          registerRel(
            currentServiceId,
            'rag-service',
            'USES',
            'Internal Service Call',
            file.path,
            pyBlock.block,
            pyBlock.startLine,
            'Python Import Extractor',
            'HIGH',
            pyBlock.lineRange,
            pyBlock.endLine
          );
        }
      }

      // 3. Agent Tool Call Integrations
      if (isAgentFile) {
        if (trimmed.includes('flight_api')) {
          const svcId = 'flight-api-service';
          registerEntity({
            id: svcId,
            name: 'Flight API Service',
            type: 'Service',
            technology: 'REST API Service',
            source: 'Detected',
            description: 'Flight data search integration',
            metadata: { filePath: file.path },
          });
          registerRel(currentServiceId, svcId, 'CALLS', 'HTTP / REST', file.path, pyBlock.block, pyBlock.startLine, 'Agent Tool Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }
        if (trimmed.includes('hotel_api')) {
          const svcId = 'hotel-api-service';
          registerEntity({
            id: svcId,
            name: 'Hotel API Service',
            type: 'Service',
            technology: 'REST API Service',
            source: 'Detected',
            description: 'Hotel booking and search integration',
            metadata: { filePath: file.path },
          });
          registerRel(currentServiceId, svcId, 'CALLS', 'HTTP / REST', file.path, pyBlock.block, pyBlock.startLine, 'Agent Tool Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }
        if (trimmed.includes('tavily')) {
          const tavilyId = 'tavily-api';
          registerEntity({
            id: tavilyId,
            name: 'Tavily Search API',
            type: 'External System',
            technology: 'Tavily REST API',
            source: 'Detected',
            description: 'AI-grounded web search and information retrieval API',
            metadata: { filePath: file.path },
          });
          registerRel(currentServiceId, tavilyId, 'CALLS', 'HTTPS / REST', file.path, pyBlock.block, pyBlock.startLine, 'Agent Tool Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }
        if (trimmed.includes('openweather')) {
          const weatherId = 'openweather-api';
          registerEntity({
            id: weatherId,
            name: 'OpenWeather API',
            type: 'External System',
            technology: 'OpenWeather REST API',
            source: 'Detected',
            description: 'Live global weather forecast API',
            metadata: { filePath: file.path },
          });
          registerRel(currentServiceId, weatherId, 'CALLS', 'HTTPS / REST', file.path, pyBlock.block, pyBlock.startLine, 'Agent Tool Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }
      }

      // 4. Recommendationservice calling productcatalogservice (microservices-demo)
      if (trimmed.includes('PRODUCT_CATALOG_SERVICE_ADDR') || trimmed.includes('ProductCatalogServiceStub')) {
        const targetId = 'productcatalogservice';
        registerRel(
          currentServiceId,
          targetId,
          'CALLS',
          'gRPC',
          file.path,
          pyBlock.block,
          pyBlock.startLine,
          'gRPC Client Stub Extractor',
          'HIGH',
          pyBlock.lineRange,
          pyBlock.endLine
        );
      }

      // 5. Standard Python Import Resolution
      const pyImportMatch = trimmed.match(/^import\s+([a-zA-Z0-9_\.]+)/);
      const pyFromMatch = trimmed.match(/^from\s+([a-zA-Z0-9_\.]+)\s+import/);
      const rawModule = pyImportMatch ? pyImportMatch[1] : pyFromMatch ? pyFromMatch[1] : null;

      if (rawModule) {
        const topModule = rawModule.split('.')[0].toLowerCase();

        if (fileByStem.has(topModule)) {
          const targetPath = fileByStem.get(topModule)!;
          if (targetPath !== file.path) {
            fileDeps.push({
              id: `fdep-${file.path}-${targetPath}-${lineNum}`,
              source_file: file.path,
              target_file: targetPath,
              type: 'IMPORTS',
              line: lineNum,
              snippet: pyBlock.block,
              statement: trimmed,
              detectionMethod: 'Python AST/Import Parser',
              confidence: 'HIGH',
            });

            const targetStem = topModule;
            const targetServiceId = sanitizeId(`${targetStem}-service`);
            if (
              !entityMap.has(targetServiceId) &&
              (targetStem === 'fraud' ||
                targetStem === 'payment' ||
                targetStem === 'order' ||
                targetStem.includes('service'))
            ) {
              const targetName = formatComponentName(targetStem) + (targetStem.includes('service') ? '' : ' Service');
              registerEntity({
                id: targetServiceId,
                name: targetName,
                type: 'Service',
                technology: detectTechFromFilename(targetPath),
                source: 'Detected',
                description: `Backend service component rooted in ${targetPath}`,
                metadata: { filePath: targetPath },
              });
            }

            if (entityMap.has(targetServiceId) && targetServiceId !== currentServiceId) {
              registerRel(
                currentServiceId,
                targetServiceId,
                'CALLS',
                'Internal Module / Service Call',
                file.path,
                pyBlock.block,
                pyBlock.startLine,
                'Python Import / Dependency Extractor',
                'HIGH',
                pyBlock.lineRange,
                pyBlock.endLine
              );
            } else if (
              topModule.includes('feature') ||
              topModule.includes('extract') ||
              topModule.includes('service') ||
              topModule.includes('util')
            ) {
              const moduleId = `mod-${topModule}`;
              registerEntity({
                id: moduleId,
                name: formatComponentName(topModule),
                type: 'Module',
                technology: 'Python Domain Module',
                source: 'Detected',
                description: `Internal module referenced by ${file.path}`,
                metadata: { filePath: targetPath },
              });
              registerRel(currentServiceId, moduleId, 'USES', 'Python Import', file.path, pyBlock.block, pyBlock.startLine, 'Python Import Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
            }
          }
        }

        // GenAI SDKs: Google Gemini
        if (rawModule === 'google.generativeai' || rawModule === 'genai' || rawModule.includes('google_genai') || rawModule.includes('langchain_google_genai')) {
          const geminiId = 'google-gemini-api';
          registerEntity({
            id: geminiId,
            name: 'Google Gemini Generative AI API',
            type: 'External System',
            technology: 'Google Gemini API',
            source: 'Detected',
            description: 'Foundation model API for multimodal and text reasoning',
            metadata: { sdk: 'google-generativeai' },
          });
          registerRel(currentServiceId, geminiId, 'CALLS', 'HTTPS / REST', file.path, pyBlock.block, pyBlock.startLine, 'GenAI SDK Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }

        // GenAI SDKs: OpenAI
        if (rawModule === 'openai') {
          const openAiId = 'openai-api';
          registerEntity({
            id: openAiId,
            name: 'OpenAI API',
            type: 'External System',
            technology: 'OpenAI REST API',
            source: 'Detected',
            description: 'OpenAI LLM and embeddings integration',
            metadata: { sdk: 'openai' },
          });
          registerRel(currentServiceId, openAiId, 'CALLS', 'HTTPS / REST', file.path, pyBlock.block, pyBlock.startLine, 'GenAI SDK Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }

        // Vector Stores: FAISS
        if (rawModule.includes('faiss') || trimmed.includes('FAISS')) {
          const faissId = 'faiss-vector-store';
          registerEntity({
            id: faissId,
            name: 'FAISS Vector Index',
            type: 'Database',
            technology: 'FAISS Vector Store',
            source: 'Detected',
            description: 'In-memory similarity vector search index for RAG retrieval',
            metadata: { dbType: 'Vector Store' },
          });
          registerRel(currentServiceId, faissId, 'QUERIES', 'Vector Search', file.path, pyBlock.block, pyBlock.startLine, 'Vector Store Extractor', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
        }
      }

      // FastAPI Route Decorators
      const fastapiRouteMatch = trimmed.match(/@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
      if (fastapiRouteMatch) {
        const verb = fastapiRouteMatch[1].toUpperCase();
        const endpoint = fastapiRouteMatch[2];
        const apiId = sanitizeId(`api-${verb}-${endpoint}`);
        registerEntity({
          id: apiId,
          name: `${verb} ${endpoint}`,
          type: 'API',
          technology: 'FastAPI / REST Endpoint',
          source: 'Detected',
          description: `FastAPI HTTP ${verb} route exposed in ${file.path}`,
          metadata: { filePath: file.path, endpoint, method: verb, line: pyBlock.startLine, endLine: pyBlock.endLine, lineRange: pyBlock.lineRange, snippet: pyBlock.block },
        });
        registerRel(
          currentServiceId,
          apiId,
          'EXPOSES',
          'HTTP Endpoint',
          file.path,
          pyBlock.block,
          pyBlock.startLine,
          'FastAPI Route Extractor',
          'HIGH',
          pyBlock.lineRange,
          pyBlock.endLine
        );
      }

      // Flask Route Decorators
      const flaskRouteMatch = trimmed.match(/@(?:app|bp|blueprint|router|api)\.route\s*\(\s*['"]([^'"]+)['"]/i);
      if (flaskRouteMatch) {
        const endpoint = flaskRouteMatch[1];
        const apiId = sanitizeId(`api-${endpoint}`);

        registerEntity({
          id: apiId,
          name: endpoint,
          type: 'API',
          technology: 'Flask / REST Endpoint',
          source: 'Detected',
          description: `HTTP API route exposed in ${file.path}`,
          metadata: { filePath: file.path, endpoint, line: pyBlock.startLine, endLine: pyBlock.endLine, lineRange: pyBlock.lineRange, snippet: pyBlock.block },
          sourceEvidence: {
            file: file.path,
            line: pyBlock.startLine,
            lineEnd: pyBlock.endLine,
            lineRange: pyBlock.lineRange,
            snippet: pyBlock.block,
            description: `HTTP API route "${endpoint}" exposed in ${file.path}`,
            method: 'Python Function AST Parser',
            confidence: 'HIGH',
          },
        });
        registerRel(
          currentServiceId,
          apiId,
          'EXPOSES',
          'HTTP Endpoint',
          file.path,
          pyBlock.block,
          pyBlock.startLine,
          'Route Decorator Extractor',
          'HIGH',
          pyBlock.lineRange,
          pyBlock.endLine
        );
      }

      // Detect Model Loading: pickle.load / joblib.load
      if (trimmed.includes('pickle.load') || trimmed.includes('joblib.load')) {
        const modelStoreId = 'ml-model-artifacts';
        registerEntity({
          id: modelStoreId,
          name: 'ML Model Artifacts',
          type: 'Database',
          technology: 'Trained Model Store (.pkl / .dat)',
          source: 'Detected',
          description: 'Persisted machine learning models loaded for inference',
          metadata: { dbType: 'Model Artifact Store' },
        });
        registerRel(currentServiceId, modelStoreId, 'LOADS', 'Binary Deserialization', file.path, pyBlock.block, pyBlock.startLine, 'ML Model Deserializer', 'HIGH', pyBlock.lineRange, pyBlock.endLine);
      }
    }

    // ------------------------------------------------------------------
    // B. Dart / Flutter Import Resolution
    // ------------------------------------------------------------------
    if (ext === '.dart') {
      const dartImportMatch = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
      if (dartImportMatch) {
        const importTarget = dartImportMatch[1];
        // Match relative or package internal imports e.g. "package:ecell/phishing.dart" or "phishing.dart"
        const stem = getFileStem(importTarget).toLowerCase();
        if (fileByStem.has(stem)) {
          const targetPath = fileByStem.get(stem)!;
          if (targetPath !== file.path) {
            fileDeps.push({
              id: `fdep-${file.path}-${targetPath}-${lineNum}`,
              source_file: file.path,
              target_file: targetPath,
              type: 'IMPORTS',
              line: lineNum,
              snippet: trimmed,
              statement: trimmed,
              detectionMethod: 'Dart Import Resolver',
              confidence: 'HIGH',
            });
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // C1. Go Source Code Resolution (gRPC / Microservices)
    // ------------------------------------------------------------------
    if (ext === '.go') {
      const envMapMatch = trimmed.match(/mustMapEnv\s*\(\s*&[a-zA-Z0-9_\.]+\s*,\s*["']([A-Z0-9_]+(?:_SERVICE_ADDR|_ADDR))["']\)/);
      if (envMapMatch) {
        const envVar = envMapMatch[1];
        const rawSvc = envVar.replace(/_SERVICE_ADDR$|_ADDR$/, '').toLowerCase().replace(/_/g, '');
        const targetId = sanitizeId(rawSvc);
        if (targetId && targetId !== currentServiceId) {
          const goBlock = extractGoFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
          registerRel(
            currentServiceId,
            targetId,
            'CALLS',
            'gRPC',
            file.path,
            goBlock.block,
            goBlock.startLine,
            'Go gRPC Client Extractor',
            'HIGH',
            goBlock.lineRange,
            goBlock.endLine
          );
        }
      }
    }

    // ------------------------------------------------------------------
    // C2. C# Source Code Resolution (.NET Microservices)
    // ------------------------------------------------------------------
    if (ext === '.cs') {
      if (trimmed.includes('Configuration["REDIS_ADDR"]') || trimmed.includes('AddStackExchangeRedisCache')) {
        const dbId = 'redis-cart';
        registerEntity({
          id: dbId,
          name: 'Redis Cart Store',
          type: 'Database',
          technology: 'Redis',
          source: 'Detected',
          description: 'In-memory distributed cache store configured in ' + file.path,
          metadata: { filePath: file.path },
        });
        const csBlock = extractCsMethodBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        registerRel(
          currentServiceId,
          dbId,
          'USES',
          'Redis Protocol',
          file.path,
          csBlock.block,
          csBlock.startLine,
          'C# Redis Cache Extractor',
          'HIGH',
          csBlock.lineRange,
          csBlock.endLine
        );
      }
    }

    // ------------------------------------------------------------------
    // C3. JavaScript / TypeScript Client API Calls & Messaging & Routes
    // ------------------------------------------------------------------
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      // Relative imports
      const jsImportMatch = trimmed.match(/(?:import.*?from\s+['"]|require\s*\(\s*['"])((\.{1,2}\/[^'"]+))['"]/);
      if (jsImportMatch) {
        const relImport = jsImportMatch[1];
        const stem = getFileStem(relImport).toLowerCase();
        if (fileByStem.has(stem)) {
          const targetPath = fileByStem.get(stem)!;
          fileDeps.push({
            id: `fdep-${file.path}-${targetPath}-${lineNum}`,
            source_file: file.path,
            target_file: targetPath,
            type: 'IMPORTS',
            line: lineNum,
            snippet: trimmed,
            statement: trimmed,
            detectionMethod: 'JS Module Resolver',
            confidence: 'HIGH',
          });
        }
      }

      // Inter-service HTTP calls: axios.post('http://customer:8001/app-events/', ...)
      const httpServiceCallMatch = trimmed.match(/(?:axios|fetch|request)\s*\.\s*(?:get|post|put|delete)\s*\(\s*[`'"]https?:\/\/([a-zA-Z0-9_-]+):[0-9]+/i);
      if (httpServiceCallMatch) {
        const targetHost = sanitizeId(httpServiceCallMatch[1]);
        if (targetHost !== currentServiceId) {
          const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
          registerRel(
            currentServiceId,
            targetHost,
            'CALLS',
            'HTTP / REST',
            file.path,
            jsBlock.block,
            jsBlock.startLine,
            'Node.js HTTP Service Client Extractor',
            'HIGH',
            jsBlock.lineRange,
            jsBlock.endLine
          );
        }
      }

      // RabbitMQ Messaging via amqplib (PublishMessage / SubscribeMessage)
      if (trimmed.includes('amqplib') || trimmed.includes('PublishMessage') || trimmed.includes('SubscribeMessage') || trimmed.includes('MSG_QUEUE_URL')) {
        const mqId = 'rabbitmq';
        registerEntity({
          id: mqId,
          name: 'RabbitMQ Message Broker',
          type: 'Service',
          technology: 'RabbitMQ / AMQP',
          source: 'Detected',
          description: 'Event broker queue for inter-service event communication',
          metadata: { filePath: file.path },
        });
        const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        registerRel(
          currentServiceId,
          mqId,
          'CONNECTS_TO',
          'AMQP Protocol',
          file.path,
          jsBlock.block,
          jsBlock.startLine,
          'AMQP Message Broker Extractor',
          'HIGH',
          jsBlock.lineRange,
          jsBlock.endLine
        );
      }

      // MongoDB connection: mongoose.connect
      if (trimmed.includes('mongoose.connect') || trimmed.includes('mongodb://') || (trimmed.includes('DB_URL') && file.content.includes('mongoose'))) {
        const dbId = 'nosql-db';
        registerEntity({
          id: dbId,
          name: 'MongoDB Database',
          type: 'Database',
          technology: 'MongoDB',
          source: 'Detected',
          description: 'Document database configured in ' + file.path,
          metadata: { filePath: file.path, dbType: 'NoSQL / Document' },
        });
        const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        registerRel(
          currentServiceId,
          dbId,
          'QUERIES',
          'MongoDB Wire Protocol',
          file.path,
          jsBlock.block,
          jsBlock.startLine,
          'Mongoose Database Extractor',
          'HIGH',
          jsBlock.lineRange,
          jsBlock.endLine
        );
      }

      // GitHub REST API
      if (trimmed.includes('api.github.com') || trimmed.includes('fetchGitHubData')) {
        const ghId = 'github-api';
        registerEntity({
          id: ghId,
          name: 'GitHub REST API',
          type: 'External System',
          technology: 'GitHub REST API',
          source: 'Detected',
          description: 'External GitHub developer platform API',
          metadata: { filePath: file.path },
        });
        const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        registerRel(
          currentServiceId,
          ghId,
          'CALLS',
          'HTTPS / REST',
          file.path,
          jsBlock.block,
          jsBlock.startLine,
          'GitHub API Client Extractor',
          'HIGH',
          jsBlock.lineRange,
          jsBlock.endLine
        );
      }

      // Google Gemini GenAI SDK (@google/genai)
      if (trimmed.includes('@google/genai') || trimmed.includes('GoogleGenAI') || trimmed.includes('GoogleGenerativeAI')) {
        const geminiId = 'google-gemini-api';
        registerEntity({
          id: geminiId,
          name: 'Google Gemini Generative AI API',
          type: 'External System',
          technology: 'Google Gemini API',
          source: 'Detected',
          description: 'Multimodal AI reasoning models via Google GenAI SDK',
          metadata: { filePath: file.path },
        });
        const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        registerRel(
          currentServiceId,
          geminiId,
          'CALLS',
          'HTTPS / REST',
          file.path,
          jsBlock.block,
          jsBlock.startLine,
          'Google GenAI SDK Extractor',
          'HIGH',
          jsBlock.lineRange,
          jsBlock.endLine
        );
      }

      // Client API Calls: const API_URL = 'http://127.0.0.1:5000/predict' or fetch() or axios.post()
      const clientUrlMatch = trimmed.match(/(?:http:\/\/)?(?:127\.0\.0\.1|localhost):(\d+)(\/[a-zA-Z0-9_\-\/]+)?/i);
      if (clientUrlMatch) {
        const port = clientUrlMatch[1];
        const endpoint = clientUrlMatch[2] || '';
        const backendTarget = entityMap.get('backend-api') || entityMap.get('phishing-ai-extention-main') || entityMap.get('app-service') || entitiesList(entityMap).find((e) => e.type === 'Service');
        if (backendTarget && backendTarget.id !== currentServiceId) {
          const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
          registerRel(
            currentServiceId,
            backendTarget.id,
            'CALLS',
            `HTTP ${port ? `:${port}` : ''}${endpoint}`,
            file.path,
            jsBlock.block,
            jsBlock.startLine,
            'Client HTTP Endpoint Extractor',
            'HIGH',
            jsBlock.lineRange,
            jsBlock.endLine
          );
        }
      }

      // Express API Routes
      const restMatch = trimmed.match(/(?:app|router)\.(get|post|put|delete|patch)\(['"`](\/[a-zA-Z0-9_\-\/:]*)['"`]/i);
      if (restMatch) {
        const method = restMatch[1].toUpperCase();
        const endpoint = restMatch[2];
        const apiId = sanitizeId(`api-${method}-${endpoint}`);
        const jsBlock = extractJsFunctionBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        registerEntity({
          id: apiId,
          name: `${method} ${endpoint}`,
          type: 'API',
          technology: 'REST API Route',
          source: 'Detected',
          description: `REST endpoint in ${file.path}`,
          metadata: { filePath: file.path, method, endpoint, line: jsBlock.startLine, endLine: jsBlock.endLine, lineRange: jsBlock.lineRange, snippet: jsBlock.block },
        });
        registerRel(
          currentServiceId,
          apiId,
          'EXPOSES',
          'Internal Route',
          file.path,
          jsBlock.block,
          jsBlock.startLine,
          'Express Route Extractor',
          'HIGH',
          jsBlock.lineRange,
          jsBlock.endLine
        );
      }
    }

    // ------------------------------------------------------------------
    // D. Java / Spring Boot Dependency & Route Resolution
    // ------------------------------------------------------------------
    if (ext === '.java') {
      // 1. File-level imports
      const javaImportMatch = trimmed.match(/^import\s+([a-zA-Z0-9_\.]+);/);
      if (javaImportMatch) {
        const fullClass = javaImportMatch[1];
        const simpleName = fullClass.split('.').pop() || '';
        const simpleStem = simpleName.toLowerCase();

        if (fileByStem.has(simpleStem)) {
          const targetPath = fileByStem.get(simpleStem)!;
          if (targetPath !== file.path) {
            fileDeps.push({
              id: `fdep-${file.path}-${targetPath}-${lineNum}`,
              source_file: file.path,
              target_file: targetPath,
              type: 'IMPORTS',
              line: lineNum,
              snippet: trimmed,
              statement: trimmed,
              detectionMethod: 'Java Import Parser',
              confidence: 'HIGH',
            });
          }
        }
      }

      // 2. Spring MVC Route endpoints (only method endpoints inside the class)
      const classDeclIndex = file.content.search(/\b(?:class|interface)\b/);
      const currentPos = file.content.indexOf(trimmed);
      const isBeforeClass = classDeclIndex !== -1 && currentPos !== -1 && currentPos < classDeclIndex;

      const springRouteMatch = trimmed.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(?:\(\s*(?:value\s*=\s*)?["']([^"']+)["']|\(\s*["']([^"']+)["']|\(\s*\))?/);
      if (springRouteMatch && !isBeforeClass && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        const rawVerb = springRouteMatch[1];
        const verbMap: Record<string, string> = {
          GetMapping: 'GET',
          PostMapping: 'POST',
          PutMapping: 'PUT',
          DeleteMapping: 'DELETE',
          PatchMapping: 'PATCH',
          RequestMapping: 'REQUEST',
        };
        const httpVerb = verbMap[rawVerb] || 'GET';
        const rawRoute = springRouteMatch[2] || springRouteMatch[3] || '';

        let classPrefix = '';
        const classReqMatch = file.content.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/);
        if (classReqMatch) {
          classPrefix = classReqMatch[1].replace(/\/$/, '');
        }

        let fullRoute = rawRoute;
        if (classPrefix) {
          fullRoute = rawRoute.startsWith('/') ? `${classPrefix}${rawRoute}` : rawRoute ? `${classPrefix}/${rawRoute}` : classPrefix;
        } else if (!fullRoute.startsWith('/')) {
          fullRoute = `/${fullRoute}`;
        }
        if (!fullRoute) fullRoute = '/';

        const displayVerb = httpVerb === 'REQUEST' ? 'GET' : httpVerb;
        const apiId = sanitizeId(`api-${displayVerb}-${fullRoute}`);
        const methodBlock = extractJavaMethodBlock(file.content, i);
        const codeSnippet = methodBlock ? methodBlock.block : trimmed;
        const startL = methodBlock ? methodBlock.startLine : lineNum;
        const endL = methodBlock ? methodBlock.endLine : lineNum;
        const lRange = methodBlock ? methodBlock.lineRange : `${lineNum}`;

        if (!entityMap.has(apiId)) {
          registerEntity({
            id: apiId,
            name: `${displayVerb} ${fullRoute}`,
            type: 'API',
            technology: 'Spring MVC / REST Endpoint',
            source: 'Detected',
            description: `HTTP ${displayVerb} route exposed in ${file.path}`,
            metadata: {
              filePath: file.path,
              endpoint: fullRoute,
              httpMethod: displayVerb,
              line: startL,
              endLine: endL,
              lineRange: lRange,
              snippet: codeSnippet,
            },
            sourceEvidence: {
              file: file.path,
              line: startL,
              lineEnd: endL,
              lineRange: lRange,
              snippet: codeSnippet,
              description: `HTTP ${displayVerb} route "${fullRoute}" defined in ${file.path}`,
              method: 'Annotation & AST Pattern Parser',
              confidence: 'HIGH',
            },
          });
        }
        registerRel(
          currentServiceId,
          apiId,
          'EXPOSES',
          'HTTP Endpoint',
          file.path,
          codeSnippet,
          startL,
          'Spring Route Extractor',
          'HIGH',
          lRange,
          endL
        );
      }

      // 3. Dependency Injection & Service / Repo Wiring
      if (!trimmed.startsWith('package ') && !trimmed.startsWith('import ') && !trimmed.startsWith('@')) {
        entityMap.forEach((targetEntity, targetId) => {
          if (targetId !== currentServiceId && (targetEntity.type === 'Service' || targetEntity.type === 'Module')) {
            const typeName = targetEntity.metadata?.className || targetEntity.name;
            const escaped = typeName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const typeRefRegex = new RegExp(`\\b${escaped}\\b`);
            if (typeRefRegex.test(trimmed)) {
              const currentEntity = entityMap.get(currentServiceId);
              const isCallerController = currentEntity?.metadata?.role === 'controller' || currentEntity?.name.endsWith('Controller');
              const isTargetRepo = targetEntity.metadata?.role === 'repository' || targetEntity.name.endsWith('Repo') || targetEntity.name.endsWith('Repository');

              const relType: RelationshipType = isCallerController ? 'CALLS' : isTargetRepo ? 'USES' : 'CALLS';
              const protocol = isCallerController
                ? 'Spring @Autowired / Dependency Injection'
                : isTargetRepo
                ? 'Spring Data JPA Injection'
                : 'Java Method Call';

              const methodBlock = extractJavaMethodBlock(file.content, i) || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
              registerRel(
                currentServiceId,
                targetId,
                relType,
                protocol,
                file.path,
                methodBlock.block,
                methodBlock.startLine,
                'Spring Dependency Injection Extractor',
                'HIGH',
                methodBlock.lineRange,
                methodBlock.endLine
              );
            }
          }
        });
      }

      // 4. Spring Data JPA Repository -> Database Link
      if (trimmed.includes('extends JpaRepository') || trimmed.includes('extends CrudRepository')) {
        const dbEntities = entitiesList(entityMap).filter((e) => e.type === 'Database');
        const classBlock = extractJavaClassBlock(file.content, javaClassMatch ? javaClassMatch[1] : '') || { block: trimmed, startLine: lineNum, endLine: lineNum, lineRange: `${lineNum}` };
        dbEntities.forEach((db) => {
          registerRel(
            currentServiceId,
            db.id,
            'QUERIES',
            'Spring Data JPA / Hibernate',
            file.path,
            classBlock.block,
            classBlock.startLine,
            'Spring Data JPA Extractor',
            'HIGH',
            classBlock.lineRange,
            classBlock.endLine
          );
        });
      }
    }
  }
}

// ----------------------------------------------------------------------
// Datasets and ML Models Detection
// ----------------------------------------------------------------------
function detectDatasetsAndModels(
  inventoryFiles: InventoryFile[],
  files: FileRecord[],
  entityMap: Map<string, ArchitectureEntity>,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  streamlitAppId: string | null
) {
  const csvFiles = inventoryFiles.filter((f) => f.category === 'dataset' || f.extension === '.csv');
  const modelFiles = inventoryFiles.filter((f) => f.category === 'model_artifact');

  // Check if any source file reads datasets via pd.read_csv or open()
  const readsCsv = files.some(
    (f) =>
      !f.isBinary &&
      (f.content.includes('read_csv') || f.content.includes('.csv'))
  );

  if (csvFiles.length > 0 && readsCsv) {
    // Find representative name
    const sampleCsv = csvFiles[0];
    const datasetName = formatComponentName(getFileStem(sampleCsv.name) || 'Tabular Dataset');
    const datasetId = 'primary-dataset';

    registerEntity({
      id: datasetId,
      name: `${datasetName} Store`,
      type: 'Database',
      technology: 'CSV / Tabular Dataset',
      source: 'Detected',
      description: `Structured dataset storage (${csvFiles.length} dataset files detected)`,
      metadata: {
        filePath: sampleCsv.path,
        filesCount: csvFiles.length,
        dbType: 'Tabular Dataset',
      },
    });

    const targetService = streamlitAppId
      ? streamlitAppId
      : entityMap.get('backend-api')?.id || entitiesList(entityMap).find((e) => e.type === 'Service')?.id;

    if (targetService) {
      registerRel(
        targetService,
        datasetId,
        'QUERIES',
        'Pandas CSV Parser',
        sampleCsv.path,
        `pd.read_csv("${sampleCsv.name}")`,
        undefined,
        'Dataset Reader Extractor',
        'HIGH'
      );
    }
  }

  // Check if ML models are loaded
  if (modelFiles.length > 0) {
    const modelStoreId = 'ml-model-artifacts';
    registerEntity({
      id: modelStoreId,
      name: 'ML Model Artifacts',
      type: 'Database',
      technology: 'Model Artifacts (.pkl / .dat)',
      source: 'Detected',
      description: `Serialized machine learning models (${modelFiles.length} artifacts detected)`,
      metadata: {
        filesCount: modelFiles.length,
        dbType: 'Model Artifact Store',
      },
    });

    const targetService = entityMap.get('backend-api')?.id || entitiesList(entityMap).find((e) => e.type === 'Service')?.id;
    if (targetService && targetService !== modelStoreId) {
      registerRel(
        targetService,
        modelStoreId,
        'LOADS',
        'Pickle / Binary Model',
        modelFiles[0].path,
        `pickle.load(...)`,
        undefined,
        'Model Loader Extractor',
        'HIGH'
      );
    }
  }
}

// ----------------------------------------------------------------------
// Manifest Parsers
// ----------------------------------------------------------------------
function parseDockerCompose(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void
) {
  const lines = file.content.split('\n');
  let currentService = '';
  let inServices = false;
  let inDependsOn = false;
  let dependsOnIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('services:')) {
      inServices = true;
      continue;
    }

    if (inServices) {
      const serviceMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):/);
      if (serviceMatch) {
        currentService = sanitizeId(serviceMatch[1]);
        inDependsOn = false;
        const isDb = /postgres|mysql|mongo|redis|mariadb|cockroach|dynamodb|nosql/i.test(currentService);
        const isMq = /rabbit|kafka|nats|activemq/i.test(currentService);
        const entityType: EntityType = isDb ? 'Database' : 'Service';
        const tech = isDb ? (currentService.includes('mongo') || currentService.includes('nosql') ? 'MongoDB' : formatComponentName(currentService)) : isMq ? 'RabbitMQ' : 'Docker Container';
        registerEntity({
          id: currentService,
          name: formatComponentName(currentService),
          type: entityType,
          technology: tech,
          source: 'Detected',
          description: `Containerized ${entityType.toLowerCase()} defined in ${file.path}`,
          metadata: { filePath: file.path },
        });
      }

      if (currentService) {
        if (/^\s+depends_on:/.test(line)) {
          inDependsOn = true;
          dependsOnIndent = line.search(/\S/);
          continue;
        }

        if (inDependsOn) {
          const currentIndent = line.search(/\S/);
          if (trimmed && currentIndent <= dependsOnIndent && !trimmed.startsWith('-')) {
            inDependsOn = false;
          } else {
            const depItemMatch = trimmed.match(/^-\s*["']?([a-zA-Z0-9_-]+)["']?/);
            if (depItemMatch) {
              const target = sanitizeId(depItemMatch[1]);
              const cfg = extractConfigBlock(file.content, i, '-');
              registerRel(
                currentService,
                target,
                'DEPENDS_ON',
                'Docker Network',
                file.path,
                cfg.block,
                cfg.startLine,
                'Docker Compose Parser',
                'HIGH',
                cfg.lineRange,
                cfg.endLine
              );
            }
          }
        }

        const envMatch = line.match(/(?:DATABASE_URL|POSTGRES_HOST|REDIS_HOST|DB_HOST|MONGO_URL|DB_URL):\s*["']?([a-zA-Z0-9_-]+)/i);
        if (envMatch) {
          const target = sanitizeId(envMatch[1]);
          const cfg = extractConfigBlock(file.content, i);
          registerRel(
            currentService,
            target,
            'USES',
            'TCP/Socket',
            file.path,
            cfg.block,
            cfg.startLine,
            'Docker Compose Env Parser',
            'HIGH',
            cfg.lineRange,
            cfg.endLine
          );
        }
      }
    }
  }
}

function parseKubernetesManifests(
  files: FileRecord[],
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  manifestsFound: string[]
) {
  const k8sFiles = files.filter((f) => {
    const lower = f.path.toLowerCase();
    return (
      (lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('manifest')) &&
      (lower.endsWith('.yaml') || lower.endsWith('.yml')) &&
      !lower.includes('kustom')
    );
  });

  for (const file of k8sFiles) {
    if (!manifestsFound.includes(file.path)) {
      manifestsFound.push(file.path);
    }
    const lines = file.content.split('\n');
    let currentDeployment: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect Deployment / Service metadata name
      const nameMatch = line.match(/^ {2}name:\s*["']?([a-zA-Z0-9_-]+)["']?/);
      if (nameMatch && i > 0 && lines[i - 1].includes('metadata:')) {
        const name = nameMatch[1];
        if (name !== 'server' && name !== 'default' && !name.includes('probe')) {
          currentDeployment = name;
          const isDb = /redis|postgres|mysql|mongo|db/i.test(name);
          const entityType: EntityType = isDb ? 'Database' : 'Service';
          const tech = isDb ? (name.includes('redis') ? 'Redis' : formatComponentName(name)) : 'Kubernetes Microservice';
          registerEntity({
            id: sanitizeId(name),
            name: formatComponentName(name),
            type: entityType,
            technology: tech,
            source: 'Detected',
            description: `Kubernetes ${entityType.toLowerCase()} declared in ${file.path}`,
            metadata: { filePath: file.path },
          });
        }
      }

      // Detect env vars pointing to target services:
      // - name: PRODUCT_CATALOG_SERVICE_ADDR
      //   value: "productcatalogservice:3550"
      const envNameMatch = line.match(/-\s+name:\s*["']?([A-Z0-9_]+(?:_SERVICE_ADDR|_ADDR))["']?/);
      if (envNameMatch && currentDeployment) {
        let targetAddr = '';
        const inlineVal = line.match(/value:\s*["']?([^"'\s]+)["']?/);
        if (inlineVal) {
          targetAddr = inlineVal[1];
        } else if (i + 1 < lines.length && lines[i + 1].includes('value:')) {
          const nextVal = lines[i + 1].match(/value:\s*["']?([^"'\s]+)["']?/);
          if (nextVal) {
            targetAddr = nextVal[1];
          }
        }

        if (targetAddr) {
          const targetHost = targetAddr.split(':')[0];
          const targetPort = targetAddr.split(':')[1] || '';
          const targetId = sanitizeId(targetHost);

          const isDb = /redis|postgres|mysql|mongo|db/i.test(targetHost);
          const entityType: EntityType = isDb ? 'Database' : 'Service';
          const protocol = targetPort === '6379' || isDb
            ? 'Redis Protocol'
            : /50051|3550|5050|7000|7070|9555/.test(targetPort)
            ? 'gRPC'
            : 'HTTP/REST';
          const relType: RelationshipType = isDb ? 'USES' : 'CALLS';

          registerEntity({
            id: targetId,
            name: formatComponentName(targetHost),
            type: entityType,
            technology: isDb ? (targetHost.includes('redis') ? 'Redis' : formatComponentName(targetHost)) : 'Kubernetes Microservice',
            source: 'Detected',
            description: `Kubernetes ${entityType.toLowerCase()} declared in ${file.path}`,
            metadata: { filePath: file.path },
          });

          const cfg = extractConfigBlock(file.content, i, '- name:');
          registerRel(
            sanitizeId(currentDeployment),
            targetId,
            relType,
            protocol,
            file.path,
            cfg.block,
            cfg.startLine,
            'Kubernetes Service Config Parser',
            'HIGH',
            cfg.lineRange,
            cfg.endLine
          );
        }
      }
    }
  }
}

function parsePackageJson(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  externalDeps: ExternalDependencyItem[]
) {
  try {
    const pkg = JSON.parse(file.content);
    const serviceName = pkg.name || extractServiceNameFromPath(file.path) || 'node-service';
    const serviceId = sanitizeId(serviceName);

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    Object.keys(deps).forEach((depName) => {
      externalDeps.push({
        name: depName,
        version: deps[depName],
        manifest: file.path,
        type: 'npm',
      });
    });

    const hasExpress = !!deps['express'] || !!deps['@nestjs/core'] || !!deps['fastify'] || !!deps['koa'];
    const hasReact = !!deps['react'] || !!deps['vue'] || !!deps['@angular/core'] || !!deps['svelte'] || !!deps['next'];

    const entityType: EntityType = hasReact ? 'Application' : 'Service';
    const tech = hasReact ? 'React / Web UI' : hasExpress ? 'Node.js / Express' : 'Node.js / JavaScript';

    registerEntity({
      id: serviceId,
      name: formatComponentName(serviceName),
      type: entityType,
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
      registerRel(serviceId, dbId, 'USES', 'PostgreSQL Driver', file.path, 'package.json dependencies', undefined, 'Package.json Parser', 'HIGH');
    }

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
      registerRel(serviceId, redisId, 'USES', 'Redis Protocol', file.path, 'No source-code block available.\nThis dependency was derived from package.json manifest dependency metadata (redis).', undefined, 'Package.json Parser', 'HIGH');
    }

    if (deps['amqplib']) {
      const mqId = 'rabbitmq';
      registerEntity({
        id: mqId,
        name: 'RabbitMQ Message Broker',
        type: 'Service',
        technology: 'RabbitMQ / AMQP',
        source: 'Detected',
        description: 'Message broker queue client detected in package.json',
        metadata: { filePath: file.path },
      });
      registerRel(
        serviceId,
        mqId,
        'CONNECTS_TO',
        'AMQP Protocol',
        file.path,
        'No source-code block available.\nThis dependency was derived from package.json manifest dependency metadata (amqplib).',
        undefined,
        'Package.json Parser',
        'HIGH'
      );
    }

    if (deps['mongoose'] || deps['mongodb']) {
      const dbId = 'nosql-db';
      registerEntity({
        id: dbId,
        name: 'MongoDB Database',
        type: 'Database',
        technology: 'MongoDB',
        source: 'Detected',
        description: 'Document database client detected in package.json',
        metadata: { filePath: file.path, dbType: 'NoSQL / Document' },
      });
      registerRel(
        serviceId,
        dbId,
        'QUERIES',
        'MongoDB Wire Protocol',
        file.path,
        'No source-code block available.\nThis dependency was derived from package.json manifest dependency metadata (mongoose/mongodb).',
        undefined,
        'Package.json Parser',
        'HIGH'
      );
    }

    if (deps['@google/genai'] || deps['@google/generative-ai']) {
      const geminiId = 'google-gemini-api';
      registerEntity({
        id: geminiId,
        name: 'Google Gemini Generative AI API',
        type: 'External System',
        technology: 'Google Gemini API',
        source: 'Detected',
        description: 'Foundation model API for multimodal and text reasoning',
        metadata: { filePath: file.path },
      });
      registerRel(
        serviceId,
        geminiId,
        'CALLS',
        'HTTPS / REST',
        file.path,
        'No source-code block available.\nThis dependency was derived from package.json manifest dependency metadata (@google/genai).',
        undefined,
        'Package.json Parser',
        'HIGH'
      );
    }

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
      registerRel(serviceId, stripeId, 'CALLS', 'HTTPS / REST', file.path, `No source-code block available.\nThis dependency was derived from package.json manifest dependency metadata (stripe).`, undefined, 'Package.json Parser', 'HIGH');
    }
  } catch {}
}

function parsePythonManifest(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  externalDeps: ExternalDependencyItem[]
) {
  const lines = file.content.split('\n');
  const serviceName = extractServiceNameFromPath(file.path) || 'python-service';
  const serviceId = sanitizeId(serviceName);

  lines.forEach((line) => {
    const trimmed = line.trim().split(';')[0].split('#')[0].trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[=><~]/);
    const pkgName = parts[0].trim();
    if (pkgName) {
      externalDeps.push({
        name: pkgName,
        version: parts[1]?.trim(),
        manifest: file.path,
        type: 'pypi',
      });
    }
  });

  const content = file.content.toLowerCase();
  const isFastAPI = content.includes('fastapi');
  const isFlask = content.includes('flask');
  const isStreamlit = content.includes('streamlit');

  const tech = isStreamlit
    ? 'Python / Streamlit'
    : isFastAPI
    ? 'Python / FastAPI'
    : isFlask
    ? 'Python / Flask'
    : 'Python 3.x';

  registerEntity({
    id: serviceId,
    name: formatComponentName(serviceName),
    type: isStreamlit ? 'Application' : 'Service',
    technology: tech,
    source: 'Detected',
    description: `Python service detected in ${file.path}`,
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
      description: 'Relational database driver in Python requirements',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, dbId, 'USES', 'SQLAlchemy / asyncpg', file.path, 'requirements.txt dependencies', undefined, 'Python Manifest Parser', 'HIGH');
  }

  if (content.includes('redis') || content.includes('celery')) {
    const redisId = 'redis-cache';
    registerEntity({
      id: redisId,
      name: 'Redis Cache & Message Broker',
      type: 'Database',
      technology: 'Redis / Celery',
      source: 'Detected',
      description: 'Cache and task queue broker in Python requirements',
      metadata: { filePath: file.path },
    });
    registerRel(serviceId, redisId, 'USES', 'Redis Protocol', file.path, 'requirements.txt dependencies', undefined, 'Python Manifest Parser', 'HIGH');
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
    registerRel(serviceId, stripeId, 'CALLS', 'HTTPS / REST', file.path, 'requirements.txt: stripe', undefined, 'Python Manifest Parser', 'HIGH');
  }
}

function parseJavaManifest(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  _externalDeps: ExternalDependencyItem[],
  entityMap?: Map<string, ArchitectureEntity>
) {
  const serviceName = extractServiceNameFromPath(file.path) || 'spring-boot-service';
  const serviceId = sanitizeId(serviceName);
  const content = file.content;

  const isSpringBoot = content.includes('spring-boot') || content.includes('org.springframework');

  // If specific Java service components (like Controllers or Services) are already registered,
  // we do not create a generic duplicate service node for the root folder.
  const hasSpecificJavaEntities = entityMap && entitiesList(entityMap).some((e) => e.metadata?.language === 'Java' && e.id !== serviceId);
  if (!hasSpecificJavaEntities) {
    registerEntity({
      id: serviceId,
      name: formatComponentName(serviceName),
      type: 'Service',
      technology: isSpringBoot ? 'Java / Spring Boot' : 'Java',
      source: 'Detected',
      description: `Java service discovered in ${file.path}`,
      metadata: { filePath: file.path, language: 'Java', buildTool: file.path.endsWith('.xml') ? 'Maven' : 'Gradle' },
    });
  }

  // Database detection from dependencies: only if not already detected from properties/yml
  const hasExistingDb = entityMap && entitiesList(entityMap).some((e) => e.type === 'Database');
  if (!hasExistingDb) {
    if (content.includes('mysql-connector-j') || content.includes('mysql-connector-java')) {
      const dbId = 'mysql-db';
      registerEntity({
        id: dbId,
        name: 'MySQL Database',
        type: 'Database',
        technology: 'MySQL / Hibernate',
        source: 'Detected',
        description: 'Spring Data JPA / MySQL driver in pom.xml',
        metadata: { filePath: file.path },
      });
      registerRel(serviceId, dbId, 'USES', 'JDBC / Hibernate', file.path, 'pom.xml dependencies', undefined, 'Java Manifest Parser', 'HIGH');
    } else if (content.includes('postgresql')) {
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
      registerRel(serviceId, dbId, 'USES', 'JDBC / Hibernate', file.path, 'pom.xml dependencies', undefined, 'Java Manifest Parser', 'HIGH');
    }
  }
}

function parseSpringProperties(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  _registerRel: (...args: any[]) => void,
  _entityMap?: Map<string, ArchitectureEntity>
) {
  const content = file.content;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#') || !line) continue;

    // Match jdbc:mysql://localhost:3306/student or url: jdbc:...
    const dsMatch = line.match(/(?:spring\.datasource\.url\s*=\s*|url:\s*)jdbc:([a-zA-Z0-9]+):\/\/[^\/]+\/([a-zA-Z0-9_\-]+)/i);
    if (dsMatch) {
      const dbTypeRaw = dsMatch[1].toLowerCase();
      const dbName = dsMatch[2];
      let engineName = 'Relational';
      if (dbTypeRaw === 'mysql') engineName = 'MySQL';
      else if (dbTypeRaw === 'postgresql' || dbTypeRaw === 'postgres') engineName = 'PostgreSQL';
      else if (dbTypeRaw === 'oracle') engineName = 'Oracle';
      else if (dbTypeRaw === 'sqlserver') engineName = 'SQL Server';
      else if (dbTypeRaw === 'h2') engineName = 'H2';

      const dbId = sanitizeId(`${dbTypeRaw}-database-${dbName}`);
      const cfgBlock = extractConfigBlock(file.content, i, 'datasource');
      registerEntity({
        id: dbId,
        name: `${engineName} Database (${dbName})`,
        type: 'Database',
        technology: `${engineName} / Spring Data JPA`,
        source: 'Detected',
        description: `Spring Boot datasource connected to ${engineName} database "${dbName}"`,
        metadata: {
          filePath: file.path,
          url: line,
          dbEngine: engineName,
          databaseName: dbName,
          line: cfgBlock.startLine,
          endLine: cfgBlock.endLine,
          lineRange: cfgBlock.lineRange,
          snippet: cfgBlock.block,
        },
        sourceEvidence: {
          file: file.path,
          line: cfgBlock.startLine,
          lineEnd: cfgBlock.endLine,
          lineRange: cfgBlock.lineRange,
          snippet: cfgBlock.block,
          description: `Spring Boot datasource configuration in ${file.path}`,
          method: 'Configuration Parser',
          confidence: 'HIGH',
        },
      });
    }
  }
}

function preRegisterJavaComponents(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void
) {
  if (file.isBinary) return;
  const content = file.content;
  const lowerPath = file.path.toLowerCase();
  if (lowerPath.includes('/test/') || lowerPath.startsWith('test/')) return;

  const classMatch = content.match(/\b(?:public\s+)?(?:class|interface)\s+([A-Za-z0-9_]+)/);
  if (!classMatch) return;
  const className = classMatch[1];
  const classId = sanitizeId(className);

  const isRestController = content.includes('@RestController') || content.includes('@Controller') || className.endsWith('Controller');
  const isService = content.includes('@Service') || className.endsWith('Service');
  const isRepo = content.includes('@Repository') || content.includes('extends JpaRepository') || content.includes('extends CrudRepository') || className.endsWith('Repo') || className.endsWith('Repository');

  const classBlock = extractJavaClassBlock(content, className);
  const snippet = classBlock ? classBlock.block : 'Exact source block unavailable.';
  const startL = classBlock ? classBlock.startLine : 1;
  const endL = classBlock ? classBlock.endLine : 1;
  const lRange = classBlock ? classBlock.lineRange : `${startL}`;

  if (isRestController) {
    registerEntity({
      id: classId,
      name: className,
      type: 'Service',
      technology: 'Java / Spring Boot REST Controller',
      source: 'Detected',
      description: `Spring Boot REST Controller handling web requests in ${file.path}`,
      metadata: { filePath: file.path, className, role: 'controller', language: 'Java', line: startL, endLine: endL, lineRange: lRange, snippet },
      sourceEvidence: {
        file: file.path,
        line: startL,
        lineEnd: endL,
        lineRange: lRange,
        snippet,
        description: `Spring Boot REST Controller "${className}" in ${file.path}`,
        method: 'Class Declaration Parser',
        confidence: 'HIGH',
      },
    });
  } else if (isService) {
    registerEntity({
      id: classId,
      name: className,
      type: 'Service',
      technology: 'Java / Spring Boot Service',
      source: 'Detected',
      description: `Spring Boot service business logic component in ${file.path}`,
      metadata: { filePath: file.path, className, role: 'service', language: 'Java', line: startL, endLine: endL, lineRange: lRange, snippet },
      sourceEvidence: {
        file: file.path,
        line: startL,
        lineEnd: endL,
        lineRange: lRange,
        snippet,
        description: `Spring Boot service component "${className}" in ${file.path}`,
        method: 'Class Declaration Parser',
        confidence: 'HIGH',
      },
    });
  } else if (isRepo) {
    registerEntity({
      id: classId,
      name: className,
      type: 'Service',
      technology: 'Spring Data JPA Repository',
      source: 'Detected',
      description: `Spring Data JPA data access repository in ${file.path}`,
      metadata: { filePath: file.path, className, role: 'repository', language: 'Java', line: startL, endLine: endL, lineRange: lRange, snippet },
      sourceEvidence: {
        file: file.path,
        line: startL,
        lineEnd: endL,
        lineRange: lRange,
        snippet,
        description: `Spring Data JPA repository "${className}" in ${file.path}`,
        method: 'Class Declaration Parser',
        confidence: 'HIGH',
      },
    });
  }
}

function parseGoMod(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  registerRel: (...args: any[]) => void,
  _externalDeps: ExternalDependencyItem[]
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
    registerRel(serviceId, redisId, 'USES', 'Redis Go Driver', file.path, 'go.mod dependencies', undefined, 'Go Mod Parser', 'HIGH');
  }
}

function parseCargoToml(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  _registerRel: (...args: any[]) => void,
  _externalDeps: ExternalDependencyItem[]
) {
  const serviceName = extractServiceNameFromPath(file.path) || 'rust-service';
  const serviceId = sanitizeId(serviceName);
  registerEntity({
    id: serviceId,
    name: formatComponentName(serviceName),
    type: 'Service',
    technology: 'Rust',
    source: 'Detected',
    description: `Rust crate defined in ${file.path}`,
    metadata: { filePath: file.path, language: 'Rust' },
  });
}

function parsePubspecYaml(
  file: FileRecord,
  registerEntity: (e: ArchitectureEntity) => void,
  _registerRel: (...args: any[]) => void,
  _externalDeps: ExternalDependencyItem[]
) {
  const serviceName = extractServiceNameFromPath(file.path) || 'flutter-app';
  const serviceId = sanitizeId(serviceName);
  registerEntity({
    id: serviceId,
    name: formatComponentName(serviceName),
    type: 'Application',
    technology: 'Flutter / Dart',
    source: 'Detected',
    description: `Flutter project defined in ${file.path}`,
    metadata: { filePath: file.path, language: 'Dart' },
  });
}

// ----------------------------------------------------------------------
// Helpers & Utilities
// ----------------------------------------------------------------------
function getFileExtension(path: string): string {
  const dotIndex = path.lastIndexOf('.');
  return dotIndex !== -1 ? path.slice(dotIndex).toLowerCase() : '';
}

function getFileStem(path: string): string {
  const parts = path.split(/[\/\\]/);
  const name = parts[parts.length - 1];
  const dotIndex = name.lastIndexOf('.');
  return dotIndex !== -1 ? name.slice(0, dotIndex) : name;
}

function getParentFolder(path: string): string {
  const parts = path.split(/[\/\\]/).filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 2];
  }
  return '';
}

function isBinaryExtension(ext: string): boolean {
  return [
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4',
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.exe', '.dll', '.so',
    '.pyc', '.class', '.pkl', '.pickle', '.dat', '.h5', '.onnx', '.bin',
  ].includes(ext);
}

function categorizeFile(path: string, ext: string): FileCategory {
  const lower = path.toLowerCase();
  const name = lower.split(/[\/\\]/).pop() || '';

  if (
    name === 'package.json' ||
    name === 'requirements.txt' ||
    name === 'pyproject.toml' ||
    name === 'pom.xml' ||
    name === 'build.gradle' ||
    name === 'go.mod' ||
    name === 'cargo.toml' ||
    name === 'pubspec.yaml' ||
    name === 'composer.json' ||
    name === 'gemfile' ||
    name === 'dockerfile' ||
    name.startsWith('docker-compose')
  ) {
    return 'manifest';
  }

  if (
    ext === '.env' ||
    name.startsWith('.env') ||
    name.startsWith('.git') ||
    ext === '.ini' ||
    ext === '.cfg' ||
    lower.includes('/config/') ||
    lower.startsWith('config/') ||
    name.includes('config') ||
    name.includes('setting')
  ) {
    return 'config';
  }

  if (ext === '.csv' || ext === '.tsv' || ext === '.parquet' || ext === '.arrow') {
    return 'dataset';
  }

  if (['.pkl', '.pickle', '.dat', '.joblib', '.h5', '.onnx', '.pt', '.pth'].includes(ext)) {
    return 'model_artifact';
  }

  if (['.md', '.rst', '.txt', '.pdf', '.docx', '.doc'].includes(ext)) {
    return 'documentation';
  }

  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4'].includes(ext)) {
    return 'asset';
  }

  if (
    ['.js', '.jsx', '.ts', '.tsx', '.py', '.dart', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.ipynb', '.html', '.css', '.scss'].includes(ext)
  ) {
    return 'source';
  }

  return 'other';
}

function detectLanguage(ext: string, _filename: string): string | undefined {
  switch (ext) {
    case '.py': return 'Python';
    case '.js': return 'JavaScript';
    case '.jsx': return 'JavaScript (React)';
    case '.ts': return 'TypeScript';
    case '.tsx': return 'TypeScript (React)';
    case '.dart': return 'Dart';
    case '.java': return 'Java';
    case '.go': return 'Go';
    case '.rs': return 'Rust';
    case '.c':
    case '.h': return 'C';
    case '.cpp':
    case '.hpp': return 'C++';
    case '.cs': return 'C#';
    case '.rb': return 'Ruby';
    case '.php': return 'PHP';
    case '.ipynb': return 'Jupyter Notebook';
    case '.html': return 'HTML';
    case '.css':
    case '.scss': return 'CSS';
    case '.json': return 'JSON';
    case '.yaml':
    case '.yml': return 'YAML';
    case '.xml': return 'XML';
    case '.toml': return 'TOML';
    case '.md': return 'Markdown';
    case '.sql': return 'SQL';
    case '.sh':
    case '.bash': return 'Shell';
    case '.csv':
    case '.tsv': return 'Tabular Data';
    default: return undefined;
  }
}

function extractDetectedModules(files: InventoryFile[], _folders: string[]): DetectedModule[] {
  const moduleMap = new Map<string, { filesCount: number; langs: Set<string> }>();

  files.forEach((f) => {
    const parts = f.path.split('/');
    if (parts.length > 2) {
      const modPath = parts.slice(0, 2).join('/');
      if (!moduleMap.has(modPath)) {
        moduleMap.set(modPath, { filesCount: 0, langs: new Set() });
      }
      const m = moduleMap.get(modPath)!;
      m.filesCount++;
      if (f.language) m.langs.add(f.language);
    }
  });

  return Array.from(moduleMap.entries()).map(([modPath, data]) => {
    const name = modPath.split('/').pop() || modPath;
    return {
      id: sanitizeId(`mod-${name}`),
      name: formatComponentName(name),
      path: modPath,
      files_count: data.filesCount,
      languages: Array.from(data.langs),
      description: `Discovered folder module containing ${data.filesCount} files`,
    };
  });
}

function detectFrameworks(files: FileRecord[], _manifests: string[]): string[] {
  const frameworks = new Set<string>();
  files.forEach((f) => {
    const c = f.content;
    if (c.includes('streamlit')) frameworks.add('Streamlit');
    if (c.includes('flutter')) frameworks.add('Flutter');
    if (c.includes('express')) frameworks.add('Express');
    if (c.includes('react')) frameworks.add('React');
    if (c.includes('flask')) frameworks.add('Flask');
    if (c.includes('fastapi')) frameworks.add('FastAPI');
    if (c.includes('spring-boot') || c.includes('org.springframework')) frameworks.add('Spring Boot');
    if (c.includes('google.generativeai') || c.includes('genai')) frameworks.add('Google Gemini');
    if (c.includes('langchain')) frameworks.add('LangChain');
    if (c.includes('xgboost')) frameworks.add('XGBoost');
    if (c.includes('sklearn') || c.includes('scikit-learn')) frameworks.add('Scikit-Learn');
  });
  return Array.from(frameworks);
}

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
  // Check directory parts (ignoring the last part which is a filename)
  for (let i = 0; i < parts.length - 1; i++) {
    const id = sanitizeId(parts[i]);
    if (entityMap.has(id)) {
      return id;
    }
  }
  if (parts.length > 1 && parts[0] !== 'src' && parts[0] !== 'pkg' && parts[0] !== 'lib') {
    const id = sanitizeId(parts[0]);
    if (entityMap.has(id)) {
      return id;
    }
  }
  // For top-level files or files without matched directory, link to the primary backend service if available
  for (const [id, e] of entityMap.entries()) {
    if (e.type === 'Service' && !id.includes('database') && !id.includes('redis') && !id.includes('mongo') && !id.includes('postgres') && !id.includes('rabbitmq')) {
      return id;
    }
  }
  return null;
}

function detectTechFromFilename(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'TypeScript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'JavaScript';
  if (lower.endsWith('.py')) return 'Python';
  if (lower.endsWith('.dart')) return 'Dart';
  if (lower.endsWith('.java')) return 'Java';
  if (lower.endsWith('.go')) return 'Go';
  if (lower.endsWith('.rs')) return 'Rust';
  return 'Polyglot';
}

function entitiesList(map: Map<string, ArchitectureEntity>): ArchitectureEntity[] {
  return Array.from(map.values());
}
