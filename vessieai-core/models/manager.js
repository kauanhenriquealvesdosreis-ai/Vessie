const { OpenAICompatibleProvider } = require('./provider');
class ModelManager{
  constructor(config,logger){this.config=config;this.logger=logger;this.providers=new Map();this.registerLMStudio();}
  registerLMStudio(){this.providers.set('lmstudio',new OpenAICompatibleProvider(this.config,this.logger));}
  async list(){
    const out=[]; for(const [name,p] of this.providers){ try{const d=await p.listModels(); for(const m of (d.data||[])) out.push({provider:name,id:m.id,owned_by:m.owned_by});}catch(e){out.push({provider:name,error:e.message});} }
    return out;
  }
  get(name='lmstudio'){const p=this.providers.get(name);if(!p) throw new Error(`Provider não registrado: ${name}`);return p;}
  async chat(messages,opts={}){return this.get(opts.provider).chat(messages,opts);}
  stream(messages,opts={}){return this.get(opts.provider).stream(messages,opts);}
}
module.exports={ModelManager};
