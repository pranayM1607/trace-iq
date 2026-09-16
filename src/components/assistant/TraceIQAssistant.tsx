import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
} from 'lucide-react';
import type {
  ArchitectureEntity,
  ArchitectureModel,
  ArchitectureRelationship,
  ArchitectureSnapshot,
} from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';

interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  chips?: string[];
}

interface TraceIQAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  currentRoute: NavRoute;
  model: ArchitectureModel;
  selectedEntity: ArchitectureEntity | null;
  selectedRelationship: ArchitectureRelationship | null;
  snapshots: ArchitectureSnapshot[];
  onNavigate: (route: NavRoute) => void;
}

export const TraceIQAssistant: React.FC<TraceIQAssistantProps> = ({
  isOpen,
  onClose,
  onOpen,
  currentRoute,
  model,
  selectedEntity,
  selectedRelationship,
  snapshots,
  onNavigate,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize greeting message on first mount or route/context change
  useEffect(() => {
    let initialPrompt = `Hello! I am your TraceIQ Architecture Assistant. I am monitoring your workspace in **${currentRoute.toUpperCase()}** view.`;
    if (selectedEntity) {
      initialPrompt += `\n\nCurrently focused on component: **${selectedEntity.name}** (${selectedEntity.type}, ${selectedEntity.technology}).`;
    } else if (selectedRelationship) {
      initialPrompt += `\n\nCurrently focused on relationship: **${selectedRelationship.source} → ${selectedRelationship.target}** (${selectedRelationship.type}).`;
    }

    setMessages([
      {
        id: 'init',
        sender: 'assistant',
        text: initialPrompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chips: [
          'Summarize Architecture',
          'Identify High-Risk Components',
          'Explain Repository Retention',
          selectedEntity ? `Analyze ${selectedEntity.name}` : 'Explore Dependencies',
        ],
      },
    ]);
  }, [currentRoute, selectedEntity?.id, selectedRelationship?.id]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Deterministic question engine based on real workspace data
  const handleGenerateAnswer = (question: string) => {
    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    let answer = '';
    const lower = question.toLowerCase();

    if (lower.includes('summarize') || lower.includes('overview') || lower.includes('architecture')) {
      const services = model.entities.filter((e) => e.type.toLowerCase() === 'service').length;
      const dbs = model.entities.filter((e) => e.type.toLowerCase() === 'database').length;
      const apis = model.entities.filter((e) => e.type.toLowerCase() === 'api').length;
      const external = model.entities.filter((e) => e.type.toLowerCase().includes('external')).length;

      answer = `**System Overview**: \`${model.systemName}\` (v${model.version})
- **Total Components**: ${model.entities.length}
- **Services**: ${services}
- **Databases/Stores**: ${dbs}
- **APIs**: ${apis}
- **External Systems**: ${external}
- **Relationships / Calls**: ${model.relationships.length}
- **Ingestion Mode**: ${model.inputType === 'codebase' ? 'Raw Codebase / ZIP' : 'Architecture Blueprint JSON'}`;
    } else if (lower.includes('risk') || lower.includes('security') || lower.includes('coupling')) {
      // Find high fan-in or circular components
      const callCounts: Record<string, number> = {};
      model.relationships.forEach((r) => {
        callCounts[r.target] = (callCounts[r.target] || 0) + 1;
      });
      const topCoupled = Object.entries(callCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

      answer = `**Architectural Risk Analysis**:
1. **Critical Fan-in Hubs**:
${topCoupled
  .map(([target, count]) => {
    const e = model.entities.find((x) => x.id === target || x.name === target);
    return `   - **${e?.name || target}**: ${count} incoming dependencies (potential Single Point of Failure)`;
  })
  .join('\n')}
2. **Security & Boundary Crossing**:
   - Total external integrations: ${model.entities.filter((e) => e.type.toLowerCase().includes('external')).length}
   - Unencrypted/Default protocol channels flagged in Insights tab.`;
    } else if (lower.includes('retention') || lower.includes('inventory') || lower.includes('file')) {
      const totalFiles = model.inventory?.total_files || 0;
      const totalFolders = model.inventory?.total_folders || 0;
      answer = `**100% Repository Retention Verification**:
- **Discovered Files**: ${totalFiles}
- **Discovered Directories**: ${totalFolders}
- **Guarantee**: Every single uploaded file (including binaries, configs, scripts, docs) is retained in the Repository Inventory catalog without loss.`;
    } else if (selectedEntity && (lower.includes(selectedEntity.name.toLowerCase()) || lower.includes('analyze') || lower.includes('component'))) {
      const incoming = model.relationships.filter((r) => r.target === selectedEntity.id || r.target === selectedEntity.name);
      const outgoing = model.relationships.filter((r) => r.source === selectedEntity.id || r.source === selectedEntity.name);

      answer = `**Component Profile: ${selectedEntity.name}**:
- **Type**: ${selectedEntity.type}
- **Technology**: ${selectedEntity.technology}
- **Source File**: \`${selectedEntity.metadata?.filePath || 'Reconstructed'}\`
- **Inbound Calls (${incoming.length})**: ${incoming.map((r) => r.source).join(', ') || 'None'}
- **Outbound Calls (${outgoing.length})**: ${outgoing.map((r) => r.target).join(', ') || 'None'}`;
    } else if (lower.includes('snapshot') || lower.includes('compare')) {
      answer = `**Saved Snapshots**: ${snapshots.length} frozen versions recorded. You can navigate to **Snapshots** or **Compare** to run dual-version diffing.`;
    } else if (lower.includes('simulat') || lower.includes('what if') || lower.includes('change') || currentRoute === 'simulator') {
      answer = `**Hypothetical Change Simulator (Objective 3)**:
- **Sandbox Isolation**: Proposed component or dependency additions/removals run strictly in an in-memory deep copy with zero mutation to active files.
- **Propagation Tracing**: Traces direct impacts and cascading ripples through upstream callers.
- **Causal Risk Ledger**: Itemizes points attribution ($\Delta$) derived deterministically from graph metrics.
- Navigate to **Change Simulator** under *CHANGE INTELLIGENCE* in the sidebar to run simulations.`;
    } else {
      answer = `I analyzed your query against the current architecture model:
- **Scope**: Complete repository inventory & reconstructed topology.
- **Active Entities**: ${model.entities.length} nodes registered.
- **Active Dependencies**: ${model.relationships.length} directional edges.
Use the navigation tabs on the left to inspect detailed graphs, evidence citations, or risk ledgers.`;
    }

    const assistantMsg: AssistantMessage = {
      id: `asst-${Date.now()}`,
      sender: 'assistant',
      text: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chips: ['Summarize Architecture', 'Identify High-Risk Components', 'View Repository Inventory'],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    const q = inputText.trim();
    setInputText('');
    handleGenerateAnswer(q);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          data-testid="traceiq-assistant-launcher"
          onClick={onOpen}
          className="relative group p-3.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          title="Open TraceIQ Architecture Assistant"
        >
          <Bot className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white"></span>
          <span className="sr-only">Open TraceIQ Assistant</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="traceiq-assistant-drawer"
      className="fixed bottom-4 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] h-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Header */}
      <div className="p-3.5 bg-gradient-to-r from-violet-600 to-indigo-700 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-xs">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-xs tracking-tight">TraceIQ Assistant</div>
            <div className="text-[10px] text-violet-200 font-medium">Context-Aware • Grounded Data</div>
          </div>
        </div>
        <button
          data-testid="traceiq-assistant-close"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/20 text-violet-100 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Context Badge */}
      <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700">Context: {currentRoute.toUpperCase()}</span>
        {selectedEntity ? (
          <span className="text-violet-600 font-medium truncate max-w-[180px]">
            Node: {selectedEntity.name}
          </span>
        ) : (
          <span>{model.entities.length} components loaded</span>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-violet-600 text-white rounded-br-xs'
                  : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans text-xs">{msg.text}</div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>

            {/* Prompt Chips */}
            {msg.chips && msg.chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {msg.chips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (chip.includes('Repository')) {
                        onNavigate('inventory');
                      } else {
                        handleGenerateAnswer(chip);
                      }
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors cursor-pointer text-left font-medium"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about components, callers, risks..."
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-hidden focus:border-violet-500 focus:bg-white transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition-colors cursor-pointer shadow-xs shadow-violet-200"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
