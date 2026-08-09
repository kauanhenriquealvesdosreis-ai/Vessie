import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARE_FILE = path.join(__dirname, 'Share-Thinking.md');

export class ShareThinking {
  constructor(providers) {
    this.providers = providers;
    this.currentProvider = null;
    this.currentModel = null;
  }

  async init() {
    try {
      await fs.access(SHARE_FILE);
    } catch {
      await fs.mkdir(path.dirname(SHARE_FILE), { recursive: true });
      await fs.writeFile(SHARE_FILE, '# Share-Thinking.md\n\n_Contexto compartilhado entre modelos de IA_\n', 'utf8');
    }
  }

  async read() {
    try {
      return await fs.readFile(SHARE_FILE, 'utf8');
    } catch {
      return '';
    }
  }

  async update(convId, messages, lastResponse) {
    if (!this.providers) return;
    try {
      const existing = await this.read();
      const recentContext = messages.slice(-6).map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n');

      const prompt = await this.providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Crie um prompt de comportamento em Markdown para ser lido por outro modelo de IA, descrevendo o estado mental, tom, e estilo da conversa atual.'
        }, {
          role: 'user',
          content: `Contexto atual da conversa:\n${recentContext}\n\nÚltima resposta: ${lastResponse.slice(0, 500)}\n\nCrie um Share-Thinking.md que outro modelo possa ler para manter o mesmo estilo, tom e contexto.`
        }],
        { maxTokens: 600 }
      );

      const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const content = `# Share-Thinking.md\n_Atualizado: ${ts}_\n\n## Provedor Atual\n- **Provider**: ${process.env.AI_PROVIDER}\n- **Modelo**: ${process.env.AI_MODEL}\n\n${prompt}\n`;

      await fs.writeFile(SHARE_FILE, content, 'utf8');
    } catch {}
  }

  async notifyModelSwitch(newProvider, newModel) {
    const existing = await this.read();
    if (!existing) return;

    // Atualizar cabeçalho com novo modelo
    const updated = existing.replace(
      /## Provedor Atual[\s\S]*?\n\n/,
      `## Provedor Atual\n- **Provider**: ${newProvider}\n- **Modelo**: ${newModel}\n- **Trocado em**: ${new Date().toISOString()}\n\n`
    );
    await fs.writeFile(SHARE_FILE, updated, 'utf8');
  }

  async getContextForNewModel() {
    const content = await this.read();
    if (!content || content.length < 50) return '';
    return `\n\n[CONTEXTO DO MODELO ANTERIOR]\n${content.slice(0, 1000)}`;
  }
}
