# 📘 BudgetBuddy: سجل التعلّم

هاد الملف بيشرح كل شي انعمل بالمشروع: كل ملف، كل سطر مهم، وكل قرار وليش أخذناه.
كل مرحلة إلها قسم. ارجعله وقت ما بدك تعدّل على المشروع أو تتحضّر لمقابلة عمل.

**فهرس المراحل**

| المرحلة | الموضوع | الحالة |
|---|---|---|
| 1 | تجهيز المشروع، Docker، قاعدة البيانات، أول endpoint | ✅ |
| 2 | قاعدة البيانات وتسجيل الدخول (Auth) | ✅ |
| 3 | الميزانية، الفئات، المصاريف، العملات | ✅ |
| 4 | الواجهة: الدخول والمصاريف (MVP) | ✅ |
| 5 | Dashboard، رسوم بيانية، تنبيهات | ⏳ |
| 6 | أهداف الادخار والعملة الثانية | ⏳ |
| 7 | الذكاء الاصطناعي (Claude) | ⏳ |
| 8 | اختبارات، CI، README، النشر | ⏳ |

---

# المرحلة 1: تجهيز المشروع

## 🎯 الهدف

نبني "الهيكل العظمي" للباك إند: مشروع FastAPI بيشتغل، متصل بقاعدة بيانات PostgreSQL، جوا Docker، مع نظام migrations جاهز. ولا ميزة حقيقية لسا، بس كل شي بنبنيه بعدين رح يركب على هالأساس.

**النتيجة بآخر المرحلة:** لما تفتح `http://localhost:8000/api/v1/health` بيرد عليك:

```json
{"status": "ok", "database": "ok"}
```

يعني السيرفر شغال، وقادر يحكي مع قاعدة البيانات.

## 🗂️ الملفات اللي انعملت

```
budgetbuddy/
├── .gitignore               ← الملفات اللي Git لازم يتجاهلها
├── .gitattributes           ← توحيد نهايات الأسطر (Windows/Linux)
├── docker-compose.yml       ← بيشغّل قاعدة البيانات + الـ API بأمر واحد
├── README.md                ← واجهة المشروع على GitHub
├── docs/
│   ├── SAD.docx             ← وثيقة المعمارية
│   └── LEARNING_LOG.md      ← هاد الملف
└── backend/
    ├── pyproject.toml       ← المكتبات وإعدادات الأدوات
    ├── Dockerfile           ← وصفة بناء صورة الباك إند
    ├── .dockerignore        ← ملفات ما بدنا ياها جوا الصورة
    ├── .env.example         ← نموذج متغيرات البيئة
    ├── alembic.ini          ← إعدادات Alembic
    ├── app/
    │   ├── __init__.py      ← بيخلي app "حزمة" بايثون
    │   ├── config.py        ← الإعدادات
    │   ├── database.py      ← الاتصال بقاعدة البيانات
    │   ├── base.py          ← الأب لكل الجداول
    │   ├── main.py          ← نقطة البداية
    │   └── migrations/      ← Alembic
    │       ├── env.py
    │       ├── script.py.mako
    │       └── versions/    ← ملفات الـ migrations (فاضي هلأ)
    └── tests/
        └── test_health.py   ← أول اختبارات
```

لاحظ إنه ما في ملف زيادة: كل ملف إله وظيفة واضحة. هاد اللي طلبته بالبرومت ("بدون ملفات على الفاضي").

---

## 1️⃣ `backend/app/config.py`: الإعدادات

### الكود

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "BudgetBuddy API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://budgetbuddy:budgetbuddy@localhost:5432/budgetbuddy"

    frontend_url: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

### الشرح

**المشكلة اللي بيحلها:** في معلومات بتختلف حسب المكان اللي شغال فيه المشروع. مثلاً عنوان قاعدة البيانات على جهازك غير عنوانها على السيرفر. وفي معلومات سرية (متل مفتاح Claude) **ممنوع** تنكتب بالكود لأنه الكود رح يكون عام على GitHub.

**الحل:** متغيرات البيئة (Environment Variables). بنحط القيم بملف اسمه `.env`، والكود بيقرأها منه.

- **`BaseSettings`** من مكتبة `pydantic-settings`: بتقرأ كل متغير من البيئة أو من `.env` أوتوماتيكياً. مثلاً `database_url` بتنقرى من متغير اسمه `DATABASE_URL` (مش مهم حجم الأحرف).
- **الأنواع (`str`)**: Pydantic بيتأكد من النوع. لو كتبت قيمة غلط، البرنامج بيوقف من أول ثانية بخطأ واضح، بدل ما يطلع الخطأ بعد ساعة بمكان غريب.
- **القيم الافتراضية**: إذا المتغير مش موجود، بتنستخدم القيمة اللي بعد `=`.
- **`extra="ignore"`**: إذا بالـ `.env` في متغيرات ما بنعرفها، تجاهلها وما تعطي خطأ.
- **`cors_origins`**: بيحوّل نص متل `"http://a.com,http://b.com"` لقائمة. هيك بنقدر نسمح لأكثر من موقع بنفس المتغير.
- **`@property`**: بيخليك تكتب `settings.is_production` بدون أقواس، كأنها قيمة مش دالة.
- **`@lru_cache`**: بيحفظ النتيجة أول مرة. يعني ملف `.env` بينقرى **مرة وحدة بس** مهما استدعينا `get_settings()`.
- **`settings = get_settings()`**: نسخة جاهزة، أي ملف بيحتاج الإعدادات بيكتب `from app.config import settings`.

### ليش مش نكتب القيم مباشرة بالكود؟

لأنه هيك نفس الكود بالضبط بيشتغل على جهازك، وجوا Docker، وعلى السيرفر، والفرق بس بملف `.env`. هاد مبدأ من **The Twelve-Factor App** (مجموعة قواعد مشهورة لبناء تطبيقات الويب): *"خزّن الإعدادات بالبيئة، مش بالكود"*.

---

## 2️⃣ `backend/app/database.py`: الاتصال بقاعدة البيانات

### الكود

```python
from collections.abc import AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
```

### الشرح

فكر فيها متل مطعم:

- **`engine` (المحرك)** = المطبخ. واحد بس للتطبيق كله. جواه **Connection Pool**: مجموعة اتصالات جاهزة مع قاعدة البيانات. بدل ما نفتح اتصال جديد مع كل طلب (عملية بطيئة)، بناخد اتصال جاهز وبنرجعه بعد ما نخلص.
- **`pool_pre_ping=True`**: قبل ما يستخدم اتصال قديم، بيتأكد إنه لسا عايش. لو قاعدة البيانات عملت restart، ما بيطلع خطأ للمستخدم.
- **`echo=False`**: لو خليتها `True` بيطبع كل SQL بينفذ. مفيد للتعلم والتصحيح.
- **`SessionLocal` (مصنع الجلسات)** = الجرسون. كل طلب HTTP بياخد جلسة (session) خاصة فيه.
- **`expire_on_commit=False`**: بعد ما نحفظ بيانات، بنقدر نقرأها من الكائن بدون ما يرجع يسأل قاعدة البيانات. ضروري مع async.

**`get_db()`**: هي **Dependency** (اعتمادية) لـ FastAPI:
1. بتفتح جلسة
2. `yield` بيعطيها للـ endpoint
3. لما الـ endpoint يخلص، `async with` بيسكّر الجلسة أوتوماتيكياً، **حتى لو صار خطأ**

هيك مستحيل ننسى نسكّر اتصال (وهاد من أشهر أسباب انهيار السيرفرات: الاتصالات المفتوحة بتخلص).

### شو يعني `async`؟

السيرفر لما يسأل قاعدة البيانات، بيستنى جواب (بضع ملي ثواني). بالكود العادي، السيرفر بيوقف ما بيعمل شي خلال الانتظار. مع `async`، خلال الانتظار بيخدم طلبات ثانية. متل جرسون بياخد طلب طاولة وبيروح لطاولة ثانية بدل ما يوقف جنب المطبخ.

---

## 3️⃣ `backend/app/base.py`: الأب لكل الجداول

### الكود

```python
from datetime import datetime
from uuid import uuid4
from sqlalchemy import DateTime, MetaData, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class BaseModel(Base):
    __abstract__ = True

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, default=lambda: str(uuid4())
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

### الشرح

هاد نفس `base.py` اللي كان بمشروع eWP. كل جدول رح نعمله (User، Expense، Budget...) بيورث من `BaseModel`، فبياخد هالأعمدة الأربعة أوتوماتيكياً بدون ما نكررها. هاد مبدأ **DRY** (Don't Repeat Yourself).

| العمود | شو هو | ليش |
|---|---|---|
| `id` | رقم 1، 2، 3... | للربط بين الجداول داخلياً. سريع. **ما بيطلع أبداً بالـ API** |
| `uuid` | نص عشوائي متل `3f2a9c1e-...` | هاد اللي بيظهر بالروابط. لو استخدمنا `id`، أي حدا بيقدر يجرب `/expenses/1`، `/expenses/2`... ويخمّن البيانات. الـ UUID مستحيل يتخمّن |
| `created_at` | وقت الإنشاء | قاعدة البيانات نفسها بتحطه (`server_default=func.now()`) |
| `updated_at` | آخر تعديل | بيتحدث أوتوماتيكياً مع كل تعديل (`onupdate`) |

- **`__abstract__ = True`**: يعني `BaseModel` نفسه **ما إله جدول**. هو بس قالب.
- **`Mapped[int]`**: طريقة SQLAlchemy 2 الحديثة. بتحدد نوع العمود ببايثون، وهيك المحرر (VS Code) بيعرف الأنواع وبيكمّلك الكود.
- **`timezone=True`**: الأوقات بتنحفظ مع المنطقة الزمنية. مهم لأنه إنت بتستخدم التطبيق من دبي وإسطنبول بتوقيتين مختلفين.
- **`NAMING_CONVENTION`**: بيعطي أسماء ثابتة للقيود (constraints) متل `uq_users_email`. بدونها، كل قاعدة بيانات بتختار أسماء عشوائية، وبعدين Alembic بيتلخبط لما بدك تعدّل أو تحذف قيد.

---

## 4️⃣ `backend/app/main.py`: نقطة البداية

### الكود

```python
from typing import Annotated
from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="AI expense tracker and savings coach for students.",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get(f"{settings.api_prefix}/health", tags=["system"])
    async def health(response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
        try:
            await db.execute(text("SELECT 1"))
            database = "ok"
        except Exception:
            database = "unavailable"
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "ok" if database == "ok" else "degraded", "database": database}

    return app


app = create_app()
```

### الشرح

**`create_app()` (نمط App Factory):** بدل ما ننشئ التطبيق مباشرة، بنعمل دالة بتنشئه. الفائدة: بالاختبارات بنقدر ننشئ نسخة جديدة نظيفة. ونفس النمط كان بـ eWP.

**`docs_url`:** FastAPI بيعمل صفحة توثيق تفاعلية أوتوماتيكياً على `/docs`. بنخفيها بالـ production عشان ما نكشف كل الـ API لأي حدا.

**CORS (Cross-Origin Resource Sharing):**
المتصفح عنده قاعدة أمان: موقع على `localhost:3000` (الفرونت إند) **ممنوع** يطلب بيانات من `localhost:8000` (الباك إند) إلا إذا الباك إند سمح صراحةً. الـ `CORSMiddleware` هو اللي بيعطي هالإذن، بس للمواقع اللي بقائمة `cors_origins`.
- `allow_credentials=True`: ضروري بالمرحلة 2، لأنه الـ refresh token رح يكون بـ cookie.

**Health Check (`/api/v1/health`):**
endpoint بسيط بيجاوب: "هل السيرفر عايش؟ وهل قاعدة البيانات شغالة؟"
- `SELECT 1`: أبسط استعلام ممكن. ما بيقرأ أي جدول، بس بيتأكد إنه الاتصال شغال.
- إذا قاعدة البيانات واقعة، بيرجع **503 Service Unavailable**. هيك Docker و Railway بيعرفوا إنه في مشكلة.
- كل شركة حقيقية عندها health check، لأنه أنظمة المراقبة بتستخدمه لتعرف إذا لازم تعيد تشغيل السيرفر.

**`/api/v1`:** رقم الإصدار بالرابط. لما تطلع النسخة 2 بتغييرات كبيرة، تطبيق الموبايل القديم بيضل شغال على `v1` بدون ما يخرب.

**`Annotated[AsyncSession, Depends(get_db)]`:** هون **Dependency Injection**. الـ endpoint ما بيفتح جلسة بنفسه، بيطلبها، و FastAPI بيستدعي `get_db()` وبيعطيه ياها. الفائدة الكبيرة: بالاختبارات بنقدر **نبدّل** `get_db` بشي وهمي (شوف الاختبارات تحت).

---

## 5️⃣ Alembic: `alembic.ini` و `migrations/env.py`

### شو هو Alembic؟

متل **Git بس لشكل قاعدة البيانات**. كل ما تضيف جدول أو عمود، بتعمل "migration": ملف بايثون بيوصف التغيير. هيك:
- كل التغييرات مسجلة ومتسلسلة
- أي حدا بيعمل clone للمشروع بيكتب `alembic upgrade head` وبتصير قاعدة بياناته مطابقة لقاعدتك
- بتقدر ترجع لورا (`downgrade`) إذا غلطت

### أهم الأوامر (رح نستخدمها من المرحلة 2)

```bash
alembic revision --autogenerate -m "create users table"   # إنشاء migration من الـ models
alembic upgrade head                                       # تطبيق كل الـ migrations
alembic downgrade -1                                       # التراجع خطوة
alembic history                                            # عرض السجل
```

### قرارات بالإعدادات

- **`alembic.ini` ما فيه رابط قاعدة البيانات.** `env.py` بياخده من `app.config`. يعني مصدر واحد للحقيقة (`.env`)، وما في كلمة سر مكتوبة بملف بيترفع على GitHub.
- **`env.py` بيشتغل async** لأنه الـ driver تبعنا (`asyncpg`) async.
- **`target_metadata = Base.metadata`**: هيك Alembic بيعرف شو الجداول اللي بالكود، وبيقارنها بقاعدة البيانات ليولّد الـ migrations أوتوماتيكياً.
- **`compare_type=True`**: بيلاحظ كمان تغيير نوع العمود (مثلاً من نص قصير لنص طويل).
- **`file_template`**: أسماء ملفات الـ migrations بتبلش بالتاريخ، فبتنرتب لحالها.

---

## 6️⃣ `backend/pyproject.toml`: المكتبات

الملف الحديث بدل `requirements.txt`. فيه شغلتين:

**المكتبات الأساسية (`dependencies`):**

| المكتبة | دورها |
|---|---|
| `fastapi` | إطار الـ API |
| `uvicorn[standard]` | السيرفر اللي بيشغّل FastAPI |
| `sqlalchemy[asyncio]` | التعامل مع قاعدة البيانات ككلاسات بايثون (ORM) |
| `asyncpg` | الـ driver اللي بيحكي مع PostgreSQL (أسرع driver بايثون لـ PostgreSQL) |
| `alembic` | الـ migrations |
| `pydantic-settings` | قراءة الإعدادات |

**مكتبات التطوير (`dev`):** بتنزل بس على جهازك، مش على السيرفر:
`pytest` (الاختبارات)، `pytest-asyncio` (اختبار كود async)، `httpx` (عميل HTTP للاختبارات)، `ruff` (فحص وتنسيق الكود).

**`packages = []`:** هاد **تطبيق** مش **مكتبة** بدنا ننشرها. فـ `pip install .` بينزّل المكتبات بس، والكود بيشتغل من مكانه.

**`ruff`:** أداة بتفحص الكود (أخطاء، استيرادات مش مستخدمة، ترتيب) وبتنسقه بشكل موحد. شغّلها قبل كل commit:
```bash
ruff check . --fix
ruff format .
```

---

## 7️⃣ Docker: `Dockerfile` و `docker-compose.yml`

### ليش Docker أصلاً؟

المشكلة المشهورة: *"عندي بيشتغل، عندك لأ!"*. Docker بيحط التطبيق مع كل شي بيحتاجه (نسخة بايثون، المكتبات، الإعدادات) بـ **صندوق (Container)**، والصندوق بيشتغل نفس الشي على أي جهاز. وكمان ما بتحتاج تنزّل PostgreSQL على جهازك.

**مصطلحين مهمين:**
- **Image (صورة)** = الوصفة + المكونات الجاهزة (متل قالب كيك)
- **Container (حاوية)** = نسخة شغالة من الصورة (الكيكة نفسها)

### `Dockerfile`: وصفة صورة الباك إند

```dockerfile
FROM python:3.12-slim                 # نبدأ من صورة جاهزة فيها بايثون 3.12 (نسخة خفيفة)
WORKDIR /app                          # كل الأوامر الجاية بتشتغل جوا /app
COPY pyproject.toml ./                # ننسخ ملف المكتبات أول...
RUN pip install .                     # ...وننزّل المكتبات
COPY . .                              # بعدين ننسخ باقي الكود
RUN useradd --create-home appuser     # ننشئ مستخدم عادي
USER appuser                          # ونشتغل فيه بدل root
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**ليش ننسخ `pyproject.toml` لحاله أول؟** (سؤال مقابلات مشهور!)
Docker بيبني الصورة **طبقات (layers)** وبيحفظ كل طبقة. إذا الملف ما تغير، بيستخدم الطبقة المحفوظة. الكود بيتغير كل دقيقة، بس المكتبات نادراً. فلما نفصلهم، تنزيل المكتبات (اللي بياخد دقايق) بيصير مرة وحدة بس، وإعادة البناء بعد تعديل الكود بتاخد ثواني.

**ليش مش root؟** إذا حدا اخترق التطبيق، بيكون عنده صلاحيات محدودة جوا الحاوية بدل صلاحيات كاملة. نفس مبدأ **Least Privilege** اللي حكينا عنه.

**`${PORT:-8000}`:** Railway بيحدد الـ port بمتغير `PORT`. إذا مش موجود، استخدم 8000.

**`alembic upgrade head &&`:** قبل ما يشتغل السيرفر، بيطبّق أي migrations جديدة. فقاعدة البيانات دايماً محدّثة.

### `docker-compose.yml`: تشغيل كل شي سوا

بيشغّل خدمتين:

**`db` (PostgreSQL):**
- `image: postgres:16-alpine`: صورة رسمية جاهزة
- `environment`: اسم المستخدم وكلمة السر واسم القاعدة (للتطوير المحلي بس)
- `volumes: pgdata`: البيانات بتنحفظ برا الحاوية. لو حذفت الحاوية، بياناتك ما بتروح
- `healthcheck`: كل 5 ثواني بيسأل "جاهزة؟" بأمر `pg_isready`

**`api` (الباك إند):**
- `build: ./backend`: ابني الصورة من الـ Dockerfile
- `DATABASE_URL: ...@db:5432/...`: **نقطة مهمة!** جوا Docker، الحاويات بتحكي مع بعض باسم الخدمة (`db`)، مش `localhost`. لأنه `localhost` جوا حاوية الـ api يعني الحاوية نفسها
- `depends_on: condition: service_healthy`: ما تشغّل الـ api قبل ما تصير قاعدة البيانات **جاهزة فعلاً** (مش بس شغالة)
- `volumes: ./backend:/app`: بيربط الفولدر على جهازك بالحاوية. تعدّل الكود بـ VS Code، والسيرفر بيعيد التحميل لحاله (`--reload`)
- `WATCHFILES_FORCE_POLLING`: على Windows، إشعارات تغيير الملفات ما بتوصل للحاوية، فبنخليه يفحص الملفات بشكل دوري

---

## 8️⃣ `.env.example` و `.gitignore` و `.gitattributes`

- **`.env.example`**: نموذج بأسماء المتغيرات **بدون أسرار حقيقية**. بينرفع على GitHub. كل واحد بينسخه لـ `.env` وبيعبّي قيمه. (بـ eWP ما كان في هالملف، وكانت ملاحظة A-02 بالـ SAD.)
- **`.gitignore`**: أهم سطر فيه `.env`. **أي سر بيترفع على GitHub بيعتبر مكشوف للأبد**، حتى لو حذفته بعدين، لأنه بيضل بتاريخ Git. وفي بوتات بتفحص GitHub طول الوقت تدور على مفاتيح API.
- **`.gitattributes`**: Windows بينهي السطر بـ `CRLF` و Linux بـ `LF`. لو ملف فيه أوامر shell انحفظ بـ CRLF، بيخرب جوا حاوية Linux. هالملف بيوحّد كل شي على `LF`.

---

## 9️⃣ `backend/tests/test_health.py`: أول اختبارات

### الفكرة

بنختبر الـ health endpoint **بدون قاعدة بيانات حقيقية**. كيف؟ بنبدّل `get_db` بجلسة وهمية:

```python
class HealthySession:
    async def execute(self, *args, **kwargs):
        return None                      # بتتظاهر إنه الاستعلام نجح

class BrokenSession:
    async def execute(self, *args, **kwargs):
        raise ConnectionError("database is down")   # بتتظاهر إنه القاعدة واقعة

app.dependency_overrides[get_db] = override   # FastAPI بيستخدم الوهمية بدل الحقيقية
```

**اختباران:**
1. لما القاعدة شغالة ← لازم يرجع `200` و `{"status": "ok", "database": "ok"}`
2. لما القاعدة واقعة ← لازم يرجع `503` و `{"status": "degraded", "database": "unavailable"}`

**هاد اسمه Mocking**، وهون بتشوف فايدة الـ Dependency Injection اللي حكينا عنه: لأنه الـ endpoint **بيطلب** الجلسة بدل ما ينشئها، قدرنا نعطيه وحدة وهمية.

**`clear_overrides`**: fixture بتمسح التبديل بعد كل اختبار، عشان الاختبارات ما تأثر على بعض.

**`ASGITransport`**: بيبعت الطلبات للتطبيق **مباشرة بالذاكرة** بدون ما يشغّل سيرفر حقيقي. أسرع بكثير.

---

## ▶️ كيف تشغّل المرحلة 1

### أ) بـ Docker (الطريقة الأساسية)

```powershell
cd C:\Users\MOHAMMED\budgetbuddy
copy backend\.env.example backend\.env
docker compose up --build
```

افتح:
- http://localhost:8000/api/v1/health ← لازم تشوف `{"status":"ok","database":"ok"}`
- http://localhost:8000/docs ← صفحة التوثيق التفاعلية

لإيقاف كل شي: `Ctrl + C` وبعدها `docker compose down`

### ب) الاختبارات

```powershell
cd C:\Users\MOHAMMED\budgetbuddy\backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install --timeout 120 -e ".[dev]"
python -m pytest
python -m ruff check .
```

**ملاحظة:** إذا PowerShell رفض تفعيل الـ venv بخطأ "running scripts is disabled"، اكتب مرة وحدة:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### ج) أول commit على Git

```powershell
cd C:\Users\MOHAMMED\budgetbuddy
git init
git add .
git commit -m "chore: project setup with FastAPI, PostgreSQL, Alembic and Docker"
```

بعدها اعمل repository جديد على GitHub اسمه `budgetbuddy` (بدون README)، واتبع الأوامر اللي بيعطيك ياها GitHub تحت "push an existing repository".

**صيغة رسالة الـ commit:** `chore:` / `feat:` / `fix:` / `docs:` / `test:` هاي اسمها **Conventional Commits**. كثير شركات بتستخدمها، وبتخلي تاريخ المشروع مرتب ومقروء.

---

## 🧩 أخطاء ممكن تواجهك

| الخطأ | السبب | الحل |
|---|---|---|
| `port is already allocated` (5432 أو 8000) | في برنامج ثاني مستخدم نفس الـ port (مثلاً PostgreSQL منزّل على جهازك) | سكّر البرنامج، أو غيّر `"5432:5432"` لـ `"5433:5432"` |
| `Cannot connect to the Docker daemon` | Docker Desktop مش شغال | افتح Docker Desktop واستنى لحد ما يصير أخضر |
| `env file ... not found` | نسيت تنسخ `.env.example` لـ `.env` | `copy backend\.env.example backend\.env` |
| `{"database":"unavailable"}` | الـ api مش قادر يوصل لقاعدة البيانات | `docker compose logs db` وشوف الخطأ |

---

## 🛠️ مشكلة حقيقية واجهتنا: فشل `docker compose up --build`

### الأعراض
أول بناء وقف عند `RUN pip install .` بخطأ `ResolutionImpossible`، وآخر سطر ظاهر كان عن `uvicorn[standard] 0.32.0` و `watchfiles`.

### التشخيص (خطوة خطوة)
1. **ما صلّحنا على عمى.** الشاشة كانت بتورجي آخر الخطأ بس، فحفظنا الـ log كامل بملف:
   ```powershell
   docker compose build --progress=plain --no-cache api *> build.log
   ```
2. **قرأنا الـ log وطلع السبب الحقيقي:**
   ```
   Downloading setuptools-84.0.0-py3-none-any.whl (818 kB)   0.0/818.2 kB
   ReadTimeoutError: HTTPSConnectionPool(host='files.pythonhosted.org'): Read timed out.
   ```
   يعني التحميل من PyPI كان بطيء/متقطع جوا Docker، و pip بيستسلم بعد **15 ثانية** افتراضياً.
3. **ليش طلع بالأول `ResolutionImpossible`؟** لأنه لما pip يفشل بتحميل نسخة، بيعتبرها "مش متوفرة" وبيجرب نسخة أقدم... لحد ما يخلصوا كل النسخ، فبيحكي "مستحيل ألاقي نسخ متوافقة". **رسالة الخطأ كانت مضللة، والسبب الحقيقي شبكة مش تعارض مكتبات.**

### الحل (بالـ `Dockerfile`)
```dockerfile
ENV PIP_DEFAULT_TIMEOUT=120 \     # استنى لحد دقيقتين بدل 15 ثانية
    PIP_RETRIES=10                 # جرّب 10 مرات قبل ما تستسلم

RUN --mount=type=cache,target=/root/.cache/pip pip install .
```
- **`--mount=type=cache`**: بيحفظ المكتبات اللي نزلت بين محاولات البناء. فلو البناء فشل بالنص، المحاولة الجاية ما بتنزّل كل شي من جديد.
- وأضفنا `*.log` لـ `.gitignore` عشان ملف `build.log` ما يترفع على GitHub.

### الدرس
> **رسالة الخطأ الأخيرة مش دايماً السبب.** دوّر على **أول** خطأ بالـ log، مش آخر واحد.

هاي القصة جواب ممتاز لسؤال المقابلات: *"احكيلي عن bug واجهته وكيف حليته"*. احكي: الأعراض ← كيف جمعت معلومات ← السبب الحقيقي ← الحل ← شو تعلمت.

## 🛠️ مشكلة ثانية: `ModuleNotFoundError: No module named 'asyncpg'` بالاختبارات

### الأعراض
`pytest` فشل بخطأ إنه `asyncpg` مش موجود، مع تحذيرات `Unknown config option: asyncio_mode`، رغم إنه الـ venv كان مفعّل `(.venv)`.

### التشخيص
الدليل كان **بالمسارات** بالـ traceback:
```
C:\Users\MOHAMMED\AppData\Local\Programs\Python\Python312\Lib\site-packages\...
```
هاد بايثون **العام** مش الـ venv. يعني:
1. `pip install -e ".[dev]"` فشل بصمت (نفس مشكلة الشبكة)، فالـ venv ضل فاضي
2. لما كتبنا `pytest`، ما كان موجود بالـ venv، فـ Windows لقى نسخة قديمة منزلة على بايثون العام وشغّلها
3. هاي النسخة ما عندها `asyncpg` ولا `pytest-asyncio`، فطلعت الأخطاء والتحذيرات

### الحل
```powershell
python -m pip install --timeout 120 --retries 10 -e ".[dev]"
python -m pytest
```
**`python -m`** بيضمن إنه الأداة بتشتغل من نفس بايثون اللي مفعّل (الـ venv). وتأكدنا إنه التنصيب خلص بـ `Successfully installed` قبل ما نكمل.

### النتيجة
```
platform win32 -- Python 3.12.0, pytest-9.1.1
plugins: anyio-4.15.1, asyncio-1.4.0
tests\test_health.py ..                 [100%]
2 passed in 1.43s
```

### الدرس
> **الـ traceback بيحكيلك "وين" مش بس "شو".** المسارات بتكشف أي بايثون وأي مكتبات عم تنستخدم.
> ودايماً استعمل `python -m pip` و `python -m pytest` على Windows.

---

## 🎤 أسئلة مقابلات عن هالمرحلة

**س: ليش استخدمت FastAPI بدل Django أو Flask؟**
ج: FastAPI async بالأساس، فبيخدم طلبات كثيرة بنفس الوقت وهو مستني قاعدة البيانات أو Claude API. بيتحقق من البيانات أوتوماتيكياً بـ Pydantic، وبيولّد توثيق تفاعلي (`/docs`). Django أثقل وفيه أشياء ما بحتاجها لأنه الواجهة منفصلة (Next.js).

**س: شو الفرق بين `id` و `uuid` بجداولك؟**
ج: `id` رقم متسلسل للربط الداخلي لأنه أسرع. `uuid` هو اللي بيظهر بالـ API، لأنه الأرقام المتسلسلة بتسمح لحدا يخمّن روابط بيانات غيره (ثغرة اسمها IDOR).

**س: ليش ما بتحط كلمات السر والمفاتيح بالكود؟**
ج: لأنه الكود بينرفع على GitHub، وأي سر بيترفع بيضل بتاريخ Git حتى لو انحذف. بحطها بمتغيرات بيئة، و`.env` موجود بـ `.gitignore`، وبرفع `.env.example` بس كنموذج.

**س: شو فايدة health check؟**
ج: أنظمة المراقبة و Docker و منصات النشر بتسأله بشكل دوري. إذا رجع 503، بتعرف إنه في مشكلة وبتقدر تعيد تشغيل الخدمة أو توقف توجيه الزوار إلها.

**س: ليش بالـ Dockerfile بتنسخ ملف المكتبات قبل باقي الكود؟**
ج: عشان الـ layer caching. Docker بيعيد بناء الطبقة بس إذا ملفاتها تغيرت. المكتبات نادراً بتتغير والكود دايماً، فبفصلهم عشان ما ينزّل المكتبات من جديد مع كل تعديل.

**س: شو هو Alembic وليش بتحتاجه؟**
ج: أداة migrations لقاعدة البيانات، متل version control لشكل الجداول. كل تغيير بيتسجل بملف، فأي بيئة (جهازي، السيرفر، جهاز زميل) بتوصل لنفس الشكل بأمر واحد، وبقدر أتراجع عن أي تغيير.

**س: كيف اختبرت endpoint بيحتاج قاعدة بيانات بدون قاعدة بيانات؟**
ج: بـ dependency overrides بـ FastAPI. الـ endpoint بيطلب الجلسة عن طريق `Depends(get_db)`، فبالاختبار بدّلتها بجلسة وهمية (mock). هيك الاختبار سريع وما بيعتمد على شي خارجي.

---

## ✅ ملخص المرحلة 1

- [x] هيكلة المشروع حسب الـ SAD (قسم 5.2)
- [x] إعدادات من متغيرات البيئة
- [x] اتصال async مع PostgreSQL
- [x] `BaseModel` مشترك لكل الجداول
- [x] Health check مع فحص قاعدة البيانات
- [x] Alembic جاهز للمرحلة 2
- [x] Docker + Docker Compose
- [x] أول اختبارين
- [x] تجهيز Git والـ README

**المرحلة الجاية (2):** أول جدول حقيقي (`users`)، تسجيل حساب، تسجيل دخول، تشفير كلمات السر بـ bcrypt، و JWT مع refresh tokens.

---
---

# المرحلة 2: تسجيل الحساب وتسجيل الدخول 🔐

## 🎯 الهدف

الطالب بيقدر:
1. **يعمل حساب** (إيميل، كلمة سر، اسم، عملة أساسية)
2. **يسجّل دخول** وياخد "مفتاح" مؤقت
3. **يضل مسجّل دخول** بدون ما يكتب كلمة السر كل ربع ساعة
4. **يشوف ويعدّل** ملفه الشخصي (العملات، اللغة، الاسم)
5. **يسجّل خروج**

وكل هاد بطريقة آمنة متل اللي بتستخدمها الشركات الحقيقية.

## 🗺️ الصورة الكبيرة: كيف بيشتغل تسجيل الدخول؟

```
1. الطالب: إيميل + كلمة سر  ─────────────▶  POST /auth/login
2. السيرفر بيتأكد من كلمة السر (bcrypt)
3. السيرفر بيرجّع شغلتين:
     • Access Token (JWT)  ← بالـ JSON، عمره 15 دقيقة
     • Refresh Token       ← بـ cookie مخفية، عمره 7 أيام
4. كل طلب بعدها:  Authorization: Bearer <access token>  ──▶  GET /users/me
5. بعد 15 دقيقة الـ access token بيخلص:
     الفرونت إند بيبعت الـ cookie  ──▶  POST /auth/refresh
     السيرفر بيعطي access token جديد + refresh token جديد (والقديم بينلغى)
```

**ليش توكنين مش واحد؟** (سؤال مقابلات مشهور جداً)
- **Access token** بينبعت مع **كل** طلب، فاحتمال ينسرق أعلى. فبنخلي عمره قصير (15 دقيقة): لو انسرق، الضرر محدود.
- **Refresh token** بينبعت **بس** لـ `/auth/refresh`، ومخبّى بـ cookie ما بيقدر JavaScript يقرأها. فبنقدر نخلي عمره أطول.
- النتيجة: أمان التوكن القصير + راحة إنك ما تسجل دخول كل ربع ساعة. وهيك حلّينا مشكلة **L-04** من وثيقة eWP (المستخدم كان يطلع لحاله بعد 15 دقيقة).

## 🗂️ الملفات الجديدة والمعدّلة

```
backend/
├── pyproject.toml                    ✏️ 4 مكتبات جديدة
├── .env.example                      ✏️ SECRET_KEY
├── app/
│   ├── config.py                     ✏️ إعدادات JWT + فحص المفتاح السري
│   ├── base.py                       ✏️ eager_defaults
│   ├── main.py                       ✏️ تسجيل الـ routers والـ rate limiter
│   ├── models.py                     🆕 قائمة كل الجداول
│   ├── dependencies.py               🆕 get_current_user (بوابة الأمان)
│   ├── core/
│   │   ├── security.py               🆕 bcrypt + JWT + refresh tokens
│   │   ├── limiter.py                🆕 تحديد عدد المحاولات
│   │   └── money.py                  🆕 العملات الست
│   ├── domain/user/
│   │   ├── model.py                  🆕 جداول users و refresh_tokens
│   │   ├── schema.py                 🆕 شكل البيانات الداخلة والطالعة
│   │   ├── repository.py             🆕 استعلامات قاعدة البيانات
│   │   ├── service.py                🆕 منطق التسجيل والدخول
│   │   └── router.py                 🆕 الـ endpoints
│   └── migrations/versions/
│       └── 20261018_..._create_users_and_refresh_tokens.py   🆕 أول migration
└── tests/
    ├── conftest.py                   🆕 قاعدة بيانات للاختبارات
    ├── test_security.py              🆕 8 اختبارات
    └── test_auth.py                  🆕 15 اختبار
```

### المكتبات الجديدة

| المكتبة | ليش |
|---|---|
| `bcrypt` | تشفير كلمات السر |
| `pyjwt` | إنشاء وقراءة JWT (بدل `python-jose` اللي كانت بـ eWP، لأنها ما عاد حدا بيطورها) |
| `email-validator` | بيخلي Pydantic يتأكد إنه الإيميل صيغته صحيحة (`EmailStr`) |
| `slowapi` | تحديد عدد المحاولات (rate limiting) |

---

## 🧱 نمط الطبقات: كيف بيمشي الطلب جوا الكود

هاد أهم مفهوم بالمرحلة، وهو نفس نمط eWP:

```
طلب HTTP
   │
   ▼
router.py       ← "الاستقبال": بيستلم الطلب، بيتأكد من شكل البيانات (schema)، وبيسلّم للـ service
   │
   ▼
service.py      ← "المدير": القواعد والقرارات (هل الإيميل مستخدم؟ هل كلمة السر صح؟)
   │
   ▼
repository.py   ← "الأرشيف": بيكلّم قاعدة البيانات وبس، بدون أي قرارات
   │
   ▼
model.py        ← "شكل الملف بالأرشيف": الجداول
```

**ليش هالتقسيم؟** كل طبقة إلها سبب واحد لتتغير:
- بدك تغير رابط الـ endpoint؟ ← `router.py` بس
- بدك تغير قاعدة (مثلاً تمنع إيميلات معينة)؟ ← `service.py` بس
- بدك تسرّع استعلام؟ ← `repository.py` بس

هاد اسمه **Separation of Concerns**، وهو أول حرف من مبادئ **SOLID** (Single Responsibility).

---

## 1️⃣ `core/security.py`: كلمات السر والتوكنات

### أ) تشفير كلمات السر بـ bcrypt

```python
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False
```

**القاعدة الذهبية: ممنوع تحفظ كلمة السر نفسها. أبداً.**
لو حدا سرق قاعدة البيانات، بيلاقي هيك شي: `$2b$12$KIX8...` ومستحيل يرجعها لكلمة السر الأصلية.

**Hashing مش Encryption:**
- **Encryption** (تشفير): باتجاهين. بتشفّر وبتفك بمفتاح.
- **Hashing**: باتجاه واحد. ما في طريقة ترجع. فكيف بنتحقق؟ بنعمل hash لكلمة السر اللي كتبها المستخدم، وبنقارن النتيجة.

**ليش bcrypt بالذات مش SHA-256؟**
- bcrypt **بطيء عن قصد** (حوالي ربع ثانية). للمستخدم ما بيفرق، بس للمهاجم اللي بدو يجرب مليار كلمة سر، بيصير مستحيل عملياً.
- فيه **salt**: قيمة عشوائية بتنضاف لكل كلمة سر. فلو مستخدمين عندهم نفس كلمة السر، الـ hash تبعهم بيطلع مختلف (فيه اختبار لهالشي). وهيك المهاجم ما بيقدر يستخدم جداول جاهزة (rainbow tables).

**حد الـ 72 bytes:** bcrypt بيقرأ أول 72 byte بس. والحرف العربي بياخد 2 bytes، فبالـ schema عملنا فحص بالـ bytes مش بعدد الحروف.

### ب) منع تسريب المعلومات بالوقت (Timing Attack)

```python
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))
...
if user is None:
    verify_password(data.password, DUMMY_PASSWORD_HASH)   # ليش؟!
    raise HTTPException(401, INVALID_CREDENTIALS)
```

لو الإيميل مش موجود، السيرفر بيرد **فوراً**. ولو موجود بس كلمة السر غلط، بياخد **ربع ثانية** (bcrypt). المهاجم بيقيس الوقت وبيعرف مين عنده حساب! فبنعمل تحقق وهمي ليصير الوقت نفسه بالحالتين. وكمان **نفس رسالة الخطأ** بالحالتين (فيه اختبار لهالشي).

### ج) Access Token (JWT)

```python
def create_access_token(user_uuid: str) -> str:
    now = datetime.now(UTC)
    payload = {"sub": user_uuid, "type": "access", "iat": now,
               "exp": now + timedelta(minutes=settings.access_token_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
```

**شو هو JWT؟** نص من 3 أجزاء مفصولة بنقطة: `header.payload.signature`
- **payload**: المعلومات (`sub` = مين المستخدم، `exp` = إمتى بيخلص)
- **signature**: توقيع بالـ `SECRET_KEY`

**نقطة مهمة جداً:** الـ payload **مش مشفّر**، أي حدا بيقدر يقرأه (جرب تحط توكن على موقع jwt.io). بس **ما حدا بيقدر يعدّله**، لأنه أي تعديل بيخرب التوقيع، والتوقيع بيحتاج الـ `SECRET_KEY` اللي بس السيرفر بيعرفه. فلهيك:
- ✅ منحط فيه الـ uuid
- ❌ ممنوع نحط فيه كلمة سر أو أي معلومة سرية

**الفايدة:** السيرفر بيعرف مين إنت بس من التوقيع، بدون ما يسأل قاعدة البيانات عن جلسة. هاد اسمه **Stateless Authentication**، وبيسهّل توسيع السيرفر لأكثر من نسخة.

**`"type": "access"`**: عشان ما حدا يستخدم نوع توكن ثاني (لو عملنا بالمستقبل توكن لتأكيد الإيميل مثلاً) مكان الـ access token.

**`decode_access_token`** بيرجّع `None` إذا التوكن معدّل، أو موقّع بمفتاح ثاني، أو منتهي. وكل حالة إلها اختبار بـ `test_security.py`.

### د) Refresh Token

```python
def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)       # 64 حرف عشوائي

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
```

- **مش JWT**، نص عشوائي بس. لأنه بدنا نقدر **نلغيه** (logout)، فلازم يكون محفوظ بقاعدة البيانات.
- **منحفظ الـ hash تبعه** مش التوكن نفسه، متل كلمة السر. لو انسرقت القاعدة، التوكنات ما بتنفع.
- **ليش SHA-256 هون مش bcrypt؟** لأنه التوكن عشوائي وطويل جداً (مش كلمة سر اختارها إنسان)، فمستحيل يتخمّن أصلاً. وSHA-256 سريع، فبنقدر ندوّر عليه بالقاعدة مباشرة.

---

## 2️⃣ `domain/user/model.py`: الجداول

```python
class User(BaseModel):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    base_currency: Mapped[str] = mapped_column(String(3), server_default="TRY")
    secondary_currency: Mapped[str | None] = mapped_column(String(3))
    locale: Mapped[str] = mapped_column(String(5), server_default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())


class RefreshToken(BaseModel):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

- **`Mapped[str]`** = عمود `NOT NULL` (إجباري). **`Mapped[str | None]`** = بيقبل فاضي.
- **`unique=True`** على الإيميل: قاعدة البيانات نفسها بتمنع التكرار. حتى لو صار خطأ بالكود، القاعدة هي خط الدفاع الأخير.
- **`server_default`**: القيمة الافتراضية بتحطها قاعدة البيانات نفسها.
- **`is_active`**: بدل ما نحذف حساب، بنعطّله. (اسمه Soft Delete)
- **`ForeignKey(..., ondelete="CASCADE")`**: كل توكن مربوط بمستخدم. إذا انحذف المستخدم، توكناته بتنحذف معه أوتوماتيكياً.
- **`index=True`** على `user_id`: بيسرّع البحث عن كل توكنات مستخدم (بنحتاجه بـ "إلغاء كل الجلسات").
- **`revoked_at`**: إذا فاضي، التوكن شغال. إذا فيه تاريخ، انلغى بهالوقت. أحسن من `is_revoked = True` لأنه بيعطينا كمان **إمتى**.

**`eager_defaults` بـ `base.py`:** لما قاعدة البيانات بتحط `created_at` بنفسها، SQLAlchemy ما بيعرف القيمة. بالكود العادي بيروح يسألها لما نقرأها، بس مع async هالسؤال المخفي بيعطي خطأ (`MissingGreenlet`). `eager_defaults` بيخليه يجيب القيم فوراً بنفس أمر الـ INSERT (عن طريق `RETURNING`).

**`app/models.py`:** ملف بيستورد كل الجداول. Alembic والاختبارات بيستوردوه عشان يشوفوا كل الجداول. لما نضيف جدول جديد بالمراحل الجاية، بنضيف سطر هون.

---

## 3️⃣ `domain/user/schema.py`: شكل البيانات

**الـ model** = شكل البيانات بقاعدة البيانات. **الـ schema** = شكل البيانات اللي **بتدخل وبتطلع** من الـ API. ليش منفصلين؟ لأنه **ما بدنا نرجّع كل شي**:

```python
class UserRead(BaseModel):
    uuid: str
    email: str
    full_name: str
    base_currency: Currency
    secondary_currency: Currency | None
    locale: Locale
    created_at: datetime
```

لاحظ شو **مش** موجود: `password_hash` و `id` و `is_active`. حتى لو حدا نسي، مستحيل يطلعوا بالـ API لأنهم مش بالـ schema. (فيه اختبار بيتأكد.)

**`RegisterRequest`:**
- `EmailStr`: بيرفض أي شي مش إيميل
- `Field(min_length=8, max_length=72)`: كلمة السر بين 8 و 72
- `Currency`: بيقبل بس العملات الست. أي شي ثاني (مثلاً `GBP`) ← **422**
- `_lower_email`: بيحوّل الإيميل لأحرف صغيرة، فـ `Mohammed@X.com` و `mohammed@x.com` نفس الحساب
- `str_strip_whitespace=True`: بيشيل المسافات من الأطراف

**`UserUpdate` (للـ PATCH):** كل الحقول اختيارية، وبنغير بس اللي انبعت:
```python
for field, value in data.model_dump(exclude_unset=True).items():
    setattr(user, field, value)
```
`exclude_unset=True` هي السر: بتفرّق بين "ما بعتت الحقل" و "بعتته `null`". فـ `secondary_currency: null` بيمسحها، بس `full_name: null` ممنوع (عملنا validator اسمه `not_null`).

**`Currency` بـ `core/money.py`:** هاد `StrEnum`، يعني قائمة ثابتة من القيم، وكل قيمة هي نص بنفس الوقت. فبتنحفظ بقاعدة البيانات كنص عادي (`"TRY"`)، بس بالكود مستحيل نكتب عملة غلط.

---

## 4️⃣ `domain/user/repository.py`: الأرشيف

```python
class UserRepository:
    async def get_by_email(self, email: str) -> User | None:
        return await self.session.scalar(select(User).where(User.email == email))
```

- **ما فيه ولا قرار**، بس "جيبلي" و "احفظلي".
- **`select(User).where(...)`**: هاد SQLAlchemy 2. بيتحول لـ `SELECT * FROM users WHERE email = $1`. والـ `$1` معناها إنه القيمة بتنبعت **منفصلة** عن الأمر، فمستحيل يصير **SQL Injection**.
- **`revoke_all_for_user`**: أمر `UPDATE` واحد بيلغي كل جلسات المستخدم دفعة وحدة، بدل ما نجيبهم واحد واحد.

---

## 5️⃣ `domain/user/service.py`: المدير

### التسجيل
```python
async def register(self, data):
    if await self.users.get_by_email(data.email):
        raise self._email_taken()                      # 409
    user = User(email=..., password_hash=hash_password(data.password), ...)
    self.users.add(user)
    try:
        await self.session.flush()                     # INSERT هلأ
    except IntegrityError:
        await self.session.rollback()
        raise self._email_taken() from None
    tokens = self._issue_tokens(user)
    await self.session.commit()
    return tokens
```

- **`flush()` vs `commit()`**: الـ `flush` بيبعت الـ INSERT لقاعدة البيانات (فبياخد المستخدم `id`) **بس لسا ما بيثبّت**. الـ `commit` بيثبّت كل شي. إذا صار خطأ بالنص، ولا شي بيتسجل. هاد اسمه **Transaction**: يا كل شي، يا ولا شي.
- **ليش الفحص مرتين (`get_by_email` و `IntegrityError`)؟** لو اثنين سجّلوا بنفس الإيميل **بنفس اللحظة**، الاثنين بيعدّوا الفحص الأول. الـ `UNIQUE` بقاعدة البيانات بيمسك الثاني. هاد اسمه **Race Condition**.
- **رموز الحالة (Status Codes):**

| الرمز | المعنى | إمتى |
|---|---|---|
| 200 | تمام | دخول، تحديث |
| 201 | انعمل شي جديد | تسجيل |
| 204 | تمام وما في محتوى | خروج |
| 401 | مين إنت؟ | كلمة سر غلط، توكن مش صالح |
| 403 | بعرفك بس ممنوع | حساب معطّل |
| 409 | تعارض | إيميل مستخدم |
| 422 | البيانات غلط | إيميل مش صحيح، كلمة سر قصيرة |
| 429 | كثير طلبات | أكثر من 5 محاولات دخول بالدقيقة |

### التجديد (Refresh) مع كشف السرقة
```python
if stored.revoked_at is not None:
    await self.tokens.revoke_all_for_user(stored.user_id)
    await self.session.commit()
    raise HTTPException(401, ...)
...
stored.revoked_at = now            # Rotation
tokens = self._issue_tokens(user)
```

**Refresh Token Rotation:** كل مرة بتجدد، التوكن القديم بينلغى وبتاخد واحد جديد.

**كشف السرقة (Reuse Detection):** تخيل حدا سرق توكنك:
1. إنت بتجدد ← توكنك القديم انلغى، أخذت جديد
2. السارق بيحاول يستخدم التوكن القديم المسروق
3. السيرفر بيشوف توكن **ملغى** عم ينستخدم مرة ثانية ← **في شي غلط!**
4. بيلغي **كل** جلساتك، فالسارق بيطلع برا (وإنت كمان، بس بتسجل دخول من جديد وبس)

هاد نفس الأسلوب اللي بتستخدمه Auth0 و Okta.

---

## 6️⃣ `dependencies.py`: بوابة الأمان

```python
async def get_current_user(credentials, db) -> User:
    if credentials is None: raise unauthorized
    user_uuid = decode_access_token(credentials.credentials)
    if user_uuid is None: raise unauthorized
    user = await UserRepository(db).get_by_uuid(user_uuid)
    if user is None or not user.is_active: raise unauthorized
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]
```

**أي endpoint بيحتاج مستخدم مسجّل، بيكتب بس:**
```python
async def read_me(user: CurrentUser) -> UserRead:
```
و FastAPI بيعمل كل الفحص قبل ما يوصل الكود. **مكان واحد** للأمان بكل التطبيق، فمستحيل ننسى نحمي endpoint. بالمراحل الجاية كل endpoint للمصاريف والميزانية رح يستخدم `CurrentUser`.

**ليش بنجيب المستخدم من قاعدة البيانات مع إنه الـ JWT كافي؟** عشان لو الحساب انعطّل، يخسر الوصول **فوراً**، مش بعد ما يخلص التوكن.

---

## 7️⃣ `domain/user/router.py`: الـ Endpoints

| Method | الرابط | شو بيعمل |
|---|---|---|
| POST | `/api/v1/auth/register` | حساب جديد ← 201 + توكنات |
| POST | `/api/v1/auth/login` | دخول ← توكنات (5 محاولات/دقيقة) |
| POST | `/api/v1/auth/refresh` | توكنات جديدة من الـ cookie |
| POST | `/api/v1/auth/logout` | إلغاء الـ refresh token ← 204 |
| GET | `/api/v1/users/me` | ملفي الشخصي |
| PATCH | `/api/v1/users/me` | تعديل ملفي |

### الـ Cookie
```python
response.set_cookie(
    key="refresh_token", value=tokens.refresh_token,
    path="/api/v1/auth",       # بتنبعت بس لروابط /auth، مش لكل طلب
    httponly=True,             # JavaScript ممنوع يقرأها ← حماية من XSS
    secure=settings.is_production,                       # HTTPS بس (بالـ production)
    samesite="none" if settings.is_production else "lax",
)
```
- **`httponly`**: لو حدا قدر يحقن JavaScript بالموقع (هجوم اسمه **XSS**)، ما بيقدر يسرق الـ refresh token.
- **`samesite`**: بيتحكم إمتى المتصفح بيبعت الـ cookie لموقع ثاني. بالـ production الفرونت إند على Vercel والباك إند على Railway (دومينين مختلفين)، فلازم `none` مع `secure`.

### Rate Limiting
```python
@auth_router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
```
أكثر من 5 محاولات بالدقيقة من نفس الـ IP ← **429**. بيصعّب على المهاجم يجرب كلمات سر كثيرة (**Brute Force**).

---

## 8️⃣ أول Migration

ملف `migrations/versions/20261018_3f1a9c2b7d4e_create_users_and_refresh_tokens.py` بينشئ الجدولين. فيه دالتين:
- **`upgrade()`**: بتنشئ الجداول
- **`downgrade()`**: بتحذفهم (بالترتيب المعاكس، لأنه `refresh_tokens` معتمد على `users`)

**ملاحظة صادقة:** هالملف كتبته بإيدي لأنه ما كان عندي قاعدة بيانات أشغّل عليها `--autogenerate`. فبنتحقق منه عندك بأمر `alembic check`، اللي بيقارن الـ migrations بالـ models وبيحكيلك إذا في أي فرق.

---

## 9️⃣ الاختبارات مع قاعدة بيانات حقيقية

### `conftest.py`
ملف خاص بـ pytest، أي **fixture** فيه بتصير متاحة لكل الاختبارات.

**`db_session`:**
1. أول مرة: بينشئ قاعدة بيانات اسمها `budgetbuddy_test` (منفصلة عن قاعدتك، فما بيخرب بياناتك)
2. بيفتح **transaction**
3. بيعطي الاختبار session
4. **بعد الاختبار: `rollback`**، فكل شي عمله الاختبار بيختفي

النتيجة: كل اختبار بيبلش بقاعدة نظيفة، والاختبارات ما بتأثر على بعض، وكل هاد سريع لأنه ما في حذف وإنشاء جداول مع كل اختبار.

**`join_transaction_mode="create_savepoint"`:** الكود اللي منختبره بيعمل `commit()`. بدون هالإعداد، الـ commit كان رح يثبّت البيانات فعلاً. معه، الـ commit بيصير "savepoint" جوا الـ transaction الكبيرة، واللي بنلغيها بالآخر.

**`client`:** عميل HTTP وهمي متصل بالتطبيق، وبيبدّل `get_db` بالـ `db_session` تبع الاختبار. وبيطفي الـ rate limiter (غير بالاختبار المخصص إله).

### شو بنختبر (23 اختبار)

**`test_security.py` (8):** التشفير، التوكنات، التوكن المعدّل، التوكن الموقّع بمفتاح ثاني، التوكن المنتهي...

**`test_auth.py` (15):**
- التسجيل بيرجّع توكن وبيحط cookie فيها `httponly`
- كلمة السر محفوظة مشفّرة
- الإيميل المكرر مرفوض، حتى لو بأحرف كبيرة
- البيانات الغلط ← 422
- رسائل الخطأ متطابقة للإيميل الغلط وكلمة السر الغلط
- الـ rate limiting بيوقف بعد 5 محاولات
- `/users/me` بدون توكن ← 401، ومع توكن بيرجّع الملف **بدون** `password_hash` و `id`
- الـ PATCH بيغير بس الحقول المبعوتة
- التجديد بيلغي القديم (rotation)
- **استخدام توكن قديم بيلغي كل الجلسات** (reuse detection)
- الخروج بيلغي التوكن

**لاحظ:** كل اختبار اسمه جملة بتوصف السلوك. لما يفشل اختبار، الاسم لحاله بيحكيلك شو اللي خرب.

---

## ▶️ كيف تشغّل المرحلة 2

```powershell
# 1. وقّف السيرفر القديم (Ctrl+C) وابني من جديد (في مكتبات جديدة)
cd C:\Users\MOHAMMED\budgetbuddy
docker compose up --build
```
لازم تشوف بالـ log سطر متل:
```
Running upgrade  -> 3f1a9c2b7d4e, create users and refresh_tokens tables
```

```powershell
# 2. بنافذة ثانية: تأكد إنه الـ migration مطابق للـ models
docker compose exec api alembic check
```
لازم يطلع: `No new upgrade operations detected.`

```powershell
# 3. الاختبارات (قاعدة البيانات لازم تكون شغالة)
cd C:\Users\MOHAMMED\budgetbuddy\backend
.venv\Scripts\activate
python -m pip install --timeout 120 -e ".[dev]"
python -m pytest -v
```
لازم يطلع: `25 passed` (2 health + 8 security + 15 auth)

### جرّبها بإيدك من `/docs`
1. افتح http://localhost:8000/docs
2. **`POST /auth/register`** ← Try it out ← حط إيميلك وكلمة سر ← Execute ← انسخ الـ `access_token`
3. فوق على اليمين اضغط **Authorize 🔒** ← الصق التوكن ← Authorize
4. **`GET /users/me`** ← Execute ← بتشوف ملفك
5. **`PATCH /users/me`** ← جرّب `{"secondary_currency": "USD"}`

---

## 🎤 أسئلة مقابلات عن المرحلة 2

**س: كيف بتحفظ كلمات السر؟**
ج: ما بحفظها أبداً. بحفظ hash بـ bcrypt، وهو بطيء عن قصد وفيه salt عشوائي لكل كلمة سر، فما بينفع معه brute force ولا rainbow tables. وعند الدخول بعمل hash لكلمة السر المدخلة وبقارن.

**س: شو الفرق بين Hashing و Encryption؟**
ج: الـ encryption باتجاهين وبينفك بمفتاح. الـ hashing باتجاه واحد وما في طريقة ترجّع القيمة الأصلية. كلمات السر لازم تكون hash لأنه حتى أنا كمطوّر ما لازم أقدر أعرفها.

**س: شو هو JWT؟ وهل هو مشفّر؟**
ج: توكن من header و payload و signature. الـ payload **مش مشفّر**، أي حدا بيقرأه، بس التوقيع بيمنع تعديله لأنه بيحتاج الـ secret key. فبحط فيه بس معرّف المستخدم ووقت الانتهاء، وما بحط أي معلومة سرية.

**س: ليش عندك Access Token و Refresh Token؟**
ج: الـ access token بينبعت مع كل طلب، فعمره 15 دقيقة لو انسرق. الـ refresh token بـ httpOnly cookie، بينبعت بس لـ `/auth/refresh`، وعمره 7 أيام، ومحفوظ hash تبعه بقاعدة البيانات فبقدر ألغيه. هيك بجمع بين الأمان وراحة المستخدم.

**س: شو هو Refresh Token Rotation و Reuse Detection؟**
ج: كل تجديد بيلغي التوكن القديم وبيعطي جديد. إذا وصلني توكن ملغى مرة ثانية، معناها حدا عم يعيد استخدامه (غالباً مسروق)، فبلغي كل جلسات المستخدم.

**س: كيف بتحمي تسجيل الدخول من الهجمات؟**
ج: bcrypt ضد سرقة القاعدة، rate limiting (5 بالدقيقة) ضد brute force، نفس رسالة الخطأ ونفس الوقت (dummy hash) ضد user enumeration، والـ refresh token بـ httpOnly cookie ضد XSS.

**س: ليش بترجع `UserRead` مش الـ model مباشرة؟**
ج: لأنه الـ schema بيحدد بالضبط شو بيطلع من الـ API، فمستحيل يتسرب `password_hash` أو الـ `id` الداخلي حتى لو حدا نسي.

**س: كيف بتختبر كود بيستخدم قاعدة البيانات؟**
ج: بقاعدة PostgreSQL حقيقية للاختبارات، كل اختبار جوا transaction بتنلغى بالآخر (rollback)، والـ commits جوا الكود بتصير savepoints. فالاختبارات معزولة وسريعة وبتستخدم نفس نوع قاعدة البيانات اللي بالـ production.

**س: شو الفرق بين 401 و 403؟**
ج: 401 يعني "ما بعرف مين إنت" (ما في توكن أو توكن غلط). 403 يعني "بعرفك بس ممنوع" (مثلاً حساب معطّل).

---

## ✅ نتيجة المرحلة 2 (أول تشغيل)

كل شي اشتغل من أول مرة:

- **الـ migration:** `Running upgrade  -> 3f1a9c2b7d4e, create users and refresh_tokens tables`
- **`alembic check`:** `No new upgrade operations detected.` ← الـ migration اللي انكتب بالإيد مطابق للـ models 100%
  - السطور `Detected sequence named 'users_id_seq' ... assuming SERIAL` طبيعية: PostgreSQL بيعمل عداد تلقائي (sequence) لعمود `id`، و Alembic بيعرف إنه هاد جزء من `SERIAL` فبيتجاهله
- **الاختبارات:** `25 passed in 5.07s`

**ليش الاختبارات أبطأ من المرحلة 1 (5 ثواني بدل 1)؟** لأنه bcrypt بطيء عن قصد، وكل اختبار بيسجل مستخدم بيعمل hash. وهاد دليل إنه الحماية شغالة 😄

### ملخص المرحلة 2
- [x] جدول `users` و `refresh_tokens` + أول migration
- [x] تشفير كلمات السر بـ bcrypt + حماية من timing attacks
- [x] JWT access tokens (15 دقيقة)
- [x] Refresh tokens بـ httpOnly cookie + rotation + reuse detection
- [x] Rate limiting على الدخول (5/دقيقة)
- [x] `/users/me` عرض وتعديل (العملات الست، اللغة)
- [x] `get_current_user`: بوابة أمان وحدة لكل التطبيق
- [x] 23 اختبار جديد على PostgreSQL حقيقية

**المرحلة الجاية (3):** الميزانية الشهرية، الفئات، تسجيل المصاريف، وتحويل العملات.


---
---

# المرحلة 3: قلب التطبيق 💰 (الميزانية، الفئات، المصاريف، العملات)

## 🎯 الهدف

بعد هالمرحلة الطالب بيقدر:
1. **يحط ميزانية الشهر** (مثلاً 10,000 ليرة لشهر 10)
2. **يقسمها على فئات** (أكل 4000، مواصلات 1500...)
3. **يسجل مصاريفه** بأي عملة من الست، والتطبيق بيحولها لعملة الميزانية
4. **يشوف ملخص الشهر**: قديش صرف، قديش ضل، وكل فئة قديش صرف فيها مقابل حدها
5. **يعمل فئات خاصة فيه** (مثلاً "قهوة") أو يأرشفها

وهيك بنحل أول 3 مشاكل بقصة المشروع: *"ما بيعرف وين بيروح مصروفه، ولا كيف يقسمه، ولا إذا رح يكفيه"*.

## 🗺️ الصورة الكبيرة: 3 domains جداد

```
                  ┌────────────── budget ──────────────┐
                  │  Category  ◀──  BudgetAllocation  ──▶  Budget (شهر واحد)
                  └─────▲──────────────────────────────┘
                        │
expense:          Expense ──(تحويل العملة)──▶ currency: ExchangeRate (cache)
```

| Domain | المسؤولية |
|---|---|
| **budget** | الفئات (افتراضية + خاصة)، ميزانية الشهر، حدود الفئات، ملخص الشهر |
| **expense** | تسجيل وتعديل وحذف وعرض المصاريف |
| **currency** | أسعار الصرف: جلبها، تخزينها مؤقتاً، والتحويل |

## 🗂️ الملفات

```
backend/app/
├── core/
│   ├── money.py        ✏️ Decimal + التقريب + أنواع المبالغ
│   └── dates.py        🆕 أدوات الشهر ("2026-10")
├── domain/
│   ├── budget/         🆕 model, defaults, schema, repository, service, router
│   ├── expense/        🆕 model, schema, repository, service, router
│   └── currency/       🆕 model, client, repository, service, router
├── models.py           ✏️ الجداول الجديدة
├── main.py             ✏️ 4 routers جداد
└── migrations/versions/20261018_8c4e2a7f9b13_...py   🆕 5 جداول + الفئات الافتراضية
tests/
├── fakes.py            🆕 مزود أسعار صرف وهمي
├── helpers.py          🆕 دوال مساعدة للاختبارات
├── test_money_dates.py 🆕  4 اختبارات
├── test_currency.py    🆕  6
├── test_categories.py  🆕  6
├── test_budgets.py     🆕  8
└── test_expenses.py    🆕  9
```

---

## 1️⃣ الفلوس: ليش `Decimal` مش `float`؟

جرّب ببايثون:
```python
>>> 0.1 + 0.2
0.30000000000000004
```
الكمبيوتر بيخزّن الـ `float` بالنظام الثنائي (0 و 1)، وفي أرقام عشرية ما بتنكتب بالضبط بالثنائي، متل ما 1/3 ما بتنكتب بالضبط بالعشري (0.333...). فرق صغير، بس مع آلاف العمليات بيتراكم، وبالفلوس **غير مقبول أبداً**.

**`Decimal`** بيخزّن الرقم العشري بالضبط:
```python
>>> Decimal("0.1") + Decimal("0.2")
Decimal('0.3')
```
(فيه اختبار اسمه `test_floats_are_why_we_use_decimal` بيثبت هالشي.)

### `core/money.py`
```python
CENTS = Decimal("0.01")

def to_money(value) -> Decimal:
    return Decimal(value).quantize(CENTS, rounding=ROUND_HALF_UP)

PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
```
- **`quantize(CENTS)`**: بيقرّب لخانتين عشريتين
- **`ROUND_HALF_UP`**: التقريب اللي بنعرفه من المدرسة (2.345 ← 2.35). الافتراضي ببايثون اسمه "Banker's rounding" وبيقرّب 2.345 لـ 2.34، وهاد بيلخبط المستخدم
- **`PositiveMoney`**: نوع جاهز بنستخدمه بكل الـ schemas: لازم أكبر من صفر، وخانتين عشريتين بالكثير، و12 رقم بالكثير. فلو حدا بعت `10.001` أو `-5` بياخد **422**
- **بقاعدة البيانات:** `Numeric(12, 2)` بدل `Float`، فالقاعدة كمان بتحفظ الرقم بالضبط
- **بالـ JSON:** المبالغ بتطلع كنص `"120.00"` مش رقم `120.0`، لأنه JavaScript نفسه بيستخدم float. الفرونت إند بيعرضها متل ما هي

### أسعار الصرف: 8 خانات
`to_rate()` بيقرّب لـ 8 خانات. ليش؟ لأنه سعر متل 1 ليرة = 0.02941176 دولار، لو قرّبناه لخانتين بيصير 0.03، وهاد خطأ 2% بكل تحويل.

---

## 2️⃣ الشهر: `core/dates.py`

الميزانية **لشهر**، فبنحفظ الشهر كتاريخ **أول يوم فيه**: شهر 10 = `2026-10-01`.

```python
MonthPath = Annotated[str, Path(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
```
- بالرابط بنكتب `/budgets/2026-10`. الـ **regex** بيقبل بس سنة 4 أرقام، وشهر من 01 لـ 12. فـ `2026-13` أو `october` ← **422** لحالها، قبل ما يوصل للكود
- **`next_month`**: بيحسب الشهر الجاي، ومع حالة خاصة لشهر 12 ← سنة جديدة (عليها اختبار)

**ليش بنبحث بـ `spent_at >= بداية الشهر AND spent_at < بداية الشهر الجاي`؟** بدل `<= آخر يوم بالشهر`. لأنه ما بنحتاج نعرف إذا الشهر 28 أو 30 أو 31 يوم. هالأسلوب اسمه **half-open interval** `[start, end)` وهو الأنظف للتواريخ.

---

## 3️⃣ الفئات (Categories)

### افتراضية + خاصة بنفس الجدول
```python
class Category(BaseModel):
    user_id: Mapped[int | None]   # NULL = افتراضية لكل الناس
    slug: Mapped[str | None]      # "food" للافتراضية بس
    name, icon, color
    is_archived: Mapped[bool]
```
- **8 فئات افتراضية** (أكل، مواصلات، دراسة، ترفيه، تسوق، صحة، فواتير، غير ذلك) بتنحط بالـ migration، و`user_id` تبعها فاضي، فكل الطلاب بيشوفوها
- **الفئات الخاصة** إلها `user_id`، وبس صاحبها بيشوفها
- **`slug`**: مفتاح ثابت بالإنجليزي. الفرونت إند بيستخدمه للترجمة: `food` ← "أكل" بالعربي، "Yemek" بالتركي
- **`icon`**: اسم أيقونة من مكتبة Lucide اللي رح نستخدمها بالفرونت إند

### "مين بيشوف شو" بسطر واحد
```python
def _visible_to(self, user_id):
    return or_(Category.user_id.is_(None), Category.user_id == user_id)
```
يعني: "الافتراضية **أو** تبعي أنا". وبنستخدمها بكل استعلام.

### الأرشفة بدل الحذف (Soft Delete)
لو الطالب حذف فئة "قهوة"، شو بصير بالمصاريف القديمة اللي فيها؟ بدل ما نحذفها، بنعمل `is_archived = True`: بتختفي من القوائم، بس المصاريف القديمة بتضل مربوطة فيها وبتنعرض صح.

### رموز الخطأ
- **409**: اسم مكرر (حتى لو بأحرف مختلفة: `food` = `Food`)
- **403**: محاولة تعديل فئة افتراضية ("بعرف إنها موجودة، بس ممنوع")
- **404**: محاولة تعديل فئة طالب ثاني. ليش مش 403؟ لأنه 403 بتعترف إنه الفئة **موجودة**، وهاد بحد ذاته تسريب معلومة. فبنحكي "مش موجودة"

---

## 4️⃣ الميزانية والحدود (Budget & Allocations)

```python
class Budget(BaseModel):
    __table_args__ = (UniqueConstraint("user_id", "month"),)   # ميزانية وحدة بالشهر
    user_id, month, total_amount
    currency     # بتتثبت وقت الإنشاء
    allocations  # الحدود

class BudgetAllocation(BaseModel):
    __table_args__ = (UniqueConstraint("budget_id", "category_id"),)
    budget_id, category_id, limit_amount
```

### قرار مهم: عملة الميزانية بتتثبت
لما الطالب بيعمل ميزانية شهر 10، عملتها = عملته الأساسية **بهديك اللحظة**. لو غيّر عملته الأساسية بنص الشهر، الميزانية ما بتتغير. ليش؟ لأنه كل مصاريف الشهر محوّلة لعملة الميزانية، ولو تغيرت، بيصير عندنا مبالغ بعملتين مخلوطين بنفس المجموع.

### `PUT` مش `POST`
`PUT /budgets/2026-10` بيعني "خلي ميزانية شهر 10 تكون هيك": إذا مش موجودة بيعملها، وإذا موجودة بيعدّلها. هالخاصية اسمها **Idempotent**: لو بعتت نفس الطلب 10 مرات، النتيجة نفسها. وهاد مناسب للموبايل لما النت يقطع ويعيد يبعت.

### القواعد (business rules) بـ `BudgetService`
- مجموع حدود الفئات ≤ الميزانية
- ما بتقدر تنزّل الميزانية تحت مجموع الحدود
- ما في فئة مكررة بنفس الخطة

### 🐛 فخ حقيقي: ترتيب الحذف والإضافة
تعديل الحدود = "امسح القديم وحط الجديد". الطبيعي نكتب:
```python
budget.allocations = new_allocations
```
**بس هاد بيعطي خطأ** لما تعيد نفس الفئة! لأنه SQLAlchemy بينفّذ الـ `INSERT` قبل الـ `DELETE` لنفس الجدول، فبيصير بلحظة صفين بنفس `(budget_id, category_id)` ← قيد `UNIQUE` بيعترض. الحل:
```python
budget.allocations.clear()      # علّم القديم للحذف
await self.session.flush()      # نفّذ الحذف هلأ
budget.allocations.extend(new_allocations)
```
اختبار `test_allocations_replace_the_plan` بيغطي هالحالة بالضبط.

### ملخص الشهر (`GET /budgets/2026-10`)
```json
{
  "month": "2026-10", "currency": "TRY",
  "total_amount": "10000.00", "allocated": "3000.00",
  "spent": "585.50", "remaining": "9414.50",
  "categories": [
    {"category": {"slug": "food", ...}, "limit_amount": "3000.00", "spent": "540.50"},
    {"category": {"slug": "transport", ...}, "limit_amount": null, "spent": "45.00"}
  ]
}
```
المجاميع بتنحسب **بقاعدة البيانات** مش ببايثون:
```python
select(Expense.category_id, func.sum(Expense.amount_base))
    .where(...).group_by(Expense.category_id)
```
بدل ما نجيب 500 مصروف ونجمعهم بلوب، قاعدة البيانات بتجمع وبترجّع سطر لكل فئة. أسرع بكثير. ولاحظ إنه الفئة اللي فيها مصروف **بدون حد** (المواصلات هون) بتظهر كمان، مع `limit_amount: null`.

---

## 5️⃣ المصاريف (Expenses)

```python
class Expense(BaseModel):
    amount, currency          # اللي دفعه فعلاً: 10 USD
    amount_base, fx_rate      # نفس المبلغ بعملة الميزانية: 340 TRY، بسعر 34
    description, spent_at, category
    categorized_by            # "user" هلأ، "ai" بالمرحلة 7
    ai_confidence
```

### Snapshot لسعر الصرف
لما الطالب بيسجل "10 دولار" بشهر 10، بنحفظ **السعر وقتها** (34). لو الدولار صار 36 بشهر 11، المصروف القديم **ما بيتغير**. لأنه الطالب فعلاً صرف 340 ليرة وقتها. نفس فكرة `OrderItem` بـ eWP اللي بيحفظ سعر المنتج وقت الشراء.

### لازم يكون في ميزانية للشهر (409)
مصروف بتاريخ 5/10 بيحتاج ميزانية لشهر 10، لأنه منها بنعرف لأي عملة نحوّل. إذا ما في، بنرجّع **409** برسالة واضحة: *"Set a budget for 2026-10 before adding expenses to it."*

### التعديل الذكي
```python
if changes.keys() & {"amount", "currency", "spent_at"}:
    # حوّل من جديد
```
إذا غيّرت الوصف بس، ما في داعي نحوّل. إذا غيّرت المبلغ أو العملة أو التاريخ (ممكن لشهر ثاني بعملة ثانية!) ← بنحوّل من جديد. الـ `&` هون هي **تقاطع مجموعات** (set intersection).

### 🔒 العزل بين المستخدمين
كل دالة بالـ repository بتاخد `user_id`:
```python
select(Expense).where(Expense.uuid == expense_uuid, Expense.user_id == user_id)
```
فلو بوب عرف الـ uuid تبع مصروف أليس، النتيجة **404**. اختبار `test_users_cannot_touch_each_others_expenses` بيجرب القراءة والتعديل والحذف والقائمة. هالثغرة اسمها **IDOR** (Insecure Direct Object Reference)، وهي من أشهر الثغرات بـ OWASP Top 10.

### الفهرس المركّب
```python
Index("ix_expenses_user_id_spent_at", "user_id", "spent_at")
```
تقريباً كل استعلام هو "مصاريف هالمستخدم بهالفترة". فهرس على العمودين سوا بيخلي قاعدة البيانات توصل للنتيجة مباشرة بدل ما تمر على كل المصاريف. متل فهرس كتاب مرتب حسب اسم الطالب وبعدين حسب التاريخ.

### القائمة: فلترة وترتيب وصفحات
`GET /expenses?month=2026-10&category_uuid=...&limit=50&offset=0`
- الأحدث أول
- **Pagination** (`limit` و `offset`): ما بنرجّع 2000 مصروف دفعة وحدة. الحد الأقصى 100 بالطلب

---

## 6️⃣ العملات: Cache مع Fallback

### الملفات الثلاثة
- **`client.py`**: الملف **الوحيد** اللي بيعرف شكل الـ API الخارجي (open.er-api.com). لو غيّرنا المزوّد، بنغير هالملف بس
- **`repository.py`**: بيحفظ الأسعار بجدول `exchange_rates`
- **`service.py`**: القرار: من وين نجيب السعر

### منطق القرار
```
1. في سعر بالقاعدة عمره أقل من 12 ساعة؟   ← استخدمه (بدون إنترنت)
2. لأ؟ اسأل المزوّد وخزّن الجواب
3. المزوّد واقع؟ في سعر قديم؟             ← استخدم القديم
4. ولا سعر أبداً؟                          ← 503
```
- **ليش Cache؟** المزوّد بيحدّث الأسعار مرة باليوم أصلاً. ما في داعي نسأله مع كل مصروف. أسرع، وما بنتجاوز حدود الاستخدام المجاني
- **ليش Fallback؟** سعر عمره يوم أحسن بكثير من إنه التطبيق يوقف. اسمه **Graceful Degradation**
- **العملات الخليجية** (درهم، ريال سعودي، قطري) مربوطة بالدولار، فأسعارها بالكاد بتتغير

### Upsert
```python
insert(ExchangeRate).values(rows).on_conflict_do_update(
    index_elements=["base", "quote"], set_={...})
```
"ضيف، وإذا موجود عدّل" بأمر SQL واحد. ميزة بـ PostgreSQL اسمها `ON CONFLICT`.

### `Decimal(str(rate))` مش `Decimal(rate)`
الـ JSON بيرجع الأرقام كـ float. `Decimal(0.1)` بيعطي `0.1000000000000000055511151231257827...`، لأنه بينسخ خطأ الـ float. التحويل لنص أول بيعطي `Decimal("0.1")` بالضبط.

### الاختبار بدون إنترنت: `FakeFxClient`
```python
app.dependency_overrides[get_fx_client] = lambda: fx
```
نفس فكرة المرحلة 1: الـ router **بيطلب** الـ client عن طريق `Depends(get_fx_client)`، فبالاختبار بنعطيه واحد وهمي بأسعار ثابتة (1 USD = 34 TRY). الفوائد:
- الاختبارات ما بتعتمد على النت ولا على أسعار اليوم، فنتيجتها دايماً نفسها
- بنقدر نحاكي "المزوّد واقع" (`fx.fail = True`) ونختبر الـ fallback
- بنعد كم مرة انطلب (`fx.calls`) لنتأكد إنه الـ cache شغال

---

## 7️⃣ الـ Migration الثاني

بينشئ 5 جداول، **وبيضيف الفئات الافتراضية** بـ `op.bulk_insert`.

**لاحظ:** الفئات الافتراضية **منسوخة** جوا ملف الـ migration، مش مستوردة من `defaults.py`. ليش؟ لأنه الـ migration لازم يعمل **نفس الشي للأبد**. لو بعد سنة غيّرنا `defaults.py`، ما بدنا قاعدة بيانات جديدة تطلع مختلفة عن القديمة.

**`down_revision = "3f1a9c2b7d4e"`**: هيك Alembic بيعرف إنه هاد بيجي بعد الـ migration الأول. سلسلة متل الـ commits بـ Git.

**تعديل صغير بـ `base.py`:** قاعدة تسمية الـ `UNIQUE` صارت تاخد **كل** الأعمدة: `uq_budgets_user_id_month` بدل `uq_budgets_user_id`. الأسماء القديمة (عمود واحد) ما تغيرت.

---

## 8️⃣ الـ Endpoints الجديدة

| Method | الرابط | شو بيعمل |
|---|---|---|
| GET | `/categories` | الافتراضية + الخاصة |
| POST | `/categories` | فئة جديدة |
| PATCH | `/categories/{uuid}` | تعديل فئتي |
| DELETE | `/categories/{uuid}` | أرشفة فئتي |
| GET | `/budgets/{month}` | ملخص الشهر |
| PUT | `/budgets/{month}` | حط/عدّل ميزانية الشهر |
| PUT | `/budgets/{month}/allocations` | حدود الفئات |
| POST | `/expenses` | مصروف جديد |
| GET | `/expenses?month=&category_uuid=&limit=&offset=` | القائمة |
| GET | `/expenses/{uuid}` | مصروف واحد |
| PATCH | `/expenses/{uuid}` | تعديل |
| DELETE | `/expenses/{uuid}` | حذف |
| GET | `/currency/rates?base=` | أسعار الصرف |

---

## ▶️ كيف تشغّل المرحلة 3

```powershell
cd C:\Users\MOHAMMED\budgetbuddy
docker compose up --build
```
دوّر على: `Running upgrade 3f1a9c2b7d4e -> 8c4e2a7f9b13`

```powershell
docker compose exec api alembic check
```
لازم: `No new upgrade operations detected.`

```powershell
cd backend
.venv\Scripts\activate
python -m pip install --timeout 120 -e ".[dev]"
python -m pytest
```
المتوقع: **`58 passed`**

**⚠️ ملاحظة:** قاعدة بيانات الاختبارات (`budgetbuddy_test`) فيها جداول المرحلة 2 بس. الـ conftest بيحذف وبيعيد إنشاء الجداول أول ما تشتغل الاختبارات، فما في شي لازم تعمله.

### جرّبها بإيدك من `/docs`
1. سجّل دخول وحط التوكن بـ **Authorize** (متل المرحلة 2)
2. `PUT /budgets/2026-10` ← `{"total_amount": "10000"}`
3. `GET /categories` ← انسخ الـ uuid تبع `food`
4. `POST /expenses` ← `{"amount": "15", "currency": "USD", "description": "Pizza", "category_uuid": "..."}`
   - لاحظ `amount_base` و `fx_rate` بالجواب: هاد **سعر حقيقي** من الإنترنت!
5. `GET /budgets/2026-10` ← شوف الملخص

---

## 🎤 أسئلة مقابلات عن المرحلة 3

**س: ليش ما بتستخدم float للفلوس؟**
ج: لأنه الـ float تقريب ثنائي، و `0.1 + 0.2` بيطلع `0.30000000000000004`. بستخدم `Decimal` ببايثون و `NUMERIC(12,2)` بقاعدة البيانات، وبقرّب بـ `ROUND_HALF_UP`، وبرجّع المبالغ بالـ JSON كنص عشان JavaScript ما يخرّبها.

**س: كيف بتتعامل مع عملات متعددة؟**
ج: كل مصروف بينحفظ بعملته الأصلية، ومحوّل لعملة ميزانية الشهر مع سعر الصرف وقتها (snapshot). هيك المجاميع دايماً بعملة وحدة، وتغير الأسعار بعدين ما بيغير التاريخ.

**س: شو بيصير إذا API أسعار الصرف وقع؟**
ج: الأسعار مخزّنة بقاعدة البيانات 12 ساعة. إذا المزوّد وقع، بستخدم آخر سعر عندي حتى لو قديم. وإذا ما في أي سعر، برجّع 503 بس للمصاريف بعملة أجنبية؛ المصاريف بنفس العملة بتشتغل عادي.

**س: كيف بتمنع مستخدم يشوف بيانات غيره؟**
ج: كل استعلام بالـ repository فيه `user_id` إجباري، فما في طريقة تجيب بيانات بدونه. ولما حدا يطلب شي مش إله برجّع 404 مش 403، عشان ما أأكدله إنه موجود. وعندي اختبارات بتجرب القراءة والتعديل والحذف من مستخدم ثاني.

**س: ليش بتجمع المصاريف بقاعدة البيانات مش ببايثون؟**
ج: `SUM ... GROUP BY` بيرجّع سطر لكل فئة بدل كل المصاريف. أقل بيانات بتنتقل وأسرع، وقاعدة البيانات مصممة لهالشغلة.

**س: شو هو الـ index المركب وليش عملته؟**
ج: فهرس على `(user_id, spent_at)` لأنه أغلب الاستعلامات "مصاريف مستخدم بفترة". الترتيب مهم: الأول بيفلتر المستخدم، والثاني بيرتب بالتاريخ جواه.

**س: كيف بتختبر كود بيعتمد على API خارجي؟**
ج: بـ dependency injection. الكود بياخد الـ client من `Depends`، فبالاختبار ببدّله بـ fake بأسعار ثابتة. الاختبارات ما بتحتاج نت، ونتيجتها ثابتة، وبقدر أحاكي إنه المزوّد واقع.

**س: احكيلي عن فخ بـ SQLAlchemy انتبهت إله.**
ج: لما بدّل قائمة حدود الفئات كلها، SQLAlchemy بينفّذ الـ INSERT قبل الـ DELETE لنفس الجدول، فلو الفئة نفسها انعادت بيصير تعارض مع قيد UNIQUE. الحل إني أمسح القديم وأعمل `flush` قبل ما أضيف الجديد، وكتبت اختبار بيغطي هالحالة بالضبط.

---

## ✅ نتيجة المرحلة 3 (أول تشغيل)

```
collected 58 items
58 passed, 4 warnings in 11.44s
```

كل الاختبارات نجحت من أول مرة. بس طلع **4 تحذيرات**، وهون درس مهم:

### التحذيرات (Warnings) مش أخطاء، بس ما بتتجاهل
```
StarletteDeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated.
Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead.
```
- **Deprecated** يعني "لسا شغال، بس رح ينشال بنسخة جاية". لو تجاهلناه، يوم من الأيام رح نحدّث المكتبات والكود رح يخرب فجأة
- **ليش تغيّر الاسم؟** مواصفات HTTP الجديدة (RFC 9110) سمّت الرمز 422 "Unprocessable **Content**" بدل "Unprocessable **Entity**"، فمكتبة Starlette (اللي FastAPI مبني عليها) لحقت التسمية الجديدة
- **الحل:** بدّلنا الاسم بـ 3 ملفات (`core/dates.py`، `budget/service.py`، `expense/service.py`)، ورفعنا الحد الأدنى لـ FastAPI لـ `>=0.118` لأنه الاسم الجديد موجود بس بالنسخ الحديثة. لو ما رفعناه، حدا عنده نسخة قديمة كان رح ياخد خطأ `AttributeError`

> **القاعدة:** خلّي مخرجات الاختبارات **نظيفة**: لا أخطاء ولا تحذيرات. لأنه لما يكون في 50 تحذير قديم، ما حدا بينتبه للتحذير رقم 51 اللي ممكن يكون مهم.

### ملخص المرحلة 3
- [x] 8 فئات افتراضية + فئات خاصة مع أرشفة
- [x] ميزانية شهرية (وحدة بالشهر) بعملة ثابتة
- [x] حدود الفئات مع التحقق من المجاميع
- [x] تسجيل وتعديل وحذف المصاريف بفلترة وصفحات
- [x] 6 عملات مع cache وfallback وsnapshot لسعر الصرف
- [x] ملخص الشهر بمجاميع محسوبة بقاعدة البيانات
- [x] عزل كامل بين المستخدمين (حماية من IDOR)
- [x] 33 اختبار جديد (المجموع 58)

**المرحلة الجاية (4):** الفرونت إند! Next.js، صفحات الدخول والتسجيل، وتسجيل المصاريف ← أول نسخة كاملة شغالة (MVP).


---
---

# المرحلة 4: الفرونت إند 🎨 (أول نسخة كاملة شغالة: MVP)

## 🎯 الهدف
لأول مرة الطالب بيستخدم التطبيق من المتصفح، مش من `/docs`:
- يعمل حساب ويسجل دخول، ويضل مسجّل حتى لو عمل refresh للصفحة
- يحط ميزانية الشهر
- يسجل مصاريفه ويعدّلها ويحذفها
- يشوف قديش ضل معه، وهل هو ماشي صح مع الأيام
- يقسم الميزانية على فئات

---

## 🛠️ قصة تنصيب Next.js: أطول debugging لحد هلأ (ودرس مهم)

| المحاولة | شو عملنا | النتيجة |
|---|---|---|
| 1 | `create-next-app` عادي | `ECONNRESET` + `EPERM` |
| 2 | retries أكثر + فصلنا الإنشاء (`--skip-install`) عن التنزيل | الإنشاء نجح ✅، التنزيل فشل |
| 3 | `maxsockets 3` (اتصالات أقل بنفس الوقت) | فشل |
| 4 | **قرأنا الـ log** | 🔍 اكتشفنا إنه npm بينزّل من **`registry.npmmirror.com`** (سيرفر بالصين!) بدل السيرفر الرسمي |
| 5 | `npm config set registry https://registry.npmjs.org/` | 507 طلب نجحوا، بس ملف وحد فشل |
| 6 | **قرأنا الـ log الجديد** | 🔍 الملف هو `next-16.4.2.tgz` (44 ميغا) |
| 7 | نزّلناه **بالمتصفح** وحطيناه بالـ cache: `npm cache add` | ✅ `added 381 packages` |

### شو تعلمنا
1. **`EPERM` كان عَرَض مش سبب.** لما التنصيب فشل، npm حاول يمسح الملفات، و Windows Defender كان فاتحها. لو ركزنا عليه كنا ضيّعنا وقت
2. **3 محاولات على عمى ما نفعوا. قراءة الـ log دقيقة وحدة كشفت السبب.** نفس درس Docker بالمرحلة 1، بس هالمرة تعلمناه بالطريقة الصعبة
3. **إعدادات قديمة مخفية** ممكن تخرّب شغلك: الـ registry الصيني انحط بجهازك من زمان (أداة أو مشروع قديم)، وما كان باين إلا بالـ log. أمر مفيد: `npm config list` بيورجيك كل الإعدادات
4. **Integrity check:** npm قبل الملف اللي نزّلناه بالمتصفح لأنه **بصمته (hash) طابقت** البصمة المسجلة بالسيرفر. فما في خطر إنه يكون ملف معدّل

> جواب ممتاز لسؤال *"كيف بتعمل debugging؟"*: "بجمع معلومات قبل ما أغيّر شي. مرة جربت 3 حلول على عمى وما نفعوا، وبعدها قريت الـ log وطلع إنه الـ npm registry معدّل لسيرفر بالصين..."

---

## 🧱 Next.js 16: شو الجديد
النسخة اللي انتنزلت (16.4) أحدث من كثير من الدروس الموجودة أونلاين، وفيها ملف اسمه `AGENTS.md` بيحكي: *"هاد مش Next.js اللي بتعرفه، اقرأ التوثيق بـ `node_modules/next/dist/docs/` قبل ما تكتب كود"*. فقريت التوثيق المرفق مع المكتبة نفسها، وهاد أهم شي تعلمه: **التوثيق الرسمي للنسخة اللي عندك أصدق من أي tutorial**.

أهم نقطتين أثرت علينا:
- **`cacheComponents: true`** مفعّل افتراضياً: Next.js بيحاول يجهّز الصفحات مسبقاً على السيرفر. فأي كود بيقرأ "الوقت الحالي" (`new Date()`) لازم ما ينفّذ خلال هالتجهيز. حلّيناها بإنه كل الصفحات اللي بتحتاج التاريخ ما بتنعرض إلا بعد ما نتأكد من تسجيل الدخول (بالمتصفح)
- **`middleware` صار اسمه `proxy`**. ما استخدمناه، لأنه الـ refresh cookie تابعة لدومين الباك إند، فالفرونت إند ما بيقدر يشوفها بالسيرفر

---

## 🗂️ هيكلة الفرونت إند

```
frontend/src/
├── app/                         ← الصفحات (App Router)
│   ├── layout.tsx               ← الخطوط + Providers
│   ├── providers.tsx            ← React Query + Motion + Auth + Toaster
│   ├── globals.css              ← الألوان والخطوط (design tokens)
│   ├── page.tsx                 ← "/" بتحوّل لـ /overview
│   ├── (auth)/                  ← صفحات بدون sidebar
│   │   ├── layout.tsx           ← شاشة مقسومة: الفورم + مثال للـ tank
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (app)/                   ← صفحات محمية بـ sidebar
│       ├── layout.tsx           ← AppShell
│       ├── overview/page.tsx
│       ├── expenses/page.tsx
│       └── budget/page.tsx
├── components/
│   ├── auth/                    ← AuthProvider, AuthGate, AuthForm
│   ├── layout/                  ← AppShell, MonthProvider
│   ├── overview/                ← BudgetTank, CategoryBreakdown, BudgetSetup
│   ├── expense/                 ← ExpenseSheet, ExpenseRow
│   ├── budget/                  ← BudgetPlan
│   └── ui/                      ← Button, Field, CategoryIcon, PageLoader, LoadError
├── services/                    ← كل اتصال بالـ API (auth, budget, expenses)
├── hooks/queries.ts             ← React Query hooks
├── lib/                         ← api.ts, errors.ts, money.ts, month.ts
└── types/api.ts                 ← أنواع TypeScript لكل رد من الـ API
```

**`(auth)` و `(app)` بين قوسين** اسمها **Route Groups**: الأقواس ما بتظهر بالرابط (`/login` مش `/(auth)/login`)، بس بتخلي كل مجموعة صفحات إلها layout خاص فيها. نفس نمط eWP.

**الطبقات بالفرونت إند** (نفس فكرة الباك إند):
```
صفحة (page.tsx) → hook (useSummary) → service (getSummary) → lib/api.ts (axios) → الباك إند
```
الصفحة ما بتعرف شي عن axios أو الروابط. لو تغيّر رابط بالـ API، بنعدّل بـ `services/` بس.

---

## 1️⃣ `lib/api.ts`: قلب الاتصال

### وين بنحفظ الـ access token؟ **بالذاكرة بس**
```ts
let accessToken: string | null = null;
```
**مش بـ `localStorage`**. ليش؟ لو حدا قدر يحقن JavaScript بالصفحة (XSS)، بيقرأ `localStorage` بسطر واحد. المتغير بالذاكرة أصعب بكثير. والسعر: لما تعمل refresh للصفحة، التوكن بيروح. بس مش مشكلة، لأنه الـ refresh cookie موجودة، فبنطلب توكن جديد أوتوماتيكياً.

### `withCredentials: true`
بيخلي axios يبعت الـ cookies مع الطلبات للباك إند (موجود على port ثاني). بدونه، الـ refresh cookie ما بتنبعت.

### Interceptors: كود بيشتغل مع **كل** طلب
- **Request interceptor:** بيحط `Authorization: Bearer ...` أوتوماتيكياً. ما في صفحة لازم تتذكر تحطه
- **Response interceptor:** إذا الرد **401** (التوكن خلص): بيطلب توكن جديد، وبيعيد **نفس الطلب** مرة وحدة. المستخدم ما بيحس بشي

### 🔑 Single-flight refresh (أهم فكرة بالملف)
```ts
let refreshInFlight: Promise<string | null> | null = null;
export function refreshAccessToken() {
  refreshInFlight ??= api.post("/auth/refresh")...finally(() => { refreshInFlight = null });
  return refreshInFlight;
}
```
**المشكلة:** صفحة الـ overview بتعمل طلبين بنفس الوقت (الملخص والمصاريف). لو التوكن خلص، الاثنين بياخدوا 401، والاثنين بيطلبوا refresh **بنفس الـ cookie**. تذكر من المرحلة 2: الباك إند بيعتبر استخدام نفس الـ refresh token مرتين **سرقة**، وبيلغي كل الجلسات! فالمستخدم كان رح يطلع من حسابه بدون سبب.

**الحل:** أول طلب بيبلش الـ refresh وبيحفظ الـ Promise. أي طلب ثاني بيلاقي Promise موجود، **فبيستنى نفسه** بدل ما يعمل واحد جديد. `??=` معناها "إذا فاضي، حط هالقيمة".

هيك الفرونت إند والباك إند صمموا **مع بعض**: ميزة الأمان بالباك إند (reuse detection) فرضت تصميم معين بالفرونت إند.

---

## 2️⃣ `AuthProvider`: مين مسجّل دخول؟

**React Context** = طريقة لمشاركة بيانات مع **كل** الشاشات بدون ما نمررها من component لـ component. `useAuth()` بأي مكان بيعطيك `status`، `user`، `login`، `register`، `logout`.

**3 حالات:** `loading` (لسا ما بنعرف) ← `authenticated` أو `anonymous`

**أول ما تفتح التطبيق:**
1. `refreshAccessToken()` ← إذا في cookie صالحة بناخد توكن
2. `GET /users/me` ← بنجيب بيانات الطالب
3. الحالة بتصير `authenticated`

**فخ React StrictMode:** بوضع التطوير، React بيشغّل الـ `useEffect` **مرتين** عن قصد (ليكشف الأخطاء). يعني طلبين refresh = reuse detection = طرد! الحل: `restoring` متغير على مستوى الملف، فالـ effect الثاني بيلاقي نفس الـ Promise.

**`logout` بيعمل `queryClient.clear()`:** بيمسح كل البيانات المحفوظة. وإلا لو حدا ثاني سجل دخول على نفس الجهاز، كان ممكن يشوف للحظة مصاريف اللي قبله.

**حماية الصفحات:**
- `AppShell`: إذا `anonymous` ← `/login`
- `AuthGate`: إذا `authenticated` وإنت بصفحة الدخول ← `/overview`

---

## 3️⃣ React Query: البيانات من السيرفر

بدل ما كل صفحة تعمل `useEffect` + `fetch` + `useState` للتحميل والخطأ، React Query بيعمل كل هاد:
```ts
const summary = useSummary(month);
summary.isPending   // عم يحمّل
summary.isError     // صار خطأ
summary.data        // البيانات
```
**الميزات:**
- **Cache:** لو رحت من الـ overview للمصاريف ورجعت، البيانات بتطلع فوراً
- **Query keys:** `["summary", "2026-10"]`. كل شهر إله cache منفصل
- **Invalidation:** بعد ما تضيف مصروف:
  ```ts
  queryClient.invalidateQueries({ queryKey: ["summary"] });
  queryClient.invalidateQueries({ queryKey: ["expenses"] });
  ```
  يعني "كل الملخصات والقوائم صارت قديمة، جيبها من جديد". فالـ tank والقائمة بيتحدثوا لحالهم. ولأنه المفتاح `["summary"]` بدون شهر، بيمسك **كل** الأشهر (مثلاً لو غيّرت تاريخ مصروف من شهر لشهر)
- **`setQueryData`:** لما نحفظ الميزانية، الباك إند بيرجّع الملخص الجديد، فبنحطه بالـ cache مباشرة بدل طلب إضافي

---

## 4️⃣ التصميم: ليش شكله هيك؟

### الفكرة: "الخزان" (The Tank) ⛽
المشكلة الأساسية للطالب مش "قديش صرفت"، هي **"هل رح يكفيني لآخر الشهر؟"**. فالعنصر الأساسي بالـ overview شريط كبير:
- **التعبئة** = قديش صرفت من الميزانية
- **خط "Today"** = وين نحنا من الشهر (يوم 16 من 31 = 52%)
- **إذا التعبئة قبل الخط** ← ماشي صح (أخضر)
- **إذا التعبئة تجاوزت الخط** ← عم تصرف أسرع من مرور الأيام (برتقالي)
- **إذا صرفت أكثر من الميزانية** ← أحمر

ومع جملة واضحة: *"On pace. That's about TRY 273 a day for the 15 days left."* الطالب بيعرف فوراً شو لازم يعمل، بدون ما يحسب.

### قرارات التصميم
| القرار | ليش |
|---|---|
| ألوان هادية (أخضر صنوبري على رمادي مخضر فاتح) | المصاري مصدر توتر للطالب، فالواجهة لازم تريّح |
| 3 ألوان بمعنى ثابت: أخضر = تمام، برتقالي = انتبه، أحمر = تجاوزت | اللون معلومة مش زينة |
| خطّين: **Bricolage Grotesque** للعناوين والأرقام، **Instrument Sans** للنص | الرقم الكبير هو بطل الشاشة، فإله خط بشخصية |
| `tabular-nums` للأرقام | الأرقام بتصطف فوق بعض بالقوائم |
| أنيميشن وحيد عند التحميل (تعبئة الخزان) + أنيميشن للـ sheet لما تفتحه | الحركة بتلفت الانتباه، فبنستخدمها بس للشي المهم أو كرد على فعل المستخدم |
| زر "Add expense" عائم دايماً | أكثر شي بيعمله الطالب، فلازم يكون بضغطة وحدة من أي صفحة |
| Sheet من تحت على الموبايل | الإبهام بيوصل بسهولة |

### إمكانية الوصول (Accessibility)
- **`role="meter"`** على الخزان مع `aria-valuetext`: قارئ الشاشة بيقرأ "TRY 3,900 spent of TRY 8,000"
- **`:focus-visible`**: إطار واضح للي بيستخدم الكيبورد
- **`MotionConfig reducedMotion="user"`** و `useReducedMotion`: إذا الشخص مفعّل "تقليل الحركة" بالويندوز، الأنيميشن بيوقف
- **`role="dialog"` و `aria-modal`** للـ sheet، و**Escape** بيسكّره
- **`role="radiogroup"`** لاختيار الفئة
- **`role="alert"`** لرسائل الخطأ

---

## 5️⃣ أشياء صغيرة بس مهمة

- **الفلوس كنص:** الـ API بيرجّع `"120.50"`. بنستخدم `Number()` **للعرض بس**، وما بنحسب فيها شي مهم. الحسابات الحقيقية بالباك إند بـ `Decimal`
- **`formatMoney`:** بيستخدم `Intl.NumberFormat` (مدمج بالمتصفح): `TRY 3,900` أو `TRY 12.50`، والكسور بس إذا موجودة
- **`replace(",", ".")`** بحقول المبالغ: إذا الكيبورد بيكتب فاصلة عشرية (متل التركي)، بتتحول لنقطة
- **`inputMode="decimal"`:** الموبايل بيفتح كيبورد الأرقام
- **`errorMessage()`:** بيحوّل أي خطأ من الـ API لجملة وحدة واضحة. مثلاً خطأ 422 من Pydantic بيصير "Password: String should have at least 8 characters"
- **CategoryIcon:** الباك إند بيحفظ اسم الأيقونة (`"utensils"`)، والفرونت إند بيحوّله لأيقونة من Lucide، مع خلفية فاتحة من نفس لون الفئة
- **`.env.local`:** فيه رابط الـ API. ملفات `.env*` ممنوعة من GitHub، فضفنا `!.env.example` لـ `.gitignore` عشان النموذج بس يترفع

## ✅ الفحص اللي عملته قبل ما أسلّمك
- `tsc --noEmit` (TypeScript): **0 أخطاء**
- `eslint`: **0 تحذيرات**

(شغّلتهم على جهازك عن طريق الربط، لأنه المكتبات منزلة عندك.)

---

## 🧪 التجربة الحقيقية بالمتصفح (End-to-End)

فتحت التطبيق بمتصفح Claude على جهازك، وعملت حساب تجريبي، وجرّبت كل شاشة مثل ما الطالب رح يستخدمها. هاد اسمه **End-to-End test**: بنجرب المسار كامل من الواجهة لقاعدة البيانات ونرجع.

### شو جرّبت ✅
| الخطوة | النتيجة |
|---|---|
| تسجيل حساب جديد | ✅ دخل مباشرة على Overview |
| إيميل بدومين محجوز (`.test`) | ✅ رسالة خطأ واضحة من الباك إند (422) |
| تحديد ميزانية أكتوبر 8000 TRY | ✅ ظهر الخزان وخط "Today" |
| مصروف 85,50 TRY (بفاصلة!) | ✅ الفاصلة تحولت لنقطة، والمبلغ انطرح |
| مصروف 15 USD | ✅ تحوّل لـ TRY بسعر الصرف الحقيقي، وبيظهر المبلغين |
| تعديل مصروف (85.50 → 95) | ✅ الفورم انفتح معبّى، والمجموع اتحدّث |
| حذف مصروف (ضغطتين للتأكيد) | ✅ |
| حدود الفئات (Food 2500، Transport 1500، Bills 2000) | ✅ "Planned 6,000 of 8,000" بيتحدّث وانت عم تكتب |
| فئة تعدّت حدها | ✅ الشريط صار أحمر (berry) |
| Refresh للصفحة | ✅ ضل مسجّل دخول (الـ refresh cookie اشتغل) |
| تسجيل خروج ← كلمة سر غلط ← كلمة سر صح | ✅ "Incorrect email or password." ثم دخول |

### 🐛 المشاكل اللي لقيتها وكيف حليتها

**1) خطأ Next.js: "Could not validate that a segment has instant navigation"**
- **السبب:** Next.js 16 مع `cacheComponents` بيفحص كل صفحة: هل التنقل إلها "فوري"؟ بس كل صفحاتنا بتستنى المتصفح يرجّع الجلسة من الـ cookie قبل ما ترسم، فـ Next ما قدر يرسمها بالفحص.
- **أول محاولة:** `export const instant = false` على الـ layouts. **ما زبطت**، لأنه الوثائق بتقول إنه بالإعداد الافتراضي **كل صفحة** بتنفحص لحالها.
- **الحل:** بـ `next.config.ts`:
```ts
experimental: {
  instantInsights: { validationLevel: "manual-warning" },
},
```
يعني: افحص بس الصفحات اللي بتطلب الفحص صراحة (`export const instant = true`). لما نخلّي صفحات معينة فورية بالمستقبل، منضيفها عليها.
- **الدرس:** قرأت الوثائق اللي جاية مع Next نفسه (`node_modules/next/dist/docs`) لأنه هاي نسخة جديدة، وما اعتمدت على الذاكرة.

**2) "Can't reach BudgetBuddy's server" مع إنه الـ API شغال**
- **التشخيص:** فتحت `localhost:8000/api/v1/health` مباشرة ← `{"status":"ok"}`. يعني السيرفر تمام، والمشكلة بالطريق بين المتصفح والسيرفر: المتصفح كان مانع الطلبات من `localhost:3000` لـ `localhost:8000` لأنهم **موقعين مختلفين (origins)**.
- **الحل (وهو أحسن تصميم أصلاً):** خلّينا Next.js يعمل **proxy**: المتصفح بيطلب `/api/v1/...` من نفس الموقع، وNext بيحوّل الطلب للـ FastAPI:
```ts
async rewrites() {
  return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
},
```
- **ليش أحسن؟**
  - ما في CORS ولا طلبات preflight (`OPTIONS`) قبل كل طلب
  - الـ refresh cookie صار **first-party** (من نفس الموقع). المتصفحات صارت تمنع الـ third-party cookies، فهاد بيحمينا بالـ production كمان
  - رابط الـ API صار إعداد بالسيرفر (`API_ORIGIN`) مش بالمتصفح
- **تغيير بـ `.env.local`:** صار `NEXT_PUBLIC_API_URL=/api/v1` و`API_ORIGIN=http://localhost:8000`

**3) حقل المبلغ: إطار الـ focus كان حوالين الـ input لحاله، والـ "TRY" طالعة برّا**
- **السبب:** بـ Tailwind v4، أي CSS **برّا** `@layer` بيغلب كل الـ utility classes. قاعدة `:focus-visible` العامة تبعنا كانت برّا، فـ `outline-none` على الـ input ما كان إلها تأثير.
- **الحل:** حطيناها جوّا `@layer base`، وصار الإطار (ring) على الصندوق كامل (`focus-within:ring-3`).
- **الدرس:** ترتيب الـ CSS (cascade layers) أهم من ترتيب الملفات.

**4) زر "Add expense" ظاهر قبل ما يكون في ميزانية**
- لو ضغطه الطالب كان رح ياخد خطأ 409. هلأ الزر ما بيظهر إلا لما الشهر يكون إله ميزانية. ونفس الـ query تبع الملخص، فما في طلب زيادة للسيرفر (React Query cache).

**5) الصفحة ورا الـ sheet كانت عم تتحرك (scroll)**
- قفلنا الـ scroll تبع `body` وقت ما الـ sheet مفتوح، ورجّعناه لما يتسكّر (بالـ cleanup تبع `useEffect`).

**6) "8000.00" بحقل الميزانية**
- الـ API بيرجّع المبالغ كنص بخانتين عشريتين. ضفنا `toInputAmount()` بتشيل `.00` عشان الحقل يبين متل ما الإنسان بيكتب.

**7) الفئة اللي تعدّت حدها كانت بس "لون أحمر"**
- حوالي 8% من الرجال عندهم عمى ألوان. ضفنا نص: **"TRY 150 over the limit"** أو **"Only TRY 300 left"**. القاعدة: **لا تعتمد على اللون لحاله لتوصيل معلومة.**

**8) زر "Add expense" العائم كان يغطي آخر سطر**
- زدنا المسافة تحت المحتوى (`pb-44` بالموبايل، `lg:pb-32` بالكمبيوتر).

**9) خطأ eslint قديم:** `what's` جوّا JSX لازم تنكتب `what&apos;s`.

### 🎤 أسئلة مقابلات
- **ليش عملت proxy للـ API بدل ما تخلي المتصفح يحكي معه مباشرة؟**
  عشان يصير same-origin: ما في CORS، والـ cookie تبع الجلسة first-party، والـ backend مخفي ورا الفرونت إند. بالـ production ممكن نحط الاتنين ورا نفس الدومين.
- **شو الفرق بين unit test و end-to-end test؟**
  الـ unit test بيفحص قطعة صغيرة لحالها (مثلاً `to_money`). الـ E2E بيفحص المسار كامل مثل المستخدم: واجهة ← API ← قاعدة بيانات ← واجهة. الـ E2E بيلقى مشاكل ما بتبين بالـ unit tests، متل مشكلة الـ origins اللي لقيناها.
- **كيف بتشخّص "Can't reach server"؟**
  بقسم الطريق لنصين: أول شي بجرب السيرفر لحاله (`/health`). إذا شغال، المشكلة بالطريق (CORS، origins، رابط غلط، شبكة). هاد اسمه **divide and conquer**.

### ملخص المرحلة 4
- [x] Next.js 16 + TypeScript + Tailwind v4 + React Query
- [x] تسجيل ودخول وخروج، والجلسة بتضل بعد الـ refresh
- [x] الخزان (Budget Tank) مع خط "Today"
- [x] إضافة وتعديل وحذف المصاريف بـ 6 عملات
- [x] حدود الفئات مع تحذير بالنص واللون
- [x] موبايل (bottom nav) وكمبيوتر (sidebar)
- [x] proxy للـ API (same-origin)
- [x] tsc + eslint نظيفين، وتجربة E2E كاملة بالمتصفح

**المرحلة الجاية (5):** Dashboard بالرسومات البيانية والتنبيهات.

