// ─────────────────────────────────────────────────────────────────────────────
//  LANGUAGE DETECTOR — Vessie AI Core (core/)
//  Detecta o idioma da mensagem do usuário (rápido, sem rede) para que a IA
//  responda sempre no MESMO idioma em que o usuário escreve.
//  Suporta pt-BR, en, es, fr, de, it, ja, zh, ko e nl (básico). Prioriza o
//  idioma com mais palavras "marcadoras" no texto.
// ─────────────────────────────────────────────────────────────────────────────
// Palavras muito comuns e características de cada idioma
const MARKERS = {
  'pt': ['você', 'voce', 'não', 'nao', 'está', 'são', 'para', 'com', 'uma', 'por', 'mas', 'tudo', 'mais', 'como', 'essa', 'isso', 'acho', 'quero', 'pode', 'ser', 'qual', 'muito', 'bom', 'obrigado', 'oi', 'olá', 'tchau'],
  'en': ['you', 'this', 'that', 'with', 'from', 'have', 'would', 'please', 'what', 'how', 'help', 'okay', 'thanks', 'hello', 'hi', 'bye', 'yes', 'no', 'the', 'and', 'your'],
  'es': ['usted', 'tú', 'no', 'para', 'pero', 'como', 'todo', 'más', 'cosa', 'quiero', 'puede', 'gracias', 'hola', 'holá', 'está', 'son'],
  'fr': ['vous', 'vous', 'nous', 'avec', 'pour', 'mais', 'tout', 'plus', 'chose', 'veux', 'peux', 'merci', 'bonjour', 'salut', 'est', 'sont'],
  'de': ['du', 'sie', 'ich', 'mit', 'für', 'aber', 'wie', 'alles', 'mehr', 'kein', 'kann', 'danke', 'hallo', 'tschüss', 'ist', 'sind'],
  'it': ['tu', 'lei', 'con', 'per', 'ma', 'come', 'tutto', 'più', 'cosa', 'voglio', 'può', 'grazie', 'ciao', 'arrivederci', 'è', 'sono'],
  'ja': ['です', 'ます', 'こんにちは', 'ありがとう', 'ください', 'あなた', 'はい', 'いいえ'],
  'zh': ['的', '是', '在', '你', '我', '谢谢', '你好', '不', '有', '和'],
  'ko': ['합니다', '아니요', '안녕하세요', '감사합니다', '제', '그', '입니다', '네'],
  'nl': ['je', 'jij', 'met', 'voor', 'maar', 'als', 'alles', 'meer', 'kan', 'dank', 'hallo', 'dag', 'is', 'zijn'],
};

function countMatches(text, lang) {
  const lower = ' ' + String(text).toLowerCase() + ' ';
  return (MARKERS[lang] || []).reduce((acc, w) => {
    const needle = ' ' + w + ' ';
    return acc + ((lower.includes(needle) || lower.includes(w)) ? 1 : 0);
  }, 0);
}

/**
 * Detecta o idioma de uma mensagem (síncrono e rápido).
 * @returns {{ code: string, name: string, score: number }}
 */
export function detectLanguage(text) {
  if (!text || !text.trim()) return { code: 'pt', name: 'Português', score: 0 };

  let best = { code: 'pt', name: 'Português', score: Math.max(1, countMatches(text, 'pt') * 0.4) };
  let bestScore = best.score;

  for (const lang of Object.keys(MARKERS)) {
    const s = countMatches(text, lang);
    if (s > bestScore) {
      bestScore = s;
      best = { code: lang, name: localeName(lang), score: s };
    }
  }

  // Se nenhum marcador forte: assume português (usuário base)
  if (bestScore === 0) return { code: 'pt', name: 'Português', score: 0 };
  return best;
}

function localeName(code) {
  const names = { pt: 'Português', en: 'Inglês', es: 'Espanhol', fr: 'Francês', de: 'Alemão', it: 'Italiano', ja: 'Japonês', zh: 'Chinês', ko: 'Coreano', nl: 'Holandês' };
  return names[code] || code;
}

/**
 * Monta uma instrução clara de idioma para o system prompt.
 * @param {string} langCode - 'pt' | 'en' | ...
 */
export function buildLanguageInstruction(langCode) {
  const name = localeName(langCode);
  const text = {
    pt: `Responda SEMPRE em **Português (Brasil, pt-BR)**, no mesmo idioma em que o usuário escreveu. Nunca mude para outro idioma sem o usuário pedir.`,
    en: `Always respond in **English**, matching the user's language. Do not switch languages unless asked.`,
    es: `Responde SIEMPRE en **Español**, en el mismo idioma en que el usuario escribió.`,
    fr: `Réponds TOUJOURS en **français**, dans la même langue que l'utilisateur.`,
    de: `Antworte IMMER auf **Deutsch**, in derselben Sprache wie der Benutzer.`,
    it: `Rispondi SEMPRE in **Italiano**, nella stessa lingua dell'utente.`,
    ja: `常に**日本語**で返答してください。`,
    zh: `请始终用**中文**回复。`,
    ko: `항상 **한국어**로 답변하세요.`,
    nl: `Antwoord altijd in het **Nederlands**.`,
  }[langCode] || `Responda sempre no idioma em que o usuário escreveu.`;

  return `\n[REGRAS DE IDIOMA]\n${text}\n- Responda no idioma do usuário (${name}).`;
}