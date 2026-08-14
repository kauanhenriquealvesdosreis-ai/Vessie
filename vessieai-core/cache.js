const crypto=require('crypto');
class ResponseCache{constructor(){this.map=new Map();}key(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}get(x){const k=this.key(x),v=this.map.get(k);if(v&&v.exp>Date.now())return v.value;this.map.delete(k);return null;}set(x,value,ttl=300000){this.map.set(this.key(x),{value,exp:Date.now()+ttl});}}
module.exports={ResponseCache};
