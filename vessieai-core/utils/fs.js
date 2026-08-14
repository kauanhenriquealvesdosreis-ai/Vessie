const fs = require('fs');
const path = require('path');
function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function safeName(name){ return String(name||'').trim().replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^\.+/,'') || 'unnamed'; }
function safeJoin(root, rel){
  const base = path.resolve(root); const target = path.resolve(base, rel || '.');
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error('Caminho fora da raiz permitida.');
  return target;
}
function readJson(file, fallback){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;} }
function writeJson(file, data){ ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data,null,2)+'\n','utf8'); }
module.exports={fs,path,ensureDir,safeName,safeJoin,readJson,writeJson};
