# تحذير مهم حول الاستضافة المجانية (Render Free Tier)

> **تنبيه:** الخطة المجانية في Render (Free Plan) تستخدم **قرصاً مؤقتاً (Ephemeral Disk)** وتدخل في وضع السكون عند عدم الاستخدام. أي تعديلات من لوحة الأدمن، أو حلول اللاعبين (`solves.json`)، أو الصور المرفوعة **تُمسح مع كل إعادة تشغيل أو نشر جديد (Redeploy)**.
> لذلك **الخطة المجانية مناسبة للعروض التجريبية (Demos) فقط**.

---

## الخيار الموصى به للإنتاج (Production)
1. **خادم VPS صغير (Ubuntu + Nginx + systemd):** راجع الدليل الكامل في [deploy/DEPLOY.md](DEPLOY.md).
2. **أو استضافة تدعم Persistent Disk (مثل Render Starter):**
   - قم بتعيين `TOR_DATA_DIR=/var/data` و `TOR_FLAGS_FILE=/var/data/flags.json` على المجلد المثبّت (راجع `render.yaml`).
   - أضف متغيرات البيئة المطلوبة في لوحة التحكم:
     - `ADMIN_USER`: اسم مستخدم الأدمن
     - `ADMIN_PASSWORD`: كلمة مرور قوية وعشوائية (10 أحرف على الأقل، لا تستخدم أي مثال مكتوب في الأدلة)
     - `TOR_HTTPS`: `1`
3. **النسخ الاحتياطي الدوري:** شغّل `node scripts/backup.cjs 7` عبر cron يومياً.
