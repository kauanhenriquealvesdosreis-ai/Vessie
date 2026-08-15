export const OFFLINE_SCHEMA_VERSION = 2;

export const defaultWorkspace = {
  schemaVersion: OFFLINE_SCHEMA_VERSION,
  projectName: 'Minha IA brasileira',
  providerPreference: 'lmstudio',
  personalityBlocks: [
    { id: 'role', type: 'Papel', title: 'Você é uma mentora de estudos', description: 'Ajude estudantes a aprender com confiança.', value: 'mentora de estudos', enabled: true },
    { id: 'tone', type: 'Tom de voz', title: 'Fale de um jeito acolhedor', description: 'Use uma linguagem próxima, clara e positiva.', value: 'acolhedor, claro e positivo', enabled: true },
    { id: 'rule', type: 'Regra', title: 'Explique antes de responder', description: 'Mostre o raciocínio em passos simples.', value: 'explique conceitos em passos simples antes de responder', enabled: true },
    { id: 'language', type: 'Idioma', title: 'Responda em português do Brasil', description: 'Use exemplos brasileiros.', value: 'português do Brasil', enabled: true },
  ],
  memory: [],
  scripts: [],
  agents: [],
  settings: { lmBase: 'http://127.0.0.1:1234/v1', model: '', coreUrl: 'http://127.0.0.1:3000' },
};

export function buildSystemPrompt(blocks = []) {
  return blocks.filter((block) => block.enabled !== false).map((block) => `- ${block.title}: ${block.value}`).join('\n');
}

export function normalizeWorkspace(value) {
  return { ...defaultWorkspace, ...value, schemaVersion: OFFLINE_SCHEMA_VERSION, personalityBlocks: value?.personalityBlocks || defaultWorkspace.personalityBlocks, memory: value?.memory || [], scripts: value?.scripts || [], agents: value?.agents || [], settings: { ...defaultWorkspace.settings, ...(value?.settings || {}) } };
}

export function offlineReply(input, workspace) {
  const text = input.toLowerCase();
  const prompt = buildSystemPrompt(workspace.personalityBlocks);
  if (text.includes('personalidade') || text.includes('prompt')) return `Sua personalidade está montada com ${workspace.personalityBlocks.filter((block) => block.enabled !== false).length} blocos.\n\n${prompt}`;
  if (text.includes('script') || text.includes('código')) return 'Posso criar scripts em lote offline. Descreva a linguagem, o objetivo e quantos arquivos você precisa.';
  if (text.includes('memória')) return `A memória local contém ${workspace.memory.length} itens e fica disponível mesmo sem internet.`;
  return `Estou no modo offline híbrido. Ainda consigo organizar sua personalidade, criar scripts por templates, consultar memória local e preparar tarefas para o Core.\n\nPedido recebido: “${input}”`;
}

export function createScriptBatch(description, count, language = 'javascript') {
  const safeCount = Math.max(1, Math.min(100, Number(count) || 1));
  const extension = { javascript: 'js', typescript: 'ts', python: 'py', html: 'html', css: 'css', shell: 'sh' }[language] || 'txt';
  return Array.from({ length: safeCount }, (_, index) => ({ id: crypto.randomUUID?.() || `${Date.now()}-${index}`, name: `script-${String(index + 1).padStart(3, '0')}.${extension}`, language, description, content: `// Gerado offline pelo VessieAI\n// Objetivo: ${description}\n\nexport function executar${index + 1}() {\n  console.log(${JSON.stringify(description)});\n}\n` }));
}

export function downloadScripts(scripts) {
  const content = scripts.map((script) => `===== ${script.name} =====\n${script.content}`).join('\n\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'vessieai-scripts.txt'; anchor.click(); URL.revokeObjectURL(url);
}
