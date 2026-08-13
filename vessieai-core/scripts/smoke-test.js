// Validação de importação dos módulos do VessieCore (parse/sintaxe)
import { VessieCore } from '../index.js';

console.log('Importando VessieCore...');
const core = new VessieCore();
console.log('Subsistemas registrados no constructor:');
['providers','dubbing','tags','compressor','cache','storage','mcp','multiAgent','autoEvolution','patches','agentLoop','memory','personality','thinking','skills','context','sharing','search','projects','codeEngine'].forEach(k => {
  console.log(`  ${k}: ${core[k] ? '✓' : '(null até init)'}`);
});
console.log('OK: módulos importados sem erro de sintaxe.');
process.exit(0);