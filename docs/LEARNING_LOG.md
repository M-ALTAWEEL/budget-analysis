# 📘 BudgetBuddy: سجل التعلّم

هاد الملف بيشرح كل شي انعمل بالمشروع: كل ملف، كل سطر مهم، وكل قرار وليش أخذناه.
كل مرحلة إلها قسم. ارجعله وقت ما بدك تعدّل على المشروع أو تتحضّر لمقابلة عمل.

**فهرس المراحل**

| المرحلة | الموضوع | الحالة |
|---|---|---|
| 1 | تجهيز المشروع، Docker، قاعدة البيانات، أول endpoint | ✅ |
| 2 | قاعدة البيانات وتسجيل الدخول (Auth) | ⏳ |
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
pip install -e ".[dev]"
pytest
ruff check .
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
