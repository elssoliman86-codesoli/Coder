# 2OneByte-Coder

منشئ تطبيقات بالذكاء الاصطناعي، عربي أولًا (RTL). بيشتغل كـ **PWA** وكـ **APK** (Capacitor).
يخطط → يكتب الكود لايف قدامك → يعاين → يراجع بصريًا → يصلح → يفحص أمنيًا → ينشر على GitHub.

An Arabic-first (RTL) AI app builder that runs as a PWA and an Android APK.

## تشغيل محلي
```bash
npm install
npm run build        # dist/
npm run dev          # http://localhost:5173
npm test             # 49 unit tests
npm run e2e          # Playwright against scripts/mock-llm.mjs (needs: npx playwright install chromium)
```

## بناء ملف التثبيت (APK)
1. ارفع الريبو على GitHub (فرع `main`).
2. Actions → **Build APK** → Run workflow (أو أي push على `main`).
3. نزّل `2OneByte-Coder.apk` من الـ Artifacts أو من **Releases**.

الـ APK ده **debug-signed** — كويس للتجربة والتثبيت المباشر، مش للنشر على Google Play (محتاج keystore خاص بيك).

## أول استخدام
القائمة (أيقونة ☰ يمين) → الإعدادات → **المزود**: اكتب Base URL ومفتاح API (متوافق مع OpenAI) → **List models** → اختار موديل لكل دور.
التوكن بتاع GitHub من تبويب GitHub (صلاحية `repo` + `workflow`).

## معلومات تقنية صريحة
- المفاتيح والتوكن بتتخزن مشفرة (AES-GCM بمفتاح غير قابل للتصدير على الجهاز) — **مش** Android Keystore.
- المحرر خفيف مدمج (مش CodeMirror). معاينة Python/CLI غير JS مش متضمنة (مفيش Pyodide).
- المراجعة البصرية بتعتمد على قياسات DOM داخل iframe معزول، مش لقطات شاشة للموديل.
- في الـ APK: أي مزود مالوش CORS headers هيفشل (CapacitorHttp مقفول عشان الـ streaming يشتغل).
- النشر بيتوقف لو تقييم الخبير أقل من 10/10 أو فيه ثغرة حرجة/عالية.

## Credits
مرجع المصطلحات والتصميم: [NameThatUI](https://namethatui.com). رخصة MIT.
