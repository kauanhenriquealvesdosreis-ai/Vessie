const fs=require('fs');const {spawn}=require('child_process');
class MCPClient{
 constructor(config,logger){this.config=config;this.logger=logger;this.servers={};this.load();}
 load(){try{this.servers=JSON.parse(fs.readFileSync(this.config.mcpConfig,'utf8')).servers||{};}catch{this.servers={};}}
 list(){return Object.entries(this.servers).map(([name,c])=>({name,transport:c.transport||'stdio',command:c.command,args:c.args||[],description:c.description||''}));}
 async call(server,method,params={}){const c=this.servers[server];if(!c)throw new Error('MCP server não configurado');if(c.transport!=='stdio')throw new Error('Somente stdio suportado nesta versão base');return new Promise((resolve,reject)=>{const p=spawn(c.command,c.args||[],{cwd:c.cwd||process.cwd(),env:{...process.env,...(c.env||{})}});let out='',err='';p.stdout.on('data',d=>{out+=d.toString();});p.stderr.on('data',d=>{err+=d.toString();});const timer=setTimeout(()=>{p.kill();reject(new Error('MCP timeout'));},10000);p.on('error',e=>{clearTimeout(timer);reject(e);});p.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error(err||`MCP exit ${code}`));try{resolve(JSON.parse(out.trim().split(/\r?\n/).pop()));}catch{resolve({raw:out});}});p.stdin.write(JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params})+'\n');});}
}
module.exports={MCPClient};
