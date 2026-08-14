# Agent.md

## VessieAI Agent Loop

1. **Observar** — captura objetivo, contexto, memória, skills, tools e estado do projeto.
2. **Pensar** — cria plano operacional resumido, sem armazenar cadeia de pensamento privada.
3. **Agir** — executa somente ferramentas permitidas e coleta resultados verificáveis.
4. **Resultado** — sintetiza a resposta final e verifica se o objetivo foi atendido.
5. **Falha** — registra o erro, ajusta o plano e repete o ciclo até `AGENT_MAX_RETRIES`.

### Critério de sucesso
- A tarefa deve produzir uma resposta ou artefato verificável.
- Se uma etapa não puder ser executada, o bloqueio deve ser declarado.
- Nunca considerar ausência de erro como prova de correção.
