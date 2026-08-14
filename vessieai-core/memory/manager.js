const fs=require('fs'); const path=require('path');
class MemoryManager{
  constructor(config,logger){this.config=config;this.logger=logger;this.dir=path.join(config.core,'memory');this.file=path.join(this.dir,'Memory.md');this.stateFile=path.join(this.dir,'memory.json');fs.mkdirSync(this.dir,{recursive:true});this.data=this.load();}
  load(){try{return JSON.parse(fs.readFileSync(this.stateFile,'utf8'));}catch{return {profile:{},facts:[],preferences:[],behavior:[],projects:[],lastUpdated:null};}}
  save(){this.data.lastUpdated=new Date().toISOString();fs.writeFileSync(this.stateFile,JSON.stringify(this.data,null,2));this.render();}
  render(){const d=this.data;const md=['# Memory.md','',`Atualizado: ${d.lastUpdated||'-'}`,'','## Perfil',...Object.entries(d.profile).map(([k,v])=>`- ${k}: ${v}`),'','## Fatos',...d.facts.slice(-this.config.memoryMaxItems).map(x=>`- ${x}`),'','## Preferências',...d.preferences.slice(-this.config.memoryMaxItems).map(x=>`- ${x}`),'','## Comportamento',...d.behavior.slice(-this.config.memoryMaxItems).map(x=>`- ${x}`),'','## Projetos',...d.projects.slice(-this.config.memoryMaxItems).map(x=>`- ${x}`),''].join('\n');fs.writeFileSync(this.file,md,'utf8');}
  context(){return JSON.stringify(this.data);}
  ingest(text){ if(!text)return; const clean=text.replace(/\s+/g,' ').trim(); if(clean.length<4)return; if(/^meu nome é /i.test(clean)) this.data.profile.nome=clean.replace(/^meu nome é /i,''); if(/gosto de|prefiro|não gosto de/i.test(clean)) this.data.preferences.push(clean); if(/projeto|app|código|sistema/i.test(clean)) this.data.projects.push(clean); this.data.facts.push(clean); this.trim(); this.save(); }
  trim(){for(const k of ['facts','preferences','behavior','projects']) this.data[k]=this.data[k].slice(-this.config.memoryMaxItems);}
  updateBehavior(items=[]){for(const x of items) if(x) this.data.behavior.push(String(x));this.trim();this.save();}
  clear(){this.data={profile:{},facts:[],preferences:[],behavior:[],projects:[],lastUpdated:null};this.save();}
}
module.exports={MemoryManager};
