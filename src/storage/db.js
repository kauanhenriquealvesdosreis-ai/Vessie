const KEY='vessieai:db:v4';
const empty={settings:{lmBase:'http://localhost:1234/v1',model:''},projects:[],snippets:[],memories:[],tags:{}};
export function loadDB(){try{return {...empty,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return structuredClone(empty)}}
export function saveDB(db){localStorage.setItem(KEY,JSON.stringify(db));return db}
export function upsertSnippet(s){const db=loadDB();const i=db.snippets.findIndex(x=>x.id===s.id);if(i<0)db.snippets.push(s);else db.snippets[i]={...db.snippets[i],...s};saveDB(db);return s}
export function searchSnippets(q='',tags=[]){const db=loadDB();const t=q.toLowerCase();return db.snippets.filter(s=>(!t||`${s.name} ${s.code} ${s.description}`.toLowerCase().includes(t))&&(!tags.length||tags.every(x=>s.tags?.includes(x))))}
