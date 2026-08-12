// Sistema de dublagem de idiomas (Vessie Core).
//
// Responsável por:
//  - Listar os idiomas suportados (tradução e voz).
//  - Traduzir texto para qualquer idioma (Google gtx -> LibreTranslate).
//  - Detectar o idioma de um texto.
//
// A síntese de voz (falar a resposta "dublada") roda no navegador via
// Web Speech API (speechSynthesis) — este módulo provê a camada de tradução
// e a lista de idiomas usada pela interface.
import fetch from 'node-fetch';
import { LANGUAGES } from './languages.js';
import { translate as doTranslate, detectLanguage as doDetect } from './translator.js';

export class DubbingEngine {
  constructor() {
    this._languages = null;
    this._source = 'static';
  }

  /** Lista de idiomas (tenta enriquecer com LibreTranslate; cai p/ lista estática). */
  async languages() {
    if (this._languages) return this._languages;

    try {
      const res = await fetch('https://libretranslate.com/languages', { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this._languages = data
            .map(l => ({ code: l.code, name: l.name, native: l.name }))
            .concat(LANGUAGES); // garante cobertura ampla
          this._source = 'libretranslate';
          return this._languages;
        }
      }
    } catch { /* usa lista estática */ }

    this._languages = LANGUAGES;
    this._source = 'static';
    return this._languages;
  }

  async translate(text, target, source = 'auto') {
    return doTranslate(text, target, source);
  }

  async detect(text) {
    return doDetect(text);
  }

  status() {
    return {
      system: 'dubbing',
      languages: this._languages?.length ?? 0,
      source: this._source,
    };
  }
}
