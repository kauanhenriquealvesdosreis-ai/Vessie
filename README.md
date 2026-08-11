
  # Recreate ChatGPT with LM Studio

  This is a code bundle for Recreate ChatGPT with LM Studio. The original project is available at https://www.figma.com/design/2UOYbpxGdHycTIDwntZVgQ/Recreate-ChatGPT-with-LM-Studio.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

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
  