import os
import json
import time
import threading
from queue import Queue
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from flask_cors import CORS
from .config import Config
from .ai_client import call_ai_stream, call_ai
from .module_manager import load_modules, get_modules, toggle_module, execute_module_function, generate_module, reload_modules
from .instruction_manager import list_modules as list_instruction_modules, get_module, create_module, update_module, delete_module, generate_module_via_ai
from .updater import start_updater
from .memory import memory
from .logger import get_logger

logger = get_logger(__name__)
app = Flask(__name__, static_folder=Config.PUBLIC_DIR, template_folder=Config.PUBLIC_DIR)
CORS(app)

MODULES = load_modules()
_update_clients = []

def notify_update():
    for q in _update_clients[:]:
        try:
            q.put(json.dumps({"type": "modules_updated"}))
        except:
            try:
                _update_clients.remove(q)
            except ValueError:
                pass

start_updater(interval=2.0, callback=notify_update)

# ================== ROTAS ESTÁTICAS ==================
@app.route('/')
def index():
    return send_from_directory(Config.PUBLIC_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(Config.PUBLIC_DIR, filename)

# ================== SSE ==================
@app.route('/events')
def events():
    def generate():
        q = Queue()
        _update_clients.append(q)
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                try:
                    data = q.get(timeout=30)
                    yield f"data: {data}\n\n"
                except:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        finally:
            if q in _update_clients:
                _update_clients.remove(q)
    return Response(stream_with_context(generate()), mimetype='text/event-stream')

# ================== CONFIG ==================
@app.route('/api/config', methods=['GET', 'POST'])
def config():
    if request.method == 'POST':
        data = request.json
        Config.LM_STUDIO_URL = data.get("url", Config.LM_STUDIO_URL)
        Config.LM_MODEL = data.get("model", Config.LM_MODEL)
        Config.MAX_TOKENS = int(data.get("max_tokens", Config.MAX_TOKENS))
        Config.TEMPERATURE = float(data.get("temperature", Config.TEMPERATURE))
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(f"LM_STUDIO_URL={Config.LM_STUDIO_URL}\n")
            f.write(f"LM_MODEL={Config.LM_MODEL}\n")
            f.write(f"MAX_TOKENS={Config.MAX_TOKENS}\n")
            f.write(f"TEMPERATURE={Config.TEMPERATURE}\n")
        return jsonify({"status": "ok", "config": {
            "url": Config.LM_STUDIO_URL,
            "model": Config.LM_MODEL,
            "max_tokens": Config.MAX_TOKENS,
            "temperature": Config.TEMPERATURE
        }})
    return jsonify({
        "url": Config.LM_STUDIO_URL,
        "model": Config.LM_MODEL,
        "max_tokens": Config.MAX_TOKENS,
        "temperature": Config.TEMPERATURE
    })

# ================== MÓDULOS PYTHON ==================
@app.route('/api/modules', methods=['GET'])
def api_modules():
    return jsonify({"modules": [{"name": k, "active": v['active']} for k, v in get_modules().items()]})

@app.route('/api/modules/toggle', methods=['POST'])
def api_toggle_module():
    data = request.json
    name = data.get('name')
    active = data.get('active', True)
    if not name:
        return jsonify({"error": "Nome obrigatório"}), 400
    if toggle_module(name, active):
        notify_update()
        return jsonify({"status": "ok"})
    return jsonify({"error": "Módulo não encontrado"}), 404

@app.route('/api/modules/reload', methods=['POST'])
def api_reload_modules():
    reload_modules()
    notify_update()
    return jsonify({"status": "ok"})

@app.route('/api/modules/execute', methods=['POST'])
def api_execute_module():
    data = request.json
    module = data.get('module')
    func = data.get('function')
    args = data.get('args', '')
    if not module or not func:
        return jsonify({"error": "Módulo e função obrigatórios"}), 400
    result, error = execute_module_function(module, func, args)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"result": result})

@app.route('/api/generate_module', methods=['POST'])
def api_generate_module():
    data = request.json
    desc = data.get('description', '').strip()
    if not desc:
        return jsonify({"error": "Descrição vazia"}), 400
    name, error = generate_module(desc)
    if error:
        return jsonify({"error": error}), 500
    notify_update()
    return jsonify({"module": name})

# ================== MÓDULOS DE INSTRUÇÃO ==================
@app.route('/api/instruction_modules', methods=['GET'])
def api_list_instruction_modules():
    return jsonify({"modules": list_instruction_modules()})

@app.route('/api/instruction_modules/<name>', methods=['GET'])
def api_get_instruction_module(name):
    mod = get_module(name)
    if not mod:
        return jsonify({"error": "Não encontrado"}), 404
    return jsonify(mod)

@app.route('/api/instruction_modules', methods=['POST'])
def api_create_instruction_module():
    data = request.json
    name = data.get('name', '').strip()
    desc = data.get('description', '')
    content = data.get('content', '').strip()
    tags = data.get('tags', [])
    if not name or not content:
        return jsonify({"error": "Nome e conteúdo obrigatórios"}), 400
    if content.count('\n') + 1 > 200:
        return jsonify({"error": "Excede 200 linhas"}), 400
    result, error = create_module(name, desc, content, tags)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"status": "ok", "name": result})

@app.route('/api/instruction_modules/<name>', methods=['PUT'])
def api_update_instruction_module(name):
    data = request.json
    success, error = update_module(name, data.get('content'), data.get('description'), data.get('tags'))
    if not success:
        return jsonify({"error": error}), 400
    return jsonify({"status": "ok"})

@app.route('/api/instruction_modules/<name>', methods=['DELETE'])
def api_delete_instruction_module(name):
    success, error = delete_module(name)
    if not success:
        return jsonify({"error": error}), 400
    return jsonify({"status": "ok"})

@app.route('/api/generate_instruction_module', methods=['POST'])
def api_generate_instruction_module():
    data = request.json
    desc = data.get('description', '').strip()
    if not desc:
        return jsonify({"error": "Descrição vazia"}), 400
    name, error = generate_module_via_ai(desc)
    if error:
        return jsonify({"error": error}), 500
    return jsonify({"status": "ok", "name": name})

@app.route('/api/generate_script_from_module', methods=['POST'])
def api_generate_script_from_module():
    data = request.json
    module_name = data.get('module_name', '').strip()
    additional = data.get('additional', '').strip()
    if not module_name:
        return jsonify({"error": "Nome do módulo obrigatório"}), 400
    module = get_module(module_name)
    if not module:
        return jsonify({"error": "Módulo não encontrado"}), 404
    instructions = module["content"]
    prompt = f"""
    Instruções do módulo:
    {instructions}
    {f"Requisitos adicionais: {additional}" if additional else ""}
    Gere o código completo.
    """
    result = call_ai(prompt)
    if "error" in result:
        return jsonify({"error": result["error"]}), 500
    code = result["text"]
    import re
    match = re.search(r"```(\w+)?\n(.*?)```", code, re.DOTALL)
    if match:
        lang = match.group(1) or "python"
        code = match.group(2).strip()
    else:
        lang = "python"
    return jsonify({"code": code, "language": lang})

# ================== GERAR TÍTULO ==================
@app.route('/api/generate_chat_title', methods=['POST'])
def generate_chat_title():
    data = request.json
    messages = data.get('messages', [])
    if not messages:
        return jsonify({"error": "Sem mensagens"}), 400
    context = ""
    for msg in messages[:4]:
        role = "Usuário" if msg['role'] == 'user' else "Assistente"
        context += f"{role}: {msg['content']}\n"
    prompt = f"Com base na conversa, gere um título curto (máx 5 palavras):\n{context}"
    result = call_ai(prompt, system_prompt="Você resume conversas em títulos curtos.")
    if "error" in result:
        fallback = messages[0]['content'][:30] + "..."
        return jsonify({"title": fallback})
    title = result["text"].strip()
    if len(title) > 50:
        title = title[:47] + "..."
    return jsonify({"title": title})

# ================== CHAT ==================
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    prompt = data.get('message', '').strip()
    session_id = data.get('session_id', 'default')
    if not prompt:
        return jsonify({"error": "Mensagem vazia"}), 400

    # Comandos especiais
    cmd = prompt.lower()
    if cmd.startswith('/improve'):
        desc = prompt[8:].strip()
        if not desc:
            return jsonify({"error": "Descreva a melhoria"}), 400
        name, err = generate_module(desc)
        if err:
            return jsonify({"error": err}), 500
        notify_update()
        return jsonify({"response": f"✅ Módulo Python **{name}** gerado!", "type": "system"})

    if cmd == '/modules':
        mods = get_modules()
        if not mods:
            return jsonify({"response": "Nenhum módulo Python carregado.", "type": "system"})
        text = "\n".join([f"- {k} ({'ativo' if v['active'] else 'inativo'})" for k, v in mods.items()])
        return jsonify({"response": f"**Módulos Python:**\n{text}", "type": "system"})

    if cmd.startswith('/exec'):
        parts = prompt[5:].strip().split(' ', 1)
        if len(parts) < 2:
            return jsonify({"error": "Uso: /exec modulo.funcao [args]"}), 400
        mod_func = parts[0]
        args = parts[1] if len(parts) > 1 else ""
        if '.' not in mod_func:
            return jsonify({"error": "Formato: modulo.funcao"}), 400
        mod_name, func_name = mod_func.split('.', 1)
        result, err = execute_module_function(mod_name, func_name, args)
        if err:
            return jsonify({"response": f"❌ {err}", "type": "system"})
        return jsonify({"response": f"**Resultado:**\n{result}", "type": "system"})

    if cmd.startswith('/newmodule'):
        desc = prompt[10:].strip()
        if not desc:
            return jsonify({"error": "Descreva o módulo"}), 400
        name, err = generate_module_via_ai(desc)
        if err:
            return jsonify({"error": err}), 500
        return jsonify({"response": f"✅ Módulo de instrução **{name}** criado!", "type": "system"})

    if cmd == '/listmodules':
        mods = list_instruction_modules()
        if not mods:
            return jsonify({"response": "Nenhum módulo de instrução.", "type": "system"})
        text = "\n".join([f"- {m['name']}: {m['description']}" for m in mods])
        return jsonify({"response": f"**Módulos de instrução:**\n{text}", "type": "system"})

    if cmd.startswith('/viewmodule'):
        name = prompt[12:].strip()
        if not name:
            return jsonify({"error": "Nome do módulo obrigatório"}), 400
        mod = get_module(name)
        if not mod:
            return jsonify({"error": "Módulo não encontrado"}), 404
        return jsonify({"response": f"📘 **{name}**\n\n{mod['content']}", "type": "system"})

    if cmd.startswith('/generatefrommodule'):
        parts = prompt[19:].strip().split(' ', 1)
        if len(parts) < 1:
            return jsonify({"error": "Uso: /generatefrommodule nome [requisitos]"}), 400
        mod_name = parts[0]
        additional = parts[1] if len(parts) > 1 else ""
        mod = get_module(mod_name)
        if not mod:
            return jsonify({"error": "Módulo não encontrado"}), 404
        instructions = mod["content"]
        prompt_script = f"Instruções:\n{instructions}\n{additional}\nGere o código."
        result = call_ai(prompt_script)
        if "error" in result:
            return jsonify({"error": result["error"]}), 500
        code = result["text"]
        import re
        match = re.search(r"```(\w+)?\n(.*?)```", code, re.DOTALL)
        if match:
            lang = match.group(1) or "python"
            code = match.group(2).strip()
        else:
            lang = "python"
        return jsonify({"response": f"**Código gerado** ({lang}):\n```{lang}\n{code}\n```", "type": "assistant"})

    # Chat normal com streaming e memória
    memory.add_message(session_id, "user", prompt)
    context = memory.get_context(session_id)
    full_prompt = ""
    for msg in context:
        full_prompt += f"{msg['role']}: {msg['content']}\n"

    def generate():
        yield f"data: {json.dumps({'start': True})}\n\n"
        full_response = ""
        for event in call_ai_stream(full_prompt):
            try:
                data = json.loads(event)
                if "content" in data:
                    full_response += data["content"]
                yield f"data: {json.dumps(data)}\n\n"
            except:
                yield f"data: {event}\n\n"
        memory.add_message(session_id, "assistant", full_response)
        yield f"data: {json.dumps({'end': True})}\n\n"
    return Response(stream_with_context(generate()), mimetype='text/event-stream')