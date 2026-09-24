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
  ArchitectureComparisonResult,
} from '../../types/architecture';
import type { NavRoute } from '../layout/Sidebar';
import { Objective2AnalysisEngine } from '../../engine/objective2AnalysisEngine';
import { ChangeSimulatorEngine } from '../../engine/changeSimulatorEngine';
import { compareRealModels } from '../../engine/directCompareEngine';

interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  chips?: string[];
}

export interface TraceIQAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  currentRoute: NavRoute;
  model: ArchitectureModel;
  selectedEntity: ArchitectureEntity | null;
  selectedRelationship: ArchitectureRelationship | null;
  onNavigate: (route: NavRoute) => void;
  comparisonResult?: ArchitectureComparisonResult | null;
  compareDirection?: 'v1_to_v2' | 'v2_to_v1';
  simulationTarget?: 'v1' | 'v2' | null;
  selectedFile?: { path: string; content?: string } | null;
}

export type AssistantIntent =
  | 'simulation_action'
  | 'entity_count'
  | 'entity_list'
  | 'repository_file_count'
  | 'repository_file_list'
  | 'architecture_summary'
  | 'risk_score'
  | 'risk_explanation'
  | 'risk_delta'
  | 'dependency_query'
  | 'broken_dependencies'
  | 'changed_components'
  | 'added_components'
  | 'removed_components'
  | 'modified_components'
  | 'impact_analysis'
  | 'evidence_lookup'
  | 'simulation_status'
  | 'comparison_summary'
  | 'file_summary'
  | 'general_knowledge'
  | 'unsupported';

export function routeQueryIntent(
  question: string,
  context?: {
    currentRoute?: string;
    hasComparison?: boolean;
    selectedEntity?: ArchitectureEntity | null;
  }
): AssistantIntent {
  const clean = question.trim();
  const lower = clean.toLowerCase();

  // 1. Simulation Action: "What happens if I remove/delete X?", "Simulate removing X"
  if (
    /(?:what\s+happens\s+if\s+i\s+(?:remove|delete)|simulate\s+(?:removing|deleting)|if\s+i\s+(?:remove|delete))\s+/i.test(question) ||
    (context?.currentRoute === 'simulator' && (lower.includes('remove') || lower.includes('delete')))
  ) {
    return 'simulation_action';
  }

  // 2. Simulation Status: "What is currently simulated?", "Simulation status", "Current simulation target"
  if (
    /(?:what\s+is\s+currently\s+simulated|simulation\s+status|current\s+simulation|active\s+simulation|simulator\s+status|simulat(?:or|ion)\s+target)\b/i.test(lower)
  ) {
    return 'simulation_status';
  }

  // 3. Broken Dependencies: "Are there any broken dependencies?", "What are broken dependencies?", "Dangling callers"
  if (
    /(?:broken\s+dependenc|broken\s+required|dangling\s+caller|unresolved\s+dependenc)/i.test(lower)
  ) {
    return 'broken_dependencies';
  }

  // 4. Risk Delta: "What is the risk delta?", "How did risk change?", "Risk change", "Risk shift"
  if (
    /(?:risk\s+delta|how\s+did\s+risk\s+change|risk\s+change|risk\s+shift|delta\s+in\s+risk|difference\s+in\s+risk)/i.test(lower)
  ) {
    return 'risk_delta';
  }

  // 5. Risk Explanation: "Why is the risk high?", "Why is risk score X?", "Explain risk factors", "Risk breakdown"
  if (
    /(?:why\s+is\s+(?:the\s+)?risk|explain\s+(?:the\s+)?risk|risk\s+factors|risk\s+breakdown|why\s+is\s+risk\s+score|what\s+contributes\s+to\s+risk)/i.test(lower)
  ) {
    return 'risk_explanation';
  }

  // 6. Risk Score: "What is the risk score?", "Risk score", "What is the risk of [Component]"
  if (
    /(?:what\s+is\s+(?:the\s+)?risk\s+score|system\s+risk|risk\s+score|(?:what\s+is\s+(?:the\s+)?risk\s+(?:of|for)|risk\s+(?:of|for))\s+([a-zA-Z0-9_\-\s]+?))\b/i.test(lower) ||
    lower === 'risk' || lower === 'what is the risk?' || lower === 'what is the risk'
  ) {
    return 'risk_score';
  }

  // 7. Added Components: "What components were added?", "Added components"
  if (
    /(?:what\s+components\s+(?:were\s+)?added|added\s+components|which\s+components\s+(?:were\s+)?added|new\s+components)\b/i.test(lower)
  ) {
    return 'added_components';
  }

  // 8. Removed Components: "What components were removed?", "Removed components", "Deleted components"
  if (
    /(?:what\s+components\s+(?:were\s+)?removed|removed\s+components|which\s+components\s+(?:were\s+)?removed|deleted\s+components|decommissioned\s+components)\b/i.test(lower)
  ) {
    return 'removed_components';
  }

  // 9. Modified Components: "What components were modified?", "Modified components", "Updated components"
  if (
    /(?:what\s+components\s+(?:were\s+)?modified|modified\s+components|which\s+components\s+(?:were\s+)?modified|updated\s+components)\b/i.test(lower)
  ) {
    return 'modified_components';
  }

  // 10. Changed Components: "What components changed?", "Changed components"
  if (
    /(?:what\s+components\s+changed|changed\s+components|which\s+components\s+changed|component\s+differences|component\s+diff)\b/i.test(lower)
  ) {
    return 'changed_components';
  }

  // 11. Comparison Summary: "Summarize comparison", "Comparison summary", "What changed between V1 and V2?"
  if (
    /(?:summarize\s+(?:the\s+)?comparison|comparison\s+summary|compare\s+summary|what\s+changed\s+between\s+v1\s+and\s+v2|differences?\s+between\s+v1\s+and\s+v2|compare\s+versions|explain\s+comparison)\b/i.test(lower)
  ) {
    return 'comparison_summary';
  }

  // 12. Repository File Count: "How many files in repository?", "Total files"
  if (
    /(?:how\s+many\s+files|file\s+count|number\s+of\s+files|total\s+files)\b/i.test(lower)
  ) {
    return 'repository_file_count';
  }

  // 13. Repository File List: "List files in repository", "Show file tree", "What files exist?"
  if (
    /(?:list\s+(?:repository\s+)?files|show\s+(?:repository\s+)?files|what\s+files\b|repository\s+file\s+list|show\s+file\s+tree|file\s+tree|files\s+in\s+repo)\b/i.test(lower)
  ) {
    return 'repository_file_list';
  }

  // 14. File Summary: "Explain file pom.xml", "What does file X do?"
  if (
    /(?:explain\s+file|what\s+does\s+file\s+|summarize\s+file|file\s+summary|details\s+of\s+file)\b/i.test(lower) ||
    /\b(?:explain|summarize|details\s+of)\s+([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)\b/i.test(lower)
  ) {
    return 'file_summary';
  }

  // 15. Entity Count: "How many entities/components/services/databases/apis?"
  if (
    /(?:how\s+many\s+(?:entities|components|services|databases|apis|nodes)|(?:entity|component|service|database|api)\s+count)\b/i.test(lower) ||
    lower === 'how many entities?' || lower === 'how many entities' ||
    lower === 'how many components?' || lower === 'how many components' ||
    lower === 'how many services?' || lower === 'how many services' ||
    lower === 'how many databases?' || lower === 'how many databases' ||
    lower === 'how many apis?' || lower === 'how many apis'
  ) {
    return 'entity_count';
  }

  // 16. Entity List: "What are the components?", "List entities", "Show services", "What databases are there?"
  if (
    /(?:what\s+(?:are\s+the\s+)?(?:components|entities|services|databases|apis)|list\s+(?:components|entities|services|databases|apis)|show\s+(?:components|entities|services|databases|apis)|which\s+(?:components|services|databases|apis)|what\s+services\s+are\s+there|what\s+databases\s+are\s+there)\b/i.test(lower)
  ) {
    return 'entity_list';
  }

  // 17. Dependency Query: "What does X depend on?", "What depends on X?", "Who calls X?"
  if (
    /(?:what\s+depends\s+on|what\s+does\s+[a-zA-Z0-9_\-\s]+\s+depend\s+on|who\s+calls\s+|what\s+calls\s+|dependencies\s+of\s+|callers\s+of\s+|who\s+uses\s+)\b/i.test(lower)
  ) {
    return 'dependency_query';
  }

  // 18. Impact Analysis: "What is the impact?", "Blast radius", "Ripple chain"
  if (
    /(?:blast\s*radius|ripple|impact\s+analysis|impact\s+propagation|cascade\s+severity|what\s+is\s+the\s+impact)\b/i.test(lower)
  ) {
    return 'impact_analysis';
  }

  // 19. Evidence Lookup: "Show evidence", "Provenance", "How is this dependency detected?", "What code proves X"
  if (
    /(?:evidence|provenance|source\s+citation|how\s+is\s+(?:this\s+)?dependency\s+detected|what\s+code\s+proves|where\s+is\s+.*defined)\b/i.test(lower)
  ) {
    return 'evidence_lookup';
  }

  // 20. Architecture Summary: "Summarize architecture", "System overview", "Architecture flow"
  if (
    /(?:summarize\s+(?:the\s+)?architecture|architecture\s+summary|architecture\s+overview|system\s+overview|what\s+is\s+this\s+architecture|architecture\s+flow|how\s+does\s+(?:the\s+)?architecture\s+work|explain\s+architecture|overview)\b/i.test(lower)
  ) {
    return 'architecture_summary';
  }

  // 21. General Math & Tech Knowledge
  if (tryComputeGeneralAnswer(question) !== null) {
    return 'general_knowledge';
  }

  // 22. Architecture Domain patterns check
  const domainPatterns = [
    /\btraceiq\b/i, /\barchitect\b/i, /\bcomponent\b/i, /\bservice\b/i, /\bapis?\b/i, /\bendpoint\b/i,
    /\bdatabase\b/i, /\bdb\b/i, /\bstor(e|age)\b/i, /\brisk\b/i, /\bdepend\b/i, /\bcaller\b/i,
    /\bblast\s*radius\b/i, /\bripple\b/i, /\bspof\b/i, /\bsingle\s+point\b/i, /\bcycl(e|ic)\b/i,
    /\bloop\b/i, /\bcircular\b/i, /\bledger\b/i, /\bcausal\b/i, /\binventory\b/i, /\bfiles?\b/i,
    /\bfolders?\b/i, /\bretention\b/i, /\bevidence\b/i, /\bprovenance\b/i, /\bcitation\b/i,
    /\bcompare\b/i, /\bdiff\b/i, /\bsimulat\b/i, /\bchange\b/i, /\bmodels?\b/i, /\bsystems?\b/i,
    /\bnodes?\b/i, /\bedges?\b/i, /\bversions?\b/i, /\bspring\b/i, /\bflask\b/i,
    /\bdocker\b/i, /\bkafka\b/i, /\bgrpc\b/i, /\bmysql\b/i, /\bpostgres\b/i,
    /\bredis\b/i, /\bpropagation\b/i, /\bimpact\b/i, /\bpackages?\b/i, /\bmanifest\b/i,
  ];
  if (domainPatterns.some((pattern) => pattern.test(lower))) {
    return 'architecture_summary';
  }

  return 'unsupported';
}

export const TraceIQAssistant: React.FC<TraceIQAssistantProps> = ({
  isOpen,
  onClose,
  onOpen,
  currentRoute,
  model,
  selectedEntity,
  selectedRelationship,
  onNavigate,
  comparisonResult = null,
  compareDirection = 'v1_to_v2',
  simulationTarget = null,
  selectedFile = null,
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
    } else if (comparisonResult) {
      initialPrompt += `\n\nActive Comparison: **${comparisonResult.originalModel.systemName} (V1)** vs **${comparisonResult.changedModel.systemName} (V2)** [Direction: ${compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2'}].`;
    }

    let defaultChips = ['Summarize Architecture', 'Identify High-Risk Components', 'What are Broken Dependencies?'];
    if (currentRoute === 'compare') {
      defaultChips = ['Summarize Comparison', 'What are Broken Dependencies?', 'What is the Risk Delta?', 'What Components Changed?'];
    } else if (currentRoute === 'simulator') {
      defaultChips = ['How does Change Simulation work?', 'What is Broken Dependency Risk?', 'Explain Causal Risk Ledger'];
    } else if (currentRoute === 'risk') {
      defaultChips = ['Identify High-Risk Components', 'What is Single Point of Failure?', 'Check Circular Loops'];
    } else if (currentRoute === 'impact') {
      defaultChips = ['Explain Blast Radius', 'How is Ripple Chain calculated?', 'Check Critical Services'];
    } else if (currentRoute === 'evidence') {
      defaultChips = ['How is Provenance tracked?', 'Show Source File Citations', 'Summarize Architecture'];
    } else if (selectedEntity) {
      defaultChips = [`Analyze ${selectedEntity.name}`, 'Identify High-Risk Components', 'Summarize Architecture'];
    }

    setMessages([
      {
        id: 'init',
        sender: 'assistant',
        text: initialPrompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        chips: defaultChips,
      },
    ]);
  }, [currentRoute, selectedEntity?.id, selectedRelationship?.id, comparisonResult, compareDirection]);

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

    const answer = computeAssistantAnswer(
      question,
      model,
      currentRoute,
      selectedEntity,
      selectedRelationship,
      comparisonResult,
      compareDirection,
      simulationTarget,
      selectedFile
    );

    let nextChips = ['Summarize Architecture', 'Identify High-Risk Components', 'What are Broken Dependencies?'];
    if (currentRoute === 'compare' || comparisonResult) {
      nextChips = ['Summarize Comparison', 'What is the Risk Delta?', 'What are Broken Dependencies?', 'What Components Changed?'];
    }

    const assistantMsg: AssistantMessage = {
      id: `asst-${Date.now()}`,
      sender: 'assistant',
      text: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chips: nextChips,
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
        <span className="font-semibold text-slate-700">
          Context: {currentRoute.toUpperCase()}
          {comparisonResult && ` • ${compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2'}`}
        </span>
        {selectedEntity ? (
          <span className="text-violet-600 font-medium truncate max-w-[180px]">
            Node: {selectedEntity.name}
          </span>
        ) : simulationTarget ? (
          <span className="text-emerald-700 font-medium">
            Sim Target: {simulationTarget.toUpperCase()}
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
                      if (chip.includes('Repository Inventory')) {
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
          placeholder="Ask about components, callers, risks, simulations..."
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

// Safe helper for math calculations and unit conversions
export const tryComputeGeneralAnswer = (q: string): string | null => {
  const clean = q.trim();
  const lower = clean.toLowerCase();

  // 1. Greetings & Conversational
  if (/^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening))\b/i.test(lower) || lower === 'hi' || lower === 'hello') {
    return 'Hello! How can I help you today?';
  }
  if (/^how are you/i.test(lower)) {
    return 'I am doing well and ready to assist you with your architecture analysis, simulations, and technical questions!';
  }
  if (/^who are you|^what are you/i.test(lower)) {
    return 'I am the TraceIQ Architecture Assistant. I provide context-aware insights, impact analysis, dependency tracing, and technical answers.';
  }
  if (/^thank(s|\s*you)/i.test(lower)) {
    return "You're welcome! Feel free to ask if you have more questions.";
  }

  // 2. Percentage calculation: "what is 20% of 500?" or "20% of 500"
  const percentMatch = lower.match(/(?:what\s+is\s+)?([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:of)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const result = (pct / 100) * total;
    const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(2);
    return `${formatted}`;
  }

  // 3. Unit Conversions
  // Distance: km to miles
  const kmToMiles = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:km|kilometers?)\s*(?:to|in)\s*(?:miles?|mi)/i);
  if (kmToMiles) {
    const val = parseFloat(kmToMiles[1]);
    const res = val * 0.621371;
    return `${val} kilometer${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} miles.`;
  }
  // Distance: miles to km
  const milesToKm = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:miles?|mi)\s*(?:to|in)\s*(?:km|kilometers?)/i);
  if (milesToKm) {
    const val = parseFloat(milesToKm[1]);
    const res = val * 1.60934;
    return `${val} mile${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} kilometers.`;
  }
  // Distance: meters to feet
  const mToFt = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:m|meters?)\s*(?:to|in)\s*(?:feet|ft)/i);
  if (mToFt) {
    const val = parseFloat(mToFt[1]);
    const res = val * 3.28084;
    return `${val} meter${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} feet.`;
  }
  // Distance: feet to meters
  const ftToM = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:feet|ft)\s*(?:to|in)\s*(?:m|meters?)/i);
  if (ftToM) {
    const val = parseFloat(ftToM[1]);
    const res = val / 3.28084;
    return `${val} foot${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} meters.`;
  }
  // Length: cm to inches
  const cmToIn = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:cm|centimeters?)\s*(?:to|in)\s*(?:inches?|in)\b/i);
  if (cmToIn) {
    const val = parseFloat(cmToIn[1]);
    const res = val / 2.54;
    return `${val} centimeter${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} inches.`;
  }
  // Length: inches to cm
  const inToCm = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:inches?|in)\s*(?:to|in)\s*(?:cm|centimeters?)/i);
  if (inToCm) {
    const val = parseFloat(inToCm[1]);
    const res = val * 2.54;
    return `${val} inch${val === 1 ? '' : 'es'} is approximately ${res.toFixed(2)} centimeters.`;
  }
  // Mass: kg to lbs/pounds
  const kgToLbs = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kilograms?)\s*(?:to|in)\s*(?:lbs?|pounds?)/i);
  if (kgToLbs) {
    const val = parseFloat(kgToLbs[1]);
    const res = val * 2.20462;
    return `${val} kilogram${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} pounds.`;
  }
  // Mass: lbs/pounds to kg
  const lbsToKg = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:lbs?|pounds?)\s*(?:to|in)\s*(?:kg|kilograms?)/i);
  if (lbsToKg) {
    const val = parseFloat(lbsToKg[1]);
    const res = val / 2.20462;
    return `${val} pound${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} kilograms.`;
  }
  // Mass: grams to ounces
  const gToOz = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:g|grams?)\s*(?:to|in)\s*(?:oz|ounces?)/i);
  if (gToOz) {
    const val = parseFloat(gToOz[1]);
    const res = val / 28.3495;
    return `${val} gram${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} ounces.`;
  }
  // Mass: ounces to grams
  const ozToG = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:oz|ounces?)\s*(?:to|in)\s*(?:g|grams?)/i);
  if (ozToG) {
    const val = parseFloat(ozToG[1]);
    const res = val * 28.3495;
    return `${val} ounce${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} grams.`;
  }
  // Temp: celsius to fahrenheit
  const cToF = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:°?c|celsius)\s*(?:to|in)\s*(?:°?f|fahrenheit)/i);
  if (cToF) {
    const val = parseFloat(cToF[1]);
    const res = (val * 9) / 5 + 32;
    return `${val}°C is ${res.toFixed(1)}°F.`;
  }
  // Temp: fahrenheit to celsius
  const fToC = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:°?f|fahrenheit)\s*(?:to|in)\s*(?:°?c|celsius)/i);
  if (fToC) {
    const val = parseFloat(fToC[1]);
    const res = ((val - 32) * 5) / 9;
    return `${val}°F is ${res.toFixed(1)}°C.`;
  }
  // Time: minutes to hours
  const minToHr = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:min|minutes?)\s*(?:to|in)\s*(?:hours?|hrs?)/i);
  if (minToHr) {
    const val = parseFloat(minToHr[1]);
    const res = val / 60;
    const formatted = Number.isInteger(res) ? res.toString() : res.toFixed(2);
    return `${val} minute${val === 1 ? '' : 's'} is ${formatted} hour${res === 1 ? '' : 's'}.`;
  }
  // Time: hours to minutes
  const hrToMin = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:hours?|hrs?)\s*(?:to|in)\s*(?:min|minutes?)/i);
  if (hrToMin) {
    const val = parseFloat(hrToMin[1]);
    const res = val * 60;
    return `${val} hour${val === 1 ? '' : 's'} is ${res} minutes.`;
  }
  // Time: hours to days
  const hrToDay = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:hours?|hrs?)\s*(?:to|in)\s*(?:days?|d)/i);
  if (hrToDay) {
    const val = parseFloat(hrToDay[1]);
    const res = val / 24;
    const formatted = Number.isInteger(res) ? res.toString() : res.toFixed(2);
    return `${val} hour${val === 1 ? '' : 's'} is ${formatted} day${res === 1 ? '' : 's'}.`;
  }
  // Time: days to hours
  const dayToHr = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:days?|d)\s*(?:to|in)\s*(?:hours?|hrs?)/i);
  if (dayToHr) {
    const val = parseFloat(dayToHr[1]);
    const res = val * 24;
    return `${val} day${val === 1 ? '' : 's'} is ${res} hours.`;
  }
  // Volume: liters to gallons
  const litToGal = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:l|liters?|litres?)\s*(?:to|in)\s*(?:gallons?|gal)/i);
  if (litToGal) {
    const val = parseFloat(litToGal[1]);
    const res = val * 0.264172;
    return `${val} liter${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} gallons.`;
  }
  // Volume: gallons to liters
  const galToLit = lower.match(/(?:convert\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:gallons?|gal)\s*(?:to|in)\s*(?:l|liters?|litres?)/i);
  if (galToLit) {
    const val = parseFloat(galToLit[1]);
    const res = val * 3.78541;
    return `${val} gallon${val === 1 ? '' : 's'} is approximately ${res.toFixed(2)} liters.`;
  }

  // 4. Basic Arithmetic: "what is 15 + 25?", "calculate 12 * 8", "12 × 8", "100 / 4", "50 - 18"
  const normalizedForMath = lower
    .replace(/×/g, '*')
    .replace(/÷/g, '/');

  const mathMatch = normalizedForMath.match(/^(?:what\s+is\s+|calculate\s+|eval\s+)?\s*([0-9]+(?:\.[0-9]+)?\s*[\+\-\*\/]\s*[0-9]+(?:\.[0-9]+)?(?:\s*[\+\-\*\/]\s*[0-9]+(?:\.[0-9]+)?)*)\s*\??$/i);
  if (mathMatch && mathMatch[1]) {
    const expr = mathMatch[1];
    if (/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
      try {
        const result = Function(`"use strict"; return (${expr});`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
          const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(2);
          return `${formatted}`;
        }
      } catch {
        // Fall through
      }
    }
  }

  // 5. General Tech Knowledge Questions
  if (/^what\s+is\s+(an?\s+)?api\??$/i.test(lower) || lower === 'what is an api' || lower === 'what is an api?') {
    return 'An Application Programming Interface (API) is a set of rules and protocols that allows different software applications to communicate and exchange data.';
  }
  if (/^what\s+is\s+(a\s+)?database\??$/i.test(lower)) {
    return 'A database is an organized collection of structured data, typically stored electronically in a computer system and managed by a Database Management System (DBMS).';
  }
  if (/^what\s+is\s+(a\s+)?microservice\??$/i.test(lower) || /^what\s+are\s+microservices\??$/i.test(lower)) {
    return 'A microservice is an architectural approach where an application is composed of small, independent services that communicate over well-defined APIs.';
  }
  if (/^what\s+is\s+rest\??$/i.test(lower) || /^what\s+is\s+a\s+rest\s+api\??$/i.test(lower)) {
    return 'REST (Representational State Transfer) is a software architectural style for distributed systems, typically using standard HTTP methods (GET, POST, PUT, DELETE) and stateless communication.';
  }
  if (/^what\s+is\s+docker\??$/i.test(lower) || /^what\s+is\s+(a\s+)?container\??$/i.test(lower)) {
    return 'A container is a lightweight, standalone, executable package that includes application code together with its runtime, system tools, libraries, and settings.';
  }
  if (/^what\s+is\s+grpc\??$/i.test(lower)) {
    return 'gRPC is a high-performance, open-source universal RPC framework developed by Google that uses HTTP/2 for transport and Protocol Buffers for interface definition.';
  }
  if (/^what\s+is\s+kafka\??$/i.test(lower)) {
    return 'Apache Kafka is a distributed event store and stream-processing platform designed for high-throughput, fault-tolerant real-time data streaming.';
  }

  return null;
};

// Compute architecture grounded answer
export const computeAssistantAnswer = (
  question: string,
  model: ArchitectureModel,
  currentRoute: string = 'analyze',
  selectedEntity: ArchitectureEntity | null = null,
  selectedRelationship: ArchitectureRelationship | null = null,
  comparisonResult?: ArchitectureComparisonResult | null,
  compareDirection: 'v1_to_v2' | 'v2_to_v1' = 'v1_to_v2',
  simulationTarget: 'v1' | 'v2' | null = null,
  selectedFile?: { path: string; content?: string } | null
): string => {
  const lower = question.trim().toLowerCase();

  // Route query intent across deterministic routing matrix
  const intent = routeQueryIntent(question, {
    currentRoute,
    hasComparison: !!comparisonResult,
    selectedEntity,
  });

  // Handle general knowledge or arithmetic first
  if (intent === 'general_knowledge') {
    const general = tryComputeGeneralAnswer(question);
    if (general) return general;
  }

  // Derive active comparison taking compareDirection into account
  const activeComparison: ArchitectureComparisonResult | null = comparisonResult
    ? (compareDirection === 'v2_to_v1'
        ? compareRealModels(comparisonResult.changedModel, comparisonResult.originalModel)
        : comparisonResult)
    : null;

  // 1. INTENT: simulation_action ("What happens if I remove [Component]?")
  if (intent === 'simulation_action') {
    const removeMatch = lower.match(/(?:what\s+happens\s+if\s+i\s+(?:remove|delete)|simulate\s+(?:removing|deleting)|if\s+i\s+(?:remove|delete))\s+([a-zA-Z0-9_\-\s]+?)(?:\?|$)/i);
    const compQuery = removeMatch ? removeMatch[1].trim() : (selectedEntity?.name || '');

    // Check if target model (V1 or V2) is specified in query
    let resolvedTarget: 'v1' | 'v2' | null = null;
    if (/\b(?:on|in)\s+v1\b/i.test(question) || (/\bv1\b/i.test(question) && !/\bv2\b/i.test(question))) {
      resolvedTarget = 'v1';
    } else if (/\b(?:on|in)\s+v2\b/i.test(question) || (/\bv2\b/i.test(question) && !/\bv1\b/i.test(question))) {
      resolvedTarget = 'v2';
    } else if (simulationTarget) {
      resolvedTarget = simulationTarget;
    }

    // Disambiguation: If comparison has both V1 and V2 models, but target is ambiguous / neither selected
    if (comparisonResult && comparisonResult.originalModel && comparisonResult.changedModel && !resolvedTarget) {
      return 'Do you want to simulate the change on V1 or V2?';
    }

    // Determine base model for simulation
    let simBaseModel: ArchitectureModel = model;
    let targetLabel = '';
    if (comparisonResult && resolvedTarget) {
      simBaseModel = resolvedTarget === 'v1' ? comparisonResult.originalModel : comparisonResult.changedModel;
      targetLabel = resolvedTarget.toUpperCase();
    }

    const targetComp = simBaseModel.entities.find((e) =>
      e.name.toLowerCase() === compQuery.toLowerCase() ||
      e.id.toLowerCase() === compQuery.toLowerCase() ||
      compQuery.toLowerCase().includes(e.name.toLowerCase()) ||
      e.name.toLowerCase().includes(compQuery.toLowerCase())
    ) || (selectedEntity && simBaseModel.entities.find((e) => e.id === selectedEntity.id));

    if (!targetComp) {
      return `Component "${compQuery}" was not found in ${targetLabel ? `${targetLabel} ` : ''}architecture.`;
    }

    const simResult = ChangeSimulatorEngine.simulateChange(simBaseModel, [
      { id: `sim-${Date.now()}`, action: 'remove_component', component_id: targetComp.id }
    ]);
    const direct = simResult.directly_affected_nodes.length;
    const indirect = simResult.indirectly_affected_nodes.length;
    const total = direct + indirect;
    const origScore = simResult.current_risk_score.toFixed(1);
    const simScore = simResult.hypothetical_risk_score.toFixed(1);
    const delta = simResult.risk_delta;
    const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
    const broken = simResult.broken_dependencies?.length ?? 0;

    let banner = targetLabel ? `SIMULATING ON ${targetLabel}: ${targetComp.name}\n\n` : '';
    let response = `${banner}Removing ${targetComp.name}${targetLabel ? ` on ${targetLabel}` : ''} affects ${total} components.\n${direct} are directly affected and ${indirect} are downstream.\nRisk changes from ${origScore} to ${simScore} (${deltaStr}).\nThere are ${broken} broken required dependencies.`;

    if (broken > 0 && simResult.broken_dependencies && simResult.broken_dependencies.length > 0) {
      const brokenDetails = simResult.broken_dependencies.map(
        (b) => `Component ${targetComp.name} was removed, but ${b.callerName} still depends on it. This creates a broken required dependency (+15.0 risk penalty).`
      ).join('\n');
      response += `\n\n${brokenDetails}`;
    }

    return response;
  }

  // 2. INTENT: simulation_status
  if (intent === 'simulation_status') {
    const targetLabel = simulationTarget ? simulationTarget.toUpperCase() : 'None';
    return `**Change Simulation Status**:
- **Active Simulation Target**: ${targetLabel}
- **Simulation Sandbox**: In-memory isolated architecture model (Zero mutation on base models)
- **Supported Capabilities**: Remove component, Decommission service, Calculate blast radius & broken dependencies
- **Target Selection**: In Compare view, you can independently simulate changes on either V1 or V2.`;
  }

  // 3. INTENT: broken_dependencies
  if (intent === 'broken_dependencies') {
    if (comparisonResult && activeComparison) {
      const brokenList = activeComparison.structuralRisk.brokenDependencies || [];
      if (brokenList.length > 0) {
        const details = brokenList.map(
          (b, idx) => `${idx + 1}. Component ${b.removedTargetName} was removed, but ${b.callerName} still depends on it. This creates a broken required dependency (+15.0 risk penalty).`
        ).join('\n');
        return `**Broken Required Dependencies Detected (${brokenList.length})**:\n${details}\n\nRemoving a component while upstream callers still require it adds a +15.0 penalty per broken dependency in the Causal Risk Ledger to prevent runtime outages.`;
      }
      return `No broken required dependencies detected in the current architecture comparison (${compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2'}). All caller dependencies resolve cleanly.`;
    }

    if (lower.includes('what are') || lower.includes('definition') || lower.includes('explain') || lower.includes('how does')) {
      return `**Broken Required Dependency Risk**:
- **Definition**: When a component or database is removed or modified while upstream caller services still depend on it, TraceIQ flags a **Broken Required Dependency**.
- **Risk Impact**: Instead of treating removal as a reduction in coupling, TraceIQ applies a **+15.0 points risk penalty** per affected caller in the Causal Risk Ledger.
- **Why it matters**: Calling a non-existent or decommissioned service causes immediate runtime connection failures and cascade outages unless the callers are updated first.`;
    }

    return `No broken required dependencies detected in the active architecture model. All ${model.relationships.length} dependencies resolve to active components.`;
  }

  // 4. INTENT: risk_delta
  if (intent === 'risk_delta') {
    if (comparisonResult && activeComparison) {
      const dirLabel = compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2';
      const sr = activeComparison.structuralRisk;
      const deltaVal = sr.delta;
      const deltaStr = deltaVal >= 0 ? `+${deltaVal.toFixed(1)}` : deltaVal.toFixed(1);

      let msg = `**Directional Risk Delta (${dirLabel})**:
- **Source (${compareDirection === 'v2_to_v1' ? 'V2' : 'V1'})**: ${sr.originalScore.toFixed(1)}/100 [${sr.originalRiskLevel || 'LOW'}]
- **Target (${compareDirection === 'v2_to_v1' ? 'V1' : 'V2'})**: ${sr.changedScore.toFixed(1)}/100 [${sr.changedRiskLevel || 'LOW'}]
- **Mathematical Formula**: Risk(Target) - Risk(Source) = ${deltaStr} pts
- **Shift Assessment**: ${sr.shiftDirection}
- **Attribution**: ${sr.attributionStatement}`;

      if (sr.brokenDependencies && sr.brokenDependencies.length > 0) {
        msg += `\n\n**Warning**: ${sr.brokenDependencies.length} broken required dependency detected:`;
        sr.brokenDependencies.forEach((b) => {
          msg += `\n- Component ${b.removedTargetName} was removed, but ${b.callerName} still depends on it (+15.0 risk penalty).`;
        });
      }
      return msg;
    }

    return `Risk delta measures the change in structural risk between two architecture versions (V1 and V2) or in a change simulation. Upload or select two versions in the Compare view to compute the directional risk delta.`;
  }

  // 5. INTENT: risk_explanation
  if (intent === 'risk_explanation') {
    const analysis = Objective2AnalysisEngine.analyzeArchitecture(model);
    const score = Objective2AnalysisEngine.calculateDeterministicRiskScore(analysis);
    const spofs = analysis.spofs.filter((s) => s.is_spof);
    return `Risk is ${score.toFixed(1)}/100 because:\n- ${spofs.length} direct dependents / Single Points of Failure\n- high betweenness centrality\n- blast radius across ${analysis.critical_components.length} critical services\n- dependency concentration around central components.`;
  }

  // 6. INTENT: risk_score
  if (intent === 'risk_score') {
    const riskCompMatch = lower.match(/(?:what\s+is\s+(?:the\s+)?risk\s+(?:of|for)|risk\s+(?:of|for))\s+([a-zA-Z0-9_\-\s]+?)(?:\?|$)/i);
    if (riskCompMatch || (lower.includes('risk') && selectedEntity && lower.includes(selectedEntity.name.toLowerCase()))) {
      const compName = riskCompMatch ? riskCompMatch[1].trim() : (selectedEntity?.name || '');
      const targetComp = model.entities.find((e) =>
        e.name.toLowerCase() === compName.toLowerCase() ||
        e.id.toLowerCase() === compName.toLowerCase() ||
        compName.toLowerCase().includes(e.name.toLowerCase()) ||
        e.name.toLowerCase().includes(compName.toLowerCase())
      ) || selectedEntity;

      if (targetComp) {
        const analysis = Objective2AnalysisEngine.analyzeArchitecture(model);
        const crit = analysis.critical_components.find((c) => c.component_id === targetComp.id);
        const m = analysis.component_metrics[targetComp.id];
        const inDeg = m ? (m.in_degree ?? m.direct_callers_count ?? 0) : 0;
        const betweenness = typeof m?.betweenness_centrality === 'number' ? m.betweenness_centrality.toFixed(3) : '0.000';
        const blast = m ? (m.upstream_callers_count ?? inDeg) : inDeg;
        const isSpof = analysis.spofs.some((s) => s.component_id === targetComp.id && s.is_spof);
        const score = crit?.criticality_score !== undefined ? crit.criticality_score.toFixed(1) : Math.min(100, Math.round(inDeg * 15 + (isSpof ? 30 : 0) + (parseFloat(betweenness) * 40))).toFixed(1);

        return `Risk score: ${score}/100.\n\nMain contributors:\n- ${inDeg} direct dependent${inDeg === 1 ? '' : 's'}\n- betweenness centrality: ${betweenness}\n- blast radius: ${blast} component${blast === 1 ? '' : 's'}${isSpof ? '\n- identified as a Single Point of Failure (SPOF)' : '\n- dependency concentration around this component.'}`;
      }
    }

    if (comparisonResult && activeComparison) {
      const v1Analysis = Objective2AnalysisEngine.analyzeArchitecture(comparisonResult.originalModel);
      const v2Analysis = Objective2AnalysisEngine.analyzeArchitecture(comparisonResult.changedModel);
      const v1Score = Objective2AnalysisEngine.calculateDeterministicRiskScore(v1Analysis);
      const v2Score = Objective2AnalysisEngine.calculateDeterministicRiskScore(v2Analysis);
      const v1Level = Objective2AnalysisEngine.getRiskLevel(v1Score);
      const v2Level = Objective2AnalysisEngine.getRiskLevel(v2Score);
      const sr = activeComparison.structuralRisk;
      const deltaStr = sr.delta >= 0 ? `+${sr.delta.toFixed(1)}` : sr.delta.toFixed(1);

      return `**Architecture Risk Scores**:
- **V1 Risk Score**: ${v1Score.toFixed(1)}/100 [${v1Level}]
- **V2 Risk Score**: ${v2Score.toFixed(1)}/100 [${v2Level}]
- **Directional Delta (${compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2'})**: ${deltaStr} pts (${sr.shiftDirection})`;
    }

    const analysis = Objective2AnalysisEngine.analyzeArchitecture(model);
    const score = Objective2AnalysisEngine.calculateDeterministicRiskScore(analysis);
    const level = Objective2AnalysisEngine.getRiskLevel(score);
    return `Structural Risk Score: ${score.toFixed(1)}/100 [${level}].`;
  }

  // 7. INTENT: added_components
  if (intent === 'added_components') {
    if (comparisonResult && activeComparison) {
      const added = activeComparison.architectureDiff.addedNodes;
      const dirLabel = compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2';
      if (added.length === 0) return `No components were added in the ${dirLabel} direction.`;
      return `**Added Components (${dirLabel}, ${added.length} total)**:\n${added.map((c, idx) => `${idx + 1}. ${c.name} [${c.type}${c.technology ? `, ${c.technology}` : ''}]`).join('\n')}`;
    }
    return 'Component additions are tracked by comparing two architecture versions in the Compare tab.';
  }

  // 8. INTENT: removed_components
  if (intent === 'removed_components') {
    if (comparisonResult && activeComparison) {
      const removed = activeComparison.architectureDiff.removedNodes;
      const dirLabel = compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2';
      if (removed.length === 0) return `No components were removed in the ${dirLabel} direction.`;
      let msg = `**Removed Components (${dirLabel}, ${removed.length} total)**:\n${removed.map((c, idx) => `${idx + 1}. ${c.name} [${c.type}${c.technology ? `, ${c.technology}` : ''}]`).join('\n')}`;
      if (activeComparison.structuralRisk.brokenDependencies && activeComparison.structuralRisk.brokenDependencies.length > 0) {
        msg += `\n\n**Broken Dependencies Detected**:`;
        activeComparison.structuralRisk.brokenDependencies.forEach((b) => {
          msg += `\n- Component ${b.removedTargetName} was removed, but ${b.callerName} still depends on it. This creates a broken required dependency (+15.0 risk penalty).`;
        });
      }
      return msg;
    }
    return 'Component removals are tracked by comparing two architecture versions in the Compare tab.';
  }

  // 9. INTENT: modified_components
  if (intent === 'modified_components') {
    if (comparisonResult && activeComparison) {
      const modified = activeComparison.architectureDiff.modifiedNodes;
      const dirLabel = compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2';
      if (modified.length === 0) return `No components were modified in the ${dirLabel} direction.`;
      return `**Modified Components (${dirLabel}, ${modified.length} total)**:\n${modified.map((c, idx) => `${idx + 1}. ${c.name} [${c.type}]`).join('\n')}`;
    }
    return 'Component modifications are tracked by comparing two architecture versions in the Compare tab.';
  }

  // 10. INTENT: changed_components
  if (intent === 'changed_components') {
    if (comparisonResult && activeComparison) {
      const diff = activeComparison.architectureDiff;
      const dirLabel = compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2';
      return `**Changed Components (${dirLabel})**:
- **Added (${diff.addedNodes.length})**: ${diff.addedNodes.map((c) => c.name).join(', ') || 'None'}
- **Removed (${diff.removedNodes.length})**: ${diff.removedNodes.map((c) => c.name).join(', ') || 'None'}
- **Modified (${diff.modifiedNodes.length})**: ${diff.modifiedNodes.map((c) => c.name).join(', ') || 'None'}`;
    }
    return 'Changed components are identified when comparing two architecture versions or running a change simulation.';
  }

  // 11. INTENT: comparison_summary
  if (intent === 'comparison_summary') {
    if (comparisonResult && activeComparison) {
      const dirLabel = compareDirection === 'v2_to_v1' ? 'V2 → V1' : 'V1 → V2';
      const arch = activeComparison.architectureDiff;
      const repo = activeComparison.repositoryDiff?.summary;
      const sr = activeComparison.structuralRisk;
      const deltaStr = sr.delta >= 0 ? `+${sr.delta.toFixed(1)}` : sr.delta.toFixed(1);

      let summary = `**Architecture Comparison Summary (${dirLabel})**:
- **Component Changes**: +${arch.addedNodes.length} added, -${arch.removedNodes.length} removed, ${arch.modifiedNodes.length} modified.
- **Dependency Links**: +${arch.addedRelationships.length} added, -${arch.removedRelationships.length} removed.`;

      if (repo) {
        summary += `\n- **Repository Files**: +${repo.addedFilesCount} added, -${repo.removedFilesCount} removed, ${repo.modifiedFilesCount} modified, ${repo.unchangedFilesCount} unchanged.`;
      }

      summary += `\n- **Risk Shift**: ${sr.originalScore.toFixed(1)} [${sr.originalRiskLevel || 'LOW'}] → ${sr.changedScore.toFixed(1)} [${sr.changedRiskLevel || 'LOW'}] (${deltaStr} pts, ${sr.shiftDirection}).`;

      if (sr.brokenDependencies && sr.brokenDependencies.length > 0) {
        summary += `\n- **Warning**: ${sr.brokenDependencies.length} broken required dependency detected!`;
      }
      return summary;
    }
    return `Comparison summary requires two versions to compare. Please navigate to the Compare tab to upload and compare two versions.`;
  }

  // 12. INTENT: repository_file_count
  if (intent === 'repository_file_count') {
    if (comparisonResult) {
      const askedV1 = /\bv1\b/i.test(question);
      const askedV2 = /\bv2\b/i.test(question);
      if (askedV1) {
        return `V1 repository contains ${comparisonResult.originalModel.inventory?.total_files ?? 0} files across ${comparisonResult.originalModel.inventory?.total_folders ?? 0} folders.`;
      }
      if (askedV2) {
        return `V2 repository contains ${comparisonResult.changedModel.inventory?.total_files ?? 0} files across ${comparisonResult.changedModel.inventory?.total_folders ?? 0} folders.`;
      }
      const s = comparisonResult.repositoryDiff?.summary;
      return `**Repository File Counts**:
- **V1 Total Files**: ${comparisonResult.originalModel.inventory?.total_files ?? 0}
- **V2 Total Files**: ${comparisonResult.changedModel.inventory?.total_files ?? 0}
- **Repository Diff**: ${s?.addedFilesCount ?? 0} added, ${s?.removedFilesCount ?? 0} removed, ${s?.modifiedFilesCount ?? 0} modified, ${s?.unchangedFilesCount ?? 0} unchanged.`;
    }
    const totalFiles = model.inventory?.total_files ?? 0;
    const totalFolders = model.inventory?.total_folders ?? 0;
    return `The repository contains ${totalFiles} file${totalFiles === 1 ? '' : 's'} across ${totalFolders} folder${totalFolders === 1 ? '' : 's'}.`;
  }

  // 13. INTENT: repository_file_list
  if (intent === 'repository_file_list') {
    const files = model.inventory?.files || [];
    if (files.length === 0) {
      return 'No repository files are currently indexed in inventory.';
    }
    const preview = files.slice(0, 15).map((f, idx) => `${idx + 1}. \`${f.path}\` (${f.size_bytes ?? (f as any).size ?? 0} bytes)`).join('\n');
    return `**Repository Files (${files.length} total)**:\n${preview}${files.length > 15 ? `\n... and ${files.length - 15} more files` : ''}`;
  }

  // 14. INTENT: file_summary
  if (intent === 'file_summary') {
    const fileMatch = lower.match(/(?:explain\s+file|what\s+does\s+file\s+|summarize\s+file|file\s+summary|details\s+of\s+file)\s+([a-zA-Z0-9_\-\.\/]+)(?:\?|$)/i) ||
      lower.match(/\b(?:explain|summarize|details\s+of)\s+([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)\b/i);
    const fileQuery = fileMatch ? fileMatch[1].trim() : (selectedFile?.path || '');

    // Disambiguation if both V1 and V2 are present
    if (comparisonResult && comparisonResult.originalModel && comparisonResult.changedModel) {
      const askedV1 = /\bv1\b/i.test(question);
      const askedV2 = /\bv2\b/i.test(question);
      if (!askedV1 && !askedV2) {
        return 'Do you mean the V1 file or the V2 file?';
      }
      const targetModel = askedV1 ? comparisonResult.originalModel : comparisonResult.changedModel;
      const f = targetModel.inventory?.files.find((x) =>
        x.path.toLowerCase().endsWith(fileQuery.toLowerCase()) ||
        x.name.toLowerCase() === fileQuery.toLowerCase()
      );
      if (!f) return `File "${fileQuery}" was not found in ${askedV1 ? 'V1' : 'V2'} repository.`;
      return `**${askedV1 ? 'V1' : 'V2'} File Details: ${f.name}**\n- **Path**: \`${f.path}\`\n- **Size**: ${f.size_bytes ?? (f as any).size ?? 0} bytes\n- **Extension**: ${f.extension || 'none'}\n- **Role**: Discovered in repository file inventory.`;
    }

    const f = model.inventory?.files.find((x) =>
      x.path.toLowerCase().endsWith(fileQuery.toLowerCase()) ||
      x.name.toLowerCase() === fileQuery.toLowerCase()
    );
    if (f) {
      return `**File Details: ${f.name}**\n- **Path**: \`${f.path}\`\n- **Size**: ${f.size_bytes ?? (f as any).size ?? 0} bytes\n- **Extension**: ${f.extension || 'none'}\n- **Role**: Discovered in repository file inventory.`;
    }
    return `File "${fileQuery}" was not found in the current repository inventory.`;
  }

  // 15. INTENT: entity_count
  if (intent === 'entity_count') {
    // Check if specifically asking about V1 or V2
    if (comparisonResult) {
      if (/\bv1\b/i.test(question)) {
        return `${comparisonResult.originalModel.entities.length} entities in V1.\n\nThey are:\n${comparisonResult.originalModel.entities.map((e, idx) => `${idx + 1}. ${e.name} [${e.type}]`).join('\n')}`;
      }
      if (/\bv2\b/i.test(question)) {
        return `${comparisonResult.changedModel.entities.length} entities in V2.\n\nThey are:\n${comparisonResult.changedModel.entities.map((e, idx) => `${idx + 1}. ${e.name} [${e.type}]`).join('\n')}`;
      }
    }

    if (lower.includes('service')) {
      const services = model.entities.filter((e) => e.type.toLowerCase() === 'service' || e.type.toLowerCase() === 'controller');
      return `${services.length} services.\n\nThey are:\n${services.map((s, idx) => `${idx + 1}. ${s.name}`).join('\n') || 'None detected.'}`;
    }
    if (lower.includes('database')) {
      const dbs = model.entities.filter((e) => e.type.toLowerCase() === 'database');
      return `${dbs.length} database${dbs.length === 1 ? '' : 's'}.\n\nThey are:\n${dbs.map((d, idx) => `${idx + 1}. ${d.name}`).join('\n') || 'None detected.'}`;
    }
    if (lower.includes('api')) {
      const apis = model.entities.filter((e) => e.type.toLowerCase() === 'api');
      return `${apis.length} API${apis.length === 1 ? '' : 's'}:\n${apis.map((a, idx) => `${idx + 1}. ${a.name}`).join('\n') || 'None detected.'}`;
    }

    return `${model.entities.length} entities.\n\nThey are:\n${model.entities.map((e, idx) => `${idx + 1}. ${e.name} [${e.type}]`).join('\n')}`;
  }

  // 16. INTENT: entity_list
  if (intent === 'entity_list') {
    if (lower.includes('service')) {
      const services = model.entities.filter((e) => e.type.toLowerCase() === 'service' || e.type.toLowerCase() === 'controller');
      return `${services.length} services:\n${services.map((s, idx) => `${idx + 1}. ${s.name}`).join('\n') || 'None detected.'}`;
    }
    if (lower.includes('database')) {
      const dbs = model.entities.filter((e) => e.type.toLowerCase() === 'database');
      return `${dbs.length} database${dbs.length === 1 ? '' : 's'}:\n${dbs.map((d, idx) => `${idx + 1}. ${d.name}`).join('\n') || 'None detected.'}`;
    }
    if (lower.includes('api')) {
      const apis = model.entities.filter((e) => e.type.toLowerCase() === 'api');
      return `${apis.length} API${apis.length === 1 ? '' : 's'}:\n${apis.map((a, idx) => `${idx + 1}. ${a.name}`).join('\n') || 'None detected.'}`;
    }

    return `${model.entities.length} components:\n${model.entities.map((e, idx) => `${idx + 1}. ${e.name} [${e.type}${e.technology ? `, ${e.technology}` : ''}]`).join('\n')}`;
  }

  // 17. INTENT: dependency_query
  if (intent === 'dependency_query') {
    // Inbound: "What depends on [Component]?" / "Who calls [Component]?"
    const dependsOnTargetMatch = lower.match(/(?:what\s+depends\s+on|who\s+calls|what\s+calls)\s+([a-zA-Z0-9_\-\s]+?)(?:\?|$)/i);
    if (dependsOnTargetMatch || (lower.includes('what depends on') && selectedEntity)) {
      const compName = dependsOnTargetMatch ? dependsOnTargetMatch[1].trim() : (selectedEntity?.name || '');
      const targetComp = model.entities.find((e) =>
        e.name.toLowerCase() === compName.toLowerCase() ||
        e.id.toLowerCase() === compName.toLowerCase() ||
        compName.toLowerCase().includes(e.name.toLowerCase()) ||
        e.name.toLowerCase().includes(compName.toLowerCase())
      ) || selectedEntity;

      if (targetComp) {
        const callers = model.relationships.filter(
          (r) => r.target === targetComp.id || r.target === targetComp.name
        );
        return `${callers.length} component${callers.length === 1 ? '' : 's'} depend on ${targetComp.name}:\n${callers.map((c, idx) => {
          const src = model.entities.find((e) => e.id === c.source || e.name === c.source);
          return `${idx + 1}. ${src?.name || c.source} (via ${c.protocol || c.type})`;
        }).join('\n') || 'None. No other components depend on this component.'}`;
      }
    }

    // Outbound: "What does [Component] depend on?"
    const whatDoesDependOnMatch = lower.match(/what\s+does\s+([a-zA-Z0-9_\-\s]+?)\s+depend\s+on(?:\?|$)/i);
    if (whatDoesDependOnMatch || (lower.includes('depend on') && !lower.includes('what depends on') && selectedEntity)) {
      const compName = whatDoesDependOnMatch ? whatDoesDependOnMatch[1].trim() : (selectedEntity?.name || '');
      const sourceComp = model.entities.find((e) =>
        e.name.toLowerCase() === compName.toLowerCase() ||
        e.id.toLowerCase() === compName.toLowerCase() ||
        compName.toLowerCase().includes(e.name.toLowerCase()) ||
        e.name.toLowerCase().includes(compName.toLowerCase())
      ) || selectedEntity;

      if (sourceComp) {
        const callees = model.relationships.filter(
          (r) => r.source === sourceComp.id || r.source === sourceComp.name
        );
        return `${sourceComp.name} depends on ${callees.length} component${callees.length === 1 ? '' : 's'}:\n${callees.map((c, idx) => {
          const tgt = model.entities.find((e) => e.id === c.target || e.name === c.target);
          return `${idx + 1}. ${tgt?.name || c.target} (via ${c.protocol || c.type})`;
        }).join('\n') || 'None. This component has no outgoing dependencies.'}`;
      }
    }
  }

  // 18. INTENT: impact_analysis
  if (intent === 'impact_analysis') {
    const entityMatch = model.entities.find((e) => lower.includes(e.name.toLowerCase()) || lower.includes(e.id.toLowerCase())) || selectedEntity;
    if (entityMatch) {
      const sim = ChangeSimulatorEngine.simulateChange(model, [
        { id: `sim-${Date.now()}`, action: 'remove_component', component_id: entityMatch.id }
      ]);
      const direct = sim.directly_affected_nodes.length;
      const indirect = sim.indirectly_affected_nodes.length;
      const total = direct + indirect;
      const blastPct = model.entities.length > 0 ? ((total / model.entities.length) * 100).toFixed(0) : '0';

      return `**Impact Analysis for ${entityMatch.name}**:
- **Blast Radius**: ${total} of ${model.entities.length} components (${blastPct}% of system)
- **Direct Dependents (Depth 1)**: ${direct} components (${sim.directly_affected_nodes.map((n) => n.name).join(', ') || 'None'})
- **Downstream Ripple (Depth 2+)**: ${indirect} components (${sim.indirectly_affected_nodes.map((n) => n.name).join(', ') || 'None'})
- **Cascade Severity**: ${total > 5 ? 'High' : total > 2 ? 'Moderate' : 'Low'}`;
    }

    return `**Impact Analysis & Blast Radius**:
- **Blast Radius**: Measures the total proportion of services and components in the system affected if a target component changes or goes down.
- **Direct vs Transitive**:
  - **Direct Dependencies (Depth 1)**: Immediate callers and callees connected directly to the component.
  - **Ripple Chain (Depth 2+)**: Cascading indirect dependencies that feel downstream or upstream effects across multiple hops.
- **Cascade Severity**: Categorized as Minimal, Moderate, High, or Critical based on ripple depth and total impacted node count.`;
  }

  // 19. INTENT: evidence_lookup
  if (intent === 'evidence_lookup') {
    const entityMatch = model.entities.find((e) => lower.includes(e.name.toLowerCase()) || lower.includes(e.id.toLowerCase()));
    let rel: ArchitectureRelationship | undefined;
    if (entityMatch) {
      rel = model.relationships.find((r) =>
        (r.source === entityMatch.id || r.target === entityMatch.id || r.source === entityMatch.name || r.target === entityMatch.name) &&
        r.sourceEvidence?.snippet
      );
    }
    if (!rel) {
      rel = selectedRelationship ||
        model.relationships.find(
          (r) => r.sourceEvidence?.file && r.sourceEvidence.snippet && !r.sourceEvidence.snippet.startsWith('No source-code block')
        ) ||
        model.relationships[0];
    }

    if (rel && rel.sourceEvidence) {
      return `TraceIQ detected this dependency from:\n\nFile: ${rel.sourceEvidence.file}\nLines: ${rel.sourceEvidence.lineRange || rel.sourceEvidence.line || 'N/A'}\nMethod: ${rel.sourceEvidence.method || 'Source Code Extractor'}\nConfidence: ${rel.sourceEvidence.confidence || 'HIGH'}\n\nEvidence:\n${rel.sourceEvidence.snippet}`;
    }
    return `TraceIQ detected dependencies from AST parsing, import statements, configuration manifests, and framework decorators across the repository.`;
  }

  // 20. INTENT: architecture_summary
  if (intent === 'architecture_summary') {
    // Flow check
    if (lower.includes('flow') || lower.includes('how does the architecture work') || lower.includes('how does architecture work')) {
      const apps = model.entities.filter((e) => e.type.toLowerCase() === 'application');
      const coreServices = model.entities.filter((e) => e.type.toLowerCase() === 'service' || e.type.toLowerCase() === 'controller');
      const dataStores = model.entities.filter((e) => e.type.toLowerCase() === 'database');
      const externals = model.entities.filter((e) => e.type.toLowerCase().includes('external'));

      let flow = `Architecture Flow for ${model.systemName}:\n\n`;
      if (apps.length > 0) {
        flow += `1. User Entry Points:\n${apps.map((a) => `   - ${a.name} (${a.technology})`).join('\n')}\n`;
      }
      if (coreServices.length > 0) {
        flow += `2. Core Services:\n${coreServices.slice(0, 6).map((s) => `   - ${s.name} (${s.technology})`).join('\n')}${coreServices.length > 6 ? `\n   - ... and ${coreServices.length - 6} more services` : ''}\n`;
      }
      if (dataStores.length > 0) {
        flow += `3. Data Storage:\n${dataStores.map((d) => `   - ${d.name} (${d.technology})`).join('\n')}\n`;
      }
      if (externals.length > 0) {
        flow += `4. External Integrations:\n${externals.map((x) => `   - ${x.name} (${x.technology})`).join('\n')}\n`;
      }
      flow += `\nTraceIQ maps ${model.relationships.length} active dependency edges connecting these components.`;
      return flow;
    }

    const sCount = model.entities.filter((e) => e.type.toLowerCase() === 'service').length;
    const dCount = model.entities.filter((e) => e.type.toLowerCase() === 'database').length;
    const aCount = model.entities.filter((e) => e.type.toLowerCase() === 'api').length;
    const xCount = model.entities.filter((e) => e.type.toLowerCase().includes('external')).length;

    return `**System Overview**: \`${model.systemName}\` (v${model.version || '1.0.0'})
- **Total Components**: ${model.entities.length}
- **Services**: ${sCount}
- **Databases/Stores**: ${dCount}
- **APIs**: ${aCount}
- **External Systems**: ${xCount}
- **Relationships / Calls**: ${model.relationships.length}
- **Ingestion Mode**: ${model.inputType === 'codebase' ? 'Raw Codebase / ZIP' : 'Architecture Blueprint JSON'}`;
  }

  // 21. INTENT: unsupported (Polite redirect)
  if (intent === 'unsupported') {
    return "I'm here to help you understand TraceIQ's architecture, dependencies, evidence, risks, impact analysis, comparisons, and change simulation. Ask me about one of those.";
  }

  return `I analyzed your query against the current architecture model:
- **System**: \`${model.systemName}\`
- **Active Components**: ${model.entities.length} nodes registered.
- **Active Dependencies**: ${model.relationships.length} directional edges.
- You can ask me specific questions about services, databases, blast radius, risk shifts, or change simulations.`;
};
