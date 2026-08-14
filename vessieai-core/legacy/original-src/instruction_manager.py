import os
import json
import re
import uuid
from datetime import datetime
from .config import Config
from .ai_client import call_ai
from .logger import get_logger

logger = get_logger(__name__)
INSTRUCTION_DIR = Config.INSTRUCTION_DIR
os.makedirs(INSTRUCTION_DIR, exist_ok=True)

def list_modules():
    modules = []
    for item in os.listdir(INSTRUCTION_DIR):
        path = os.path.join(INSTRUCTION_DIR, item)
        if os.path.isdir(path):
            meta_path = os.path.join(path, "metadata.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                    modules.append({
                        "name": item,
                        "description": meta.get("description", ""),
                        "tags": meta.get("tags", [])
                    })
                except Exception as e:
                    logger.error(f"Erro ao ler metadados de {item}: {e}")
    return modules

def get_module(name):
    path = os.path.join(INSTRUCTION_DIR, name)
    if not os.path.isdir(path):
        return None
    md_path = os.path.join(path, "module.md")
    meta_path = os.path.join(path, "metadata.json")
    content = ""
    if os.path.exists(md_path):
        with open(md_path, 'r', encoding='utf-8') as f:
            content = f.read()
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
    return {"content": content, "metadata": meta}

def create_module(name, description, content, tags=None):
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip())
    if not safe_name:
        return None, "Nome inválido"
    path = os.path.join(INSTRUCTION_DIR, safe_name)
    if os.path.exists(path):
        return None, "Já existe"
    os.makedirs(path)
    with open(os.path.join(path, "module.md"), 'w', encoding='utf-8') as f:
        f.write(content)
    meta = {
        "name": safe_name,
        "description": description,
        "tags": tags or [],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    with open(os.path.join(path, "metadata.json"), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    logger.info(f"Módulo de instrução criado: {safe_name}")
    return safe_name, None

def update_module(name, new_content=None, new_description=None, new_tags=None):
    path = os.path.join(INSTRUCTION_DIR, name)
    if not os.path.isdir(path):
        return False, "Módulo não encontrado"
    if new_content is not None:
        lines = new_content.count('\n') + 1
        if lines > 200:
            return False, f"Excede 200 linhas ({lines})"
        with open(os.path.join(path, "module.md"), 'w', encoding='utf-8') as f:
            f.write(new_content)
    meta_path = os.path.join(path, "metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
    else:
        meta = {}
    if new_description is not None:
        meta["description"] = new_description
    if new_tags is not None:
        meta["tags"] = new_tags
    meta["updated_at"] = datetime.now().isoformat()
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    return True, None

def delete_module(name):
    path = os.path.join(INSTRUCTION_DIR, name)
    if not os.path.isdir(path):
        return False, "Não encontrado"
    import shutil
    shutil.rmtree(path)
    logger.info(f"Módulo excluído: {name}")
    return True, None

def generate_module_via_ai(description):
    prompt = f"""
    Crie um módulo de instrução (Markdown) para: {description}
    Máximo 200 linhas.
    Retorne JSON: {{ "name": "...", "description": "...", "tags": [...], "content": "..." }}
    """
    result = call_ai(prompt, system_prompt="Especialista em criar instruções estruturadas.")
    if "error" in result:
        return None, result["error"]
    try:
        data = json.loads(result["text"])
        return create_module(data["name"], data["description"], data["content"], data.get("tags", []))
    except Exception as e:
        logger.error(f"Erro ao gerar módulo via IA: {e}")
        return None, str(e)