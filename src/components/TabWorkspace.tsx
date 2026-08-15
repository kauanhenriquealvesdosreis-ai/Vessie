import { useEffect, useMemo, useState } from "react";
import { Plus, Pin, X, RotateCcw } from "lucide-react";

type TabDefinition = { id: string; label: string; icon?: React.ReactNode; closable?: boolean; pinned?: boolean };
type Props = { tabs: TabDefinition[]; activeId: string; onChange: (id: string) => void; onClose?: (id: string) => void; onNew?: () => void };

const STORAGE_KEY = "vessie.tabs.v2";

export default function TabWorkspace({ tabs, activeId, onChange, onClose, onNew }: Props) {
  const [order, setOrder] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } });
  const [closed, setClosed] = useState<string[]>([]);
  const visible = useMemo(() => {
    const known = new Set(tabs.map(tab => tab.id));
    const ordered = [...order.filter(id => known.has(id)), ...tabs.map(tab => tab.id).filter(id => !order.includes(id))];
    return ordered.map(id => tabs.find(tab => tab.id === id)!).filter(Boolean).filter(tab => !closed.includes(tab.id));
  }, [tabs, order, closed]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(visible.map(tab => tab.id))); }, [visible]);
  useEffect(() => { if (!visible.some(tab => tab.id === activeId) && visible[0]) onChange(visible[0].id); }, [visible, activeId, onChange]);
  const move = (from: number, to: number) => setOrder(current => { const next = [...(current.length ? current : tabs.map(tab => tab.id))]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
  return <div className="tab-workspace" role="tablist" aria-label="Abas do VessieAI">
    <div className="tab-strip">
      {visible.map((tab, index) => <button key={tab.id} role="tab" aria-selected={activeId === tab.id} className={`workspace-tab ${activeId === tab.id ? "is-active" : ""}`} onClick={() => onChange(tab.id)} onDoubleClick={() => tab.closable !== false && setClosed(list => [...list, tab.id])} draggable onDragStart={event => event.dataTransfer.setData("text/tab-index", String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { const from = Number(event.dataTransfer.getData("text/tab-index")); if (Number.isFinite(from) && from !== index) move(from, index); }}>
        {tab.pinned ? <Pin size={12} /> : tab.icon}<span>{tab.label}</span>{tab.closable !== false && <span className="tab-close" onClick={event => { event.stopPropagation(); setClosed(list => [...list, tab.id]); onClose?.(tab.id); }}><X size={12} /></span>}
      </button>)}
      <button className="tab-add" onClick={onNew} title="Nova aba"><Plus size={15} /></button>
    </div>
    {closed.length > 0 && <button className="tab-restore" onClick={() => setClosed([])} title="Reabrir abas"><RotateCcw size={12} /> Reabrir</button>}
  </div>;
}

export function useTabState(defaultId: string) { const [activeId, setActiveId] = useState(() => sessionStorage.getItem("vessie.active-tab") || defaultId); useEffect(() => { sessionStorage.setItem("vessie.active-tab", activeId); }, [activeId]); return [activeId, setActiveId] as const; }
