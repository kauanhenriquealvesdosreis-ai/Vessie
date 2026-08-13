import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { VessieCore } from './vessieai-core/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const core = new VessieCore();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Segurança DM-only (acesso somente por DM/token seguro) ────────────────────
// Quando DM_ONLY=true, TODAS as rotas /api exigem o token DM_TOKEN no header
// 'x-dm-token' (ou o campo token no body). Sem token/errado → 401.
function isDm(int) {
  const token = int.headers?.['x-dm-token'] || int.headers?.['x-dmtoken'] || (int.body && int.body.token);
  return core.storage?.isAuthorized(token);
}
app.use('/api', (req, res, next) => {
  if (process.env.DM_ONLY !== 'true') return next();
  if (req.path === '/health') return next();
  if (req.path.startsWith('/dub')) return next(); // dublagem é público
  if (isDm(req)) return next();
  return res.status(401).json({ error: 'Acesso negado: requisição não autorizada (DM-only). Envie o token.' });
});

// ─── Helpers de resposta de erro/unificação ────────────────────────────────────
const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, status, msg) => res.status(status || 500).json({ ok: false, error: msg });

// ─── WebSocket ─────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let payload;
    try { payload = JSON.parse(raw); } catch { return; }

    if (payload.type === 'chat') {
      await handleStreamingChat(ws, payload);
    } else if (payload.type === 'agent') {
      await handleAgentLoop(ws, payload);
    }
  });
});

async function handleStreamingChat(ws, payload) {
  const { conversationId, messages, model, provider, options = {} } = payload;
  const send = (data) => ws.readyState === 1 && ws.send(JSON.stringify(data));

  try {
    // Corrigir ortografia do input
    const lastMsg = messages[messages.length - 1];
    let correctedInput = lastMsg.content;
    if (process.env.SPELL_CORRECTION === 'true') {
      correctedInput = core.thinking.correctSpelling(lastMsg.content);
    }

    // Aprimorar prompt se ativado
    let enhancedMessages = [...messages];
    if (process.env.PROMPT_ENHANCEMENT === 'true' && options.enhance !== false) {
      const enhanced = await core.thinking.enhancePrompt(lastMsg.content, messages);
      enhancedMessages[enhancedMessages.length - 1] = { ...lastMsg, content: enhanced };
    }

    // Construir system prompt com personalidade, memória, tags e contexto MCP
    const systemPrompt = await core.personality.buildSystemPrompt(conversationId);
    const memory = await core.memory.getRelevant(lastMsg.content);
    const tagInstructions = core.tags ? core.tags.buildTagInstructions() : '';
    let mcpContext = '';
    try { if (core.mcp) mcpContext = await core.mcp.buildContext(lastMsg.content); } catch {}

    const fullMessages = [
      { role: 'system', content: systemPrompt
        + (memory ? `\n\n[MEMÓRIA]\n${memory}` : '')
        + (tagInstructions ? `\n\n${tagInstructions}` : '')
        + (mcpContext ? `\n\n[FERRAMENTAS/RECURSOS DISPONÍVEIS]\n${mcpContext}` : '') },
      ...enhancedMessages
    ];

    send({ type: 'start', conversationId });

    // Verificar cache de resposta (mesma pergunta já respondida → reutiliza)
    const forceFresh = options.forceFresh === true || process.env.RESPONSE_CACHE_ENABLED !== 'true';
    let cached = null;
    if (!forceFresh && core.cache) cached = core.cache.get(lastMsg.content);
    if (cached && cached.response) {
      send({ type: 'chunk', content: cached.response });
      send({ type: 'done', content: cached.response, cached: true, variantCount: cached.variantCount });
      return;
    }

    // Think tags (manual/auto)
    const thinkMode = process.env.THINK_MODE || 'auto';
    let thinkContent = '';

    if (thinkMode !== 'disabled') {
      const thinking = await core.thinking.generateThinking(lastMsg.content, fullMessages);
      if (thinking) {
        thinkContent = thinking;
        send({ type: 'think', content: thinking });
      }
    }

    // Streaming da resposta
    let fullContent = '';
    const selectedProvider = provider || process.env.AI_PROVIDER;
    const selectedModel = model || process.env.AI_MODEL;

    await core.providers.streamChat(
      selectedProvider,
      selectedModel,
      fullMessages,
      options,
      (chunk) => {
        fullContent += chunk;
        send({ type: 'chunk', content: chunk });
      }
    );

    // Armazenar no cache para próxima vez (evita reuso da API)
    if (core.cache && process.env.RESPONSE_CACHE_ENABLED === 'true') {
      core.cache.set(lastMsg.content, fullContent, core.providers).catch(() => {});
    }

    send({ type: 'done', content: fullContent });

    // Atualizar memória em background
    if (process.env.MEMORY_ENABLED === 'true') {
      core.memory.updateFromConversation(conversationId, [
        ...messages,
        { role: 'assistant', content: fullContent }
      ]).catch(() => {});
    }

    // Atualizar emoção com base na conversa
    if (process.env.EMOTION_SYSTEM === 'true') {
      const emotion = core.personality.detectEmotion(lastMsg.content, fullContent);
      send({ type: 'emotion', emotion });
    }

    // Salvar Share-Thinking
    if (process.env.SHARE_THINKING_ENABLED === 'true') {
      core.sharing.update(conversationId, fullMessages, fullContent).catch(() => {});
    }

  } catch (err) {
    send({ type: 'error', message: err.message });
  }
}

async function handleAgentLoop(ws, payload) {
  const { task, conversationId, provider, model } = payload;
  const send = (data) => ws.readyState === 1 && ws.send(JSON.stringify(data));

  try {
    await core.agentLoop.run(task, {
      provider: provider || process.env.AI_PROVIDER,
      model: model || process.env.AI_MODEL,
      onStep: (step) => send({ type: 'agent_step', ...step }),
      onDone: (result) => send({ type: 'agent_done', result }),
      onError: (err) => send({ type: 'agent_error', message: err.message }),
    });
  } catch (err) {
    send({ type: 'agent_error', message: err.message });
  }
}

// ─── REST Routes ───────────────────────────────────────────────────────────────

// Modelos disponíveis
app.get('/api/models', async (req, res) => {
  try {
    const models = await core.providers.listModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provedores configurados
app.get('/api/providers', (req, res) => {
  res.json({ providers: core.providers.getConfigured() });
});

// Trocar provedor/modelo
app.post('/api/providers/switch', (req, res) => {
  const { provider, model } = req.body;
  core.providers.setActive(provider, model);
  core.sharing.notifyModelSwitch(provider, model).catch(() => {});
  res.json({ ok: true, provider, model });
});

// Memória
app.get('/api/memory', async (req, res) => {
  const content = await core.memory.read();
  res.json({ content });
});

app.post('/api/memory/update', async (req, res) => {
  await core.memory.write(req.body.content);
  res.json({ ok: true });
});

app.post('/api/memory/clear', async (req, res) => {
  await core.memory.clear();
  res.json({ ok: true });
});

// Skills
app.get('/api/skills', async (req, res) => {
  const skills = await core.skills.list();
  res.json({ skills });
});

app.get('/api/skills/:name', async (req, res) => {
  const skill = await core.skills.get(req.params.name);
  res.json({ skill });
});

app.post('/api/skills/save', async (req, res) => {
  const { name, content, metadata } = req.body;
  await core.skills.save(name, content, metadata);
  res.json({ ok: true });
});

app.delete('/api/skills/:name', async (req, res) => {
  await core.skills.delete(req.params.name);
  res.json({ ok: true });
});

// Contexto
app.get('/api/context', async (req, res) => {
  const contexts = await core.context.list();
  res.json({ contexts });
});

app.post('/api/context/create', async (req, res) => {
  const ctx = await core.context.create(req.body);
  res.json({ context: ctx });
});

// Personalidade e Emoções
app.get('/api/personality', (req, res) => {
  res.json(core.personality.getState());
});

app.post('/api/personality/update', (req, res) => {
  core.personality.update(req.body);
  res.json({ ok: true });
});

app.get('/api/personality/life', async (req, res) => {
  const life = await core.personality.getLife();
  res.json({ life });
});

// Pesquisa Web
app.post('/api/search', async (req, res) => {
  const { query, limit = 5 } = req.body;
  try {
    const results = await core.search.query(query, limit);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Projetos
app.get('/api/projects', async (req, res) => {
  const projects = await core.projects.list();
  res.json({ projects });
});

app.post('/api/projects/select', (req, res) => {
  core.projects.select(req.body.path);
  res.json({ ok: true });
});

app.get('/api/projects/files', async (req, res) => {
  const files = await core.projects.listFiles();
  res.json({ files });
});

app.get('/api/projects/file', async (req, res) => {
  const content = await core.projects.readFile(req.query.path);
  res.json({ content });
});

app.post('/api/projects/file', async (req, res) => {
  await core.projects.writeFile(req.body.path, req.body.content);
  res.json({ ok: true });
});

app.delete('/api/projects/file', async (req, res) => {
  await core.projects.deleteFile(req.body.path);
  res.json({ ok: true });
});

// Detecção de linguagem de programação
app.post('/api/detect-language', (req, res) => {
  const { code } = req.body;
  const lang = core.projects.detectLanguage(code);
  res.json({ language: lang });
});

// Share-Thinking
app.get('/api/sharing', async (req, res) => {
  const content = await core.sharing.read();
  res.json({ content });
});

// Config (leitura de .env redatada)
app.get('/api/config', (req, res) => {
  res.json({
    provider: process.env.AI_PROVIDER,
    model: process.env.AI_MODEL,
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
    thinkMode: process.env.THINK_MODE,
    agentLoop: process.env.AGENT_LOOP_ENABLED === 'true',
    emotionSystem: process.env.EMOTION_SYSTEM === 'true',
    adaptivePrompt: process.env.ADAPTIVE_SYSTEM_PROMPT === 'true',
    memoryEnabled: process.env.MEMORY_ENABLED === 'true',
    webSearch: process.env.WEB_SEARCH_ENABLED === 'true',
  });
});

app.post('/api/config', (req, res) => {
  Object.entries(req.body).forEach(([k, v]) => {
    process.env[k] = String(v);
  });
  res.json({ ok: true });
});

// Chat sem streaming (fallback)
app.post('/api/chat', async (req, res) => {
  const { messages, provider, model, options } = req.body;
  try {
    const response = await core.providers.chat(
      provider || process.env.AI_PROVIDER,
      model || process.env.AI_MODEL,
      messages,
      options
    );
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Geração de código avançada
app.post('/api/code/generate', async (req, res) => {
  try {
    const result = await core.codeEngine.generate(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compressão de tokens
app.post('/api/compress', async (req, res) => {
  const { content } = req.body;
  const compressed = core.thinking.compressTokens(content);
  res.json({ compressed });
});

// Questionário de foco
app.post('/api/questionnaire', async (req, res) => {
  const { answers } = req.body;
  const focus = core.context.analyzeFocus(answers);
  res.json({ focus });
});

// ─── Dublagem / Tradução de idiomas ────────────────────────────────────────────
app.get('/api/dub/languages', async (req, res) => {
  try {
    const languages = await core.dubbing.languages();
    res.json({ languages, status: core.dubbing.status() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dub/translate', async (req, res) => {
  try {
    const { text, from, to } = req.body || {};
    const result = await core.dubbing.translate(text, to, from || 'auto');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dub/detect', async (req, res) => {
  try {
    const language = await core.dubbing.detect((req.body || {}).text || '');
    res.json({ language });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tags System (<Think>, <Code>, <Interpretagem>) ───────────────────────────
app.get('/api/tags/status', (req, res) => res.json({
  enabled: process.env.TAGS_ENABLED !== 'false',
  mode: process.env.TAG_MODE || 'auto',
  instructions: core.tags ? core.tags.buildTagInstructions() : '',
}));
app.post('/api/tags/parse', (req, res) => {
  if (!core.tags) return fail(res, 500, 'Tags nao inicializado');
  res.json({ parsed: core.tags.parse(req.body.content || '') });
});
app.post('/api/tags/interpret', async (req, res) => {
  try {
    const questions = core.tags ? await core.tags.interpret(req.body.prompt || '') : null;
    res.json({ questions });
  } catch (err) { fail(res, 500, err.message); }
});

app.post('/api/tags/variant', async (req, res) => {
  try { const slug = await core.tags.saveVariant(req.body.name, req.body.content, req.body.tags); ok(res, { slug }); }
  catch (err) { fail(res, 500, err.message); }
});

// ─── Compressão avançada (token/código) ───────────────────────────────────────
app.post('/api/compress/code', (req, res) => {
  const { code, level = 'advanced' } = req.body || {};
  const compressed = core.compressor.compressCode(code || '', level);
  ok(res, { compressed, level, originalTokens: core.compressor.estimateTokens(code || ''), compressedTokens: core.compressor.estimateTokens(compressed) });
});
app.post('/api/compress/text', (req, res) => {
  const el = req.body || {};
  const compressed = core.compressor.compressText(el.text, el.maxLen);
  ok(res, { compressed, length: compressed.length });
});
app.post('/api/compress/dub', async (req, res) => {
  try { ok(res, await core.compressor.dubCode((req.body || {}).code || '', core.providers)); }
  catch (err) { fail(res, 500, err.message); }
});

// ─── Cache de respostas (economia de tokens/API) ──────────────────────────────
app.get('/api/cache', (req, res) => ok(res, { stats: core.cache.stats(), entries: core.cache.list ? core.cache.list() : [] }));
app.delete('/api/cache', async (req, res) => { await core.cache.clear(); ok(res, { cleared: true }); });

// ─── MCP (Model Context Protocol) ─────────────────────────────────────────────
app.get('/api/mcp/status', (req, res) => res.json(core.mcp ? core.mcp.status() : { servers: 0 }));
app.post('/api/mcp/connect', async (req, res) => {
  try { const r = await core.mcp.connect(req.body || {}); ok(res, r); }
  catch (err) { fail(res, 500, err.message); }
});
app.post('/api/mcp/connectAll', async (req, res) => {
  try { ok(res, (await core.mcp.connectAll()) || []); }
  catch (err) { fail(res, 500, err.message); }
});
app.post('/api/mcp/tool', async (req, res) => {
  try { const r = await core.mcp.callTool((req.body || {}).name, (req.body || {}).args); ok(res, { result: r }); }
  catch (err) { fail(res, 500, err.message); }
});
app.post('/api/mcp/register', (req, res) => {
  core.mcp.register((req.body || {}).kind, (req.body || {}).item);
  ok(res, { tools: core.mcp.tools.length });
});

// ─── Multi-Agent ──────────────────────────────────────────────────────────────
app.get('/api/agents', (req, res) => res.json({ agents: core.multiAgent ? core.multiAgent.listAgents() : [] }));
app.post('/api/agents/add', (req, res) => {
  const a = core.multiAgent.addAgent(req.body || {});
  res.json({ agent: a });
});
app.post('/api/agents/run', async (req, res) => {
  try {
    const body = req.body || {};
    const results = await core.multiAgent.execute(body.task || '', { provider: body.provider, model: body.model });
    let consolidated = null;
    if (body.consolidate !== false && results.length > 1) consolidated = await core.multiAgent.consolidate(body.task || '', results);
    res.json({ results, consolidated });
  } catch (err) { fail(res, 500, err.message); }
});

// ─── Auto-Evolução / Skills automáticas / Módulos ────────────────────────────
app.post('/api/skills/generate', async (req, res) => {
  try {
    const body = req.body || {};
    let slug;
    if (body.description && body.result) slug = await core.skills.generate(body.description, body.result, core.providers);
    else if (body.description) slug = await core.autoEvolution.generateSkill(body.description);
    ok(res, { slug, name: slug });
  } catch (err) { fail(res, 500, err.message); }
});
app.post('/api/evolution/forceModule', async (req, res) => {
  try { const slug = await core.autoEvolution.forceModule((req.body || {}).context || ''); ok(res, { module: slug }); }
  catch (err) { fail(res, 500, err.message); }
});
app.post('/api/evolution/evolveSkill', async (req, res) => {
  try { const slug = await core.autoEvolution.evolveSkill((req.body || {}).name, (req.body || {}).info || ''); ok(res, { slug }); }
  catch (err) { fail(res, 500, err.message); }
});

// ─── Patches (edição por linha sem recriar script) ───────────────────────────
app.get('/api/patches', async (req, res) => ok(res, { patches: await core.patches.list() }));
app.post('/api/patches/apply', async (req, res) => {
  try { ok(res, { code: core.patches.applyPatch((req.body || {}).code || '', (req.body || {}).edits || []) }); }
  catch (err) { fail(res, 500, err.message); }
});
app.post('/api/patches/generate', async (req, res) => {
  try { ok(res, { code: await core.patches.generatePatch((req.body || {}).code || '', (req.body || {}).instruction || '') }); }
  catch (err) { fail(res, 500, err.message); }
});

// ─── Storage seguro (DM-only, AES-256-GCM) ───────────────────────────────────
app.get('/api/storage/list', async (req, res) => {
  try { ok(res, { keys: await core.storage.list((req.body || {}).token) }); }
  catch (err) { fail(res, 401, err.message); }
});
app.post('/api/storage/save', async (req, res) => {
  try { ok(res, await core.storage.save((req.body || {}).key, (req.body || {}).value, (req.body || {}).token)); }
  catch (err) { fail(res, 401, err.message); }
});
app.post('/api/storage/read', async (req, res) => {
  try { ok(res, { value: await core.storage.read((req.body || {}).key, (req.body || {}).token) }); }
  catch (err) { fail(res, 401, err.message); }
});

// ─── Web Tools (extração/navegação CLI para pesquisa avançada) ───────────────
app.post('/api/search/page', async (req, res) => {
  try { ok(res, { text: await core.search.fetchPage((req.body || {}).url || '') }); }
  catch (err) { fail(res, 500, err.message); }
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => ok(res, {
  status: 'online', dmOnly: process.env.DM_ONLY === 'true', modules: Object.keys(core).filter(k => core[k]).length,
}));

// ─── GGUF (modelo local) ───────────────────────────────────────────────────────
app.get('/api/gguf/status', (req, res) => res.json(core.providers.gguf.statusJSON()));

app.post('/api/gguf/reload', async (req, res) => {
  try {
    await core.providers.gguf.reload();
    res.json(core.providers.gguf.statusJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API compatível com OpenAI (permite usar o backend como provedor) ─────────
app.get('/v1/models', async (req, res) => {
  const models = await core.providers.listModels();
  res.json({
    object: 'list',
    data: models.map(m => ({ id: m.id, object: 'model', owned_by: m.provider || 'vessie' })),
  });
});

app.post('/v1/chat/completions', async (req, res) => {
  const { messages, model, stream = false, temperature, max_tokens } = req.body || {};

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const mk = () => ({ id: `vessie-${Date.now()}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      await core.providers.streamChat('auto', model, messages, { temperature, maxTokens: max_tokens }, (chunk) => {
        send({ ...mk(), choices: [{ index: 0, delta: { content: chunk } }] });
      });
      send({ ...mk(), choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
      res.write('data: [DONE]\n\n');
    } catch (err) {
      send({ ...mk(), error: { message: err.message } });
    }
    res.end();
    return;
  }

  try {
    const content = await core.providers.chat('auto', model, messages, { temperature, maxTokens: max_tokens });
    res.json({
      id: `vessie-${Date.now()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await core.init();
  await core.providers.gguf.init().catch((err) => console.error('[GGUF] init error:', err.message));

  const ggufReady = core.providers.gguf.ready;
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║            VESSIE AI SERVER              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  URL: http://localhost:${PORT}              ║`);
  console.log(`║  Provider: ${(ggufReady ? 'gguf (local)' : (process.env.AI_PROVIDER || 'lmstudio')).padEnd(28)}║`);
  console.log(`║  Model: ${((core.providers.gguf.info?.name) || process.env.AI_MODEL || 'local-model').slice(0, 32).padEnd(31)}║`);
  console.log(`║  GGUF: ${(ggufReady ? '✓ ' + core.providers.gguf.info.size : '✕ (sem LocalModel.gguf)').padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════╝\n');
  if (!ggufReady) {
    console.log('[AVISO] Para rodar um modelo GGUF, coloque LocalModel.gguf em models/ e reinicie.');
    console.log('[AVISO] Sem GGUF, o sistema usará LM Studio / OpenAI / Anthropic conforme o .env.');
  }
});
