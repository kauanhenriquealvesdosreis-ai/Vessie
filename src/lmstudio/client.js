export const DEFAULT_LM='http://localhost:1234/v1';
export async function lmModels(base=DEFAULT_LM){const r=await fetch(`${base.replace(/\/$/,'')}/models`);if(!r.ok)throw Error(`LM Studio ${r.status}`);return r.json()}
export async function chat({base=DEFAULT_LM,model,messages,temperature=.2,max_tokens=2048,signal}){
 const r=await fetch(`${base.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,temperature,max_tokens,stream:false}),signal});
 if(!r.ok)throw Error(await r.text()); const j=await r.json(); return j.choices?.[0]?.message?.content||'';
}
