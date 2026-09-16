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
  Layers,
  AppWindow,
  ShieldCheck,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureRelationship,
  EntityType,
  EvidenceConfidence,
  DiffNodeItem,
  DiffRelationshipItem,
} from '../../types/architecture';
import { getCanonicalNodeKey, getCanonicalRelKey } from '../../engine/architectureDiffEngine';

interface ArchitectureDetailsPanelProps {
  selectedEntity: ArchitectureEntity | null;
  selectedRelationship?: ArchitectureRelationship | null;
  allEntities: ArchitectureEntity[];
  relationships: ArchitectureRelationship[];
  onClose: () => void;
  onSelectEntity: (entityId: string) => void;
  diffMode?: boolean;
  diffNodesMap?: Map<string, DiffNodeItem>;
  diffEdgesMap?: Map<string, DiffRelationshipItem>;
}

export const ArchitectureDetailsPanel: React.FC<ArchitectureDetailsPanelProps> = ({
  selectedEntity,
  selectedRelationship,
  allEntities,
  relationships,
  onClose,
  onSelectEntity,
  diffMode = false,
  diffNodesMap,
  diffEdgesMap,
}) => {
  const getEntity = (id: string) => allEntities.find((e) => e.id === id);

  const renderConfidenceBadge = (confidence?: EvidenceConfidence) => {
    const level = confidence || 'HIGH';
    const styles = {
      HIGH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
      LOW: 'bg-slate-100 text-slate-600 border-slate-200',
    }[level];

    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold border ${styles}`}>
        <ShieldCheck className="w-2.5 h-2.5" />
        {level} CONFIDENCE
      </span>
    );
  };

  // 1. RELATIONSHIP / EDGE SELECTED VIEW
  if (selectedRelationship && !selectedEntity) {
    const relKey = getCanonicalRelKey(selectedRelationship);
    const diffRel = diffEdgesMap?.get(relKey);
    const sourceEnt = getEntity(selectedRelationship.source);
    const targetEnt = getEntity(selectedRelationship.target);
    const evidence = selectedRelationship.sourceEvidence || diffRel?.sourceEvidence;

    return (
      <aside className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20 overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                Dependency Relationship
              </span>
              {diffMode && diffRel && (
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${
                    diffRel.changeType === 'added'
                      ? 'bg-emerald-600 text-white'
                      : diffRel.changeType === 'removed'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {diffRel.changeType === 'added'
                    ? '+ ADDED'
                    : diffRel.changeType === 'removed'
                    ? '- REMOVED'
                    : 'UNCHANGED'}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-slate-900 mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-blue-700 cursor-pointer hover:underline" onClick={() => onSelectEntity(selectedRelationship.source)}>
                {sourceEnt?.name || selectedRelationship.source}
              </span>
              <span className="text-slate-400 font-mono text-xs">→</span>
              <span className="text-blue-700 cursor-pointer hover:underline" onClick={() => onSelectEntity(selectedRelationship.target)}>
                {targetEnt?.name || selectedRelationship.target}
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Metadata Card */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Relationship Type:</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {selectedRelationship.type}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Protocol / Transport:</span>
              <span className="font-semibold text-slate-800">{selectedRelationship.protocol || 'Default'}</span>
            </div>
            {diffMode && diffRel && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Source Snapshot:</span>
                <span className="font-semibold text-purple-700">{diffRel.versionOrigin}</span>
              </div>
            )}
            {selectedRelationship.description && (
              <div className="text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                {selectedRelationship.description}
              </div>
            )}
          </div>

          {/* Source Evidence & Traceability */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                Source Evidence
              </span>
              {renderConfidenceBadge(evidence?.confidence)}
            </div>

            <div className="p-3 rounded-xl bg-slate-900 text-slate-100 space-y-2">
              <div className="text-xs">
                <span className="text-slate-400">File: </span>
                <span className="font-mono text-teal-300">
                  {evidence?.file || 'unavailable'}
                  {evidence?.line ? `:${evidence.line}` : ''}
                </span>
              </div>
              {evidence?.method && (
                <div className="text-[11px] text-slate-400">
                  Method: <span className="text-slate-200">{evidence.method}</span>
                </div>
              )}
              {evidence?.snippet ? (
                <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[10px] text-emerald-300 break-all leading-relaxed">
                  {evidence.snippet}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 italic">
                  No source code snippet available.
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    );
  }
  if (!selectedEntity) {
    return (
      <aside className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full overflow-y-auto">
        <div className="p-6 text-center my-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Component Selected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
            Click any service, application, database, or API node on the graph to inspect its reconstructed architecture details and dependencies.
          </p>
        </div>
      </aside>
    );
  }

  // Find incoming & outgoing relationships
  const incoming = relationships.filter((r) => r.target === selectedEntity.id);
  const outgoing = relationships.filter((r) => r.source === selectedEntity.id);

  const renderTypeIcon = (type: EntityType) => {
    switch (type) {
      case 'Application':
        return <AppWindow className="w-4 h-4 text-purple-600" />;
      case 'Service':
        return <Server className="w-4 h-4 text-blue-600" />;
      case 'Database':
        return <Database className="w-4 h-4 text-emerald-600" />;
      case 'API':
        return <Globe className="w-4 h-4 text-teal-600" />;
      case 'Module':
        return <Box className="w-4 h-4 text-indigo-600" />;
      case 'Library':
        return <BookOpen className="w-4 h-4 text-cyan-600" />;
      case 'External System':
        return <ExternalLink className="w-4 h-4 text-amber-600" />;
    }
  };

  const nodeKey = getCanonicalNodeKey(selectedEntity);
  const diffNode = diffNodesMap?.get(nodeKey);

  return (
    <aside className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs mt-0.5 shrink-0">
            {renderTypeIcon(selectedEntity.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {selectedEntity.type}
              </span>
              {diffMode && diffNode && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider uppercase ${
                    diffNode.changeType === 'added'
                      ? 'bg-emerald-600 text-white'
                      : diffNode.changeType === 'removed'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {diffNode.changeType === 'added'
                    ? '+ ADDED'
                    : diffNode.changeType === 'removed'
                    ? '- REMOVED'
                    : 'UNCHANGED'}
                </span>
              )}
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
            {selectedEntity.metadata?.framework && (
              <div className="text-slate-400 text-[10px] mt-1.5">
                Framework: <span className="text-slate-200">{selectedEntity.metadata.framework}</span>
              </div>
            )}
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
              No inbound callers detected (Root entry point or isolated component).
            </p>
          ) : (
            <div className="space-y-2">
              {incoming.map((rel) => {
                const source = getEntity(rel.source);
                const relKey = getCanonicalRelKey(rel);
                const diffRel = diffEdgesMap?.get(relKey);
                return (
                  <div
                    key={rel.id}
                    onClick={() => onSelectEntity(rel.source)}
                    className="group p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer bg-white space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                          {source?.name || rel.source}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {rel.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {diffMode && diffRel && (
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              diffRel.changeType === 'added'
                                ? 'bg-emerald-600 text-white'
                                : diffRel.changeType === 'removed'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {diffRel.changeType === 'added' ? '+ ADDED' : diffRel.changeType === 'removed' ? '- REMOVED' : 'UNCHANGED'}
                          </span>
                        )}
                        {renderConfidenceBadge(rel.sourceEvidence?.confidence)}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 truncate">
                      Protocol: {rel.protocol || 'Default'}
                      {rel.sourceEvidence?.method && ` • ${rel.sourceEvidence.method}`}
                    </div>

                    {rel.sourceEvidence?.snippet && (
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-200 font-mono text-[10px] text-slate-700 truncate">
                        {rel.sourceEvidence.snippet}
                      </div>
                    )}
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
              No outbound dependencies (Leaf entity / datastore).
            </p>
          ) : (
            <div className="space-y-2">
              {outgoing.map((rel) => {
                const target = getEntity(rel.target);
                const relKey = getCanonicalRelKey(rel);
                const diffRel = diffEdgesMap?.get(relKey);
                return (
                  <div
                    key={rel.id}
                    onClick={() => onSelectEntity(rel.target)}
                    className="group p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer bg-white space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                          {target?.name || rel.target}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {rel.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {diffMode && diffRel && (
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              diffRel.changeType === 'added'
                                ? 'bg-emerald-600 text-white'
                                : diffRel.changeType === 'removed'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {diffRel.changeType === 'added' ? '+ ADDED' : diffRel.changeType === 'removed' ? '- REMOVED' : 'UNCHANGED'}
                          </span>
                        )}
                        {renderConfidenceBadge(rel.sourceEvidence?.confidence)}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 truncate">
                      Protocol: {rel.protocol || 'Default'}
                      {rel.sourceEvidence?.method && ` • ${rel.sourceEvidence.method}`}
                    </div>

                    {rel.sourceEvidence?.snippet && (
                      <div className="p-1.5 bg-slate-50 rounded border border-slate-200 font-mono text-[10px] text-slate-700 truncate">
                        {rel.sourceEvidence.snippet}
                      </div>
                    )}
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
