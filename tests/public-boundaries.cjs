'use strict';
// Disposable local tests. Never writes to delivered v3 or the working data folder.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawn} = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'temple-boundary-'));
fs.cpSync(path.resolve(__dirname, '..'), root, {recursive:true});
const storeFile=path.join(root,'server/data/store.json');
const store=JSON.parse(fs.readFileSync(storeFile));
const base=store.collections.challenges[0];
const cases=[['hidden',{hidden:true}],['draft',{status:'draft'}],['private',{access:'private'}],['archived',{availability:'archived'}],['soon',{availability:'soon'}]];
for(const [name,change] of cases){const c=structuredClone(base);c.id='test-'+name;Object.assign(c,change);c.title.ar='PRIVATE_SENTINEL_'+name;store.collections.challenges.push(c)}
base.artifacts.push({name:'PRIVATE_ARTIFACT_SENTINEL',url:'https://example.org/private',visibility:'hidden'});base.hints.push({ar:'PRIVATE_HINT_SENTINEL',en:'PRIVATE_HINT_SENTINEL',published:false});
base.sections.push({type:'paragraph',en:'PRIVATE_SECTION_SENTINEL',ar:'',zone:'solution',published:false});
const hiddenArticle=structuredClone(store.collections.articles[0]);hiddenArticle.id='secret-article';hiddenArticle.hidden=true;hiddenArticle.title.ar='PRIVATE_ARTICLE_SENTINEL';store.collections.articles.push(hiddenArticle);
fs.writeFileSync(storeFile,JSON.stringify(store));
fs.writeFileSync(path.join(root,'server/data/site-settings.json'),JSON.stringify({default_language:'en',arabic_enabled:true}));
fs.writeFileSync(path.join(root,'server/data/solves.json'),JSON.stringify({'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa':{'test-hidden':'2026-11-23T00:00:00Z','log4shell-lab':'2026-11-23T00:00:00Z'}}));
const flagFile=path.join(root,'server/flags.json');const flags=JSON.parse(fs.readFileSync(flagFile));for(const [name] of cases)flags['test-'+name]=structuredClone(flags[base.id]);fs.writeFileSync(flagFile,JSON.stringify(flags));
let child;let port=19287;let count=0;
const baseUrl='http://127.0.0.1:'+port;
const check=(ok,label)=>{assert.ok(ok,label);console.log('PASS '+label);count++};
const post=(endpoint,data)=>fetch(baseUrl+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
async function start(){child=spawn(process.execPath,['server/server.js'],{cwd:root,env:{...process.env,TOR_PORT:String(port),TOR_SHOW_SAMPLES:'1'},stdio:['ignore','pipe','pipe']});for(let i=0;i<50;i++){try{if((await fetch(baseUrl+'/')).ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw new Error('server startup failed')}
async function stop(){if(child){child.kill();await new Promise(r=>child.once('exit',r));child=null}}
(async()=>{try{
 await start();
 let r=await fetch(baseUrl+'/content.js');let js=await r.text();check(r.status===200,'public content served');
 for(const name of ['hidden','draft','private','archived'])check(!js.includes('PRIVATE_SENTINEL_'+name),'nonpublic '+name+' excluded from serialized content');
 check(!js.includes('PRIVATE_ARTICLE_SENTINEL'),'hidden article excluded');
 r=await fetch(baseUrl+'/api/state?identity=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');const state=await r.json();check(!state.solved.includes('test-hidden'),'solve-state omits nonpublic challenge IDs');check(state.solved.includes(base.id),'solve-state keeps public progress');
 const ctx={};vm.runInNewContext(js+';this.out=SITE_COLLECTIONS',ctx);const publicCh=ctx.out.challenges.find(x=>x.id===base.id);check(!!publicCh,'published challenge retained');check(!js.includes('PRIVATE_ARTIFACT_SENTINEL'),'hidden artifact metadata excluded server-side');check(!js.includes('PRIVATE_HINT_SENTINEL'),'draft hints excluded server-side');check(!js.includes('PRIVATE_SECTION_SENTINEL'),'draft sections excluded server-side');check(JSON.stringify(publicCh.sections)===JSON.stringify(base.sections.filter(s=>s.published!==false)),'public sections and intentionally revealable walkthrough retained');check(!!ctx.out.challenges.find(x=>x.id==='test-soon'),'soon teaser remains public');
 for(const [name] of cases){r=await post('/api/submit',{identity:'0123456789abcdef0123456789abcdef',challenge:'test-'+name,flag:'anything'});check(r.status===404,'server rejects '+name+' challenge submission')}
 r=await post('/api/submit',{identity:'0123456789abcdef0123456789abcdef',challenge:base.id,flag:'TOR{198.51.100.44}'});const solved=await r.json();check(solved.status==='correct','open challenge accepts correct answer');check(solved.points===base.points,'awarded points match challenge content');
 await stop();await start();r=await post('/api/submit',{identity:'0123456789abcdef0123456789abcdef',challenge:base.id,flag:'wrong'});check((await r.json()).status==='already','deduplicated solve survives restart');
 for(const p of ['/server/flags.json','/server/data/store.json','/artifacts/log4shell-lab/access.log','/.git/config','/README.txt','/content.js.tmp','/tests/public-boundaries.cjs','/admin.html','/admin.js']){r=await fetch(baseUrl+p);check(r.status===404,'deny static '+p)}
 r=await fetch(baseUrl+'/admin/',{redirect:'manual'});check(r.status===302,'admin root redirects');r=await fetch(baseUrl+'/admin/index.html',{redirect:'manual'});check(r.status===302,'unauthenticated dashboard blocked');
 r=await fetch(baseUrl+'/%xx');check(r.status===400,'malformed URL handled');r=await fetch(baseUrl+'/');check(r.status===200,'server stays healthy after malformed URL');
 r=await fetch(baseUrl+'/admin/api/setup',{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'203.0.113.7'},body:JSON.stringify({username:'evil',password:'attacker-password-123'})});check(r.status===403,'setup refused when request carries proxy headers');
r=await fetch(baseUrl+'/');check(!!r.headers.get('content-security-policy')&&/frame-ancestors 'none'/.test(r.headers.get('content-security-policy')),'CSP header present');
r=await fetch(baseUrl+'/api/state?identity=0123456789abcdef0123456789abcdef');check(r.headers.get('access-control-allow-origin')===null,'no wildcard CORS by default');
r=await post('/admin/api/setup',{username:'testadmin',password:'local-test-password-only'});check(r.status===200,'local setup works');r=await post('/admin/api/login',{username:'testadmin',password:'local-test-password-only'});const cookie=r.headers.get('set-cookie').split(';')[0];let j=await r.json();check(r.status===200 && !!j.csrf,'local admin login works');r=await fetch(baseUrl+'/admin/api/content',{headers:{cookie}});j=await r.json();check(j.collections.challenges.some(c=>c.id==='test-hidden'),'authenticated admin retains private records');
 console.log('TOTAL '+count+' assertions passed');
}finally{await stop();fs.rmSync(root,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
