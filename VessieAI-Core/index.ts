export type VessieRole = "system" | "user" | "assistant" | "tool";

export interface CoreMessage {
  id: string;
  role: VessieRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface CoreContext {
  conversationId?: string;
  tabId?: string;
  model?: string;
  provider?: string;
  project?: { path: string; name?: string };
  memory?: string;
  skills?: string[];
  metadata?: Record<string, unknown>;
}

export interface ResponsePlan {
  systemPrompt: string;
  messages: CoreMessage[];
  context: CoreContext;
  instructions: string[];
}

export interface CoreConfig {
  storageKey?: string;
  maxMessages?: number;
  maxContextChars?: number;
}

const DEFAULT_SYSTEM = [
  "Você é Vessie, uma IA modular integrada ao Vessie.",
  "Responda com precisão, preserve o contexto e não invente operações que não foram executadas.",
  "Quando houver ferramentas, projetos ou memória disponíveis, use-os somente quando forem relevantes.",
].join(" ");

const clampText = (value: string, max: number) => value.length <= max ? value : value.slice(-max);

export class VessieAICore {
  private readonly storageKey: string;
  private readonly maxMessages: number;
  private readonly maxContextChars: number;
  private history = new Map<string, CoreMessage[]>();

  constructor(config: CoreConfig = {}) {
    this.storageKey = config.storageKey ?? "vessie-ai-core:v1";
    this.maxMessages = config.maxMessages ?? 80;
    this.maxContextChars = config.maxContextChars ?? 24000;
    this.restore();
  }

  createMessage(role: VessieRole, content: string, metadata?: Record<string, unknown>): CoreMessage {
    return { id: crypto.randomUUID(), role, content: String(content ?? ""), createdAt: Date.now(), metadata };
  }

  append(conversationId: string, message: CoreMessage): void {
    const list = this.history.get(conversationId) ?? [];
    list.push(message);
    this.history.set(conversationId, list.slice(-this.maxMessages));
    this.persist();
  }

  appendText(conversationId: string, role: VessieRole, content: string, metadata?: Record<string, unknown>): CoreMessage {
    const message = this.createMessage(role, content, metadata);
    this.append(conversationId, message);
    return message;
  }

  getHistory(conversationId: string): CoreMessage[] {
    return [...(this.history.get(conversationId) ?? [])];
  }

  clear(conversationId: string): void {
    this.history.delete(conversationId);
    this.persist();
  }

  buildResponsePlan(conversationId: string, context: CoreContext = {}, systemPrompt = DEFAULT_SYSTEM): ResponsePlan {
    const messages = this.getHistory(conversationId);
    const contextLines: string[] = [];

    if (context.project?.path) contextLines.push(`Projeto ativo: ${context.project.name ?? "sem nome"} (${context.project.path})`);
    if (context.model) contextLines.push(`Modelo: ${context.model}`);
    if (context.provider) contextLines.push(`Provedor: ${context.provider}`);
    if (context.skills?.length) contextLines.push(`Skills disponíveis: ${context.skills.join(", ")}`);
    if (context.memory?.trim()) contextLines.push(`Memória relevante:\n${clampText(context.memory.trim(), 8000)}`);

    const enrichedSystem = contextLines.length
      ? `${systemPrompt}\n\nCONTEXTO OPERACIONAL:\n${contextLines.join("\n")}`
      : systemPrompt;

    return {
      systemPrompt: enrichedSystem,
      messages,
      context,
      instructions: [
        "Analise a solicitação antes de responder.",
        "Separe fatos do projeto de inferências.",
        "Para tarefas de código, preserve arquitetura e contratos existentes.",
        "Se uma operação externa não foi executada, informe isso explicitamente.",
      ],
    };
  }

  buildPrompt(conversationId: string, context: CoreContext = {}, systemPrompt = DEFAULT_SYSTEM): string {
    const plan = this.buildResponsePlan(conversationId, context, systemPrompt);
    const history = plan.messages
      .map(message => `${message.role.toUpperCase()}: ${clampText(message.content, this.maxContextChars)}`)
      .join("\n\n");
    return `${plan.systemPrompt}\n\nREGRAS:\n- ${plan.instructions.join("\n- ")}\n\nHISTÓRICO:\n${history}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.history.entries()]));
    } catch {
      // Storage may be unavailable in private/embedded contexts.
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as [string, CoreMessage[]][];
      this.history = new Map(parsed.map(([id, messages]) => [id, messages.slice(-this.maxMessages)]));
    } catch {
      this.history.clear();
    }
  }
}

export const vessieCore = new VessieAICore();

export default VessieAICore;
