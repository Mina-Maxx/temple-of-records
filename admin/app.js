/* Temple Admin — shared shell. Bilingual AR/EN, session guard, CSRF-aware fetch, accessible widgets. */
(function(){
'use strict';
var LS='tor_admin_';
var dict={
 ar:{
  brand:'إدارة المعبد',brandSub:'The Temple of Records',
  gMain:'مساحة العمل',gContent:'مكتبة المحتوى',gPlatform:'المنصة',gSystem:'النظام',
  nDash:'نظرة عامة',nInv:'التحقيقات',nChallenges:'استوديو التحديات',
  nArticles:'الرايتبس والحلول',nEvidence:'الأدلة',nMedia:'مكتبة الوسائط',nCats:'التصنيفات والوسوم',
  nSubs:'المحاولات والحلول',nFlags:'إعداد الفلاجات',nPlayers:'اللاعبون',
  nAudit:'سجل التدقيق',nSettings:'الإعدادات',
  logout:'خروج',viewSite:'عرض الموقع',gSearch:'بحث شامل…',noRes:'لا نتائج',qCreate:'إنشاء سريع',
  qInv:'تحقيق جديد',qChal:'تحدٍّ جديد',qArt:'رايتب جديد',qMedia:'رفع وسائط',qSubs:'مراجعة المحاولات',
  notifT:'آخر الأنشطة',logoutQ:'تسجيل الخروج؟',logoutB:'ستنتهي جلستك الحالية على هذا الجهاز.',
  sessEnd:'انتهت الجلسة',sessEndB:'سجّل الدخول مرة أخرى للمتابعة. لم يُحفظ أي تعديل غير محفوظ.',
  sessWarn:'ستنتهي جلستك قريبًا',sessWarnB:'عمر الجلسة ثابت ١٢ ساعة ولا يتجدد تلقائيًا. احفظ عملك قبل إعادة الدخول.',
  unsavedWarn:'لديك تعديلات غير محفوظة.',
  fixedSess:'جلسة ثابتة (١٢ ساعة)',
  lang:'العربية',skipMain:'تخطي إلى المحتوى',
  loading:'جارٍ التحميل…',errNet:'تعذّر الاتصال بالخادم المحلي. شغّل: node server/server.js',
  demoNote:'تحديات تجريبية مفعّلة',soon:'قريبًا',save:'حفظ',cancel:'إلغاء',edit:'تحرير',create:'إنشاء',
  del:'حذف',search:'بحث…',actions:'إجراءات',empty:'لا عناصر بعد',emptySub:'ابدأ بإنشاء أول عنصر.',
  sChal:'التحديات',sArt:'الرايتبس',sInv:'التحقيقات',sSolves:'حلول مسجّلة',sSubs:'محاولات (١٤ يومًا)',sPlayers:'اللاعبون',sAvail:'متاح الآن',
  dashWelcome:'نظرة عامة حية على التحديات والتحقيقات والمنصة.',recentAct:'آخر نشاط',health:'حالة النظام',
  sampleData:'تُدار المحتويات والعيّنات التجريبية هنا وتُحدَّث فورًا على الخادم.',
  confirm:'تأكيد',confirmDel:'هذا الإجراء لا يمكن التراجع عنه. متابعة؟',
  saved:'تم الحفظ',updated:'تم التحديث',created:'تم الإنشاء',failed:'فشل العملية',
  login:'دخول',username:'اسم المستخدم',password:'كلمة المرور',setupTitle:'إعداد أولي — إنشاء حساب الأدمن',
  setupSub:'يحدث مرة واحدة، ومن هذا الجهاز فقط (localhost).',loginSub:'تسجيل الدخول إلى لوحة إدارة المعبد.',
  forgot:'نسيت كلمة المرور؟ لا يوجد استرداد بالبريد في وضع العرض المحلي — استعن بوصول مباشر للخادم.',
  wrongCred:'بيانات الدخول غير صحيحة.',setupDone:'تم إنشاء الحساب — سجّل الدخول.',
  minPw:'١٠ أحرف على الأقل',
  thTitle:'العنوان',thStatus:'الحالة',thCat:'الفئة',thDiff:'الصعوبة',thSolves:'الحلول',thUpdated:'آخر تحديث',
  stAvail:'متاح',stPrep:'قيد التحضير',stArch:'مؤرشف',stDemo:'تجريبي',stPub:'منشور',stDraft:'مسودة',stSched:'مجدول',
  auditTs:'الوقت',auditActor:'الفاعل',auditAction:'الإجراء',auditEntity:'العنصر',auditRes:'النتيجة'
 },
 en:{
  brand:'Temple Admin',brandSub:'The Temple of Records',
  gMain:'Workspace',gContent:'Content Library',gPlatform:'Platform',gSystem:'System',
  nDash:'Overview',nInv:'Investigations',nChallenges:'Challenges Studio',
  nArticles:'Writeups',nEvidence:'Evidence',nMedia:'Media Library',nCats:'Categories & Tags',
  nSubs:'Submissions',nFlags:'Flags',nPlayers:'Players',
  nAudit:'Audit Log',nSettings:'Settings',
  logout:'Log out',viewSite:'View site',gSearch:'Search everything…',noRes:'No results',qCreate:'Quick create',
  qInv:'New investigation',qChal:'New challenge',qArt:'New writeup',qMedia:'Upload media',qSubs:'Review submissions',
  notifT:'Recent activity',logoutQ:'Log out?',logoutB:'Your session on this device will end.',
  sessEnd:'Session expired',sessEndB:'Sign in again to continue. Unsaved edits were not saved.',
  sessWarn:'Your session is about to expire',sessWarnB:'Sessions have a fixed 12-hour lifetime (no auto-renewal). Save your work before signing in again.',
  unsavedWarn:'You have unsaved changes.',
  fixedSess:'Fixed 12h session',
  lang:'English',skipMain:'Skip to main content',
  loading:'Loading…',errNet:'Cannot reach the local server. Run: node server/server.js',
  demoNote:'Sample challenges present',soon:'Soon',save:'Save',cancel:'Cancel',edit:'Edit',create:'Create',
  del:'Delete',search:'Search…',actions:'Actions',empty:'Nothing here yet',emptySub:'Create the first item to get started.',
  sChal:'Challenges',sArt:'Writeups',sInv:'Investigations',sSolves:'Recorded solves',sSubs:'Submissions',sPlayers:'Players',sAvail:'Available now',
  dashWelcome:'Live overview of investigations, challenges, writeups, and system health.',recentAct:'Recent activity',health:'System status',
  sampleData:'Manage records directly on the runtime store; sample items are tagged when present.',
  confirm:'Confirm',confirmDel:'This cannot be undone. Continue?',
  saved:'Saved',updated:'Updated',created:'Created',failed:'Operation failed',
  login:'Sign in',username:'Username',password:'Password',setupTitle:'First-time setup — create the admin account',
  setupSub:'Happens once, from this machine only (localhost).',loginSub:'Sign in to the Temple of Records administration.',
  forgot:'Forgot the password? There is no email recovery in local mode — direct server access is required.',
  wrongCred:'Invalid credentials.',setupDone:'Account created — sign in.',
  minPw:'At least 10 characters',
  thTitle:'Title',thStatus:'Status',thCat:'Category',thDiff:'Difficulty',thSolves:'Solves',thUpdated:'Updated',
  stAvail:'Available',stPrep:'Soon',stArch:'Archived',stDemo:'Demo',stPub:'Published',stDraft:'Draft',stSched:'Scheduled',
  auditTs:'Time',auditActor:'Actor',auditAction:'Action',auditEntity:'Entity',auditRes:'Result'
 }
};

function lang(){var l=localStorage.getItem(LS+'lang');return l==='en'?'en':'ar'}
function setLang(l){localStorage.setItem(LS+'lang',l);location.reload()}
function t(k){var d=dict[lang()];return d[k]!==undefined?d[k]:k}
var CSRF=null,ME=null,sessionExpiry=Date.now()+12*3600*1000;

function api(path,opt){
 opt=opt||{};opt.headers=opt.headers||{};
 if(opt.body&&typeof opt.body!=='string'){opt.body=JSON.stringify(opt.body);opt.headers['Content-Type']='application/json'}
 if(CSRF&&opt.method&&opt.method!=='GET')opt.headers['x-csrf-token']=CSRF;
 return fetch(path,opt).then(function(r){
  if(r.status===401&&location.pathname.indexOf('/admin/login')===-1){sessionEnded();throw{auth:true}}
  return r.json().then(function(j){
   j._code=r.status;
   if(r.ok&&opt.method&&opt.method!=='GET'){window.dispatchEvent(new CustomEvent('tor:saved',{detail:path}))}
   return j;
  });
 });
}

var _ended=false;
function sessionEnded(){
 if(_ended)return;_ended=true;
 try{modal({title:t('sessEnd'),body:t('sessEndB'),confirmLabel:t('login'),onConfirm:function(){location.replace('/admin/login.html')}})}catch(e){location.replace('/admin/login.html')}
}

function boot(){
 return api('/admin/api/me').then(function(j){
  if(j._code!==200){location.replace('/admin/login.html');return null}
  ME={username:j.username,arabic_enabled:j.arabic_enabled===true};
  CSRF=j.csrf;
  if(j.expiresAt)sessionExpiry=Date.parse(j.expiresAt);
  if(document.body)document.body.classList.toggle('en-only',!ME.arabic_enabled);
  return j;
 }).catch(function(e){if(!e||!e.auth)toast(t('errNet'),'err');return null});
}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

function toast(msg,kind){
 var w=document.querySelector('.toasts');
 if(!w){w=document.createElement('div');w.className='toasts';w.setAttribute('role','status');w.setAttribute('aria-live','polite');w.setAttribute('aria-atomic','true');document.body.appendChild(w)}
 var el=document.createElement('div');el.className='toast '+(kind||'');el.textContent=msg;w.appendChild(el);
 setTimeout(function(){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){el.remove()},350)},3600);
}

function modal(opts){
 var prev=document.activeElement;
 var sc=document.createElement('div');sc.className='modal-scrim on';
 sc.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-ttl"><h3 id="m-ttl">'+esc(opts.title)+'</h3>'+(opts.html?'<div class="modal-html">'+opts.body+'</div>':'<p>'+esc(opts.body)+'</p>')+
  '<div class="row"><button type="button" class="btn ghost" data-x>'+t('cancel')+'</button>'+
  '<button type="button" class="btn '+(opts.danger?'danger':'primary')+'" data-ok>'+esc(opts.confirmLabel||t('confirm'))+'</button></div></div>';
 document.body.appendChild(sc);
 var dlg=sc.querySelector('.modal');
 var focusable=function(){return [...dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]};
 function close(){
  document.removeEventListener('keydown',onKey);
  sc.remove();
  if(prev&&typeof prev.focus==='function'&&document.contains(prev))prev.focus();
 }
 function onKey(e){
  if(e.key==='Escape'){e.preventDefault();close();return}
  if(e.key==='Tab'){
   var fs=focusable();if(!fs.length)return;
   var first=fs[0],last=fs[fs.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 }
 document.addEventListener('keydown',onKey);
 sc.querySelector('[data-x]').onclick=close;
 sc.addEventListener('click',function(e){if(e.target===sc)close()});
 sc.querySelector('[data-ok]').onclick=function(){var b=this;b.disabled=true;opts.onConfirm(function(){close()})};
 var initial=focusable()[0];
 if(initial)initial.focus();
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
 {grp:'gMain',items:[
  {id:'dashboard',href:'index.html',icon:'dash',t:'nDash'},
  {id:'inv',href:'investigations.html',icon:'search',t:'nInv'},
  {id:'challenges',href:'challenges.html',icon:'flag',t:'nChallenges'}
 ]},
 {grp:'gContent',items:[
  {id:'articles',href:'articles.html',icon:'doc',t:'nArticles'},
  {id:'evidence',href:'evidence.html',icon:'box',t:'nEvidence'},
  {id:'media',href:'media.html',icon:'img',t:'nMedia'},
  {id:'cats',href:'categories.html',icon:'tags',t:'nCats'}
 ]},
 {grp:'gPlatform',items:[
  {id:'subs',href:'submissions.html',icon:'send',t:'nSubs'},
  {id:'flags',href:'flags.html',icon:'key',t:'nFlags'},
  {id:'players',href:'players.html',icon:'users',t:'nPlayers'}
 ]},
 {grp:'gSystem',items:[
  {id:'audit',href:'audit.html',icon:'list',t:'nAudit'},
  {id:'settings',href:'settings.html',icon:'gear',t:'nSettings'}
 ]}
];

function shell(active,crumb,cb){
 try{localStorage.removeItem('tor_side')}catch(e){}
 var L=lang();
 document.documentElement.lang=L;document.documentElement.dir=L==='ar'?'rtl':'ltr';
 document.body.classList.toggle('en',L==='en');
 var nav='';
 NAV.forEach(function(g){
  nav+='<div class="grp">'+esc(t(g.grp))+'</div>';
  g.items.forEach(function(it){
   nav+='<a href="'+it.href+'"'+(it.id===active?' class="on" aria-current="page"':'')+'>'+icon(it.icon)+'<span>'+esc(t(it.t))+'</span></a>';
  });
 });
 var expTxt=fmtTs(new Date(sessionExpiry).toISOString());
 document.body.innerHTML=
 '<a class="skip-link" href="#content">'+esc(t('skipMain'))+'</a>'+
 '<div class="scrim" id="scrim"></div><div class="app">'+
 '<aside class="side" id="side" aria-label="'+esc(t('brand'))+'">'+
  '<div class="side-brand"><span class="mark">'+icon('flag',18)+'</span><span><b>'+esc(t('brand'))+'</b><span>'+esc(t('brandSub'))+'</span></span></div>'+
  '<div class="side-frieze" aria-hidden="true"></div>'+
  '<nav class="side-nav" aria-label="main">'+nav+'</nav>'+
  '<div class="side-foot" id="side-foot"><span class="mono">'+esc(t('fixedSess'))+'</span><span>'+(L==='ar'?'تنتهي: ':'Ends: ')+esc(expTxt)+'</span></div>'+
 '</aside>'+
 '<div class="main"><header class="topbar">'+
  '<button type="button" class="icon-btn burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="side">'+icon('menu')+'</button>'+
  '<div class="crumbs">'+crumb+'</div><div class="sp"></div>'+
  '<div class="gsearch"><input id="gs" type="search" autocomplete="off" placeholder="'+esc(t('gSearch'))+'" aria-label="'+esc(t('gSearch'))+'"><div class="gs-res" id="gsr" hidden role="listbox"></div></div>'+
  '<div class="dd"><button type="button" class="btn primary sm" id="qc" aria-haspopup="menu" aria-expanded="false" aria-controls="qcm">+ '+esc(t('qCreate'))+'</button>'+
   '<div class="dd-menu" id="qcm" hidden role="menu">'+
    '<a role="menuitem" href="investigations.html?edit=1">'+esc(t('qInv'))+'</a>'+
    '<a role="menuitem" href="challenge-edit.html">'+esc(t('qChal'))+'</a>'+
    '<a role="menuitem" href="article-edit.html">'+esc(t('qArt'))+'</a>'+
    '<a role="menuitem" href="media.html">'+esc(t('qMedia'))+'</a>'+
    '<a role="menuitem" href="submissions.html">'+esc(t('qSubs'))+'</a>'+
   '</div></div>'+
  '<div class="dd"><button type="button" class="icon-btn" id="nt" aria-label="'+esc(t('notifT'))+'" title="'+esc(t('notifT'))+'" aria-haspopup="true" aria-expanded="false" aria-controls="ntm">'+icon('list')+'</button><div class="dd-menu wide" id="ntm" hidden></div></div>'+
  '<div class="top-actions">'+
   '<span class="lang-sw" role="group" aria-label="Language"><button type="button" class="'+(L==='ar'?'on':'')+'" data-lang="ar">ع</button><button type="button" class="'+(L==='en'?'on':'')+'" data-lang="en">EN</button></span>'+
   '<a class="icon-btn" href="../index.html" target="_blank" rel="noopener" title="'+esc(t('viewSite'))+'" aria-label="'+esc(t('viewSite'))+'">'+icon('ext')+'</a>'+
   '<button type="button" class="icon-btn" id="logout" title="'+esc(t('logout'))+'" aria-label="'+esc(t('logout'))+'">'+icon('out')+'</button>'+
   '<div class="dd"><button type="button" class="user-chip" id="profile" aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu" aria-label="'+esc(t('nSettings'))+'"><span class="ava">'+esc((ME&&ME.username||'?').slice(0,2).toUpperCase())+'</span><span>'+esc(ME&&ME.username||'')+'</span></button><div class="dd-menu" id="profile-menu" hidden role="menu"><a role="menuitem" href="settings.html">'+esc(t('nSettings'))+'</a><a role="menuitem" href="audit.html">'+esc(t('nAudit'))+'</a></div></div>'+
  '</div>'+
 '</header><main class="content" id="content" tabindex="-1"><div class="skel" style="min-height:120px"></div><div class="skel"></div><div class="skel"></div></main></div></div>';

 document.querySelectorAll('[data-lang]').forEach(function(b){b.onclick=function(){setLang(b.dataset.lang)}});
 document.getElementById('logout').onclick=function(){modal({title:t('logoutQ'),body:t('logoutB'),confirmLabel:t('logout'),onConfirm:function(){api('/admin/api/logout',{method:'POST',body:{}}).finally(function(){location.replace('/admin/login.html')})}})};

 // Accessible dropdown menus + keyboard support
 function closeMenus(restoreBtn){
  document.querySelectorAll('.dd-menu').forEach(function(x){x.hidden=true});
  document.querySelectorAll('.dd > button[aria-expanded="true"]').forEach(function(b){b.setAttribute('aria-expanded','false');if(restoreBtn)b.focus()});
 }
 function dd(btnId,menuId,onOpen){
  var btn=document.getElementById(btnId),menu=document.getElementById(menuId);
  btn.onclick=function(e){
   e.stopPropagation();
   var open=menu.hidden;
   closeMenus(false);
   if(open){
    menu.hidden=false;btn.setAttribute('aria-expanded','true');
    if(onOpen)onOpen(menu);
    var first=menu.querySelector('a');
    if(first&&e.detail===0)first.focus();
   }
  };
  btn.addEventListener('keydown',function(e){
   if(e.key==='ArrowDown'){e.preventDefault();if(menu.hidden)btn.click();var first=menu.querySelector('a');if(first)first.focus()}
  });
  menu.addEventListener('keydown',function(e){
   var links=[...menu.querySelectorAll('a')];
   var ix=links.indexOf(document.activeElement);
   if(e.key==='ArrowDown'&&links.length){e.preventDefault();links[(ix+1)%links.length].focus()}
   else if(e.key==='ArrowUp'&&links.length){e.preventDefault();links[(ix-1+links.length)%links.length].focus()}
   else if(e.key==='Escape'){e.preventDefault();closeMenus(true)}
  });
 }
 dd('qc','qcm');
 dd('profile','profile-menu');
 dd('nt','ntm',function(m){
  m.innerHTML='<div class="dd-h">'+esc(t('notifT'))+'</div><div class="dim small" style="padding:8px 12px">…</div>';
  api('/admin/api/audit').then(function(j){
   var rows=(j.audit||[]).slice(0,8);
   m.innerHTML='<div class="dd-h">'+esc(t('notifT'))+'</div>'+(rows.length?rows.map(function(r){
    return '<div class="dd-i"><b>'+esc(actLabel(r.action))+'</b><span class="mono dim small">'+esc(r.entity||'')+'</span><span class="dim small">'+esc(fmtTs(r.ts))+'</span></div>';
   }).join(''):'<div class="dim small" style="padding:8px 12px">'+esc(t('noRes'))+'</div>');
  }).catch(function(){});
 });
 document.addEventListener('click',function(){closeMenus(false)});

 // Global search
 var gs=document.getElementById('gs'),gsr=document.getElementById('gsr'),cache=null;
 var PAGES={challenges:'challenge-edit.html?id=',articles:'article-edit.html?id=',investigations:'investigations.html?id=',categories:'categories.html?id='};
 gs.addEventListener('input',function(){
  var q=gs.value.trim().toLowerCase();if(!q){gsr.hidden=true;return}
  function show(){
   var arOn=!(ME&&ME.arabic_enabled===false);var out=[];
   Object.keys(cache).forEach(function(col){(cache[col]||[]).forEach(function(it){
    var display=it.title||it.name;
    var ti=arOn?(display&&typeof display==='object'?(display.ar||'')+' '+(display.en||''):((it.title_ar||'')+' '+(it.title_en||'')+' '+(it.title||it.name||''))):((display&&typeof display==='object'?display.en:'')||(it.title_en||it.name_en||''));
    if((ti+' '+(it.id||'')).toLowerCase().indexOf(q)>-1&&PAGES[col])
     out.push({col:col,id:it.id,ti:(arOn&&lang()==='ar'?(it.title_ar||(it.title&&it.title.ar)):(it.title_en||(it.title&&it.title.en)))||(display&&typeof display==='object'?(arOn?display[lang()]||display.en||display.ar:display.en):display)||it.id});
   })});
   gsr.innerHTML=out.slice(0,10).map(function(o){return '<a href="'+PAGES[o.col]+encodeURIComponent(o.id)+'"><span>'+esc(o.ti)+'</span><span class="dim small mono">'+esc(o.col)+'</span></a>'}).join('')||'<div class="dim small" style="padding:8px 12px">'+esc(t('noRes'))+'</div>';
   gsr.hidden=false;
  }
  if(cache)show();else api('/admin/api/content').then(function(j){cache=j.collections||{};show()}).catch(function(){});
 });
 gs.addEventListener('keydown',function(e){if(e.key==='Escape'){gsr.hidden=true;gs.blur()}});
 document.addEventListener('click',function(e){if(!gsr.contains(e.target)&&e.target!==gs)gsr.hidden=true});

 // Fixed 12h session expiry warning
 setInterval(function(){if(sessionExpiry-Date.now()<30*60000&&!window.__sw){window.__sw=1;toast(t('sessWarn')+' — '+t('sessWarnB'),'err')}},60000);

 // Unsaved-changes guard (preserves dirtyScopes & selectors)
 var dirty=false,cont=document.getElementById('content'),dirtyScopes=new Set();
 function editScope(el){if(location.pathname.includes('settings'))return el.closest('#site-config')?'site-settings':el.matches('[id^=seo-]')?'seo':el.matches('[id^=pw-]')?'password':'fixed';return 'content'}
 ['input','change'].forEach(function(kind){cont.addEventListener(kind,function(e){if(e.target.closest('[data-pane],#secs,#hints,#arts,.panel')&&/article-edit|challenge-edit|settings|investigations/.test(location.pathname)&&!e.target.matches('#q,[type=search]')){dirtyScopes.add(editScope(e.target));dirty=true}})});
 cont.addEventListener('click',function(e){if(e.target.closest('[data-del],[data-up],[data-dn],[data-hup],[data-hdn],#hints button,#arts button,#add-sec,#add-sol,#add-hint,#add-art,[data-add-kind],[data-add-entry],[data-add-link],[data-add-row]')&&/article-edit|challenge-edit|investigations/.test(location.pathname)){dirtyScopes.add('content');dirty=true}});
 window.addEventListener('tor:saved',function(e){var p=e.detail;if(location.pathname.includes('settings')){if(p.includes('/site-settings'))dirtyScopes.delete('site-settings');else if(p.includes('/content/fixed'))dirtyScopes.delete('fixed');else if(p.includes('/seo'))dirtyScopes.delete('seo');else if(p.includes('/password'))dirtyScopes.delete('password')}else if(/\/admin\/api\/(articles|challenges|collection)/.test(p))dirtyScopes.clear();dirty=dirtyScopes.size>0});
 window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue=t('unsavedWarn');return t('unsavedWarn')}});

 // Mobile off-canvas drawer (<1024px)
 var side=document.getElementById('side'),scrim=document.getElementById('scrim'),burger=document.getElementById('burger');
 function closeDrawer(restoreFocus){side.classList.remove('open');scrim.classList.remove('on');burger.setAttribute('aria-expanded','false');if(restoreFocus)burger.focus()}
 burger.onclick=function(){
  var open=!side.classList.contains('open');
  if(open){side.classList.add('open');scrim.classList.add('on');burger.setAttribute('aria-expanded','true')}
  else closeDrawer(true);
 };
 scrim.onclick=function(){closeDrawer(true)};
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&side.classList.contains('open'))closeDrawer(true)});

 cb(cont);
}

function badge(txt,kind){return '<span class="badge '+(kind||'dim')+'">'+esc(txt)+'</span>'}
function fmtTs(s){if(!s)return '—';var d=new Date(s);return d.toLocaleDateString(lang()==='ar'?'ar-EG-u-nu-latn':'en-GB',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString(lang()==='ar'?'ar-EG-u-nu-latn':'en-GB',{hour:'2-digit',minute:'2-digit'})}
var ACT={
 ar:{admin_setup:'إعداد المدير',login:'تسجيل دخول',logout:'تسجيل خروج',
 challenge_create:'إنشاء تحدٍّ',challenge_update:'تعديل تحدٍّ',challenge_archive:'أرشفة/استعادة تحدٍّ',challenge_duplicate:'تكرار تحدٍّ',challenge_delete:'حذف تحدٍّ',
 article_create:'إنشاء رايتب',article_update:'تعديل رايتب',article_archive:'أرشفة/استعادة رايتب',
 investigations_create:'إنشاء تحقيق',investigations_update:'تعديل تحقيق',investigations_archive:'أرشفة تحقيق',
 categories_create:'إنشاء فئة',categories_update:'تعديل فئة',categories_archive:'أرشفة فئة',
 tags_create:'إنشاء وسم',tags_update:'تعديل وسم',tags_archive:'أرشفة وسم',
 site_settings:'تحديث إعدادات الموقع',fixed_update:'تحديث نصوص ثابتة',flag_set:'ضبط فلاج',flag_replace:'استبدال فلاج',flag_policy:'قواعد صيغة الفلاج',
 media_upload:'رفع وسائط',media_replace:'استبدال وسائط',media_restore:'استعادة وسائط أصلية',media_delete:'حذف وسائط',
 seo_update:'تحديث SEO',tag_rename:'إعادة تسمية وسم',player_disable:'تعطيل لاعب',player_enable:'تفعيل لاعب',password_change:'تغيير كلمة المرور'},
 en:{admin_setup:'Admin setup',login:'Sign-in',logout:'Sign-out',
 challenge_create:'Challenge created',challenge_update:'Challenge updated',challenge_archive:'Challenge archived/restored',challenge_duplicate:'Challenge duplicated',challenge_delete:'Challenge deleted',
 article_create:'Writeup created',article_update:'Writeup updated',article_archive:'Writeup archived/restored',
 investigations_create:'Investigation created',investigations_update:'Investigation updated',investigations_archive:'Investigation archived',
 categories_create:'Category created',categories_update:'Category updated',categories_archive:'Category archived',
 tags_create:'Tag created',tags_update:'Tag updated',tags_archive:'Tag archived',
 site_settings:'Site settings updated',fixed_update:'Fixed texts updated',flag_set:'Flag set',flag_replace:'Flag replaced',flag_policy:'Flag format rules',
 media_upload:'Media uploaded',media_replace:'Media replaced',media_restore:'Original asset restored',media_delete:'Media deleted',
 seo_update:'SEO updated',tag_rename:'Tag renamed',player_disable:'Player disabled',player_enable:'Player enabled',password_change:'Password changed'}
};
var RES={ar:{ok:'نجاح',failed:'فشل',denied:'مرفوض',correct:'صحيح',wrong:'خاطئ',already:'محلول مسبقًا',rate_limited:'تجاوز المعدل'},en:{ok:'ok',failed:'failed',denied:'denied',correct:'correct',wrong:'wrong',already:'already solved',rate_limited:'rate limited'}};
function actLabel(k){return (ACT[lang()]&&ACT[lang()][k])||k}
function resLabel(k){return (RES[lang()]&&RES[lang()][k])||k}

// Shared structured block editor. All values render as text in the public site.
function sectionFields(el,s){
 var publication=document.createElement('label');publication.className='sec-row-pub';var cb=document.createElement('input');cb.type='checkbox';cb.checked=s.published!==false;cb.onchange=function(){s.published=cb.checked};publication.appendChild(cb);publication.appendChild(document.createTextNode(lang()==='ar'?' قسم منشور':' Published section'));el.appendChild(publication);

 var ar=lang()==='ar',w=document.createElement('div');w.className='section-fields';
 function input(key,label,val,area,arOnly){var d=document.createElement('div');d.className='field'+(arOnly?' ar-only':'');var l=document.createElement('label');var uid='sf-'+key+'-'+Math.random().toString(36).slice(2,7);l.htmlFor=uid;l.textContent=label;d.appendChild(l);var i=document.createElement(area?'textarea':'input');i.id=uid;i.className='input';if(area)i.rows=4;i.value=val==null?'':val;if(/src|url|code|json/i.test(key)){i.dir='ltr';i.classList.add('mono')}d.appendChild(i);w.appendChild(d);return i}
 function bind(k,label,arOnly){var i=input(k,label,s[k],false,arOnly);i.oninput=function(){s[k]=i.value}}
 if(s.type==='link')bind('url',ar?'الرابط (https)':'Link (https)');
 if(s.type==='image'){
  bind('src',ar?'مسار الصورة assets/…':'Image path assets/…');
  var row=document.createElement('div');row.className='inline-acts mb-3';
  var pick=document.createElement('button');pick.type='button';pick.className='btn ghost sm';pick.textContent=ar?'اختر من مكتبة الوسائط':'Pick from Media Library';
  pick.onclick=function(){
   api('/admin/api/media').then(function(j){
    var imgs=(j.media||[]).filter(function(m){return m.kind==='image'});
    if(!imgs.length){toast(ar?'لا توجد صور في المكتبة':'No images in Media Library','err');return}
    var b='<div class="mgrid">'+imgs.map(function(m){return '<button type="button" class="mcard" data-pick-src="assets/'+esc(m.name)+'"><span class="pv"><img src="../assets/'+esc(m.name)+'" alt=""></span><span class="meta"><span class="nm">'+esc(m.name)+'</span></span></button>'}).join('')+'</div>';
    modal({title:ar?'اختيار صورة':'Pick an image',html:true,body:b,confirmLabel:ar?'إغلاق':'Close',onConfirm:function(d){d()}});
    setTimeout(function(){document.querySelectorAll('[data-pick-src]').forEach(function(btn){btn.onclick=function(){var inp=w.querySelector('[id^=sf-src-]');if(inp){inp.value=btn.dataset.pickSrc;inp.dispatchEvent(new Event('input'))}var ok=document.querySelector('.modal [data-ok]');if(ok)ok.click()}})},30);
   }).catch(function(){toast(t('errNet'),'err')});
  };
  row.appendChild(pick);w.appendChild(row);
  bind('alt_ar','Alt AR',true);bind('alt_en','Alt EN');bind('caption_ar',ar?'التعليق (عربي)':'Caption AR',true);bind('caption_en',ar?'التعليق (إنجليزي)':'Caption EN');
 }
 if(s.type==='code'){bind('label_ar',ar?'عنوان الكود (عربي)':'Code label AR',true);bind('label_en',ar?'عنوان الكود (إنجليزي)':'Code label EN')}
 if(s.type==='callout'){bind('title_ar',ar?'عنوان التنبيه (عربي)':'Callout title AR',true);bind('title_en',ar?'عنوان التنبيه (إنجليزي)':'Callout title EN')}
 if(s.type==='list'){
  var ord=input('ordered',ar?'نوع القائمة (1 مرقمة، 0 غير مرقمة)':'List (1 ordered, 0 unordered)',s.ordered?'1':'0');ord.oninput=function(){s.ordered=ord.value==='1'};
  ['ar','en'].forEach(function(lng){var i=input('items_'+lng,lng==='ar'?'عناصر القائمة، عنصر في كل سطر (عربي)':'List items, one per line (English)',(s.items||[]).map(function(x){return x[lng]||''}).join('\n'),true,lng==='ar');i.oninput=function(){var lines=i.value.split('\n');var old=s.items||[];s.items=Array.from({length:Math.max(lines.length,old.length)},function(_,n){var o=Object.assign({},old[n]||{ar:'',en:''});o[lng]=lines[n]||'';return o}).filter(function(x){return x.ar||x.en})}});
 }
 if(s.type==='table'){
  var help=document.createElement('p');help.className='small dim mb-3';help.textContent=ar?'JSON: عناوين headers وصفوف rows، كل خلية {ar,en}.':'JSON: headers and rows; each cell is {ar,en}.';w.appendChild(help);
  var tx=input('json','Table JSON',JSON.stringify({headers:s.headers||[],rows:s.rows||[]},null,2),true);tx.oninput=function(){try{var v=JSON.parse(tx.value);if(!Array.isArray(v.headers)||!Array.isArray(v.rows))throw 0;s.headers=v.headers;s.rows=v.rows;tx.setCustomValidity('')}catch(e){tx.setCustomValidity(ar?'JSON غير صالح':'Invalid JSON')}};
 }
 el.appendChild(w);
}

window.TORADMIN={sectionFields:sectionFields,csrf:function(){return CSRF},t:t,lang:lang,setLang:setLang,arabicEnabled:function(){return !!(ME&&ME.arabic_enabled)},api:api,boot:boot,shell:shell,esc:esc,toast:toast,modal:modal,icon:icon,badge:badge,fmtTs:fmtTs,actLabel:actLabel,resLabel:resLabel};
})();
