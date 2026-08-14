export function makePlan(goal){return [
 {id:'understand',name:'Entender objetivo',weight:1.1,prompt:`Extraia objetivo, restrições, arquivos envolvidos e critérios de sucesso de: ${goal}`},
 {id:'inspect',name:'Inspecionar contexto',weight:1.4,prompt:'Liste contexto necessário, riscos e dependências sem inventar dados.'},
 {id:'design',name:'Projetar solução',weight:1.5,prompt:'Crie arquitetura incremental compatível com arquivos existentes.'},
 {id:'implement',name:'Implementar',weight:2,prompt:'Produza implementação modular e preserve arquivos existentes quando possível.'},
 {id:'verify',name:'Verificar',weight:1.2,prompt:'Revise erros, integrações, compatibilidade e critérios de sucesso.'}
]}
