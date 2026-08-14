# Smoke tests

1. `start.bat` deve instalar dependências e iniciar a porta 3000.
2. `/api/health` deve retornar `ok: true`.
3. Login deve rejeitar senha incorreta.
4. `/api/status` não pode retornar segredos.
5. `/api/models` deve consultar LM Studio.
6. `/api/chat` deve responder quando o modelo estiver disponível.
7. Agent Loop deve registrar Observe/Think/Act/Result.
8. Projeto deve rejeitar caminhos fora de `PROJECT_ROOTS`.
9. Patch deve falhar em conflito de hash.
10. Memory pode ser apagada pelo endpoint protegido.
