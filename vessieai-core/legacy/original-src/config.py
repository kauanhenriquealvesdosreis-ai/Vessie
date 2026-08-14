import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
    LM_MODEL = os.getenv("LM_MODEL", "local-model")
    MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2000"))
    TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
    MODULE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Module")
    INSTRUCTION_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Modules")
    PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Public")
    LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assistant.log")
    MAX_CONTEXT_MESSAGES = 20

for d in [Config.MODULE_DIR, Config.INSTRUCTION_DIR, Config.PUBLIC_DIR]:
    os.makedirs(d, exist_ok=True)