import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  Network,
  ArrowRightLeft,
  FileCode,
  FileCheck2,
  ChevronRight,
} from 'lucide-react';
import type { ArchitectureModel } from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';

interface SearchResultItem {
  id: string;
  category: 'component' | 'dependency' | 'file' | 'evidence';
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  targetRoute: NavRoute;
  targetEntityId?: string;
  targetEdgeId?: string;
  filePath?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ArchitectureModel;
  onNavigate: (route: NavRoute) => void;
  onSelectEntity?: (id: string) => void;
  onSelectEdge?: (id: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  model,
  onNavigate,
  onSelectEntity,
  onSelectEdge,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K and Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setActiveFilter('all');
    }
  }, [isOpen]);

  // Build searchable index
  const allResults = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = [];

    // 1. Components / Entities
    (model.entities || []).forEach((entity) => {
      items.push({
        id: `entity-${entity.id}`,
        category: 'component',
        title: entity.name,
        subtitle: `${entity.type} • ${entity.technology} ${entity.description ? `• ${entity.description}` : ''}`,
        badge: entity.type.toUpperCase(),
        badgeColor: 'bg-violet-50 text-violet-700 border border-violet-200',
        targetRoute: 'architecture',
        targetEntityId: entity.id,
      });
    });

    // 2. Dependencies
    (model.relationships || []).forEach((rel) => {
      items.push({
        id: `rel-${rel.id}`,
        category: 'dependency',
        title: `${rel.source} → ${rel.target}`,
        subtitle: `${rel.type} via ${rel.protocol || 'Default'} (Confidence: ${rel.sourceEvidence?.confidence || 'MEDIUM'})`,
        badge: 'DEPENDENCY',
        badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        targetRoute: 'dependencies',
        targetEdgeId: rel.id,
      });
    });

    // 3. Repository Inventory Files
    if (model.inventory?.files) {
      model.inventory.files.forEach((file) => {
        const sizeKb = file.size_bytes ? (file.size_bytes / 1024).toFixed(1) : '0';
        items.push({
          id: `file-${file.path}`,
          category: 'file',
          title: file.path,
          subtitle: `Size: ${sizeKb} KB • Status: ${file.analysis_status || 'Retained'}`,
          badge: 'FILE',
          badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200',
          targetRoute: 'inventory',
          filePath: file.path,
        });
      });
    }

    // 4. Evidence Citations
    (model.relationships || []).forEach((rel) => {
      if (rel.sourceEvidence?.file) {
        items.push({
          id: `evidence-${rel.id}`,
          category: 'evidence',
          title: `Citation in ${rel.sourceEvidence.file}`,
          subtitle: rel.sourceEvidence.description || `${rel.source} ${rel.type} ${rel.target}`,
          badge: 'EVIDENCE',
          badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
          targetRoute: 'evidence',
          targetEdgeId: rel.id,
        });
      }
    });

    return items;
  }, [model]);

  // Filter and search
  const filteredResults = useMemo(() => {
    let result = allResults;
    if (activeFilter !== 'all') {
      result = result.filter((item) => item.category === activeFilter);
    }
    if (!query.trim()) {
      return result.slice(0, 15);
    }
    const q = query.toLowerCase().trim();
    return result
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.badge.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [allResults, activeFilter, query]);

  const handleSelectItem = (item: SearchResultItem) => {
    onNavigate(item.targetRoute);
    if (item.targetEntityId && onSelectEntity) {
      onSelectEntity(item.targetEntityId);
    }
    if (item.targetEdgeId && onSelectEdge) {
      onSelectEdge(item.targetEdgeId);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-violet-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search components, dependencies, files, evidence..."
            className="flex-1 bg-transparent border-none outline-hidden text-sm font-medium text-slate-900 placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs bg-white">
          {[
            { id: 'all', label: 'All Results' },
            { id: 'component', label: 'Components' },
            { id: 'dependency', label: 'Dependencies' },
            { id: 'file', label: 'Files' },
            { id: 'evidence', label: 'Evidence' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                activeFilter === f.id
                  ? 'bg-violet-100 text-violet-800'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-100">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching elements found for "{query}"
            </div>
          ) : (
            filteredResults.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-violet-50 transition-colors">
                    {item.category === 'component' && <Network className="w-4 h-4 text-violet-600" />}
                    {item.category === 'dependency' && <ArrowRightLeft className="w-4 h-4 text-indigo-600" />}
                    {item.category === 'file' && <FileCode className="w-4 h-4 text-slate-600" />}
                    {item.category === 'evidence' && <FileCheck2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate group-hover:text-violet-700">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{filteredResults.length} matches indexed</span>
          <span>Click to navigate</span>
        </div>
      </div>
    </div>
  );
};
