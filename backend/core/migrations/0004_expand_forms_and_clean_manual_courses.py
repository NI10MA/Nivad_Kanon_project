from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


# عنوان دوره‌های دستیِ اولیه که باید پاک شوند (فقط در صورتی که ثبت‌نام/حضور/مربی نداشته باشند).
MANUAL_SEEDED_TITLES = [
    "قرآن", "مهارت‌های زندگی", "فن بیان و سخنوری", "تئاتر و بازیگری",
    "هوش مصنوعی دختران", "هوش مصنوعی پسران", "نقاشی", "مهارت‌های کامپیوتری",
    "خوشنویسی", "زبان مبتدی", "موسیقی", "ریاضیات", "منبت‌کاری", "علوم آزمایشگاهی",
    "تیراندازی آقایان", "تکواندو پسران", "شطرنج", "تیراندازی بانوان",
    "تکواندو دختران", "کاراته دختران", "ژیمناستیک پسران", "ژیمناستیک دختران",
    "ایروبیک و پیلاتس", "بازی و ورزش کودکان", "ورزش سالمندان",
]


# تابع داده: پاک‌سازی دوره‌های دستی و ساخت اقامتگاه‌های پیش‌فرض.
# در مایگریشن‌ها باید مدل‌ها با apps.get_model گرفته شوند (نه import مستقیم).
def clean_manual_courses_and_seed_accommodations(apps, schema_editor):
    Course = apps.get_model("core", "Course")
    Accommodation = apps.get_model("core", "Accommodation")

    # حذف دوره‌های دستی اولیه‌ای که ثبت‌ نام یا حضوروغیاب ندارند و مربی به آن‌ها متصل نشده است
    Course.objects.filter(
        title__in=MANUAL_SEEDED_TITLES,
        instructor__isnull=True,
        enrollments__isnull=True,
        attendance__isnull=True,
    ).delete()

    # ایجاد اقامتگاه‌های پیش ‌فرض در صورت خالی بودن جدول اقامتگاه‌ها
    if not Accommodation.objects.exists():
        default_places = [
            ("خوابگاه پسرانه شهید بهشتی", "همدان، بلوار آیت‌الله کاشانی، مجتمع اردویی و آموزشی کانون", "male", 40),
            ("خوابگاه دخترانه حضرت معصومه (س)", "همدان، خیابان مهدیه، مجموعه فرهنگی‌تربیتی سازمان دانش‌آموزی", "female", 36),
            ("مهمانسرا و سوئیت فرهنگیان", "همدان، میدان فلسطین، ساختمان مرکزی کانون دانش‌آموزی", "mixed", 16),
        ]
        for name, addr, gender, cap in default_places:
            Accommodation.objects.create(
                name=name, address=addr, gender=gender, capacity=cap, is_active=True
            )


# مایگریشن چهارم: گسترش فرم‌های ثبت ‌نام، اقامت و رزرو سالن + پاک‌سازی داده‌های اولیه.
class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_stay_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # فیلدهای پروفایل: کد ملی
        # Profile fields
        migrations.AddField(
            model_name="profile",
            name="national_code",
            field=models.CharField(blank=True, default="", max_length=10, verbose_name="کد ملی"),
        ),
        # فیلدهای ثبت ‌نام: مشخصات دانش‌آموز، مدرسه، توضیحات و وضعیت
        # Enrollment fields
        migrations.AddField(
            model_name="enrollment",
            name="full_name",
            field=models.CharField(blank=True, default="", max_length=120, verbose_name="نام و نام خانوادگی دانش‌آموز"),
        ),
        migrations.AddField(
            model_name="enrollment",
            name="national_code",
            field=models.CharField(blank=True, default="", max_length=10, verbose_name="کد ملی"),
        ),
        migrations.AddField(
            model_name="enrollment",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=20, verbose_name="شماره تماس"),
        ),
        migrations.AddField(
            model_name="enrollment",
            name="grade",
            field=models.CharField(blank=True, default="", max_length=60, verbose_name="پایه تحصیلی / رده سنی"),
        ),
        migrations.AddField(
            model_name="enrollment",
            name="school_name",
            field=models.CharField(blank=True, default="", max_length=120, verbose_name="نام مدرسه"),
        ),
        migrations.AddField(
            model_name="enrollment",
            name="note",
            field=models.TextField(blank=True, default="", verbose_name="توضیحات"),
        ),
        migrations.AddField(
            model_name="enrollment",
            name="status",
            field=models.CharField(
                choices=[("pending", "در انتظار بررسی"), ("approved", "تأیید شده"), ("rejected", "رد شده")],
                default="approved",
                max_length=12,
                verbose_name="وضعیت",
            ),
        ),
        # ترتیب پیش‌فرض ثبت‌نام‌ها: جدیدترین اول
        migrations.AlterModelOptions(
            name="enrollment",
            options={"ordering": ["-created_at"]},
        ),
        # فیلدهای درخواست اقامت: مشخصات متقاضی، نوع اسکان، تعداد نفرات و ...
        # Stay fields
        migrations.AlterField(
            model_name="stay",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="stays",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="stay",
            name="full_name",
            field=models.CharField(blank=True, default="", max_length=120, verbose_name="نام و نام خانوادگی متقاضی / سرپرست"),
        ),
        migrations.AddField(
            model_name="stay",
            name="national_code",
            field=models.CharField(blank=True, default="", max_length=10, verbose_name="کد ملی"),
        ),
        migrations.AddField(
            model_name="stay",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=20, verbose_name="شماره تماس"),
        ),
        migrations.AddField(
            model_name="stay",
            name="gender",
            field=models.CharField(
                choices=[("male", "پسران / آقایان"), ("female", "دختران / بانوان"), ("family", "خانواده / مختلط")],
                default="male",
                max_length=12,
                verbose_name="بخش / جنسیت",
            ),
        ),
        migrations.AddField(
            model_name="stay",
            name="room_type",
            field=models.CharField(
                choices=[("dorm", "اتاق خوابگاهی گروهی"), ("suite", "سوئیت اختصاصی"), ("vip", "اتاق ویژه مهمان")],
                default="dorm",
                max_length=20,
                verbose_name="نوع اسکان",
            ),
        ),
        migrations.AddField(
            model_name="stay",
            name="guests_count",
            field=models.PositiveIntegerField(default=1, verbose_name="تعداد نفرات"),
        ),
        migrations.AddField(
            model_name="stay",
            name="organization",
            field=models.CharField(blank=True, default="", max_length=160, verbose_name="نام مدرسه / شهر / واحد اعزام‌کننده"),
        ),
        migrations.AddField(
            model_name="stay",
            name="purpose",
            field=models.CharField(blank=True, default="", max_length=160, verbose_name="علت اقامت / عنوان اردو یا برنامه"),
        ),
        migrations.AddField(
            model_name="stay",
            name="arrival_time",
            field=models.CharField(blank=True, default="", max_length=20, verbose_name="ساعت تقریبی ورود"),
        ),
        migrations.AddField(
            model_name="stay",
            name="needs_catering",
            field=models.BooleanField(default=False, verbose_name="درخواست خدمات پذیرایی / وعده غذایی"),
        ),
        migrations.AlterField(
            model_name="stay",
            name="note",
            field=models.TextField(blank=True, default="", verbose_name="توضیحات تکمیلی"),
        ),
        migrations.AddField(
            model_name="stay",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, null=True, verbose_name="زمان ثبت"),
        ),
        migrations.AlterModelOptions(
            name="stay",
            options={"ordering": ["-check_in", "-id"]},
        ),
        # فیلدهای رزرو سالن: مشخصات درخواست‌کننده و تجهیزات (و اختیاری‌شدن کاربر)
        # HallBooking fields
        migrations.AlterField(
            model_name="hallbooking",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="hall_bookings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="hallbooking",
            name="full_name",
            field=models.CharField(blank=True, default="", max_length=120, verbose_name="نام و نام خانوادگی درخواست‌کننده"),
        ),
        migrations.AddField(
            model_name="hallbooking",
            name="national_code",
            field=models.CharField(blank=True, default="", max_length=10, verbose_name="کد ملی"),
        ),
        migrations.AddField(
            model_name="hallbooking",
            name="organization",
            field=models.CharField(blank=True, default="", max_length=160, verbose_name="سازمان / مدرسه / واحد درخواست‌کننده"),
        ),
        migrations.AddField(
            model_name="hallbooking",
            name="equipment",
            field=models.CharField(blank=True, default="", max_length=255, verbose_name="تجهیزات مورد نیاز"),
        ),
        # اجرای تابع داده در پایان (برگشت‌ناپذیر؛ noop برای حالت برگشت)
        migrations.RunPython(clean_manual_courses_and_seed_accommodations, migrations.RunPython.noop),
    ]
