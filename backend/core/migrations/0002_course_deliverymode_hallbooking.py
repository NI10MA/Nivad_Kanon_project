from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


# مایگریشن دوم: افزودن شیوه‌ی برگزاری دوره (حضوری/آنلاین) و ساخت جدول رزرو سالن.
class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    # تابع داده‌ی اولیه؛ فعلاً کاری نمی‌کند (دوره‌های دستی حذف شده‌اند) اما برای حفظ ترتیب مایگریشن‌ها نگه داشته شده است.
    def seed_site_data(apps, schema_editor):
        # دوره‌های دستی غیرفعال شده‌اند تا فقط دوره‌های ثبت‌شده در پنل مدیریت نمایش داده شوند.
        pass

    operations = [
        # افزودن فیلد شیوه‌ی برگزاری به دوره (دوره‌های قبلی «حضوری» می‌شوند)
        migrations.AddField(
            model_name="course",
            name="delivery_mode",
            field=models.CharField(
                choices=[("in_person", "حضوری"), ("online", "آنلاین")],
                default="in_person",
                max_length=20,
                verbose_name="شیوه برگزاری",
            ),
        ),
        # جدول رزرو سالن
        migrations.CreateModel(
            name="HallBooking",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("hall", models.CharField(choices=[("سالن اجتماعات", "سالن اجتماعات"), ("سالن کنفرانس", "سالن کنفرانس")], max_length=80, verbose_name="سالن")),
                ("event_title", models.CharField(max_length=160, verbose_name="عنوان برنامه")),
                ("booking_date", models.DateField(verbose_name="تاریخ درخواست")),
                ("start_time", models.TimeField(verbose_name="ساعت شروع")),
                ("end_time", models.TimeField(verbose_name="ساعت پایان")),
                ("attendees", models.PositiveIntegerField(default=1, verbose_name="تعداد افراد")),
                ("phone", models.CharField(max_length=20, verbose_name="شماره تماس")),
                ("note", models.TextField(blank=True, verbose_name="توضیحات")),
                ("status", models.CharField(choices=[("pending", "در انتظار بررسی"), ("approved", "تأیید شده"), ("rejected", "رد شده")], default="pending", max_length=12, verbose_name="وضعیت")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hall_bookings", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        # اجرای تابع داده‌ی اولیه (برگشت‌پذیر با noop)
        migrations.RunPython(seed_site_data, migrations.RunPython.noop),
    ]
