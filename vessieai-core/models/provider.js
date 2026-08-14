class OpenAICompatibleProvider {
  constructor(config, logger){ this.config=config; this.logger=logger; }
  headers(){ const h={'Content-Type':'application/json'}; if(this.config.lmApiKey) h.Authorization=`Bearer ${this.config.lmApiKey}`; return h; }
  async listModels(){
    const r=await fetch(`${this.config.lmStudioUrl}/models`,{headers:this.headers()});
    if(!r.ok) throw new Error(`Modelos: HTTP ${r.status}`); return r.json();
  }
  async chat(messages, opts={}){
    const body={model:opts.model||this.config.lmModel,messages,max_tokens:opts.maxTokens||this.config.maxTokens,temperature:opts.temperature??this.config.temperature,stream:false};
    const r=await fetch(`${this.config.lmStudioUrl}/chat/completions`,{method:'POST',headers:this.headers(),body:JSON.stringify(body)});
    const text=await r.text(); if(!r.ok) throw new Error(`IA: HTTP ${r.status} ${text.slice(0,300)}`);
    const data=JSON.parse(text); return data.choices?.[0]?.message?.content || '';
  }
  async *stream(messages, opts={}){
    const body={model:opts.model||this.config.lmModel,messages,max_tokens:opts.maxTokens||this.config.maxTokens,temperature:opts.temperature??this.config.temperature,stream:true};
    const r=await fetch(`${this.config.lmStudioUrl}/chat/completions`,{method:'POST',headers:this.headers(),body:JSON.stringify(body)});
    if(!r.ok) throw new Error(`IA: HTTP ${r.status} ${(await r.text()).slice(0,300)}`);
    if(!r.body) return;
    const reader=r.body.getReader(); const decoder=new TextDecoder(); let buf='';
    while(true){ const {value,done}=await reader.read(); if(done) break; buf+=decoder.decode(value,{stream:true}); const lines=buf.split(/\r?\n/); buf=lines.pop()||'';
      for(const line of lines){ const s=line.trim(); if(!s.startsWith('data:')) continue; const raw=s.slice(5).trim(); if(raw==='[DONE]') return; try{ const d=JSON.parse(raw); const c=d.choices?.[0]?.delta?.content; if(c) yield c; }catch{} }
    }
  }
}
module.exports={OpenAICompatibleProvider};
