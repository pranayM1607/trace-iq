import React from 'react';
import {
  Layers,
  GitCompare,
  Network,
  ArrowRightLeft,
  FolderTree,
  ShieldAlert,
  Zap,
  FileCheck2,
  FileBarChart2,
  Activity,
  HardDrive,
  Sliders,
} from 'lucide-react';

export type NavRoute =
  | 'analyze'
  | 'compare'
  | 'architecture'
  | 'dependencies'
  | 'inventory'
  | 'risk'
  | 'impact'
  | 'evidence'
  | 'simulator'
  | 'reports';

interface SidebarProps {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  inventoryCount?: number;
  entitiesCount?: number;
  highRiskCount?: number;
  systemName?: string;
  isProcessing?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  inventoryCount,
  entitiesCount,
  highRiskCount = 0,
  systemName,
  isProcessing,
}) => {
  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        {
          id: 'analyze' as NavRoute,
          label: 'Analyze',
          description: 'Upload ZIP / JSON workspace',
          icon: Layers,
          badge: isProcessing ? 'Processing' : undefined,
          badgeColor: 'bg-amber-100 text-amber-700 animate-pulse',
        },
        {
          id: 'compare' as NavRoute,
          label: 'Compare',
          description: 'Dual-version architecture diff',
          icon: GitCompare,
        },
      ],
    },
    {
      title: 'ARCHITECTURE',
      items: [
        {
          id: 'architecture' as NavRoute,
          label: 'Architecture Graph',
          description: 'Interactive component canvas',
          icon: Network,
          badge: entitiesCount !== undefined ? `${entitiesCount} nodes` : undefined,
          badgeColor: 'bg-slate-100 text-slate-600',
        },
        {
          id: 'dependencies' as NavRoute,
          label: 'Dependencies',
          description: 'Service calls & protocols',
          icon: ArrowRightLeft,
        },
        {
          id: 'inventory' as NavRoute,
          label: 'Repository Inventory',
          description: '100% file retention audit',
          icon: FolderTree,
          badge: inventoryCount !== undefined ? `${inventoryCount}` : undefined,
          badgeColor: 'bg-violet-100 text-violet-700',
        },
      ],
    },
    {
      title: 'INSIGHTS',
      items: [
        {
          id: 'risk' as NavRoute,
          label: 'Risk Analysis',
          description: 'Coupling & architectural risks',
          icon: ShieldAlert,
          badge: highRiskCount > 0 ? `${highRiskCount} High` : undefined,
          badgeColor: 'bg-rose-100 text-rose-700',
        },
        {
          id: 'impact' as NavRoute,
          label: 'Impact Analysis',
          description: 'Blast radius & callers',
          icon: Zap,
        },
        {
          id: 'evidence' as NavRoute,
          label: 'Evidence',
          description: 'Code provenance & citations',
          icon: FileCheck2,
        },
      ],
    },
    {
      title: 'CHANGE INTELLIGENCE',
      items: [
        {
          id: 'simulator' as NavRoute,
          label: 'Change Simulator',
          description: 'Hypothetical changes & risk delta',
          icon: Sliders,
        },
      ],
    },
    {
      title: 'REPORTS',
      items: [
        {
          id: 'reports' as NavRoute,
          label: 'Reports',
          description: 'Architecture & risk ledger',
          icon: FileBarChart2,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 select-none z-20">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-xs shadow-violet-200">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">TRACEIQ</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                PRO
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">
              Architecture Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Active Workspace Pill */}
      {systemName && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
            <HardDrive className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            <div className="truncate flex-1">
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Current System</div>
              <div className="font-medium text-slate-800 truncate" title={systemName}>
                {systemName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="text-[10px] font-bold tracking-wider text-slate-600 uppercase px-2.5 mb-1.5">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = currentRoute === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group ${
                      isActive
                        ? 'bg-violet-50 text-violet-700 font-semibold border border-violet-200/70 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-violet-600'
                            : 'text-slate-600 group-hover:text-slate-600'
                        }`}
                      />
                      <span className="text-xs truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ml-1.5 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Status Bar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">TraceIQ v1.2</span>
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Workspace Ready
          </span>
        </div>
      </div>
    </aside>
  );
};
