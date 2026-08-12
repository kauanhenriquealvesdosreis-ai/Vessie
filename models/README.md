# 📁 Models (modelos GGUF)

Coloque aqui o seu arquivo de modelo no formato **GGUF** para o Vessie usá-lo.

## Como usar

1. **Baixe um modelo GGUF** (ex.: um quantizado de 4 bits, `Q4_K_M`, para melhor desempenho local).
   Sugestão de fontes:
   - Hugging Face → https://huggingface.co/models?library=gguf
   - Modelos conhecidos: `llama-3.2`, `qwen2.5`, `phi-3`, `mistral`, `deepseek-r1:distill`, `gemma`.

2. **Renomeie o arquivo para `LocalModel.gguf`** e coloque dentro desta pasta:

   ```
   models/
     LocalModel.gguf   ← coloque aqui
   ```

3. Inicie o servidor (o servidor detecta o arquivo automaticamente):

   ```bash
   npm run server          # na raiz do projeto
   ```

4. Acesse **http://localhost:3000** e use a aba de chat com o provider `gguf`.

> O sistema procura automaticamente por qualquer arquivo `.gguf` também
> em `models/` (na raiz do repositório). Você também pode apontar um caminho
> exato definindo `GGUF_MODEL_PATH` no arquivo `.env` (via `.env.example`).

## Dicas de tamanho

- Modelos grandes (7B+ em quantização 4 bits ≈ 4–6 GB) exigem bastante RAM/VRAM.
- Para testar rápido, prefira modelos pequenos (1B–3B) como `Qwen2.5-0.5B-Instruct`
  ou `Llama-3.2-1B-Instruct` (Q4_K_M).

> ⚠️ Arquivos `.gguf` ficam fora do versionamento do Git (muito grandes).
