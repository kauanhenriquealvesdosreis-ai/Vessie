import json
import requests
from .config import Config
from .logger import get_logger

logger = get_logger(__name__)

def call_ai_stream(prompt, system_prompt="Você é um assistente útil."):
    url = Config.LM_STUDIO_URL + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    data = {
        "model": Config.LM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": Config.MAX_TOKENS,
        "temperature": Config.TEMPERATURE,
        "stream": True
    }
    try:
        response = requests.post(url, json=data, headers=headers, stream=True, timeout=120)
        if response.status_code != 200:
            yield json.dumps({"error": f"Erro: {response.status_code}"})
            return
        for chunk in response.iter_lines():
            if chunk:
                chunk_str = chunk.decode('utf-8')
                if chunk_str.startswith("data: "):
                    chunk_str = chunk_str[6:]
                if chunk_str == "[DONE]":
                    break
                try:
                    data = json.loads(chunk_str)
                    if "choices" in data:
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield json.dumps({"content": content})
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        logger.error(f"Erro no streaming: {e}")
        yield json.dumps({"error": str(e)})

def call_ai(prompt, system_prompt="Você é um assistente útil."):
    url = Config.LM_STUDIO_URL + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    data = {
        "model": Config.LM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": Config.MAX_TOKENS,
        "temperature": Config.TEMPERATURE,
        "stream": False
    }
    try:
        response = requests.post(url, json=data, headers=headers, timeout=120)
        if response.status_code != 200:
            return {"error": f"Erro: {response.status_code}"}
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        return {"text": content}
    except Exception as e:
        logger.error(f"Erro na chamada síncrona: {e}")
        return {"error": str(e)}