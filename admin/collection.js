/* Shared list+editor for schema-driven collections (kb / investigations / projects). */
(function(){
'use strict';
var A=window.TORADMIN;
var LBL={
 ar:{category:'الفئة',related_articles:'معرفات المقالات ذات الصلة',related_challenges:'معرفات التحديات ذات الصلة',evidence:'روابط الأدلة',analysis:'التحليل',lessons_learned:'الدروس المستفادة',screenshots:'روابط صور المشروع',documentation:'التوثيق',published:'منشور',title:'العنوان',body:'النص',summary:'الملخص',description:'الوصف',tags:'الوسوم (مفصولة بفواصل)',date:'التاريخ',url:'رابط (https)',status:'الحالة',
     timeline:'الخط الزمني',findings:'النتائج',root_cause:'السبب الجذري',links:'روابط ذات صلة',tech:'التقنيات (مفصولة بفواصل)',repo_url:'مستودع الكود (https)',
     ts:'الوقت',label:'العنوان',addEntry:'+ حدث',addLink:'+ رابط',visibility:'الظهور',private:'خاص (للأدمن فقط)',public:'عام (يظهر على الموقع)',open:'مفتوح',closed:'مغلق',draft:'مسودة',active:'نشط',wip:'قيد العمل',archived:'مؤرشف',
     hiddenC:'مخفي (مؤرشف)',items:'عنصر'},
 en:{category:'Category',related_articles:'Related article IDs',related_challenges:'Related challenge IDs',evidence:'Evidence links',analysis:'Analysis',lessons_learned:'Lessons learned',screenshots:'Project screenshot links',documentation:'Documentation',published:'Published',title:'Title',body:'Body',summary:'Summary',description:'Description',tags:'Tags (comma-sep)',date:'Date',url:'URL (https)',status:'Status',
     timeline:'Timeline',findings:'Findings',root_cause:'Root cause',links:'Related links',tech:'Tech (comma-sep)',repo_url:'Code repository (https)',
     ts:'Time',label:'Label',addEntry:'+ Entry',addLink:'+ Link',visibility:'Visibility',private:'Private (admin only)',public:'Public (shown on the site)',open:'Open',closed:'Closed',draft:'Draft',active:'Active',wip:'In progress',archived:'Archived',
     hiddenC:'Hidden (archived)',items:'items'}
};
function l(k){var d=LBL[A.lang()];return d[k]||k}
window.TORCOL={
 run:function(CFG){ // {col, nav, fields:[{k,t,max?,values?}]}
  A.boot().then(function(ok){
   if(!ok)return;
   var id=new URLSearchParams(location.search).get('id');
   if(id===null&&!/edit=1/.test(location.search)) listPage(CFG);
   else editPage(CFG,id);
  });
 }
};
function blank(CFG){var o={id:'',hidden:false};CFG.fields.forEach(function(f){
 if(f.t==='bi')o[f.k]={ar:'',en:''};else if(f.t==='tags')o[f.k]=[];else if(f.t==='entries'||f.t==='links')o[f.k]=[];
 else if(f.t==='enum')o[f.k]=f.values[0];else o[f.k]='';});return o}
function listPage(CFG){
 A.shell(CFG.nav,'<b>'+A.t(CFG.t)+'</b>',function(c){
  A.api('/admin/api/content').then(function(j){
   var items=(j.collections[CFG.col]||[]).slice();
   var ar=A.lang()==='ar';
   c.innerHTML='<div class="page-head"><h1>'+A.t(CFG.t)+'</h1><span class="sub">'+A.esc(CFG.sub())+'</span>'+
   '<div class="acts"><a class="btn primary" href="'+CFG.col+'.html?edit=1">'+A.icon(CFG.icon,15)+A.t('create')+'</a></div></div>'+
   '<div class="panel" style="padding:0;overflow:hidden">'+
   (items.length?'<div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>'+l('title')+'</th><th>'+l('status')+'</th><th>'+l('tags')+'</th><th>'+l('date')+'</th><th>'+A.t('actions')+'</th></tr></thead><tbody>'+
    items.map(function(it){
     var title=ar?(it.title&&it.title_ar)||(it.title&&it.title.ar):(it.title&&(it.title_en||it.title.en))||it.id;
     var isSched=it.publish_at&&Date.parse(it.publish_at)>Date.now();
     var st=it.hidden?A.badge(l('archived'),'dim'):(isSched?A.badge(ar?'مجدول':'Scheduled','info'):(it.status?A.badge(l(it.status),it.status==='open'||it.status==='active'?'ok':it.status==='wip'||it.status==='draft'?'info':'dim'):A.badge(l('active'),'ok')));
     return '<tr><td><div class="t-main">'+A.esc(title)+'</div><div class="t-sub mono">'+A.esc(it.id)+'</div></td><td>'+st+'</td>'+
     '<td>'+((it.tags||[]).map(function(t){return '<span class="tag">'+A.esc(t)+'</span>'}).join('')||'<span class="dim small">—</span>')+'</td>'+
     '<td class="small dim">'+A.esc(it.date||'—')+'</td>'+
     '<td><a class="btn sm ghost" href="'+CFG.col+'.html?edit=1&id='+encodeURIComponent(it.id)+'">'+A.t('edit')+'</a>'+
     (CFG.col==='investigations'?' <a class="btn sm ghost" href="preview.html?kind=investigation&lang='+(A.arabicEnabled()?A.lang():'en')+'&id='+encodeURIComponent(it.id)+'" target="_blank" title="'+(ar?'تعرض المعاينة المحتوى المحفوظ فقط':'Preview shows saved content only')+'">'+(ar?'معاينة':'Preview')+'</a>':'')+
     '</td></tr>';
    }).join('')+'</tbody></table></div>'
    :'<div class="empty"><div class="ic">'+A.icon(CFG.icon,22)+'</div><h3>'+A.t('empty')+'</h3><p>'+A.t('emptySub')+'</p></div>')+
   '</div>';
  }).catch(function(){c.innerHTML='<div class="panel"><div class="empty"><h3>'+A.t('errNet')+'</h3></div></div>'});
 });
}
function editPage(CFG,id){
 A.shell(CFG.nav,'<a href="'+CFG.col+'.html">'+A.t(CFG.t)+'</a> / <b>'+(id?A.esc(id):A.t('create'))+'</b>',function(c){
  var ar=A.lang()==='ar';
  function start(item){
   c.innerHTML='<div class="page-head"><h1>'+(id?(ar?A.esc(item.title.ar||item.id):A.esc(item.title.en||item.title.ar||item.id)):A.t('create'))+'</h1>'+
   '<span class="sub mono">'+A.esc(item.id||'new')+'</span><div class="acts">'+(id&&CFG.col==='investigations'?'<a class="btn ghost" href="preview.html?kind=investigation&lang='+(A.arabicEnabled()?A.lang():'en')+'&id='+encodeURIComponent(item.id)+'" target="_blank" title="'+(ar?'تعرض المعاينة المحتوى المحفوظ فقط':'Preview shows saved content only')+'">'+(ar?'معاينة (المحفوظ)':'Preview (saved)')+'</a>':'')+'<button class="btn primary" id="save">'+A.t('save')+'</button></div></div>'+
   '<div class="errlist" id="errs" role="alert" style="display:none;background:rgba(232,143,143,.1);border:1px solid rgba(232,143,143,.4);border-radius:8px;padding:12px 16px;font-size:.83rem;color:var(--err);margin-bottom:16px"></div>'+
   '<div class="panel">'+(id?'':'<div class="field"><label>ID (a-z0-9-)</label><input class="input mono" dir="ltr" id="f-id"></div>')+
   CFG.fields.map(function(f){return fieldHtml(f,item)}).join('')+
   '<label class="check"><input type="checkbox" data-k="hidden"'+(item.hidden?' checked':'')+'> <span>'+l('hiddenC')+'</span></label></div>';
   bind(c,item,CFG,id);
  }
  if(id){
   A.api('/admin/api/collection/'+CFG.col+'/'+encodeURIComponent(id)).then(function(r){
    if(r._code!==200){A.toast('not found','err');location.replace(CFG.col+'.html');return}
    start(r.item);
   });
  }else start(blank(CFG));
 });
}
function fieldHtml(f,item){
 var v=item[f.k];
 if(f.t==='bi')return '<div class="field"><label>'+l(f.k)+'</label><div class="row2">'+
  '<textarea class="input ar-only" rows="'+(f.max&&f.max<=4000?3:6)+'" data-k="'+f.k+'" data-part="ar">'+A.esc(v&&v.ar||'')+'</textarea>'+
  '<textarea class="input" dir="ltr" rows="'+(f.max&&f.max<=4000?3:6)+'" data-k="'+f.k+'" data-part="en" placeholder="English">'+A.esc(v&&v.en||'')+'</textarea></div></div>';
 if(f.t==='enum')return '<div class="field" style="max-width:280px"><label>'+l(f.k)+'</label><select class="input" data-k="'+f.k+'">'+f.values.map(function(x){return '<option value="'+x+'"'+(v===x?' selected':'')+'>'+l(x)+'</option>'}).join('')+'</select></div>';
 if(f.t==='tags')return '<div class="field"><label>'+l(f.k)+'</label><input class="input" data-k="'+f.k+'" value="'+A.esc((v||[]).join(', '))+'"></div>';
 if(f.t==='url')return '<div class="field"><label>'+l(f.k)+'</label><input class="input mono" dir="ltr" data-k="'+f.k+'" value="'+A.esc(v||'')+'" placeholder="https://…"></div>';
 if(f.t==='entries')return '<div class="field"><label>'+l('timeline')+'</label><div data-entries="'+f.k+'"></div><button class="btn ghost sm" data-add-entry="'+f.k+'">'+l('addEntry')+'</button></div>';
 if(f.t==='links')return '<div class="field"><label>'+l(f.k)+'</label><div data-links="'+f.k+'"></div><button class="btn ghost sm" data-add-link="'+f.k+'">'+l('addLink')+'</button></div>';
 return '<div class="field" style="max-width:280px"><label>'+l(f.k)+'</label><input class="input" data-k="'+f.k+'" value="'+A.esc(v||'')+'"></div>';
}
function bind(c,item,CFG,id){
 function paintEntries(key){
  var w=c.querySelector('[data-entries="'+key+'"]');w.innerHTML='';
  (item[key]||[]).forEach(function(e,i){
   var row=document.createElement('div');row.className='sec-row';
   row.innerHTML='<div class="head"><span class="num">'+(i+1)+'</span><input class="input mono" dir="ltr" style="max-width:180px" data-p="ts" value="'+A.esc(e.ts||'')+'" placeholder="2026-01-01 00:00"><span style="flex:1"></span>'+
    '<button class="btn sm ghost" data-up>↑</button><button class="btn sm ghost" data-dn>↓</button><button class="btn sm danger" data-del>×</button></div>'+
    '<div class="row2"><textarea class="input" rows="2" data-p="ar" placeholder="العربية">'+A.esc(e.ar||'')+'</textarea><textarea class="input" dir="ltr" rows="2" data-p="en" placeholder="English">'+A.esc(e.en||'')+'</textarea></div>';
   row.querySelectorAll('[data-p]').forEach(function(inp){inp.oninput=function(){e[inp.dataset.p]=inp.value}});
   row.querySelector('[data-del]').onclick=function(){item[key].splice(i,1);paintEntries(key)};
   row.querySelector('[data-up]').onclick=function(){if(i>0){item[key].splice(i-1,0,item[key].splice(i,1)[0]);paintEntries(key)}};
   row.querySelector('[data-dn]').onclick=function(){if(i<item[key].length-1){item[key].splice(i+1,0,item[key].splice(i,1)[0]);paintEntries(key)}};
   w.appendChild(row);
  });
 }
 function paintLinks(key){
  var w=c.querySelector('[data-links="'+key+'"]');w.innerHTML='';
  (item[key]||[]).forEach(function(lnk,i){
   var row=document.createElement('div');row.style.cssText='display:grid;grid-template-columns:1fr 1.6fr auto;gap:10px;margin-bottom:10px';
   row.innerHTML='<input class="input" data-p="label" value="'+A.esc(lnk.label||'')+'" placeholder="'+l('label')+'"><input class="input mono" dir="ltr" data-p="url" value="'+A.esc(lnk.url||'')+'" placeholder="https://…"><button class="btn sm danger">×</button>';
   row.querySelectorAll('[data-p]').forEach(function(inp){inp.oninput=function(){lnk[inp.dataset.p]=inp.value}});
   row.querySelector('button').onclick=function(){item[key].splice(i,1);paintLinks(key)};
   w.appendChild(row);
  });
 }
 CFG.fields.forEach(function(f){
  if(f.t==='entries'){paintEntries(f.k);c.querySelector('[data-add-entry="'+f.k+'"]').onclick=function(){item[f.k].push({ts:'',ar:'',en:''});paintEntries(f.k)}}
  if(f.t==='links'){paintLinks(f.k);c.querySelector('[data-add-link="'+f.k+'"]').onclick=function(){item[f.k].push({label:'',url:''});paintLinks(f.k)}}
 });
 document.getElementById('save').onclick=function(){
  var out=JSON.parse(JSON.stringify(item));
  c.querySelectorAll('[data-k]').forEach(function(inp){
   var k=inp.dataset.k;
   if(inp.type==='checkbox'){out[k]=inp.checked;return}
   if(inp.dataset.part){out[k]=out[k]||{};out[k][inp.dataset.part]=inp.value;return}
   if(CFG.fields.filter(function(f){return f.k===k&&f.t==='tags'}).length){out[k]=inp.value.split(',').map(function(x){return x.trim()}).filter(Boolean);return}
   out[k]=inp.value;
  });
  if(!id)out.id=(document.getElementById('f-id')||{}).value.trim();
  var errs=document.getElementById('errs');
  A.api('/admin/api/collection/'+CFG.col+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:out}).then(function(r){
   if(r._code===200){A.toast(A.t('saved'),'ok');if(!id)setTimeout(function(){location.replace(CFG.col+'.html?edit=1&id='+encodeURIComponent(r.id))},500)}
   else{errs.style.display='block';errs.textContent=(r.details&&r.details.join(' · '))||r.error||A.t('failed');window.scrollTo(0,0)}
  }).catch(function(){A.toast(A.t('errNet'),'err')});
 };
}
})();
