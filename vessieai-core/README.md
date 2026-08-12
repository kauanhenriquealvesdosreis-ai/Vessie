# Vessie AI — Core (vessieai-core)

Núcleo de IA do **Vessie AI** (Node + Express). Contém todos os sistemas,
organizados para rodar tanto **localmente** quanto em **host externo**.

## Layout

```
vessieai-core/
├─ index.js          ← VessieCore: orquestra e inicializa todos os sistemas
├─ config/           ← leitura centralizada do .env
├─ core/             ← lógica de negócio / coordenadores
├─ agents/           ← Agent Loop (observar → pensar → agir → resultado)
├─ providers/        ← gguf, lmstudio, openai, anthropic (modelos)
├─ models/           ← registro/estado de modelos
├─ thinking/         ← aprimoramento de prompt, correção, think tags
├─ context/          ← contextos .md / engenheiro de contexto / foco
├─ memory/           ← Memory.md (memória de longo prazo / comportamento)
├─ personality/      ← emoções / Life.md (personalidade)
├─ emotions/         ← estados emocionais e regras
├─ skills/           ← skills em Markdown (reutilização de projetos)
├─ dubbing/          ← tradução/dublagem de idiomas (130+)
├─ coding/           ← geração e edição de código
├─ codebase/         ← base de código / referências
├─ patches/          ← patches de correção
├─ sources/          ← fontes/coletores
├─ search/           ← web search
├─ projects/         ← gerenciar projetos/pastas/arquivos
├─ mcp/              ← servidores MCP / tools / resources / prompts
├─ tools/            ← ferramentas da IA
├─ automation/       ← auto-melhoria / geração de skills
├─ storage/          ← armazenamento (local, drive)
├─ cache/            ← cache de respostas (economia de tokens)
├─ compression/      ← compressão de tokens / código
├─ examples/         ← exemplos salvos pela IA
├─ tests/            ← testes
├─ docs/             ← documentação
├─ managers/         ← gerentes de alto nível
├─ sharing/          ← Share-Thinking.md (troca de mentalidade entre modelos)
└─ utils/            ← utilidades
```

## Como rodar

```bash
npm install            # instala front + servidor (raiz)
npm run server         # sobe a API em http://localhost:3000 (node server.js)
npm run dev            # frontend Vite (GitHub Pages)
```

> Coloque `LocalModel.gguf` em `models/` para rodar IA local (GGUF). Veja `models/README.md`.
