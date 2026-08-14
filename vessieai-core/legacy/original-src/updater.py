import os
import time
import threading
from .config import Config
from .module_manager import reload_modules
from .logger import get_logger

logger = get_logger(__name__)
_last_mtime = {}

def check_for_updates():
    global _last_mtime
    changed = False
    for filename in os.listdir(Config.MODULE_DIR):
        if filename.endswith(".py") and not filename.startswith("_"):
            path = os.path.join(Config.MODULE_DIR, filename)
            try:
                mtime = os.path.getmtime(path)
                if filename not in _last_mtime or mtime > _last_mtime[filename]:
                    _last_mtime[filename] = mtime
                    changed = True
                    logger.info(f"Atualização detectada: {filename}")
            except OSError:
                pass
    if changed:
        reload_modules()
    return changed

def start_updater(interval=2.0, callback=None):
    def loop():
        while True:
            changed = check_for_updates()
            if changed and callback:
                try:
                    callback()
                except Exception as e:
                    logger.error(f"Erro no callback do updater: {e}")
            time.sleep(interval)
    thread = threading.Thread(target=loop, daemon=True)
    thread.start()
    return thread