class DiscordStorage{
 constructor(config,logger){this.config=config;this.logger=logger;}
 async save(content,title='VessieAI'){
  if(!this.config.discordEnabled||!this.config.discordWebhookUrl)return {stored:false,reason:'disabled'};
  const r=await fetch(this.config.discordWebhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:`**${title}**\n${String(content).slice(0,1800)}`}),signal:AbortSignal.timeout(8000)});return {stored:r.ok};
 }
}
module.exports={DiscordStorage};
