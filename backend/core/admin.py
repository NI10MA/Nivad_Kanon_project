from django.contrib import admin
from django.utils import timezone

from . import models

admin.site.site_header = "پنل مدیریت کانون دانش‌آموزی استان همدان"
admin.site.site_title = "مدیریت کانون دانش‌آموزی"
admin.site.index_title = "مدیریت جامع دوره‌ها، مربیان، خوابگاه، سالن و حضور و غیاب"


@admin.register(models.Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "full_name", "national_code", "phone")
    search_fields = ("user__username", "full_name", "national_code", "phone")


@admin.register(models.Instructor)
class InstructorAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialty", "phone", "is_active")
    list_filter = ("is_active",)
    search_fields = ("full_name", "specialty", "phone")
    list_editable = ("is_active",)


@admin.register(models.Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "delivery_mode", "instructor", "capacity", "is_active")
    list_filter = ("category", "delivery_mode", "is_active")
    search_fields = ("title", "level", "instructor__full_name")
    list_editable = ("capacity", "is_active")


@admin.register(models.Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("full_name", "national_code", "phone", "course", "grade", "school_name", "status", "created_at")
    list_filter = ("status", "course", "grade")
    search_fields = ("full_name", "national_code", "phone", "school_name", "course__title", "student__username")
    list_editable = ("status",)

    def save_model(self, request, obj, form, change):
        if not obj.full_name and obj.student_id:
            prof = getattr(obj.student, "profile", None)
            if prof:
                obj.full_name = obj.full_name or prof.full_name
                obj.phone = obj.phone or prof.phone
                obj.national_code = obj.national_code or prof.national_code
        super().save_model(request, obj, form, change)
        if obj.status != "rejected" and obj.course_id and obj.student_id:
            models.Attendance.objects.get_or_create(
                course_id=obj.course_id,
                student_id=obj.student_id,
                date=timezone.localdate(),
                defaults={"status": "present"},
            )


@admin.register(models.Accommodation)
class AccommodationAdmin(admin.ModelAdmin):
    list_display = ("name", "gender", "capacity", "address", "is_active")
    list_filter = ("gender", "is_active")
    search_fields = ("name", "address")
    list_editable = ("capacity", "is_active")


@admin.register(models.Stay)
class StayAdmin(admin.ModelAdmin):
    list_display = (
        "full_name", "national_code", "phone", "accommodation",
        "room_type", "guests_count", "check_in", "check_out", "needs_catering", "status",
    )
    list_filter = ("status", "accommodation", "room_type", "gender", "needs_catering")
    search_fields = ("full_name", "national_code", "phone", "organization", "purpose")
    list_editable = ("status",)


@admin.register(models.Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("course", "student", "date", "status")
    list_filter = ("status", "date", "course")
    search_fields = ("student__username", "student__profile__full_name", "course__title")
    list_editable = ("status",)


@admin.register(models.HallBooking)
class HallBookingAdmin(admin.ModelAdmin):
    list_display = (
        "hall", "event_title", "full_name", "organization",
        "booking_date", "start_time", "end_time", "attendees", "phone", "status",
    )
    list_filter = ("hall", "status", "booking_date")
    search_fields = ("event_title", "full_name", "national_code", "organization", "phone")
    list_editable = ("status",)
