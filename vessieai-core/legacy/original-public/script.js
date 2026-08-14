async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || state.isStreaming) return;

    if (!state.currentChatId || !state.conversations.find(c => c.id === state.currentChatId)) {
        createNewChat();
    }

    addMessageToChat('user', text);
    messageInput.value = '';
    updateCharCount();
    state.isStreaming = true;
    sendBtn.disabled = true;
    typingIndicator.style.display = 'flex';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            typingIndicator.style.display = 'none';
            state.isStreaming = false;
            sendBtn.disabled = false;
            if (data.error) {
                addMessageToChat('assistant', `❌ ${data.error}`);
            } else if (data.response) {
                addMessageToChat('assistant', data.response);
                if (data.module) loadModules();
            }
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let firstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const payload = line.slice(6);
                    if (payload === '[DONE]') continue;
                    try {
                        const data = JSON.parse(payload);
                        if (data.error) {
                            addMessageToChat('assistant', `❌ ${data.error}`);
                            typingIndicator.style.display = 'none';
                            state.isStreaming = false;
                            sendBtn.disabled = false;
                            return;
                        }
                        if (data.start) {
                            assistantMessage = '';
                            firstChunk = true;
                        } else if (data.content) {
                            assistantMessage += data.content;
                            if (firstChunk) {
                                const chat = state.conversations.find(c => c.id === state.currentChatId);
                                if (chat) {
                                    chat.messages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() });
                                    chat.updatedAt = new Date().toISOString();
                                    saveConversations();
                                    renderMessages(chat.messages);
                                }
                                firstChunk = false;
                            } else {
                                updateLastMessage(assistantMessage);
                            }
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } else if (data.end) {
                            typingIndicator.style.display = 'none';
                            state.isStreaming = false;
                            sendBtn.disabled = false;

                            // ===== GERAR TÍTULO AUTOMATICAMENTE =====
                            const chat = state.conversations.find(c => c.id === state.currentChatId);
                            if (chat && chat.title === 'Nova conversa') {
                                try {
                                    const resp = await fetch('/api/generate_chat_title', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ messages: chat.messages })
                                    });
                                    if (resp.ok) {
                                        const data = await resp.json();
                                        if (data.title) {
                                            chat.title = data.title;
                                            chat.updatedAt = new Date().toISOString();
                                            saveConversations();
                                            renderChatList();
                                            chatTitle.textContent = chat.title;
                                        }
                                    }
                                } catch (e) {
                                    // Fallback: usar as primeiras palavras da primeira mensagem
                                    if (chat.messages.length > 0) {
                                        const first = chat.messages[0].content;
                                        chat.title = first.slice(0, 30) + (first.length > 30 ? '...' : '');
                                        saveConversations();
                                        renderChatList();
                                        chatTitle.textContent = chat.title;
                                    }
                                }
                            }
                        }
                    } catch (e) { /* ignora */ }
                }
            }
        }
    } catch (error) {
        addMessageToChat('assistant', `❌ Erro: ${error.message}`);
    } finally {
        typingIndicator.style.display = 'none';
        state.isStreaming = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}