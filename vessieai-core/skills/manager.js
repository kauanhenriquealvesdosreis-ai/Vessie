const fs=require('fs');const path=require('path');
class SkillManager{
 constructor(config,logger){this.config=config;this.logger=logger;this.dir=path.join(config.core,'skills');fs.mkdirSync(this.dir,{recursive:true});}
 list(){return fs.readdirSync(this.dir,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);}
 get(name){const dir=path.join(this.dir,name);if(!fs.existsSync(dir))return null;const md=path.join(dir,'SKILL.md');return {name,content:fs.existsSync(md)?fs.readFileSync(md,'utf8'):''};}
 create(name,content,meta={}){const safe=String(name).trim().replace(/[^a-zA-Z0-9._-]+/g,'_');if(!safe)throw new Error('Nome inválido');const dir=path.join(this.dir,safe);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'SKILL.md'),`# ${safe}\n\n${content}\n`,'utf8');fs.writeFileSync(path.join(dir,'metadata.json'),JSON.stringify({...meta,name:safe,updatedAt:new Date().toISOString()},null,2));return safe;}
}
module.exports={SkillManager};
