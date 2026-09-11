import React from 'react';
import {
  Server,
  Database,
  Globe,
  Box,
  BookOpen,
  ExternalLink,
  GitFork,
  CheckCircle2,
} from 'lucide-react';
import type { ArchitectureStats as StatsType } from '../../types/architecture';

interface ArchitectureStatsProps {
  stats: StatsType;
  systemName: string;
  version?: string;
  inputType: 'blueprint' | 'codebase' | 'demo';
}

export const ArchitectureStats: React.FC<ArchitectureStatsProps> = ({
  stats,
  systemName,
  version,
  inputType,
}) => {
  const statItems = [
    {
      label: 'Services',
      value: stats.services,
      icon: Server,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200/60',
    },
    {
      label: 'APIs',
      value: stats.apis,
      icon: Globe,
      color: 'text-teal-600',
      bg: 'bg-teal-50 border-teal-200/60',
    },
    {
      label: 'Databases',
      value: stats.databases,
      icon: Database,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200/60',
    },
    {
      label: 'Modules',
      value: stats.modules,
      icon: Box,
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200/60',
    },
    {
      label: 'Libraries',
      value: stats.libraries,
      icon: BookOpen,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50 border-cyan-200/60',
    },
    {
      label: 'External Systems',
      value: stats.externalSystems,
      icon: ExternalLink,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200/60',
    },
    {
      label: 'Relationships',
      value: stats.totalRelationships,
      icon: GitFork,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 border-indigo-200/60',
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
      {/* System identity */}
      <div className="flex items-center gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
              {systemName}
            </h2>
            {version && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                v{version}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
            <span className="capitalize font-medium text-slate-600">Source: {inputType}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {stats.detectedCount} Detected ({stats.userProvidedCount} Blueprint)
            </span>
          </div>
        </div>
      </div>

      {/* Metrics pills */}
      <div className="flex items-center gap-2 shrink-0">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${item.bg}`}
              title={`${item.value} ${item.label} reconstructed`}
            >
              <Icon className={`w-3.5 h-3.5 ${item.color}`} />
              <span className="text-slate-600">{item.label}</span>
              <span className="font-bold text-slate-900">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
