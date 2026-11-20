#!/usr/bin/env python
# فایل اجرایی جنگو برای دستورات مدیریتی (runserver، migrate، createsuperuser و ...).
import os
import sys


# تابع اصلی: تنظیمات را مشخص می‌کند و دستور خط فرمان را اجرا می‌کند.
def main():
    # اگر متغیر محیطی تنظیم نشده باشد، فایل تنظیمات پروژه (nivad/settings.py) استفاده می‌شود.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nivad.settings")
    # import در داخل تابع انجام می‌شود تا تنظیمات محیطی قبل از لود جنگو اعمال شده باشند.
    from django.core.management import execute_from_command_line
    # اجرای دستور وارد‌شده (مثلاً python manage.py runserver).
    execute_from_command_line(sys.argv)


# فقط وقتی فایل مستقیم اجرا شود (نه import)، main فراخوانی می‌شود.
if __name__ == "__main__":
    main()
