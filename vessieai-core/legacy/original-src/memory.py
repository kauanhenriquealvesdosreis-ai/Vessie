from .config import Config

class ConversationMemory:
    def __init__(self):
        self._contexts = {}

    def get_context(self, session_id):
        return self._contexts.get(session_id, [])

    def add_message(self, session_id, role, content):
        if session_id not in self._contexts:
            self._contexts[session_id] = []
        self._contexts[session_id].append({"role": role, "content": content})
        if len(self._contexts[session_id]) > Config.MAX_CONTEXT_MESSAGES:
            self._contexts[session_id] = self._contexts[session_id][-Config.MAX_CONTEXT_MESSAGES:]

    def clear_context(self, session_id):
        if session_id in self._contexts:
            del self._contexts[session_id]

memory = ConversationMemory()