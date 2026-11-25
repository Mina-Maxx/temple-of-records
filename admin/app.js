/* Temple Admin — shared shell (v1). Bilingual AR/EN, session guard, CSRF-aware fetch. */
(function(){
'use strict';
var LS='tor_admin_';
var dict={
 ar:{
  brand:'إدارة المعبد',brandSub:'The Temple of Records',
  gMain:'الرئيسية',gContent:'المحتوى',gPlatform:'المنصة',gSystem:'النظام',
  nDash:'لوحة التحكم',nChallenges:'التحديات',nArticles:'الرايتبس والحلول',nEvidence:'مستودع الأدلة',
  nFlags:'إعداد الفلاجات',nSubs:'المحاولات والحلول',nPlayers:'الأسماء المسجّلة',
  nInv:'التحقيقات',nCats:'التصنيفات والوسوم',nMedia:'مكتبة الوسائط',
  nSettings:'الإعدادات',nAudit:'سجل التدقيق',
  logout:'خروج',viewSite:'عرض الموقع',gSearch:'بحث شامل…',noRes:'لا نتائج',qCreate:'إنشاء سريع',qChal:'تحدٍّ جديد',qArt:'رايتب جديد',qMedia:'رفع وسائط',qSubs:'مراجعة المحاولات',notifT:'آخر الأنشطة',collapse:'طي القائمة',logoutQ:'تسجيل الخروج؟',logoutB:'ستنتهي جلستك الحالية على هذا الجهاز.',sessEnd:'انتهت الجلسة',sessEndB:'سجّل الدخول مرة أخرى للمتابعة. لم يُحفظ أي تعديل غير محفوظ.',sessWarn:'ستنتهي جلستك قريبًا',sessWarnB:'أي نشاط في اللوحة يجدّد الجلسة. احفظ عملك الآن.',unsavedWarn:'لديك تعديلات غير محفوظة.',
  lang:'العربية',
  loading:'جارٍ التحميل…',errNet:'تعذّر الاتصال بالخادم المحلي. شغّل: node server/server.js',
  demoNote:'وضع العرض التجريبي — بيانات نموذجية',soon:'قريبًا',save:'حفظ',cancel:'إلغاء',edit:'تحرير',create:'إنشاء',
  del:'حذف',search:'بحث…',actions:'إجراءات',empty:'لا عناصر بعد',emptySub:'ابدأ بإنشاء أول عنصر.',
  sChal:'التحديات',sArt:'الرايتبس',sInv:'التحقيقات',sSolves:'حلول مسجّلة',sSubs:'محاولات مسجّلة',sPlayers:'أسماء مسجّلة',sAvail:'متاح الآن',
  dashWelcome:'نظرة عامة على منصة التحديات والمحتوى.',recentAct:'آخر نشاط',health:'صحة المنصة',
  sampleData:'البيانات الحالية نموذجية وموسومة حتى يدخل محتوى حقيقي.',
  confirm:'تأكيد',confirmDel:'هذا الإجراء لا يمكن التراجع عنه. متابعة؟',
  saved:'تم الحفظ',updated:'تم التحديث',created:'تم الإنشاء',failed:'فشل العملية',
  login:'دخول',username:'اسم المستخدم',password:'كلمة المرور',setupTitle:'إعداد أولي — إنشاء حساب الأدمن',
  setupSub:'يحدث مرة واحدة، ومن هذا الجهاز فقط (localhost).',loginSub:'تسجيل الدخول إلى لوحة إدارة المعبد.',
  forgot:'نسيت كلمة المرور؟ لا يوجد استرداد بالبريد في وضع العرض المحلي — استعن بوصول مباشر للخادم.',
  wrongCred:'بيانات الدخول غير صحيحة.',setupDone:'تم إنشاء الحساب — سجّل الدخول.',
  minPw:'١٠ أحرف على الأقل',
  thTitle:'العنوان',thStatus:'الحالة',thCat:'الفئة',thDiff:'الصعوبة',thPts:'النقاط',thSolves:'الحلول',thUpdated:'آخر تحديث',
  stAvail:'متاح',stPrep:'قيد التحضير',stArch:'مؤرشف',stDemo:'تجريبي',
  auditTs:'الوقت',auditActor:'الفاعل',auditAction:'الإجراء',auditEntity:'العنصر',auditRes:'النتيجة'
 },
 en:{
  brand:'Temple Admin',brandSub:'The Temple of Records',
  gMain:'Main',gContent:'Content',gPlatform:'Platform',gSystem:'System',
  nDash:'Dashboard',nChallenges:'Challenges',nArticles:'Writeups',nEvidence:'Evidence Repository',
  nFlags:'Flag Configuration',nSubs:'Submissions & Solves',nPlayers:'Recorded Solvers',
  nInv:'Investigations',nCats:'Categories & Tags',nMedia:'Media Library',
  nSettings:'Settings',nAudit:'Audit Log',
  logout:'Log out',viewSite:'View site',gSearch:'Search everything…',noRes:'No results',qCreate:'Quick create',qChal:'New challenge',qArt:'New writeup',qMedia:'Upload media',qSubs:'Review submissions',notifT:'Recent activity',collapse:'Collapse sidebar',logoutQ:'Log out?',logoutB:'Your session on this device will end.',sessEnd:'Session expired',sessEndB:'Sign in again to continue. Unsaved edits were not saved.',sessWarn:'Your session is about to expire',sessWarnB:'Any activity in the panel renews it. Save your work now.',unsavedWarn:'You have unsaved changes.',
  lang:'English',
  loading:'Loading…',errNet:'Cannot reach the local server. Run: node server/server.js',
  demoNote:'Demo mode — sample data',soon:'Soon',save:'Save',cancel:'Cancel',edit:'Edit',create:'Create',
  del:'Delete',search:'Search…',actions:'Actions',empty:'Nothing here yet',emptySub:'Create the first item to get started.',
  sChal:'Challenges',sArt:'Writeups',sInv:'Investigations',sSolves:'Recorded solves',sSubs:'Submissions',sPlayers:'Recorded solvers',sAvail:'Available now',
  dashWelcome:'Overview of the challenge platform and content.',recentAct:'Recent activity',health:'Platform health',
  sampleData:'Current data is labeled sample content until real material lands.',
  confirm:'Confirm',confirmDel:'This cannot be undone. Continue?',
  saved:'Saved',updated:'Updated',created:'Created',failed:'Operation failed',
  login:'Sign in',username:'Username',password:'Password',setupTitle:'First-time setup — create the admin account',
  setupSub:'Happens once, from this machine only (localhost).',loginSub:'Sign in to the Temple admin.',
  forgot:'Forgot the password? There is no email recovery in local demo mode — direct server access is required.',
  wrongCred:'Invalid credentials.',setupDone:'Account created — sign in.',
  minPw:'At least 10 characters',
  thTitle:'Title',thStatus:'Status',thCat:'Category',thDiff:'Difficulty',thPts:'Points',thSolves:'Solves',thUpdated:'Updated',
  stAvail:'Available',stPrep:'In preparation',stArch:'Archived',stDemo:'Demo',
  auditTs:'Time',auditActor:'Actor',auditAction:'Action',auditEntity:'Entity',auditRes:'Result'
 }};
function lang(){var l=localStorage.getItem(LS+'lang');return l==='en'?'en':'ar'}
function setLang(l){localStorage.setItem(LS+'lang',l);location.reload()}
function t(k){var d=dict[lang()];return d[k]!==undefined?d[k]:k}
var CSRF=null,ME=null;var lastAuthAt=Date.now(),sessionExpiry=Date.now()+12*3600*1000;
function api(path,opt){
 opt=opt||{};opt.headers=opt.headers||{};
 if(opt.body&&typeof opt.body!=='string'){opt.body=JSON.stringify(opt.body);opt.headers['Content-Type']='application/json'}
 if(CSRF&&opt.method&&opt.method!=='GET')opt.headers['x-csrf-token']=CSRF;
 return fetch(path,opt).then(function(r){
  if(r.status===401&&location.pathname.indexOf('/admin/login')===-1){sessionEnded();throw{auth:true}}
  return r.json().then(function(j){j._code=r.status;if(r.ok){lastAuthAt=Date.now();if(opt.method&&opt.method!=='GET')window.dispatchEvent(new CustomEvent('tor:saved',{detail:path}))}return j});
 });
}
var _ended=false;
function sessionEnded(){
 if(_ended)return;_ended=true;
 try{modal({title:t('sessEnd'),body:t('sessEndB'),confirmLabel:t('login'),onConfirm:function(){location.replace('/admin/login.html')}})}catch(e){location.replace('/admin/login.html')}
}
function boot(){ // session guard for app pages
 return api('/admin/api/me').then(function(j){
  if(j._code!==200){location.replace('/admin/login.html');return null}
  ME={username:j.username,arabic_enabled:j.arabic_enabled===true};CSRF=j.csrf;if(j.expiresAt)sessionExpiry=Date.parse(j.expiresAt);
  if(document.body)document.body.classList.toggle('en-only',!ME.arabic_enabled);
  return j;
 }).catch(function(e){if(!e||!e.auth)toast(t('errNet'),'err');return null});
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function toast(msg,kind){
 var w=document.querySelector('.toasts');if(!w){w=document.createElement('div');w.className='toasts';document.body.appendChild(w)}
 var el=document.createElement('div');el.className='toast '+(kind||'');el.textContent=msg;w.appendChild(el);
 setTimeout(function(){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){el.remove()},350)},3600);
}
function modal(opts){ // {title,body,confirmLabel,danger,onConfirm}
 var sc=document.createElement('div');sc.className='modal-scrim on';
 sc.innerHTML='<div class="modal" role="dialog" aria-modal="true"><h3>'+esc(opts.title)+'</h3>'+(opts.html?'<div class="modal-html">'+opts.body+'</div>':'<p>'+esc(opts.body)+'</p>')+
  '<div class="row"><button class="btn ghost" data-x>'+t('cancel')+'</button>'+
  '<button class="btn '+(opts.danger?'danger':'primary')+'" data-ok>'+esc(opts.confirmLabel||t('confirm'))+'</button></div></div>';
 document.body.appendChild(sc);
 sc.querySelector('[data-x]').onclick=function(){sc.remove()};
 sc.addEventListener('click',function(e){if(e.target===sc)sc.remove()});
 sc.querySelector('[data-ok]').onclick=function(){var b=this;b.disabled=true;opts.onConfirm(function(){sc.remove()})};
}
var ICONS={
 dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 flag:'<path d="M5 3v18M5 4h13l-2.5 4L18 12H5"/>',
 doc:'<path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v6h5"/>',
 box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 8.5L12 13l8.7-4.5M12 13v9"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3m-4 1l3 3m-6 0l3 3"/>',
 send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M17.5 14.5a6.5 6.5 0 0 1 4 5.5"/>',
 book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
 grid:'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
 tags:'<path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
 img:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-9 9"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.09a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 ext:'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
};
function icon(n,s){return '<svg width="'+(s||17)+'" height="'+(s||17)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[n]+'</svg>'}
var NAV=[
 {grp:'gMain',items:[{id:'dashboard',href:'index.html',icon:'dash',t:'nDash'}]},
 {grp:'gContent',items:[
  {id:'challenges',href:'challenges.html',icon:'flag',t:'nChallenges'},
  {id:'inv',href:'investigations.html',icon:'search',t:'nInv'},
  {id:'articles',href:'articles.html',icon:'doc',t:'nArticles'},
  {id:'evidence',href:'evidence.html',icon:'box',t:'nEvidence'},
  {id:'cats',href:'categories.html',icon:'tags',t:'nCats'},
  {id:'media',href:'media.html',icon:'img',t:'nMedia'}]},
 {grp:'gPlatform',items:[
  {id:'flags',href:'flags.html',icon:'key',t:'nFlags'},
  {id:'subs',href:'submissions.html',icon:'send',t:'nSubs'},
  {id:'players',href:'players.html',icon:'users',t:'nPlayers'}]},
 {grp:'gSystem',items:[
  {id:'audit',href:'audit.html',icon:'list',t:'nAudit'},
  {id:'settings',href:'settings.html',icon:'gear',t:'nSettings'}]}
];
function shell(active,crumb,cb){
 var L=lang();
 document.documentElement.lang=L;document.documentElement.dir=L==='ar'?'rtl':'ltr';
 document.body.classList.toggle('en',L==='en');
 var nav='';
 NAV.forEach(function(g){
  nav+='<div class="grp">'+t(g.grp)+'</div>';
  g.items.forEach(function(it){
   nav+='<a href="'+it.href+'" class="'+(it.id===active?'on':'')+'">'+icon(it.icon)+'<span>'+t(it.t)+'</span>'+
    (it.soon?'<span class="pill">'+t('soon')+'</span>':'')+'</a>';
  });
 });
 document.body.innerHTML=
 '<div class="scrim" id="scrim"></div><div class="app">'+
 '<aside class="side" id="side"><div class="side-brand"><span class="mark">'+icon('flag',18)+'</span><span><b>'+t('brand')+'</b><span>'+t('brandSub')+'</span></span></div>'+
 '<nav class="side-nav" aria-label="main">'+nav+'</nav>'+
 '<div class="side-foot">'+t('demoNote')+'</div></aside>'+
 '<div class="main"><header class="topbar">'+
 '<button class="icon-btn burger" id="burger" aria-label="menu">'+icon('menu')+'</button>'+
 '<button class="icon-btn" id="collapse" title="'+esc(t('collapse'))+'" aria-label="'+esc(t('collapse'))+'">'+icon('menu')+'</button>'+
 '<div class="crumbs">'+crumb+'</div><div class="sp"></div>'+
 '<div class="gsearch"><input id="gs" type="search" autocomplete="off" placeholder="'+esc(t('gSearch'))+'" aria-label="'+esc(t('gSearch'))+'"><div class="gs-res" id="gsr" hidden></div></div>'+
 '<div class="dd"><button class="btn primary sm" id="qc">+ '+esc(t('qCreate'))+'</button><div class="dd-menu" id="qcm" hidden><a href="challenge-edit.html">'+esc(t('qChal'))+'</a><a href="article-edit.html">'+esc(t('qArt'))+'</a><a href="media.html">'+esc(t('qMedia'))+'</a><a href="submissions.html">'+esc(t('qSubs'))+'</a></div></div>'+
 '<div class="dd"><button class="icon-btn" id="nt" aria-label="'+esc(t('notifT'))+'" title="'+esc(t('notifT'))+'">'+icon('list')+'</button><div class="dd-menu wide" id="ntm" hidden></div></div>'+
 '<div class="top-actions">'+
 '<span class="lang-sw" role="group" aria-label="language"><button class="'+(L==='ar'?'on':'')+'" data-lang="ar">ع</button><button class="'+(L==='en'?'on':'')+'" data-lang="en">EN</button></span>'+
 '<a class="icon-btn" href="../index.html" target="_blank" rel="noopener" title="'+esc(t('viewSite'))+'" aria-label="'+esc(t('viewSite'))+'">'+icon('ext')+'</a>'+
 '<button class="icon-btn" id="logout" title="'+esc(t('logout'))+'" aria-label="'+esc(t('logout'))+'">'+icon('out')+'</button>'+
 '<div class="dd"><button class="user-chip" id="profile" aria-label="'+esc(t('nSettings'))+'"><span class="ava">'+esc((ME&&ME.username||'?').slice(0,2).toUpperCase())+'</span><span>'+esc(ME&&ME.username||'')+'</span></button><div class="dd-menu" id="profile-menu" hidden><a href="settings.html">'+esc(t('nSettings'))+'</a><a href="audit.html">'+esc(t('nAudit'))+'</a></div></div>'+
 '</div></header><div class="content" id="content"><div class="skel" style="min-height:120px"></div><div class="skel"></div><div class="skel"></div></div></div></div>';
 document.querySelectorAll('[data-lang]').forEach(function(b){b.onclick=function(){setLang(b.dataset.lang)}});
 document.getElementById('logout').onclick=function(){modal({title:t('logoutQ'),body:t('logoutB'),confirmLabel:t('logout'),onConfirm:function(){api('/admin/api/logout',{method:'POST',body:{}}).finally(function(){location.replace('/admin/login.html')})}})};
 // collapsible sidebar (remembered)
 var appEl=document.querySelector('.app');
 if(localStorage.getItem('tor_side')==='0')appEl.classList.add('collapsed');
 document.getElementById('collapse').onclick=function(){appEl.classList.toggle('collapsed');localStorage.setItem('tor_side',appEl.classList.contains('collapsed')?'0':'1')};
 // dropdowns
 function dd(btn,menu,onOpen){document.getElementById(btn).onclick=function(e){e.stopPropagation();var m=document.getElementById(menu);var open=m.hidden;document.querySelectorAll('.dd-menu').forEach(function(x){x.hidden=true});m.hidden=!open;if(open&&onOpen)onOpen(m)}}
 dd('qc','qcm');dd('profile','profile-menu');
 dd('nt','ntm',function(m){m.innerHTML='<div class="dd-h">'+esc(t('notifT'))+'</div><div class="dim small" style="padding:8px 12px">…</div>';
  api('/admin/api/audit').then(function(j){var rows=(j.audit||[]).slice(0,8);m.innerHTML='<div class="dd-h">'+esc(t('notifT'))+'</div>'+(rows.length?rows.map(function(r){return '<div class="dd-i"><b>'+esc(actLabel(r.action))+'</b><span class="mono dim small">'+esc(r.entity||'')+'</span><span class="dim small">'+esc(fmtTs(r.ts))+'</span></div>'}).join(''):'<div class="dim small" style="padding:8px 12px">'+esc(t('noRes'))+'</div>')}).catch(function(){})});
 document.addEventListener('click',function(){document.querySelectorAll('.dd-menu').forEach(function(x){x.hidden=true})});
 // global search over content collections (client side, from the admin content API)
 var gs=document.getElementById('gs'),gsr=document.getElementById('gsr'),cache=null;
 var PAGES={challenges:'challenge-edit.html?id=',articles:'article-edit.html?id=',investigations:'investigations.html?id=',categories:'categories.html?id='};
 gs.addEventListener('input',function(){
  var q=gs.value.trim().toLowerCase();if(!q){gsr.hidden=true;return}
  function show(){var arOn=!(ME&&ME.arabic_enabled===false);var out=[];Object.keys(cache).forEach(function(col){(cache[col]||[]).forEach(function(it){
    var display=it.title||it.name;var ti=arOn?(display&&typeof display==='object'?(display.ar||'')+' '+(display.en||''):((it.title_ar||'')+' '+(it.title_en||'')+' '+(it.title||it.name||''))):((display&&typeof display==='object'?display.en:'')||(it.title_en||it.name_en||''));
    if((ti+' '+(it.id||'')).toLowerCase().indexOf(q)>-1&&PAGES[col])out.push({col:col,id:it.id,ti:(arOn&&lang()==='ar'?(it.title_ar||(it.title&&it.title.ar)):(it.title_en||(it.title&&it.title.en)))||(display&&typeof display==='object'?(arOn?display[lang()]||display.en||display.ar:display.en):display)||it.id})})});
   gsr.innerHTML=out.slice(0,10).map(function(o){return '<a href="'+PAGES[o.col]+encodeURIComponent(o.id)+'"><span class="dim small">'+esc(o.col)+'</span> '+esc(o.ti)+'</a>'}).join('')||'<div class="dim small" style="padding:8px 12px">'+esc(t('noRes'))+'</div>';gsr.hidden=false}
  if(cache)show();else api('/admin/api/content').then(function(j){cache=j.collections||{};show()}).catch(function(){})});
 document.addEventListener('click',function(e){if(!gsr.contains(e.target)&&e.target!==gs)gsr.hidden=true});
 // session-expiry warning (12h maximum session lifetime) 
 
 setInterval(function(){if(sessionExpiry-Date.now()<30*60000&&!window.__sw){window.__sw=1;toast(t('sessWarn')+' — '+t('sessWarnB'),'err')}},60000);
 // unsaved-changes guard: any edit inside an editor page until its save button is pressed
 var dirty=false,cont=document.getElementById('content'),dirtyScopes=new Set();
 function editScope(el){if(location.pathname.includes('settings'))return el.closest('#site-config')?'site-settings':el.matches('[id^=seo-]')?'seo':el.matches('[id^=pw-]')?'password':'fixed';return 'content'}
 ['input','change'].forEach(function(kind){cont.addEventListener(kind,function(e){if(e.target.closest('[data-pane],#secs,#hints,#arts,.panel')&&/article-edit|challenge-edit|settings|investigations/.test(location.pathname)&&!e.target.matches('#q,[type=search]')){dirtyScopes.add(editScope(e.target));dirty=true}})});
 cont.addEventListener('click',function(e){if(e.target.closest('[data-del],[data-up],[data-dn],[data-hup],[data-hdn],#hints button,#arts button,#add-sec,#add-hint,#add-art,[data-add-entry],[data-add-link]')&&/article-edit|challenge-edit|investigations/.test(location.pathname)){dirtyScopes.add('content');dirty=true}});
 window.addEventListener('tor:saved',function(e){var p=e.detail;if(location.pathname.includes('settings')){if(p.includes('/site-settings'))dirtyScopes.delete('site-settings');else if(p.includes('/content/fixed'))dirtyScopes.delete('fixed');else if(p.includes('/seo'))dirtyScopes.delete('seo');else if(p.includes('/password'))dirtyScopes.delete('password')}else if(/\/admin\/api\/(articles|challenges|collection)/.test(p))dirtyScopes.clear();dirty=dirtyScopes.size>0});
 window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=t('unsavedWarn');return t('unsavedWarn')}});
 var side=document.getElementById('side'),scrim=document.getElementById('scrim');
 document.getElementById('burger').onclick=function(){side.classList.add('open');scrim.classList.add('on')};
 scrim.onclick=function(){side.classList.remove('open');scrim.classList.remove('on')};
 cb(document.getElementById('content'));
}
function badge(txt,kind){return '<span class="badge '+(kind||'dim')+'">'+esc(txt)+'</span>'}
function fmtTs(s){if(!s)return '—';var d=new Date(s);return d.toLocaleDateString(lang()==='ar'?'ar-EG-u-nu-latn':'en-GB',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString(lang()==='ar'?'ar-EG-u-nu-latn':'en-GB',{hour:'2-digit',minute:'2-digit'})}
var ACT={
 ar:{admin_setup:'إعداد المدير',login:'تسجيل دخول',logout:'تسجيل خروج',
 challenge_create:'إنشاء تحدٍّ',challenge_update:'تعديل تحدٍّ',challenge_archive:'أرشفة/استعادة تحدٍّ',challenge_duplicate:'تكرار تحدٍّ',challenge_delete:'حذف تحدٍّ',
 article_create:'إنشاء مقال',article_update:'تعديل مقال',article_archive:'أرشفة/استعادة مقال',
 kb_create:'إنشاء عنصر معرفة',kb_update:'تعديل عنصر معرفة',kb_archive:'أرشفة عنصر معرفة',
 investigations_create:'إنشاء تحقيق',investigations_update:'تعديل تحقيق',investigations_archive:'أرشفة تحقيق',
 projects_create:'إنشاء مشروع',projects_update:'تعديل مشروع',projects_archive:'أرشفة مشروع',
 categories_create:'إنشاء فئة',categories_update:'تعديل فئة',categories_archive:'أرشفة فئة',
 fixed_update:'تحديث نصوص ثابتة',flag_set:'ضبط فلاج',flag_replace:'استبدال فلاج',flag_policy:'قواعد صيغة الفلاج',
 media_upload:'رفع وسائط',media_replace:'استبدال وسائط',media_delete:'حذف وسائط',
 seo_update:'تحديث SEO',tag_rename:'إعادة تسمية وسم',player_disable:'تعطيل لاعب',player_enable:'تفعيل لاعب'},
 en:{admin_setup:'Admin setup',login:'Sign-in',logout:'Sign-out',
 challenge_create:'Challenge created',challenge_update:'Challenge updated',challenge_archive:'Challenge archived/restored',challenge_duplicate:'Challenge duplicated',challenge_delete:'Challenge deleted',
 article_create:'Article created',article_update:'Article updated',article_archive:'Article archived/restored',
 kb_create:'KB item created',kb_update:'KB item updated',kb_archive:'KB item archived',
 investigations_create:'Investigation created',investigations_update:'Investigation updated',investigations_archive:'Investigation archived',
 projects_create:'Project created',projects_update:'Project updated',projects_archive:'Project archived',
 categories_create:'Category created',categories_update:'Category updated',categories_archive:'Category archived',
 fixed_update:'Fixed texts updated',flag_set:'Flag set',flag_replace:'Flag replaced',flag_policy:'Flag format rules',
 media_upload:'Media uploaded',media_replace:'Media replaced',media_delete:'Media deleted',
 seo_update:'SEO updated',tag_rename:'Tag renamed',player_disable:'Player disabled',player_enable:'Player enabled'}
};
var RES={ar:{ok:'نجاح',failed:'فشل',denied:'مرفوض',correct:'صحيح',wrong:'خاطئ',already:'محلول مسبقًا',rate_limited:'تجاوز المعدل'},en:{ok:'ok',failed:'failed',denied:'denied',correct:'correct',wrong:'wrong',already:'already solved',rate_limited:'rate limited'}};
function actLabel(k){return (ACT[lang()]&&ACT[lang()][k])||k}
function resLabel(k){return (RES[lang()]&&RES[lang()][k])||k}

// Shared structured block editor. All values render as text in the public site.
function sectionFields(el,s){
 var publication=document.createElement('label');publication.className='small dim';publication.style.display='block';publication.style.marginTop='10px';var cb=document.createElement('input');cb.type='checkbox';cb.checked=s.published!==false;cb.onchange=function(){s.published=cb.checked};publication.appendChild(cb);publication.appendChild(document.createTextNode(lang()==='ar'?' قسم منشور':' Published section'));el.appendChild(publication);

 var ar=lang()==='ar',w=document.createElement('div');w.className='section-fields';w.style.marginTop='12px';
 function input(key,label,val,area){var d=document.createElement('div');d.className='field';var l=document.createElement('label');l.textContent=label;d.appendChild(l);var i=document.createElement(area?'textarea':'input');i.className='input';if(area)i.rows=4;i.value=val==null?'':val;if(/src|url|code|json/i.test(key))i.dir='ltr';d.appendChild(i);w.appendChild(d);return i}
 function bind(k,label){var i=input(k,label,s[k]);i.oninput=function(){s[k]=i.value}}
 if(s.type==='link')bind('url',ar?'الرابط (https)':'Link (https)');
 if(s.type==='image'){
  bind('src',ar?'مسار الصورة assets/…':'Image path assets/…');bind('alt_ar','Alt AR');bind('alt_en','Alt EN');bind('caption_ar',ar?'التعليق (عربي)':'Caption AR');bind('caption_en','Caption EN');
 }
 if(s.type==='code'){bind('label_ar',ar?'عنوان الكود (عربي)':'Code label AR');bind('label_en','Code label EN')}
 if(s.type==='callout'){bind('title_ar',ar?'عنوان التنبيه (عربي)':'Callout title AR');bind('title_en','Callout title EN')}
 if(s.type==='list'){
  var ord=input('ordered',ar?'نوع القائمة (1 مرقمة، 0 غير مرقمة)':'List (1 ordered, 0 unordered)',s.ordered?'1':'0');ord.oninput=function(){s.ordered=ord.value==='1'};
  ['ar','en'].forEach(function(lang){var i=input('items_'+lang,lang==='ar'?'عناصر القائمة، عنصر في كل سطر (عربي)':'List items, one per line (English)',(s.items||[]).map(x=>x[lang]||'').join('\n'),true);i.oninput=function(){var lines=i.value.split('\n');var old=s.items||[];s.items=Array.from({length:Math.max(lines.length,old.length)},(_,n)=>Object.assign({},old[n]||{ar:'',en:''},{[lang]:lines[n]||''})).filter(x=>x.ar||x.en)}});
 }
 if(s.type==='table'){
  var help=document.createElement('p');help.className='small dim';help.textContent=ar?'JSON: عناوين headers وصفوف rows، كل خلية {ar,en}.':'JSON: headers and rows; each cell is {ar,en}.';w.appendChild(help);
  var tx=input('json','Table JSON',JSON.stringify({headers:s.headers||[],rows:s.rows||[]},null,2),true);tx.oninput=function(){try{var v=JSON.parse(tx.value);if(!Array.isArray(v.headers)||!Array.isArray(v.rows))throw 0;s.headers=v.headers;s.rows=v.rows;tx.setCustomValidity('')}catch(e){tx.setCustomValidity(ar?'JSON غير صالح':'Invalid JSON')}};
 }
 el.appendChild(w);
}
window.TORADMIN={sectionFields:sectionFields,csrf:function(){return CSRF},t:t,lang:lang,setLang:setLang,arabicEnabled:function(){return !!(ME&&ME.arabic_enabled)},api:api,boot:boot,shell:shell,esc:esc,toast:toast,modal:modal,icon:icon,badge:badge,fmtTs:fmtTs,actLabel:actLabel,resLabel:resLabel};
})();
