const { createResponseEngine } = require('./runtime/responseEngine');
const { createCapabilityRegistry } = require('./runtime/capabilities');
const { createMemory } = require('./runtime/memory');

function createCore(options = {}) {
  const memory = createMemory(options.memory);
  const capabilities = createCapabilityRegistry(options.capabilities);
  const response = createResponseEngine({ ...options, memory, capabilities });
  return {
    memory,
    capabilities,
    async respond(input, context = {}) { return response.respond(input, context); },
    status() { return { name: 'VessieAI-Core', version: '1.0.0', mode: options.mode || 'local-hybrid', capabilities: capabilities.list(), memoryItems: memory.size() }; },
  };
}

module.exports = { createCore };
