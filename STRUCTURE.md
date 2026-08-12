# 📁 Estrutura do Projeto Vessie AI

> Guia de referência rápida para entender como o código está organizado neste
> repositório. Mantenha este arquivo atualizado sempre que mover pastas ou arquivos.

## Visão geral

```
Vessie/
├── .github/              CI/CD (deploy do frontend no GitHub Pages)
├── docs/                 Documentação (guidelines, atribuições)
├── models/               Arquivos de modelo GGUF (gitignored — muito grandes)
├── public/              Assets estáticos servidos pelo Express (:3000)
├── scripts/             Utilitários de projeto (ex: gguf-info está em vessieai-core/scripts/)
├── src/                 Frontend React + Vite (deploy no GitHub Pages)
├── vessieai-core/       Núcleo de IA (Node.js): providers, memória, emoções, etc.
├── vessels-data/        Dados gerados em runtime (conversas, projetos, etc.)
├── .env.example          Modelo de configuração de ambiente
├── .gitignore
├── package.json          Dependências + scripts (frontend + servidor)
├── package-lock.json
├── start.bat             Inicializador Windows
├── server.js             Servidor Express + WebSocket (API OpenAI-compatível)
├── index.html            Entrada HTML do Vite (frontend)
├── vite.config.ts        Config do Vite (base path, alias @)
├── tsconfig.json         Config TypeScript (frontend)
├── eslint.config.js      Config ESLint (frontend)
├── postcss.config.mjs    Config PostCSS (>Tailwind)
└── README.md             Documentação principal
```

## Pastas na raiz (mínimo 4 exigidos ✓)

| Pasta | Responsabilidade |
|-------|-----------------|
| `.github/` | Workflow de CI/CD (deploy frontend) |
| `docs/` | Documentação do projeto |
| `models/` | Modelos GGUF para IA local |
| `public/` | Assets estáticos do servidor |
| `scripts/` | Utilitários de desenvolvimento |
| `src/` | Código-fonte do frontend React |
| `vessieai-core/` | Núcleo de IA (providers, memória, pensamento, etc.) |
| `vessels-data/` | Dados runtime (conversas salvas, projetos) |

## Frontend (`src/`)

```
src/
├── main.tsx              ← Entry point (React DOM)
├── app/
│   ├── App.tsx           ← Componente principal
│   └── components/
│       ├── figma/        ← Componentes de integração com Figma
│       └── ui/           ← Componentes shadcn/ui
├── imports/              ← Arquivos importados (ex: Vessie_AI.txt)
└── styles/               ← CSS: Tailwind, tema, fonts, globals
    ├── index.css         ← Entry (importa os abaixo)
    ├── tailwind.css
    ├── theme.css
    ├── globals.css
    └── fonts.css
```

## Backend / Core (`vessieai-core/`)

```
vessieai-core/
├── index.js              ← Orquestração do VessieCore
├── config/               ← Leitura centralizada do .env
├── providers/            ← gguf, lmstudio, openai, anthropic
├── agents/               ← Agent loop
├── memory/               ← Memória de longo prazo (Memory.md)
├── personality/          ← Emoções / Life.md
├── thinking/             ← Prompt enhancement, correção ortográfica
├── dubbing/              ← Tradução/dublagem (130+ idiomas)
├── coding/               ← Geração e edição de código
├── search/               ← Busca web
├── skills/               ← Skills em Markdown
├── context/              ← Contexto / engenheiro de foco
├── projects/             ← Gerenciamento de projetos
├── sharing/              ← Share-Thinking.md
├── tools/                ← Ferramentas da IA
├── mcp/                  ← Servidores MCP
├── utils/                ← Utilitários
├── cache/                ← Cache de respostas
├── storage/              ← Armazenamento local
├── examples/             ← Exemplos salvos pela IA
├── tests/                ← Testes
├── docs/                 ← Documentação interna
├── managers/             ← Gerentes de alto nível
├── automation/           ← Auto-melhoria
├── codebase/             ← Base de código / referências
├── compression/          ← Compressão de tokens
├── emotions/             ← Estados emocionais
├── models/               ← Registro de modelos
├── patches/              ← Patches de correção
├── sources/              ← Fontes/coletores
└── scripts/              ← Utilitários (gguf-info.js)
```

## Como rodar

```bash
npm install         # instala dependências (frontend + servidor)
npm run server      # API local em http://localhost:3000
npm run dev         # frontend Vite em http://localhost:5173
npm run build       # build do frontend (GitHub Pages)
npm run type-check  # verificação TypeScript
npm run lint        # lint do frontend
npm run gguf:info   # status do modelo GGUF
```
