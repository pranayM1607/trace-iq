import io
import os
import re
import json
import zipfile
import posixpath
from typing import Dict, List, Set, Optional, Tuple, Any
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    yaml = None

from ..models.schemas import (
    ArchitectureModel,
    ArchitectureEntity,
    ArchitectureRelationship,
    ArchitectureStats,
    SourceEvidence,
    EntityType,
    RelationshipType,
    InventoryFile,
    DetectedModule,
    CodebaseFileDependency,
    CodebaseModuleDependency,
    CodebaseNode,
    CodebaseGraph,
    CodebaseInventory,
)
from .dependency_extractor import DependencyExtractor

MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024  # 200 MB
MAX_FILE_COUNT = 5000
IGNORED_DIRS = {
    'node_modules', '.git', 'venv', '.venv', 'dist', 'build',
    '__pycache__', '.idea', '.vscode', '.next', 'target', 'bin', 'obj'
}

BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
    '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.pyo', '.woff', '.woff2',
    '.ttf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.bin', '.dat'
}

def sanitize_id(name: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9_\-]', '-', name.lower().strip())
    cleaned = re.sub(r'-+', '-', cleaned).strip('-')
    return cleaned or 'unknown-component'

def format_component_name(raw_name: str) -> str:
    words = re.split(r'[-_]+', raw_name)
    formatted = ' '.join(w.capitalize() for w in words if w)
    return formatted or raw_name.capitalize()

def detect_file_category(path: str) -> str:
    norm = path.replace("\\", "/").lower()
    base = os.path.basename(norm)
    ext = os.path.splitext(norm)[1]

    # 0. Machine Learning Models & Serialized Artifacts
    if ext in ('.pkl', '.pickle', '.dat', '.joblib', '.h5', '.onnx', '.pt', '.pth', '.tflite', '.safetensors'):
        return 'model_artifact'

    # 0b. Datasets & Tabular / Analytical Data
    if ext in ('.csv', '.tsv', '.parquet', '.jsonl', '.sqlite', '.sqlite3', '.db') or '/datafiles/' in norm or '/datasets/' in norm:
        return 'dataset'

    # 1. Manifests & Build Descriptions
    if base in (
        'docker-compose.yml', 'docker-compose.yaml', 'dockerfile',
        'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
        'requirements.txt', 'pyproject.toml', 'pipfile', 'setup.py', 'setup.cfg',
        'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
        'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock',
        'composer.json', 'composer.lock', 'gemfile', 'gemfile.lock',
        'pubspec.yaml', 'pubspec.lock', 'manifest.json',
        'cmakelists.txt'
    ) or ext in ('.csproj', '.sln', '.fsproj'):
        return 'manifest'

    # 2. Tests
    if (
        '/test/' in norm or '/tests/' in norm or '/__tests__/' in norm
        or '/spec/' in norm or '/specs/' in norm
        or base.startswith('test_') or base.endswith('_test' + ext)
        or '.test.' in base or '.spec.' in base
    ):
        return 'test'

    # 3. Configurations
    if (
        base.startswith('.env') or ext in ('.env', '.conf', '.ini', '.cfg')
        or base in ('tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'vite.config.js', 'webpack.config.js')
        or base.startswith('.eslint') or base.startswith('.prettier')
        or (ext in ('.yaml', '.yml', '.toml', '.json') and any(k in base for k in ('config', 'settings', 'application', 'properties', 'env')))
    ):
        return 'config'

    # 4. Scripts
    if ext in ('.sh', '.bash', '.ps1', '.bat', '.cmd') or '/scripts/' in norm or '/bin/' in norm:
        return 'script'

    # 5. Documentation
    if ext in ('.md', '.markdown', '.rst', '.pdf', '.docx', '.pptx') or base in ('readme', 'readme.txt', 'license', 'license.txt', 'contributing.md') or '/docs/' in norm or '/review/' in norm:
        return 'documentation'

    # 6. Source code & Notebooks
    if ext in (
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.py', '.java', '.go', '.cs', '.c', '.cpp', '.cc', '.h', '.hpp',
        '.rb', '.php', '.rs', '.scala', '.kt', '.kts', '.swift', '.dart',
        '.sql', '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.ipynb'
    ):
        return 'source'

    return 'other'

def detect_file_language(path: str) -> Optional[str]:
    ext = os.path.splitext(path.lower())[1]
    lang_map = {
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.mjs': 'JavaScript',
        '.cjs': 'JavaScript',
        '.py': 'Python',
        '.dart': 'Dart',
        '.ipynb': 'Jupyter Notebook',
        '.java': 'Java',
        '.go': 'Go',
        '.cs': 'C#',
        '.c': 'C',
        '.cpp': 'C++',
        '.cc': 'C++',
        '.h': 'C/C++ Header',
        '.hpp': 'C++ Header',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.rs': 'Rust',
        '.sql': 'SQL',
        '.sh': 'Shell',
        '.bash': 'Shell',
        '.ps1': 'PowerShell',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.json': 'JSON',
        '.toml': 'TOML',
        '.xml': 'XML',
    }
    return lang_map.get(ext)


class CodebaseService:
    @staticmethod
    def _decode_text_safely(raw_data: bytes) -> str:
        """
        Safely decodes source code and manifests, handling UTF-16 with BOM (common in Windows PowerShell redirects),
        UTF-8 with BOM, UTF-8, and Latin-1 fallback.
        """
        if raw_data.startswith((b'\xff\xfe', b'\xfe\xff')):
            try:
                return raw_data.decode('utf-16')
            except Exception:
                pass
        if b'\x00' in raw_data[:500] and len(raw_data) % 2 == 0:
            try:
                return raw_data.decode('utf-16')
            except Exception:
                pass
        try:
            return raw_data.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return raw_data.decode('utf-8-sig')
            except UnicodeDecodeError:
                return raw_data.decode('latin-1', errors='replace')

    @staticmethod
    def extract_from_zip(zip_bytes: bytes, filename: str = "codebase.zip") -> ArchitectureModel:
        if not zip_bytes:
            raise ValueError("Uploaded ZIP file is empty.")

        if not zip_bytes.startswith(b"PK\x03\x04"):
            raise ValueError("Invalid ZIP file signature.")

        all_file_records: List[Dict[str, Any]] = []
        folders_set: Set[str] = set()

        try:
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                infos = zf.infolist()
                if len(infos) > MAX_FILE_COUNT:
                    raise ValueError(f"ZIP contains too many entries ({len(infos)} > {MAX_FILE_COUNT}).")

                total_uncompressed = sum(info.file_size for info in infos)
                if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                    raise ValueError(f"Uncompressed archive exceeds safety limit ({total_uncompressed} bytes).")

                for info in infos:
                    norm_path = os.path.normpath(info.filename).replace("\\", "/")
                    if (
                        norm_path.startswith("/")
                        or norm_path.startswith("../")
                        or "/../" in norm_path
                        or norm_path == ".."
                    ):
                        raise ValueError(f"Security error: Invalid entry path '{info.filename}'.")

                    # Record folders
                    dir_name = os.path.dirname(norm_path)
                    if dir_name and dir_name != ".":
                        parts = dir_name.split("/")
                        for i in range(1, len(parts) + 1):
                            sub = "/".join(parts[:i])
                            folders_set.add(sub)

                    if info.is_dir():
                        continue

                    # Filter standard ignored paths from extraction
                    path_parts = norm_path.split("/")
                    if any(part in IGNORED_DIRS for part in path_parts):
                        continue

                    ext = os.path.splitext(norm_path)[1].lower()
                    cat = detect_file_category(norm_path)
                    lang = detect_file_language(norm_path)

                    # Read text content safely if not a binary file and within 5MB
                    content: Optional[str] = None
                    lines_count: Optional[int] = None

                    if ext not in BINARY_EXTENSIONS and info.file_size <= 5 * 1024 * 1024:
                        try:
                            raw_data = zf.read(info)
                            content = CodebaseService._decode_text_safely(raw_data)
                            lines_count = content.count('\n') + 1 if content else 0
                        except Exception:
                            content = None
                            lines_count = None

                    all_file_records.append({
                        'path': norm_path,
                        'content': content,
                        'size': info.file_size,
                        'lines': lines_count,
                        'category': cat,
                        'language': lang,
                        'extension': ext or 'no-ext'
                    })

        except zipfile.BadZipFile as e:
            raise ValueError(f"Corrupted ZIP archive: {str(e)}")

        return CodebaseService._analyze_files(all_file_records, filename, sorted(list(folders_set)))

    @staticmethod
    def _analyze_files(
        all_files: List[Dict[str, Any]],
        original_filename: str,
        all_folders: List[str]
    ) -> ArchitectureModel:
        entities_dict: Dict[str, ArchitectureEntity] = {}
        relationships: List[ArchitectureRelationship] = []
        relationships_set: Set[Tuple[str, str, str]] = set()
        manifests_found: List[str] = []
        configs_found: List[str] = []
        frameworks_set: Set[str] = set()
        external_packages_set: Set[str] = set()
        shared_libraries_set: Set[str] = set()

        def register_entity(entity: ArchitectureEntity):
            if entity.id not in entities_dict:
                entities_dict[entity.id] = entity
            else:
                existing = entities_dict[entity.id]
                existing.metadata.update(entity.metadata)
                if entity.description and not existing.description:
                    existing.description = entity.description
                if existing.type in ('Application', 'Module') and entity.type not in ('Application', 'Module'):
                    existing.type = entity.type
                if existing.technology == 'Generic' and entity.technology != 'Generic':
                    existing.technology = entity.technology
                if entity.sourceEvidence and not existing.sourceEvidence:
                    existing.sourceEvidence = entity.sourceEvidence
                for ev in entity.evidenceList:
                    if ev not in existing.evidenceList:
                        existing.evidenceList.append(ev)
                for f in entity.associatedFiles:
                    if f not in existing.associatedFiles:
                        existing.associatedFiles.append(f)

        def register_relationship(
            source: str,
            target: str,
            rel_type: RelationshipType,
            protocol: str,
            file_path: str,
            snippet: str,
            line: Optional[int] = None,
            description: Optional[str] = None
        ):
            if source == target:
                return
            key = (source, target, rel_type)
            if key in relationships_set:
                return
            relationships_set.add(key)
            rel_id = f"rel-{source}-{target}-{rel_type.lower()}"
            relationships.append(
                ArchitectureRelationship(
                    id=rel_id,
                    source=source,
                    target=target,
                    type=rel_type,
                    protocol=protocol,
                    sourceEvidence=SourceEvidence(
                        file=file_path,
                        line=line,
                        snippet=snippet[:200] if snippet else None,
                        description=f"Detected in {file_path}",
                        detectionMethod="Cross-Component Reference",
                    ),
                    description=description or f"{source} {rel_type} {target} via {protocol}",
                )
            )

        # Determine common root prefix (e.g. repo-name/...)
        common_root = ""
        if all_files:
            first_parts = all_files[0]['path'].split('/')
            if len(first_parts) > 1:
                cand_root = first_parts[0]
                if all(f['path'].startswith(cand_root + '/') for f in all_files):
                    common_root = cand_root

        # Filter readable text files
        text_files = [f for f in all_files if f.get('content') is not None]

        # 1. Parse Docker Compose manifests
        for f in text_files:
            p_lower = f['path'].lower()
            if p_lower.endswith(('docker-compose.yml', 'docker-compose.yaml')):
                manifests_found.append(f['path'])
                frameworks_set.add('Docker Compose')
                CodebaseService._parse_docker_compose(f, register_entity, register_relationship)

        # 2. Parse Package & Dependency Manifests
        for f in text_files:
            p_lower = f['path'].lower()
            if p_lower.endswith('package.json') and not p_lower.endswith('package-lock.json'):
                manifests_found.append(f['path'])
                CodebaseService._parse_package_json(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set, common_root
                )
            elif p_lower.endswith(('requirements.txt', 'pyproject.toml', 'pipfile')):
                manifests_found.append(f['path'])
                CodebaseService._parse_python_manifest(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set, common_root
                )
            elif p_lower.endswith(('pom.xml', 'build.gradle', 'build.gradle.kts')):
                manifests_found.append(f['path'])
                CodebaseService._parse_java_manifest(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set
                )
            elif p_lower.endswith('go.mod'):
                manifests_found.append(f['path'])
                CodebaseService._parse_go_mod(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set
                )
            elif p_lower.endswith('.csproj'):
                manifests_found.append(f['path'])
                CodebaseService._parse_csharp_manifest(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set
                )
            elif p_lower.endswith('cargo.toml'):
                manifests_found.append(f['path'])
                CodebaseService._parse_rust_manifest(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set
                )
            elif p_lower.endswith('composer.json'):
                manifests_found.append(f['path'])
                CodebaseService._parse_php_manifest(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set
                )
            elif p_lower.endswith('gemfile'):
                manifests_found.append(f['path'])
                CodebaseService._parse_ruby_manifest(
                    f, register_entity, register_relationship, frameworks_set, external_packages_set
                )
            elif f['category'] == 'config':
                configs_found.append(f['path'])

        # 2b. Detect Subsystems (Extensions, Mobile Apps, ML Models, Datasets, Training Pipelines, Feature Modules)
        CodebaseService._detect_architecture_subsystems(
            all_files, entities_dict, register_entity, register_relationship, frameworks_set, common_root
        )

        # 3. Detect Monolith / Internal Modules
        detected_modules_list = CodebaseService._detect_internal_modules(
            all_files, entities_dict, register_entity, register_relationship
        )

        # 4. Parse Source Code for APIs, HTTP Calls, DB Connections, Shared Libs
        source_files = [f for f in text_files if f['category'] == 'source']
        for f in source_files:
            CodebaseService._parse_source_code(
                f, entities_dict, register_entity, register_relationship, shared_libraries_set
            )

        # 5. Extract language-aware file and module dependencies
        file_dependencies, codebase_graph, module_deps = DependencyExtractor.extract_dependencies(
            all_files, detected_modules_list
        )

        # 6. Wire extracted cross-service and module dependencies into architecture relationships
        CodebaseService._wire_extracted_dependencies(
            file_dependencies, module_deps, entities_dict, register_relationship
        )

        # 7. Handle Limited / Minimal Architecture Gracefully
        is_limited_arch = False
        limited_reason: Optional[str] = None

        if len(entities_dict) == 0:
            root_id = "application-core"
            primary_lang = "Generic"
            lang_counts = CodebaseService._compute_language_counts(all_files)
            if lang_counts:
                primary_lang = max(lang_counts.items(), key=lambda x: x[1])[0]

            root_evidence = SourceEvidence(
                file=all_files[0]['path'] if all_files else "archive",
                line=1,
                snippet="Repository entrypoint",
                description="Root application inferred from file inventory",
                detectionMethod="Topological Fallback",
                folderModule="root",
            )

            register_entity(
                ArchitectureEntity(
                    id=root_id,
                    name=format_component_name(os.path.splitext(os.path.basename(original_filename))[0] or "Application"),
                    type="Application",
                    technology=f"{primary_lang} Application",
                    source="Detected",
                    description=f"Standalone application ({len(all_files)} total files cataloged in inventory).",
                    sourceEvidence=root_evidence,
                    evidenceList=[root_evidence],
                    associatedFiles=[f['path'] for f in all_files[:20]],
                    metadata={"totalFiles": len(all_files), "primaryLanguage": primary_lang},
                )
            )
            is_limited_arch = True
            limited_reason = "Service-level boundaries could not be confidently inferred from this codebase. Explore the complete file inventory, manifests, and modules in the Codebase tab."

        elif len(entities_dict) == 1:
            is_limited_arch = True
            limited_reason = "Service-level boundaries could not be confidently inferred from this codebase. Explore the complete file inventory, manifests, and modules in the Codebase tab."
            single_ent = list(entities_dict.values())[0]
            if single_ent.id == "application-core" or single_ent.type == "Service":
                single_ent.type = "Application"

        # Associate remaining files with matching entities using exact files & longest prefix resolution
        for f in all_files:
            p = f['path']
            enc_id = CodebaseService._find_enclosing_service(p, entities_dict)
            if enc_id and enc_id in entities_dict:
                f['associated_entity_id'] = enc_id
                if p not in entities_dict[enc_id].associatedFiles:
                    entities_dict[enc_id].associatedFiles.append(p)

        # Clean dangling relationships
        valid_entity_ids = set(entities_dict.keys())
        pruned_relationships = [
            r for r in relationships
            if r.source in valid_entity_ids and r.target in valid_entity_ids
        ]

        # Compute summary stats
        entities_list = list(entities_dict.values())
        stats = ArchitectureStats(
            services=sum(1 for e in entities_list if e.type in ('Service', 'Application')),
            apis=sum(1 for e in entities_list if e.type == 'API'),
            databases=sum(1 for e in entities_list if e.type in ('Database', 'Queue')),
            modules=sum(1 for e in entities_list if e.type in ('Module', 'Package')),
            libraries=sum(1 for e in entities_list if e.type == 'Library'),
            externalSystems=sum(1 for e in entities_list if e.type == 'External System'),
            totalEntities=len(entities_list),
            totalRelationships=len(pruned_relationships),
            detectedCount=len(entities_list),
            userProvidedCount=0,
        )

        # Assemble CodebaseInventory
        lang_distribution = CodebaseService._compute_language_counts(all_files)
        cat_distribution: Dict[str, int] = {}
        for f in all_files:
            c = f['category']
            cat_distribution[c] = cat_distribution.get(c, 0) + 1

        inventory_files = [
            InventoryFile(
                path=f['path'],
                category=f['category'],
                extension=f['extension'],
                size_bytes=f['size'],
                lines_count=f['lines'],
                language=f['language'],
                associated_entity_id=f.get('associated_entity_id')
            )
            for f in all_files
        ]

        inventory = CodebaseInventory(
            total_files=len(all_files),
            total_folders=len(all_folders),
            total_lines=sum(f['lines'] or 0 for f in all_files),
            languages=lang_distribution,
            frameworks=sorted(list(frameworks_set)),
            categories_breakdown=cat_distribution,
            manifests=sorted(manifests_found),
            config_files=sorted(configs_found),
            modules=detected_modules_list,
            packages=sorted(list(external_packages_set))[:50],
            libraries=sorted(list(shared_libraries_set))[:30],
            endpoints_count=stats.apis,
            datastores_count=stats.databases,
            external_integrations_count=stats.externalSystems,
            files=inventory_files,
            folders=all_folders,
            file_dependencies=file_dependencies,
            codebase_graph=codebase_graph,
            detection_summary=f"Cataloged {len(all_files)} files across {len(all_folders)} directories. Extracted {len(entities_list)} architecture entities and {len(pruned_relationships)} dependencies.",
            is_limited_architecture=is_limited_arch,
            limited_architecture_reason=limited_reason,
        )

        # System name
        system_name = os.path.splitext(os.path.basename(original_filename))[0]
        if system_name.lower() in ('codebase', 'archive', 'repo', 'master', 'main', 'test'):
            first_service = next((e for e in entities_list if e.type in ('Service', 'Application')), None)
            if first_service:
                system_name = f"{first_service.name} System"
            else:
                system_name = "Extracted Software System"
        else:
            system_name = format_component_name(system_name)

        return ArchitectureModel(
            systemName=system_name,
            version="1.0.0",
            extractedAt=datetime.now(timezone.utc).isoformat(),
            inputType="codebase_zip",
            sourceArtifacts=manifests_found or [original_filename],
            entities=entities_list,
            relationships=pruned_relationships,
            stats=stats,
            inventory=inventory,
            codebaseGraph=codebase_graph,
            isLimitedArchitecture=is_limited_arch,
            limitedArchitectureReason=limited_reason,
        )

    @staticmethod
    def _detect_architecture_subsystems(
        all_files: List[Dict[str, Any]],
        entities_dict: Dict[str, ArchitectureEntity],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        common_root: str = ""
    ):
        """
        Extracts concrete architectural subsystems found in modern software repositories:
        - Browser Extensions (Chrome Manifest V2/V3)
        - Mobile Applications (Flutter/Dart, Swift, Kotlin)
        - Serialized ML Model Artifacts (.pkl, .dat, .onnx, .pt, .pth, etc.)
        - Tabular / Analytical Datasets (.csv, .tsv, .parquet, .sqlite)
        - ML Model Training Pipelines & Notebooks (train_model.py, *.ipynb)
        - Standalone Feature Extraction / Domain Modules (URLFeatureExtraction.py, utils.py)
        """
        # 1. Browser Extensions (Chrome Extension with manifest.json)
        for f in all_files:
            p_lower = f['path'].lower()
            if p_lower.endswith('manifest.json') and f.get('content'):
                cnt = f['content']
                if any(k in cnt for k in ('manifest_version', 'browser_action', 'action', 'chrome_url_overrides')):
                    frameworks_set.add('Chrome Extension')
                    ext_dir = posixpath.dirname(f['path'])
                    ext_files = [x['path'] for x in all_files if x['path'].startswith(ext_dir + '/') or x['path'] == f['path']]
                    
                    ext_name = "Browser Extension"
                    m_name = re.search(r'"name"\s*:\s*"([^"]+)"', cnt)
                    if m_name and not m_name.group(1).startswith('__MSG_'):
                        ext_name = m_name.group(1)
                    else:
                        folder_leaf = ext_dir.split('/')[-1] if ext_dir else "Extension"
                        ext_name = format_component_name(folder_leaf)

                    ext_id = sanitize_id(f"ext-{ext_name}")
                    ev = SourceEvidence(
                        file=f['path'],
                        line=1,
                        snippet=cnt.split('\n')[0] if cnt else None,
                        description=f"Browser Extension manifest at {f['path']}",
                        detectionMethod="Browser Extension Manifest (V2/V3)",
                        folderModule=ext_dir,
                    )
                    register_entity(
                        ArchitectureEntity(
                            id=ext_id,
                            name=ext_name,
                            type='Application',
                            technology='Chrome Extension / JavaScript',
                            source='Detected',
                            description=f"Client browser extension ({len(ext_files)} files in /{ext_dir})",
                            sourceEvidence=ev,
                            evidenceList=[ev],
                            associatedFiles=ext_files,
                            metadata={"manifestPath": f['path'], "filesCount": len(ext_files)}
                        )
                    )

        # 2. Mobile / Flutter / Client Applications (.dart / pubspec.yaml)
        dart_files = [f for f in all_files if f['path'].endswith('.dart')]
        if dart_files:
            frameworks_set.add('Flutter / Dart')
            main_dart = next((f for f in dart_files if posixpath.basename(f['path']) == 'main.dart'), dart_files[0])
            app_dir = posixpath.dirname(main_dart['path'])
            app_files = [x['path'] for x in all_files if x['path'].startswith(app_dir + '/') or x['path'].endswith('.dart')]
            
            folder_leaf = app_dir.split('/')[-1] if app_dir else "Mobile App"
            app_name = format_component_name(folder_leaf)
            app_id = sanitize_id(f"app-{app_name}")

            ev = SourceEvidence(
                file=main_dart['path'],
                line=1,
                snippet=main_dart.get('content', '').split('\n')[0] if main_dart.get('content') else None,
                description=f"Mobile application entrypoint at {main_dart['path']}",
                detectionMethod="Flutter / Dart App Detection",
                folderModule=app_dir,
            )
            register_entity(
                ArchitectureEntity(
                    id=app_id,
                    name=app_name,
                    type='Application',
                    technology='Flutter / Dart',
                    source='Detected',
                    description=f"Cross-platform mobile application ({len(app_files)} files in /{app_dir})",
                    sourceEvidence=ev,
                    evidenceList=[ev],
                    associatedFiles=app_files,
                    metadata={"entrypoint": main_dart['path'], "filesCount": len(app_files)}
                )
            )

        # 3. Machine Learning Model Artifacts (.pkl, .dat, .onnx, .joblib, .pt, .pth, .h5)
        model_files = [f for f in all_files if f.get('category') == 'model_artifact' or any(f['path'].endswith(x) for x in ('.pkl', '.pickle', '.dat', '.joblib', '.onnx', '.pt', '.pth', '.h5', '.safetensors'))]
        if model_files:
            frameworks_set.add('Scikit-Learn / ML Models')
            first_m = model_files[0]
            model_paths = [m['path'] for m in model_files]
            m_dir = posixpath.dirname(first_m['path'])
            folder_mod = None if (not m_dir or m_dir == "." or m_dir == common_root) else m_dir

            ev = SourceEvidence(
                file=first_m['path'],
                line=1,
                snippet=f"Model artifact: {posixpath.basename(first_m['path'])} ({first_m['size']} bytes)",
                description=f"Trained machine learning model artifact at {first_m['path']}",
                detectionMethod="ML Binary Artifact Scan",
                folderModule=folder_mod,
            )
            register_entity(
                ArchitectureEntity(
                    id="ml-model-artifacts",
                    name="Trained ML Models",
                    type="Infrastructure",
                    technology="Model Artifacts (Pickle / Joblib)",
                    source="Detected",
                    description=f"Serialized ML model artifacts ({len(model_files)} weights/classifier files: {', '.join([posixpath.basename(p) for p in model_paths[:3]])})",
                    sourceEvidence=ev,
                    evidenceList=[ev],
                    associatedFiles=model_paths,
                    metadata={"totalModels": len(model_files), "modelFiles": [posixpath.basename(p) for p in model_paths]}
                )
            )

        # 4. Tabular & Analytical Datasets (.csv, .tsv, .parquet, .sqlite)
        dataset_files = [f for f in all_files if f.get('category') == 'dataset' or any(f['path'].endswith(x) for x in ('.csv', '.tsv', '.parquet', '.sqlite', '.sqlite3', '.db'))]
        if dataset_files:
            first_d = dataset_files[0]
            ds_paths = [d['path'] for d in dataset_files]
            d_dir = posixpath.dirname(first_d['path'])
            folder_name = d_dir.split('/')[-1] if d_dir and d_dir != common_root else "Datasets"
            folder_mod = None if (not d_dir or d_dir == "." or d_dir == common_root) else d_dir

            ev = SourceEvidence(
                file=first_d['path'],
                line=1,
                snippet=f"Dataset: {posixpath.basename(first_d['path'])} ({first_d['size']} bytes)",
                description=f"Dataset file at {first_d['path']}",
                detectionMethod="Tabular Dataset Scanner",
                folderModule=folder_mod,
            )
            register_entity(
                ArchitectureEntity(
                    id="training-datasets",
                    name=f"{format_component_name(folder_name)} Store",
                    type="Database",
                    technology="Tabular Data / CSV",
                    source="Detected",
                    description=f"Training and analytical datasets ({len(dataset_files)} data files: {', '.join([posixpath.basename(p) for p in ds_paths[:3]])})",
                    sourceEvidence=ev,
                    evidenceList=[ev],
                    associatedFiles=ds_paths,
                    metadata={"totalDatasets": len(dataset_files), "dataFiles": [posixpath.basename(p) for p in ds_paths]}
                )
            )

        # 5. ML Training Pipelines & Notebooks (train_model.py, *.ipynb)
        training_files = [
            f for f in all_files 
            if any(k in posixpath.basename(f['path']).lower() for k in ('train', 'training', 'fit_model', 'evaluate'))
            or f['path'].endswith('.ipynb')
        ]
        if training_files:
            frameworks_set.add('Jupyter / ML Training')
            first_t = training_files[0]
            t_paths = [t['path'] for t in training_files]
            t_dir = posixpath.dirname(first_t['path'])
            folder_mod = None if (not t_dir or t_dir == "." or t_dir == common_root) else t_dir

            ev = SourceEvidence(
                file=first_t['path'],
                line=1,
                snippet=first_t.get('content', '').split('\n')[0] if first_t.get('content') else None,
                description=f"Training workflow script at {first_t['path']}",
                detectionMethod="Training Pipeline Heuristic",
                folderModule=folder_mod,
            )
            register_entity(
                ArchitectureEntity(
                    id="model-training-pipeline",
                    name="Model Training Pipeline",
                    type="Worker",
                    technology="Python / ML Pipeline",
                    source="Detected",
                    description=f"Machine learning model training and evaluation pipelines ({len(training_files)} scripts & notebooks)",
                    sourceEvidence=ev,
                    evidenceList=[ev],
                    associatedFiles=t_paths,
                    metadata={"totalWorkflows": len(training_files), "entrypoints": [posixpath.basename(p) for p in t_paths]}
                )
            )

        # 6. Feature Extraction & Domain Modules
        feature_files = [
            f for f in all_files
            if f.get('category') == 'source' and any(k in posixpath.basename(f['path']).lower() for k in ('featureextraction', 'feature_extraction', 'feature_extractor'))
        ]
        for f in feature_files:
            stem = posixpath.splitext(posixpath.basename(f['path']))[0]
            f_id = sanitize_id(f"mod-{stem}")
            f_name = format_component_name(stem) + " Module"
            ev = SourceEvidence(
                file=f['path'],
                line=1,
                snippet=f['content'].split('\n')[0] if f.get('content') else None,
                description=f"Feature extraction module at {f['path']}",
                detectionMethod="Domain Module Scan",
                folderModule=posixpath.dirname(f['path']),
            )
            register_entity(
                ArchitectureEntity(
                    id=f_id,
                    name=f_name,
                    type="Module",
                    technology="Python Module",
                    source="Detected",
                    description=f"Analytical feature extraction module implemented in {posixpath.basename(f['path'])}",
                    sourceEvidence=ev,
                    evidenceList=[ev],
                    associatedFiles=[f['path']],
                    metadata={"modulePath": f['path']}
                )
            )

    @staticmethod
    def _compute_language_counts(files: List[Dict[str, Any]]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for f in files:
            lang = f.get('language')
            if lang:
                counts[lang] = counts.get(lang, 0) + 1
        return dict(sorted(counts.items(), key=lambda item: item[1], reverse=True))

    @staticmethod
    def _detect_internal_modules(
        all_files: List[Dict[str, Any]],
        entities_dict: Dict[str, ArchitectureEntity],
        register_entity,
        register_relationship,
    ) -> List[DetectedModule]:
        """
        Identifies internal functional modules (e.g. src/auth, src/users, src/orders, src/db, components, services).
        """
        detected_modules: List[DetectedModule] = []
        dir_source_files: Dict[str, List[Dict[str, Any]]] = {}

        functional_names = {
            'auth', 'users', 'user', 'orders', 'order', 'products', 'checkout', 'payment', 'cart',
            'components', 'services', 'controllers', 'routes', 'routers', 'models',
            'database', 'db', 'repositories', 'views', 'api', 'utils', 'helpers',
            'config', 'common', 'shared', 'middleware', 'core', 'engine', 'handlers'
        }

        for f in all_files:
            if f['category'] != 'source':
                continue
            parts = f['path'].replace("\\", "/").split('/')
            if len(parts) < 2:
                continue

            cluster_dir = None
            # Check for functional keyword in any directory level
            for i, part in enumerate(parts[:-1]):
                if part.lower() in functional_names:
                    cluster_dir = "/".join(parts[:i+1])
                    break

            if not cluster_dir:
                if parts[0] in ('src', 'app', 'pkg', 'internal', 'lib', 'packages', 'modules') and len(parts) >= 3:
                    cluster_dir = f"{parts[0]}/{parts[1]}"
                elif len(parts) >= 3 and parts[1] in ('src', 'app', 'pkg', 'internal', 'lib'):
                    cluster_dir = f"{parts[0]}/{parts[1]}/{parts[2]}" if len(parts) >= 4 else f"{parts[0]}/{parts[1]}"
                else:
                    cluster_dir = "/".join(parts[:-1])

            if cluster_dir:
                dir_source_files.setdefault(cluster_dir, []).append(f)

        service_count = sum(1 for e in entities_dict.values() if e.type in ('Service', 'Application'))
        # Elevate modules for monoliths (<=1 service) or small projects (<=2 services)
        should_elevate = service_count <= 2

        for cluster_dir, files in dir_source_files.items():
            mod_id = sanitize_id(f"mod-{cluster_dir}")
            mod_name = format_component_name(cluster_dir.split('/')[-1]) + " Module"
            langs = list(set(f['language'] for f in files if f.get('language')))
            primary_tech = langs[0] if langs else "Source Module"

            dm = DetectedModule(
                id=mod_id,
                name=mod_name,
                path=cluster_dir,
                files_count=len(files),
                languages=langs,
                description=f"Internal functional package under {cluster_dir}/ with {len(files)} source files."
            )
            detected_modules.append(dm)

            # If this directory is already a registered service or root application, do not elevate as a redundant sub-module
            cand_svc = sanitize_id(cluster_dir.split('/')[-1])
            cand_full = sanitize_id(cluster_dir)
            if cand_svc in entities_dict or cand_full in entities_dict:
                continue

            if should_elevate:
                first_file = files[0]['path']
                first_content = files[0].get('content') or ""
                first_snippet = first_content.split('\n')[0] if first_content else None

                # Detect if module is database/storage using word boundaries (avoid matching "db" in "feedback")
                is_db = bool(re.search(r'\b(db|database|storage|repository|sql|orm|models)\b', cluster_dir.lower())) or any(p.lower() in ('db', 'database', 'storage', 'models') for p in cluster_dir.split('/'))
                e_type: EntityType = 'Database' if is_db else 'Module'

                evidence = SourceEvidence(
                    file=first_file,
                    line=1,
                    snippet=first_snippet[:150] if first_snippet else None,
                    description=f"Extracted from package directory {cluster_dir}",
                    detectionMethod="Directory Module Heuristic",
                    folderModule=cluster_dir,
                )

                register_entity(
                    ArchitectureEntity(
                        id=mod_id,
                        name=mod_name,
                        type=e_type,
                        technology=primary_tech,
                        source="Detected",
                        description=f"Internal architectural module ({len(files)} files in /{cluster_dir})",
                        sourceEvidence=evidence,
                        evidenceList=[evidence],
                        associatedFiles=[f['path'] for f in files],
                        metadata={"modulePath": cluster_dir, "filesCount": len(files)},
                    )
                )

        # Detect cross-module import relationships between detected modules
        for cluster_dir, files in dir_source_files.items():
            source_id = sanitize_id(f"mod-{cluster_dir}")
            if source_id not in entities_dict:
                continue

            for f in files:
                content = f.get('content')
                if not content:
                    continue
                for other_dir in dir_source_files.keys():
                    if other_dir == cluster_dir:
                        continue
                    target_id = sanitize_id(f"mod-{other_dir}")
                    if target_id not in entities_dict:
                        continue

                    other_leaf = other_dir.split('/')[-1]
                    patterns = [
                        rf'(?:from|import)\s+.*(?:{re.escape(other_dir)}|{re.escape(other_leaf)})',
                        rf'(?:import|require)\([\'"].*[\/]{re.escape(other_leaf)}[\'"]\)',
                        rf'(?:from|import)\s+[\'"].*[\/]{re.escape(other_leaf)}[\'"]',
                    ]
                    for idx, line in enumerate(content.split('\n')):
                        for pat in patterns:
                            if re.search(pat, line):
                                register_relationship(
                                    source_id, target_id, "USES", "Internal Import",
                                    f['path'], line.strip(), idx + 1,
                                    f"{source_id} imports {other_leaf}"
                                )
                                break

        return detected_modules

    @staticmethod
    def _wire_extracted_dependencies(
        file_dependencies: List[CodebaseFileDependency],
        module_deps: List[CodebaseModuleDependency],
        entities_dict: Dict[str, ArchitectureEntity],
        register_relationship,
    ):
        """
        Connects architecture entities using concrete file dependencies and module dependencies.
        """
        # 1. Wire cross-service / cross-component file dependencies
        for dep in file_dependencies:
            src_svc = CodebaseService._find_enclosing_service(dep.source_file, entities_dict)
            tgt_svc = CodebaseService._find_enclosing_service(dep.target_file, entities_dict)

            if src_svc and tgt_svc and src_svc != tgt_svc:
                if dep.type in ('CALLS', 'USES', 'DEPENDS_ON', 'CONNECTS_TO', 'QUERIES', 'PUBLISHES', 'SUBSCRIBES'):
                    rel_type = dep.type
                elif dep.type in ('IMPORTS', 'REQUIRES', 'INCLUDES'):
                    rel_type = 'USES'
                else:
                    rel_type = 'CALLS'

                register_relationship(
                    src_svc,
                    tgt_svc,
                    rel_type,
                    dep.detectionMethod or "Cross-Component Reference",
                    dep.source_file,
                    dep.snippet or dep.statement or f"Reference in {dep.source_file}",
                    dep.line,
                    f"{src_svc} {rel_type} {tgt_svc} ({dep.statement or dep.source_file})"
                )

        # 2. Wire module-to-module dependencies
        for mdep in module_deps:
            if mdep.source_module in entities_dict and mdep.target_module in entities_dict:
                ev = mdep.sample_evidence
                register_relationship(
                    mdep.source_module,
                    mdep.target_module,
                    mdep.type,
                    "Internal Import",
                    ev.file if ev else "module",
                    ev.snippet if ev else None,
                    ev.line if ev else None,
                    f"{mdep.source_module} imports {mdep.target_module}"
                )

    @staticmethod
    def _parse_docker_compose(file: Dict[str, Any], register_entity, register_relationship):
        content = file.get('content') or ''
        services_data: Dict[str, Any] = {}

        if yaml:
            try:
                parsed = yaml.safe_load(content)
                if isinstance(parsed, dict) and 'services' in parsed and isinstance(parsed['services'], dict):
                    services_data = parsed['services']
            except Exception:
                pass

        if services_data:
            for service_name, config in services_data.items():
                if not isinstance(config, dict):
                    config = {}
                s_id = sanitize_id(service_name)
                image = str(config.get('image', '')).lower()
                is_db = bool(re.search(r'postgres|mysql|mongo|redis|mariadb|cockroach|dynamodb|rabbitmq|kafka', f"{s_id} {image}"))
                e_type: EntityType = 'Database' if is_db else 'Service'
                tech = image or ('Database Container' if is_db else 'Docker Container')

                ev = SourceEvidence(
                    file=file['path'],
                    line=1,
                    snippet=f"services:\n  {service_name}:\n    image: {image}" if image else f"services:\n  {service_name}:",
                    description=f"Containerized {e_type.lower()} declared in {file['path']}",
                    detectionMethod="Docker Compose Declaration",
                    folderModule=os.path.dirname(file['path']) or "root",
                )

                register_entity(
                    ArchitectureEntity(
                        id=s_id,
                        name=format_component_name(service_name),
                        type=e_type,
                        technology=tech,
                        source="Detected",
                        description=f"Containerized {e_type.lower()} declared in {file['path']}",
                        sourceEvidence=ev,
                        evidenceList=[ev],
                        associatedFiles=[file['path']],
                        metadata={"filePath": file['path'], "image": image},
                    )
                )

                # depends_on
                depends_on = config.get('depends_on', [])
                if isinstance(depends_on, dict):
                    depends_on = list(depends_on.keys())
                elif not isinstance(depends_on, list):
                    depends_on = [depends_on]

                for dep in depends_on:
                    dep_id = sanitize_id(str(dep))
                    register_relationship(
                        s_id, dep_id, "DEPENDS_ON", "Docker Network",
                        file['path'], f"depends_on: {dep}"
                    )

                # environment variables referencing other services or databases
                env = config.get('environment', [])
                env_dict = {}
                if isinstance(env, dict):
                    env_dict = env
                elif isinstance(env, list):
                    for item in env:
                        if isinstance(item, str) and '=' in item:
                            k, v = item.split('=', 1)
                            env_dict[k.strip()] = v.strip()

                for k, v in env_dict.items():
                    v_str = str(v)
                    db_match = re.search(r'(?:postgres|mysql|mongo|redis|mariadb|amqp|kafka):\/\/(?:[^:@]+(?::[^@]*)?@)?([a-zA-Z0-9_\-]+)', v_str, re.I)
                    if db_match:
                        target_id = sanitize_id(db_match.group(1))
                        register_relationship(
                            s_id, target_id, "USES", "TCP / Connection URI",
                            file['path'], f"{k}: {v_str}"
                        )
                    elif any(token in k.upper() for token in ('HOST', 'URL', 'ENDPOINT', 'ADDR')):
                        host_match = re.search(r'([a-zA-Z0-9_\-]+)(?::\d+)?', v_str)
                        if host_match:
                            candidate = sanitize_id(host_match.group(1))
                            if candidate and candidate not in ('localhost', '127', '0', 'none'):
                                register_relationship(
                                    s_id, candidate, "CALLS", "Internal Network",
                                    file['path'], f"{k}: {v_str}"
                                )

    @staticmethod
    def _parse_package_json(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str],
        common_root: str = "",
    ):
        content = file.get('content')
        if not content:
            return
        try:
            pkg = json.loads(content)
        except Exception:
            return

        folder_dir = os.path.dirname(file['path'])
        folder_module = "root" if (not folder_dir or folder_dir == "." or folder_dir == common_root) else folder_dir
        extracted_name = pkg.get('name') or CodebaseService._extract_service_name_from_path(file['path'], common_root)
        service_name = extracted_name or (common_root if common_root and common_root.lower() not in ('src', 'app', 'repo', 'archive', 'master', 'main') else 'node-service')
        service_id = sanitize_id(service_name)

        deps = {**pkg.get('dependencies', {}), **pkg.get('devDependencies', {})}
        for d in list(deps.keys())[:30]:
            external_packages_set.add(d)

        has_express = any(k in deps for k in ('express', '@nestjs/core', 'fastify', 'koa'))
        has_react = any(k in deps for k in ('react', 'vue', '@angular/core', 'svelte', 'next'))

        if has_react:
            frameworks_set.add('React / Web UI')
        if has_express:
            frameworks_set.add('Express / Node.js')
        if '@nestjs/core' in deps:
            frameworks_set.add('NestJS')
        if 'next' in deps:
            frameworks_set.add('Next.js')

        tech = 'React / Web UI' if has_react else ('Node.js / Express' if has_express else 'Node.js')
        e_type: EntityType = 'Application' if has_react else 'Service'

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet=f'"name": "{service_name}", "version": "{pkg.get("version", "1.0.0")}"',
            description=f"Node.js package manifest at {file['path']}",
            detectionMethod="Manifest Analysis (package.json)",
            folderModule=folder_module,
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type=e_type,
                technology=tech,
                source='Detected',
                description=pkg.get('description') or f"Node.js {e_type.lower()} declared in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'version': pkg.get('version')},
            )
        )

        # Database dependencies
        if any(k in deps for k in ('pg', 'typeorm', 'prisma', 'sequelize', 'mysql2')):
            db_id = 'postgres-db'
            frameworks_set.add('PostgreSQL')
            register_entity(
                ArchitectureEntity(
                    id=db_id,
                    name="PostgreSQL Database",
                    type="Database",
                    technology="PostgreSQL",
                    source="Detected",
                    description="Relational database driver identified in package.json",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Database client dependency", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, db_id, "USES", "SQL Driver / ORM", file['path'], "package.json dependencies")

        if any(k in deps for k in ('redis', 'ioredis')):
            redis_id = 'redis-cache'
            frameworks_set.add('Redis')
            register_entity(
                ArchitectureEntity(
                    id=redis_id,
                    name="Redis Cache",
                    type="Database",
                    technology="Redis",
                    source="Detected",
                    description="In-memory cache and key-value datastore",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Redis client dependency", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, redis_id, "USES", "Redis Protocol", file['path'], "package.json dependencies")

        if any(k in deps for k in ('mongodb', 'mongoose')):
            mongo_id = 'mongodb-cluster'
            frameworks_set.add('MongoDB')
            register_entity(
                ArchitectureEntity(
                    id=mongo_id,
                    name="MongoDB Cluster",
                    type="Database",
                    technology="MongoDB",
                    source="Detected",
                    description="NoSQL document database driver",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="MongoDB driver", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, mongo_id, "USES", "MongoDB Wire Protocol", file['path'], "package.json dependencies")

        # External APIs
        if 'stripe' in deps:
            stripe_id = 'stripe-api'
            frameworks_set.add('Stripe')
            register_entity(
                ArchitectureEntity(
                    id=stripe_id,
                    name="Stripe Payment Gateway",
                    type="External System",
                    technology="Stripe REST API",
                    source="Detected",
                    description="Third-party payment and settlement platform",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Stripe SDK dependency", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, stripe_id, "CALLS", "HTTPS / REST", file['path'], "package.json: stripe")

        if any(k in deps for k in ('aws-sdk', '@aws-sdk/client-s3')):
            aws_id = 'aws-cloud-services'
            frameworks_set.add('AWS SDK')
            register_entity(
                ArchitectureEntity(
                    id=aws_id,
                    name="AWS Cloud Services",
                    type="External System",
                    technology="AWS SDK",
                    source="Detected",
                    description="Cloud infrastructure and storage integration",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="AWS SDK", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, aws_id, "CALLS", "AWS HTTPS API", file['path'], "package.json: aws-sdk")

    @staticmethod
    def _parse_python_manifest(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str],
        common_root: str = "",
    ):
        content = file.get('content') or ''
        folder_dir = os.path.dirname(file['path'])
        folder_module = "root" if (not folder_dir or folder_dir == "." or folder_dir == common_root) else folder_dir
        extracted_name = CodebaseService._extract_service_name_from_path(file['path'], common_root)
        service_name = extracted_name or (common_root if common_root and common_root.lower() not in ('src', 'app', 'repo', 'archive', 'master', 'main') else 'python-service')
        service_id = sanitize_id(service_name)
        content_lower = content.lower()

        is_fastapi = 'fastapi' in content_lower
        is_flask = 'flask' in content_lower
        is_django = 'django' in content_lower
        is_streamlit = 'streamlit' in content_lower

        if is_fastapi:
            frameworks_set.add('FastAPI')
        if is_flask:
            frameworks_set.add('Flask')
        if is_django:
            frameworks_set.add('Django')
        if is_streamlit:
            frameworks_set.add('Streamlit')

        for line in content.split('\n'):
            line = line.strip()
            if line and not line.startswith('#'):
                pkg_name = re.split(r'[=<>~;]', line)[0].strip()
                if pkg_name:
                    external_packages_set.add(pkg_name)

        tech = 'Python / Streamlit' if is_streamlit else ('Python / FastAPI' if is_fastapi else ('Python / Flask' if is_flask else ('Python / Django' if is_django else 'Python')))
        e_type: EntityType = 'Application' if (is_streamlit or is_fastapi or is_flask) else 'Service'

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet=content.split('\n')[0] if content else None,
            description=f"Python manifest at {file['path']}",
            detectionMethod="Manifest Analysis (Python)",
            folderModule=folder_module,
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type=e_type,
                technology=tech,
                source='Detected',
                description=f"Python {e_type.lower()} detected in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'Python'},
            )
        )

        # External AI / LLM Systems
        if any(k in content_lower for k in ('google-generativeai', 'google.generativeai', 'google-ai-generativelanguage')):
            gemini_id = 'google-gemini-api'
            frameworks_set.add('Google Gemini API')
            register_entity(
                ArchitectureEntity(
                    id=gemini_id,
                    name="Google Gemini API",
                    type="External System",
                    technology="Gemini REST / gRPC API",
                    source="Detected",
                    description="Cloud Generative AI platform for text analysis, feedback sentiment, and LLM reasoning",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Google Gemini SDK dependency", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, gemini_id, "CALLS", "HTTPS / Gemini API", file['path'], "requirements.txt: google-generativeai")

        if 'openai' in content_lower:
            openai_id = 'openai-api'
            frameworks_set.add('OpenAI API')
            register_entity(
                ArchitectureEntity(
                    id=openai_id,
                    name="OpenAI API",
                    type="External System",
                    technology="OpenAI REST API",
                    source="Detected",
                    description="OpenAI cloud LLM platform",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="OpenAI SDK dependency", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, openai_id, "CALLS", "HTTPS / REST", file['path'], "requirements.txt: openai")

        if 'anthropic' in content_lower:
            anthropic_id = 'anthropic-claude-api'
            frameworks_set.add('Anthropic API')
            register_entity(
                ArchitectureEntity(
                    id=anthropic_id,
                    name="Anthropic Claude API",
                    type="External System",
                    technology="Anthropic REST API",
                    source="Detected",
                    description="Anthropic Claude generative AI platform",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Anthropic SDK dependency", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, anthropic_id, "CALLS", "HTTPS / REST", file['path'], "requirements.txt: anthropic")

        if any(k in content_lower for k in ('psycopg2', 'asyncpg', 'sqlalchemy')):
            db_id = 'postgres-db'
            frameworks_set.add('PostgreSQL')
            register_entity(
                ArchitectureEntity(
                    id=db_id,
                    name="PostgreSQL Database",
                    type="Database",
                    technology="PostgreSQL",
                    source="Detected",
                    description="Relational database driver detected in Python dependencies",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Database client", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, db_id, "USES", "SQLAlchemy / asyncpg", file['path'], "requirements dependencies")

        if any(k in content_lower for k in ('redis', 'celery')):
            redis_id = 'redis-cache'
            frameworks_set.add('Redis / Celery')
            register_entity(
                ArchitectureEntity(
                    id=redis_id,
                    name="Redis Cache & Broker",
                    type="Database",
                    technology="Redis / Celery",
                    source="Detected",
                    description="In-memory cache and task queue broker",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Redis cache/broker", detectionMethod="Manifest Dependency"),
                    associatedFiles=[file['path']],
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, redis_id, "USES", "Redis Protocol", file['path'], "requirements dependencies")

        if 'stripe' in content_lower:
            stripe_id = 'stripe-api'
            frameworks_set.add('Stripe')
            register_entity(
                ArchitectureEntity(
                    id=stripe_id,
                    name="Stripe Payment Gateway",
                    type="External System",
                    technology="Stripe REST API",
                    source="Detected",
                    description="Payment API integration",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Stripe API", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, stripe_id, "CALLS", "HTTPS / REST", file['path'], "requirements: stripe")

    @staticmethod
    def _parse_java_manifest(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str]
    ):
        content = file.get('content') or ''
        service_name = CodebaseService._extract_service_name_from_path(file['path']) or 'spring-service'
        service_id = sanitize_id(service_name)
        is_spring = 'spring-boot' in content or 'org.springframework' in content

        if is_spring:
            frameworks_set.add('Spring Boot')

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet=f"pom.xml for {service_name}",
            description=f"Java build manifest at {file['path']}",
            detectionMethod="Manifest Analysis (Maven / Gradle)",
            folderModule=os.path.dirname(file['path']) or "root",
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type='Service',
                technology='Java / Spring Boot' if is_spring else 'Java',
                source='Detected',
                description=f"Java service discovered in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'Java'},
            )
        )

        if 'postgresql' in content.lower() or 'spring-boot-starter-data-jpa' in content.lower():
            db_id = 'postgres-db'
            frameworks_set.add('PostgreSQL')
            register_entity(
                ArchitectureEntity(
                    id=db_id,
                    name="PostgreSQL Database",
                    type="Database",
                    technology="PostgreSQL / Hibernate",
                    source="Detected",
                    description="Spring Data JPA / PostgreSQL driver in pom.xml",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="JPA / PostgreSQL", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, db_id, "USES", "JDBC / Hibernate", file['path'], "pom.xml dependencies")

    @staticmethod
    def _parse_go_mod(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str]
    ):
        content = file.get('content') or ''
        service_name = CodebaseService._extract_service_name_from_path(file['path']) or 'go-service'
        service_id = sanitize_id(service_name)
        has_grpc = 'google.golang.org/grpc' in content
        has_gin = 'gin-gonic/gin' in content

        if has_grpc:
            frameworks_set.add('gRPC')
        if has_gin:
            frameworks_set.add('Gin Web Framework')

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet=content.split('\n')[0] if content else None,
            description=f"Go module manifest at {file['path']}",
            detectionMethod="Manifest Analysis (go.mod)",
            folderModule=os.path.dirname(file['path']) or "root",
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type='Service',
                technology='Go / gRPC' if has_grpc else ('Go / Gin' if has_gin else 'Go'),
                source='Detected',
                description=f"Go microservice module detected in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'Go'},
            )
        )

        if 'go-redis' in content or 'gomodule/redigo' in content:
            redis_id = 'redis-cache'
            frameworks_set.add('Redis')
            register_entity(
                ArchitectureEntity(
                    id=redis_id,
                    name="Redis Cache",
                    type="Database",
                    technology="Redis",
                    source="Detected",
                    description="Redis client library in go.mod",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="Redis driver", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, redis_id, "USES", "Redis Go Driver", file['path'], "go.mod dependencies")

        if 'gorm.io/driver/postgres' in content or 'lib/pq' in content:
            db_id = 'postgres-db'
            frameworks_set.add('PostgreSQL')
            register_entity(
                ArchitectureEntity(
                    id=db_id,
                    name="PostgreSQL Database",
                    type="Database",
                    technology="PostgreSQL",
                    source="Detected",
                    description="GORM PostgreSQL driver in go.mod",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="PostgreSQL driver", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, db_id, "USES", "GORM / pgx", file['path'], "go.mod dependencies")

    @staticmethod
    def _parse_csharp_manifest(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str]
    ):
        content = file.get('content') or ''
        service_name = os.path.splitext(os.path.basename(file['path']))[0]
        service_id = sanitize_id(service_name)
        has_aspnet = 'Microsoft.AspNetCore' in content
        frameworks_set.add('.NET Core / C#')
        if has_aspnet:
            frameworks_set.add('ASP.NET Core')

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet="<Project Sdk=\"Microsoft.NET.Sdk\">",
            description=f".NET project manifest at {file['path']}",
            detectionMethod="Manifest Analysis (.csproj)",
            folderModule=os.path.dirname(file['path']) or "root",
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type='Service',
                technology='ASP.NET Core' if has_aspnet else '.NET / C#',
                source='Detected',
                description=f".NET service project detected in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'C#'},
            )
        )

        if 'Microsoft.EntityFrameworkCore.SqlServer' in content or 'System.Data.SqlClient' in content:
            db_id = 'sql-server-db'
            frameworks_set.add('SQL Server')
            register_entity(
                ArchitectureEntity(
                    id=db_id,
                    name="SQL Server Database",
                    type="Database",
                    technology="SQL Server / Entity Framework",
                    source="Detected",
                    description="Entity Framework SQL Server driver in .csproj",
                    sourceEvidence=SourceEvidence(file=file['path'], line=1, description="SQL Server driver", detectionMethod="Manifest Dependency"),
                    metadata={"filePath": file['path']},
                )
            )
            register_relationship(service_id, db_id, "USES", "ADO.NET / EF Core", file['path'], ".csproj dependencies")

    @staticmethod
    def _parse_rust_manifest(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str]
    ):
        content = file.get('content') or ''
        service_name = CodebaseService._extract_service_name_from_path(file['path']) or 'rust-service'
        pkg_match = re.search(r'name\s*=\s*[\'"]([a-zA-Z0-9_\-]+)[\'"]', content)
        if pkg_match:
            service_name = pkg_match.group(1)
        service_id = sanitize_id(service_name)
        frameworks_set.add('Rust')

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet=f"[package]\nname = \"{service_name}\"",
            description=f"Rust Cargo manifest at {file['path']}",
            detectionMethod="Manifest Analysis (Cargo.toml)",
            folderModule=os.path.dirname(file['path']) or "root",
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type='Service',
                technology='Rust',
                source='Detected',
                description=f"Rust module detected in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'Rust'},
            )
        )

    @staticmethod
    def _parse_php_manifest(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str]
    ):
        content = file.get('content') or ''
        try:
            pkg = json.loads(content)
        except Exception:
            return
        service_name = pkg.get('name') or CodebaseService._extract_service_name_from_path(file['path']) or 'php-service'
        service_id = sanitize_id(service_name)
        frameworks_set.add('PHP')

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet=f'"name": "{service_name}"',
            description=f"PHP Composer manifest at {file['path']}",
            detectionMethod="Manifest Analysis (composer.json)",
            folderModule=os.path.dirname(file['path']) or "root",
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type='Service',
                technology='PHP / Composer',
                source='Detected',
                description=f"PHP service detected in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'PHP'},
            )
        )

    @staticmethod
    def _parse_ruby_manifest(
        file: Dict[str, Any],
        register_entity,
        register_relationship,
        frameworks_set: Set[str],
        external_packages_set: Set[str]
    ):
        content = file.get('content') or ''
        service_name = CodebaseService._extract_service_name_from_path(file['path']) or 'ruby-service'
        service_id = sanitize_id(service_name)
        frameworks_set.add('Ruby')

        ev = SourceEvidence(
            file=file['path'],
            line=1,
            snippet="source 'https://rubygems.org'",
            description=f"Ruby Gemfile at {file['path']}",
            detectionMethod="Manifest Analysis (Gemfile)",
            folderModule=os.path.dirname(file['path']) or "root",
        )

        register_entity(
            ArchitectureEntity(
                id=service_id,
                name=format_component_name(service_name),
                type='Service',
                technology='Ruby',
                source='Detected',
                description=f"Ruby service detected in {file['path']}",
                sourceEvidence=ev,
                evidenceList=[ev],
                associatedFiles=[file['path']],
                metadata={'filePath': file['path'], 'language': 'Ruby'},
            )
        )

    @staticmethod
    def _parse_source_code(
        file: Dict[str, Any],
        entities_dict: Dict[str, ArchitectureEntity],
        register_entity,
        register_relationship,
        shared_libraries_set: Set[str]
    ):
        path = file['path']
        content = file.get('content')
        if not content:
            return

        lines = content.split('\n')
        current_service_id = CodebaseService._find_enclosing_service(path, entities_dict) or 'application-core'

        if current_service_id not in entities_dict:
            path_parts = path.split('/')
            fallback_name = format_component_name(path_parts[0] if len(path_parts) > 1 else 'App Service')
            ev = SourceEvidence(
                file=path,
                line=1,
                snippet=lines[0] if lines else None,
                description=f"Source component discovered in /{path_parts[0]}",
                detectionMethod="Source File Enclosure",
                folderModule=path_parts[0],
            )
            register_entity(
                ArchitectureEntity(
                    id=current_service_id,
                    name=fallback_name,
                    type="Service",
                    technology=CodebaseService._detect_tech_from_ext(path),
                    source="Detected",
                    description=f"Discovered from codebase source files in /{path_parts[0] if len(path_parts) > 1 else ''}",
                    sourceEvidence=ev,
                    evidenceList=[ev],
                    associatedFiles=[path],
                    metadata={"filePath": path},
                )
            )

        for idx, line in enumerate(lines):
            line_num = idx + 1
            trimmed = line.strip()
            if not trimmed or trimmed.startswith(('//', '#', '/*', '*')):
                continue

            # 1. Detect REST API Endpoints
            api_match = (
                re.search(r'(?:app|router)\.(get|post|put|delete|patch)\([\'"](/api/[a-zA-Z0-9_\-/]+)[\'"]', trimmed, re.I)
                or re.search(r'@(?:app|router)\.(get|post|put|delete|patch)\([\'"](/api/[a-zA-Z0-9_\-/]+)[\'"]', trimmed, re.I)
                or re.search(r'@(GetMapping|PostMapping|PutMapping|DeleteMapping)\([\'"](/api/[a-zA-Z0-9_\-/]+)[\'"]', trimmed, re.I)
                or re.search(r'r\.(GET|POST|PUT|DELETE)\([\'"](/api/[a-zA-Z0-9_\-/]+)[\'"]', trimmed)
                or re.search(r'\[(HttpGet|HttpPost|HttpPut|HttpDelete)\([\'"](/api/[a-zA-Z0-9_\-/]+)[\'"]\)\]', trimmed, re.I)
            )
            if api_match:
                method = api_match.group(1).upper().replace('MAPPING', '').replace('HTTP', '')
                endpoint = api_match.group(2)
                api_id = sanitize_id(f"api-{method}-{endpoint}")

                ev = SourceEvidence(
                    file=path,
                    line=line_num,
                    snippet=trimmed,
                    description=f"Exposed API endpoint in {path}",
                    detectionMethod="Route Controller Scan",
                    folderModule=os.path.dirname(path),
                )

                register_entity(
                    ArchitectureEntity(
                        id=api_id,
                        name=f"{method} {endpoint}",
                        type="API",
                        technology="REST API Endpoint",
                        source="Detected",
                        description=f"Exposed API route in {path}",
                        sourceEvidence=ev,
                        evidenceList=[ev],
                        associatedFiles=[path],
                        metadata={"filePath": path, "method": method, "endpoint": endpoint, "parentService": current_service_id},
                    )
                )
                register_relationship(
                    current_service_id, api_id, "USES", "Internal Route",
                    path, trimmed, line_num
                )

            # 2. Detect Cross-Service HTTP Client Calls
            http_match = (
                re.search(r'(?:axios|requests|fetch|http)\.(?:get|post|put|delete)\([\'"](?:https?:\/\/)?([a-zA-Z0-9_\-]+)(?::\d+)?(/[^"\'\s]*)?[\'"]', trimmed, re.I)
                or re.search(r'restTemplate\.(?:getForObject|postForObject)\([\'"](?:https?:\/\/)?([a-zA-Z0-9_\-]+)(?::\d+)?(/[^"\'\s]*)?[\'"]', trimmed, re.I)
            )
            if http_match:
                target_raw = http_match.group(1)
                target_id = sanitize_id(target_raw)
                if target_id and target_id not in ('localhost', '127', '0', 'window', 'process', 'api', 'v1', 'url', current_service_id):
                    if target_id not in entities_dict:
                        ev = SourceEvidence(
                            file=path,
                            line=line_num,
                            snippet=trimmed,
                            description=f"Target service invoked via HTTP in {path}",
                            detectionMethod="Cross-Service HTTP Call",
                            folderModule=os.path.dirname(path),
                        )
                        register_entity(
                            ArchitectureEntity(
                                id=target_id,
                                name=format_component_name(target_raw),
                                type="Service",
                                technology="HTTP Microservice",
                                source="Detected",
                                description=f"Target service invoked via HTTP in {path}",
                                sourceEvidence=ev,
                                evidenceList=[ev],
                                associatedFiles=[path],
                                metadata={"filePath": path},
                            )
                        )
                    register_relationship(
                        current_service_id, target_id, "CALLS", "HTTP / JSON",
                        path, trimmed, line_num
                    )

            # 3. Detect Shared Utility / Security Libraries
            import_match = re.search(r'(?:import|require|from)\s*\(?[\'"]([@a-zA-Z0-9_\-]+)[\'"]', trimmed)
            if import_match:
                lib_name = import_match.group(1).lower()
                if lib_name in ('jsonwebtoken', 'bcrypt', 'crypto-js', 'pino', 'winston', 'joi', 'zod', 'jwt'):
                    lib_id = sanitize_id(f"lib-{lib_name}")
                    shared_libraries_set.add(lib_name)
                    ev = SourceEvidence(
                        file=path,
                        line=line_num,
                        snippet=trimmed,
                        description=f"Shared library {lib_name} imported in {path}",
                        detectionMethod="Shared Import Scan",
                        folderModule=os.path.dirname(path),
                    )
                    register_entity(
                        ArchitectureEntity(
                            id=lib_id,
                            name=lib_name,
                            type="Library",
                            technology="Utility Library",
                            source="Detected",
                            description=f"Internal shared library utilized by {current_service_id}",
                            sourceEvidence=ev,
                            evidenceList=[ev],
                            associatedFiles=[path],
                            metadata={"filePath": path},
                        )
                    )
                    register_relationship(
                        current_service_id, lib_id, "DEPENDS_ON", "Import / Link",
                        path, trimmed, line_num
                    )

            # 4. Detect External Generative AI / LLM SDKs
            if re.search(r'import\s+google\.generativeai|from\s+google\s+import\s+genai|genai\.GenerativeModel|genai\.configure', trimmed):
                gemini_id = 'google-gemini-api'
                if gemini_id not in entities_dict:
                    ev = SourceEvidence(
                        file=path,
                        line=line_num,
                        snippet=trimmed,
                        description=f"Google Gemini SDK utilized in {path}",
                        detectionMethod="AI SDK Import Scan",
                        folderModule=os.path.dirname(path),
                    )
                    register_entity(
                        ArchitectureEntity(
                            id=gemini_id,
                            name="Google Gemini API",
                            type="External System",
                            technology="Gemini REST / gRPC API",
                            source="Detected",
                            description="Cloud Generative AI platform for text analysis, feedback sentiment, and LLM reasoning",
                            sourceEvidence=ev,
                            evidenceList=[ev],
                            associatedFiles=[path],
                            metadata={"filePath": path},
                        )
                    )
                register_relationship(
                    current_service_id, gemini_id, "CALLS", "HTTPS / Gemini API",
                    path, trimmed, line_num, f"{current_service_id} invokes Google Gemini API for generative AI"
                )

            # 5. Detect Tabular Dataset Queries in Code (e.g. pd.read_csv, read_parquet, file_uploader)
            if re.search(r'pd\.read_csv|pd\.read_parquet|pd\.read_table|read_csv\(|file_uploader.*csv', trimmed):
                if 'training-datasets' in entities_dict:
                    register_relationship(
                        current_service_id, 'training-datasets', 'QUERIES', 'Tabular Data Ingestion / CSV',
                        path, trimmed, line_num, f"{current_service_id} queries tabular dataset ({trimmed})"
                    )

            # 6. Streamlit UI application framework detection
            if re.search(r'import\s+streamlit|from\s+streamlit\s+import', trimmed):
                if current_service_id in entities_dict:
                    entities_dict[current_service_id].type = 'Application'
                    if 'Streamlit' not in entities_dict[current_service_id].technology:
                        entities_dict[current_service_id].technology = 'Python / Streamlit'

    @staticmethod
    def _extract_service_name_from_path(path: str, common_root: str = "") -> Optional[str]:
        clean_path = path.replace("\\", "/")
        if common_root and clean_path.startswith(common_root + "/"):
            clean_path = clean_path[len(common_root) + 1:]
        parts = clean_path.split("/")
        if len(parts) > 1:
            if parts[0] in ('services', 'apps', 'packages', 'microservices') and len(parts) > 2:
                return parts[1]
            if parts[0] not in ('src', 'app', 'lib', 'main', 'tests', 'test', 'docs', 'review'):
                return parts[0]
        return None

    @staticmethod
    def _find_enclosing_service(path: str, entities_dict: Dict[str, ArchitectureEntity]) -> Optional[str]:
        # 1. Direct associatedFiles match takes TOP priority
        for ent_id, ent in entities_dict.items():
            if path in ent.associatedFiles:
                return ent_id

        # 2. Match by longest folderModule prefix (deepest folder first, NOT root wrapper)
        sorted_ents = sorted(
            entities_dict.items(),
            key=lambda item: len(item[1].sourceEvidence.folderModule) if (item[1].sourceEvidence and item[1].sourceEvidence.folderModule and item[1].sourceEvidence.folderModule != "root") else 0,
            reverse=True
        )
        for ent_id, ent in sorted_ents:
            folder = ent.sourceEvidence.folderModule if ent.sourceEvidence else None
            if folder and folder != "root" and (path.startswith(folder + "/") or path == folder):
                return ent_id

        parts = path.replace("\\", "/").split("/")
        if len(parts) > 1:
            # Check direct folder match
            for part in parts[:-1]:
                cand = sanitize_id(part)
                if cand in entities_dict:
                    return cand
                cand_mod = sanitize_id(f"mod-{part}")
                if cand_mod in entities_dict:
                    return cand_mod
            # Check multi-level path (e.g. src/auth)
            for i in range(1, len(parts)):
                sub = "/".join(parts[:i])
                cand_mod = sanitize_id(f"mod-{sub}")
                if cand_mod in entities_dict:
                    return cand_mod
                cand_sub = sanitize_id(sub)
                if cand_sub in entities_dict:
                    return cand_sub

        # 3. Fallback to Service or Application entity if available
        for ent_id, ent in entities_dict.items():
            if ent.type in ('Service', 'Application'):
                return ent_id

        return None

    @staticmethod
    def _detect_tech_from_ext(path: str) -> str:
        ext = os.path.splitext(path)[1].lower()
        if ext in ('.ts', '.tsx'):
            return 'TypeScript'
        elif ext in ('.js', '.jsx'):
            return 'JavaScript'
        elif ext == '.py':
            return 'Python'
        elif ext == '.java':
            return 'Java'
        elif ext == '.go':
            return 'Go'
        elif ext == '.cs':
            return 'C# / .NET'
        elif ext in ('.c', '.cpp', '.cc'):
            return 'C / C++'
        elif ext == '.rb':
            return 'Ruby'
        elif ext == '.php':
            return 'PHP'
        elif ext == '.rs':
            return 'Rust'
        return 'Source Module'
