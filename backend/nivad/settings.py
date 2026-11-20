"""Django settings for the Nivad Kanon project."""
import os
from pathlib import Path

# مسیرهای پایه: BASE_DIR پوشه‌ی backend و FRONTEND_DIR ریشه‌ی پروژه (شامل فایل‌های سایت و داشبورد) است.
BASE_DIR = Path(__file__).resolve().parent.parent      # .../backend
FRONTEND_DIR = BASE_DIR.parent                          # project root (index.html, dashboard/, ...)


# خواندن متغیرهای محیطی از فایل .env (بدون نیاز به پکیج اضافه).
def _load_env_file():
    """Tiny .env loader so no extra package is needed."""
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


# بارگذاری .env قبل از خواندن بقیه‌ی تنظیمات.
_load_env_file()

# حالت توسعه (DEBUG)؛ در محیط واقعی حتماً باید با DJANGO_DEBUG=0 خاموش شود.
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# کلید مخفی جنگو؛ در حالت DEBUG یک کلید ناامن موقت استفاده می‌شود،
# اما در محیط واقعی تنظیم‌نکردن آن باعث خطا می‌شود تا کلید ضعیف به‌اشتباه منتشر نشود.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-only-insecure-key"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0")

# دامنه‌ها/آدرس‌های مجاز برای دسترسی به سایت (جداشده با ویرگول در متغیر محیطی).
ALLOWED_HOSTS = [h.strip() for h in os.environ.get(
    "DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h.strip()]

# اپ‌های نصب‌شده: اپ‌های داخلی جنگو + اپ اصلی پروژه (core).
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

# میدل‌ورها؛ به ترتیب روی هر درخواست اجرا می‌شوند (امنیت، نشست، CSRF، احراز هویت و ...).
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# فایل اصلی مسیرها (URL) پروژه.
ROOT_URLCONF = "nivad.urls"


TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

# نقطه‌ی ورود WSGI برای سرور واقعی.
WSGI_APPLICATION = "nivad.wsgi.application"


def _ensure_mysql_database(db_name, user, password, host, port):
    """در صورت نصب بودن PyMySQL و در دسترس بودن سرور MySQL، دیتابیس را در صورت نبودن خودکار می‌سازد."""
    try:
        import pymysql
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=int(port or 3306),
            charset="utf8mb4",
            connect_timeout=2,
        )
        with conn.cursor() as cursor:
            safe_name = db_name.replace("`", "")
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{safe_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        conn.close()
    except Exception:
        pass


# انتخاب پایگاه داده: پیش‌فرض MySQL است
if os.environ.get("DB_ENGINE", "mysql") == "sqlite":
    # حالت SQLite (فایل db.sqlite3 کنار پروژه).
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }}
# حالت MySQL؛ اطلاعات اتصال از متغیرهای محیطی خوانده می‌شود.
else:
    _db_name = os.environ.get("DB_NAME", "nivad_kanon")
    _db_user = os.environ.get("DB_USER", "root")
    _db_password = os.environ.get("DB_PASSWORD", "Mmmm9905")
    _db_host = os.environ.get("DB_HOST", "127.0.0.1")
    _db_port = os.environ.get("DB_PORT", "3306")
    _ensure_mysql_database(_db_name, _db_user, _db_password, _db_host, _db_port)
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": _db_name,
        "USER": _db_user,
        "PASSWORD": _db_password,
        "HOST": _db_host,
        "PORT": _db_port,
        # utf8mb4 برای پشتیبانی کامل از حروف فارسی و ایموجی.
        "OPTIONS": {"charset": "utf8mb4"},
    }}

# اعتبارسنجی رمز عبور: حداقل ۸ کاراکتر.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
]

# زبان و منطقه‌ی زمانی پروژه (فارسی / تهران).
LANGUAGE_CODE = "fa"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

# فایل‌های استاتیک خود جنگو (مثلاً CSS پنل ادمین)؛ پیشوند جدا است تا با فایل‌های css/js سایت تداخل نکند.
STATIC_URL = "/django-static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# تنظیمات نشست (Session) و CSRF: کوکی‌ها فقط توسط سرور خوانده می‌شوند (HttpOnly) و از ارسال بین‌سایتی محافظت می‌شوند (SameSite).
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# در محیط واقعی (DEBUG خاموش) کوکی‌ها فقط روی HTTPS ارسال می‌شوند.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
