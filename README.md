# Vessie AI

Interface web (React + Vite) de chat com IA + **servidor local** que executa
modelos **GGUF** (arquitetura llama.cpp) diretamente na sua máquina.

## Estrutura

```
├─ src/                ← Frontend (React + Vite + TypeScript)
├─ .github/workflows/  ← Deploy automático do frontend no GitHub Pages
├─ backend/            ← Servidor local de IA (Node + Express + WebSocket)
│  ├─ server.js        ← API REST + WebSocket + rota GGUF
│  ├─ vessieai-core/   ← Sistemas (providers, memória, emoções, thinking, agentes…)
│  ├─ scripts/         ← utilitários (gguf-info)
│  └─ models/          ← (opcional) outra pasta para modelos .gguf
├─ models/             ← ★ coloque aqui o seu arquivo LocalModel.gguf
└─ README.md
```

## Rodando a interface

```bash
npm i
npm run dev        # frontend em http://localhost:5173
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
   npm run server        # ou: cd backend && npm run dev
   ```

4. Acesse o servidor (e deixe o frontend apontando para ele):

   - Web UI/API: **http://localhost:3000**
   - Status do modelo: **http://localhost:3000/api/gguf/status**
   - Chat OpenAI-compatível: `POST http://localhost:3000/v1/chat/completions`

> O servidor detecta automaticamente o `.gguf` em `models/`,
> `backend/models/`, na raiz, ou em um caminho definido por
> `GGUF_MODEL_PATH` no `backend/.env` (veja `backend/.env.example`).

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

  