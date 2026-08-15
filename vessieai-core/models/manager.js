const { OpenAICompatibleProvider } = require('./provider');
const { GgufProvider } = require('../providers/ggufProvider');
const { HybridProvider } = require('../providers/hybridProvider');
class ModelManager {
  constructor(config, logger) { this.config = config; this.logger = logger; this.providers = new Map(); this.registerLMStudio(); this.gguf = new GgufProvider(); this.hybrid = new HybridProvider(config, logger, this.providers.get('lmstudio'), this.gguf); this.providers.set('gguf', this.gguf); this.providers.set('hybrid', this.hybrid); }
  registerLMStudio() { this.providers.set('lmstudio', new OpenAICompatibleProvider(this.config, this.logger)); }
  async list() { const out = []; for (const [name, provider] of this.providers) { if (name === 'hybrid') continue; try { if (name === 'gguf') { out.push(provider.statusJSON()); continue; } const data = await provider.listModels(); for (const model of (data.data || [])) out.push({ provider: name, id: model.id, owned_by: model.owned_by }); } catch (error) { out.push({ provider: name, error: error.message }); } } return out; }
  get(name = 'hybrid') { const provider = this.providers.get(name) || this.hybrid; return provider; }
  async init() { return this.hybrid.init(); }
  async chat(messages, opts = {}) { return this.get(opts.provider || 'hybrid').chat(messages, opts); }
  stream(messages, opts = {}) { return this.get(opts.provider || 'hybrid').stream(messages, opts); }
  status() { return this.hybrid.statusJSON(); }
}
module.exports = { ModelManager };
