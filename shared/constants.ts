/**
 * Constantes compartilhadas entre backend, frontend e docs.
 * Mantido em um único lugar para evitar duplicação.
 */

/** Ações executáveis pelo orquestrador de desenvolvimento. */
export const ACTION_NAMES = [
  'ANALYZE',
  'PLAN',
  'SEARCH',
  'READ_FILE',
  'WRITE_FILE',
  'EDIT_FILE',
  'DELETE_FILE',
  'REFACTOR',
  'DEBUG',
  'TEST',
  'REVIEW',
  'DOCUMENT',
  'BUILD',
  'RUN',
  'FINALIZE',
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export const ACTION_PRIORITY: Record<ActionName, number> = {
  ANALYZE: 60,
  PLAN: 80,
  SEARCH: 40,
  READ_FILE: 30,
  WRITE_FILE: 50,
  EDIT_FILE: 50,
  DELETE_FILE: 50,
  REFACTOR: 70,
  DEBUG: 75,
  TEST: 70,
  REVIEW: 65,
  DOCUMENT: 45,
  BUILD: 70,
  RUN: 60,
  FINALIZE: 55,
};

export type ActionStatus =
  | 'queued'
  | 'running'
  | 'pending'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export type TaskStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'failed'
  | 'done';

/** Ordem do loop de desenvolvimento (REQUEST → … → FINALIZE). */
export const DEV_LOOP = [
  'ANALYZE',
  'PLAN',
  'EXECUTE',
  'TEST',
  'DEBUG',
  'REVIEW',
  'FINALIZE',
] as const;

/** Eventos enviados pelo backend via WebSocket. */
export const WS_EVENTS = {
  TASK_START: 'task:start',
  TASK_PROGRESS: 'task:progress',
  TASK_ACTION: 'task:action',
  TASK_TOKEN: 'task:token',
  TOOL_START: 'tool:start',
  TOOL_RESULT: 'tool:result',
  TASK_ERROR: 'task:error',
  TASK_COMPLETE: 'task:complete',
  TASK_CANCELLED: 'task:cancelled',
  STREAM_CHUNK: 'chunk',
  STREAM_DONE: 'done',
  ERROR: 'error',
  THINK: 'think',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/** Níveis de memória. Cada nível tem regras próprias de escopo/retirada. */
export const MEMORY_LEVELS = ['GLOBAL', 'PROJECT', 'SESSION', 'TASK', 'MESSAGE'] as const;
export type MemoryLevel = (typeof MEMORY_LEVELS)[number];

/** Preferências de uma ação usadas pelo gerenciador de contexto. 1 = mais relevante. */
export const CONTEXT_PRIORITY_ORDER = [
  'instruction',
  'involved_files',
  'dependencies',
  'previous_results',
  'project_config',
  'relevant_history',
  'secondary',
] as const;

/** Padrões de orçamento de tokens por ação (exemplo do enunciado). */
export const DEFAULT_TOKEN_ALLOCATION: Record<ActionName | 'GLOBAL', number> = {
  GLOBAL: 100000,
  ANALYZE: 15000,
  PLAN: 10000,
  SEARCH: 10000,
  READ_FILE: 10000,
  WRITE_FILE: 20000,
  EDIT_FILE: 20000,
  DELETE_FILE: 5000,
  REFACTOR: 20000,
  DEBUG: 15000,
  TEST: 15000,
  REVIEW: 10000,
  DOCUMENT: 10000,
  BUILD: 10000,
  RUN: 5000,
  FINALIZE: 10000,
};