class WebSearch{
 constructor(config,logger){this.config=config;this.logger=logger;this.cache=new Map();}
 async search(query,maxResults=this.config.webSearchMaxResults){
  if(!this.config.webSearchEnabled) return [];
  const key=String(query).trim().toLowerCase(); if(!key)return [];
  const cached=this.cache.get(key); if(cached && cached.expires>Date.now())return cached.data;
  const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(key)}`;
  const r=await fetch(url,{headers:{'User-Agent':'VessieAI/2.0 (+local research client)'},signal:AbortSignal.timeout(10000)}); if(!r.ok)throw new Error(`Web search HTTP ${r.status}`);
  const html=(await r.text()).slice(0,2_000_000); const results=[]; const re=/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html)) && results.length<maxResults){const clean=s=>s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();results.push({title:clean(m[2]),url:m[1],snippet:clean(m[3])});}
  this.cache.set(key,{expires:Date.now()+5*60_000,data:results});return results;
 }
}
module.exports={WebSearch};
