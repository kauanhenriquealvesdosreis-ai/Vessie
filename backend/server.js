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

    // Construir system prompt com personalidade e memória
    const systemPrompt = await core.personality.buildSystemPrompt(conversationId);
    const memory = await core.memory.getRelevant(lastMsg.content);

    const fullMessages = [
      { role: 'system', content: systemPrompt + (memory ? `\n\n[MEMÓRIA]\n${memory}` : '') },
      ...enhancedMessages
    ];

    send({ type: 'start', conversationId });

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

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await core.init();
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║          VESSIE AI SERVER            ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  URL: http://localhost:${PORT}          ║`);
  console.log(`║  Provider: ${(process.env.AI_PROVIDER || 'lmstudio').padEnd(25)}║`);
  console.log(`║  Model: ${(process.env.AI_MODEL || 'local-model').padEnd(28)}║`);
  console.log('╚══════════════════════════════════════╝\n');
});
