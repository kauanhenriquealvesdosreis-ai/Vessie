import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_DIR = path.join(__dirname, 'saved');

export class ContextEngine {
  constructor(providers) {
    this.providers = providers;
  }

  async init() {
    await fs.mkdir(CONTEXT_DIR, { recursive: true });
  }

  async list() {
    try {
      const files = await fs.readdir(CONTEXT_DIR);
      return await Promise.all(
        files.filter(f => f.endsWith('.md')).map(async (f) => {
          const content = await fs.readFile(path.join(CONTEXT_DIR, f), 'utf8');
          const titleMatch = content.match(/^# (.+)/m);
          return { name: f.replace('.md', ''), title: titleMatch?.[1] || f, preview: content.slice(0, 150) };
        })
      );
    } catch { return []; }
  }

  async create(data) {
    const {
      projectName = 'Meu Projeto',
      audience = 'geral',
      objective = '',
      communication = 'amigável',
      topic = '',
      answers = {}
    } = data;

    const name = `${projectName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    const content = `# Contexto: ${projectName}
Data: ${new Date().toISOString().slice(0, 10)}

## Projeto
**Nome**: ${projectName}
**Objetivo**: ${objective}
**Tópico Principal**: ${topic}

## Público-Alvo
${audience}

## Forma de Comunicação
${communication}

## Respostas do Questionário
${Object.entries(answers).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}

## Diretrizes para o Agente
- Adaptar respostas para o público: ${audience}
- Manter tom: ${communication}
- Foco: ${objective}
- Sempre contextualizar dentro de: ${topic}
`;

    await fs.mkdir(CONTEXT_DIR, { recursive: true });
    await fs.writeFile(path.join(CONTEXT_DIR, `${name}.md`), content, 'utf8');
    return { name, content };
  }

  analyzeFocus(answers) {
    const topics = Object.values(answers).join(' ').toLowerCase();
    const patterns = {
      desenvolvimento: /código|programa|software|web|api|banco/,
      negócios: /vendas|cliente|produto|mercado|empresa/,
      educação: /aprender|ensinar|curso|aula|estudo/,
      criativo: /design|arte|escrever|criar|história/,
      análise: /dados|análise|relatório|métricas|kpi/,
    };

    const matched = Object.entries(patterns)
      .filter(([, re]) => re.test(topics))
      .map(([name]) => name);

    return {
      primaryFocus: matched[0] || 'geral',
      secondaryFocus: matched[1] || null,
      keywords: topics.split(/\s+/).filter(w => w.length > 4).slice(0, 10),
    };
  }
}
