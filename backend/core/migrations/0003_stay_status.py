from django.db import migrations, models


# مایگریشن سوم: افزودن وضعیت (در انتظار/تأیید/رد) به درخواست‌های اقامت.
class Migration(migrations.Migration):
    dependencies = [("core", "0002_course_deliverymode_hallbooking")]

    operations = [
        # درخواست‌های قبلی هم به‌صورت پیش‌ فرض «در انتظار بررسی» می‌شوند
        migrations.AddField(
            model_name="stay",
            name="status",
            field=models.CharField(
                choices=[("pending", "در انتظار بررسی"), ("approved", "تأیید شده"), ("rejected", "رد شده")],
                default="pending",
                max_length=12,
                verbose_name="وضعیت",
            ),
        ),
    ]
