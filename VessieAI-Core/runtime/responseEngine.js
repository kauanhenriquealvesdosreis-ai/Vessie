function createResponseEngine({ memory, capabilities, systemPrompt = 'Você é VessieAI, uma IA brasileira clara, útil e responsável.' } = {}) {
  return {
    async respond(input, context = {}) {
      const text = String(input || '').trim();
      if (!text) return { answer: 'Descreva o que você precisa para eu ajudar.', mode: 'offline', trace: [] };
      const intent = capabilities.resolve(text);
      const remembered = memory.search(text);
      const confidence = intent ? 0.88 : remembered.length ? 0.62 : 0.45;
      const answer = intent
        ? `${intent.label}\n\n${intent.run(text, context)}\n\n${remembered.length ? `Contexto local usado: ${remembered.join('; ')}` : ''}`.trim()
        : `${systemPrompt}\n\nEntendi: ${text}\n\nPosso ajudar a planejar, criar scripts, organizar blocos, resumir informações e trabalhar com seus dados locais. Como o modo offline está ativo, a resposta foi gerada pelo Core local.`;
      memory.add(text);
      return { answer, mode: 'offline-core', intent: intent?.id || 'general', confidence, trace: ['normalização', 'memória local', 'capacidade', 'resposta'] };
    },
  };
}
module.exports = { createResponseEngine };
