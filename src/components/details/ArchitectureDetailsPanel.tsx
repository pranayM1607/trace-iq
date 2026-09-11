import React from 'react';
import {
  X,
  Server,
  Database,
  Globe,
  Box,
  BookOpen,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  FileCode,
  CheckCircle2,
  ExternalLink as LinkIcon,
  Layers,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
} from '../../types/architecture';

interface ArchitectureDetailsPanelProps {
  selectedEntity: ArchitectureEntity | null;
  allEntities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  onClose: () => void;
  onSelectEntity: (entityId: string) => void;
}

export const ArchitectureDetailsPanel: React.FC<ArchitectureDetailsPanelProps> = ({
  selectedEntity,
  allEntities,
  relationships,
  onClose,
  onSelectEntity,
}) => {
  if (!selectedEntity) {
    return (
      <aside className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto">
        <div className="p-6 text-center my-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Component Selected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
            Click any service, database, or API node on the graph to inspect its reconstructed architecture details and dependencies.
          </p>
        </div>
      </aside>
    );
  }

  // Find incoming & outgoing relationships
  const incoming = relationships.filter((r) => r.target === selectedEntity.id);
  const outgoing = relationships.filter((r) => r.source === selectedEntity.id);

  const getEntity = (id: string) => allEntities.find((e) => e.id === id);

  const renderTypeIcon = (type: EntityType) => {
    switch (type) {
      case 'Service':
        return <Server className="w-4 h-4 text-blue-600" />;
      case 'Database':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'API':
        return <Globe className="w-4 h-4 text-teal-600" />;
      case 'Module':
        return <Box className="w-4 h-4 text-purple-600" />;
      case 'Library':
        return <BookOpen className="w-4 h-4 text-cyan-600" />;
      case 'External System':
        return <ExternalLink className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <aside className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs mt-0.5 shrink-0">
            {renderTypeIcon(selectedEntity.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {selectedEntity.type}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                  selectedEntity.source === 'Detected'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}
              >
                {selectedEntity.source === 'Detected' ? (
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                ) : (
                  <FileCode className="w-2.5 h-2.5 mr-0.5" />
                )}
                {selectedEntity.source}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
              {selectedEntity.name}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
              ID: {selectedEntity.id}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-700">
        {/* Technology & Description */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Technology Stack</span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
              {selectedEntity.technology}
            </span>
          </div>

          {selectedEntity.description && (
            <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2">
              {selectedEntity.description}
            </p>
          )}
        </div>

        {/* Source Traceability */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <FileCode className="w-3.5 h-3.5 text-slate-500" />
            <span>Source Traceability</span>
          </div>
          <div className="bg-slate-900 text-slate-200 rounded-xl p-3 text-xs font-mono border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800 mb-2">
              <span>DETECTED ARTIFACT</span>
              <span className="text-emerald-400 font-semibold">VERIFIED</span>
            </div>
            <div className="text-blue-300 break-all text-[11px]">
              {selectedEntity.metadata?.filePath || 'architecture-blueprint.json'}
            </div>
            {selectedEntity.metadata?.runtime && (
              <div className="text-slate-400 text-[10px] mt-1.5">
                Runtime: <span className="text-slate-200">{selectedEntity.metadata.runtime}</span>
              </div>
            )}
            {selectedEntity.metadata?.endpoints && selectedEntity.metadata.endpoints.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-400 mb-1">Declared Endpoints:</div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                  {selectedEntity.metadata.endpoints.map((ep: string, i: number) => (
                    <div key={i} className="text-[10px] text-teal-300 truncate">
                      • {ep}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Incoming Connections */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>Incoming Connections ({incoming.length})</span>
            </div>
          </div>

          {incoming.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
              No inbound callers detected (Root entry point or isolated service).
            </p>
          ) : (
            <div className="space-y-1.5">
              {incoming.map((rel) => {
                const source = getEntity(rel.source);
                return (
                  <div
                    key={rel.id}
                    onClick={() => onSelectEntity(rel.source)}
                    className="group flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                          {source?.name || rel.source}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {rel.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        Protocol: {rel.protocol || 'Default'}
                      </div>
                    </div>
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outgoing Connections */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
              <span>Outgoing Dependencies ({outgoing.length})</span>
            </div>
          </div>

          {outgoing.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
              No outbound dependencies (Leaf entity / terminal node).
            </p>
          ) : (
            <div className="space-y-1.5">
              {outgoing.map((rel) => {
                const target = getEntity(rel.target);
                return (
                  <div
                    key={rel.id}
                    onClick={() => onSelectEntity(rel.target)}
                    className="group flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer bg-white"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                          {target?.name || rel.target}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {rel.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        Protocol: {rel.protocol || 'Default'}
                      </div>
                    </div>
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
