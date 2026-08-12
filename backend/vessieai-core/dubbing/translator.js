// Motor de tradução multilíngue (dublagem de texto).
//
// Provedores gratuitos, sem chave de API:
//  1) Google Translate (endpoint público gtx)  -> primário
//  2) LibreTranslate (público/libre)           -> fallback
import fetch from 'node-fetch';

function cleanText(text) {
  return String(text ?? '').slice(0, 9000);
}

function extractGoogle(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  let translated = '';
  for (const seg of data[0]) {
    if (seg && typeof seg[0] === 'string') translated += seg[0];
  }
  if (!translated) return null;
  return { translatedText: translated, detected: data[2] || null, provider: 'google' };
}

/**
 * Traduz `text` para o idioma `target` (código ISO, ex.: 'pt', 'en', 'ja').
 * `source`: idioma de origem ou 'auto' para detectar.
 */
export async function translate(text, target, source = 'auto') {
  const q = cleanText(text);
  if (!q || !target) throw new Error('Texto e idioma de destino são obrigatórios.');

  // 1) Google gtx
  try {
    const url = 'https://translate.googleapis.com/translate_a/single'
      + `?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const data = await res.json();
      const g = extractGoogle(data);
      if (g) return g;
    }
  } catch { /* tenta próximo provedor */ }

  // 2) LibreTranslate (fallback)
  try {
    const body = new URLSearchParams({
      q, source: source === 'auto' ? 'auto' : source, target, format: 'text',
    });
    const res = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.translatedText) {
        return {
          translatedText: data.translatedText,
          detected: data.detectedLanguage?.language || null,
          provider: 'libretranslate',
        };
      }
    }
  } catch { /* sem mais provedores */ }

  throw new Error('Não foi possível traduzir: provedores indisponíveis ou sem rede.');
}

/** Detecta o idioma de um texto usando o Google gtx. */
export async function detectLanguage(text) {
  const q = cleanText(text);
  if (!q) throw new Error('Texto vazio.');
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q='
      + encodeURIComponent(q);
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data[2]) return data[2];
    }
  } catch { /* ignora */ }
  return null;
}
