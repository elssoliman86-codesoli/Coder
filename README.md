# 2OneByte-Coder

**منشئ تطبيقات بالذكاء الاصطناعي — احترافي، عربي أولًا (RTL)، يعمل كـ APK أندرويد و PWA.**

تطبيق شامل لتوليد الكود باستخدام فريق من نماذج الذكاء الاصطناعي المتخصصة، يخطط ويكتب ويعرض ويراجع ويصلح وينشر المشاريع على GitHub مباشرة من جهازك.

## المميزات الرئيسية

- 🤖 **فريق وكلاء متخصص** — Planner, Coder, Observer, Visual Critic, Fixer, Expert, Release Engineer
- 🎨 **نظام تصميم مبني على NameThatUI** — مصطلحات واجهات دقيقة، أسلوب Minimalism + Glassmorphism
- 📱 **تطبيق أصلي لأندرويد (APK) و PWA** — نفس الكود يعمل في كل مكان عبر Capacitor
- 🔄 **مراجعة بصرية حية** — مراقبة، اكتشاف عيوب، إصلاح آلي، تكرار حتى الجودة
- 📦 **نشر متكامل على GitHub** — إنشاء ريبو، workflows، GitHub Pages، إصدارات موقعة
- 🌐 **دعم RTL كامل** — عربي افتراضي، إنجليزي مدعوم، خطوط وأرقام واتجاه صحيح
- 🔐 **أمان محلي** — مفاتيح API وتوكنات GitHub في مخزن مشفر للجهاز فقط

## هيكل المشروع

```
2OneByte-Coder/
├── README.md
├── LICENSE
├── CHANGELOG.md
├── docs/
│   ├── PROMPT.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   └── SECURITY.md
├── skills/                 # المهارات المدمجة
├── src/
│   ├── app/                # المسارات والشاشات
│   ├── features/           # الميزات (home, workspace, settings, preview, publish, queue)
│   ├── agents/             # الوكلاء السبعة
│   ├── llm/                # عميل LLM موحد
│   ├── vfs/                # نظام ملفات افتراضي
│   ├── github/             # عميل GitHub وقوالب workflows
│   ├── ui-reference/       # أداة ui_lookup وذاكرة تخزين مؤقت
│   ├── design/             # tokens، المكونات
│   └── i18n/               # الترجمة (ar, en)
├── android/                # مشروع Capacitor للأندرويد
└── .github/workflows/      # CI، بناء APK، الإصدار
```

## متطلبات التطوير

- Node.js 20+
- pnpm 9+
- Android Studio (لبناء APK)
- Java 17+ (لـ Gradle)

## التثبيت والتشغيل

```bash
# تثبيت التبعيات
pnpm install

# تشغيل وضع التطوير (الويب)
pnpm dev

# بناء للإنتاج
pnpm build

# مزامنة وفتح مشروع الأندرويد
pnpm cap sync
pnpm cap open android
```

## البناء التلقائي (GitHub Actions)

المستودع يتضمن workflows لـ:
- **CI** — اختبارات، Линت، type-check عند كل push
- **Build APK** — بناء APK موقع وإرفاقه في Release
- **Release** — نشر تلقائي عند إنشاء tag

## الترخيص

MIT License — راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

**قاموس الواجهات:** [NameThatUI](https://namethatui.com) — تُستخدم مصطلحات بصرية دقيقة لكل قرار واجهات.