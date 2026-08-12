# Vessie AI — Backend (servidor local)

Servidor Node + Express + WebSocket que usa o `vessieai-core` e executa
**modelos GGUF locais** (`node-llama-cpp`).

## Como rodar

```bash
cd backend
cp .env.example .env     # (opcional) ajuste as variáveis
npm install              # instala as dependências (inclui node-llama-cpp)
npm run dev              # sobe em http://localhost:3000
```

Coloque seu modelo em `LocalModel.gguf` em `models/` (na raiz do repositório),
em `backend/models/` ou defina `GGUF_MODEL_PATH` no `.env`.

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/gguf/status` | Status do motor GGUF (carregado? caminho? tamanho?) |
| POST | `/api/gguf/reload` | Recarrega o modelo GGUF em disco |
| GET  | `/api/models` | Lista modelos disponíveis (GGUF + provedores) |
| GET  | `/api/providers` | Provedores configurados |
| POST | `/api/providers/switch` | Troca provedor/modelo ativo |
| POST | `/api/chat` | Chat (sem streaming) |
| GET  | `/v1/models` | Lista de modelos (compatível com OpenAI) |
| POST | `/v1/chat/completions` | Chat completions (com/sem streaming, compat. OpenAI) |
| WS   | `ws://localhost:3000` | Chat com streaming via WebSocket |
| GET  | `/api/dub/languages` | Lista de idiomas para dublagem/tradução (133+) |
| POST | `/api/dub/translate` | Traduz texto para qualquer idioma `{ text, to, from? }` |
| POST | `/api/dub/detect` | Detecta o idioma de um texto `{ text }` |

## Estrutura

```
backend/
├─ server.js                  ← API + WebSocket + rotas GGUF/OpenAI
├─ .env.example               ← modelo de configuração
├─ scripts/
│  └─ gguf-info.js            ← utilitário de diagnóstico do GGUF
├─ vessieai-core/             ← todos os sistemas de IA
│  ├─ index.js                ← orquestra o VessieCore
│  ├─ providers/              ← gguf, lmstudio, openai, anthropic
│  ├─ dubbing/                ← dublagem/tradução de idiomas (133+)
│  ├─ thinking/               ← pensar (DeepSeek R1 style), correção de ortografia
│  ├─ memory/                 ← memória de longo prazo
│  ├─ personality/            ← emoções / vida
│  ├─ agents/                 ← agent loop
│  ├─ projects/               ← gerenciar projetos/código
│  ├─ coding/                 ← geração de código
│  ├─ context/                ← contexto / questionário de foco
│  ├─ skills/                 ← skills
│  ├─ search/                 ← busca web
│  └─ sharing/                ← share-thinking
└─ models/                    ← (opcional) pasta alternativa para .gguf
```

## Variáveis principais (`backend/.env`)

```ini
AI_PROVIDER=gguf
GGUF_MODEL_PATH=
GGUF_MODEL_DIR=
AI_MODEL=LocalModel.gguf
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2048
GGUF_CONTEXT_SIZE=0
LM_STUDIO_URL=http://localhost:1234
PORT=3000
```

> O `node-llama-cpp` baixa os binários do `llama.cpp` na primeira instalação.
> Se a instalação falhar no seu ambiente, o servidor continua funcionando com
> o fallback LM Studio — basta não usar o provider `gguf`.
