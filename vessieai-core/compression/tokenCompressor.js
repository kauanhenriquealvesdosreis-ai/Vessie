// ─────────────────────────────────────────────────────────────────────────────
//  TOKEN COMPRESSOR — Vessie AI Core
//  Compressão de tokens/código para reduzir consumo de contexto.
//  - Comprime código removendo repetições e comentários redundantes
//  - Comprime texto removendo redundâncias
//  - Dublagem de linguagem: transforma código em prompt de alto nível
//  - Níveis: simples | avançado | complexo
// ─────────────────────────────────────────────────────────────────────────────
export class TokenCompressor {
  constructor() {
    this.name = 'token-compressor';
  }

  /**
   * Comprime código para reduzir tokens mantendo a lógica.
   * @param {string} code
   * @param {'simple'|'advanced'|'complex'} level
   */
  compressCode(code, level = 'advanced') {
    if (!code) return '';
    let out = code;

    // Remove linhas em branco consecutivas
    out = out.replace(/\n{3,}/g, '\n\n');

    // Simple: remove comentários de linha e espaços duplos
    if (level === 'simple' || level === 'advanced' || level === 'complex') {
      out = out
        .replace(/^\s*\/\/.*$/gm, '')      // comentários //
        .replace(/[ \t]{2,}/g, ' ');
    }

    // Advanced: remove blocos de comentário /* */ de linha única e colapsa espaços
    if (level === 'advanced' || level === 'complex') {
      out = out
        .replace(/\/\*[\s\S]*?\*\//g, '')   // comentários /* */
        .replace(/\s*([{};:,])\s*/g, '$1 ') // compacta pontuação
        .replace(/\r\n/g, '\n');
    }

    // Complex: remove redundâncias de imports repetidos e linhas duplicadas
    if (level === 'complex') {
      const lines = out.split('\n');
      const seen = new Set();
      out = lines.filter(l => {
        const key = l.trim();
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).join('\n');
    }

    return out.trim();
  }

  /**
   * Comprime texto natural (conversas/documentos) removendo redundância.
   */
  compressText(text, maxLen = 0) {
    if (!text) return '';
    let out = text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    if (maxLen > 0 && out.length > maxLen) out = out.slice(0, maxLen);
    return out;
  }

  /**
   * "Dubla" código: transforma cada linha em prompt de alto nível.
   * Retorna { language: string, prompt: string }.
   */
  async dubCode(code, providers) {
    try {
      const prompt = await providers.chat(
        process.env.AI_PROVIDER, process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Você é um dublador de código. Transforme cada parte do código em uma descrição clara em linguagem natural explicando O QUE faz (não como funciona). Retorne apenas o texto descritivo.'
        }, {
          role: 'user',
          content: `Código:\n${code.slice(0, 3000)}\n\nDescreva em prompts de alto nível o que cada trecho pretende fazer.`
        }], { maxTokens: 1000 }
      );
      return { language: this._detectLanguage(code), prompt };
    } catch {
      return { language: this._detectLanguage(code), prompt: this._localDub(code) };
    }
  }

  _localDub(code) {
    return code
      .split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .map(l => `- ${l.trim().slice(0, 120)}`)
      .slice(0, 80)
      .join('\n');
  }

  _detectLanguage(code) {
    if (/def |import |from |class |print\(/.test(code)) return 'Python';
    if (/const |let |var |function |=>|require\(/.test(code)) return 'JavaScript';
    if (/interface |: string|: number|export type/.test(code)) return 'TypeScript';
    if (/public class|System\.out/.test(code)) return 'Java';
    if (/<\?php/.test(code)) return 'PHP';
    if (/fn |let mut|impl |pub fn/.test(code)) return 'Rust';
    if (/func |package main/.test(code)) return 'Go';
    return 'unknown';
  }

  /**
   * Calculadora leve para estimar tokens sem depender de lib.
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Aproximação: ~4 chars por token para PT/EN
    return Math.ceil(text.length / 4);
  }

  /**
   * Transforma texto em resumo leve (dump de contexto).
   */
  summarize(text, maxWords = 120) {
    if (!text) return '';
    return text.split(/\s+/).slice(0, maxWords).join(' ');
  }
}
