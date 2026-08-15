export const STORAGE_KEY = 'vessieai:scratch-studio:v2'

export const blockCatalog = [
  { type: 'event', color: '#e6a05e', label: 'Quando iniciar', shape: 'hat', fields: [] },
  { type: 'personality', color: '#b7d889', label: 'Definir personalidade', fields: [{ key: 'value', label: 'personalidade', placeholder: 'especialista claro e acolhedor' }] },
  { type: 'rule', color: '#8bd0bd', label: 'Criar regra', fields: [{ key: 'value', label: 'regra', placeholder: 'explique antes de responder' }] },
  { type: 'memory', color: '#86a8df', label: 'Guardar na memória', fields: [{ key: 'value', label: 'informação', placeholder: 'o usuário está estudando...' }] },
  { type: 'agent', color: '#c39cdb', label: 'Executar agente', fields: [{ key: 'value', label: 'agente', placeholder: 'organizador de estudos' }] },
  { type: 'condition', color: '#e58d9a', label: 'Se acontecer', fields: [{ key: 'value', label: 'condição', placeholder: 'usuário pedir um script' }] },
  { type: 'action', color: '#e0c477', label: 'Gerar resposta', fields: [{ key: 'value', label: 'instrução', placeholder: 'responda em passos curtos' }] },
  { type: 'custom', color: '#d7e8e2', label: 'Bloco customizado', fields: [{ key: 'value', label: 'configuração', placeholder: 'descreva o comportamento' }] },
]

export function makeBlock(type, overrides = {}) { const definition = blockCatalog.find((item) => item.type === type) || blockCatalog.at(-1); return { id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, label: definition.label, color: definition.color, value: definition.fields[0]?.placeholder || '', enabled: true, ...overrides } }
export function defaultScratch() { return { name: 'Minha IA brasileira', description: 'Sistema criado no Scratch Studio', blocks: [makeBlock('event'), makeBlock('personality'), makeBlock('rule'), makeBlock('action')], customBlocks: [], variables: [{ id: 'tone', name: 'tom', value: 'claro e acolhedor' }], history: [], lastRun: null } }
export function normalizeScratch(value) { const base = defaultScratch(); const next = { ...base, ...(value || {}) }; next.blocks = Array.isArray(next.blocks) ? next.blocks.filter((block) => block && block.id).map((block) => ({ ...makeBlock(block.type || 'custom'), ...block })) : base.blocks; next.customBlocks = Array.isArray(next.customBlocks) ? next.customBlocks : []; return next }
export function loadScratch() { try { return normalizeScratch(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) } catch { return defaultScratch() } }
export function saveScratch(scratch) { const value = normalizeScratch(scratch); localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); return value }
export function validateScratch(scratch) { const errors = []; if (!scratch.name?.trim()) errors.push('Dê um nome ao sistema.'); if (!scratch.blocks?.length) errors.push('Adicione pelo menos um bloco.'); if (scratch.blocks?.some((block) => block.enabled !== false && !block.value?.trim() && block.type !== 'event')) errors.push('Preencha o valor de todos os blocos ativos.'); return { valid: errors.length === 0, errors } }
export function compileScratch(scratch) { const validation = validateScratch(scratch); const lines = scratch.blocks.filter((block) => block.enabled !== false).map((block) => `${block.label}: ${block.value || 'configurado'}`); return [`Sistema: ${scratch.name}`, scratch.description, '', ...lines, '', validation.valid ? '# configuração válida' : `# atenção: ${validation.errors.join(' ')}`].join('\n') }
export function runScratch(scratch, input = 'Teste do sistema') { const validation = validateScratch(scratch); const compiled = compileScratch(scratch); return { id: Date.now(), input, output: `${validation.valid ? 'Execução concluída.' : 'Execução com avisos.'}\n\n${compiled}\n\nEntrada: ${input}\nResposta: processei sua solicitação com os blocos configurados.`, validation, createdAt: new Date().toISOString() } }
export function exportScratch(scratch) { const blob = new Blob([JSON.stringify(normalizeScratch(scratch), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${scratch.name.toLowerCase().replace(/\s+/g, '-')}.scratch.json`; anchor.click(); URL.revokeObjectURL(url) }
export function importScratch(file, onLoad) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { onLoad(normalizeScratch(JSON.parse(reader.result))) } catch { onLoad(null) } }; reader.readAsText(file) }
