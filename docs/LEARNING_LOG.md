# 📘 BudgetBuddy: سجل التعلّم

هاد الملف بيشرح كل شي انعمل بالمشروع: كل ملف، كل سطر مهم، وكل قرار وليش أخذناه.
كل مرحلة إلها قسم. ارجعله وقت ما بدك تعدّل على المشروع أو تتحضّر لمقابلة عمل.

**فهرس المراحل**

| المرحلة | الموضوع | الحالة |
|---|---|---|
| 1 | تجهيز المشروع، Docker، قاعدة البيانات، أول endpoint | ✅ |
| 2 | قاعدة البيانات وتسجيل الدخول (Auth) | 🔨 |
| 3 | الميزانية، الفئات، المصاريف، العملات | ⏳ |
| 4 | الواجهة: الدخول والمصاريف (MVP) | ⏳ |
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
