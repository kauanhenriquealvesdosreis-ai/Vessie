const {getRules}=require('../context/rules');
class AgentLoop{
 constructor({config,logger,modelManager,context,memory,tools,web,skills}){Object.assign(this,{config,logger,modelManager,context,memory,tools,web,skills});}
 async observe(input){return {goal:input,context:this.context.bundle(this.memory),tools:this.tools.list(),skills:this.skills.list()};}
 async think(obs,model){
  const rules=getRules(this.config.rulesMaxLines).join('\n');
  const prompt=`Você é o planejador do VessieAI. Gere um plano curto em JSON.\nObjetivo: ${obs.goal}\nFerramentas: ${JSON.stringify(obs.tools)}\nSkills: ${JSON.stringify(obs.skills)}\nRegras:\n${rules}\nNão exponha raciocínio privado; retorne apenas passos verificáveis.`;
  const text=await this.modelManager.chat([{role:'system',content:this.config.systemPrompt},{role:'user',content:prompt}],{model});
  try{return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0]||text);}catch{return {steps:[{action:'respond',reason:text.slice(0,1000)}]};}
 }
 async act(plan,obs,session){
  const outputs=[];
  for(const step of (plan.steps||[]).slice(0,this.config.agentMaxSteps)){
   if(step.action==='web_search'){outputs.push({action:step.action,result:await this.web.search(step.query||obs.goal)});}
   else if(step.action==='read_workspace'){outputs.push({action:step.action,result:await this.tools.run('read_text',{file:step.file})});}
   else if(step.action==='list_workspace'){outputs.push({action:step.action,result:await this.tools.run('list_workspace',{dir:step.dir||'.'})});}
   else if(step.action==='calculator'){outputs.push({action:step.action,result:await this.tools.run('calculator',{expression:step.expression})});}
   else outputs.push({action:step.action,result:'ação de planejamento; sem execução automática'});
  }
  return outputs;
 }
 async result(obs,plan,actions,model){
  const synthesis=`Objetivo: ${obs.goal}\nPlano: ${JSON.stringify(plan)}\nResultados: ${JSON.stringify(actions).slice(0,20000)}\nContexto compartilhado: ${JSON.stringify(obs.context).slice(0,20000)}`;
  return this.modelManager.chat([{role:'system',content:this.config.systemPrompt+' Entregue somente a resposta final ao usuário, sem CoT.'},{role:'user',content:synthesis}],{model});
 }
 async run(input,{model,sessionId}={}){
  const max=1+this.config.agentMaxRetries;let lastError=null;const trace=[];
  for(let attempt=1;attempt<=max;attempt++){
   try{const obs=await this.observe(input);trace.push({stage:'observar',attempt,summary:{goal:obs.goal,tools:obs.tools.length,skills:obs.skills.length}});const plan=await this.think(obs,model);trace.push({stage:'pensar',attempt,plan});const actions=await this.act(plan,obs,sessionId);trace.push({stage:'agir',attempt,actions});const answer=await this.result(obs,plan,actions,model);trace.push({stage:'resultado',attempt,ok:true});return {answer,trace,success:true};}
   catch(e){lastError=e;trace.push({stage:'resultado',attempt,ok:false,error:e.message});}
  }
  return {answer:`Não consegui concluir após ${max} tentativa(s): ${lastError?.message||'erro desconhecido'}`,trace,success:false};
 }
}
module.exports={AgentLoop};
