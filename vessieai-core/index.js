import { ProviderManager } from './providers/index.js';
import { AgentLoop } from './agents/agentLoop.js';
import { MemoryManager } from './memory/memoryManager.js';
import { EmotionEngine } from './personality/emotionEngine.js';
import { ThinkingEngine } from './thinking/thinkingEngine.js';
import { SkillManager } from './skills/skillManager.js';
import { ContextEngine } from './context/contextEngine.js';
import { ShareThinking } from './sharing/shareThinking.js';
import { WebSearch } from './search/webSearch.js';
import { ProjectManager } from './projects/projectManager.js';
import { CodeEngine } from './coding/codeEngine.js';
import { DubbingEngine } from './dubbing/dubbingEngine.js';
import { TagSystem } from './core/tagSystem.js';
import { TokenCompressor } from './compression/tokenCompressor.js';
import { ResponseCache } from './cache/responseCache.js';
import { SecureStorage } from './storage/secureStorage.js';
import { McpManager } from './mcp/mcpManager.js';
import { MultiAgentManager } from './managers/multiAgentManager.js';
import { AutoEvolution } from './automation/autoEvolution.js';
import { PatchManager } from './patches/patchManager.js';

export class VessieCore {
  constructor() {
    this.providers = new ProviderManager();
    this.agentLoop = null;
    this.memory = null;
    this.personality = null;
    this.thinking = null;
    this.skills = null;
    this.context = null;
    this.sharing = null;
    this.search = null;
    this.projects = null;
    this.codeEngine = null;
    this.dubbing = new DubbingEngine();
    this.tags = null;
    this.compressor = null;
    this.cache = null;
    this.storage = null;
    this.mcp = null;
    this.multiAgent = null;
    this.autoEvolution = null;
    this.patches = null;
  }

  async init() {
    console.log('[VessieCore] Inicializando sistemas...');

    this.search = new WebSearch();
    this.thinking = new ThinkingEngine(this.providers);
    this.memory = new MemoryManager(this.providers);
    this.personality = new EmotionEngine(this.providers);
    this.skills = new SkillManager();
    this.context = new ContextEngine(this.providers);
    this.sharing = new ShareThinking(this.providers);
    this.projects = new ProjectManager();
    this.codeEngine = new CodeEngine(this.providers, this.search);
    this.tags = new TagSystem(this.providers);
    this.compressor = new TokenCompressor();
    this.cache = new ResponseCache();
    this.storage = new SecureStorage();
    this.mcp = new McpManager();
    this.multiAgent = new MultiAgentManager(this.providers);
    this.autoEvolution = new AutoEvolution(this.providers);
    this.patches = new PatchManager(this.providers);

    // AgentLoop com dependências (memória, compartilhamento, tags)
    this.agentLoop = new AgentLoop(this.providers, {
      memory: this.memory,
      context: this.context,
      sharing: this.sharing,
      tags: this.tags,
    });

    await Promise.all([
      this.memory.init(),
      this.personality.init(),
      this.skills.init(),
      this.context.init(),
      this.sharing.init(),
      this.codeEngine.init(),
      this.autoEvolution.init(),
      this.patches.init(),
      this.dubbing.languages().catch(() => {}),
    ]);

    // Conecta servidores MCP configurados (não bloqueia se não houver)
    this.mcp.connectAll().catch(() => {});

    // Auto-sustentação (fundo) quando habilitado
    if (process.env.AUTO_SUSTAIN === 'true') this.autoEvolution.scheduleAutoSustain();

    console.log('[VessieCore] ✓ Todos os sistemas prontos');
    console.log(`[VessieCore] ✓ Provider: ${process.env.AI_PROVIDER}`);
    console.log(`[VessieCore] ✓ Modelo: ${process.env.AI_MODEL}`);
    console.log(`[VessieCore] ✓ Emoções: ${process.env.EMOTION_SYSTEM === 'true' ? 'ON' : 'OFF'}`);
    console.log(`[VessieCore] ✓ Memória: ${process.env.MEMORY_ENABLED === 'true' ? 'ON' : 'OFF'}`);
    console.log(`[VessieCore] ✓ Thinking: ${process.env.THINK_MODE}`);
    console.log(`[VessieCore] ✓ Tags: ${process.env.TAGS_ENABLED !== 'false' ? 'ON' : 'OFF'}`);
    console.log(`[VessieCore] ✓ MCP: ${this.mcp.servers.length} servidor(es)`);
    console.log(`[VessieCore] ✓ DM-only: ${process.env.DM_ONLY === 'true' ? 'SEGURO' : 'OFF'}`);
  }
}
