const DEFAULT_CORE = 'http://localhost:3000'

async function request(path, options = {}, baseUrl = DEFAULT_CORE) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout || 4500)
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { ...options, signal: controller.signal })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Core respondeu ${response.status}`)
    return data
  } finally { clearTimeout(timer) }
}

export function createCoreClient(baseUrl = DEFAULT_CORE) {
  return {
    baseUrl,
    async health() { try { return { online: true, ...(await request('/api/status', {}, baseUrl)) } } catch (error) { return { online: false, error: error.message } } },
    async respond(input, context = {}) { return request('/api/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, context }) }, baseUrl) },
    async syncScratch(scratch) { return request('/api/scratch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scratch) }, baseUrl) },
  }
}

export async function offlineResponse(input, context = {}) {
  const text = String(input || '').trim()
  if (!text) return { answer: 'Descreva o que você precisa.', mode: 'offline-browser' }
  const normalized = text.toLowerCase()
  const intent = normalized.includes('script') || normalized.includes('código') ? 'Criação de scripts' : normalized.includes('bloco') || normalized.includes('personalidade') ? 'Scratch Studio' : normalized.includes('plano') || normalized.includes('organizar') ? 'Planejamento' : 'Assistente local'
  return { answer: `Modo offline ativo — ${intent}.\n\nEntendi: ${text}\n\nPosso organizar isso em etapas, blocos e arquivos sem enviar seus dados para a internet.`, mode: 'offline-browser', intent, context }
} 

export default createCoreClient
