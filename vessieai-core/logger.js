const fs = require('fs'); const path = require('path');
function createLogger(root){
  const file=path.join(root,'vessieai-core','storage','vessieai.log'); fs.mkdirSync(path.dirname(file),{recursive:true});
  const write=(level,msg)=>{ const line=`${new Date().toISOString()} [${level}] ${msg}`; console.log(line); try{fs.appendFileSync(file,line+'\n');}catch{} };
  return {info:(m)=>write('INFO',m),warn:(m)=>write('WARN',m),error:(m)=>write('ERROR',m)};
}
module.exports={createLogger};
