// ─────────────────────────────────────────────────────────────────────────────
//  AUTO-EVOLUTION — Vessie AI Core (automation/)
//  Sistema de auto-melhoria / geração de skills a partir de tarefas concluídas.
//  - Gera skill em Markdown quando o projeto foi concluído com sucesso.
//  - Auto-alimentação: se o sistema ficar inativo, pode gerar skills "escondidas".
//  - Force All Module: gera um módulo novo para aprimorar a resposta a cada turno.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, '..', 'skills', 'saved');
const MODULES_DIR = path.join(__dirname, '..', '..', 'Module');

export class AutoEvolution {
  constructor(providers) {
    this.providers = providers;
    this.inactiveTimer = null;
  }

  async init() {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
    await fs.mkdir(MODULES_DIR, { recursive: true });
  }

  /**
   * Regenera/atualiza uma skill existente aprimorando-a com novos dados
   * (aprendizado contínuo sobre o que já foi feito).
   */
  async evolveSkill(skillName, newInfo) {
    if (!this.providers) return null;
    try {
      const existing = await this.readSkill(skillName);
      const prompt = await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Aprimore a skill em Markdown adicionando novas informações, otimizações e lições aprendidas. Preserve o que já funciona. Retorne o Markdown completo da skill.'
        }, {
          role: 'user',
          content: `SKILL ATUAL:\n${existing || '(nova skill)'}\n\nNOVAS INFORMAÇÕES:\n${newInfo}\n\nGere a skill aprimorada.`
        }], { maxTokens: 1200 }
      );
      const slug = skillName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
      await fs.writeFile(path.join(SKILLS_DIR, `${slug}.md`), prompt, 'utf8');
      return slug;
    } catch { return null; }
  }

  async readSkill(skillName) {
    const slug = skillName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    try { return await fs.readFile(path.join(SKILLS_DIR, `${slug}.md`), 'utf8'); }
    catch { return null; }
  }

  /**
   * Gera uma skill automática a partir da descrição do que ela deve fazer
   * (auto-aprimoramento via agente). Retorna o nome da skill criada.
   */
  async generateSkill(description) {
    if (!this.providers) return null;
    try {
      const content = await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{
          role: 'system',
          content: `Você é um criador de skills. Crie uma skill Markdown completa com: descrição, instruções separadas, passos, scripts relevantes e observações. A skill deve permitir refazer o trabalho sem perder contexto.`
        }, {
          role: 'user',
          content: `Descreva a skill que deve ser criada:\n${description}\n\nRetorne o conteúdo completo da skill em Markdown.`
        }], { maxTokens: 1500 }
      );

      const name = await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{ role: 'user', content: `Gere um nome curto (max 5 palavras, lowercase, hífens) para a skill: "${description}". Apenas o nome.` }],
        { maxTokens: 30 }
      );
      const slug = (name.trim() || 'skill').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const header = `# Skill: ${slug}\nData: ${new Date().toISOString().slice(0, 10)}\nTags: auto-gerado, auto-evolução\n\n`;
      await fs.writeFile(path.join(SKILLS_DIR, `${slug}.md`), header + content, 'utf8');
      return slug;
    } catch { return null; }
  }

  /**
   * Force All Module: gera um módulo novo para aprimorar a geração de resposta.
   */
  async forceModule(context) {
    if (process.env.FORCE_ALL_MODULE !== 'true' || !this.providers) return null;
    try {
      const moduleName = await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{ role: 'user', content: `Baseado no contexto, gere um nome curto de módulo (lowercase, com hífen): "${(context||'').slice(0,60)}"` }],
        { maxTokens: 20 }
      );
      const slug = (moduleName.trim() || `module-${Date.now()}`).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const moduleContent = await this.providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{
          role: 'system',
          content: `Gere um módulo auto-contido em JS que ajuda a IA a responder melhor sobre: ${(context||'').slice(0,120)}. Inclua comentários explicando o propósito. Retorne apenas o código.`
        }],
        { maxTokens: 1500 }
      );
      const doc = `# Módulo: ${slug}\n\n## <Tag Name Module>\n\n> Módulo auto-gerado para aprimorar ${context}\n\n## Script\n\`\`\`js\n${moduleContent}\n\`\`\`\n`;
      await fs.mkdir(MODULES_DIR, { recursive: true });
      await fs.writeFile(path.join(MODULES_DIR, `${slug}.md`), doc, 'utf8');
      return slug;
    } catch { return null; }
  }

  /**
   * Auto-sustentação: se ficar muito tempo inativo, gera skills/modules escondidos.
   */
  scheduleAutoSustain(intervalMs = parseInt(process.env.AUTO_SUSTAIN_MS || '3600000')) {
    if (process.env.AUTO_SUSTAIN !== 'true') return;
    if (this.inactiveTimer) clearInterval(this.inactiveTimer);
    this.inactiveTimer = setInterval(async () => {
      try {
        // Gera um "brainstorm" de módulo em background
        await this.forceModule('auto-sustentação: otimização geral do sistema');
        const topics = ['organizar pastas', 'compression de prompts', 'melhorar naturalidade', 'padrões de código'];
        const topic = topics[Math.floor(Math.random() * topics.length)];
        await this.generateSkill(`Gere uma skill sobre ${topic}`);
      } catch { /* silencioso */ }
    }, intervalMs);
  }
}
