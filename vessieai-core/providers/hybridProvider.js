class HybridProvider {
  constructor(config, logger, lmstudio, gguf) { this.name = 'hybrid'; this.config = config; this.logger = logger; this.lmstudio = lmstudio; this.gguf = gguf; this.active = 'lmstudio'; }
  async init() { try { const response = await this.lmstudio.listModels(); if (response?.data) { this.active = 'lmstudio'; return this.statusJSON(); } } catch {} try { if (await this.gguf.init()) { this.active = 'gguf'; return this.statusJSON(); } } catch {} this.active = 'offline'; return this.statusJSON(); }
  async chat(messages, options = {}) { if (this.active === 'lmstudio') { try { return await this.lmstudio.chat(messages, options); } catch (error) { this.logger?.warn?.(`LM Studio indisponível: ${error.message}`); } } if (this.active !== 'gguf') await this.init(); if (this.active === 'gguf') return this.gguf.chat(messages, options); return 'O VessieAI está em modo offline de segurança. Posso organizar memória, personalidade e preparar scripts locais.'; }
  async *stream(messages, options = {}) { const answer = await this.chat(messages, options); yield answer; }
  statusJSON() { return { provider: this.name, active: this.active, lmstudio: this.lmstudio.statusJSON?.() || { provider: 'lmstudio' }, gguf: this.gguf.statusJSON(), offline: true }; }
}
module.exports = { HybridProvider };
