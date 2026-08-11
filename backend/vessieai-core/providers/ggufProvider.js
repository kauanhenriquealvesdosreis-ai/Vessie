import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Diretórios onde o sistema procura por arquivos .gguf automaticamente.
 * O usuário pode simplesmente colocar um arquivo chamado "LocalModel.gguf"
 * em qualquer uma dessas pastas (a raiz `models/` do repositório é a recomendada).
 */
function defaultModelDirs() {
  const cwd = process.cwd();
  return [
    process.env.GGUF_MODEL_DIR,
    path.resolve(cwd, 'models'),               // <repo>/models
    path.resolve(cwd, 'backend', 'models'),    // <repo>/backend/models
    path.resolve(__dirname, '..', '..', 'models'),   // backend/models
    path.resolve(__dirname, '..', '..', '..', 'models'), // <repo>/models
    cwd,
  ].filter(Boolean);
}

/**
 * Localiza o arquivo .gguf a ser usado.
 * Prioridade: env GGUF_MODEL_PATH -> GGUF_MODEL_DIR -> LocalModel.gguf
 * em qualquer pasta de modelos -> primeiro .gguf encontrado.
 */
export function findModelFile() {
  if (process.env.GGUF_MODEL_PATH && fs.existsSync(process.env.GGUF_MODEL_PATH)) {
    return path.resolve(process.env.GGUF_MODEL_PATH);
  }

  for (const dir of defaultModelDirs()) {
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      // 1) Nome canônico
      const local = path.join(dir, 'LocalModel.gguf');
      if (fs.existsSync(local)) return path.resolve(local);

      // 2) Qualquer .gguf na pasta
      const found = fs.readdirSync(dir).find(f => f.toLowerCase().endsWith('.gguf'));
      if (found) return path.resolve(path.join(dir, found));
    } catch { /* ignora pastas sem permissão */ }
  }
  return null;
}

let llamaModule = null;
let llamaInstance = null;
let model = null;

/**
 * Provider local de IA que executa um modelo GGUF (arquitetura llama.cpp)
 * usando a biblioteca `node-llama-cpp`. Se a biblioteca não estiver instalada
 * ou não houver um arquivo .gguf, o provider fica indisponível e o sistema
 * usa o fallback (LM Studio / OpenAI / Anthropic).
 */
export class GgufProvider {
  constructor() {
    this.name = 'gguf';
    this.label = 'Modelo GGUF (local)';
    this.modelPath = null;
    this.ready = false;
    this.status = 'idle'; // idle | loading | ready | error
    this.message = '';
    this.info = null;
  }

  /** Localiza e carrega o modelo. Idempotente (pode demorar na 1ª vez). */
  async init() {
    if (this.ready) return true;

    this.modelPath = findModelFile();
    if (!this.modelPath) {
      this.status = 'error';
      this.ready = false;
      this.message =
        'Nenhum modelo .gguf encontrado. Coloque LocalModel.gguf na pasta models/ ' +
        '(na raiz do projeto ou em backend/models) ou defina GGUF_MODEL_PATH no .env.';
      console.warn(`[GgufProvider] ${this.message}`);
      return false;
    }

    this.status = 'loading';
    this.message = `Carregando ${path.basename(this.modelPath)}…`;

    try {
      if (!llamaModule) {
        llamaModule = await import('node-llama-cpp');
      }
      llamaInstance = await llamaModule.getLlama();
      model = await llamaInstance.loadModel({ modelPath: this.modelPath });

      const sizeMb = fs.statSync(this.modelPath).size / (1024 * 1024);
      this.info = {
        path: this.modelPath,
        name: path.basename(this.modelPath),
        size: `${sizeMb >= 1024 ? (sizeMb / 1024).toFixed(2) + ' GB' : sizeMb.toFixed(0) + ' MB'}`,
        contextSize: model.contextSize,
        trainContextSize: model.trainContextSize,
        vocabSize: model.vocab?.size ?? null,
        architecture: model.architecture ?? null,
      };
      this.ready = true;
      this.status = 'ready';
      this.message = `Modelo ${path.basename(this.modelPath)} carregado (${this.info.size})`;
      console.log(`[GgufProvider] ✓ ${this.message}`);
      return true;
    } catch (err) {
      this.ready = false;
      this.status = 'error';
      this.message = `Falha ao carregar o GGUF: ${err.message}`;
      console.error('[GgufProvider]', err);
      return false;
    }
  }

  get available() {
    return this.ready;
  }

  get unavailableReason() {
    return this.status === 'error' ? this.message : '';
  }

  statusJSON() {
    return {
      provider: this.name,
      label: this.label,
      ready: this.ready,
      status: this.status,
      message: this.message,
      modelPath: this.modelPath,
      info: this.info,
    };
  }

  async _ensureReady() {
    if (this.ready && model) return model;
    const ok = await this.init();
    if (!ok) throw new Error(this.message);
    return model;
  }

  /** Recarrega o modelo em disco (útil após trocar o .gguf sem reiniciar). */
  async reload() {
    if (model) { try { await model.dispose(); } catch {} model = null; }
    this.ready = false;
    this.status = 'idle';
    this.message = '';
    this.info = null;
    return this.init();
  }

  /**
   * Gera uma resposta com streaming de tokens.
   * `messages`: [{ role: 'system'|'user'|'assistant', content: string }, ...]
   */
  async streamChat(messages, options = {}, onChunk = () => {}) {
    const m = await this._ensureReady();
    const temperature = options.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7');
    const maxTokens = options.maxTokens ?? parseInt(process.env.AI_MAX_TOKENS || '2048');
    const rawCtx = parseInt(process.env.GGUF_CONTEXT_SIZE || '0', 10);
    const contextSize = options.contextSize || (rawCtx > 0 ? rawCtx : undefined);

    const context = await m.createContext({ contextSize });
    const session = context.getSequence();

    const cleaned = (messages || []).map(({ role, content }) => ({ role, content: String(content ?? '') }));
    if (cleaned.length === 0) cleaned.push({ role: 'user', content: '' });

    let full = '';
    const stopSeq = options.stop;

    try {
      await session.prompt(cleaned, {
        temperature,
        maxTokens,
        onTextChunk: (chunk) => {
          full += chunk;
          if (onChunk) onChunk(chunk);
          if (stopSeq && full.includes(stopSeq)) { try { session.abort(); } catch {} }
        },
      });
    } finally {
      try { context.dispose(); } catch {}
    }
    return full;
  }

  /** Gera uma resposta completa (sem streaming). */
  async chat(messages, options = {}) {
    let full = '';
    await this.streamChat(messages, options, (chunk) => { full += chunk; });
    return full;
  }
}

