# Disposable visual smoke test. Uses a throwaway admin account in a temp copy.
import os, tempfile, shutil, subprocess, time, json, urllib.request
src=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with tempfile.TemporaryDirectory(prefix='temple-ui-') as tmp:
 root=tmp+'/site';shutil.copytree(src,root)
 subs=[dict(id='ui'+str(i),ts='2026-11-23T12:00:00Z',identity='0123456789abcdef0123456789abcdef',challenge='log4shell-lab',flag_masked='TOR…(18)',result=r,ip_hash='sample-hash') for i,r in enumerate(['wrong','correct'])]
 open(root+'/server/data/submissions.jsonl','w').write('\n'.join(map(json.dumps,subs))+'\n')
 login=root+'/admin/login.html'
 s=open(login).read();s=s.replace('</body>', '''<script>(async()=>{await fetch('/admin/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'uitest',password:'only-local-ui-smoke'})});let r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'uitest',password:'only-local-ui-smoke'})});let j=await r.json();localStorage.setItem('tor_csrf',j.csrf);location.replace('/admin/submissions.html')})();</script></body>''');open(login,'w').write(s)
 p=root+'/admin/submissions.html';s=open(p).read();s=s.replace('</body>', '''<script>let probe=setInterval(()=>{let sel=document.getElementById('f-res');if(!sel)return;clearInterval(probe);sel.value='wrong';sel.dispatchEvent(new Event('change'));let rows=document.querySelectorAll('tbody tr');let ok=rows.length===1&&rows[0].textContent.includes('خاطئ');document.body.dataset.filterTest=ok?'PASS':'FAIL';},100);</script></body>''');open(p,'w').write(s)
 env=dict(os.environ,TOR_PORT='19288');p=subprocess.Popen(['node','server/server.js'],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 try:
  for _ in range(100):
   try:urllib.request.urlopen('http://127.0.0.1:19288/');break
   except Exception:time.sleep(.05)
  result=subprocess.run(['google-chrome-stable','--headless=new','--no-sandbox','--disable-gpu','--hide-scrollbars','--virtual-time-budget=15000','--window-size=1440,1000','--user-data-dir='+tmp+'/profile','--screenshot=/tmp/temple-hardened-filter.png','--dump-dom','http://127.0.0.1:19288/admin/login.html'],capture_output=True,text=True,timeout=30)
  assert 'data-filter-test="PASS"' in result.stdout,'browser filter test failed'
  print('PASS Arabic wrong-result filter shows exactly one matching row; screenshot /tmp/temple-hardened-filter.png')
 finally:p.terminate();p.wait()
