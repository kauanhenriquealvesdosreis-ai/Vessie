import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'saved');

export class SkillManager {
  constructor() {
    this.cache = null;
  }

  async init() {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
  }

  async list() {
    try {
      const files = await fs.readdir(SKILLS_DIR);
      const skills = await Promise.all(
        files
          .filter(f => f.endsWith('.md'))
          .map(async (f) => {
            const content = await fs.readFile(path.join(SKILLS_DIR, f), 'utf8');
            const titleMatch = content.match(/^# (.+)/m);
            const dateMatch = content.match(/Data: (.+)/);
            const tagsMatch = content.match(/Tags: (.+)/);
            return {
              name: f.replace('.md', ''),
              title: titleMatch?.[1] || f.replace('.md', ''),
              date: dateMatch?.[1] || 'desconhecido',
              tags: tagsMatch?.[1]?.split(',').map(t => t.trim()) || [],
              size: content.length,
              preview: content.slice(0, 200),
            };
          })
      );
      return skills.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  }

  async get(name) {
    const file = path.join(SKILLS_DIR, name.endsWith('.md') ? name : `${name}.md`);
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      return null;
    }
  }

  async save(name, content, metadata = {}) {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
    const slug = name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const ts = new Date().toISOString().slice(0, 10);
    const tags = metadata.tags?.join(', ') || 'geral';
    const header = `# Skill: ${name}\nData: ${ts}\nTags: ${tags}\n\n`;
    await fs.writeFile(path.join(SKILLS_DIR, `${slug}.md`), header + content, 'utf8');
    return slug;
  }

  async delete(name) {
    const file = path.join(SKILLS_DIR, name.endsWith('.md') ? name : `${name}.md`);
    await fs.unlink(file);
  }

  async generate(task, result, providers) {
    if (!providers) return null;
    try {
      const skillContent = await providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Crie uma skill em Markdown para reutilização futura. Seja conciso e prático.'
        }, {
          role: 'user',
          content: `Tarefa: "${task}"\nResultado: "${result.slice(0, 1000)}"\n\nCrie uma skill Markdown com: descrição, passos para reproduzir, código/comandos relevantes, e observações.`
        }],
        { maxTokens: 800 }
      );

      const skillName = await providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'user',
          content: `Gere um nome de arquivo conciso (max 5 palavras, sem espaços, lowercase, com hífens) para a skill: "${task}". Retorne APENAS o nome.`
        }],
        { maxTokens: 30 }
      );

      const name = skillName.trim().replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      await this.save(name, skillContent, { tags: ['auto-gerado'] });
      return name;
    } catch {
      return null;
    }
  }
}
