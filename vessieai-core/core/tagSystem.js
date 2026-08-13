// ─────────────────────────────────────────────────────────────────────────────
//  TAG SYSTEM — Vessie AI Core
//  Sistema de interpretação de tags: <Think>, <Code>, <Interpretagem>.
//  - <Think>        : força a IA a "pensar" antes de responder (manual ou auto).
//  - <Code>         : interpreta e gera código mais complexo / completa o código.
//  - <Interpretagem>: pede esclarecimento quando faltam informações essenciais.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAGS_DIR = path.join(__dirname, '..', 'sources');

export class TagSystem {
  constructor(providers) {
    this.providers = providers;
    this.mode = process.env.TAG_MODE || 'auto';
    this.enabled = process.env.TAGS_ENABLED !== 'false';
  }

  buildTagInstructions() {
    if (!this.enabled) return '';
    const mode = this.mode;
    return `
[PROTOCOLO DE TAGS — VESSIE AI]
Você DEVE interpretar e responder usando as seguintes tags quando aplicável:

1) <Think> ... </Think>
   - Use ANTES de responder a uma pergunta complexa (código, sistemas, planejamento).
   - Dentro dela, aprimore o prompt do usuário e pense em alternativas, em 1ª pessoa.
   - Modo: ${mode}. ${mode === 'manual' ? 'Você DEVE sempre produzir <Think> antes da resposta.' : 'Produza apenas para tarefas complexas.'}

2) <Code> ... </Code>
   - Use para interpretar pedidos de código e gerar implementações completas.
   - Dentro desse bloco, produza código completo, funcional e bem estruturado.

3) <Interpretagem> ... </Interpretagem>
   - USE SOMENTE quando houver informações INSUFICIENTES e essenciais.
   - Exemplo: "crie em nodejs e python" → peça para especificar UMA linguagem.
   - NUNCA use para perguntas simples ou quando já há contexto suficiente.
`.trim();
  }

  /**
   * Analisa o texto de resposta e extrai tags para processamento.
   */
  parse(content) {
    const out = { text: content };
    const think = content.match(/<Think>([\s\S]*?)<\/Think>/);
    const code = content.match(/<Code>([\s\S]*?)<\/Code>/);
    const interp = content.match(/<Interpretagem>([\s\S]*?)<\/Interpretagem>/);
    if (think) { out.think = think[1].trim(); out.text = out.text.replace(/<Think>[\s\S]*?<\/Think>/g, ''); }
    if (code) { out.code = code[1].trim(); out.text = out.text.replace(/<Code>[\s\S]*?<\/Code>/g, ''); }
    if (interp) { out.interpret = interp[1].trim(); out.text = out.text.replace(/<Interpretagem>[\s\S]*?<\/Interpretagem>/g, ''); }
    return out;
  }

  /**
   * Gerencia <Interpretagem>: detecta ambiguidades e gera questionário.
   */
  async interpret(prompt) {
    if (!this.enabled || this.mode === 'off') return null;
    const languages = ['node', 'nodejs', 'javascript', 'python', 'java', 'c#', 'php', 'go', 'rust', 'typescript', 'react'];
    const found = languages.filter(l => prompt.toLowerCase().includes(l));
    const conflicts = [
      ['javascript', 'python'], ['nodejs', 'python'], ['node', 'python'],
      ['javascript', 'java'], ['python', 'java'], ['typescript', 'python'],
    ];
    const conflicting = conflicts.some(([a, b]) => found.includes(a) && found.includes(b));
    if (prompt.length > 8 && !conflicting) return null;

    try {
      const questions = await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Gere perguntas de esclarecimento em JSON. Retorne apenas JSON válido: [{"question":"...","type":"text|choice","options":[...]}]'
        }, {
          role: 'user',
          content: `A tarefa "${prompt}" está ambígua ou incompleta. Gere 3 a 5 perguntas para definir o foco.`
        }], { maxTokens: 400 }
      );
      const match = questions.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : this._defaultQuestions(prompt, conflicting);
    } catch {
      return this._defaultQuestions(prompt, conflicting);
    }
  }

  _defaultQuestions(prompt, conflicting) {
    const base = [
      { question: 'Qual é o objetivo principal desta tarefa?', type: 'text' },
      { question: 'Qual é o público-alvo ou usuário final?', type: 'text' },
      { question: 'Qual é o prazo esperado?', type: 'choice', options: ['Urgente', 'Esta semana', 'Este mês', 'Sem prazo'] },
    ];
    if (conflicting) {
      base.unshift({ question: 'Você mencionou mais de uma linguagem. Qual deseja usar?', type: 'choice', options: ['JavaScript/Node', 'Python', 'Java', 'C#', 'PHP', 'Go', 'TypeScript/React', 'Rust'] });
    }
    return base;
  }

  async saveVariant(name, content, tags = []) {
    await fs.mkdir(TAGS_DIR, { recursive: true });
    const slug = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const doc = `# Tag Variant: ${name}\nTags: ${tags.join(', ')}\nData: ${new Date().toISOString().slice(0, 10)}\n\n${content}\n`;
    await fs.writeFile(path.join(TAGS_DIR, `${slug}.md`), doc, 'utf8');
    return slug;
  }
}
