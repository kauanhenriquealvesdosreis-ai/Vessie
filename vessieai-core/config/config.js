// Configuração centralizada do VessieCore.
// Lê automaticamente do .env (dotenv) com padrões seguros.
export function getConfig() {
  return {
    appName: process.env.APP_NAME || 'Vessie AI',
    provider: process.env.AI_PROVIDER || 'gguf',
    model: process.env.AI_MODEL || 'LocalModel.gguf',
    systemPrompt: process.env.SYSTEM_PROMPT || '',

    // Geração
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
    ggufContextSize: parseInt(process.env.GGUF_CONTEXT_SIZE || '0'),
    ggufModelPath: process.env.GGUF_MODEL_PATH || '',
    ggufModelDir: process.env.GGUF_MODEL_DIR || '',
    lmStudioUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234',

    // Sistemas do core
    thinkMode: process.env.THINK_MODE || 'auto', // auto | manual | disabled
    spellCorrection: process.env.SPELL_CORRECTION === 'true',
    promptEnhancement: process.env.PROMPT_ENHANCEMENT === 'true',
    memoryEnabled: process.env.MEMORY_ENABLED === 'true',
    memoryFile: process.env.MEMORY_FILE || './vessieai-core/memory/Memory.md',
    emotionSystem: process.env.EMOTION_SYSTEM === 'true',
    shareThinking: process.env.SHARE_THINKING_ENABLED === 'true',
    shareThinkingFile: process.env.SHARE_THINKING_FILE || './vessieai-core/sharing/Share-Thinking.md',
    adaptivePrompt: process.env.ADAPTIVE_SYSTEM_PROMPT === 'true',
    webSearch: process.env.WEB_SEARCH_ENABLED === 'true',
    agentLoop: process.env.AGENT_LOOP_ENABLED === 'true',
    agentLoopMaxCycles: parseInt(process.env.AGENT_LOOP_MAX_CYCLES || '5'),
    agentLoopMaxRetries: parseInt(process.env.AGENT_LOOP_MAX_RETRIES || '3'),
    lifeFile: process.env.LIFE_FILE || './vessieai-core/personality/Life.md',

    // Tags system
    tagsEnabled: process.env.TAGS_ENABLED !== 'false',
    tagMode: process.env.TAG_MODE || 'auto', // auto | manual | off

    // Segurança DM-only
    dmOnly: process.env.DM_ONLY === 'true',
    dmToken: process.env.DM_TOKEN || '',
    storageKey: process.env.VESSIE_STORAGE_KEY || '',

    // Cache / compressão
    cacheEnabled: process.env.RESPONSE_CACHE_ENABLED !== 'false',
    cacheSize: parseInt(process.env.RESPONSE_CACHE_SIZE || '100'),
    cacheVariants: parseInt(process.env.CACHE_VARIANTS || '10'),

    // Multi-agente
    multiAgents: process.env.MULTI_AGENTS === 'true',
    lmStudioModels: process.env.LM_STUDIO_MODELS || '',

    // MCP
    mcpEnabled: process.env.MCP_ENABLED === 'true',
    mcpConfig: process.env.MCP_CONFIG || './vessieai-core/config/mcp-servers.json',

    // Auto-evolução
    forceAllModule: process.env.FORCE_ALL_MODULE === 'true',
    autoSustain: process.env.AUTO_SUSTAIN === 'true',
    autoSustainMs: parseInt(process.env.AUTO_SUSTAIN_MS || '3600000'),

    // Servidor
    port: parseInt(process.env.PORT || '3000'),
  };
}

export const CONFIG = getConfig();
