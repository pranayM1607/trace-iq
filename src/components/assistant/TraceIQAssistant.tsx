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

    let defaultChips = ['Summarize Architecture', 'Identify High-Risk Components', 'Explain Repository Retention'];
    if (currentRoute === 'compare') {
      defaultChips = ['Explain Comparison Differences', 'Review Added & Removed Files', 'What are Broken Dependencies?'];
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

    const answer = computeAssistantAnswer(question, model, currentRoute, selectedEntity);

    const assistantMsg: AssistantMessage = {
      id: `asst-${Date.now()}`,
      sender: 'assistant',
      text: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chips: ['Summarize Architecture', 'Identify High-Risk Components', 'What are Broken Dependencies?'],
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
  // Normalize multiplication and division symbols
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
  selectedEntity: ArchitectureEntity | null = null
): string => {
  const general = tryComputeGeneralAnswer(question);
  if (general) return general;

  const lower = question.toLowerCase();

  if (lower.includes('broken dependenc') || lower.includes('unresolved') || lower.includes('broken required')) {
    return `**Broken Required Dependency Risk**:
- **Definition**: When a component or database is removed or modified while upstream caller services still depend on it, TraceIQ flags a **Broken Required Dependency**.
- **Risk Impact**: Instead of treating removal as a reduction in coupling, TraceIQ applies a **+15.0 points risk penalty** per affected caller in the Causal Risk Ledger.
- **Why it matters**: Calling a non-existent or decommissioned service causes immediate runtime connection failures and cascade outages unless the callers are updated first.`;
  } else if (lower.includes('blast radius') || lower.includes('ripple') || lower.includes('impact') || currentRoute === 'impact') {
    return `**Impact Analysis & Blast Radius**:
- **Blast Radius**: Measures the total proportion of services and components in the system affected if a target component changes or goes down.
- **Direct vs Transitive**:
  - **Direct Dependencies (Depth 1)**: Immediate callers and callees connected directly to the component.
  - **Ripple Chain (Depth 2+)**: Cascading indirect dependencies that feel downstream or upstream effects across multiple hops.
- **Cascade Severity**: Categorized as Minimal, Moderate, High, or Critical based on ripple depth and total impacted node count.`;
  } else if (lower.includes('spof') || lower.includes('single point') || lower.includes('failure')) {
    const callCounts: Record<string, number> = {};
    model.relationships.forEach((r) => {
      callCounts[r.target] = (callCounts[r.target] || 0) + 1;
    });
    const topCoupled = Object.entries(callCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return `**Single Points of Failure (SPOF)**:
- **Definition**: Central components that many services rely on without any alternative or redundant fallback path. If this component fails, all dependent services fail with it.
- **Current Top Hubs in System**:
${topCoupled.map(([target, count]) => {
  const e = model.entities.find((x) => x.id === target || x.name === target);
  return `  - **${e?.name || target}**: ${count} incoming dependency callers`;
}).join('\n') || '  - None identified.'}`;
  } else if (lower.includes('circular') || lower.includes('cycle') || lower.includes('loop')) {
    return `**Circular Dependency Loops**:
- **Definition**: Occurs when Service A calls Service B, which directly or indirectly calls Service A back (e.g. A → B → C → A).
- **Risk**: Tight circular coupling complicates deployment sequencing, prevents graceful shutdown, and can amplify recursive cascade failures under load.
- You can inspect active loops in the **Structural Risk** tab.`;
  } else if (lower.includes('causal') || lower.includes('ledger')) {
    return `**Causal Risk Ledger**:
- **Deterministic Breakdown**: Every change in risk (Δ) is itemized with exact point values and reasons.
- **Examples of Ledger Items**:
  - \`Broken Required Dependency Detected\`: **+15.0 pts** (per broken caller)
  - \`New Dependency Added\`: **+2.5 pts**
  - \`Safe Decoupling\`: **-3.5 pts** (only when no callers remain orphaned)
  - \`Cycle Created\`: **+20.0 pts**
- Transparent math ensures engineers understand exactly *why* risk increased or decreased.`;
  } else if (lower.includes('summarize') || lower.includes('overview') || lower.includes('architecture')) {
    const services = model.entities.filter((e) => e.type.toLowerCase() === 'service').length;
    const dbs = model.entities.filter((e) => e.type.toLowerCase() === 'database').length;
    const apis = model.entities.filter((e) => e.type.toLowerCase() === 'api').length;
    const external = model.entities.filter((e) => e.type.toLowerCase().includes('external')).length;

    return `**System Overview**: \`${model.systemName}\` (v${model.version})
- **Total Components**: ${model.entities.length}
- **Services**: ${services}
- **Databases/Stores**: ${dbs}
- **APIs**: ${apis}
- **External Systems**: ${external}
- **Relationships / Calls**: ${model.relationships.length}
- **Ingestion Mode**: ${model.inputType === 'codebase' ? 'Raw Codebase / ZIP' : 'Architecture Blueprint JSON'}`;
  } else if (lower.includes('risk') || lower.includes('security') || lower.includes('coupling')) {
    const callCounts: Record<string, number> = {};
    model.relationships.forEach((r) => {
      callCounts[r.target] = (callCounts[r.target] || 0) + 1;
    });
    const topCoupled = Object.entries(callCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return `**Architectural Risk Analysis**:
1. **Critical High-Dependency Hubs**:
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
    return `**100% Repository Retention Verification**:
- **Discovered Files**: ${totalFiles}
- **Discovered Directories**: ${totalFolders}
- **Guarantee**: Every single uploaded file (including configs, scripts, documentation, binary files) is preserved in the Repository Inventory catalog without loss or filtering.`;
  } else if (lower.includes('provenance') || lower.includes('evidence') || lower.includes('citation')) {
    return `**Source Evidence & Provenance**:
- **Ground Truth**: Reconstructed entities and relationships are linked to physical source code citations (file paths, line numbers, and extracted code snippets).
- **Zero Hallucination**: No component or link is invented without verifiable evidence in the codebase.
- Navigate to **Source Evidence** in the sidebar to review full audit trails.`;
  } else if (lower.includes('service') && (lower.includes('list') || lower.includes('what') || lower.includes('show'))) {
    const serviceNames = model.entities.filter((e) => e.type.toLowerCase() === 'service' || e.type.toLowerCase() === 'controller').map((e) => e.name);
    return `**Services in ${model.systemName} (${serviceNames.length})**:\n${serviceNames.map((s) => `- ${s}`).join('\n') || 'None detected.'}`;
  } else if (lower.includes('database') && (lower.includes('list') || lower.includes('what') || lower.includes('show'))) {
    const dbNames = model.entities.filter((e) => e.type.toLowerCase() === 'database').map((e) => e.name);
    return `**Databases in ${model.systemName} (${dbNames.length})**:\n${dbNames.map((d) => `- ${d}`).join('\n') || 'None detected.'}`;
  } else if (selectedEntity && (lower.includes(selectedEntity.name.toLowerCase()) || lower.includes('analyze') || lower.includes('component'))) {
    const incoming = model.relationships.filter((r) => r.target === selectedEntity.id || r.target === selectedEntity.name);
    const outgoing = model.relationships.filter((r) => r.source === selectedEntity.id || r.source === selectedEntity.name);

    return `**Component Profile: ${selectedEntity.name}**:
- **Type**: ${selectedEntity.type}
- **Technology**: ${selectedEntity.technology}
- **Source File**: \`${selectedEntity.metadata?.filePath || 'Reconstructed'}\`
- **Inbound Calls (${incoming.length})**: ${incoming.map((r) => r.source).join(', ') || 'None'}
- **Outbound Calls (${outgoing.length})**: ${outgoing.map((r) => r.target).join(', ') || 'None'}`;
  } else if (lower.includes('compare') || lower.includes('difference') || lower.includes('version')) {
    return `**Direct Version Comparison**:
- **Inventory Diff**: Compares uploaded V1 and V2 models file-by-file (Added, Removed, Modified, Unchanged) with 100% file retention.
- **Architectural Diff**: Highlights new components, removed components, and changed dependency links.
- Upload any two ZIP codebases or JSON blueprints in the Compare view to run side-by-side verification.`;
  } else if (lower.includes('simulat') || lower.includes('what if') || lower.includes('change') || currentRoute === 'simulator') {
    return `**Hypothetical Change Simulator (Objective 3)**:
- **Sandbox Isolation**: Proposed component or dependency additions/removals run strictly in an in-memory deep copy with zero mutation to active files.
- **Propagation Tracing**: Traces direct impacts and cascading ripples through upstream callers.
- **Broken Dependency Detection**: Removing a component that has callers adds **+15.0 pts** risk per caller.
- **Causal Risk Ledger**: Itemizes points attribution (Δ) derived deterministically from graph metrics.`;
  } else {
    // Check if user is asking about a specific named component
    const matchedEntity = model.entities.find((e) => lower.includes(e.name.toLowerCase()) || lower.includes(e.id.toLowerCase()));
    if (matchedEntity) {
      const incoming = model.relationships.filter((r) => r.target === matchedEntity.id || r.target === matchedEntity.name);
      const outgoing = model.relationships.filter((r) => r.source === matchedEntity.id || r.source === matchedEntity.name);
      return `**Component Details: ${matchedEntity.name}**:
- **Type**: ${matchedEntity.type}
- **Technology**: ${matchedEntity.technology}
- **File**: \`${matchedEntity.metadata?.filePath || 'Reconstructed'}\`
- **Callers (${incoming.length})**: ${incoming.map((r) => r.source).join(', ') || 'None'}
- **Dependencies (${outgoing.length})**: ${outgoing.map((r) => r.target).join(', ') || 'None'}`;
    } else {
      const domainPatterns = [
        /\btraceiq/i, /\barchitect/i, /\bcomponent/i, /\bservice/i, /\bapis?\b/i, /\bendpoint/i,
        /\bdatabase/i, /\bdb\b/i, /\bstor(e|age)/i, /\brisk/i, /\bdepend/i, /\bcaller/i,
        /\bblast\s*radius/i, /\bripple/i, /\bspof\b/i, /\bsingle\s+point/i, /\bcycl(e|ic)/i,
        /\bloop/i, /\bcircular/i, /\bledger/i, /\bcausal/i, /\binventory/i, /\bfiles?\b/i,
        /\bfolders?\b/i, /\bretention/i, /\bevidence/i, /\bprovenance/i, /\bcitation/i,
        /\bcompare/i, /\bdiff\b/i, /\bsimulat/i, /\bchange/i, /\bmodels?\b/i, /\bsystems?\b/i,
        /\bnodes?\b/i, /\bedges?\b/i, /\bversions?\b/i, /\bspring\b/i, /\bflask\b/i,
        /\bdocker\b/i, /\bkafka\b/i, /\bgrpc\b/i, /\bmysql\b/i, /\bpostgres\b/i,
        /\bredis\b/i, /\bblast\b/i, /\bpropagation/i, /\bimpact/i, /\bpackages?\b/i, /\bmanifest/i,
      ];
      const isDomainQuestion = domainPatterns.some((pattern) => pattern.test(lower));

      if (!isDomainQuestion) {
        return "I'm here to help you understand and use TraceIQ. You can ask me about the architecture, dependencies, risks, changes, evidence, or other TraceIQ functions.";
      }

      return `I analyzed your query against the current architecture model:
- **System**: \`${model.systemName}\`
- **Active Components**: ${model.entities.length} nodes registered.
- **Active Dependencies**: ${model.relationships.length} directional edges.
- You can ask me specific questions about services, databases, blast radius, risk shifts, or change simulations.`;
    }
  }
};
