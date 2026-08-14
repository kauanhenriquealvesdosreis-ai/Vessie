function parseTags(text){const s=String(text||'');return {think:/<Think>\b/i.test(s),code:/<Code>\b/i.test(s),interpretation:/<Interpretagem>\b/i.test(s)};}
function stripTags(text){return String(text||'').replace(/<\/?(?:Think|Code|Interpretagem)>/gi,'').trim();}
module.exports={parseTags,stripTags};
