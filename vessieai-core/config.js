const fs = require('fs');
const path = require('path');

function loadEnv(root) {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function bool(v, fallback=false) { if (v === undefined) return fallback; return ['1','true','yes','on'].includes(String(v).toLowerCase()); }
function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function csv(v, fallback=[]) { return v ? String(v).split(',').map(s=>s.trim()).filter(Boolean) : fallback; }

function createConfig(root) {
  loadEnv(root);
  const core = path.join(root, 'vessieai-core');
  return {
    root,
    core,
    port: num(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    lmStudioUrl: (process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234/v1').replace(/\/$/, ''),
    lmModel: process.env.LM_MODEL || 'local-model',
    providerPreference: process.env.AI_PROVIDER || 'hybrid',
    ggufModelPath: process.env.GGUF_MODEL_PATH || '',
    lmModels: csv(process.env.LM_MODELS, [process.env.LM_MODEL || 'local-model']),
    lmApiKey: process.env.LM_API_KEY || '',
    maxTokens: num(process.env.MAX_TOKENS, 8192),
    temperature: num(process.env.TEMPERATURE, 0.7),
    systemPrompt: process.env.SYSTEM_PROMPT || 'Você é VessieAI.',
    adaptiveSystemPrompt: bool(process.env.ADAPTIVE_SYSTEM_PROMPT, true),
    webSearchEnabled: bool(process.env.WEB_SEARCH_ENABLED, true),
    webSearchMaxResults: num(process.env.WEB_SEARCH_MAX_RESULTS, 6),
    agentLoopEnabled: bool(process.env.AGENT_LOOP_ENABLED, true),
    agentMaxRetries: num(process.env.AGENT_MAX_RETRIES, 2),
    agentMaxSteps: num(process.env.AGENT_MAX_STEPS, 8),
    memoryEnabled: bool(process.env.MEMORY_ENABLED, true),
    memoryMaxItems: num(process.env.MEMORY_MAX_ITEMS, 120),
    rulesMaxLines: Math.min(200, num(process.env.RULES_MAX_LINES, 200)),
    forceAllModule: bool(process.env.FORCE_ALL_MODULE, false),
    autoEvolutionEnabled: bool(process.env.AUTO_EVOLUTION_ENABLED, false),
    autoEvolutionIdleMinutes: num(process.env.AUTO_EVOLUTION_IDLE_MINUTES, 30),
    authEnabled: bool(process.env.AUTH_ENABLED, true),
    authPassword: process.env.AUTH_PASSWORD || 'change-me-now',
    sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 24),
    trustProxy: bool(process.env.TRUST_PROXY, false),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    projectRoots: csv(process.env.PROJECT_ROOTS, ['.']).map(p => path.resolve(root, p)),
    workspaceRoot: path.resolve(root, process.env.WORKSPACE_ROOT || 'workspace'),
    discordEnabled: bool(process.env.DISCORD_ENABLED, false),
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    discordStorageChannel: process.env.DISCORD_STORAGE_CHANNEL || '',
    mcpEnabled: bool(process.env.MCP_ENABLED, true),
    mcpConfig: path.resolve(root, process.env.MCP_CONFIG || 'vessieai-core/mcp/servers.json'),
    thinkMode: process.env.THINK_MODE || 'auto',
    publicDir: path.join(core, 'public')
  };
}

module.exports = { createConfig };
