import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { GgufProvider } from './ggufProvider.js';

export class ProviderManager {
  constructor() {
    this.activeProvider = process.env.AI_PROVIDER || 'gguf';
    this.activeModel = process.env.AI_MODEL || 'LocalModel.gguf';
    this.clients = {};
    this.gguf = new GgufProvider();
    this._initClients();
  }

  _initClients() {
    // LM Studio (OpenAI-compatible)
    this.clients.lmstudio = new OpenAI({
      baseURL: `${process.env.LM_STUDIO_URL || 'http://localhost:1234'}/v1`,
      apiKey: 'lm-studio',
    });

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.clients.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      });
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.clients.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Resolve o provedor a ser usado.
   * Se o chamador não pedir um provedor específico, prefere o GGUF local
   * quando estiver disponível e cai para LM Studio caso contrário.
   */
  resolveProvider(requested) {
    if (requested && requested !== 'auto') return requested;
    if (this.gguf.ready) return 'gguf';
    return 'lmstudio';
  }

  setActive(provider, model) {
    this.activeProvider = provider;
    this.activeModel = model;
    process.env.AI_PROVIDER = provider;
    process.env.AI_MODEL = model;
    this._initClients();
  }

  getConfigured() {
    return {
      gguf: { name: this.gguf.label, ready: this.gguf.ready, status: this.gguf.status, message: this.gguf.message, active: this.resolveProvider(this.activeProvider) === 'gguf' },
      lmstudio: { name: 'LM Studio', url: process.env.LM_STUDIO_URL, active: this.activeProvider === 'lmstudio' },
      openai: { name: 'OpenAI', configured: !!process.env.OPENAI_API_KEY, active: this.activeProvider === 'openai' },
      anthropic: { name: 'Anthropic (Claude)', configured: !!process.env.ANTHROPIC_API_KEY, active: this.activeProvider === 'anthropic' },
    };
  }

  async listModels() {
    const all = [];

    // GGUF local
    if (this.gguf.ready) {
      all.push({
        id: this.gguf.info?.name || 'LocalModel.gguf',
        provider: 'gguf',
        name: `${this.gguf.info?.name} (${this.gguf.info?.size})`,
      });
    }

    // LM Studio
    try {
      const res = await fetch(`${process.env.LM_STUDIO_URL || 'http://localhost:1234'}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        (data.data || []).forEach(m => all.push({ id: m.id, provider: 'lmstudio', name: m.id }));
      }
    } catch {}

    // OpenAI
    if (this.clients.openai) {
      try {
        const models = await this.clients.openai.models.list();
        const useful = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        useful.forEach(id => all.push({ id, provider: 'openai', name: id }));
      } catch {}
    }

    // Anthropic
    if (this.clients.anthropic) {
      ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001'].forEach(id =>
        all.push({ id, provider: 'anthropic', name: id })
      );
    }

    return all;
  }

  async streamChat(provider, model, messages, options = {}, onChunk) {
    const p = this.resolveProvider(provider || this.activeProvider);
    const m = model || this.activeModel;
    const temp = options.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7');
    const maxTokens = options.maxTokens ?? parseInt(process.env.AI_MAX_TOKENS || '2048');

    if (p === 'gguf') {
      await this.gguf.streamChat(messages, { ...options, temperature: temp, maxTokens }, onChunk);
      return;
    }

    if (p === 'anthropic' && this.clients.anthropic) {
      const sysMsg = messages.find(m => m.role === 'system');
      const convMsgs = messages.filter(m => m.role !== 'system');
      const stream = await this.clients.anthropic.messages.stream({
        model: m,
        max_tokens: maxTokens,
        system: sysMsg?.content,
        messages: convMsgs,
        temperature: temp,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          onChunk(event.delta.text);
        }
      }
      return;
    }

    // OpenAI-compatible (lmstudio + openai)
    const client = this.clients[p] || this.clients.lmstudio;
    const stream = await client.chat.completions.create({
      model: m,
      messages,
      temperature: temp,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onChunk(delta);
    }
  }

  async chat(provider, model, messages, options = {}) {
    const p = this.resolveProvider(provider || this.activeProvider);
    const m = model || this.activeModel;
    const temp = options.temperature ?? parseFloat(process.env.AI_TEMPERATURE || '0.7');
    const maxTokens = options.maxTokens ?? parseInt(process.env.AI_MAX_TOKENS || '2048');

    if (p === 'gguf') {
      return this.gguf.chat(messages, { ...options, temperature: temp, maxTokens });
    }

    if (p === 'anthropic' && this.clients.anthropic) {
      const sysMsg = messages.find(msg => msg.role === 'system');
      const convMsgs = messages.filter(msg => msg.role !== 'system');
      const resp = await this.clients.anthropic.messages.create({
        model: m,
        max_tokens: maxTokens,
        system: sysMsg?.content,
        messages: convMsgs,
        temperature: temp,
      });
      return resp.content[0]?.text || '';
    }

    const client = this.clients[p] || this.clients.lmstudio;
    const resp = await client.chat.completions.create({
      model: m,
      messages,
      temperature: temp,
      max_tokens: maxTokens,
    });
    return resp.choices[0]?.message?.content || '';
  }
}
