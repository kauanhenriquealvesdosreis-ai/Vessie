import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

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
    this.selectedPath = process.env.PROJECTS_BASE_DIR || PROJECTS_DIR;
    this.selectedProject = null;
  }

  select(projectPath) {
    this.selectedPath = projectPath;
    this.selectedProject = path.basename(projectPath);
  }

      async list() {
    const baseDir = process.env.PROJECTS_BASE_DIR || PROJECTS_DIR;
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
    const resolved = this.resolvePath(filePath);
    return await fs.readFile(resolved, 'utf8');
  }

  async writeFile(filePath, content) {
    const resolved = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf8');
  }

  async deleteFile(filePath) {
    const resolved = this.resolvePath(filePath);
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

  // ── Segurança: impede acessar pastas fora do projeto selecionado ────────────
  resolvePath(p) {
    if (p == null || String(p).trim() === '') throw new Error('Caminho não informado');
    if (path.isAbsolute(p)) {
      const base = path.resolve(this.selectedPath || process.cwd());
      const rel = path.relative(base, p);
      if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        const err = new Error('Caminho fora do projeto selecionado: ' + p);
        err.code = 'EAUTH';
        throw err;
      }
      return p;
    }
    const base = path.resolve(this.selectedPath || process.cwd());
    const target = path.resolve(base, p);
    const rel = path.relative(base, target);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
      const err = new Error('Caminho fora do projeto selecionado: ' + p);
      err.code = 'EAUTH';
      throw err;
    }
    return target;
  }

  getSelected() {
    return { path: this.selectedPath, name: this.selectedProject };
  }

  async setSelected(absPath) {
    if (!absPath) throw new Error('Informe o caminho da pasta');
    const stats = await fs.stat(absPath);
    if (!stats.isDirectory()) throw new Error('O caminho informado não é uma pasta.');
    this.select(absPath);
    return this.getSelected();
  }

  /** Árvore recursiva completa da pasta selecionada (ignora ocultos/node_modules). */
  async readTree(dir = null) {
    const base = dir ? path.resolve(dir) : this.selectedPath;
    const entries = await fs.readdir(base, { withFileTypes: true });
    const result = [];
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const fullPath = path.join(base, e.name);
      if (e.isDirectory()) {
        result.push({ name: e.name, path: fullPath, type: 'dir', children: await this.readTree(fullPath) });
      } else {
        const ext = e.name.split('.').pop()?.toLowerCase() || '';
        result.push({ name: e.name, path: fullPath, type: 'file', ext, language: LANGUAGE_EXTENSIONS[ext] || null });
      }
    }
    result.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)));
    return result;
  }

  async createFolder(folderPath) {
    const target = this.resolvePath(folderPath);
    await fs.mkdir(target, { recursive: true });
    return target;
  }

  async deleteFolder(folderPath) {
    const target = this.resolvePath(folderPath);
    await fs.rm(target, { recursive: true, force: true });
    return target;
  }

  /** Executa um lote de operações (manifesto da IA) dentro do projeto. */
  async executeManifest(operations = []) {
    const results = [];
    for (const op of operations || []) {
      const kind = (op.op || op.type || '').toLowerCase();
      try {
        if (kind === 'mkdir' || kind === 'create_folder' || kind === 'create_dir') {
          const p = await this.createFolder(op.path);
          results.push({ op: 'create_folder', path: op.path, ok: true, created: p });
        } else if (kind === 'write_file' || kind === 'create_file' || kind === 'edit_file') {
          await this.writeFile(op.path, String(op.content ?? ''));
          results.push({ op: 'write_file', path: op.path, ok: true });
        } else if (kind === 'delete_file') {
          await this.deleteFile(op.path);
          results.push({ op: 'delete_file', path: op.path, ok: true });
        } else if (kind === 'delete_folder' || kind === 'rmdir') {
          await this.deleteFolder(op.path);
          results.push({ op: 'delete_folder', path: op.path, ok: true });
        } else if (kind === 'read_file') {
          const data = await this.readFile(op.path);
          results.push({ op: 'read_file', path: op.path, ok: true, content: data.slice(0, 4000) });
        } else {
          results.push({ op: kind || 'unknown', path: op.path, ok: false, error: 'Operação não suportada' });
        }
      } catch (err) {
        results.push({ op: kind || 'unknown', path: op.path, ok: false, error: err.message });
      }
    }
    return results;
  }
}
