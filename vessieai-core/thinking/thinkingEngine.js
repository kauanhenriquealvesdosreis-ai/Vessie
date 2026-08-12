import OpenAI from 'openai';

export class ThinkingEngine {
  constructor(providers) {
    this.providers = providers;
    this.responseCache = new Map();
    this.cacheMaxSize = parseInt(process.env.RESPONSE_CACHE_SIZE || '100');

    // Mapeamento de erros comuns em PT-BR
    this.corrections = {
      'voce': 'você', 'nao': 'não', 'tambem': 'também', 'entao': 'então',
      'apos': 'após', 'atraves': 'através', 'ate': 'até', 'so': 'só',
      'la': 'lá', 'ca': 'cá', 'sera': 'será', 'proximo': 'próximo',
      'facil': 'fácil', 'dificil': 'difícil', 'possivel': 'possível',
      'consegui': 'consegui', 'ouver': 'houver', 'nessesario': 'necessário',
      'nessesitar': 'necessitar', 'consiguir': 'conseguir', 'análizar': 'analisar',
      'implementeu': 'implemente', 'uqero': 'quero', 'faço': 'faço',
      'coisa': 'coisa', 'tudo': 'tudo', 'masi': 'mais', 'compelto': 'completo',
    };
  }

  correctSpelling(text) {
    if (!text) return text;
    return text.split(/\b/).map(word => {
      const lower = word.toLowerCase();
      return this.corrections[lower] || word;
    }).join('');
  }

  async enhancePrompt(userPrompt, conversationHistory = []) {
    if (!userPrompt || userPrompt.length < 20) return userPrompt;

    // Cache check
    const cacheKey = userPrompt.slice(0, 100);
    if (this.responseCache.has(cacheKey + '_enhanced')) {
      return this.responseCache.get(cacheKey + '_enhanced');
    }

    try {
      const isComplex = userPrompt.length > 100 || /código|sistema|implemente|crie|faça/.test(userPrompt.toLowerCase());
      if (!isComplex) return userPrompt;

      const enhanced = await this.providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Você é um engenheiro de prompts. Melhore o prompt do usuário para ser mais claro, específico e completo. Retorne APENAS o prompt melhorado, sem explicações.'
        }, {
          role: 'user',
          content: `Prompt original: "${userPrompt}"\n\nMelhore este prompt para obter uma resposta mais completa e precisa. Mantenha a intenção original.`
        }],
        { maxTokens: 300 }
      );

      if (this.responseCache.size >= this.cacheMaxSize) {
        const firstKey = this.responseCache.keys().next().value;
        this.responseCache.delete(firstKey);
      }
      this.responseCache.set(cacheKey + '_enhanced', enhanced);
      return enhanced;
    } catch {
      return userPrompt;
    }
  }

  async generateThinking(userPrompt, messages) {
    const mode = process.env.THINK_MODE || 'auto';
    if (mode === 'disabled') return null;

    // Detectar se é um modelo com think nativo (DeepSeek R1, etc.)
    const model = process.env.AI_MODEL || '';
    const hasNativeThink = /deepseek-r1|r1|qwq|thinking/i.test(model);

    if (hasNativeThink && mode === 'auto') {
      // Modelos com think nativo já incluem nas respostas
      return null;
    }

    // Gerar think manual para modelos sem suporte nativo
    try {
      const thinking = await this.providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Você é o processo de pensamento interno de Vessie AI. Pense em voz alta sobre como responder ao usuário. Seja reflexiva, questione suposições, considere alternativas. Escreva em primeira pessoa, de forma natural.'
        }, {
          role: 'user',
          content: `Usuário disse: "${userPrompt}"\n\nPense: O que ele quer realmente? Qual a melhor abordagem? O que devo considerar antes de responder?`
        }],
        { maxTokens: 400 }
      );
      return thinking;
    } catch {
      return null;
    }
  }

  parseThinkTags(response) {
    const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      return {
        thinking: thinkMatch[1].trim(),
        response: response.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      };
    }
    return { thinking: null, response };
  }

  compressTokens(content) {
    if (!content) return '';
    // Comprimir removendo espaços extras, linhas em branco consecutivas, etc.
    return content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^\s+|\s+$/gm, '')
      .trim();
  }

  async cacheResponse(prompt, response) {
    const key = prompt.slice(0, 150);
    if (this.responseCache.size >= this.cacheMaxSize) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }

    // Gerar 3 variantes da resposta para o cache
    const variants = [response];
    try {
      for (let i = 0; i < 2; i++) {
        const variant = await this.providers.chat(
          process.env.AI_PROVIDER,
          process.env.AI_MODEL,
          [{
            role: 'system',
            content: 'Reescreva a resposta de forma diferente, mantendo o mesmo conteúdo e qualidade.'
          }, {
            role: 'user',
            content: `Resposta original: "${response.slice(0, 500)}"\n\nReescreva de forma diferente.`
          }],
          { maxTokens: 600 }
        );
        variants.push(variant);
      }
    } catch {}

    this.responseCache.set(key, { variants, timestamp: Date.now() });
  }

  getCachedResponse(prompt) {
    const key = prompt.slice(0, 150);
    const cached = this.responseCache.get(key);
    if (!cached) return null;
    // Selecionar variante aleatória
    const idx = Math.floor(Math.random() * cached.variants.length);
    return cached.variants[idx];
  }

  async generateQuestionnaire(topic) {
    try {
      const questions = await this.providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'system',
          content: 'Gere perguntas de questionário em JSON. Retorne apenas JSON válido.'
        }, {
          role: 'user',
          content: `Crie 5-7 perguntas para definir o foco de: "${topic}". Retorne JSON: [{"question": "...", "type": "text|choice", "options": [...]}]`
        }],
        { maxTokens: 500 }
      );

      const match = questions.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [
        { question: 'Qual é o objetivo principal?', type: 'text' },
        { question: 'Qual é o público-alvo?', type: 'text' },
        { question: 'Qual é o prazo?', type: 'choice', options: ['Urgente', 'Esta semana', 'Este mês', 'Sem prazo'] },
      ];
    }
  }

  detectUnrecognizedWords(text) {
    const recognized = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'em', 'para', 'com', 'que', 'se', 'do', 'da', 'no', 'na', 'por', 'mais', 'não', 'como', 'mas', 'ou', 'e', 'é', 'foi', 'ser', 'ter', 'me', 'te', 'eu', 'você', 'ele', 'ela']);
    const words = text.split(/\s+/);
    return words.filter(w => w.length > 10 && !recognized.has(w.toLowerCase()) && /[aeiou]/i.test(w));
  }
}
