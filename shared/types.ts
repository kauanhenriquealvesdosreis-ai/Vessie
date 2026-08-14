import type {
  ActionName,
  ActionStatus,
  MemoryLevel,
  TaskStatus,
  WsEventName,
} from './constants';

/** Parâmetros de geração enviados ao LM Studio / providers OpenAI-compatíveis. */
export interface GenerationParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  seed?: number | null;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
}

/** Metadados de um modelo descoberto no LM Studio. */
export interface LmModel {
  id: string;
  name?: string;
  context?: number | null;
  max_tokens?: number | null;
  params?: number | null;
  quantization?: string | null;
  loaded?: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/** Ação do sistema de desenvolvimento. */
export interface Action {
  id: string;
  name: ActionName;
  description: string;
  priority: number;
  prompt: string;
  contextNeeded: string[];
  tokenBudget: number;
  status: ActionStatus;
  result?: string;
  durationMs?: number;
  startedAt?: number;
  finishedAt?: number;
  errors?: string[];
  retries: number;
}

export interface Task {
  id: string;
  originalRequest: string;
  status: TaskStatus;
  actions: Action[];
  currentAction?: string;
  projectId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  attempts: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  completedActions: number;
  totalActions: number;
  logs: string[];
  tokenUsage: TokenUsage;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  permissions: string[];
  timeoutMs?: number;
  destructive?: boolean;
}

export interface ToolEvent {
  type: string;
  taskId?: string;
  ts: number;
  payload?: unknown;
}

/** Evento WebSocket estruturado. */
export interface WsEvent {
  type: WsEventName;
  taskId?: string;
  ts: number;
  actionId?: string;
  actionName?: ActionName;
  [key: string]: unknown;
}

export interface HealthResponse {
  ok: boolean;
  app: string;
  version?: string;
  time: number;
  lmStudio: LmStudioStatus;
}

export interface LmStudioStatus {
  online: boolean;
  url: string;
  models: number;
  currentModel?: string | null;
  errors?: string[];
}