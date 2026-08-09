import fetch from 'node-fetch';

export class WebSearch {
  constructor() {
    this.enabled = process.env.WEB_SEARCH_ENABLED === 'true';
  }

  async query(searchQuery, limit = 5) {
    if (!this.enabled) return [];

    try {
      // DuckDuckGo Instant Answer API (sem necessidade de chave)
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
      const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();

      const results = [];

      if (data.AbstractText) {
        results.push({
          title: data.AbstractSource || 'DuckDuckGo',
          snippet: data.AbstractText,
          url: data.AbstractURL,
          source: 'ddg_abstract',
        });
      }

      if (data.RelatedTopics) {
        data.RelatedTopics.slice(0, limit - 1).forEach(topic => {
          if (topic.Text) {
            results.push({
              title: topic.Text.slice(0, 80),
              snippet: topic.Text,
              url: topic.FirstURL,
              source: 'ddg_related',
            });
          }
        });
      }

      return results.slice(0, limit);
    } catch (err) {
      // Fallback: retornar resultado vazio com erro
      return [{ title: 'Erro na pesquisa', snippet: err.message, url: null, source: 'error' }];
    }
  }

  async fetchPage(url) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Vessie AI Web Reader/1.0' }
      });
      const html = await res.text();

      // Extrair texto relevante (remover HTML básico)
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 5000);

      return text;
    } catch {
      return '';
    }
  }

  summarizeResults(results) {
    return results
      .filter(r => r.snippet)
      .map(r => `**${r.title}**: ${r.snippet}`)
      .join('\n\n');
  }
}
