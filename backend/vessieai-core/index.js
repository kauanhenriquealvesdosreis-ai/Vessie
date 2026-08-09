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
    this.agentLoop = new AgentLoop(this.providers);

    await Promise.all([
      this.memory.init(),
      this.personality.init(),
      this.skills.init(),
      this.context.init(),
      this.sharing.init(),
      this.codeEngine.init(),
    ]);

    console.log('[VessieCore] ✓ Todos os sistemas prontos');
    console.log(`[VessieCore] ✓ Provider: ${process.env.AI_PROVIDER}`);
    console.log(`[VessieCore] ✓ Modelo: ${process.env.AI_MODEL}`);
    console.log(`[VessieCore] ✓ Emoções: ${process.env.EMOTION_SYSTEM === 'true' ? 'ON' : 'OFF'}`);
    console.log(`[VessieCore] ✓ Memória: ${process.env.MEMORY_ENABLED === 'true' ? 'ON' : 'OFF'}`);
    console.log(`[VessieCore] ✓ Thinking: ${process.env.THINK_MODE}`);
  }
}
