/* Shared list+editor for schema-driven collections (kb / investigations / projects). */
(function(){
'use strict';
var A=window.TORADMIN;
var LBL={
 ar:{category:'الفئة',related_articles:'معرفات الرايتبس ذات الصلة',related_challenges:'معرفات التحديات ذات الصلة',evidence:'روابط الأدلة',analysis:'التحليل التفصيلي',lessons_learned:'الدروس المستفادة',use_case:'حالة الاستخدام (Use Case)',detection_engineering:'هندسة الكشف (Detection Engineering)',detection_rule_lang:'صيغة القاعدة (Sigma / KQL / SPL / YARA / AQL)',detection_rule:'قاعدة الكشف (Detection Rule)',attack:'تقنيات MITRE ATT&CK (مفصولة بفواصل)',publish_at:'موعد النشر المجدول (ISO اختياري)',published:'منشور',title:'العنوان',slug:'الرابط المختصر (Slug)',seo_title:'عنوان SEO',meta_description:'وصف الميتا (Meta description)',body:'النص',summary:'الملخص',description:'الوصف',tags:'الوسوم (مفصولة بفواصل)',date:'التاريخ',url:'رابط (https)',status:'الحالة',
     timeline:'الخط الزمني',findings:'النتائج',root_cause:'السبب الجذري',links:'روابط ذات صلة',
     ts:'الوقت',label:'العنوان',addEntry:'+ حدث',addLink:'+ رابط',g_overview:'نظرة عامة',g_lab:'بيئة المعمل (Lab)',g_evidence:'سجل الأدلة (Evidence Register)',g_timeline:'الخط الزمني',g_findings:'التحليل والنتائج',g_mitre:'ربط MITRE ATT&CK',g_detection:'هندسة الكشف (Detection Engineering)',g_closing:'الخاتمة وSEO',lab_environment:'بيئة المعمل (نظرة عامة)',lab_components:'مكونات المعمل',evidence_register:'سجل الأدلة',findings_list:'النتائج المنظمة (Findings)',mitre_mapping:'ربط التقنيات (ATT&CK mapping)',detections:'قواعد الكشف (Sigma / SPL / KQL)',addRow:'+ صف',addRule:'+ قاعدة كشف',host:'الجهاز (Host)',role:'الدور',os_tools:'النظام / الأدوات',notes:'ملاحظات',ref:'المرجع (EV-001)',name:'العنصر',type:'النوع',source:'المصدر',sha256:'SHA-256',acquired_at:'وقت الاستحواذ',severity:'الخطورة',evidence_ref:'مرجع الدليل',technique:'التقنية (T1059.001)',tactic:'التكتيك',observation:'الملاحظة',detection_ref:'مرجع القاعدة (DET-001)',rule_id:'معرّف القاعدة',data_sources:'مصادر البيانات / السجلات',sigma:'قاعدة Sigma',spl:'SPL (Splunk)',kql:'KQL (Sentinel / Defender)',other_lang:'اسم صيغة أخرى',other_rule:'قاعدة أخرى (YARA / Suricata / …)',false_positives:'الإيجابيات الكاذبة (False positives)',tuning:'الضبط (Tuning)',validation:'التحقق (كيف اختُبرت القاعدة)',tested:'اختُبرت',production:'إنتاج',visibility:'الظهور',private:'خاص (للأدمن فقط)',public:'عام (يظهر على الموقع)',open:'مفتوح',closed:'مغلق',draft:'مسودة',active:'نشط',wip:'قيد العمل',archived:'مؤرشف',
     hiddenC:'مخفي (مؤرشف)',items:'عنصر'},
 en:{category:'Category',related_articles:'Related writeup IDs',related_challenges:'Related challenge IDs',evidence:'Evidence links',analysis:'Investigation & analysis',lessons_learned:'Lessons learned & remediation',use_case:'Use Case (scenario & trigger)',detection_engineering:'Detection Engineering (telemetry, logic & tuning)',detection_rule_lang:'Detection Rule format (e.g. Sigma, KQL, SPL, YARA, AQL)',detection_rule:'Detection Rule (code)',attack:'MITRE ATT&CK IDs (comma-sep, e.g. T1059.001)',publish_at:'Scheduled publish_at (optional ISO timestamp)',published:'Published',title:'Title',slug:'Slug (AR / EN)',seo_title:'SEO title',meta_description:'Meta description',body:'Body',summary:'Summary',description:'Description',tags:'Tags (comma-sep)',date:'Date',url:'URL (https)',status:'Status',
     timeline:'Timeline',findings:'Findings',root_cause:'Root cause',links:'Related links',
     ts:'Time',label:'Label',addEntry:'+ Entry',addLink:'+ Link',g_overview:'Overview',g_lab:'Lab environment',g_evidence:'Evidence register',g_timeline:'Timeline',g_findings:'Analysis & findings',g_mitre:'MITRE ATT&CK mapping',g_detection:'Detection engineering',g_closing:'Closing & SEO',lab_environment:'Lab environment (overview)',lab_components:'Lab components',evidence_register:'Evidence register',findings_list:'Findings (structured)',mitre_mapping:'ATT&CK mapping',detections:'Detection rules (Sigma / SPL / KQL)',addRow:'+ Row',addRule:'+ Detection rule',host:'Host',role:'Role',os_tools:'OS / tools',notes:'Notes',ref:'Ref (EV-001)',name:'Item',type:'Type',source:'Source',sha256:'SHA-256',acquired_at:'Acquired at',severity:'Severity',evidence_ref:'Evidence ref',technique:'Technique (T1059.001)',tactic:'Tactic',observation:'Observation',detection_ref:'Detection ref (DET-001)',rule_id:'Rule ID',data_sources:'Data sources / logs',sigma:'Sigma rule',spl:'SPL (Splunk)',kql:'KQL (Sentinel / Defender)',other_lang:'Other format label',other_rule:'Other rule (YARA / Suricata / …)',false_positives:'False positives',tuning:'Tuning',validation:'Validation (how it was tested)',tested:'Tested',production:'Production',visibility:'Visibility',private:'Private (admin only)',public:'Public (shown on the site)',open:'Open',closed:'Closed',draft:'Draft',active:'Active',wip:'In progress',archived:'Archived',
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
 if(f.t==='group')return;
 if(f.t==='bi')o[f.k]={ar:'',en:''};else if(f.t==='tags')o[f.k]=[];else if(f.t==='entries'||f.t==='links'||f.t==='rows')o[f.k]=[];
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
     var arOn=A.arabicEnabled();
     var title=(ar&&arOn?(it.title_ar||(it.title&&it.title.ar)||(it.title_en||(it.title&&it.title.en))):(it.title_en||(it.title&&it.title.en)||(arOn&&it.title&&it.title.ar)))||it.id;
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
  var migrated=false;
  function start(item){
   if(CFG.col==='investigations')migrated=migrateLegacyRule(item);
   c.innerHTML='<div class="page-head"><h1>'+(id?((ar&&A.arabicEnabled())?A.esc((item.title&&item.title.ar)||(item.title&&item.title.en)||item.id):A.esc((item.title&&item.title.en)||item.id)):A.t('create'))+'</h1>'+
   '<span class="sub mono">'+A.esc(item.id||'new')+'</span><div class="acts">'+(id&&CFG.col==='investigations'?'<a class="btn ghost" href="preview.html?kind=investigation&lang='+(A.arabicEnabled()?A.lang():'en')+'&id='+encodeURIComponent(item.id)+'" target="_blank" title="'+(ar?'تعرض المعاينة المحتوى المحفوظ فقط':'Preview shows saved content only')+'">'+(ar?'معاينة (المحفوظ)':'Preview (saved)')+'</a>':'')+'<button class="btn primary" id="save">'+A.t('save')+'</button></div></div>'+
   '<div class="errlist" id="errs" role="alert" style="display:none;background:rgba(232,143,143,.1);border:1px solid rgba(232,143,143,.4);border-radius:8px;padding:12px 16px;font-size:.83rem;color:var(--err);margin-bottom:16px"></div>'+
   jumpNav(CFG)+
   '<div class="panel">'+(id?'':'<div class="field"><label>ID (a-z0-9-)</label><input class="input mono" dir="ltr" id="f-id"></div>')+
   CFG.fields.map(function(f){return fieldHtml(f,item)}).join('')+
   '<label class="check"><input type="checkbox" data-k="hidden"'+(item.hidden?' checked':'')+'> <span>'+l('hiddenC')+'</span></label></div>';
   bind(c,item,CFG,id);
   if(CFG.col==='investigations'&&migrated)A.toast(ar?'تم نقل قاعدة الكشف القديمة إلى «قواعد الكشف» — اضغط حفظ للتأكيد':'Legacy detection rule moved into "Detection rules" — press Save to keep it','ok');
  }
  if(id){
   A.api('/admin/api/collection/'+CFG.col+'/'+encodeURIComponent(id)).then(function(r){
    if(r._code!==200){A.toast('not found','err');location.replace(CFG.col+'.html');return}
    start(r.item);
   });
  }else start(blank(CFG));
 });
}
function jumpNav(CFG){
  var gs=CFG.fields.filter(function(f){return f.t==='group'});
  if(!gs.length)return '';
  return '<nav class="jump" aria-label="sections">'+gs.map(function(g){return '<a href="#grp-'+g.k+'">'+A.esc(l(g.k))+'</a>'}).join('')+'</nav>';
}
function migrateLegacyRule(item){
  var code=String(item.detection_rule||'').trim();
  if(!code||(item.detections&&item.detections.length))return false;
  var lang=String(item.detection_rule_lang||'').trim(),lc=lang.toLowerCase();
  var row={rule_id:'DET-001',title:lang?(lang+' rule'):'Detection rule',status:'draft',severity:'medium',use_case:'',data_sources:'',sigma:'',spl:'',kql:'',other_lang:'',other_rule:'',false_positives:'',tuning:'',validation:'',attack:''};
  if(/sigma/.test(lc))row.sigma=item.detection_rule;
  else if(/spl|splunk/.test(lc))row.spl=item.detection_rule;
  else if(/kql|kusto|sentinel|defender/.test(lc))row.kql=item.detection_rule;
  else{row.other_lang=lang||'rule';row.other_rule=item.detection_rule}
  item.detections=[row];item.detection_rule='';item.detection_rule_lang='';
  return true;
}
function rowPreview(f,r){
  for(var i=0;i<f.cols.length;i++){var col=f.cols[i];if(col.t==='enum'||col.t==='code')continue;var v=String(r[col.k]||'').trim();if(v)return v.length>70?v.slice(0,70)+'…':v}
  return '';
}
function colHtml(col,r){
  var v=r[col.k]==null?'':r[col.k],lab='<span>'+A.esc(l(col.k))+'</span>';
  if(col.t==='enum')return '<label class="cell">'+lab+'<select class="input" data-p="'+col.k+'">'+col.values.map(function(x){return '<option value="'+A.esc(x)+'"'+(v===x?' selected':'')+'>'+A.esc(l(x)||'—')+'</option>'}).join('')+'</select></label>';
  if(col.t==='code')return '<label class="cell wide">'+lab+'<textarea class="input mono" dir="ltr" rows="8" data-p="'+col.k+'" spellcheck="false">'+A.esc(v)+'</textarea></label>';
  if(col.t==='text')return '<label class="cell wide">'+lab+'<textarea class="input" dir="ltr" rows="3" data-p="'+col.k+'">'+A.esc(v)+'</textarea></label>';
  var ph=col.t==='url'?'https://…':col.t==='attack'?'T1059.001':col.t==='attacklist'?'T1059.001, T1003':col.t==='sha256'?'64 hex characters':'';
  var mono=(col.t==='url'||col.t==='sha256'||col.t==='attack'||col.t==='attacklist')?' mono':'';
  return '<label class="cell">'+lab+'<input class="input'+mono+'" dir="ltr" data-p="'+col.k+'" value="'+A.esc(v)+'" placeholder="'+ph+'"></label>';
}
function fieldHtml(f,item){
 var v=item[f.k];
 if(f.t==='group')return '<h2 class="grp" id="grp-'+f.k+'">'+A.esc(l(f.k))+'</h2>';
 if(f.t==='rows')return '<div class="field"><label>'+l(f.k)+'</label><div data-rows="'+f.k+'"></div><button class="btn ghost sm" type="button" data-add-row="'+f.k+'">'+l(f.k==='detections'?'addRule':'addRow')+'</button></div>';
 if(f.t==='bi')return '<div class="field"><label>'+l(f.k)+'</label><div class="row2">'+
  '<textarea class="input ar-only" rows="'+(f.max&&f.max<=4000?3:6)+'" data-k="'+f.k+'" data-part="ar">'+A.esc(v&&v.ar||'')+'</textarea>'+
  '<textarea class="input" dir="ltr" rows="'+(f.max&&f.max<=4000?3:6)+'" data-k="'+f.k+'" data-part="en" placeholder="English">'+A.esc(v&&v.en||'')+'</textarea></div></div>';
 if(f.t==='code')return '<div class="field"><label>'+l(f.k)+'</label><textarea class="input mono" dir="ltr" rows="12" data-k="'+f.k+'" placeholder="title: Suspicious Activity\nstatus: experimental\ndetection:\n  selection: ...">'+A.esc(v||'')+'</textarea></div>';
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
    '<div class="row2"><textarea class="input ar-only" rows="2" data-p="ar" placeholder="العربية">'+A.esc(e.ar||'')+'</textarea><textarea class="input" dir="ltr" rows="2" data-p="en" placeholder="English">'+A.esc(e.en||'')+'</textarea></div>';
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
 function paintRows(f){
   var key=f.k,w=c.querySelector('[data-rows="'+key+'"]');w.innerHTML='';
   (item[key]||[]).forEach(function(r,i){
    var row=document.createElement('div');row.className='sec-row';
    row.innerHTML='<div class="head"><span class="num">'+(i+1)+'</span><b class="rtitle">'+A.esc(rowPreview(f,r))+'</b><span style="flex:1"></span>'+
     '<button class="btn sm ghost" data-up type="button">↑</button><button class="btn sm ghost" data-dn type="button">↓</button><button class="btn sm danger" data-del type="button">×</button></div>'+
     '<div class="rowgrid">'+f.cols.map(function(col){return colHtml(col,r)}).join('')+'</div>';
    row.querySelectorAll('[data-p]').forEach(function(inp){
     var h=function(){r[inp.dataset.p]=inp.value;var t=row.querySelector('.rtitle');if(t)t.textContent=rowPreview(f,r)};
     inp.addEventListener('input',h);inp.addEventListener('change',h);
    });
    row.querySelector('[data-del]').onclick=function(){item[key].splice(i,1);paintRows(f)};
    row.querySelector('[data-up]').onclick=function(){if(i>0){item[key].splice(i-1,0,item[key].splice(i,1)[0]);paintRows(f)}};
    row.querySelector('[data-dn]').onclick=function(){if(i<item[key].length-1){item[key].splice(i+1,0,item[key].splice(i,1)[0]);paintRows(f)}};
    w.appendChild(row);
   });
  }
 CFG.fields.forEach(function(f){
  if(f.t==='rows'){paintRows(f);c.querySelector('[data-add-row="'+f.k+'"]').onclick=function(){var r={};f.cols.forEach(function(col){r[col.k]=col.t==='enum'?col.values[0]:''});(item[f.k]=item[f.k]||[]).push(r);paintRows(f)}}
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
  if(!id){var fid=document.getElementById('f-id');if(fid)out.id=fid.value.trim();}
  var errs=document.getElementById('errs');
  A.api('/admin/api/collection/'+CFG.col+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:out}).then(function(r){
   if(r._code===200){A.toast(A.t('saved'),'ok');if(!id)setTimeout(function(){location.replace(CFG.col+'.html?edit=1&id='+encodeURIComponent(r.id))},500)}
   else{errs.style.display='block';errs.textContent=(r.details&&r.details.join(' · '))||r.error||A.t('failed');window.scrollTo(0,0)}
  }).catch(function(){A.toast(A.t('errNet'),'err')});
 };
}
})();
