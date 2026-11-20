# راهنمای اجرای پروژه سامانه جامع کانون دانش‌آموزی استان همدان

## ۱. نکات مهم پیش از اجرا
- پیش‌فرض دیتابیس روی **MySQL** تنظیم شده است و در صورت فعال بودن سرویس MySQL، دیتابیس `nivad_kanon` به صورت خودکار ساخته می‌شود.
- در صورت نیاز به تغییر رمز عبور MySQL لوکال سیستم خود، در فایل `backend/nivad/settings.py` مقدار `DB_PASSWORD` را تغییر دهید (یا برای اجرای فوری با SQLite متغیر محیطی `DB_ENGINE=sqlite` را تنظیم کنید).
- حساب ادمین پیش‌فرض با نام کاربری `admin` و رمز `123456789` قابل استفاده یا ساخت با دستور `createsuperuser` است.

## ۲. دستورات اجرا در ترمینال VS Code (ویندوز / PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## ۳. نشانی صفحات سامانه پس از اجرای سرور
- **صفحه اصلی سایت**: `http://127.0.0.1:8000/`
- **فهرست دوره‌ها (آموزشی و ورزشی)**: `http://127.0.0.1:8000/courses.html`
- **جزئیات هر دوره**: `http://127.0.0.1:8000/course-detail.html?id=1`
- **فرم ثبت‌نام دوره‌ها (متصل به لیست حضور و غیاب کلاس)**: `http://127.0.0.1:8000/course-register.html`
- **رزرو خوابگاه و اقامتگاه**: `http://127.0.0.1:8000/accommodation.html`
- **رزرو سالن اجتماعات و کنفرانس**: `http://127.0.0.1:8000/hall-booking.html`
- **ورود و عضویت**: `http://127.0.0.1:8000/Login.html`
- **پنل کاربری دانش‌آموز (دوره‌های من و تقویم حضور و غیاب)**: `http://127.0.0.1:8000/dashboard-login.html`
- **پنل مدیریت اختصاصی کانون (ادمین)**: `http://127.0.0.1:8000/dashboard/`
- **پنل ادمین داخلی جنگو**: `http://127.0.0.1:8000/django-admin/`