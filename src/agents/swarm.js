import {allocateActions} from '../tokenizer/budget.js';
export function buildSwarm(goal,totalTokens=12000){return allocateActions([
 {id:'planner',role:'planner',weight:1.2,task:`planejar: ${goal}`},
 {id:'coder',role:'coder',weight:2.2,task:`implementar: ${goal}`},
 {id:'reviewer',role:'reviewer',weight:1.5,task:`revisar implementação de: ${goal}`},
 {id:'tester',role:'tester',weight:1.3,task:`criar verificações para: ${goal}`},
 {id:'optimizer',role:'optimizer',weight:1,task:`otimizar sem quebrar: ${goal}`}
],totalTokens)}
