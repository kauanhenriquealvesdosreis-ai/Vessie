import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CODEBASE_DIR = path.join(__dirname, '..', 'codebase');
const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

export class CodeEngine {
  constructor(providers, search) {
    this.providers = providers;
    this.search = search;
  }

  async init() {
    await fs.mkdir(CODEBASE_DIR, { recursive: true });
    await fs.mkdir(EXAMPLES_DIR, { recursive: true });
  }

  async generate({ prompt, language, framework, style = 'clean', includeTests = false }) {
    // Pesquisar melhores práticas
    let webContext = '';
    if (process.env.WEB_SEARCH_ENABLED === 'true' && this.search) {
      const searchResults = await this.search.query(`${language} ${framework} best practices ${prompt.slice(0, 40)}`, 3);
      webContext = this.search.summarizeResults(searchResults);
    }

    // Aprimorar prompt de código
    const enhancedPrompt = `
TAREFA: ${prompt}
LINGUAGEM: ${language || 'detectar automaticamente'}
FRAMEWORK: ${framework || 'nenhum específico'}
ESTILO: ${style}
TESTES: ${includeTests ? 'incluir testes' : 'não incluir'}

${webContext ? `MELHORES PRÁTICAS PESQUISADAS:\n${webContext}\n` : ''}

Gere código completo, funcional e bem estruturado. Use as melhores práticas. Inclua comentários apenas onde necessário.
`;

    const code = await this.providers.chat(
      process.env.AI_PROVIDER,
      process.env.AI_MODEL,
      [{
        role: 'system',
        content: `Você é um engenheiro de software sênior especialista em ${language || 'múltiplas linguagens'}. Gere código de alta qualidade.`
      }, {
        role: 'user',
        content: enhancedPrompt
      }],
      { maxTokens: 2000 }
    );

    // Detectar linguagem se não especificada
    const detectedLang = language || this._detectLanguage(code);

    // Gerar nome do arquivo
    const filename = await this._generateFilename(prompt, detectedLang);

    // Salvar no codebase
    await this._saveToCodebase(filename, code, { prompt, language: detectedLang, framework });

    return { code, language: detectedLang, filename };
  }

  async transformToPrompt(code) {
    return this.providers.chat(
      process.env.AI_PROVIDER,
      process.env.AI_MODEL,
      [{
        role: 'system',
        content: 'Transforme código em descrição em linguagem natural. Explique o que cada parte faz, não como funciona.'
      }, {
        role: 'user',
        content: `Transforme este código em uma descrição de intenção:\n\n${code}\n\nDescreva o que cada parte pretende fazer, em forma de prompt de alto nível.`
      }],
      { maxTokens: 800 }
    );
  }

  async editByLine(code, instructions) {
    return this.providers.chat(
      process.env.AI_PROVIDER,
      process.env.AI_MODEL,
      [{
        role: 'system',
        content: 'Edite o código seguindo as instruções. Retorne APENAS o código modificado, sem explicações.'
      }, {
        role: 'user',
        content: `CÓDIGO:\n\`\`\`\n${code}\n\`\`\`\n\nINSTRUÇÕES: ${instructions}\n\nRetorne o código completo modificado.`
      }],
      { maxTokens: 2000 }
    );
  }

  _detectLanguage(code) {
    if (/def |import |from |class |elif|print\(/.test(code)) return 'Python';
    if (/const |let |var |function |=>/.test(code)) return 'JavaScript';
    if (/interface |type |: string|: number/.test(code)) return 'TypeScript';
    if (/public class|System\.out/.test(code)) return 'Java';
    if (/<\?php/.test(code)) return 'PHP';
    if (/fn |let mut|impl |pub fn/.test(code)) return 'Rust';
    if (/func |package main/.test(code)) return 'Go';
    return 'unknown';
  }

  async _generateFilename(prompt, language) {
    const extensions = {
      Python: 'py', JavaScript: 'js', TypeScript: 'ts', Java: 'java',
      PHP: 'php', Rust: 'rs', Go: 'go', 'C#': 'cs',
    };
    const ext = extensions[language] || 'txt';
    const name = prompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `${name}_${Date.now()}.${ext}`;
  }

  async _saveToCodebase(filename, code, metadata) {
    const doc = `# ${filename}\n\n## Metadados\n- **Prompt**: ${metadata.prompt}\n- **Linguagem**: ${metadata.language}\n- **Framework**: ${metadata.framework || 'N/A'}\n- **Data**: ${new Date().toISOString().slice(0, 10)}\n\n## Código\n\`\`\`${metadata.language.toLowerCase()}\n${code}\n\`\`\`\n`;
    await fs.writeFile(path.join(CODEBASE_DIR, filename + '.md'), doc, 'utf8');
  }

  async listCodebase() {
    try {
      const files = await fs.readdir(CODEBASE_DIR);
      return files.filter(f => f.endsWith('.md'));
    } catch { return []; }
  }
}
