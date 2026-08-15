export interface VessieTab {
  id: string;
  title: string;
  type: string;
  active: boolean;
  closable: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  data?: Record<string, unknown>;
}

export interface TabManagerOptions {
  storageKey?: string;
  maxTabs?: number;
}

const uid = () => `tab-${crypto.randomUUID()}`;

export class VessieTabManager {
  private readonly storageKey: string;
  private readonly maxTabs: number;
  private tabs: VessieTab[] = [];
  private listeners = new Set<(tabs: VessieTab[]) => void>();

  constructor(options: TabManagerOptions = {}) {
    this.storageKey = options.storageKey ?? "vessie-tabs:v1";
    this.maxTabs = options.maxTabs ?? 32;
    this.restore();
  }

  subscribe(listener: (tabs: VessieTab[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => this.listeners.delete(listener);
  }

  getAll(): VessieTab[] { return this.tabs.map(tab => ({ ...tab, data: tab.data ? { ...tab.data } : undefined })); }
  getActive(): VessieTab | undefined { return this.tabs.find(tab => tab.active); }

  open(input: Omit<VessieTab, "id" | "active" | "createdAt" | "updatedAt"> & { id?: string }): VessieTab {
    if (this.tabs.length >= this.maxTabs) {
      const candidate = this.tabs.find(tab => !tab.pinned && tab.closable);
      if (candidate) this.close(candidate.id);
      else throw new Error(`Limite de ${this.maxTabs} abas atingida.`);
    }

    const existing = input.id ? this.tabs.find(tab => tab.id === input.id) : undefined;
    if (existing) return this.activate(existing.id);

    const now = Date.now();
    const tab: VessieTab = {
      id: input.id ?? uid(),
      title: input.title || "Nova aba",
      type: input.type || "chat",
      active: true,
      closable: input.closable ?? true,
      pinned: input.pinned ?? false,
      createdAt: now,
      updatedAt: now,
      data: input.data,
    };
    this.tabs = [...this.tabs.map(item => ({ ...item, active: false })), tab];
    this.commit();
    return tab;
  }

  activate(id: string): VessieTab {
    const found = this.tabs.find(tab => tab.id === id);
    if (!found) throw new Error(`Aba não encontrada: ${id}`);
    this.tabs = this.tabs.map(tab => ({ ...tab, active: tab.id === id, updatedAt: tab.id === id ? Date.now() : tab.updatedAt }));
    this.commit();
    return { ...found, active: true };
  }

  update(id: string, patch: Partial<Omit<VessieTab, "id" | "createdAt">>): VessieTab {
    const found = this.tabs.find(tab => tab.id === id);
    if (!found) throw new Error(`Aba não encontrada: ${id}`);
    let updated: VessieTab | undefined;
    this.tabs = this.tabs.map(tab => {
      if (tab.id !== id) return tab;
      updated = { ...tab, ...patch, updatedAt: Date.now() };
      return updated;
    });
    this.commit();
    return updated!;
  }

  close(id: string): void {
    const index = this.tabs.findIndex(tab => tab.id === id);
    if (index < 0) return;
    const target = this.tabs[index];
    if (!target.closable || target.pinned) return;
    const wasActive = target.active;
    this.tabs = this.tabs.filter(tab => tab.id !== id);
    if (wasActive && this.tabs.length) {
      const next = this.tabs[Math.min(index, this.tabs.length - 1)];
      this.tabs = this.tabs.map(tab => ({ ...tab, active: tab.id === next.id }));
    }
    this.commit();
  }

  closeOthers(id: string): void {
    this.tabs = this.tabs.filter(tab => tab.id === id || tab.pinned || !tab.closable);
    this.tabs = this.tabs.map(tab => ({ ...tab, active: tab.id === id }));
    this.commit();
  }

  reorder(sourceId: string, targetId: string): void {
    if (sourceId === targetId) return;
    const source = this.tabs.find(tab => tab.id === sourceId);
    const target = this.tabs.find(tab => tab.id === targetId);
    if (!source || !target) return;
    const list = this.tabs.filter(tab => tab.id !== sourceId);
    const targetIndex = list.findIndex(tab => tab.id === targetId);
    list.splice(targetIndex < 0 ? list.length : targetIndex, 0, source);
    this.tabs = list;
    this.commit();
  }

  clear(): void {
    this.tabs = this.tabs.filter(tab => tab.pinned || !tab.closable);
    if (!this.tabs.some(tab => tab.active) && this.tabs.length) this.tabs[0].active = true;
    this.commit();
  }

  private commit(): void {
    this.persist();
    const snapshot = this.getAll();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private persist(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.tabs)); } catch {}
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as VessieTab[];
      if (!Array.isArray(parsed)) return;
      this.tabs = parsed.slice(0, this.maxTabs);
      if (this.tabs.length && !this.tabs.some(tab => tab.active)) this.tabs[0].active = true;
      this.tabs = this.tabs.map(tab => ({ ...tab, active: tab.active === true }));
    } catch { this.tabs = []; }
  }
}

export const vessieTabs = new VessieTabManager();
