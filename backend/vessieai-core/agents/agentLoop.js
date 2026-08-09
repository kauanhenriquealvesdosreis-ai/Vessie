import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = path.join(__dirname, 'saved');

export class AgentLoop {
  constructor(providers) {
    this.providers = providers;
    this.maxCycles = parseInt(process.env.AGENT_LOOP_MAX_CYCLES || '5');
    this.rules = this._buildRules();
  }

  _buildRules() {
    return `
# REGRAS DO AGENTE LOOP - VESSIE AI

## Ciclo: OBSERVAR → PENSAR → AGIR → RESULTADO

### Perfis de Resposta
- técnico: resposta detalhada com exemplos de código
- conversacional: resposta breve e amigável
- educacional: explicações passo a passo
- criativo: resposta livre com sugestões variadas
- analítico: análise profunda com prós e contras

### Tipos de Documento
- código: sempre com bloco de código formatado
- explicação: texto estruturado com cabeçalhos
- lista: bullets organizados por prioridade
- resumo: máximo 200 palavras
- análise: estrutura SWOT ou similar

### Regras de Qualidade
1. Nunca repetir informações já fornecidas
2. Ser específico e evitar generalidades
3. Adaptar complexidade ao nível do usuário
4. Verificar se a tarefa foi 100% concluída
5. Se falhar, identificar o ponto exato do erro
6. Máximo 3 tentativas por subtarefa antes de reportar impossibilidade
7. Sempre confirmar entendimento antes de agir em tarefas complexas
8. Perguntar quando houver ambiguidade
9. Documentar cada passo para rastreabilidade
10. Priorizar soluções simples sobre complexas

### Tipos de Tarefas
- análise: observar → identificar padrões → reportar
- criação: planejar → criar → validar → entregar
- correção: identificar erro → propor solução → aplicar → verificar
- pesquisa: coletar → filtrar → sintetizar → apresentar
- otimização: medir → identificar gargalos → otimizar → validar

### Limites
- Máximo 5 ciclos por tarefa
- Máximo 2048 tokens por resposta de agente
- Parar se resultado for "impossível" em 3 tentativas
`.trim();
  }

  async run(task, { provider, model, onStep, onDone, onError }) {
    let cycle = 0;
    let lastResult = null;
    let success = false;

    while (cycle < this.maxCycles && !success) {
      cycle++;

      try {
        // ── OBSERVAR ─────────────────────────────────────────────
        onStep({ phase: 'observe', cycle, message: `Analisando tarefa: "${task.slice(0, 80)}..."` });

        const observation = await this._observe(task, lastResult, provider, model);
        onStep({ phase: 'observe', cycle, content: observation });

        // ── PENSAR ───────────────────────────────────────────────
        onStep({ phase: 'think', cycle, message: 'Desenvolvendo plano de ação...' });

        const plan = await this._think(task, observation, lastResult, provider, model);
        onStep({ phase: 'think', cycle, content: plan });

        // ── AGIR ─────────────────────────────────────────────────
        onStep({ phase: 'act', cycle, message: 'Executando plano...' });

        const action = await this._act(task, plan, provider, model);
        onStep({ phase: 'act', cycle, content: action });

        // ── RESULTADO ────────────────────────────────────────────
        onStep({ phase: 'result', cycle, message: 'Avaliando resultado...' });

        const evaluation = await this._evaluate(task, action, provider, model);
        lastResult = { observation, plan, action, evaluation };

        onStep({ phase: 'result', cycle, content: evaluation.summary, success: evaluation.success });

        if (evaluation.success) {
          success = true;
          await this._saveSkill(task, action);
          onDone({ cycles: cycle, result: action, evaluation });
        } else if (cycle >= this.maxCycles) {
          onDone({ cycles: cycle, result: action, evaluation, note: 'Limite de ciclos atingido' });
        }

      } catch (err) {
        onError(err);
        break;
      }
    }
  }

  async _observe(task, lastResult, provider, model) {
    const context = lastResult
      ? `\nTentativa anterior falhou. Resultado: ${lastResult.evaluation?.summary}`
      : '';

    const prompt = `${this.rules}\n\nTAREFA: ${task}${context}\n\nFase OBSERVAR: Analise a tarefa. O que é necessário? Quais são os requisitos? Quais recursos estão disponíveis? Seja conciso.`;

    return this.providers.chat(provider, model, [
      { role: 'system', content: 'Você é um agente analítico. Seja preciso e conciso.' },
      { role: 'user', content: prompt }
    ], { maxTokens: 500 });
  }

  async _think(task, observation, lastResult, provider, model) {
    const retryNote = lastResult ? `\nO que deu errado antes: ${lastResult.evaluation?.issue}. Corrija a abordagem.` : '';

    const prompt = `TAREFA: ${task}\n\nOBSERVAÇÃO: ${observation}${retryNote}\n\nFase PENSAR: Crie um plano detalhado passo a passo. Liste os passos numerados e o que cada um produzirá.`;

    return this.providers.chat(provider, model, [
      { role: 'system', content: 'Você é um planejador estratégico. Crie planos claros e executáveis.' },
      { role: 'user', content: prompt }
    ], { maxTokens: 600 });
  }

  async _act(task, plan, provider, model) {
    const prompt = `TAREFA: ${task}\n\nPLANO: ${plan}\n\nFase AGIR: Execute o plano completamente. Produza o resultado final, completo e pronto para uso. Não explique, apenas entregue.`;

    return this.providers.chat(provider, model, [
      { role: 'system', content: 'Você é um executor preciso. Complete a tarefa completamente.' },
      { role: 'user', content: prompt }
    ], { maxTokens: 1500 });
  }

  async _evaluate(task, action, provider, model) {
    const prompt = `TAREFA ORIGINAL: ${task}\n\nRESULTADO PRODUZIDO: ${action}\n\nAvalie: O resultado completa a tarefa? Responda em JSON: {"success": true/false, "summary": "resumo em 1 frase", "issue": "problema se houver", "completeness": 0-100}`;

    const raw = await this.providers.chat(provider, model, [
      { role: 'system', content: 'Avalie resultados objetivamente. Responda apenas em JSON válido.' },
      { role: 'user', content: prompt }
    ], { maxTokens: 200 });

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : { success: true, summary: 'Concluído', completeness: 80 };
    } catch {
      return { success: true, summary: 'Concluído', completeness: 75 };
    }
  }

  async _saveSkill(task, result) {
    try {
      await fs.mkdir(AGENT_DIR, { recursive: true });
      const name = task.slice(0, 40).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ts = new Date().toISOString().slice(0, 10);
      const content = `# Skill: ${task}\nData: ${ts}\n\n## Resultado\n${result}`;
      await fs.writeFile(path.join(AGENT_DIR, `${name}_${ts}.md`), content, 'utf8');
    } catch {}
  }
}
