// ─────────────────────────────────────────────────────────────────────────────
//  PATCH MANAGER — Vessie AI Core (patches/)
//  Sistema de patches: edições por linha / trechos para aprimorar arquivos
//  sem recriar o script inteiro. Permite registrar patches reutilizáveis e
//  aplicá-los sobre código existente.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATCHES_DIR = path.join(__dirname, '..', 'patches');

export class PatchManager {
  constructor(providers) {
    this.providers = providers;
  }

  async init() {
    await fs.mkdir(PATCHES_DIR, { recursive: true });
  }

  /**
   * Registra um patch (edição por linha) num arquivo de referência.
   * @param {string} name - nome do patch
   * @param {{file:string, oldLine:string, newLine:string, description:string}[]} edits
   */
  async create(name, edits, metadata = {}) {
    const slug = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const doc = `# Patch: ${name}\nData: ${new Date().toISOString().slice(0, 10)}\n\n## Edições\n${(edits || []).map(e => `- **${e.description || 'edição'}**\n  - Arquivo: ${e.file}\n  - De: ${e.oldLine}\n  - Para: ${e.newLine}`).join('\n')}\n\n## Metadados\n${Object.entries(metadata).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`;
    await fs.mkdir(PATCHES_DIR, { recursive: true });
    await fs.writeFile(path.join(PATCHES_DIR, `${slug}.md`), doc, 'utf8');
    return slug;
  }

  /**
   * Aplica um patch textual sobre o código: substitui oldLine por newLine.
   */
  applyPatch(code, edits) {
    let out = code || '';
    for (const e of edits || []) {
      if (e.oldLine && e.newLine !== undefined) {
        out = out.split(e.oldLine).join(e.newLine);
      }
    }
    return out;
  }

  /**
   * Gera um patch automaticamente via IA: dado código e instrução, retorna
   * o código aprimorado (edição por linha sem recriar tudo).
   */
  async generatePatch(code, instruction) {
    if (!this.providers) return this.applyPatch(code, [{ oldLine: '', newLine: '' }]);
    try {
      return await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Edite apenas o necessário no código, aplicando modificações mínimas por linha. Retorne o código completo modificado, sem explicações.'
        }, {
          role: 'user',
          content: `CÓDIGO:\n\`\`\`\n${code.slice(0, 4000)}\n\`\`\`\n\nINSTRUÇÃO: ${instruction}\n\nAplique alterações mínimas e retorne o código completo.`
        }], { maxTokens: 4000 }
      );
    } catch { return code; }
  }

  async list() {
    try {
      const files = await fs.readdir(PATCHES_DIR);
      return files.filter(f => f.endsWith('.md'));
    } catch { return []; }
  }

  async get(name) {
    const slug = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    try { return await fs.readFile(path.join(PATCHES_DIR, `${slug}.md`), 'utf8'); }
    catch { return null; }
  }
}
