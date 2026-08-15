import { useState, useRef, useEffect, useCallback, Fragment } from "react";
// @ts-ignore Scratch Studio is a Vite-compatible JavaScript workspace component.
import ScratchStudio from "../components/ScratchStudio.jsx";
import "../styles.css";
import {
  Plus, Send, Settings, Trash2, MessageSquare, ChevronDown, X, Loader2,
  Copy, Check, RotateCcw, Square, Cpu, AlertCircle, PanelLeftClose,
  PanelLeft, Brain, BookOpen, Layers, FolderOpen, Zap, Search,
  ChevronRight, Smile, RefreshCw, Play, Eye, Lightbulb, Target,
  Sparkles, Globe, Code, FileText, ArrowRight, Database,
  Save, HardDrive, FolderPlus, FilePlus, ChevronsUpDown,
} from "lucide-react";

// ─── Config ──────────────────────────────────────────────────────────────────
const BACKEND = "http://localhost:3000";
const FALLBACK_LM = "http://localhost:1234";

// ─── Types ───────────────────────────────────────────────────────────────────
type Role = "user" | "assistant";
interface Message { id: string; role: Role; content: string; thinking?: string; timestamp: Date; }
interface Conversation { id: string; title: string; messages: Message[]; model: string; provider: string; createdAt: Date; }
interface Model { id: string; provider: string; name: string; }
interface Emotion { name: string; emoji: string; color: string; description: string; constraintLevel?: number; }
type Tab = "chat" | "agents" | "memory" | "skills" | "scratch" | "settings";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 11);
const titleFrom = (s: string) => s.slice(0, 48).replace(/\s+/g, " ").trim() || "Nova conversa";
const stripManifest = (s: string) => String(s || "").replace(/<vessie-project>[\s\S]*?<\/vessie-project>/gi, "").replace(/\n{3,}/g, "\n\n").trim();

// ─── Markdown ─────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [cp, setCp] = useState(false);
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/10">
        <span className="text-xs text-muted-foreground font-mono">{lang || "code"}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCp(true); setTimeout(() => setCp(false), 2000); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {cp ? <Check size={11} /> : <Copy size={11} />}{cp ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed"><code className="font-mono text-[#e2e8f0] whitespace-pre">{code}</code></pre>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const segs: JSX.Element[] = [];
  const re = /```([^\n]*)\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push(<InlineMd key={k++} t={text.slice(last, m.index)} />);
    segs.push(<CodeBlock key={k++} lang={m[1].trim()} code={m[2]} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push(<InlineMd key={k++} t={text.slice(last)} />);
  return <div className="leading-7 text-sm">{segs}</div>;
}

function InlineMd({ t }: { t: string }) {
  const els: JSX.Element[] = [];
  let k = 0;
  t.split("\n").forEach((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      const lvl = (line.match(/^(#+)/)?.[1].length ?? 1);
      const cls = lvl === 1 ? "text-base font-semibold mt-3 mb-1" : "text-sm font-semibold mt-2 mb-0.5";
      els.push(<p key={k++} className={cls}>{ri(line.replace(/^#+\s/, ""))}</p>);
    } else if (/^[-*]\s/.test(line)) {
      els.push(<li key={k++} className="ml-4 list-disc">{ri(line.replace(/^[-*]\s/, ""))}</li>);
    } else if (line.trim() === "") {
      els.push(<div key={k++} className="h-2" />);
    } else {
      els.push(<p key={k++}>{ri(line)}</p>);
    }
  });
  return <>{els}</>;
}

function ri(t: string): JSX.Element {
  const parts: JSX.Element[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) parts.push(<Fragment key={k++}>{t.slice(last, m.index)}</Fragment>);
    if (m[2]) parts.push(<strong key={k++} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={k++}>{m[3]}</em>);
    else if (m[4]) parts.push(<code key={k++} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[0.8em] text-emerald-300">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < t.length) parts.push(<Fragment key={k++}>{t.slice(last)}</Fragment>);
  return <>{parts}</>;
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("local-model");
  const [selectedProvider, setSelectedProvider] = useState<string>("lmstudio");
  const [backendOnline, setBackendOnline] = useState(false);
  const [lmOnline, setLmOnline] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>({ name: "calma", emoji: "😌", color: "#10a37f", description: "serena e focada" });
  const [showModelDrop, setShowModelDrop] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [memory, setMemory] = useState("");
  const [skills, setSkills] = useState<any[]>([]);
  const [agentTask, setAgentTask] = useState("");
  const [agentSteps, setAgentSteps] = useState<any[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [config, setConfig] = useState<any>({});
  const [lmUrl, setLmUrl] = useState(FALLBACK_LM);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [projectStatus, setProjectStatus] = useState<any>({ path: "", name: "" });
  const [projectPathInput, setProjectPathInput] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { checkConnections(); }, []);

  useEffect(() => {
    document.addEventListener("mousedown", (e) => {
      if (modelDropRef.current && !modelDropRef.current.contains(e.target as Node)) setShowModelDrop(false);
    });
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeConv?.messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [input]);

  async function checkConnections() {
    // Backend
    try {
      const r = await fetch(`${BACKEND}/api/config`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        setBackendOnline(true);
        const cfg = await r.json();
        setConfig(cfg);
        setSelectedProvider(cfg.provider || "lmstudio");
        setSelectedModel(cfg.model || "local-model");
        fetchModels();
        fetchProjectStatus();
        fetchEmotion();
      }
    } catch {}

    // LM Studio direct fallback
    try {
      const r = await fetch(`${lmUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        setLmOnline(true);
        const data = await r.json();
        const lmModels = (data.data || []).map((m: any) => ({ id: m.id, provider: "lmstudio", name: m.id }));
        setModels(prev => [...lmModels, ...prev.filter(m => m.provider !== "lmstudio")]);
        if (lmModels.length > 0 && selectedModel === "local-model") setSelectedModel(lmModels[0].id);
      }
    } catch {}
  }

  async function fetchModels() {
    try {
      const r = await fetch(`${BACKEND}/api/models`);
      if (r.ok) { const d = await r.json(); setModels(d.models || []); }
    } catch {}
  }

  async function fetchProjectStatus() {
    try {
      const r = await fetch(`${BACKEND}/api/projects/status`);
      if (r.ok) { const d = await r.json(); setProjectStatus(d.selected || { path: "", name: "" }); }
    } catch {}
  }

  async function selectProjectInChat(path: string) {
    const p = (path || projectPathInput).trim();
    if (!p || !backendOnline) return;
    const r = await fetch(`${BACKEND}/api/projects/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: p }) });
    if (r.ok) {
      const d = await r.json();
      setProjectStatus(d.selected || { path: p, name: (p.split(/[\\/]/).pop() || p) });
      setProjectFiles(d.files || []);
      setProjectPathInput("");
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Não foi possível selecionar a pasta.");
    }
  }

  async function fetchEmotion() {
    try {
      const r = await fetch(`${BACKEND}/api/personality`);
      if (r.ok) { const d = await r.json(); if (d.current) setEmotion(d.current); }
    } catch {}
  }

  async function fetchMemory() {
    try {
      const r = await fetch(`${BACKEND}/api/memory`);
      if (r.ok) { const d = await r.json(); setMemory(d.content || ""); }
    } catch {}
  }

  async function fetchSkills() {
    try {
      const r = await fetch(`${BACKEND}/api/skills`);
      if (r.ok) { const d = await r.json(); setSkills(d.skills || []); }
    } catch {}
  }

  async function fetchProjects() {
    try {
      const r = await fetch(`${BACKEND}/api/projects`);
      if (r.ok) { const d = await r.json(); setProjects(d.projects || []); }
    } catch {}
  }

  useEffect(() => {
    if (tab === "memory") fetchMemory();
    if (tab === "skills") fetchSkills();
    if (tab === "projects") fetchProjects();
  }, [tab]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  function connectWS(): WebSocket {
    if (wsRef.current?.readyState === WebSocket.OPEN) return wsRef.current;
    const ws = new WebSocket(`ws://${BACKEND.replace(/^https?:\/\//, "")}`);
    wsRef.current = ws;
    return ws;
  }

  // ── Chat via WS ou fallback LM Studio ─────────────────────────────────────
  const sendMessage = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || streaming) return;

    let convId = activeId;
    let conv: Conversation;

    if (!convId) {
      conv = { id: uid(), title: titleFrom(text), messages: [], model: selectedModel, provider: selectedProvider, createdAt: new Date() };
      setConversations(prev => [conv, ...prev]);
      setActiveId(conv.id);
      convId = conv.id;
    } else {
      conv = conversations.find(c => c.id === convId)!;
      if (!conv) return;
    }

    const userMsg: Message = { id: uid(), role: "user", content: text, timestamp: new Date() };
    const asstId = uid();
    const asstMsg: Message = { id: asstId, role: "assistant", content: "", timestamp: new Date() };

    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: c.messages.length === 0 ? titleFrom(text) : c.title, messages: [...c.messages, userMsg, asstMsg] } : c));
    setInput("");
    setStreaming(true);
    setThinkingContent(null);

    const allMessages = [...conv.messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    if (backendOnline) {
      // Backend WebSocket
      try {
        const ws = connectWS();
        const patch = (content: string) => setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === asstId ? { ...m, content } : m) } : c));

        await new Promise<void>((resolve, reject) => {
          let accumulated = "";

          const handler = (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "think") { setThinkingContent(data.content); }
              else if (data.type === "chunk") { accumulated += data.content; patch(accumulated); }
              else if (data.type === "emotion") { setEmotion(data.emotion); }
              else if (data.type === "project_result") {
                setProjectFiles(prev => [...prev]);
                setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === asstId ? { ...m, content: stripManifest(m.content) + (m.content ? "\n" : "") + `\n\n✅ **${data.summary}**` } : m) } : c));
                fetchProjectStatus();
              }
              else if (data.type === "done") { ws.removeEventListener("message", handler); resolve(); }
              else if (data.type === "error") { reject(new Error(data.message)); }
            } catch {}
          };

          ws.addEventListener("message", handler);

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "chat", conversationId: convId, messages: allMessages, provider: selectedProvider, model: selectedModel }));
          } else {
            ws.addEventListener("open", () => {
              ws.send(JSON.stringify({ type: "chat", conversationId: convId, messages: allMessages, provider: selectedProvider, model: selectedModel }));
            }, { once: true });
          }
        });
      } catch (err: any) {
        fallbackLMStream(convId, asstId, allMessages);
        return;
      }
    } else {
      // Direct LM Studio fallback
      await fallbackLMStream(convId, asstId, allMessages);
    }

    setStreaming(false);
  }, [input, streaming, activeId, conversations, selectedModel, selectedProvider, backendOnline, lmUrl]);

  async function fallbackLMStream(convId: string, asstId: string, messages: any[]) {
    try {
      const res = await fetch(`${lmUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages, stream: true, temperature: 0.7, max_tokens: 2048 }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const dec = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const d = line.slice(6).trim();
          if (d === "[DONE]") break;
          try {
            const delta = JSON.parse(d).choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              const snap = acc;
              setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === asstId ? { ...m, content: snap } : m) } : c));
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === asstId ? { ...m, content: `⚠️ Erro: ${err.message}` } : m) } : c));
    } finally {
      setStreaming(false);
    }
  }

  // ── Agent Loop ────────────────────────────────────────────────────────────
  async function runAgent() {
    if (!agentTask.trim() || agentRunning) return;
    setAgentRunning(true);
    setAgentSteps([]);

    try {
      const ws = connectWS();

      await new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.type === "agent_step") {
            setAgentSteps(prev => [...prev, data]);
          } else if (data.type === "agent_done" || data.type === "agent_error") {
            ws.removeEventListener("message", handler);
            if (data.type === "agent_done") setAgentSteps(prev => [...prev, { type: "done", result: data.result }]);
            resolve();
          }
        };

        ws.addEventListener("message", handler);

        const send = () => ws.send(JSON.stringify({ type: "agent", task: agentTask, provider: selectedProvider, model: selectedModel }));
        if (ws.readyState === WebSocket.OPEN) send();
        else ws.addEventListener("open", send, { once: true });
      });
    } catch {}

    setAgentRunning(false);
  }

  // ─── Dublagem / Tradução de idiomas ─────────────────────────────────────
  // [dublagem de idiomas removida — substituída pelo seletor de projeto]

  // ─── Renders ─────────────────────────────────────────────────────────────

  const TABS: { id: Tab; icon: JSX.Element; label: string }[] = [
    { id: "chat", icon: <MessageSquare size={16} />, label: "Chat" },
    { id: "agents", icon: <Zap size={16} />, label: "Agentes" },
    { id: "memory", icon: <Brain size={16} />, label: "Memória" },
    { id: "skills", icon: <BookOpen size={16} />, label: "Skills" },
    { id: "scratch", icon: <Layers size={16} />, label: "Scratch Studio" },
    { id: "settings", icon: <Settings size={16} />, label: "Config" },
  ];

  const onlineStatus = backendOnline ? "backend" : lmOnline ? "lm-only" : "offline";

  return (
    <div className="dark flex h-screen w-full overflow-hidden bg-background text-foreground" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className={`flex flex-col shrink-0 bg-[#111111] border-r border-white/[0.06] transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-64" : "w-0"}`}>
        <div className="flex flex-col h-full w-64">

          {/* Logo */}
          <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#0d6b54] flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-none">Vessie AI</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${onlineStatus === "backend" ? "bg-[#10a37f]" : onlineStatus === "lm-only" ? "bg-yellow-500" : "bg-red-500"}`} />
                {onlineStatus === "backend" ? "Conectado" : onlineStatus === "lm-only" ? "LM Studio" : "Offline"}
              </div>
            </div>
          </div>

          {/* Emoção atual */}
          <div className="mx-3 mb-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center gap-2">
            <span className="text-lg">{emotion.emoji}</span>
            <div className="min-w-0">
              <div className="text-xs font-medium capitalize" style={{ color: emotion.color }}>{emotion.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{emotion.description}</div>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="px-2 space-y-0.5 mb-2">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${tab === t.id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>

          {/* Conversas (só no chat) */}
          {tab === "chat" && (
            <>
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Conversas</span>
                <button onClick={() => { const c = { id: uid(), title: "Nova conversa", messages: [], model: selectedModel, provider: selectedProvider, createdAt: new Date() }; setConversations(p => [c, ...p]); setActiveId(c.id); }} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                  <Plus size={13} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
                {conversations.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma conversa</div>
                ) : conversations.map(conv => (
                  <div key={conv.id} onClick={() => setActiveId(conv.id)} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeId === conv.id ? "bg-white/10 text-white" : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"}`}>
                    <MessageSquare size={11} className="shrink-0 opacity-50" />
                    <span className="flex-1 text-xs truncate">{conv.title}</span>
                    <button onClick={e => { e.stopPropagation(); setConversations(p => p.filter(c => c.id !== conv.id)); if (activeId === conv.id) setActiveId(null); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Model selector */}
          <div className="px-3 py-3 border-t border-white/[0.05]">
            <div className="relative" ref={modelDropRef}>
              <button onClick={() => setShowModelDrop(v => !v)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Cpu size={11} className="shrink-0" />
                <span className="truncate flex-1">{selectedModel}</span>
                <ChevronDown size={10} />
              </button>
              {showModelDrop && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                  {models.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">Nenhum modelo</div>
                  ) : models.map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setSelectedProvider(m.provider); setShowModelDrop(false); if (backendOnline) fetch(`${BACKEND}/api/providers/switch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: m.provider, model: m.id }) }); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedModel === m.id ? "text-[#10a37f]" : "text-foreground"}`}>
                      <span className="text-[10px] text-muted-foreground bg-white/10 px-1.5 py-0.5 rounded">{m.provider}</span>
                      <span className="truncate">{m.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-col flex-1 min-w-0">

        {/* Topbar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
          <button onClick={() => setSidebarOpen(v => !v)} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>
          <div className="flex-1 flex items-center gap-2">
            {TABS.find(t => t.id === tab)?.icon}
            <span className="text-sm font-medium">{TABS.find(t => t.id === tab)?.label}</span>
            {tab === "chat" && activeConv && (
              <span className="text-xs text-muted-foreground ml-2 truncate">— {activeConv.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tab === "chat" && thinkingContent && (
              <button onClick={() => setShowThinking(v => !v)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${showThinking ? "bg-purple-500/20 border-purple-500/30 text-purple-300" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                <Brain size={11} />{showThinking ? "Ocultar" : "Ver"} pensamento
              </button>
            )}
            <button onClick={checkConnections} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title="Reconectar">
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === "chat" && <ChatPanel activeConv={activeConv} streaming={streaming} thinkingContent={showThinking ? thinkingContent : null} messagesEndRef={messagesEndRef} />}
          {tab === "agents" && <AgentPanel task={agentTask} setTask={setAgentTask} steps={agentSteps} running={agentRunning} onRun={runAgent} />}
          {tab === "memory" && <MemoryPanel memory={memory} setMemory={setMemory} backendOnline={backendOnline} />}
          {tab === "skills" && <SkillsPanel skills={skills} onRefresh={fetchSkills} backendOnline={backendOnline} />}
          {tab === "scratch" && <div className="p-4 md:p-6 overflow-auto h-full"><ScratchStudio onCoreSync={async (scratch: any) => { try { await fetch(`${BACKEND}/api/scratch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scratch) }); } catch {} }} /></div>}
          {tab === "settings" && <SettingsPanel config={config} lmUrl={lmUrl} setLmUrl={setLmUrl} emotion={emotion} backendOnline={backendOnline} onSave={async (updates) => { setConfig((p: any) => ({ ...p, ...updates })); if (backendOnline) await fetch(`${BACKEND}/api/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }); }} />}
        </div>

        {/* Seletor de projeto (substitui a barra de dublagem) */}
        {tab === "chat" && (
          <div className="px-4 pt-2 pb-1 shrink-0 bg-background">
            <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-[#1a1a1a] border border-white/10 rounded-full pl-3 pr-1.5 py-1">
                <HardDrive size={13} className="text-muted-foreground shrink-0" />
                <input value={projectPathInput} onChange={e => setProjectPathInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") selectProjectInChat(); }} placeholder={projectStatus.path || "Caminho da pasta do projeto (ex.: C:\\MeuApp)…"} className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0" />
                <button onClick={() => selectProjectInChat()} disabled={!backendOnline} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#10a37f] hover:bg-[#0d8f6d] text-white disabled:opacity-40 transition-colors shrink-0">
                  <FolderPlus size={11} />Selecionar pasta
                </button>
              </div>
              {projectStatus.path && (
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#10a37f]/10 border border-[#10a37f]/25 text-[#10a37f] max-w-[240px]">
                  <FolderOpen size={12} className="shrink-0" />
                  <span className="truncate" title={projectStatus.path}>{projectStatus.name || projectStatus.path}</span>
                </div>
              )}
              <button onClick={() => setTab("projects")} title="Abrir o gerenciador completo da pasta do projeto" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                <Code size={12} />Gerenciar arquivos
              </button>
            </div>
            {projectStatus.path && (
              <p className="max-w-3xl mx-auto mt-1 text-[10px] text-muted-foreground truncate" title={projectStatus.path}>
                Projeto ativo: {projectStatus.path} — a IA já pode ler, criar e editar arquivos/pastas dentro dela.
              </p>
            )}
          </div>
        )}

        {/* Input (só no chat) */}
        {tab === "chat" && (
          <div className="px-4 pb-4 pt-2 shrink-0 bg-background">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 focus-within:border-[#10a37f]/40 transition-colors shadow-xl">
                <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={`Mensagem para Vessie AI${onlineStatus === "offline" ? " (offline)" : ""}…`} disabled={streaming || onlineStatus === "offline"} rows={1} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-6 max-h-44 overflow-y-auto disabled:opacity-40" style={{ scrollbarWidth: "none" }} />
                <div className="flex items-center gap-1 pb-0.5 shrink-0">
                  {streaming ? (
                    <button onClick={() => wsRef.current?.close()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-muted-foreground transition-colors" title="Parar"><Square size={14} /></button>
                  ) : (
                    <button onClick={() => sendMessage()} disabled={!input.trim() || onlineStatus === "offline"} className="p-2 rounded-lg bg-[#10a37f] hover:bg-[#0d8f6d] disabled:bg-white/10 disabled:text-muted-foreground text-white transition-colors" title="Enviar"><Send size={14} /></button>
                  )}
                </div>
              </div>
              <p className="text-center text-[10px] text-muted-foreground mt-2">
                {backendOnline ? `Backend • ${selectedProvider} • ${selectedModel}` : lmOnline ? `LM Studio direto • ${selectedModel}` : "Offline — inicie o backend ou LM Studio"}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────
function ChatPanel({ activeConv, streaming, thinkingContent, messagesEndRef }: { activeConv: Conversation | null; streaming: boolean; thinkingContent: string | null; messagesEndRef: React.RefObject<HTMLDivElement>; }) {
  if (!activeConv || activeConv.messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#10a37f]/20 to-[#0d6b54]/10 border border-[#10a37f]/20 flex items-center justify-center mb-5">
          <Sparkles size={28} className="text-[#10a37f]" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Olá, sou Vessie AI</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-8">Uma IA com personalidade real. Cursei, aprendi, cresci. Pergunte-me qualquer coisa.</p>
        <div className="grid sm:grid-cols-2 gap-2 max-w-xl w-full">
          {["Explique machine learning de forma simples", "Crie um script Python para automatizar tarefas", "Quais são suas emoções favoritas?", "Ajude-me a planejar um projeto"].map(s => (
            <div key={s} className="text-left px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer">
              {s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6" style={{ scrollbarWidth: "none" }}>
      <div className="max-w-3xl mx-auto space-y-6">
        {thinkingContent && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-xs text-purple-300 leading-6">
            <div className="flex items-center gap-2 mb-2 text-purple-400 font-medium">
              <Brain size={13} />Pensamento de Vessie
            </div>
            {thinkingContent}
          </div>
        )}
        {activeConv.messages.map((msg, idx) => (
          <MsgBubble key={msg.id} msg={msg} isLast={idx === activeConv.messages.length - 1} isStreaming={streaming && idx === activeConv.messages.length - 1 && msg.role === "assistant"} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function MsgBubble({ msg, isLast, isStreaming }: { msg: Message; isLast: boolean; isStreaming: boolean; }) {
  const [cp, setCp] = useState(false);
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#10a37f] to-[#0d6b54] flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={12} className="text-white" />
        </div>
      )}
      <div className={`max-w-[82%] ${isUser ? "flex flex-col items-end" : ""}`}>
        {isUser ? (
          <div className="bg-[#252525] border border-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-7">{msg.content}</div>
        ) : (
          <div className="text-sm text-foreground">
            {msg.content ? <Markdown text={msg.content} /> : isStreaming && (
              <div className="flex items-center gap-1.5 py-2">
                {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#10a37f] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            )}
            {isStreaming && msg.content && <span className="inline-block w-0.5 h-4 bg-[#10a37f] animate-pulse ml-0.5 align-middle" />}
          </div>
        )}
        {!isStreaming && msg.content && (
          <button onClick={() => { navigator.clipboard.writeText(msg.content); setCp(true); setTimeout(() => setCp(false), 2000); }} className="mt-1 p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            {cp ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[#2a2a3a] flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-foreground">EU</span>
        </div>
      )}
    </div>
  );
}

// ─── Agent Panel ──────────────────────────────────────────────────────────────
function AgentPanel({ task, setTask, steps, running, onRun }: any) {
  const phaseColors: Record<string, string> = { observe: "#6366f1", think: "#f59e0b", act: "#10a37f", result: "#06b6d4", done: "#10a37f" };
  const phaseIcons: Record<string, JSX.Element> = { observe: <Eye size={12} />, think: <Lightbulb size={12} />, act: <Play size={12} />, result: <Target size={12} />, done: <Check size={12} /> };

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: "none" }}>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="text-base font-semibold mb-1">Agente Loop</h2>
          <p className="text-xs text-muted-foreground">Ciclo: <span className="text-[#6366f1]">Observar</span> → <span className="text-[#f59e0b]">Pensar</span> → <span className="text-[#10a37f]">Agir</span> → <span className="text-[#06b6d4]">Resultado</span></p>
        </div>

        <div className="flex gap-2">
          <input value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => e.key === "Enter" && onRun()} placeholder="Descreva a tarefa para o agente…" className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#10a37f]/40 placeholder:text-muted-foreground" />
          <button onClick={onRun} disabled={!task.trim() || running} className="px-4 py-2.5 rounded-xl bg-[#10a37f] hover:bg-[#0d8f6d] disabled:bg-white/10 disabled:text-muted-foreground text-white text-sm font-medium transition-colors flex items-center gap-2">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}{running ? "Rodando…" : "Executar"}
          </button>
        </div>

        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((s: any, i: number) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: phaseColors[s.phase] + "50", color: phaseColors[s.phase], background: phaseColors[s.phase] + "15" }}>
                    {phaseIcons[s.phase] || <ArrowRight size={12} />}
                  </div>
                  {i < steps.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1.5" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium capitalize" style={{ color: phaseColors[s.phase] }}>{s.phase}</span>
                    {s.cycle && <span className="text-[10px] text-muted-foreground">Ciclo {s.cycle}</span>}
                  </div>
                  {s.message && <p className="text-xs text-muted-foreground">{s.message}</p>}
                  {s.content && (
                    <div className="mt-2 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 leading-5 max-h-40 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      {s.content}
                    </div>
                  )}
                  {s.result && (
                    <div className="mt-2 text-xs bg-[#10a37f]/10 border border-[#10a37f]/20 rounded-lg p-3 leading-5">
                      <strong className="text-[#10a37f]">Resultado final:</strong><br />{s.result.slice(0, 500)}{s.result.length > 500 ? "…" : ""}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {steps.length === 0 && !running && (
          <div className="text-center py-12 text-muted-foreground">
            <Zap size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Descreva uma tarefa e o agente executará o ciclo completo</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Memory Panel ─────────────────────────────────────────────────────────────
function MemoryPanel({ memory, setMemory, backendOnline }: any) {
  const [saving, setSaving] = useState(false);

  async function saveMemory() {
    setSaving(true);
    await fetch(`${BACKEND}/api/memory/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: memory }) });
    setSaving(false);
  }

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="max-w-3xl mx-auto w-full flex flex-col flex-1 gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Memory.md</h2>
            <p className="text-xs text-muted-foreground">Memória persistente atualizada automaticamente</p>
          </div>
          {backendOnline && (
            <button onClick={saveMemory} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#10a37f] hover:bg-[#0d8f6d] text-white text-xs font-medium transition-colors disabled:opacity-50">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          )}
        </div>
        <textarea value={memory} onChange={e => setMemory(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-sm font-mono text-foreground outline-none focus:border-[#10a37f]/40 resize-none leading-6 min-h-64" style={{ scrollbarWidth: "none" }} placeholder="A memória será populada automaticamente após conversas…" />
      </div>
    </div>
  );
}

// ─── Skills Panel ─────────────────────────────────────────────────────────────
function SkillsPanel({ skills, onRefresh, backendOnline }: any) {
  const [selected, setSelected] = useState<any>(null);
  const [content, setContent] = useState("");

  async function loadSkill(name: string) {
    const r = await fetch(`${BACKEND}/api/skills/${name}`);
    const d = await r.json();
    setContent(d.skill || "");
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* List */}
      <div className="w-64 border-r border-white/[0.06] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-xs font-medium">Skills</span>
          <button onClick={onRefresh} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={12} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: "none" }}>
          {skills.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma skill ainda</div>
          ) : skills.map((s: any) => (
            <button key={s.name} onClick={() => { setSelected(s); loadSkill(s.name); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${selected?.name === s.name ? "bg-white/10 text-white" : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"}`}>
              <div className="font-medium truncate">{s.title}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.date}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {selected ? (
          <div>
            <h2 className="text-sm font-semibold mb-1">{selected.title}</h2>
            <div className="flex gap-2 mb-4">
              {selected.tags?.map((t: string) => <span key={t} className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-muted-foreground">{t}</span>)}
            </div>
            <pre className="text-xs leading-6 text-foreground/90 whitespace-pre-wrap font-mono">{content}</pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BookOpen size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Selecione uma skill para ver</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Projects Panel ───────────────────────────────────────────────────────────
function ProjectsPanel({ projects, files, setFiles, backendOnline }: any) {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileContent, setFileContent] = useState("");

  async function selectProject(p: any) {
    if (!backendOnline) return;
    await fetch(`${BACKEND}/api/projects/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: p.path }) });
    const r = await fetch(`${BACKEND}/api/projects/files`);
    const d = await r.json();
    setFiles(d.files || []);
  }

  async function loadFile(f: any) {
    setSelectedFile(f);
    const r = await fetch(`${BACKEND}/api/projects/file?path=${encodeURIComponent(f.path)}`);
    const d = await r.json();
    setFileContent(d.content || "");
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-56 border-r border-white/[0.06] flex flex-col">
        <div className="px-4 py-3 border-b border-white/[0.06]"><span className="text-xs font-medium">Projetos</span></div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: "none" }}>
          {projects.map((p: any) => (
            <button key={p.path} onClick={() => selectProject(p)} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${p.active ? "bg-white/10 text-white" : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"}`}>
              <FolderOpen size={11} className="inline mr-1.5 opacity-60" />{p.name}
            </button>
          ))}
        </div>
        {files.length > 0 && (
          <>
            <div className="px-4 py-2 border-t border-white/[0.06] border-b"><span className="text-[10px] text-muted-foreground uppercase tracking-wide">Arquivos</span></div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
              {files.map((f: any) => (
                <button key={f.path} onClick={() => f.type === "file" && loadFile(f)} className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${selectedFile?.path === f.path ? "bg-white/10 text-white" : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"}`}>
                  {f.type === "dir" ? <FolderOpen size={10} className="inline mr-1.5" /> : <FileText size={10} className="inline mr-1.5" />}{f.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 p-6 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {selectedFile ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Code size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              {selectedFile.language && <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-muted-foreground">{selectedFile.language}</span>}
            </div>
            <pre className="text-xs font-mono leading-5 text-foreground/90 whitespace-pre-wrap">{fileContent}</pre>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Selecione um projeto e arquivo</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ config, lmUrl, setLmUrl, emotion, backendOnline, onSave }: any) {
  const [localConfig, setLocalConfig] = useState(config);
  const [localUrl, setLocalUrl] = useState(lmUrl);

  useEffect(() => setLocalConfig(config), [config]);

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: "none" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-base font-semibold">Configurações do Vessie AI</h2>

        {/* Status */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Backend", value: backendOnline ? "Conectado" : "Offline", color: backendOnline ? "#10a37f" : "#ef4444" },
            { label: "Emoção", value: `${emotion.emoji} ${emotion.name}`, color: emotion.color },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="text-sm font-medium" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* LM Studio URL */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">URL do LM Studio</label>
          <input value={localUrl} onChange={e => setLocalUrl(e.target.value)} className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:border-[#10a37f]/40 placeholder:text-muted-foreground" />
        </div>

        {/* Temperatura */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Temperatura: <span className="text-foreground">{localConfig.temperature ?? 0.7}</span></label>
          <input type="range" min="0" max="2" step="0.1" value={localConfig.temperature ?? 0.7} onChange={e => setLocalConfig((p: any) => ({ ...p, temperature: parseFloat(e.target.value) }))} className="w-full accent-[#10a37f]" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Preciso</span><span>Criativo</span></div>
        </div>

        {/* Max tokens */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max Tokens: <span className="text-foreground">{localConfig.maxTokens ?? 2048}</span></label>
          <input type="range" min="256" max="8192" step="256" value={localConfig.maxTokens ?? 2048} onChange={e => setLocalConfig((p: any) => ({ ...p, maxTokens: parseInt(e.target.value) }))} className="w-full accent-[#10a37f]" />
        </div>

        {/* Toggles */}
        {[
          { key: "agentLoop", label: "Agente Loop", desc: "Ciclo observe→think→act→result" },
          { key: "emotionSystem", label: "Sistema de Emoções", desc: "22+ estados emocionais adaptativos" },
          { key: "adaptivePrompt", label: "Prompt Adaptativo", desc: "Aprende com as conversas" },
          { key: "memoryEnabled", label: "Memória", desc: "Atualização automática do Memory.md" },
          { key: "webSearch", label: "Pesquisa Web", desc: "Busca automática na internet" },
        ].map(t => (
          <div key={t.key} className="flex items-center justify-between py-3 border-b border-white/[0.06]">
            <div>
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </div>
            <button onClick={() => setLocalConfig((p: any) => ({ ...p, [t.key]: !p[t.key] }))} className={`w-11 h-6 rounded-full transition-colors relative ${localConfig[t.key] ? "bg-[#10a37f]" : "bg-white/20"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${localConfig[t.key] ? "left-6" : "left-1"}`} />
            </button>
          </div>
        ))}

        {/* Think Mode */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Modo de Pensamento</label>
          <div className="flex gap-2">
            {["auto", "manual", "disabled"].map(m => (
              <button key={m} onClick={() => setLocalConfig((p: any) => ({ ...p, thinkMode: m }))} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${localConfig.thinkMode === m ? "bg-[#10a37f]/20 border-[#10a37f]/50 text-[#10a37f]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                {m === "auto" ? "Automático" : m === "manual" ? "Manual" : "Desativado"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => { setLmUrl(localUrl); onSave({ ...localConfig, LM_STUDIO_URL: localUrl }); }} className="w-full py-2.5 rounded-xl bg-[#10a37f] hover:bg-[#0d8f6d] text-white text-sm font-medium transition-colors">
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
