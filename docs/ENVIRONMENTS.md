# 🌍 البيئات: local و staging و production

| | Local (جهازك) | Staging (التجربة) | Production (الموقع الحقيقي) |
|---|---|---|---|
| **الموقع** | `localhost:3000` | روابط الـ preview من Vercel لكل فرع | `budgetanalysis.vercel.app` |
| **السيرفر** | Docker على جهازك | `budget-analysis-api-staging` على Render، من فرع **`staging`** | `budgetbuddy-api` على Render، من فرع **`main`** |
| **قاعدة البيانات** | Postgres بـ Docker | فرع **`staging`** على Neon (نسخة منفصلة) | فرع **`main`** على Neon |
| **الأسرار** | `backend/.env` | متغيرات خدمة الـ staging على Render | متغيرات خدمة الـ production على Render |

**القاعدة:** ولا شي بيوصل لـ `main` قبل ما يمر على الـ staging. والـ staging **ما بيلمس بيانات المستخدمين الحقيقيين أبداً**.

## الطريقة لكل مرحلة
```
git switch phase-N                     # الشغل على فرع المرحلة
git push origin phase-N                # Vercel بيعمل preview للفرونت إند
git push origin phase-N:staging        # السيرفر التجريبي بياخذ نفس الكود
```
1. Vercel بيعمل **preview**، والـ preview بيحكي مع **سيرفر الـ staging**.
2. Render بيعمل deploy للـ **staging** لحاله.
3. منجرّب كل شي عالـ preview.
4. Pull Request ← CI أخضر ← **merge لـ main** ← الموقع الحقيقي بيتحدّث لحاله.

**مين شغال هلأ؟** بالإعدادات بآخر الصفحة: `Version: web 7bc8d23 · api 7bc8d23`. لازم الرقمين يكونوا متل بعض بعد كل release. على الـ staging بيطلع جنبهم `(staging)`.

## التجهيز لمرة وحدة
### 1. فرع `staging` بـ git
```
git push origin phase-1:staging
```

### 2. قاعدة بيانات الـ staging على Neon
Neon ← المشروع ← **Branches** ← **Create branch**:
- الاسم: `staging`، والـ parent: `main`.
- بياخذ **نسخة من البيانات الحالية** بلحظتها (copy-on-write: ما بيكلّف مساحة إلا للتغييرات).
- ⚠️ النسخة فيها بيانات حقيقية. لو بدك staging نظيف، اختار **Schema only**.
- انسخ الـ **connection string** تبع فرع `staging` (مش `main`).

### 3. سيرفر الـ staging على Render
لما ينعمل merge لـ `render.yaml` الجديد، Render بيقترح خدمة **`budget-analysis-api-staging`** (Blueprint ← **Sync**). عبّي متغيراتها:
- `DATABASE_URL` ← رابط فرع **staging** من Neon
- `FRONTEND_URL` ← روابط الـ preview (مثلاً `https://budget-analysis-git-phase-1-m-altaweel.vercel.app`)
- `GOOGLE_CLIENT_ID` ← نفس القيمة
- `SENTRY_DSN` ← (اختياري)

### 4. الـ preview بيحكي مع الـ staging
Vercel ← Settings ← **Environment Variables** ← `API_ORIGIN`:
- **Production** ← سيرفر الـ production (متل ما هو)
- **Preview** ← `https://budget-analysis-api-staging.onrender.com` (الرابط من Render)

### 5. Sentry (تقارير الأخطاء)
sentry.io ← حساب مجاني ← **Create Project** ← **FastAPI** ← انسخ الـ **DSN** ← حطّه بـ `SENTRY_DSN` بالخدمتين على Render. الأخطاء بتنفصل لحالها: `production` و `staging`.

### 6. `EDGE_SECRET` (من المرحلة 2a)
سرّ مشترك بين الموقع (Vercel) والـ API (Render)، عشان الـ API يعرف IP الزائر الحقيقي (التهديد S6).
**سرّين مختلفين**، واحد لكل بيئة. كل واحد بينحط بمكانين **بنفس القيمة**:

| السرّ | Vercel (Environment Variables) | Render |
|---|---|---|
| الأول | `EDGE_SECRET` ← **Production** | `budgetbuddy-api` |
| الثاني | `EDGE_SECRET` ← **Preview** | `budget-analysis-api-staging` |

بتعمل السرّ بأمر: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. ما بينكتب بالشات ولا بالكود.
