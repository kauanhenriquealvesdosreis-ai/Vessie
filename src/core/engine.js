import {chat} from '../lmstudio/client.js';import {loadDB} from '../storage/db.js';import {estimateTokens,splitBudget,fitText} from '../tokenizer/budget.js';import {buildSwarm} from '../agents/swarm.js';import {makePlan} from '../reasoning/deep.js';
export async function runAI({input,history=[],base,model,onStep}){
 const db=loadDB();const budget=splitBudget(12000);const swarm=buildSwarm(input,12000);onStep?.({type:'plan',plan:makePlan(input),swarm,budget});
 const context=fitText(JSON.stringify({snippets:db.snippets.slice(-8),memories:db.memories.slice(-8)}),budget.memory);
 const system=`Você é VessieAI, agente de desenvolvimento. Preserve arquivos existentes; não substitua sem necessidade. Trabalhe incrementalmente. Responda em português. Contexto armazenado: ${context}`;
 const messages=[{role:'system',content:system},...history.slice(-8),{role:'user',content:input}];
 return chat({base,model,messages,max_tokens:budget.output,temperature:.2});
}
