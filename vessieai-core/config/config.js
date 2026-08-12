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
    lifeFile: process.env.LIFE_FILE || './vessieai-core/personality/Life.md',

    // Servidor
    port: parseInt(process.env.PORT || '3000'),
  };
}

export const CONFIG = getConfig();
