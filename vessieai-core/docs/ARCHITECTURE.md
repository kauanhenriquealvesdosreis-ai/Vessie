# Arquitetura VessieAI 2.0

- `server.js`: bootstrap mínimo.
- `vessieai-core/server.js`: HTTP/API.
- `models`: providers OpenAI-compatible e troca de modelos.
- `agent`: Agent Loop.
- `context`: Agent.md, Rules.md, Life.md, Share-Thinking.md.
- `memory`: Memory.md + JSON estruturado.
- `skills`: skills reutilizáveis.
- `tools`: calculadora, workspace e web search.
- `workspace`: seleção, leitura, escrita e patches por linha.
- `mcp`: configuração de servidores MCP.
- `public`: frontend React estático, compatível com GitHub Pages.
