import os
import re
import ast
import posixpath
from typing import Dict, List, Set, Optional, Tuple, Any

from ..models.schemas import (
    CodebaseFileDependency,
    CodebaseModuleDependency,
    CodebaseNode,
    CodebaseGraph,
    SourceEvidence,
    RelationshipType,
)

class DependencyExtractor:
    last_external_libraries: Dict[str, Set[str]] = {}

    @staticmethod
    def extract_dependencies(
        files: List[Dict[str, Any]],
        detected_modules: Optional[List[Any]] = None,
    ) -> Tuple[List[CodebaseFileDependency], CodebaseGraph, List[CodebaseModuleDependency]]:
        """
        Extracts actual file-level and module-level dependencies from codebase files across
        all supported languages: JS/TS, Python, Java, Go, C/C++, C#, Ruby, PHP, Rust, Dart.
        """
        all_paths_set: Set[str] = set(f['path'] for f in files)
        path_to_file: Dict[str, Dict[str, Any]] = {f['path']: f for f in files}
        
        basename_index: Dict[str, List[str]] = {}
        stem_index: Dict[str, List[str]] = {}
        
        for p in all_paths_set:
            base = os.path.basename(p)
            stem, _ = os.path.splitext(base)
            basename_index.setdefault(base.lower(), []).append(p)
            stem_index.setdefault(stem.lower(), []).append(p)

        file_dependencies: List[CodebaseFileDependency] = []
        dep_keys_seen: Set[Tuple[str, str, str]] = set()

        # External libraries collected per source file: path -> set(library_name)
        external_libraries: Dict[str, Set[str]] = {}
        DependencyExtractor.last_external_libraries = external_libraries

        # Route definitions registry: endpoint -> list of (file_path, line_num, method, snippet)
        route_definitions: Dict[str, List[Tuple[str, int, str, str]]] = {}

        # 1. First pass: Collect exposed API routes
        for f in files:
            content = f.get('content')
            if not content:
                continue
            DependencyExtractor._collect_routes(f['path'], content, route_definitions)

        # 2. Second pass: Parse language-specific imports and calls
        for f in files:
            content = f.get('content')
            if not content or f.get('category') not in ('source', 'manifest', 'config'):
                continue

            src_path = f['path']
            lang = f.get('language') or ''
            ext = f.get('extension') or ''

            raw_deps: List[Dict[str, Any]] = []

            if lang in ('JavaScript', 'TypeScript') or ext in ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'):
                raw_deps = DependencyExtractor._extract_javascript_imports(src_path, content, all_paths_set)
            elif lang == 'Python' or ext == '.py':
                raw_deps = DependencyExtractor._extract_python_imports(
                    src_path, content, all_paths_set, stem_index, basename_index, external_libraries
                )
            elif lang == 'Dart' or ext == '.dart':
                raw_deps = DependencyExtractor._extract_dart_imports(
                    src_path, content, all_paths_set, stem_index, basename_index, external_libraries
                )
            elif lang == 'Java' or ext == '.java':
                raw_deps = DependencyExtractor._extract_java_imports(src_path, content, stem_index, all_paths_set)
            elif lang == 'Go' or ext == '.go':
                raw_deps = DependencyExtractor._extract_go_imports(src_path, content, all_paths_set)
            elif lang in ('C', 'C++', 'C/C++ Header', 'C++ Header') or ext in ('.c', '.cpp', '.cc', '.h', '.hpp'):
                raw_deps = DependencyExtractor._extract_cpp_imports(src_path, content, all_paths_set)
            elif lang == 'C#' or ext == '.cs':
                raw_deps = DependencyExtractor._extract_csharp_imports(src_path, content, stem_index, all_paths_set)
            elif lang == 'Ruby' or ext == '.rb':
                raw_deps = DependencyExtractor._extract_ruby_imports(src_path, content, all_paths_set)
            elif lang == 'PHP' or ext == '.php':
                raw_deps = DependencyExtractor._extract_php_imports(src_path, content, stem_index, all_paths_set)
            elif lang == 'Rust' or ext == '.rs':
                raw_deps = DependencyExtractor._extract_rust_imports(src_path, content, all_paths_set)

            # Check HTTP API client calls (only from real code source files)
            if ext in ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.dart', '.go', '.java', '.cs', '.php', '.rb'):
                http_call_deps = DependencyExtractor._extract_http_calls(src_path, content, route_definitions, all_paths_set)
                raw_deps.extend(http_call_deps)

            for dep in raw_deps:
                tgt = dep['target_file']
                rel_type: RelationshipType = dep.get('type', 'IMPORTS')
                if not tgt or tgt == src_path:
                    continue

                key = (src_path, tgt, rel_type)
                if key in dep_keys_seen:
                    continue
                dep_keys_seen.add(key)

                dep_id = f"fdep-{re.sub(r'[^a-zA-Z0-9]', '-', src_path)}-{re.sub(r'[^a-zA-Z0-9]', '-', tgt)}"
                file_dependencies.append(
                    CodebaseFileDependency(
                        id=dep_id,
                        source_file=src_path,
                        target_file=tgt,
                        type=rel_type,
                        line=dep.get('line'),
                        snippet=dep.get('snippet', '')[:200],
                        statement=dep.get('statement'),
                        detectionMethod=dep.get('method', 'Language Import Extractor'),
                    )
                )

        # 3. Build Module & Folder structure
        module_deps, codebase_graph = DependencyExtractor._build_codebase_graph(
            files, file_dependencies, detected_modules
        )

        return file_dependencies, codebase_graph, module_deps

    # --------------------------------------------------------------------------
    # Language 1: JavaScript / TypeScript
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_javascript_imports(
        src_path: str, content: str, all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)

        import_patterns = [
            re.compile(r'import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?[\'"]([^\'"]+)[\'"]'),
            re.compile(r'export\s+(?:(?:[\w*\s{},]+)\s+from\s+)[\'"]([^\'"]+)[\'"]'),
            re.compile(r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'),
            re.compile(r'import\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'),
        ]

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith('//') or trimmed.startswith('/*'):
                continue

            for pat in import_patterns:
                match = pat.search(trimmed)
                if match:
                    raw_spec = match.group(1).strip()
                    resolved = DependencyExtractor._resolve_js_path(raw_spec, src_dir, all_paths)
                    if resolved:
                        results.append({
                            'target_file': resolved,
                            'type': 'IMPORTS',
                            'line': idx + 1,
                            'snippet': trimmed,
                            'statement': raw_spec,
                            'method': 'ES/CommonJS Module Import',
                        })
                    break

        return results

    @staticmethod
    def _resolve_js_path(spec: str, src_dir: str, all_paths: Set[str]) -> Optional[str]:
        is_relative = spec.startswith('./') or spec.startswith('../') or spec.startswith('/') or spec.startswith('@/')
        if not is_relative and not any(spec.startswith(f"{prefix}/") for prefix in ('src', 'app', 'components', 'services', 'utils')):
            return None

        clean_spec = spec
        if clean_spec.startswith('@/'):
            clean_spec = 'src/' + clean_spec[2:]

        if spec.startswith('./') or spec.startswith('../'):
            candidate_base = posixpath.normpath(posixpath.join(src_dir, clean_spec))
        else:
            candidate_base = posixpath.normpath(clean_spec.lstrip('/'))

        candidates = [
            candidate_base,
            candidate_base + '.ts',
            candidate_base + '.tsx',
            candidate_base + '.js',
            candidate_base + '.jsx',
            candidate_base + '.mjs',
            candidate_base + '.cjs',
            posixpath.join(candidate_base, 'index.ts'),
            posixpath.join(candidate_base, 'index.tsx'),
            posixpath.join(candidate_base, 'index.js'),
            posixpath.join(candidate_base, 'index.jsx'),
        ]

        for c in candidates:
            if c in all_paths:
                return c

        for p in all_paths:
            if p.startswith(candidate_base + '.') or p == candidate_base:
                return p

        return None

    # --------------------------------------------------------------------------
    # Language 2: Python (AST-Powered Import, Model, and Dataset Extractor)
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_python_imports(
        src_path: str,
        content: str,
        all_paths: Set[str],
        stem_index: Optional[Dict[str, List[str]]] = None,
        basename_index: Optional[Dict[str, List[str]]] = None,
        external_libs_out: Optional[Dict[str, Set[str]]] = None,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)

        # 1. Native AST parsing for 100% accurate Python import extraction
        try:
            tree = ast.parse(content, filename=src_path)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        mod = alias.name
                        resolved = DependencyExtractor._resolve_python_path(
                            mod, src_dir, all_paths, stem_index=stem_index
                        )
                        if resolved and resolved != src_path:
                            results.append({
                                'target_file': resolved,
                                'type': 'IMPORTS',
                                'line': node.lineno,
                                'snippet': f"import {alias.name}",
                                'statement': alias.name,
                                'method': 'Python AST Import',
                            })
                        elif external_libs_out is not None:
                            root_pkg = mod.split('.')[0]
                            if root_pkg not in ('sys', 'os', 're', 'math', 'time', 'datetime', 'json', 'io', 'typing', 'collections', 'pathlib'):
                                external_libs_out.setdefault(src_path, set()).add(root_pkg)

                elif isinstance(node, ast.ImportFrom):
                    mod = node.module or ''
                    names = [n.name for n in node.names]
                    resolved = DependencyExtractor._resolve_python_path(
                        mod, src_dir, all_paths, imported_items=names, stem_index=stem_index, level=node.level
                    )
                    if resolved and resolved != src_path:
                        results.append({
                            'target_file': resolved,
                            'type': 'IMPORTS',
                            'line': node.lineno,
                            'snippet': f"from {mod} import {', '.join(names[:3])}",
                            'statement': f"from {mod} import {names[0]}" if names else f"from {mod}",
                            'method': 'Python AST ImportFrom',
                        })
                    elif external_libs_out is not None and node.level == 0:
                        root_pkg = mod.split('.')[0] if mod else ''
                        if root_pkg and root_pkg not in ('sys', 'os', 're', 'math', 'time', 'datetime', 'json', 'io', 'typing', 'collections', 'pathlib'):
                            external_libs_out.setdefault(src_path, set()).add(root_pkg)

        except Exception:
            # Fallback regex parser if syntax error occurs
            from_pattern = re.compile(r'^\s*from\s+([\.a-zA-Z0-9_]+)\s+import\s+([a-zA-Z0-9_,\s\*\(\)]+)')
            import_pattern = re.compile(r'^\s*import\s+([a-zA-Z0-9_\.,\s]+)')
            for idx, line in enumerate(lines, 1):
                trimmed = line.strip()
                if not trimmed or trimmed.startswith('#'):
                    continue
                fm = from_pattern.match(trimmed)
                if fm:
                    mod = fm.group(1).strip()
                    items = [i.strip() for i in fm.group(2).split(',') if i.strip()]
                    lvl = len(mod) - len(mod.lstrip('.'))
                    resolved = DependencyExtractor._resolve_python_path(
                        mod.lstrip('.'), src_dir, all_paths, items, stem_index=stem_index, level=lvl
                    )
                    if resolved and resolved != src_path:
                        results.append({
                            'target_file': resolved,
                            'type': 'IMPORTS',
                            'line': idx,
                            'snippet': trimmed[:200],
                            'statement': mod,
                            'method': 'Python Import Statement',
                        })
                    continue

                im = import_pattern.match(trimmed)
                if im:
                    for m in im.group(1).split(','):
                        clean_m = m.split(' as ')[0].strip()
                        resolved = DependencyExtractor._resolve_python_path(
                            clean_m, src_dir, all_paths, stem_index=stem_index
                        )
                        if resolved and resolved != src_path:
                            results.append({
                                'target_file': resolved,
                                'type': 'IMPORTS',
                                'line': idx,
                                'snippet': trimmed[:200],
                                'statement': clean_m,
                                'method': 'Python Import Statement',
                            })

        # 2. Extract ML Model artifact loads and saves (e.g. pickle.load, joblib.load, .pkl, .dat)
        for idx, line in enumerate(lines, 1):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith('#'):
                continue

            # Model binary references (.pkl, .pickle, .dat, .joblib, .h5, .onnx)
            m_pkl = re.search(r'[\'"]([^\'"]+\.(?:pkl|pickle|dat|joblib|h5|onnx))[\'"]', trimmed)
            if m_pkl:
                raw_m = m_pkl.group(1)
                cand = posixpath.normpath(posixpath.join(src_dir, raw_m))
                target = None
                if cand in all_paths:
                    target = cand
                elif basename_index:
                    matches = basename_index.get(posixpath.basename(raw_m).lower(), [])
                    if matches:
                        target = sorted(
                            matches,
                            key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_path]))),
                            reverse=True
                        )[0]

                if target and target != src_path:
                    is_save = any(k in trimmed for k in ('dump', 'wb', 'save', 'to_pickle'))
                    results.append({
                        'target_file': target,
                        'type': 'PUBLISHES' if is_save else 'USES',
                        'line': idx,
                        'snippet': trimmed[:200],
                        'statement': raw_m,
                        'method': 'Model Artifact Serializer' if is_save else 'Model Artifact Loader',
                    })

            # Dataset loading references (.csv, .tsv, .jsonl, .parquet)
            m_csv = re.search(r'[\'"]([^\'"]+\.(?:csv|tsv|jsonl|parquet))[\'"]', trimmed)
            if m_csv:
                raw_c = m_csv.group(1)
                cand = posixpath.normpath(posixpath.join(src_dir, raw_c))
                target = None
                if cand in all_paths:
                    target = cand
                elif basename_index:
                    matches = basename_index.get(posixpath.basename(raw_c).lower(), [])
                    if matches:
                        target = sorted(
                            matches,
                            key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_path]))),
                            reverse=True
                        )[0]

                if target and target != src_path:
                    results.append({
                        'target_file': target,
                        'type': 'QUERIES',
                        'line': idx,
                        'snippet': trimmed[:200],
                        'statement': raw_c,
                        'method': 'Dataset Ingestion',
                    })
            elif re.search(r'pd\.read_csv|pd\.read_parquet|pd\.read_table|read_csv\(|file_uploader.*csv', trimmed):
                dataset_candidates = [p for p in all_paths if p.endswith(('.csv', '.tsv', '.parquet', '.jsonl')) and p != src_path]
                if dataset_candidates:
                    nearest_ds = sorted(
                        dataset_candidates,
                        key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_path]))),
                        reverse=True
                    )[0]
                    results.append({
                        'target_file': nearest_ds,
                        'type': 'QUERIES',
                        'line': idx,
                        'snippet': trimmed[:200],
                        'statement': posixpath.basename(nearest_ds),
                        'method': 'Tabular Ingestion Loader',
                    })

            # Environment configuration loading (load_dotenv, dotenv)
            if 'load_dotenv' in trimmed or 'dotenv' in trimmed:
                env_candidates = [p for p in all_paths if p.endswith(('.env', '.env.example', '.env.local')) and p != src_path]
                if env_candidates:
                    nearest_env = sorted(
                        env_candidates,
                        key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_path]))),
                        reverse=True
                    )[0]
                    results.append({
                        'target_file': nearest_env,
                        'type': 'USES',
                        'line': idx,
                        'snippet': trimmed[:200],
                        'statement': posixpath.basename(nearest_env),
                        'method': 'Environment Configuration',
                    })

        return results

    @staticmethod
    def _resolve_python_path(
        module_part: str,
        src_dir: str,
        all_paths: Set[str],
        imported_items: Optional[List[str]] = None,
        stem_index: Optional[Dict[str, List[str]]] = None,
        level: int = 0
    ) -> Optional[str]:
        if stem_index is None:
            stem_index = {}

        if level > 0:
            curr = src_dir
            for _ in range(level - 1):
                curr = posixpath.dirname(curr)
            if module_part:
                remainder = module_part.lstrip('.').replace('.', '/')
                base_target = posixpath.normpath(posixpath.join(curr, remainder))
            else:
                base_target = curr

            candidates = [
                f"{base_target}.py",
                posixpath.join(base_target, '__init__.py'),
            ]
            if imported_items:
                for item in imported_items:
                    candidates.append(posixpath.join(base_target, f"{item}.py"))
                    candidates.append(posixpath.join(base_target, item, '__init__.py'))

            for c in candidates:
                if c in all_paths:
                    return c

            leaf = base_target.split('/')[-1] if base_target else ''
            if leaf and leaf.lower() in stem_index:
                return stem_index[leaf.lower()][0]
            return None

        else:
            base_target = module_part.replace('.', '/')
            candidates = [
                f"{base_target}.py",
                posixpath.join(base_target, '__init__.py'),
                posixpath.normpath(posixpath.join(src_dir, f"{base_target}.py")),
                posixpath.normpath(posixpath.join(src_dir, base_target, '__init__.py')),
            ]
            if imported_items:
                for item in imported_items:
                    candidates.append(posixpath.normpath(posixpath.join(base_target, f"{item}.py")))
                    candidates.append(posixpath.normpath(posixpath.join(src_dir, base_target, f"{item}.py")))

            for c in candidates:
                if c in all_paths:
                    return c

            leaf = base_target.split('/')[-1]
            if leaf and leaf.lower() in stem_index:
                cands_stem = stem_index[leaf.lower()]
                closest = sorted(
                    cands_stem,
                    key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_dir]))),
                    reverse=True
                )[0]
                return closest

            if imported_items:
                for item in imported_items:
                    if item.lower() in stem_index:
                        cands_stem = stem_index[item.lower()]
                        closest = sorted(
                            cands_stem,
                            key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_dir]))),
                            reverse=True
                        )[0]
                        return closest

            target_name = leaf + '.py'
            for p in all_paths:
                if p.endswith('/' + target_name) or p == target_name:
                    return p

            return None

    # --------------------------------------------------------------------------
    # Language 2b: Dart (Flutter)
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_dart_imports(
        src_path: str,
        content: str,
        all_paths: Set[str],
        stem_index: Dict[str, List[str]],
        basename_index: Dict[str, List[str]],
        external_libs_out: Optional[Dict[str, Set[str]]] = None
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)
        dart_pat = re.compile(r'^\s*(?:import|export)\s+[\'"]([^\'"]+)[\'"](?:\s+as\s+[a-zA-Z0-9_]+)?;')

        for idx, line in enumerate(lines, 1):
            trimmed = line.strip()
            m = dart_pat.match(trimmed)
            if not m:
                continue

            spec = m.group(1).strip()
            if spec.startswith('package:'):
                pkg_part = spec[8:]
                pkg_root = pkg_part.split('/')[0]
                if pkg_root in ('flutter', 'path_provider', 'http', 'provider', 'shared_preferences', 'get', 'bloc', 'cupertino_icons'):
                    if external_libs_out is not None:
                        external_libs_out.setdefault(src_path, set()).add(pkg_root)
                    continue

                target_filename = pkg_part.split('/')[-1]
                matches = basename_index.get(target_filename.lower(), [])
                if matches:
                    closest = sorted(
                        matches,
                        key=lambda p: (not p.startswith(src_dir), len(posixpath.commonprefix([p, src_path]))),
                        reverse=True
                    )[0]
                    if closest != src_path:
                        results.append({
                            'target_file': closest,
                            'type': 'IMPORTS',
                            'line': idx,
                            'snippet': trimmed[:200],
                            'statement': spec,
                            'method': 'Dart Package Import',
                        })
                elif external_libs_out is not None:
                    external_libs_out.setdefault(src_path, set()).add(pkg_root)

            elif spec.endswith('.dart'):
                cand = posixpath.normpath(posixpath.join(src_dir, spec))
                if cand in all_paths and cand != src_path:
                    results.append({
                        'target_file': cand,
                        'type': 'IMPORTS',
                        'line': idx,
                        'snippet': trimmed[:200],
                        'statement': spec,
                        'method': 'Dart Relative Import',
                    })
        return results

    # --------------------------------------------------------------------------
    # Language 3: Java
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_java_imports(
        src_path: str, content: str, stem_index: Dict[str, List[str]], all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        import_pat = re.compile(r'^\s*import\s+(?:static\s+)?([a-zA-Z0-9_\.]+);')

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            match = import_pat.match(trimmed)
            if match:
                full_import = match.group(1).strip()
                parts = full_import.split('.')
                class_name = parts[-1]
                if class_name != '*':
                    matches = stem_index.get(class_name.lower(), [])
                    java_matches = [m for m in matches if m.endswith('.java')]
                    if java_matches:
                        package_path = '/'.join(parts) + '.java'
                        best_match = java_matches[0]
                        for m in java_matches:
                            if m.endswith(package_path):
                                best_match = m
                                break
                        results.append({
                            'target_file': best_match,
                            'type': 'IMPORTS',
                            'line': idx + 1,
                            'snippet': trimmed,
                            'statement': full_import,
                            'method': 'Java Package Import',
                        })
        return results

    # --------------------------------------------------------------------------
    # Language 4: Go
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_go_imports(
        src_path: str, content: str, all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        in_multi_import = False

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            if trimmed.startswith('import ('):
                in_multi_import = True
                continue
            elif in_multi_import:
                if trimmed.startswith(')'):
                    in_multi_import = False
                    continue
                match = re.search(r'[\'"]([^\'"]+)[\'"]', trimmed)
                if match:
                    DependencyExtractor._match_go_import(match.group(1), src_path, idx + 1, trimmed, all_paths, results)
            elif trimmed.startswith('import '):
                match = re.search(r'import\s+[\'"]([^\'"]+)[\'"]', trimmed)
                if match:
                    DependencyExtractor._match_go_import(match.group(1), src_path, idx + 1, trimmed, all_paths, results)

        return results

    @staticmethod
    def _match_go_import(
        import_str: str, src_path: str, line_num: int, snippet: str, all_paths: Set[str], results: List[Dict[str, Any]]
    ):
        parts = import_str.split('/')
        leaf = parts[-1]
        for p in all_paths:
            if p.endswith('.go') and (f"/{leaf}/" in p or p.endswith(f"/{leaf}.go")):
                results.append({
                    'target_file': p,
                    'type': 'IMPORTS',
                    'line': line_num,
                    'snippet': snippet,
                    'statement': import_str,
                    'method': 'Go Package Import',
                })
                break

    # --------------------------------------------------------------------------
    # Language 5: C / C++
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_cpp_imports(
        src_path: str, content: str, all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)
        inc_pat = re.compile(r'^\s*#include\s*["<]([^">]+)[">]')

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            match = inc_pat.match(trimmed)
            if match:
                raw_inc = match.group(1).strip()
                cand_rel = posixpath.normpath(posixpath.join(src_dir, raw_inc))
                if cand_rel in all_paths:
                    results.append({
                        'target_file': cand_rel,
                        'type': 'IMPORTS',
                        'line': idx + 1,
                        'snippet': trimmed,
                        'statement': raw_inc,
                        'method': 'C/C++ Header Include',
                    })
                else:
                    base = os.path.basename(raw_inc).lower()
                    for p in all_paths:
                        if os.path.basename(p).lower() == base:
                            results.append({
                                'target_file': p,
                                'type': 'IMPORTS',
                                'line': idx + 1,
                                'snippet': trimmed,
                                'statement': raw_inc,
                                'method': 'C/C++ Header Include',
                            })
                            break
        return results

    # --------------------------------------------------------------------------
    # Language 6: C#
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_csharp_imports(
        src_path: str, content: str, stem_index: Dict[str, List[str]], all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        using_pat = re.compile(r'^\s*using\s+([a-zA-Z0-9_\.]+);')

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            match = using_pat.match(trimmed)
            if match:
                ns = match.group(1).strip()
                last_part = ns.split('.')[-1]
                matches = stem_index.get(last_part.lower(), [])
                cs_matches = [m for m in matches if m.endswith('.cs')]
                if cs_matches:
                    results.append({
                        'target_file': cs_matches[0],
                        'type': 'USES',
                        'line': idx + 1,
                        'snippet': trimmed,
                        'statement': ns,
                        'method': 'C# Namespace Reference',
                    })
        return results

    # --------------------------------------------------------------------------
    # Language 7: Ruby
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_ruby_imports(
        src_path: str, content: str, all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)
        req_pat = re.compile(r'^\s*(?:require_relative|require)\s*[\'"]([^\'"]+)[\'"]')

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            match = req_pat.match(trimmed)
            if match:
                spec = match.group(1).strip()
                cand = posixpath.normpath(posixpath.join(src_dir, spec + ('' if spec.endswith('.rb') else '.rb')))
                if cand in all_paths:
                    results.append({
                        'target_file': cand,
                        'type': 'REQUIRES',
                        'line': idx + 1,
                        'snippet': trimmed,
                        'statement': spec,
                        'method': 'Ruby Require',
                    })
        return results

    # --------------------------------------------------------------------------
    # Language 8: PHP
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_php_imports(
        src_path: str, content: str, stem_index: Dict[str, List[str]], all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)
        inc_pat = re.compile(r'^\s*(?:require|require_once|include|include_once)\s*\(?[\'"]([^\'"]+)[\'"]\)?;')
        use_pat = re.compile(r'^\s*use\s+([a-zA-Z0-9_\\]+);')

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            inc_match = inc_pat.match(trimmed)
            if inc_match:
                spec = inc_match.group(1).strip()
                cand = posixpath.normpath(posixpath.join(src_dir, spec))
                if cand in all_paths:
                    results.append({
                        'target_file': cand,
                        'type': 'INCLUDES',
                        'line': idx + 1,
                        'snippet': trimmed,
                        'statement': spec,
                        'method': 'PHP Include / Require',
                    })
                continue

            use_match = use_pat.match(trimmed)
            if use_match:
                cls_part = use_match.group(1).split('\\')[-1]
                matches = stem_index.get(cls_part.lower(), [])
                php_matches = [m for m in matches if m.endswith('.php')]
                if php_matches:
                    results.append({
                        'target_file': php_matches[0],
                        'type': 'USES',
                        'line': idx + 1,
                        'snippet': trimmed,
                        'statement': use_match.group(1),
                        'method': 'PHP Use Statement',
                    })
        return results

    # --------------------------------------------------------------------------
    # Language 9: Rust
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_rust_imports(
        src_path: str, content: str, all_paths: Set[str]
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')
        src_dir = posixpath.dirname(src_path)
        mod_pat = re.compile(r'^\s*(?:pub\s+)?mod\s+([a-zA-Z0-9_]+);')

        for idx, line in enumerate(lines):
            trimmed = line.strip()
            match = mod_pat.match(trimmed)
            if match:
                mod_name = match.group(1).strip()
                cand1 = posixpath.normpath(posixpath.join(src_dir, f"{mod_name}.rs"))
                cand2 = posixpath.normpath(posixpath.join(src_dir, mod_name, "mod.rs"))
                chosen = cand1 if cand1 in all_paths else (cand2 if cand2 in all_paths else None)
                if chosen:
                    results.append({
                        'target_file': chosen,
                        'type': 'IMPORTS',
                        'line': idx + 1,
                        'snippet': trimmed,
                        'statement': f"mod {mod_name}",
                        'method': 'Rust Module Declaration',
                    })
        return results

    # --------------------------------------------------------------------------
    # Cross-Service / Cross-File API Route Resolution
    # --------------------------------------------------------------------------
    @staticmethod
    def _collect_routes(
        file_path: str, content: str, route_definitions: Dict[str, List[Tuple[str, int, str, str]]]
    ):
        lines = content.split('\n')
        for idx, line in enumerate(lines, 1):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith(('//', '#')):
                continue

            # 1. Flask @app.route('/path', methods=['GET', 'POST'])
            m = re.search(r'@(?:app|blueprint|bp|router|api)\.route\s*\(\s*[\'"](/[^"\'\s]*)[\'"](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?', trimmed, re.I)
            if m:
                endpoint = m.group(1).strip()
                method = 'GET'
                if m.group(2):
                    method = m.group(2).replace("'", "").replace('"', '').split(',')[0].strip().upper()
                route_definitions.setdefault(endpoint, []).append((file_path, idx, method, trimmed))
                continue

            # 2. FastAPI / Express: @router.get('/path'), app.post('/path')
            m = re.search(r'(?:@?(?:app|router|api)\.)(get|post|put|delete|patch|options|head)\s*\(\s*[\'"](/[^"\'\s]*)[\'"]', trimmed, re.I)
            if m:
                method = m.group(1).upper()
                endpoint = m.group(2).strip()
                route_definitions.setdefault(endpoint, []).append((file_path, idx, method, trimmed))
                continue

            # 3. Spring Boot
            m = re.search(r'@(Get|Post|Put|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?[\'"](/[^"\'\s]*)[\'"]', trimmed, re.I)
            if m:
                method = m.group(1).upper()
                endpoint = m.group(2).strip()
                route_definitions.setdefault(endpoint, []).append((file_path, idx, method, trimmed))
                continue

            # 4. Go Gin / Echo / Chi: r.GET('/path', ...)
            m = re.search(r'\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*[\'"](/[^"\'\s]*)[\'"]', trimmed)
            if m:
                method = m.group(1).upper()
                endpoint = m.group(2).strip()
                route_definitions.setdefault(endpoint, []).append((file_path, idx, method, trimmed))
                continue

    @staticmethod
    def _extract_http_calls(
        src_path: str,
        content: str,
        route_definitions: Dict[str, List[Tuple[str, int, str, str]]],
        all_paths: Optional[Set[str]] = None,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        lines = content.split('\n')

        client_patterns = [
            re.compile(r'(?:fetch|axios\.(?:get|post|put|delete)|requests\.(?:get|post|put|delete)|http\.(?:Get|Post))\s*\(\s*[`\'"]([^`\'"\s]+)[`\'"]', re.I),
            re.compile(r'(?:api_url|apiurl|base_url|endpoint|url|target_url|service_url)\s*[:=]\s*[`\'"]([^`\'"\s]+)[`\'"]', re.I),
            re.compile(r'https?://(?:localhost|127\.0\.0\.1|[a-zA-Z0-9\.\-]+)(?::\d+)?(/[^`\'"\s\?\#]+)', re.I),
        ]

        def path_dist(path_a: str, path_b: str) -> int:
            parts_a = path_a.split('/')
            parts_b = path_b.split('/')
            i = 0
            while i < len(parts_a) and i < len(parts_b) and parts_a[i] == parts_b[i]:
                i += 1
            return (len(parts_a) - i) + (len(parts_b) - i)

        matched_targets_for_file = set()

        for idx, line in enumerate(lines, 1):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith(('//', '#', '/*')):
                continue

            for pat in client_patterns:
                match = pat.search(trimmed)
                if match:
                    raw_url = match.group(1).strip()
                    endpoint_candidate = re.sub(r'^https?:\/\/[^\/]+', '', raw_url).split('?')[0]
                    if endpoint_candidate.startswith('/'):
                        matching_routes = route_definitions.get(endpoint_candidate)
                        if not matching_routes:
                            for ep, defs in route_definitions.items():
                                if ep == endpoint_candidate or (ep != '/' and endpoint_candidate.startswith(ep.rstrip('/') + '/')):
                                    matching_routes = defs
                                    break

                        if matching_routes:
                            # Prioritize the backend file closest to the caller in directory hierarchy
                            closest = sorted(
                                matching_routes,
                                key=lambda item: path_dist(src_path, item[0])
                            )[0]
                            target_file, target_line, method, route_snippet = closest
                            if target_file != src_path and (target_file, endpoint_candidate) not in matched_targets_for_file:
                                matched_targets_for_file.add((target_file, endpoint_candidate))
                                results.append({
                                    'target_file': target_file,
                                    'type': 'CALLS',
                                    'line': idx,
                                    'snippet': trimmed[:200],
                                    'statement': f"{method} {endpoint_candidate}",
                                    'method': f"REST API Call -> {target_file}:{target_line}",
                                })
        return results

    # --------------------------------------------------------------------------
    # Codebase Graph Builder (Nodes, Edges, Module Aggregation)
    # --------------------------------------------------------------------------
    @staticmethod
    def _build_codebase_graph(
        files: List[Dict[str, Any]],
        file_dependencies: List[CodebaseFileDependency],
        detected_modules: Optional[List[Any]] = None,
    ) -> Tuple[List[CodebaseModuleDependency], CodebaseGraph]:
        imports_by_file: Dict[str, List[str]] = {f['path']: [] for f in files}
        imported_by_file: Dict[str, List[str]] = {f['path']: [] for f in files}

        for dep in file_dependencies:
            if dep.source_file in imports_by_file:
                imports_by_file[dep.source_file].append(dep.target_file)
            if dep.target_file in imported_by_file:
                imported_by_file[dep.target_file].append(dep.source_file)

        file_to_module: Dict[str, str] = {}
        if detected_modules:
            for mod in detected_modules:
                mod_path = getattr(mod, 'path', '')
                for f in files:
                    if f['path'].startswith(mod_path + '/') or f['path'] == mod_path:
                        file_to_module[f['path']] = getattr(mod, 'id', '')

        nodes: List[CodebaseNode] = []
        for f in files:
            p = f['path']
            mod_id = file_to_module.get(p)
            nodes.append(
                CodebaseNode(
                    id=p,
                    name=os.path.basename(p),
                    type='file',
                    path=p,
                    extension=f.get('extension'),
                    language=f.get('language'),
                    category=f.get('category'),
                    size_bytes=f.get('size', 0),
                    lines_count=f.get('lines', 0) or 0,
                    module_id=mod_id,
                    service_id=f.get('associated_entity_id'),
                    imports=imports_by_file.get(p, []),
                    imported_by=imported_by_file.get(p, []),
                )
            )

        module_deps_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for dep in file_dependencies:
            src_mod = file_to_module.get(dep.source_file)
            tgt_mod = file_to_module.get(dep.target_file)
            if src_mod and tgt_mod and src_mod != tgt_mod:
                pair = (src_mod, tgt_mod)
                if pair not in module_deps_map:
                    module_deps_map[pair] = {
                        'count': 0,
                        'evidence': SourceEvidence(
                            file=dep.source_file,
                            line=dep.line,
                            snippet=dep.snippet,
                            detectionMethod=dep.detectionMethod,
                            folderModule=src_mod,
                        )
                    }
                module_deps_map[pair]['count'] += 1

        module_dependencies: List[CodebaseModuleDependency] = [
            CodebaseModuleDependency(
                id=f"moddep-{src}-{tgt}",
                source_module=src,
                target_module=tgt,
                type='USES',
                count=data['count'],
                sample_evidence=data['evidence'],
            )
            for (src, tgt), data in module_deps_map.items()
        ]

        codebase_graph = CodebaseGraph(
            nodes=nodes,
            edges=file_dependencies,
            module_dependencies=module_dependencies,
            total_nodes=len(nodes),
            total_edges=len(file_dependencies),
            total_imports=len([d for d in file_dependencies if d.type in ('IMPORTS', 'REQUIRES', 'INCLUDES', 'USES')]),
        )

        return module_dependencies, codebase_graph
