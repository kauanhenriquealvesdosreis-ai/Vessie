import fs from 'fs/promises';
import path from 'path';

const LANGUAGE_EXTENSIONS = {
  js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript React', jsx: 'JavaScript React',
  py: 'Python', java: 'Java', cs: 'C#', cpp: 'C++', c: 'C', go: 'Go',
  rb: 'Ruby', php: 'PHP', rs: 'Rust', swift: 'Swift', kt: 'Kotlin',
  html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON', yaml: 'YAML',
  yml: 'YAML', md: 'Markdown', sh: 'Shell', sql: 'SQL', vue: 'Vue',
};

const LANGUAGE_KEYWORDS = {
  Python: ['def ', 'import ', 'from ', 'class ', 'elif', 'print(', '__init__'],
  JavaScript: ['const ', 'let ', 'var ', 'function ', 'require(', 'module.exports'],
  TypeScript: ['interface ', 'type ', ': string', ': number', ': boolean', 'export type'],
  Java: ['public class', 'private ', 'protected ', 'System.out', 'import java'],
  'C#': ['using System', 'namespace ', 'Console.', 'public class', 'static void'],
};

export class ProjectManager {
  constructor() {
    this.selectedPath = process.env.PROJECTS_BASE_DIR || './projects';
    this.selectedProject = null;
  }

  select(projectPath) {
    this.selectedPath = projectPath;
    this.selectedProject = path.basename(projectPath);
  }

  async list() {
    const baseDir = process.env.PROJECTS_BASE_DIR || './projects';
    try {
      await fs.mkdir(baseDir, { recursive: true });
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory())
        .map(e => ({
          name: e.name,
          path: path.join(baseDir, e.name),
          active: this.selectedProject === e.name,
        }));
    } catch { return []; }
  }

  async listFiles(dir = null) {
    const base = dir || this.selectedPath;
    try {
      const entries = await fs.readdir(base, { withFileTypes: true });
      const result = [];

      for (const e of entries) {
        const fullPath = path.join(base, e.name);
        const ext = e.name.split('.').pop()?.toLowerCase() || '';
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          result.push({ name: e.name, path: fullPath, type: 'dir', children: [] });
        } else if (e.isFile()) {
          result.push({
            name: e.name,
            path: fullPath,
            type: 'file',
            ext,
            language: LANGUAGE_EXTENSIONS[ext] || null,
          });
        }
      }

      return result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch { return []; }
  }

  async readFile(filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.selectedPath, filePath);
    return await fs.readFile(resolved, 'utf8');
  }

  async writeFile(filePath, content) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.selectedPath, filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf8');
  }

  async deleteFile(filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(this.selectedPath, filePath);
    await fs.unlink(resolved);
  }

  detectLanguage(code) {
    if (!code) return 'unknown';

    // Por palavras-chave
    for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
      if (keywords.some(kw => code.includes(kw))) return lang;
    }

    return 'unknown';
  }

  detectLanguageFromFile(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return LANGUAGE_EXTENSIONS[ext] || 'unknown';
  }
}
