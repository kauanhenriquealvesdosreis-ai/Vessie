const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function estimateTokens(text=''){return Math.ceil(String(text).length/4)}
export function splitBudget(total,{system=.12,reasoning=.22,memory=.12,tools=.14,output=.40}={}){
 const sum=system+reasoning+memory+tools+output; const parts={system,reasoning,memory,tools,output};
 return Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,Math.floor(total*v/sum)]));
}
export function fitText(text,maxTokens){const s=String(text??'');return s.length<=maxTokens*4?s:s.slice(0,maxTokens*4-1)+'…'}
export function allocateActions(actions,total){
 const weights=actions.map(a=>clamp(Number(a.weight)||1,.25,10)); const sum=weights.reduce((a,b)=>a+b,0);
 return actions.map((a,i)=>({...a,tokens:Math.max(64,Math.floor(total*weights[i]/sum))}));
}
