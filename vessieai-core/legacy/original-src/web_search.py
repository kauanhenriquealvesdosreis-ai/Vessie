import requests
from urllib.parse import quote_plus

def web_search(query, num_results=5):
    """Busca no DuckDuckGo e retorna lista de títulos e snippets."""
    try:
        url = f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1&skip_disambig=1"
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return []
        data = response.json()
        results = []
        if "RelatedTopics" in data:
            for item in data["RelatedTopics"]:
                if "Text" in item and "FirstURL" in item:
                    text = item["Text"]
                    parts = text.split(" - ", 1)
                    title = parts[0] if parts else text
                    snippet = parts[1] if len(parts) > 1 else ""
                    results.append({"title": title, "snippet": snippet})
                    if len(results) >= num_results:
                        break
        if not results and "AbstractText" in data and data["AbstractText"]:
            results.append({
                "title": data.get("Heading", "Resumo"),
                "snippet": data["AbstractText"]
            })
        return results
    except Exception:
        return []