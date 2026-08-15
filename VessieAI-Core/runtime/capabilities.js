function createCapabilityRegistry(custom = []) {
  const builtins = [
    { id: 'plan', label: 'Planejamento', match: /planej|organ|etapa/i, run: text => `Plano inicial para “${text}”:\n1. Definir objetivo\n2. Separar tarefas\n3. Validar o resultado` },
    { id: 'script', label: 'Criação de scripts', match: /script|código|codigo|program/i, run: text => `Esqueleto seguro para “${text}”:\n- entrada validada\n- execução isolada\n- logs e tratamento de erro` },
    { id: 'scratch', label: 'Blocos Scratch', match: /bloco|scratch|personalidade|agente/i, run: text => `Bloco sugerido:\nNome: ${text.slice(0, 36)}\nTipo: comportamento\nAção: aplicar como regra ativa no workspace` },
  ];
  const all = [...custom, ...builtins];
  return { list: () => all.map(({ id, label }) => ({ id, label })), resolve: text => { const normalized = String(text || ''); return all.find(item => item.match?.test(normalized)); }, register: item => all.unshift(item) };
}
module.exports = { createCapabilityRegistry };
