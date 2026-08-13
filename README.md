# Vessie AI

Interface web (React + Vite) de chat com IA + **servidor local** que executa
modelos **GGUF** (arquitetura llama.cpp) diretamente na sua máquina.

## Estrutura

```
├─ server.js           ← Servidor local (Express + WebSocket) — roda tudo
├─ vessieai-core/      ← Núcleo de IA (Node): providers, memória, emoções, thinking, agentes, dublagem…
│   ├─ agents/         → Agent Loop (observar → pensar → agir → resultado, com retry + memória)
│   ├─ core/           → TagSystem (<Think>, <Code>, <Interpretagem>)
│   ├─ compression/    → TokenCompressor (compressão código/texto, dublagem de código)
│   ├─ cache/          → ResponseCache (reuso de respostas + variantes p/ economizar API)
│   ├─ storage/        → SecureStorage (AES-256-GCM, acesso só por DM/token)
│   ├─ mcp/            → McpManager (servidores MCP, tools/resources/prompts)
│   ├─ managers/       → MultiAgentManager (time de modelos em paralelo)
│   ├─ automation/     → AutoEvolution (skills automáticas, Force All Module, auto-sustentação)
│   └─ patches/        → PatchManager (edição por linha, patches reutilizáveis)
├─ src/                ← Frontend React (Vite) — deploy no GitHub Pages
├─ public/             ← Assets estáticos servidos em :3000
├─ models/             ← ★ coloque aqui o seu arquivo LocalModel.gguf
├─ scripts/            ← Utilitários (gguf-info)
├─ docs/               ← Documentação do projeto
├─ vessels-data/       ← Dados gerados em runtime (chat, projetos…)
├─ .env                ← Configuração (IA_PROVIDER, temperatura, sistemas…)
├─ .github/workflows/  ← Deploy automático do frontend no GitHub Pages
├─ vite.config.ts      ← Configuração do Vite (frontend)
├─ tsconfig.json       ← Configuração TypeScript
├─ eslint.config.js    ← Configuração ESLint
├─ postcss.config.mjs  ← Configuração PostCSS
└─ README.md
```

## Rodando

```bash
npm i                 # instala frontend + dependências do servidor
npm run server        # API local em http://localhost:3000 (node server.js)
npm run dev           # frontend Vite em http://localhost:5173 (GitHub Pages)
```

## 🧠 IA local com GGUF (LocalModel.gguf)

O backend executa um modelo **GGUF** em Node usando `node-llama-cpp`, sem
precisar de LM Studio.

**Passo a passo:**

1. Instale as dependências do servidor:

   ```bash
   npm run server:install
   ```

2. Baixe/obtenha um modelo `.gguf` e salve-o como `LocalModel.gguf` na pasta
   [models/](models/README.md):

   ```
   models/
     LocalModel.gguf
   ```

3. Inicie o servidor:

   ```bash
   npm run server        # sobe o servidor em http://localhost:3000
   ```

4. Acesse o servidor (e deixe o frontend apontando para ele):

   - Web UI/API: **http://localhost:3000**
   - Status do modelo: **http://localhost:3000/api/gguf/status**
   - Chat OpenAI-compatível: `POST http://localhost:3000/v1/chat/completions`

> O servidor detecta automaticamente o `.gguf` em `models/`, na raiz
> do repositório, ou em um caminho definido por `GGUF_MODEL_PATH` no
> `.env` (veja `.env.example`).

```bash
npm run gguf:info     # mostra se o modelo GGUF foi encontrado/carregado
```

### Provedores

| Provider | O que faz | Config |
|----------|-----------|--------|
| `gguf`   | Roda `LocalModel.gguf` localmente (padrão) | `AI_PROVIDER=gguf` |
| `lmstudio` | Usa LM Studio (OpenAI-compatível) se GGUF indisponível | `LM_STUDIO_URL` |
| `openai` | Nuvem | `OPENAI_API_KEY` |
| `anthropic` | Nuvem | `ANTHROPIC_API_KEY` |

> Sem um `.gguf` presente, o sistema cai automaticamente para LM Studio
> (ou o que estiver configurado no `.env`).

## 🌍 Dublagem / Tradução de idiomas

O Vessie traduz e "dubla" conversas para **mais de 130 idiomas** usando o
backend (`vessieai-core/dubbing` — Google Translate + LibreTranslate) e a
**síntese de voz via Web Speech API** no navegador.

Na aba **Chat**, use a barra de dublagem (acima do campo de digitação):
- 🇧🇷 **seletor de idioma** — escolha o idioma de destino (PT, EN, ES, JA, …).
- 🔊 **Dublar** — fala a última resposta da IA com voz local do navegador.
- **Traduzir** — mostra a última resposta traduzida para o idioma escolhido.
- **Auto-dublar** — fala cada nova resposta automaticamente.

Endpoints: `GET /api/dub/languages`, `POST /api/dub/translate`,
`POST /api/dub/detect`.

## 🧠 Sistemas avançados (VessieCore)

Novos sistemas adicionados ao núcleo — todos configuráveis no `.env`:

| Sistema | Descrição | Endpoints |
|---------|-----------|-----------|
| **TagSystem** | `<Think>` / `<Code>` / `<Interpretagem>` (auto/manual/off) | `/api/tags/*` |
| **TokenCompressor** | Compressão de código/texto e dublagem de código → prompt | `/api/compress/*` |
| **ResponseCache** | Reuso de respostas + N variantes (10) para economizar API | `/api/cache` |
| **SecureStorage** | Criptografia AES-256-GCM, acesso somente por DM/token | `/api/storage/*` |
| **McpManager** | Conexão a servidores MCP (tools/resources/prompts) | `/api/mcp/*` |
| **MultiAgentManager** | Time de múltiplos modelos em paralelo + consolidação | `/api/agents/*` |
| **AutoEvolution** | Skills automáticas, Force All Module e auto-sustentação | `/api/evolution/*`, `/api/skills/generate` |
| **PatchManager** | Edição por linha / patches reutilizáveis | `/api/patches/*` |
| **DM-only** | Segurança: quando `DM_ONLY=true`, `/api` exige `DM_TOKEN` | middleware global |

### Segurança DM-only
Para ativar, no `.env`:
```env
DM_ONLY=true
DM_TOKEN=seu-token-secreto
VESSIE_STORAGE_KEY=sua-chave-de-criptografia
```
Com `DM_ONLY=true`, **todo** acesso a `/api/*` exige o token no header
`x-dm-token` (ou campo `token` no body), exceto `/api/health` e `/api/dub/*`.

### Multi-Agent (vários modelos do LM Studio)
No `.env`, liste os modelos extras:
```env
MULTI_AGENTS=true
LM_STUDIO_MODELS=modelo-a,modelo-b,modelo-c
```
Use `POST /api/agents/add` para registrar agentes e `POST /api/agents/run` para
executar o time e consolidar a resposta única.

### Tags System
O `TagSystem` injeta automaticamente o protocolo de tags no system prompt de
qualquer modelo (com ou sem suporte nativo a *think*). Modos no `.env`:
```env
TAGS_ENABLED=true
TAG_MODE=auto     # auto | manual | off
```

## Deploy no GitHub Pages

O site é publicado automaticamente pelo workflow em `.github/workflows/deploy.yml`
a cada push na branch `main`.

**Configuração (uma vez):**
1. No GitHub, abra **Settings** do repositório.
2. Em **Pages**, em "Build and deployment", selecione **Source = GitHub Actions**.
3. Pronto — o site fica disponível em:
   `https://kauanhenriquealvesdosreis-ai.github.io/Vessie/`

Para publicar manualmente, na aba **Actions** execute o workflow
"Deploy site (Vite) to GitHub Pages" com o botão **Run workflow**.

> ⚠️ O GitHub Pages serve apenas o **frontend** (estático). A IA GGUF roda
> localmente no seu servidor (http://localhost:3000). Para usar o chat
> completo, acesse o servidor local com o `npm run server`.

  