const replacements=[[/\bvc\b/gi,'você'],[/\bq\b/gi,'que'],[/\bconsegui\b/gi,'consegui'],[/\bprq\b/gi,'porque'],[/\bnao\b/gi,'não'],[/\bja\b/gi,'já'],[/\bso\b/gi,'só'],[/\bIA\b/g,'IA']];
function normalize(text){let out=String(text||'');for(const [re,v] of replacements)out=out.replace(re,v);return out;}
module.exports={normalize};
