# نشر The Temple of Records على VPS (Ubuntu + nginx + HTTPS)

الموقع ده سيرفر Node مش static، فمينفعش على GitHub Pages. محتاج VPS صغير (1 vCPU / 1 GB كفاية) ودومين.

## 1) تجهيز السيرفر
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
# Node 18+ (مثلاً من nodesource أو nvm)، وتأكد: node --version
sudo useradd --system --create-home --shell /usr/sbin/nologin temple
sudo mkdir -p /opt/temple-of-records
```

## 2) رفع الكود
```bash
# على السيرفر:
sudo git clone https://github.com/Mina-Maxx/temple-of-records.git /opt/temple-of-records
sudo chown -R temple:temple /opt/temple-of-records
```

## 3) HTTPS + nginx
```bash
sudo cp /opt/temple-of-records/deploy/nginx-temple.conf /etc/nginx/sites-available/temple
sudo sed -i 's/YOUR_DOMAIN/example.com/g' /etc/nginx/sites-available/temple   # دومينك
sudo certbot certonly --nginx -d example.com
sudo ln -s /etc/nginx/sites-available/temple /etc/nginx/sites-enabled/temple
sudo nginx -t && sudo systemctl reload nginx
```

## 4) تشغيل الخدمة
```bash
sudo cp /opt/temple-of-records/deploy/temple.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now temple
```
السيرفر بيسمع على 127.0.0.1:8000 بس، وnginx هو الوحيد اللي بيوصله من برّه.

## 5) إنشاء حساب الأدمن (مرة واحدة)
الـ setup مرفوض عن قصد لأي طلب جاي عن طريق nginx. اعمله عن طريق SSH tunnel:
```bash
ssh -L 8000:127.0.0.1:8000 user@SERVER
# وبعدين على جهازك افتح:  http://127.0.0.1:8000/admin/  واختار username/password (10+ حروف)
```
بعد كده سجّل دخول عادي من `https://example.com/admin/`.

## 6) قبل ما تعلن الرابط (مهم)
- [ ] امسح أو خلّي Draft: تشالنج `log4shell-lab` التجريبي (فلاجه `TOR{198.51.100.44}` معلن في README) والمقال الـ placeholder.
- [ ] املا صفحة About: الصورة، الشهادات/الإنجازات، روابط GitHub وLinkedIn والإيميل (Admin → Settings).
- [ ] في Settings حط Site origin = `https://example.com` عشان يطلع `sitemap.xml`.
- [ ] فلاجات التشالنجس الحقيقية: خليها طويلة وعشوائية (مثلاً `TOR{...16+ حرف عشوائي...}`) ومش قيمة ممكن تتخمن.
- [ ] Backup دوري لـ: `server/data/` و`content.js` و`server/flags.json` و`assets/`:
```bash
sudo tar czf ~/temple-backup-$(date +%F).tgz -C /opt/temple-of-records server/data content.js server/flags.json assets
```
- [ ] متفتحش بورت 8000 في الـ firewall. افتح 80/443/22 بس.
