// ─────────────────────────────────────────────────────────────────────────────
//  MCP MANAGER — Vessie AI Core (mcp/)
//  Conecta a servidores MCP (Model Context Protocol) e integra suas
//  ferramentas (tools), recursos (resources) e prompts na IA.
//  Configuração por JSON: mcp-servers.json (Cline/Copilot compatible).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_CONFIG_PATH = path.join(__dirname, '..', 'config', 'mcp-servers.json');

export class McpManager {
  constructor() {
    this.servers = [];
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.config = [];
  }

  async _loadConfig() {
    try {
      const raw = await fs.readFile(MCP_CONFIG_PATH, 'utf8');
      this.config = JSON.parse(raw);
    } catch {
      this.config = [];
    }
  }

  async connectAll() {
    await this._loadConfig();
    const results = [];
    for (const svc of this.config || []) results.push(await this.connect(svc));
    return results;
  }

  async connect(svc) {
    try {
      if (svc.type === 'stdio' && svc.command) {
        const child = spawn(svc.command, svc.args || [], { stdio: ['pipe', 'pipe', 'pipe'] });
        const server = { name: svc.name || svc.command, type: 'stdio', child, connected: true };
        this.servers.push(server);
        this._listenStdio(server);
        return { name: server.name, connected: true };
      }
      if (svc.url || svc.type === 'sse') {
        const server = { name: svc.name || svc.url, type: 'sse', url: svc.url, connected: true };
        this.servers.push(server);
        return { name: server.name, connected: true };
      }
      return { connected: false, error: 'Tipo não suportado' };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }
  _listenStdio(server) {
    server.child.stdout?.on('data', (buf) => {
      const lines = buf.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.result && (msg.result.tools || msg.result.resources || msg.result.prompts)) this._ingest(server, msg.result);
        } catch { /* não-JSON */ }
      }
    });
    server.child.stderr?.on('data', (b) => console.error(`[MCP:${server.name}]`, b.toString().slice(0, 160)));
  }

  _ingest(server, result) {
    if (Array.isArray(result.tools)) this.tools.push(...result.tools.map(t => ({ ...t, _server: server.name })));
    if (Array.isArray(result.resources)) this.resources.push(...result.resources.map(r => ({ ...r, _server: server.name })));
    if (Array.isArray(result.prompts)) this.prompts.push(...result.prompts.map(p => ({ ...p, _server: server.name })));
  }

  register(kind, item) {
    if (!item || !kind) return;
    if (kind === 'tools') this.tools.push(item);
    else if (kind === 'resources') this.resources.push(item);
    else if (kind === 'prompts') this.prompts.push(item);
  }

  async callTool(toolName, args) {
    for (const server of this.servers) {
      const tool = this.tools.find(t => t.name === toolName && t._server === server.name);
      if (!tool) continue;
      if (server.type === 'stdio' && server.child?.stdin) {
        const id = Math.floor(Math.random() * 1e9);
        const req = { jsonrpc: '2.0', id, method: 'tools/call', params: { name: toolName, arguments: args || {} } };
        server.child.stdin.write(JSON.stringify(req) + '\n');
        return new Promise((resolve) => {
          const onData = (buf) => {
            const line = buf.toString().trim();
            if (!line) return;
            try {
              const msg = JSON.parse(line);
              if (msg.id === id) {
                server.child.stdout?.removeListener('data', onData);
                resolve(msg.result || msg.error || {});
              }
            } catch { /* ignora */ }
          };
          server.child.stdout?.on('data', onData);
          setTimeout(() => { server.child.stdout?.removeListener('data', onData); resolve({ error: 'timeout' }); }, 15000);
        });
      }
      if (server.url) {
        const res = await fetch(server.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args || {} } }) });
        return await res.json().catch(() => ({}));
      }
    }
    return { error: `Ferramenta "${toolName}" não encontrada` };
  }

  selectRelevant(task, limit = 6) {
    const words = task.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const score = (list) => list.map(item => {
      const text = `${item.name || ''} ${item.description || ''} ${item.title || ''} ${item.summary || ''}`.toLowerCase();
      let s = 0;
      words.forEach(w => { if (text.includes(w)) s++; });
      return { item, score: s };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.item);
    return {
      tools: score(this.tools),
      resources: score(this.resources),
      prompts: score(this.prompts),
    };
  }

  async buildContext(task) {
    const rel = this.selectRelevant(task);
    const parts = [];
    if (rel.tools.length) parts.push('# Ferramentas disponíveis\n' + rel.tools.map(t => `- **${t.name}**: ${t.description || ''}`).join('\n'));
    if (rel.resources.length) parts.push('# Recursos\n' + rel.resources.map(r => `- **${r.uri || r.name}**: ${r.description || ''}`).join('\n'));
    if (rel.prompts.length) parts.push('# Prompts MCP\n' + rel.prompts.map(p => `- ${p.name}: ${p.description || ''}`).join('\n'));
    return parts.join('\n\n');
  }

  status() {
    return {
      servers: this.servers.map(s => ({ name: s.name, type: s.type, connected: s.connected })),
      tools: this.tools.length,
      resources: this.resources.length,
      prompts: this.prompts.length,
    };
  }
}
