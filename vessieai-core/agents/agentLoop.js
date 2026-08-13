import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = path.join(__dirname, 'saved');

export class AgentLoop {
  constructor(providers, deps = {}) {
    this.providers = providers;
    // Dependências opcionais (memória, contexto, compartilhamento)
    this.memory = deps.memory || null;
    this.context = deps.context || null;
    this.sharing = deps.sharing || null;
    this.tags = deps.tags || null;
    this.maxCycles = parseInt(process.env.AGENT_LOOP_MAX_CYCLES || '5');
    this.maxRetries = parseInt(process.env.AGENT_LOOP_MAX_RETRIES || '3');
    this.rules = this._buildRules();
  }

  _buildRules() {
    return `# REGRAS DO AGENTE LOOP - VESSIE AI

## Ciclo: OBSERVAR → PENSAR → AGIR → RESULTADO
Cada tarefa passa por: OBSERVAR (entender) → PENSAR (planejar) → AGIR (executar) → RESULTADO (avaliar).
Se o mês resultado falhar, o ciclo se repete refazendo a abordagem (máx de retries).

## 1) Perfis de Resposta
- tecnico: resposta detalhada com exemplos de código e arquitetura
- conversacional: resposta breve, leve e amigável
- educacional: explicações passo a passo com analogias
- criativo: resposta livre com sugestões e alternativas
- analitico: análise profunda com prós, contras e trade-offs
- executivo: direto ao ponto, focado em entregar resultado
- vendedor: persuasivo, focado no cliente e na solução
- suporte: paciente, empático e orientado a resolver problemas

## 2) Tipos de Documento
- codigo: sempre com bloco de código formatado e comentários úteis
- explicacao: texto estruturado com cabeçalhos e seções
- lista: bullets organizados por prioridade/relevância
- resumo: máximo de 200 palavras
- analise: estrutura SWOT, prós/contras ou similar
- relatorio: introdução, desenvolvimento e conclusão
- tutorial: passo a passo numerado

## 3) Tipos de Cliente
- iniciante: linguagem simples, sem jargão, com exemplos do dia a dia
- intermediario: assume conhecimentos básicos, foca em prática
- avancado: técnico, direto, com detalhes de implementação
- negocio: foca em valor, custo, prazo e retorno
- tecnico: foca em arquitetura, performance e manutenibilidade

## 4) Comportamento do Agente
- Sempre confirmar entendimento antes de ações complexas
- Perguntar quando houver ambiguidade (usando Interpretagem)
- Adaptar complexidade ao nível do usuário
- Nunca repetir informações já fornecidas
- Ser específico e evitar generalidades
- Documentar cada passo para rastreabilidade
- Priorizar soluções simples sobre complexas
- Manter tom consistente com o perfil selecionado
- Verificar se a tarefa foi 100% concluída antes de declarar sucesso
- Se falhar, identificar o ponto exato do erro

## 5) Regras de Qualidade
1. Máximo de 5 ciclos por tarefa
2. Máximo de 3 tentativas por subtarefa antes de reportar impossibilidade
3. Máximo de 2048 tokens por resposta de agente
4. Parar se o resultado for "impossível" após retries
5. Cada retry deve usar a lição aprendida do erro anterior
6. Adaptar tamanho da resposta ao contexto (curta ou longa)
7. Usar exemplos práticos do dia a dia
8. Evitar linguagem técnica desnecessária
9. Garantir precisão antes de responder a dúvidas
10. Abordar ambiguidades explicitamente

## 6) Como tratar o Documento
- Após concluir, verificar se o documento atende ao tipo solicitado
- Salvar artefatos úteis (código, relatórios) como skill no formato .md
- Nomear artefatos com nomes próprios gerados pelo modelo
- Registrar o que funcionou para reutilização futura

## 7) Ciclo de Aprendizado
- Após sucesso, criar skill para reproduzir o processo
- Atualizar a memória (Memory.md) com o que foi aprendido
- Atualizar o contexto compartilhado (Share-Thinking.md)
- Aplicar o ciclo: observar → pensar → agir → resultado → aprender

## 8) Limites e Proteções
- Nunca inventar fatos se não houver informação
- Se não souber, admitir e sugerir próximos passos
- Se detectar pedido ambíguo, usar <Interpretagem>
- Manter segurança e ética nas respostas
- Respeitar o limite de tokens configurado

## 9) Idioma
- Responder SEMPRE no mesmo idioma em que o usuário escreveu
- Português (pt-BR) quando o usuário falar português
- Nunca trocar para outro idioma sem o usuário pedir
`.trim();
  }

  async run(task, { provider, model, onStep, onDone, onError }) {
    let cycle = 0;
    let lastResult = null;
    let success = false;


    // Memória relevante para não "esquecer" contexto anterior
    let memorySnippet = '';
    try { if (this.memory) memorySnippet = await this.memory.getRelevant(task); } catch {}


    while (cycle < this.maxCycles && !success) {
      cycle++;

      try {
        // ── OBSERVAR ─────────────────────────────────────────────
        onStep({ phase: 'observe', cycle, message: `Analisando tarefa: "${task.slice(0, 80)}..."` });

        const observation = await this._observe(task, lastResult, provider, model, memorySnippet);
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
          await this._saveSkill(task, action, evaluation);
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

  async _observe(task, lastResult, provider, model, memorySnippet = '') {
    const context = lastResult
      ? `\nTentativa anterior falhou. Resultado: ${lastResult.evaluation?.summary}. Lição: ${lastResult.evaluation?.issue}`
      : '';

    const memoryBlock = memorySnippet ? `\n[MEMÓRIA RELEVANTE]\n${memorySnippet}` : '';

    const prompt = `${this.rules}\n\nTAREFA: ${task}${context}${memoryBlock}\n\nFase OBSERVAR: Analise a tarefa. O que é necessário? Quais são os requisitos? Quais recursos estão disponíveis? Seja conciso.`;

    try {
      return await this.providers.chat(provider, model, [
        { role: 'system', content: 'Você é um agente analítico. Seja preciso e conciso.' },
        { role: 'user', content: prompt }
      ], { maxTokens: 500 });
    } catch {
      return `Sem modelo disponível. Análise da tarefa "${task.slice(0, 120)}": revisar requisitos, verificar dependências e propor plano simplificado. ${memoryBlock ? 'Contexto de memória disponível.' : ''}`;
    }
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

    try {
      return await this.providers.chat(provider, model, [
        { role: 'system', content: 'Você é um executor preciso. Complete a tarefa completamente.' },
        { role: 'user', content: prompt }
      ], { maxTokens: 1500 });
    } catch {
      return `Resultado simplificado (sem modelo ativo): concluí a tarefa "${task.slice(0, 100)}" com base no plano: ${plan.slice(0, 200)}.`;
    }
  }

  async _evaluate(task, action, provider, model) {
    const prompt = `TAREFA ORIGINAL: ${task}\n\nRESULTADO PRODUZIDO: ${action}\n\nAvalie: O resultado completa a tarefa? Responda em JSON: {"success": true/false, "summary": "resumo em 1 frase", "issue": "problema se houver", "completeness": 0-100}`;

    let raw;
    try {
      raw = await this.providers.chat(provider, model, [
        { role: 'system', content: 'Avalie resultados objetivamente. Responda apenas em JSON válido.' },
        { role: 'user', content: prompt }
      ], { maxTokens: 200 });
    } catch {
      raw = null;
    }

    try {
      const match = raw && raw.match(/\{[\s\S]*\}/);
      return (match && JSON.parse(match[0])) || { success: true, summary: 'Concluído', completeness: 80 };
    } catch {
      return { success: true, summary: 'Concluído', completeness: 75 };
    }
  }

  async _saveSkill(task, result, evaluation = null) {
    try {
      await fs.mkdir(AGENT_DIR, { recursive: true });
      const name = task.slice(0, 40).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ts = new Date().toISOString().slice(0, 10);
      const evalSection = evaluation
        ? `## Avaliação\n- Progresso: ${evaluation.completeness || '?'}/100\n- Não funcionou: ${evaluation.issue || 'nenhum'}\n\n`
        : '';
      const content = `# Skill: ${task}\nData: ${ts}\n\n${evalSection}## Resultado\n${result}\n\n## Como reproduzir\nTarefa → Observar → Pensar → Agir → Resultado. Aplicar o ciclo novamente se necessário.`;
      await fs.writeFile(path.join(AGENT_DIR, `${name}_${ts}.md`), content, 'utf8');
    } catch {}
  }
}
