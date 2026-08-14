const fs=require('fs');const path=require('path');const {safeJoin}=require('../utils/fs');
class ToolRegistry{
 constructor(config,logger){this.config=config;this.logger=logger;this.tools=new Map();this.registerBuiltins();}
 register(name,description,fn,schema={}){this.tools.set(name,{name,description,fn,schema});}
 registerBuiltins(){
  this.register('calculator','Calcula expressões aritméticas simples.',async({expression})=>{if(!/^[0-9+\-*/().%\s]+$/.test(expression||''))throw new Error('Expressão não permitida');return Function(`"use strict";return (${expression})`)();},{expression:'string'});
  this.register('read_text','Lê texto do workspace autorizado.',async({file})=>{const p=safeJoin(this.config.workspaceRoot,file);const st=fs.statSync(p);if(st.size>1024*1024)throw new Error('Arquivo excede 1 MB');return fs.readFileSync(p,'utf8');},{file:'string'});
  this.register('list_workspace','Lista arquivos do workspace.',async({dir='.'})=>{const p=safeJoin(this.config.workspaceRoot,dir);return fs.readdirSync(p,{withFileTypes:true}).map(x=>({name:x.name,type:x.isDirectory()?'dir':'file'}));},{dir:'string'});
 }
 list(){return [...this.tools.values()].map(({name,description,schema})=>({name,description,schema}));}
 async run(name,args){const t=this.tools.get(name);if(!t)throw new Error(`Tool inexistente: ${name}`);return t.fn(args||{});}
}
module.exports={ToolRegistry};
