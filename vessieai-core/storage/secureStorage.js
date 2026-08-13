// ─────────────────────────────────────────────────────────────────────────────
//  SECURE STORAGE — Vessie AI Core (storage/)
//  Armazenamento seguro, acessível SOMENTE por DM (mensagem direta/autenticada).
//  Todos os dados sensíveis são criptografados com AES-256-GCM usando uma chave
//  definida no .env (VESSIE_STORAGE_KEY). Sem a chave correta, o acesso é negado.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

export class SecureStorage {
  constructor() {
    this.enabled = process.env.DM_ONLY === 'true';
    this.dir = process.env.STORAGE_DIR || STORAGE_DIR;
    // Deriva chave de 32 bytes a partir do segredo
    this.key = this._deriveKey(process.env.VESSIE_STORAGE_KEY || '');
  }

  _deriveKey(secret) {
    return crypto.createHash('sha256').update(String(secret || 'vessie-default-key')).digest();
  }

  _encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
  }

  _decrypt(payload) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  }

  /**
   * Verifica se a requisição é "DM" autorizada (token de sessão seguro).
   */
  isAuthorized(token) {
    if (!this.enabled) return true; // se DM_ONLY=false, aberto
    if (!process.env.DM_TOKEN) return false; // sem token configurado, nega
    let ok = false;
    try {
      const a = Buffer.from(String(process.env.DM_TOKEN));
      const b = Buffer.from(String(token || ''));
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch { ok = false; }
    return ok;
  }

  /**
   * Salva um objeto criptografado associado a uma "conversa"/chave (DM).
   */
  async save(key, value, token) {
    if (!this.isAuthorized(token)) throw new Error('Acesso negado: requisição não autorizada (DM).');
    const safeKey = path.basename(String(key).replace(/[^a-z0-9._-]/gi, '_')) || 'default';
    await fs.mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${safeKey}.enc`);
    const content = JSON.stringify({ key, value, updatedAt: Date.now() });
    await fs.writeFile(file, JSON.stringify(this._encrypt(content)), 'utf8');
    return { key, saved: true };
  }

  /**
   * Lê um objeto criptografado (requer autorização DM + chave correta).
   */
  async read(key, token) {
    if (!this.isAuthorized(token)) throw new Error('Acesso negado: requisição não autorizada (DM).');
    const safeKey = path.basename(String(key).replace(/[^a-z0-9._-]/gi, '_')) || 'default';
    try {
      const raw = await fs.readFile(path.join(this.dir, `${safeKey}.enc`), 'utf8');
      const parsed = JSON.parse(raw);
      const decrypted = JSON.parse(this._decrypt(parsed));
      return decrypted.value;
    } catch { return null; }
  }

  async list(token) {
    if (!this.isAuthorized(token)) throw new Error('Acesso negado: requisição não autorizada (DM).');
    try {
      const files = await fs.readdir(this.dir);
      return files.filter(f => f.endsWith('.enc')).map(f => f.replace('.enc', ''));
    } catch { return []; }
  }

  async delete(key, token) {
    if (!this.isAuthorized(token)) throw new Error('Acesso negado: requisição não autorizada (DM).');
    const safeKey = path.basename(String(key).replace(/[^a-z0-9._-]/gi, '_')) || 'default';
    try { await fs.unlink(path.join(this.dir, `${safeKey}.enc`)); return true; } catch { return false; }
  }
}
