from datetime import date

from django.conf import settings
from django.db import models

# مدل کاربر پروژه (کاربر پیش‌فرض جنگو)؛ به‌جای import مستقیم از تنظیمات خوانده می‌شود.
User = settings.AUTH_USER_MODEL


# پروفایل کاربر: اطلاعات تکمیلی هر کاربر که در مدل پیش‌فرض User نیست.
class Profile(models.Model):
    """اطلاعات تکمیلی کاربر (دانش‌آموز / عضو). کاربران staff مدیر داشبورد هستند."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField("نام و نام خانوادگی", max_length=120, blank=True)
    phone = models.CharField("تلفن", max_length=20, blank=True)
    national_code = models.CharField("کد ملی", max_length=10, blank=True, default="")

    def __str__(self):
        return self.full_name or self.user.get_username()


# مربی: افرادی که دوره‌ها را برگزار می‌کنند.
class Instructor(models.Model):
    full_name = models.CharField("نام مربی", max_length=120)
    specialty = models.CharField("تخصص", max_length=120, blank=True)
    phone = models.CharField("تلفن", max_length=20, blank=True)
    bio = models.TextField("توضیحات", blank=True)
    is_active = models.BooleanField("فعال", default=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


# دوره: کلاس‌های آموزشی یا ورزشی کانون که دانش‌آموزان در آن ثبت‌نام می‌کنند.
class Course(models.Model):
    CATEGORIES = [("educational", "آموزشی"), ("sports", "ورزشی")]
    COLORS = [(c, c) for c in ("blue", "purple", "orange", "green", "pink", "gold")]
    MODES = [("in_person", "حضوری"), ("online", "آنلاین")]

    title = models.CharField("عنوان", max_length=120)
    description = models.TextField("توضیحات", blank=True)
    category = models.CharField("دسته", max_length=20, choices=CATEGORIES, default="educational")
    level = models.CharField("سطح", max_length=60, blank=True)
    delivery_mode = models.CharField("شیوه برگزاری", max_length=20, choices=MODES, default="in_person")
    color = models.CharField("رنگ کارت", max_length=20, choices=COLORS, default="blue")
    instructor = models.ForeignKey(
        Instructor, null=True, blank=True, on_delete=models.SET_NULL, related_name="courses"
    )
    capacity = models.PositiveIntegerField("ظرفیت", default=30)
    is_active = models.BooleanField("فعال", default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.title


# ثبت‌نام: ارتباط یک دانش‌آموز با یک دوره به‌همراه اطلاعات فرم ثبت‌نام.
class Enrollment(models.Model):
    STATUSES = [
        ("pending", "در انتظار بررسی"),
        ("approved", "تأیید شده"),
        ("rejected", "رد شده"),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="enrollments")
    full_name = models.CharField("نام و نام خانوادگی دانش‌آموز", max_length=120, blank=True, default="")
    national_code = models.CharField("کد ملی", max_length=10, blank=True, default="")
    phone = models.CharField("شماره تماس", max_length=20, blank=True, default="")
    grade = models.CharField("پایه تحصیلی / رده سنی", max_length=60, blank=True, default="")
    school_name = models.CharField("نام مدرسه", max_length=120, blank=True, default="")
    note = models.TextField("توضیحات", blank=True, default="")
    status = models.CharField("وضعیت", max_length=12, choices=STATUSES, default="approved")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("course", "student")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name or self.student} - {self.course}"


# اقامتگاه / خوابگاه: محل‌هایی که می‌توان در آن‌ها رزرو اقامت انجام داد.
class Accommodation(models.Model):
    GENDERS = [("male", "پسران"), ("female", "دختران"), ("mixed", "مختلط / خانواده")]

    name = models.CharField("نام اقامتگاه", max_length=120)
    address = models.CharField("آدرس", max_length=255, blank=True)
    gender = models.CharField("مخصوص", max_length=10, choices=GENDERS, default="mixed")
    capacity = models.PositiveIntegerField("ظرفیت", default=10)
    is_active = models.BooleanField("فعال", default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# درخواست رزرو اقامت؛ هر رکورد یک درخواست برای یک بازه‌ی زمانی مشخص است.
class Stay(models.Model):
    """درخواست رزرو خوابگاه و اقامتگاه کانون."""
    STATUSES = [
        ("pending", "در انتظار بررسی"),
        ("approved", "تأیید شده"),
        ("rejected", "رد شده"),
    ]
    GENDERS = [
        ("male", "پسران / آقایان"),
        ("female", "دختران / بانوان"),
        ("family", "خانواده / مختلط"),
    ]
    ROOM_TYPES = [
        ("dorm", "اتاق خوابگاهی گروهی"),
        ("suite", "سوئیت اختصاصی"),
        ("vip", "اتاق ویژه مهمان"),
    ]

    accommodation = models.ForeignKey(Accommodation, on_delete=models.CASCADE, related_name="stays")
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="stays")
    full_name = models.CharField("نام و نام خانوادگی متقاضی / سرپرست", max_length=120, blank=True, default="")
    national_code = models.CharField("کد ملی", max_length=10, blank=True, default="")
    phone = models.CharField("شماره تماس", max_length=20, blank=True, default="")
    gender = models.CharField("بخش / جنسیت", max_length=12, choices=GENDERS, default="male")
    room_type = models.CharField("نوع اسکان", max_length=20, choices=ROOM_TYPES, default="dorm")
    guests_count = models.PositiveIntegerField("تعداد نفرات", default=1)
    organization = models.CharField("نام مدرسه / شهر / واحد اعزام‌کننده", max_length=160, blank=True, default="")
    purpose = models.CharField("علت اقامت / عنوان اردو یا برنامه", max_length=160, blank=True, default="")
    check_in = models.DateField("تاریخ ورود")
    check_out = models.DateField("تاریخ خروج")
    arrival_time = models.CharField("ساعت تقریبی ورود", max_length=20, blank=True, default="")
    needs_catering = models.BooleanField("درخواست خدمات پذیرایی / وعده غذایی", default=False)
    note = models.TextField("توضیحات تکمیلی", blank=True, default="")
    status = models.CharField("وضعیت", max_length=12, choices=STATUSES, default="pending")
    created_at = models.DateTimeField("زمان ثبت", auto_now_add=True, null=True)

    class Meta:
        ordering = ["-check_in", "-id"]

    def __str__(self):
        return f"{self.full_name or self.user or 'متقاضی'} - {self.accommodation}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if (isinstance(self.check_in, date) and isinstance(self.check_out, date)
                and self.check_out <= self.check_in):
            raise ValidationError({"check_out": "تاریخ خروج باید بعد از تاریخ ورود باشد."})


# حضور و غیاب: وضعیت حضور هر دانش‌آموز در هر روز برای یک دوره.
class Attendance(models.Model):
    STATUSES = [("present", "حاضر"), ("absent", "غایب"), ("late", "تأخیر")]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="attendance")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="attendance")
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUSES, default="present")

    class Meta:
        unique_together = ("course", "student", "date")
        indexes = [models.Index(fields=["course", "date"])]

    def __str__(self):
        return f"{self.course} - {self.student} ({self.date})"


# رزرو سالن: درخواست استفاده از سالن اجتماعات یا کنفرانس در یک روز و بازه‌ی ساعتی.
class HallBooking(models.Model):
    STATUSES = [
        ("pending", "در انتظار بررسی"),
        ("approved", "تأیید شده"),
        ("rejected", "رد شده"),
    ]
    HALLS = [("سالن اجتماعات", "سالن اجتماعات"), ("سالن کنفرانس", "سالن کنفرانس")]

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="hall_bookings")
    hall = models.CharField("سالن", max_length=80, choices=HALLS)
    event_title = models.CharField("عنوان برنامه", max_length=160)
    full_name = models.CharField("نام و نام خانوادگی درخواست‌کننده", max_length=120, blank=True, default="")
    national_code = models.CharField("کد ملی", max_length=10, blank=True, default="")
    organization = models.CharField("سازمان / مدرسه / واحد درخواست‌کننده", max_length=160, blank=True, default="")
    booking_date = models.DateField("تاریخ درخواست")
    start_time = models.TimeField("ساعت شروع")
    end_time = models.TimeField("ساعت پایان")
    attendees = models.PositiveIntegerField("تعداد افراد", default=1)
    phone = models.CharField("شماره تماس", max_length=20)
    equipment = models.CharField("تجهیزات مورد نیاز", max_length=255, blank=True, default="")
    note = models.TextField("توضیحات", blank=True)
    status = models.CharField("وضعیت", max_length=12, choices=STATUSES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.hall} - {self.event_title}"
