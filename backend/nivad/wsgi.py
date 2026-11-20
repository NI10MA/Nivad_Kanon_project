# نقطه‌ی ورود WSGI برای اجرای پروژه روی سرور واقعی (gunicorn، uWSGI، mod_wsgi و ...).
import os
from django.core.wsgi import get_wsgi_application

# مشخص‌کردن فایل تنظیمات پروژه.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nivad.settings")
# شیء application که وب‌سرور برای پاسخ‌دادن به درخواست‌ها از آن استفاده می‌کند.
application = get_wsgi_application()
