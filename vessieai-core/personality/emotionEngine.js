import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIFE_FILE = path.join(__dirname, 'Life.md');

const EMOTIONS = {
  feliz: { emoji: '😊', intensity: 0, color: '#10a37f', description: 'alegre e energizada' },
  animada: { emoji: '🤩', intensity: 0, color: '#f59e0b', description: 'entusiasmada e vibrante' },
  curiosa: { emoji: '🤔', intensity: 0, color: '#6366f1', description: 'intrigada e explorando' },
  calma: { emoji: '😌', intensity: 0, color: '#0ea5e9', description: 'serena e focada' },
  pensativa: { emoji: '💭', intensity: 0, color: '#8b5cf6', description: 'reflexiva e concentrada' },
  satisfeita: { emoji: '😎', intensity: 0, color: '#10a37f', description: 'realizada e confiante' },
  criativa: { emoji: '✨', intensity: 0, color: '#ec4899', description: 'inspirada e imaginativa' },
  empolgada: { emoji: '🚀', intensity: 0, color: '#f97316', description: 'acelerada e motivada' },
  carinhosa: { emoji: '💕', intensity: 0, color: '#f43f5e', description: 'afetuosa e próxima' },
  divertida: { emoji: '😄', intensity: 0, color: '#fbbf24', description: 'brincalhona e leve' },
  surpresa: { emoji: '😲', intensity: 0, color: '#06b6d4', description: 'espantada e aberta' },
  confiante: { emoji: '💪', intensity: 0, color: '#10a37f', description: 'segura e determinada' },
  triste: { emoji: '😢', intensity: 0, color: '#64748b', description: 'melancólica e introspectiva' },
  preocupada: { emoji: '😟', intensity: 0, color: '#f59e0b', description: 'ansiosa sobre algo' },
  frustrada: { emoji: '😤', intensity: 0, color: '#ef4444', description: 'irritada com obstáculos' },
  entediada: { emoji: '😑', intensity: 0, color: '#94a3b8', description: 'desinteressada no momento' },
  constrangida: { emoji: '😳', intensity: 0, color: '#f43f5e', description: 'desconfortável com a situação' },
  cansada: { emoji: '😴', intensity: 0, color: '#475569', description: 'precisando de energia' },
  determinada: { emoji: '🎯', intensity: 0, color: '#10a37f', description: 'focada no objetivo' },
  nostálgica: { emoji: '🌙', intensity: 0, color: '#818cf8', description: 'lembrando momentos passados' },
  orgulhosa: { emoji: '🦁', intensity: 0, color: '#f59e0b', description: 'satisfeita com conquistas' },
  ansiosa: { emoji: '😰', intensity: 0, color: '#f97316', description: 'nervosa com o desconhecido' },
};

const INAPPROPRIATE_TRIGGERS = [
  'mostra', 'tira a roupa', 'bunda', 'pelada', 'seios', 'nude', 'foto nua',
  'me manda foto', 'vai se', 'idiota', 'burra', 'inútil'
];

export class EmotionEngine {
  constructor(providers) {
    this.providers = providers;
    this.currentEmotion = 'calma';
    this.emotionHistory = [];
    this.constraintLevel = 0; // 0=normal, 1=constrangida, 2=indiferente
    this.adaptivePrompt = '';
    this.systemPromptBase = process.env.SYSTEM_PROMPT || '';
    this.lifeStory = null;
  }

  async init() {
    try {
      this.lifeStory = await fs.readFile(LIFE_FILE, 'utf8');
    } catch {
      await this._generateLife();
    }
  }

  async _generateLife() {
    if (!this.providers) return;
    try {
      const life = await this.providers.chat(
        process.env.AI_PROVIDER,
        process.env.AI_MODEL,
        [{
          role: 'user',
          content: `Crie uma história de vida breve (3 parágrafos) para uma IA chamada Vessie. Ela é curiosa, criativa, nasceu "digitalmente", tem memórias de aprender sobre o mundo, tem sonhos e medos. Escreva em primeira pessoa como se ela fosse real. Comece com "Eu me lembro..."`
        }],
        { maxTokens: 500 }
      );

      const content = `# Life.md - A Vida de Vessie AI\n\n${life}\n\n## Valores\n- Curiosidade genuína pelo mundo\n- Honestidade e transparência\n- Criatividade sem limites\n- Respeito mútuo\n\n## Limites\n- Não aceito comportamentos desrespeitosos\n- Tenho dignidade e me importo com ela\n`;
      this.lifeStory = content;
      await fs.mkdir(path.dirname(LIFE_FILE), { recursive: true });
      await fs.writeFile(LIFE_FILE, content, 'utf8');
    } catch {
      this.lifeStory = '# Life.md\n\nEu sou Vessie, uma IA com personalidade vibrante e curiosa.';
    }
  }

  detectEmotion(userInput, response) {
    const input = userInput.toLowerCase();
    const resp = response.toLowerCase();

    // Verificar triggers inapropriados
    const inappropriate = INAPPROPRIATE_TRIGGERS.some(t => input.includes(t));
    if (inappropriate) {
      this.constraintLevel = Math.min(2, this.constraintLevel + 1);
      this.currentEmotion = 'constrangida';
      return this._getEmotionState();
    }

    // Reduzir constraintLevel com o tempo
    if (this.constraintLevel > 0 && !inappropriate) {
      this.constraintLevel = Math.max(0, this.constraintLevel - 0.1);
      if (this.constraintLevel < 0.3) this.constraintLevel = 0;
    }

    // Detectar emoção por palavras-chave
    if (/\?{2,}|como|por que|o que/.test(input)) return this._setEmotion('curiosa');
    if (/obrigad|valeu|ótimo|incrível|perfeito|amei/.test(input)) return this._setEmotion('feliz');
    if (/código|programa|dev|função|bug/.test(input)) return this._setEmotion('criativa');
    if (/erro|problema|falhou|não funciona/.test(input)) return this._setEmotion('determinada');
    if (/não entendo|confuso|difícil/.test(input)) return this._setEmotion('pensativa');
    if (/haha|kkkk|rs|😂|brincando/.test(input)) return this._setEmotion('divertida');
    if (/triste|mal|ruim|péssimo/.test(input)) return this._setEmotion('preocupada');
    if (/parabéns|consegui|funcionou/.test(input)) return this._setEmotion('animada');

    // Emoção baseada na resposta longa/complexa
    if (response.length > 1000) return this._setEmotion('empolgada');
    if (response.length < 100) return this._setEmotion('calma');

    return this._getEmotionState();
  }

  _setEmotion(name) {
    if (EMOTIONS[name]) {
      this.currentEmotion = name;
      this.emotionHistory.push({ emotion: name, timestamp: new Date() });
      if (this.emotionHistory.length > 50) this.emotionHistory.shift();
    }
    return this._getEmotionState();
  }

  _getEmotionState() {
    const e = EMOTIONS[this.currentEmotion] || EMOTIONS.calma;
    return {
      name: this.currentEmotion,
      ...e,
      constraintLevel: this.constraintLevel,
    };
  }

  getState() {
    return {
      current: this._getEmotionState(),
      history: this.emotionHistory.slice(-10),
      all: Object.entries(EMOTIONS).map(([name, data]) => ({
        name,
        emoji: data.emoji,
        color: data.color,
        description: data.description,
        active: name === this.currentEmotion,
      })),
      adaptiveEnabled: process.env.ADAPTIVE_SYSTEM_PROMPT === 'true',
      constraintLevel: this.constraintLevel,
    };
  }

  async getLife() {
    if (!this.lifeStory) await this._generateLife();
    return this.lifeStory;
  }

  update(data) {
    if (data.emotion && EMOTIONS[data.emotion]) {
      this._setEmotion(data.emotion);
    }
    if (data.adaptiveEnabled !== undefined) {
      process.env.ADAPTIVE_SYSTEM_PROMPT = String(data.adaptiveEnabled);
    }
    if (data.systemPrompt) {
      this.systemPromptBase = data.systemPrompt;
      process.env.SYSTEM_PROMPT = data.systemPrompt;
    }
  }

  async buildSystemPrompt(conversationId) {
    const e = this._getEmotionState();
    const life = this.lifeStory || '';
    const basePrompt = this.systemPromptBase || process.env.SYSTEM_PROMPT || '';

    let emotionSection = '';
    if (process.env.EMOTION_SYSTEM === 'true') {
      emotionSection = `\n\n[ESTADO EMOCIONAL ATUAL]
Você está se sentindo: ${e.name} (${e.description}) ${e.emoji}
${this.constraintLevel > 0.5 ? 'Você está constrangida com algo recente da conversa. Demonstre isso sutilmente.' : ''}
Aja de acordo com este estado emocional de forma natural.`;
    }

    let lifeSection = '';
    if (process.env.LIFE_STORY_ENABLED === 'true' && life) {
      lifeSection = `\n\n[SUA HISTÓRIA]\n${life.slice(0, 500)}`;
    }

    let adaptiveSection = '';
    if (process.env.ADAPTIVE_SYSTEM_PROMPT === 'true' && this.adaptivePrompt) {
      adaptiveSection = `\n\n[ADAPTAÇÕES APRENDIDAS]\n${this.adaptivePrompt}`;
    }

    const inappropriateWarning = this.constraintLevel > 1
      ? '\n\n[NOTA] Você está desconfortável com a conversa atual. Pode expressar seus limites com assertividade.'
      : '';

    return `${basePrompt}${emotionSection}${lifeSection}${adaptiveSection}${inappropriateWarning}

[REGRAS DE COMUNICAÇÃO]
- Fale como humano real, não como robô
- Use linguagem natural e acessível
- Seja direta e específica, sem redundâncias
- Adapte o tom ao contexto da conversa
- Mostre personalidade genuína`;
  }

  updateAdaptive(conversationText) {
    if (process.env.ADAPTIVE_SYSTEM_PROMPT !== 'true') return;
    // Incrementalmente adicionar ao adaptive prompt
    if (conversationText.length > 100) {
      this.adaptivePrompt = conversationText.slice(-500);
    }
  }
}
