const fs=require('fs');const path=require('path');
class Updater{
 constructor(config,logger){this.config=config;this.logger=logger;this.last=new Map();this.timer=null;this.lastActivity=Date.now();}
 touch(){this.lastActivity=Date.now();}
 snapshot(){const dirs=[path.join(this.config.core,'skills'),path.join(this.config.core,'modules'),path.join(this.config.core,'context')];const files=[];for(const d of dirs){if(!fs.existsSync(d))continue;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isFile())files.push(p);}}return files;}
 start(onChange){this.timer=setInterval(()=>{let changed=false;for(const p of this.snapshot()){const m=fs.statSync(p).mtimeMs;if(!this.last.has(p)||this.last.get(p)!==m){this.last.set(p,m);changed=true;}}if(changed&&onChange)onChange();},2000);return this.timer;}
 stop(){if(this.timer)clearInterval(this.timer);}
}
module.exports={Updater};
