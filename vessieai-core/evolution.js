class EvolutionEngine{
 constructor(config,skills,context,logger){Object.assign(this,{config,skills,context,logger});}
 async createSkill(description){if(!this.config.autoEvolutionEnabled && !this.config.forceAllModule)throw new Error('Auto-evolução está desligada no .env');const name='evolution_'+Date.now();return this.skills.create(name,`Objetivo:\n${description}\n\nProcedimento:\n1. Observar contexto.\n2. Reutilizar artefatos existentes.\n3. Criar patch mínimo.\n4. Validar resultado.\n5. Registrar melhoria.`);}
}
module.exports={EvolutionEngine};
