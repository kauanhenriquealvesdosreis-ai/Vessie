const crypto=require('crypto');
class Auth{constructor(config){this.config=config;this.sessions=new Map();}
 token(){return crypto.randomBytes(32).toString('hex');}
 login(password){if(!this.config.authEnabled)return {ok:true,token:null};if(String(password||'')!==this.config.authPassword)return {ok:false};const token=this.token();this.sessions.set(token,Date.now()+this.config.sessionTtlHours*3600000);return {ok:true,token};}
 check(token){if(!this.config.authEnabled)return true;const exp=this.sessions.get(token);if(!exp)return false;if(exp<Date.now()){this.sessions.delete(token);return false;}return true;}
 logout(token){this.sessions.delete(token);}
}
module.exports={Auth};
