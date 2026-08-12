import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, 'Memory.md');

const INITIAL_MEMORY = `# Memory.md - Vessie AI
_Atualizado automaticamente_

## Usuário
- **Nome**: (não informado)
- **Estilo**: (detectado dinamicamente)
- **Interesses**: []
- **Comportamento**: (em aprendizagem)

## Conversas Importantes
(aguardando dados)

## Preferências Detectadas
(aguardando dados)

## Contexto Atual
(aguardando dados)

## Histórico de Interações
(aguardando dados)
`;

export class MemoryManager {
  constructor(providers) {
    this.providers = providers;
    this.cache = null;
    this.lastUpdate = 0;
    this.conversations = {};
  }

  async init() {
    try {
      await fs.access(MEMORY_FILE);
    } catch {
      await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
      await fs.writeFile(MEMORY_FILE, INITIAL_MEMORY, 'utf8');
    }
  }

  async read() {
    try {
      const content = await fs.readFile(MEMORY_FILE, 'utf8');
      this.cache = content;
      return content;
    } catch {
      return INITIAL_MEMORY;
    }
  }

  async write(content) {
    await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
    await fs.writeFile(MEMORY_FILE, content, 'utf8');
    this.cache = content;
    this.lastUpdate = Date.now();
  }

  async clear() {
    await this.write(INITIAL_MEMORY);
  }

  async getRelevant(query) {
    const memory = await this.read();
    if (!memory || memory === INITIAL_MEMORY) return '';
    const lines = memory.split('\n');
    const relevant = lines.filter(line => {
      if (!line.trim() || line.startsWith('#')) return false;
      const lower = line.toLowerCase();
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return words.some(w => lower.includes(w));
    });
    return relevant.slice(0, 10).join('\n');
  }

  async updateFromConversation(convId, messages) {
    if (!process.env.MEMORY_AUTO_UPDATE === 'true') return;

    // Throttle: update at most every 10 messages or 5 minutes
    const conv = this.conversations[convId] || { count: 0 };
    conv.count++;
    this.conversations[convId] = conv;

    if (conv.count % 10 !== 0 && Date.now() - this.lastUpdate < 5 * 60 * 1000) return;

    try {
      const currentMemory = await this.read();
      const recentMessages = messages.slice(-20).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');

      const prompt = `Você é um sistema de memória. Analise a conversa e atualize o Memory.md.

MEMORY.MD ATUAL:
${currentMemory.slice(0, 3000)}

CONVERSA RECENTE:
${recentMessages}

Atualize o Memory.md preservando informações existentes e adicionando novas. Inclua:
- Nome/apelido do usuário (se mencionado)
- Interesses e tópicos abordados
- Estilo de comunicação do usuário
- Preferências detectadas
- Contexto importante da conversa

Responda APENAS com o novo conteúdo completo do Memory.md no formato Markdown.`;

      const updated = await this.providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [
          { role: 'system', content: 'Você é um sistema de memória preciso. Mantenha o formato Markdown.' },
          { role: 'user', content: prompt }
        ],
        { maxTokens: 2000 }
      );

      if (updated && updated.includes('# Memory.md')) {
        await this.write(updated);
      }
    } catch {}
  }

  async getUserProfile() {
    const memory = await this.read();
    const nameMatch = memory.match(/\*\*Nome\*\*:\s*(.+)/);
    const styleMatch = memory.match(/\*\*Estilo\*\*:\s*(.+)/);
    return {
      name: nameMatch?.[1]?.trim() || null,
      style: styleMatch?.[1]?.trim() || null,
    };
  }
}
