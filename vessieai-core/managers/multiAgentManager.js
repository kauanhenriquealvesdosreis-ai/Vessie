// ─────────────────────────────────────────────────────────────────────────────
//  MULTI-AGENT MANAGER — Vessie AI Core (managers/)
//  Executa múltiplos agentes/modelos de IA em paralelo e compartilha contexto
//  entre eles (Share-Thinking). Permite rotear tarefas por especialidade e
//  combinar respostas de vários modelos do LM Studio.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARE_DIR = path.join(__dirname, '..', 'sharing');

export class MultiAgentManager {
  constructor(providers) {
    this.providers = providers;
    this.agents = [];
    // Cria um "roteador": mapeia tarefas a especialistas
    this.roles = {
      code: 'especialista em programação',
      explica: 'explicador didático',
      analisa: 'analista crítico',
      cria: 'criativo / design',
      pesquisa: 'pesquisador de informações',
      venda: 'vendedor / atendimento',
    };
  }

  /**
   * Registra um agente (modelo) para participar do time.
   */
  addAgent({ name, provider, model, role = 'geral' }) {
    const agent = { id: this.agents.length + 1, name: name || model || `agente-${this.agents.length + 1}`, provider: provider || process.env.AI_PROVIDER, model: model || process.env.AI_MODEL, role };
    this.agents.push(agent);
    return agent;
  }

  async listAgents() {
    return this.agents;
  }

  /**
   * Roteia a tarefa para o(s) agente(s) mais adequado(s) e coleta respostas.
   * Compartilha um briefing comum (share) para manter consistência.
   */
  async execute(task, { provider, model, onAgentDone } = {}) {
    if (this.agents.length === 0) {
      // Sem agentes registrados: cria padrão único com o modelo ativo
      this.addAgent({ name: 'VessieAI', provider, model, role: 'geral' });
    }

    const results = [];
    const share = await this._buildShare(task);

    for (const agent of this.agents) {
      const roleDesc = this.roles[agent.role] || 'assistente';
      const response = await this.providers.chat(
        agent.provider, agent.model,
        [
          { role: 'system', content: `Você é ${agent.name}, ${roleDesc}. ${share ? 'Contexto dos outros agentes:\n' + share : ''}` },
          { role: 'user', content: task }
        ],
        { maxTokens: 1500 }
      );
      results.push({ agent: agent.name, model: agent.model, role: agent.role, response });
      if (onAgentDone) onAgentDone({ agent: agent.name, response });
    }

    return results;
  }

  /**
   * Consolida as respostas de múltiplos agentes em uma resposta única final.
   */
  async consolidate(task, results) {
    const combined = results.map(r => `[${r.agent}] ${r.response}`).join('\n\n');
    return this.providers.chat(
      process.env.AI_PROVIDER, process.env.AI_MODEL,
      [
        { role: 'system', content: 'Você é o coordenador de um time de agentes de IA. Consolide as respostas dos especialistas em uma resposta final coerente, completa e sem redundâncias.' },
        { role: 'user', content: `Tarefa: ${task}\n\nRespostas dos especialistas:\n${combined.slice(0, 4000)}` }
      ],
      { maxTokens: 2000 }
    );
  }

  async _buildShare(task) {
    try {
      const p = path.join(SHARE_DIR, 'Share-Thinking.md');
      const content = await fs.readFile(p, 'utf8');
      return content.slice(0, 500);
    } catch { return ''; }
  }
}
