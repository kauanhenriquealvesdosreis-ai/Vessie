// Utilitário: mostra o estado do motor GGUF (sem iniciar a API).
// Uso: npm run gguf:info   ou node vessieai-core/scripts/gguf-info.js
import 'dotenv/config';
import { GgufProvider } from '../providers/ggufProvider.js';

const engine = new GgufProvider();
await engine.init();
console.log('\n=== VESSIE GGUF STATUS ===');
console.log(JSON.stringify(engine.statusJSON(), null, 2));
console.log('===========================\n');
process.exit(0);
