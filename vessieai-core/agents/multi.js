class MultiAgent{
 constructor(models,context,logger){this.models=models;this.context=context;this.logger=logger;}
 async run(input,modelIds=[]){const ids=(modelIds.length?modelIds:this.models.config.lmModels).slice(0,4);const drafts=[];for(const id of ids){try{const text=await this.models.chat([{role:'system',content:'Você é um revisor especializado. Gere uma proposta curta, verificável e técnica.'},{role:'user',content:input}],{model:id,maxTokens:2500,temperature:.3});drafts.push({model:id,text});}catch(e){drafts.push({model:id,error:e.message});}}
 const combined=drafts.map(d=>`MODELO ${d.model}\n${d.text||d.error}`).join('\n\n');const final=await this.models.chat([{role:'system',content:'Você é o coordenador VessieAI. Consolide propostas, elimine contradições e responda ao usuário. Não revele CoT.'},{role:'user',content:`Pedido:\n${input}\n\nPropostas:\n${combined}`}],{model:ids[0]});return {answer:final,drafts};}
}
module.exports={MultiAgent};
