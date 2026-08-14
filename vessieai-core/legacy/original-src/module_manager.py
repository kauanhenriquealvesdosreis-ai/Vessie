import os
import sys
import re
import importlib
import uuid
from .config import Config
from .ai_client import call_ai
from .logger import get_logger

logger = get_logger(__name__)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

_modules_state = {}

def load_modules():
    global _modules_state
    _modules_state = {}
    for filename in os.listdir(Config.MODULE_DIR):
        if filename.endswith(".py") and not filename.startswith("_"):
            module_name = filename[:-3]
            try:
                module = importlib.import_module(f"Module.{module_name}")
                _modules_state[module_name] = {'module': module, 'active': True}
                logger.info(f"Módulo Python carregado: {module_name}")
            except Exception as e:
                logger.error(f"Falha ao carregar {module_name}: {e}")
    return _modules_state

def reload_modules():
    for mod_name in list(sys.modules.keys()):
        if mod_name.startswith("Module."):
            del sys.modules[mod_name]
    return load_modules()

def get_modules():
    return _modules_state

def toggle_module(module_name, active):
    if module_name in _modules_state:
        _modules_state[module_name]['active'] = active
        return True
    return False

def generate_module(description):
    prompt = f"""
    Gere um módulo Python completo para: {description}
    Retorne APENAS o código Python em bloco ```python ... ```.
    """
    result = call_ai(prompt, system_prompt="Especialista em Python.")
    if "error" in result:
        return None, result["error"]
    code = result["text"]
    match = re.search(r"```python\n(.*?)```", code, re.DOTALL)
    if match:
        code = match.group(1).strip()
    else:
        code = code.strip()
    module_name = f"module_{uuid.uuid4().hex[:8]}"
    filepath = os.path.join(Config.MODULE_DIR, f"{module_name}.py")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("# -*- coding: utf-8 -*-\n" + code)
    reload_modules()
    return module_name, None

def execute_module_function(module_name, func_name, args=""):
    if module_name not in _modules_state:
        return None, "Módulo não encontrado"
    if not _modules_state[module_name]['active']:
        return None, "Módulo inativo"
    module = _modules_state[module_name]['module']
    func = getattr(module, func_name, None)
    if not func:
        return None, "Função não encontrada"
    try:
        result = func(args) if args else func()
        return result, None
    except Exception as e:
        logger.error(f"Erro ao executar {func_name}: {e}")
        return None, str(e)