"""JSON API for the public site, student panel, and management dashboard (plain Django, no DRF)."""
import json
import re
from datetime import date, time, timedelta
from functools import wraps

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .models import (
    Accommodation,
    Attendance,
    Course,
    Enrollment,
    HallBooking,
    Instructor,
    Profile,
    Stay,
)

User = get_user_model()
USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,24}$")
DIGITS_RE = re.compile(r"\d+")


# ───────────────────────────── اعتبارسنجی‌ها ─────────────────────────────

def err(message, status=400, fields=None):
    body = {"error": message}
    if fields:
        body["fields"] = fields
    return JsonResponse(body, status=status)


def body_of(request):
    try:
        data = json.loads(request.body or b"{}")
    except (ValueError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def normalize_digits(val):
    """Convert Persian/Arabic digits to ASCII digits."""
    if val is None:
        return ""
    s = str(val).strip()
    persian = "۰۱۲۳۴۵۶۷۸۹"
    arabic = "٠١٢٣٤٥٦٧٨٩"
    for i, ch in enumerate(persian):
        s = s.replace(ch, str(i))
    for i, ch in enumerate(arabic):
        s = s.replace(ch, str(i))
    return s


def admin_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return err("ابتدا وارد شوید.", 401)
        if not request.user.is_staff:
            return err("دسترسی مجاز نیست.", 403)
        return view(request, *args, **kwargs)
    return wrapper


def validation_response(exc):
    if hasattr(exc, "message_dict"):
        fields = {k: " ".join(v) for k, v in exc.message_dict.items()}
        first = next(iter(fields.values()), "اطلاعات نامعتبر است.")
        return err(first, 400, fields)
    return err(" ".join(exc.messages), 400)


def user_dict(u):
    p = getattr(u, "profile", None)
    return {
        "id": u.id,
        "username": u.username,
        "full_name": p.full_name if p else "",
        "phone": p.phone if p else "",
        "national_code": getattr(p, "national_code", "") if p else "",
        "role": "admin" if u.is_staff else "student",
        "is_active": u.is_active,
        "joined": u.date_joined.date().isoformat(),
    }


def ensure_default_accommodations():
    """Ensure at least the default accommodations exist so the dormitory form is usable immediately."""
    if Accommodation.objects.exists():
        return
    defaults = [
        ("خوابگاه پسرانه شهید بهشتی", "همدان، بلوار آیت‌الله کاشانی، مجتمع اردویی و آموزشی کانون", "male", 40),
        ("خوابگاه دخترانه حضرت معصومه (س)", "همدان، خیابان مهدیه، مجموعه فرهنگی‌تربیتی سازمان دانش‌آموزی", "female", 36),
        ("مهمانسرا و سوئیت فرهنگیان", "همدان، میدان فلسطین، ساختمان مرکزی کانون دانش‌آموزی", "mixed", 16),
    ]
    for name, addr, gender, cap in defaults:
        Accommodation.objects.create(name=name, address=addr, gender=gender, capacity=cap, is_active=True)


def _merge_guest_student_records(target_user, national_code="", phone=""):
    """
    اگر دانش‌آموز قبلاً از طریق فرم عمومی ثبت‌نام دوره (با حساب موقت st_...) ثبت‌نام کرده باشد
    و اکنون با همان کد ملی یا شماره تماس حساب کاربری بسازد یا وارد شود، سوابق ثبت‌نام و حضور و غیابش
    به حساب اصلی او متصل می‌شود تا در پنل کاربری (dashboard-login.html) نمایش داده شود.
    """
    if not target_user or target_user.is_staff:
        return
    clean_nc = "".join(DIGITS_RE.findall(national_code or ""))[:10]
    clean_ph = "".join(DIGITS_RE.findall(phone or ""))[-10:]
    if not clean_nc and not clean_ph:
        return

    q = Q()
    if clean_nc:
        q |= Q(national_code=clean_nc) | Q(student__profile__national_code=clean_nc)
    if clean_ph:
        q |= Q(phone__endswith=clean_ph) | Q(student__profile__phone__endswith=clean_ph)

    matching_enrollments = list(
        Enrollment.objects.filter(q)
        .exclude(student=target_user)
        .select_related("student")
    )
    for enr in matching_enrollments:
        old_student = enr.student
        # فقط حساب‌های موقت دانش‌آموزی (بدون رمز یا با پیشوند st_) ادغام می‌شوند
        if old_student and not old_student.is_staff and (
            old_student.username.startswith("st_") or not old_student.has_usable_password()
        ):
            if not Enrollment.objects.filter(course_id=enr.course_id, student=target_user).exists():
                enr.student = target_user
                enr.save(update_fields=["student"])
            for att in Attendance.objects.filter(course_id=enr.course_id, student=old_student):
                if not Attendance.objects.filter(course_id=enr.course_id, student=target_user, date=att.date).exists():
                    att.student = target_user
                    att.save(update_fields=["student"])


# ───────────────────────────── احراز هویت کاربران ─────────────────────────────

@ensure_csrf_cookie
@require_http_methods(["GET"])
def me(request):
    u = request.user
    return JsonResponse({
        "authenticated": u.is_authenticated,
        "user": user_dict(u) if u.is_authenticated else None,
    })


@require_http_methods(["POST"])
def login_view(request):
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    user = authenticate(
        request,
        username=str(data.get("username", "")).strip(),
        password=str(data.get("password", "")),
    )
    if user is None or not user.is_active:
        return err("نام کاربری یا رمز عبور اشتباه است.", 401)
    login(request, user)
    prof = getattr(user, "profile", None)
    if prof and not user.is_staff:
        _merge_guest_student_records(user, prof.national_code, prof.phone)
    return JsonResponse({"user": user_dict(user)})


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_http_methods(["POST"])
def register_view(request):
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    full_name = str(data.get("full_name", "")).strip()
    phone = normalize_digits(data.get("phone", ""))
    national_code = "".join(DIGITS_RE.findall(normalize_digits(data.get("national_code", ""))))[:10]

    if not full_name or not phone:
        return err("نام و نام خانوادگی و شماره تماس والد یا سرپرست الزامی است.")
    if len(full_name) > 120 or len(phone) > 20:
        return err("طول نام یا شماره تماس معتبر نیست.")
    if not USERNAME_RE.match(username):
        return err("نام کاربری باید ۳ تا ۲۴ حرف انگلیسی، عدد یا زیرخط باشد.")
    try:
        validate_password(password)
    except ValidationError as e:
        return err(" ".join(e.messages))
    if User.objects.filter(username__iexact=username).exists():
        return err("این نام کاربری قبلاً ثبت شده است.", 409)
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=username, password=password)
            Profile.objects.create(
                user=user, full_name=full_name, phone=phone, national_code=national_code
            )
            _merge_guest_student_records(user, national_code, phone)
    except IntegrityError:
        return err("این نام کاربری قبلاً ثبت شده است.", 409)
    login(request, user)
    return JsonResponse({"user": user_dict(user)}, status=201)


# ───────────────────────────── عمومی ─────────────────────────────

@require_http_methods(["GET"])
def public_courses(request):
    qs = (
        Course.objects.filter(is_active=True)
        .select_related("instructor")
        .annotate(
            active_enrolled=Count(
                "enrollments",
                filter=~Q(enrollments__status="rejected"),
                distinct=True,
            )
        )
    )
    courses_list = []
    for c in qs:
        enrolled = getattr(c, "active_enrolled", 0)
        courses_list.append({
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "level": c.level,
            "color": c.color,
            "category": c.category,
            "delivery_mode": c.delivery_mode,
            "capacity": c.capacity,
            "enrolled": enrolled,
            "remaining": max(0, c.capacity - enrolled),
            "instructor": c.instructor.full_name if c.instructor else "",
            "instructor_specialty": c.instructor.specialty if c.instructor else "",
        })
    return JsonResponse({"courses": courses_list})


@require_http_methods(["GET"])
def public_instructors(request):
    qs = Instructor.objects.filter(is_active=True)
    return JsonResponse({
        "instructors": [
            {
                "id": i.id,
                "full_name": i.full_name,
                "specialty": i.specialty,
                "bio": i.bio,
            }
            for i in qs
        ]
    })


def _resolve_or_create_student(request, full_name, phone, national_code, course=None):
    """
    Resolve or create a student User record from the submitted registration form data
    so that every registered student (even if submitted while an admin or parent is logged in)
    gets a proper student record and automatically appears in the course Attendance list.
    """
    clean_nc = "".join(DIGITS_RE.findall(normalize_digits(national_code or "")))[:10]
    clean_ph = "".join(DIGITS_RE.findall(normalize_digits(phone or "")))[-10:]
    req_user = getattr(request, "user", None)

    # ۱) اگر کد ملی وارد شده، ابتدا دانش‌آموز با همان کد ملی را پیدا کن
    if clean_nc:
        prof = Profile.objects.select_related("user").filter(national_code=clean_nc, user__is_staff=False).first()
        if prof:
            if full_name:
                prof.full_name = full_name[:120]
            if phone:
                prof.phone = normalize_digits(phone)[:20]
            prof.save()
            return prof.user

    # ۲) اگر کاربر عادی (غیرادمین) لاگین است و برای خودش ثبت‌نام می‌کند
    if req_user and req_user.is_authenticated and not req_user.is_staff:
        user = req_user
        profile, _ = Profile.objects.get_or_create(user=user)
        same_person = (
            not clean_nc
            or not profile.national_code
            or profile.national_code == clean_nc
        )
        already_in_course = (
            course is not None
            and Enrollment.objects.filter(course=course, student=user).exclude(status="rejected").exists()
        )
        if same_person and not already_in_course:
            if full_name:
                profile.full_name = full_name[:120]
            if phone:
                profile.phone = normalize_digits(phone)[:20]
            if clean_nc:
                profile.national_code = clean_nc
            profile.save()
            return user

    # ۳) اگر شماره تماس با دانش‌آموزی که هنوز در این دوره نیست مطابقت دارد
    if clean_ph and not clean_nc:
        prof_qs = Profile.objects.select_related("user").filter(phone__endswith=clean_ph, user__is_staff=False)
        for prof in prof_qs:
            if course is None or not Enrollment.objects.filter(course=course, student=prof.user).exclude(status="rejected").exists():
                if full_name:
                    prof.full_name = full_name[:120]
                    prof.save()
                return prof.user

    if not full_name or not phone:
        return None

    # ۴) ساخت رکورد دانش‌آموز جدید برای ورود خودکار به لیست کلاس و حضور و غیاب
    base_username = f"st_{clean_nc or clean_ph or 'user'}"[:20]
    candidate = base_username
    seq = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f"{base_username}_{seq}"[:24]
        seq += 1

    with transaction.atomic():
        user = User.objects.create_user(username=candidate, password=None)
        Profile.objects.create(
            user=user,
            full_name=full_name[:120],
            phone=normalize_digits(phone)[:20],
            national_code=clean_nc,
        )
    return user


@require_http_methods(["POST"])
def public_enroll(request, course_id=None):
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")

    target_course_id = course_id or data.get("course") or data.get("course_id")
    try:
        course = Course.objects.get(pk=int(target_course_id), is_active=True)
    except (Course.DoesNotExist, TypeError, ValueError):
        return err("دوره انتخاب‌شده معتبر یا فعال نیست.", 404)

    full_name = str(data.get("full_name", "")).strip()
    phone = normalize_digits(data.get("phone", ""))
    national_code = normalize_digits(data.get("national_code", ""))
    grade = str(data.get("grade", "")).strip()
    school_name = str(data.get("school_name", "")).strip()
    note = str(data.get("note", "")).strip()

    if request.user.is_authenticated and not request.user.is_staff:
        prof = getattr(request.user, "profile", None)
        if not full_name and prof:
            full_name = prof.full_name
        if not phone and prof:
            phone = prof.phone
        if not national_code and prof:
            national_code = getattr(prof, "national_code", "")

    if national_code and (not national_code.isdigit() or len(national_code) != 10):
        return err("کد ملی باید یک عدد ۱۰ رقمی معتبر باشد.")

    if national_code and Enrollment.objects.filter(
        course=course, national_code=national_code
    ).exclude(status="rejected").exists():
        return err("دانش‌آموز با این کد ملی قبلاً در این دوره ثبت‌نام شده است.", 409)

    student = _resolve_or_create_student(request, full_name, phone, national_code, course=course)
    if student is None:
        return err("برای ثبت‌نام لطفاً نام و نام خانوادگی و شماره تماس دانش‌آموز را وارد کنید.", 401)

    existing = Enrollment.objects.filter(course=course, student=student).first()
    if existing and existing.status != "rejected":
        return err("این دانش‌آموز قبلاً در این دوره ثبت‌نام شده است.", 409)

    active_count = course.enrollments.exclude(status="rejected").count()
    if active_count >= course.capacity:
        return err("ظرفیت این دوره تکمیل شده است.", 409)

    with transaction.atomic():
        if existing:
            existing.full_name = full_name[:120]
            existing.national_code = national_code[:10]
            existing.phone = phone[:20]
            existing.grade = grade[:60]
            existing.school_name = school_name[:120]
            existing.note = note[:1000]
            existing.status = "approved"
            existing.save()
            enrollment = existing
        else:
            enrollment = Enrollment.objects.create(
                course=course,
                student=student,
                full_name=full_name[:120],
                national_code=national_code[:10],
                phone=phone[:20],
                grade=grade[:60],
                school_name=school_name[:120],
                note=note[:1000],
                status="approved",
            )

        today = timezone.localdate()
        Attendance.objects.get_or_create(
            course=course,
            student=student,
            date=today,
            defaults={"status": "present"},
        )

    return JsonResponse({
        "ok": True,
        "id": enrollment.id,
        "student_id": student.id,
        "message": f"ثبت‌نام «{full_name}» در دوره «{course.title}» نهایی شد و مشخصات دانش‌آموز به صورت خودکار وارد لیست حضور و غیاب کلاس در پنل مدیریت گردید.",
    }, status=201)


# ───────────────────────────── پنل کاربری دانش‌آموز (dashboard-login.html) ─────────────────────────────

@ensure_csrf_cookie
@require_http_methods(["GET"])
def student_dashboard(request):
    """
    اطلاعات کامل پنل کاربری دانش‌آموز (dashboard-login.html):
    - مشخصات کاربر واردشده
    - فهرست دوره‌های ثبت‌نامی دانش‌آموز
    - آمار حضور و غیاب (تعداد دوره‌های فعال، جلسات حاضر/تأخیر، جلسات غیبت، درصد حضور)
    - سوابق حضور و غیاب به تفکیک تاریخ برای تقویم شمسی پنل کاربری
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            "authenticated": False,
            "user": None,
            "stats": {
                "active_courses": 0,
                "total_sessions": 0,
                "present_sessions": 0,
                "late_sessions": 0,
                "absent_sessions": 0,
                "attendance_rate": 0,
            },
            "enrollments": [],
            "attendance_by_date": {},
            "attendance_records": [],
        })

    u = request.user
    prof = getattr(u, "profile", None)
    if prof and not u.is_staff:
        _merge_guest_student_records(u, prof.national_code, prof.phone)

    enr_qs = (
        Enrollment.objects.filter(student=u)
        .exclude(status="rejected")
        .select_related("course", "course__instructor")
        .order_by("-created_at")
    )
    enrollments = []
    for e in enr_qs:
        c = e.course
        if not c:
            continue
        enrollments.append({
            "id": e.id,
            "course_id": c.id,
            "title": c.title,
            "category": c.category,
            "delivery_mode": c.delivery_mode,
            "level": c.level,
            "instructor": c.instructor.full_name if c.instructor else "",
            "status": e.status,
            "grade": e.grade,
            "school_name": e.school_name,
            "created_at": e.created_at.date().isoformat() if e.created_at else "",
        })

    att_qs = (
        Attendance.objects.filter(student=u)
        .select_related("course")
        .order_by("date", "id")
    )
    present_count = 0
    late_count = 0
    absent_count = 0
    attendance_by_date = {}
    attendance_records = []

    # اولویت نمایش وضعیت در تقویم روزانه: اگر در یک روز چند کلاس داشت، غیبت یا تأخیر یا حاضر مشخص شود
    status_priority = {"absent": 3, "late": 2, "present": 1}
    for a in att_qs:
        if a.status == "present":
            present_count += 1
        elif a.status == "late":
            late_count += 1
        elif a.status == "absent":
            absent_count += 1
        iso_d = a.date.isoformat()
        prev = attendance_by_date.get(iso_d)
        if not prev or status_priority.get(a.status, 0) >= status_priority.get(prev, 0):
            attendance_by_date[iso_d] = a.status
        attendance_records.append({
            "date": iso_d,
            "course_id": a.course_id,
            "course_title": a.course.title if a.course else "",
            "status": a.status,
        })

    total_sessions = present_count + late_count + absent_count
    attended_sessions = present_count + late_count
    attendance_rate = round(attended_sessions * 100 / total_sessions) if total_sessions else (100 if enrollments else 0)

    return JsonResponse({
        "authenticated": True,
        "user": user_dict(u),
        "stats": {
            "active_courses": len(enrollments),
            "total_sessions": total_sessions,
            "present_sessions": attended_sessions,
            "late_sessions": late_count,
            "absent_sessions": absent_count,
            "attendance_rate": attendance_rate,
        },
        "enrollments": enrollments,
        "attendance_by_date": attendance_by_date,
        "attendance_records": attendance_records,
    })


@require_http_methods(["POST"])
def student_enroll(request):
    """
    ثبت‌نام سریع دانش‌آموز واردشده در یک یا چند دوره از داخل مودال پنل کاربری (dashboard-login.html).
    """
    if not request.user.is_authenticated:
        return err("برای ثبت‌نام مستقیم از پنل کاربری، لطفاً ابتدا وارد حساب خود شوید.", 401)

    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")

    raw_ids = data.get("course_ids") or data.get("courses") or []
    if isinstance(raw_ids, (int, str)):
        raw_ids = [raw_ids]
    if not isinstance(raw_ids, list) or not raw_ids:
        return err("لطفاً حداقل یک دوره را برای ثبت‌نام انتخاب کنید.")

    course_ids = []
    for item in raw_ids:
        try:
            course_ids.append(int(item))
        except (TypeError, ValueError):
            continue
    if not course_ids:
        return err("شناسه دوره‌های انتخابی معتبر نیست.")

    user = request.user
    prof, _ = Profile.objects.get_or_create(user=user)
    full_name = str(data.get("full_name") or prof.full_name or user.username).strip()[:120]
    phone = normalize_digits(data.get("phone") or prof.phone or "")[:20]
    national_code = normalize_digits(data.get("national_code") or prof.national_code or "")[:10]
    grade = str(data.get("grade") or "").strip()[:60]
    school_name = str(data.get("school_name") or "").strip()[:120]

    courses = list(Course.objects.filter(pk__in=course_ids, is_active=True))
    if not courses:
        return err("دوره‌های انتخاب‌شده فعال یا معتبر نیستند.", 404)

    enrolled_titles = []
    already_titles = []
    full_titles = []
    today = timezone.localdate()

    with transaction.atomic():
        for course in courses:
            existing = Enrollment.objects.filter(course=course, student=user).first()
            if existing and existing.status != "rejected":
                already_titles.append(course.title)
                continue
            active_count = course.enrollments.exclude(status="rejected").count()
            if active_count >= course.capacity:
                full_titles.append(course.title)
                continue
            if existing:
                existing.full_name = full_name
                existing.phone = phone
                existing.national_code = national_code
                if grade:
                    existing.grade = grade
                if school_name:
                    existing.school_name = school_name
                existing.status = "approved"
                existing.save()
            else:
                Enrollment.objects.create(
                    course=course,
                    student=user,
                    full_name=full_name,
                    phone=phone,
                    national_code=national_code,
                    grade=grade,
                    school_name=school_name,
                    status="approved",
                )
            Attendance.objects.get_or_create(
                course=course,
                student=user,
                date=today,
                defaults={"status": "present"},
            )
            enrolled_titles.append(course.title)

    if not enrolled_titles:
        if full_titles:
            return err(f"ظرفیت دوره(های) «{'، '.join(full_titles)}» تکمیل است.", 409)
        if already_titles:
            return err(f"شما قبلاً در دوره(های) «{'، '.join(already_titles)}» ثبت‌نام کرده‌اید.", 409)
        return err("ثبت‌نام انجام نشد.")

    msg = f"ثبت‌نام شما در دوره(های) «{'، '.join(enrolled_titles)}» با موفقیت انجام شد و به لیست حضور و غیاب کلاس اضافه گردید."
    return JsonResponse({
        "ok": True,
        "enrolled_courses": enrolled_titles,
        "already_enrolled": already_titles,
        "full_courses": full_titles,
        "message": msg,
    }, status=201)


@require_http_methods(["GET"])
def public_accommodations(request):
    """Public list of active accommodation options and current occupancy."""
    ensure_default_accommodations()
    today = timezone.localdate()
    qs = Accommodation.objects.filter(is_active=True).annotate(
        occupied=Coalesce(
            Sum(
                "stays__guests_count",
                filter=Q(
                    stays__status__in=["pending", "approved"],
                    stays__check_in__lte=today,
                    stays__check_out__gte=today,
                ),
            ),
            0,
        )
    )
    return JsonResponse({
        "accommodations": [
            {
                "id": a.id,
                "name": a.name,
                "address": a.address,
                "gender": a.gender,
                "capacity": a.capacity,
                "occupied": a.occupied,
                "available": max(0, a.capacity - a.occupied),
            }
            for a in qs
        ]
    })


@require_http_methods(["POST"])
def public_stay_booking(request):
    """ثبت درخواست رزرو خوابگاه با تمام فیلدهای مشخصات متقاضی و اقامت."""
    ensure_default_accommodations()
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")

    try:
        accommodation = Accommodation.objects.get(pk=int(data.get("accommodation")), is_active=True)
    except (Accommodation.DoesNotExist, TypeError, ValueError):
        return err("اقامتگاه انتخاب‌شده معتبر نیست.", 404)

    full_name = str(data.get("full_name", "")).strip()
    national_code = normalize_digits(data.get("national_code", ""))
    phone = normalize_digits(data.get("phone", ""))
    gender = str(data.get("gender", "male")).strip() or "male"
    room_type = str(data.get("room_type", "dorm")).strip() or "dorm"
    organization = str(data.get("organization", "")).strip()
    purpose = str(data.get("purpose", "")).strip()
    arrival_time = str(data.get("arrival_time", "")).strip()
    needs_catering = bool(data.get("needs_catering"))
    note = str(data.get("note", "")).strip()

    if request.user.is_authenticated:
        prof = getattr(request.user, "profile", None)
        if not full_name and prof:
            full_name = prof.full_name
        if not phone and prof:
            phone = prof.phone
        if not national_code and prof:
            national_code = getattr(prof, "national_code", "")

    if not full_name or not phone or not national_code:
        return err("لطفاً نام و نام خانوادگی، کد ملی و شماره تماس را به طور کامل وارد کنید.")

    if not national_code.isdigit() or len(national_code) != 10:
        return err("کد ملی باید یک عدد ۱۰ رقمی معتبر باشد.")

    try:
        guests_count = int(normalize_digits(data.get("guests_count", 1)) or 1)
    except (ValueError, TypeError):
        return err("تعداد نفرات معتبر نیست.")
    if guests_count < 1:
        return err("تعداد نفرات باید حداقل ۱ نفر باشد.")

    if gender not in dict(Stay.GENDERS):
        gender = "male"
    if room_type not in dict(Stay.ROOM_TYPES):
        room_type = "dorm"

    check_in = parse_date(normalize_digits(data.get("check_in", "")))
    check_out = parse_date(normalize_digits(data.get("check_out", "")))
    if not check_in or not check_out or check_out <= check_in:
        return err("تاریخ ورود و خروج معتبر نیست؛ تاریخ خروج باید بعد از تاریخ ورود باشد.")
    if check_in < timezone.localdate():
        return err("تاریخ ورود نمی‌تواند در گذشته باشد.")

    dup_q = Q(
        accommodation=accommodation,
        check_in__lt=check_out,
        check_out__gt=check_in,
        status__in=["pending", "approved"],
        national_code=national_code,
    )
    if Stay.objects.filter(dup_q).exists():
        return err("برای این بازه زمانی قبلاً درخواست فعالی با این کد ملی ثبت شده است.", 409)

    overlapping_guests = (
        Stay.objects.filter(
            accommodation=accommodation,
            check_in__lt=check_out,
            check_out__gt=check_in,
            status__in=["pending", "approved"],
        ).aggregate(total=Coalesce(Sum("guests_count"), 0))["total"]
        or 0
    )
    if overlapping_guests + guests_count > accommodation.capacity:
        remaining_cap = max(0, accommodation.capacity - overlapping_guests)
        return err(
            f"ظرفیت اقامتگاه در این بازه کافی نیست (ظرفیت خالی: {remaining_cap} نفر).",
            409,
        )

    user_obj = _resolve_or_create_student(request, full_name, phone, national_code)
    stay = Stay.objects.create(
        accommodation=accommodation,
        user=user_obj,
        full_name=full_name[:120],
        national_code=national_code[:10],
        phone=phone[:20],
        gender=gender,
        room_type=room_type,
        guests_count=guests_count,
        organization=organization[:160],
        purpose=purpose[:160],
        check_in=check_in,
        check_out=check_out,
        arrival_time=arrival_time[:20],
        needs_catering=needs_catering,
        note=note[:2000],
        status="pending",
    )
    return JsonResponse({
        "ok": True,
        "id": stay.id,
        "message": "درخواست رزرو خوابگاه شما با موفقیت ثبت شد و پس از بررسی در پنل مدیریت اطلاع‌رسانی می‌شود.",
    }, status=201)


@require_http_methods(["POST"])
def public_hall_booking(request):
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")

    required = ["hall", "event_title", "booking_date", "start_time", "end_time", "phone"]
    if any(not str(data.get(k, "")).strip() for k in required):
        return err("لطفاً همه فیلدهای ضروری را تکمیل کنید.")

    if data["hall"] not in dict(HallBooking.HALLS):
        return err("سالن انتخاب‌شده معتبر نیست.")

    full_name = str(data.get("full_name", "")).strip()
    national_code = normalize_digits(data.get("national_code", ""))[:10]
    organization = str(data.get("organization", "")).strip()
    phone = normalize_digits(data.get("phone", ""))
    equipment = str(data.get("equipment", "")).strip()

    if request.user.is_authenticated:
        prof = getattr(request.user, "profile", None)
        if not full_name and prof:
            full_name = prof.full_name
        if not national_code and prof:
            national_code = getattr(prof, "national_code", "")

    if not full_name:
        return err("لطفاً نام و نام خانوادگی درخواست‌کننده را وارد کنید.")
    if national_code and (not national_code.isdigit() or len(national_code) != 10):
        return err("کد ملی باید یک عدد ۱۰ رقمی معتبر باشد.")

    day = parse_date(normalize_digits(data["booking_date"]))
    start = normalize_digits(data["start_time"])
    end = normalize_digits(data["end_time"])
    try:
        st = time.fromisoformat(start)
        en = time.fromisoformat(end)
        attendees = int(normalize_digits(data.get("attendees", 1)) or 1)
    except (ValueError, TypeError):
        return err("تاریخ، ساعت یا تعداد شرکت‌کنندگان معتبر نیست.")

    if not day or en <= st or attendees < 1:
        return err("تاریخ، بازه ساعت یا تعداد شرکت‌کنندگان معتبر نیست.")
    if day < timezone.localdate():
        return err("تاریخ رزرو نمی‌تواند در گذشته باشد.")

    conflict = HallBooking.objects.filter(
        hall=data["hall"],
        booking_date=day,
        status__in=["pending", "approved"],
        start_time__lt=en,
        end_time__gt=st,
    ).exists()
    if conflict:
        return err(
            "این سالن در بازه زمانی انتخاب‌شده درخواست رزرو فعال دارد. لطفاً زمان دیگری انتخاب کنید.",
            409,
        )

    user_obj = _resolve_or_create_student(request, full_name, phone, national_code)
    booking = HallBooking.objects.create(
        user=user_obj,
        hall=data["hall"],
        event_title=str(data["event_title"]).strip()[:160],
        full_name=full_name[:120],
        national_code=national_code[:10],
        organization=organization[:160],
        booking_date=day,
        start_time=st,
        end_time=en,
        attendees=attendees,
        phone=phone[:20],
        equipment=equipment[:255],
        note=str(data.get("note", "")).strip()[:2000],
        status="pending",
    )
    return JsonResponse({
        "ok": True,
        "id": booking.id,
        "message": "درخواست رزرو سالن با موفقیت ثبت شد و پس از بررسی مدیریت اطلاع‌رسانی می‌شود.",
    }, status=201)


# ───────────────────────── generic CRUD resources ─────────────────────────

DIGIT_NORMALIZED_FIELDS = {
    "phone", "national_code", "capacity", "guests_count", "attendees",
    "check_in", "check_out", "booking_date", "start_time", "end_time", "arrival_time",
}


class Resource:
    model = None
    writable = ()
    ordering = None

    def queryset(self):
        return self.model.objects.all()

    def to_dict(self, obj):
        raise NotImplementedError

    def assign(self, obj, data):
        """Copy allowed keys from JSON onto the model instance."""
        for name in self.writable:
            if name not in data:
                continue
            field = self.model._meta.get_field(name)
            value = data[name]
            if isinstance(value, str) and name in DIGIT_NORMALIZED_FIELDS:
                value = normalize_digits(value)
            if value == "" and (field.null or field.is_relation):
                value = None
            attr = field.attname  # e.g. instructor -> instructor_id
            setattr(obj, attr, value)

    def save(self, obj, data):
        self.assign(obj, data)
        obj.full_clean()
        obj.save()
        return obj


class CourseRes(Resource):
    model = Course
    writable = (
        "title", "description", "category", "level", "delivery_mode",
        "color", "instructor", "capacity", "is_active",
    )

    def queryset(self):
        return (
            Course.objects.select_related("instructor")
            .annotate(
                enrolled=Count(
                    "enrollments",
                    filter=~Q(enrollments__status="rejected"),
                    distinct=True,
                )
            )
        )

    def to_dict(self, c):
        enrolled = getattr(c, "enrolled", None)
        if enrolled is None:
            enrolled = c.enrollments.exclude(status="rejected").count()
        return {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "category": c.category,
            "level": c.level,
            "delivery_mode": c.delivery_mode,
            "color": c.color,
            "instructor": c.instructor_id,
            "instructor_name": c.instructor.full_name if c.instructor else "",
            "capacity": c.capacity,
            "enrolled": enrolled,
            "is_active": c.is_active,
        }


class EnrollmentRes(Resource):
    model = Enrollment
    writable = (
        "course", "student", "full_name", "national_code",
        "phone", "grade", "school_name", "note", "status",
    )

    def queryset(self):
        return Enrollment.objects.select_related("course", "student", "student__profile")

    def save(self, obj, data):
        # اگر در پنل مدیریت کاربر (student) انتخاب نشده باشد، از روی مشخصات واردشده کاربر دانش‌آموز ساخته یا پیدا می‌شود.
        self.assign(obj, data)
        if not obj.student_id:
            course_obj = Course.objects.filter(pk=obj.course_id).first() if obj.course_id else None
            resolved = _resolve_or_create_student(
                None, obj.full_name, obj.phone, obj.national_code, course=course_obj
            )
            if resolved:
                obj.student = resolved
        elif obj.student_id:
            prof = getattr(obj.student, "profile", None)
            if prof:
                if not obj.full_name:
                    obj.full_name = prof.full_name
                if not obj.phone:
                    obj.phone = prof.phone
                if not obj.national_code:
                    obj.national_code = getattr(prof, "national_code", "")
        obj.full_clean()
        obj.save()
        if obj.status != "rejected" and obj.course_id and obj.student_id:
            Attendance.objects.get_or_create(
                course_id=obj.course_id,
                student_id=obj.student_id,
                date=timezone.localdate(),
                defaults={"status": "present"},
            )
        return obj

    def to_dict(self, e):
        p = getattr(e.student, "profile", None) if e.student else None
        full_name = e.full_name or (p.full_name if p and p.full_name else (e.student.username if e.student else ""))
        phone = e.phone or (p.phone if p and p.phone else "")
        national_code = e.national_code or (getattr(p, "national_code", "") if p else "")
        return {
            "id": e.id,
            "course": e.course_id,
            "course_title": e.course.title if e.course else "",
            "student": e.student_id,
            "full_name": full_name,
            "national_code": national_code,
            "phone": phone,
            "grade": e.grade,
            "school_name": e.school_name,
            "note": e.note,
            "status": e.status,
            "created_at": e.created_at.date().isoformat() if e.created_at else "",
        }


class InstructorRes(Resource):
    model = Instructor
    writable = ("full_name", "specialty", "phone", "bio", "is_active")

    def queryset(self):
        return Instructor.objects.annotate(course_count=Count("courses", distinct=True))

    def to_dict(self, i):
        count = getattr(i, "course_count", None)
        if count is None:
            count = i.courses.count()
        return {
            "id": i.id,
            "full_name": i.full_name,
            "specialty": i.specialty,
            "phone": i.phone,
            "bio": i.bio,
            "is_active": i.is_active,
            "course_count": count,
        }


class AccommodationRes(Resource):
    model = Accommodation
    writable = ("name", "address", "gender", "capacity", "is_active")

    def queryset(self):
        ensure_default_accommodations()
        today = timezone.localdate()
        return Accommodation.objects.annotate(
            occupied=Coalesce(
                Sum(
                    "stays__guests_count",
                    filter=Q(
                        stays__status__in=["pending", "approved"],
                        stays__check_in__lte=today,
                        stays__check_out__gte=today,
                    ),
                ),
                0,
            )
        )

    def to_dict(self, a):
        occ = getattr(a, "occupied", None)
        if occ is None:
            today = timezone.localdate()
            occ = (
                a.stays.filter(
                    status__in=["pending", "approved"],
                    check_in__lte=today,
                    check_out__gte=today,
                ).aggregate(total=Coalesce(Sum("guests_count"), 0))["total"]
                or 0
            )
        return {
            "id": a.id,
            "name": a.name,
            "address": a.address,
            "gender": a.gender,
            "capacity": a.capacity,
            "occupied": occ,
            "is_active": a.is_active,
        }


class StayRes(Resource):
    model = Stay
    writable = (
        "accommodation", "user", "full_name", "national_code", "phone",
        "gender", "room_type", "guests_count", "organization", "purpose",
        "check_in", "check_out", "arrival_time", "needs_catering", "note", "status",
    )

    def queryset(self):
        return Stay.objects.select_related("accommodation", "user", "user__profile")

    def to_dict(self, s):
        p = getattr(s.user, "profile", None) if s.user else None
        user_name = s.full_name or (p.full_name if p and p.full_name else (s.user.username if s.user else "متقاضی مهمان"))
        phone = s.phone or (p.phone if p and p.phone else "")
        national_code = s.national_code or (getattr(p, "national_code", "") if p else "")
        return {
            "id": s.id,
            "accommodation": s.accommodation_id,
            "accommodation_name": s.accommodation.name if s.accommodation else "",
            "user": s.user_id,
            "user_name": user_name,
            "full_name": user_name,
            "national_code": national_code,
            "phone": phone,
            "gender": s.gender,
            "room_type": s.room_type,
            "guests_count": s.guests_count,
            "organization": s.organization,
            "purpose": s.purpose,
            "check_in": s.check_in.isoformat(),
            "check_out": s.check_out.isoformat(),
            "arrival_time": s.arrival_time,
            "needs_catering": s.needs_catering,
            "note": s.note,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else "",
        }


class HallBookingRes(Resource):
    model = HallBooking
    writable = (
        "hall", "event_title", "full_name", "national_code", "organization",
        "booking_date", "start_time", "end_time", "attendees", "phone",
        "equipment", "note", "status",
    )

    def queryset(self):
        return HallBooking.objects.select_related("user", "user__profile")

    def to_dict(self, b):
        p = getattr(b.user, "profile", None) if b.user else None
        user_name = b.full_name or (p.full_name if p and p.full_name else (b.user.username if b.user else "متقاضی"))
        return {
            "id": b.id,
            "user": b.user_id,
            "user_name": user_name,
            "full_name": user_name,
            "national_code": b.national_code or (getattr(p, "national_code", "") if p else ""),
            "organization": b.organization,
            "hall": b.hall,
            "event_title": b.event_title,
            "booking_date": b.booking_date.isoformat(),
            "start_time": b.start_time.strftime("%H:%M"),
            "end_time": b.end_time.strftime("%H:%M"),
            "attendees": b.attendees,
            "phone": b.phone,
            "equipment": b.equipment,
            "note": b.note,
            "status": b.status,
            "created_at": b.created_at.isoformat(),
        }


RESOURCES = {
    "courses": CourseRes(),
    "enrollments": EnrollmentRes(),
    "instructors": InstructorRes(),
    "accommodations": AccommodationRes(),
    "stays": StayRes(),
    "bookings": HallBookingRes(),
}


@admin_required
@require_http_methods(["GET", "POST"])
def resource_list(request, name):
    res = RESOURCES.get(name)
    if res is None:
        return err("منبع پیدا نشد.", 404)
    if request.method == "GET":
        return JsonResponse({"items": [res.to_dict(o) for o in res.queryset()]})
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    try:
        obj = res.save(res.model(), data)
    except ValidationError as e:
        return validation_response(e)
    except IntegrityError:
        return err("این رکورد قبلاً ثبت شده است.", 409)
    except (ValueError, TypeError):
        return err("مقدار نامعتبر است.")
    return JsonResponse(res.to_dict(res.queryset().get(pk=obj.pk)), status=201)


@admin_required
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def resource_detail(request, name, pk):
    res = RESOURCES.get(name)
    if res is None:
        return err("منبع پیدا نشد.", 404)
    try:
        obj = res.queryset().get(pk=pk)
    except res.model.DoesNotExist:
        return err("یافت نشد.", 404)
    if request.method == "GET":
        return JsonResponse(res.to_dict(obj))
    if request.method == "DELETE":
        obj.delete()
        return JsonResponse({"ok": True})
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    try:
        res.save(obj, data)
    except ValidationError as e:
        return validation_response(e)
    except IntegrityError:
        return err("تداخل با رکوردهای موجود وجود دارد.", 409)
    except (ValueError, TypeError):
        return err("مقدار نامعتبر است.")
    return JsonResponse(res.to_dict(res.queryset().get(pk=pk)))


# ───────────────────────────── users ─────────────────────────────

def _apply_user(user, data, creating):
    """Validate + save a user and its profile. Raises ValidationError."""
    errors = {}
    if creating or "username" in data:
        username = str(data.get("username", "")).strip()
        if not USERNAME_RE.match(username):
            errors["username"] = "نام کاربری باید ۳ تا ۲۴ حرف انگلیسی، عدد یا زیرخط باشد."
        elif User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists():
            errors["username"] = "این نام کاربری قبلاً ثبت شده است."
        else:
            user.username = username
    password = str(data.get("password", ""))
    if creating or password:
        try:
            validate_password(password, user)
            user.set_password(password)
        except ValidationError as e:
            errors["password"] = " ".join(e.messages)
    if errors:
        raise ValidationError(errors)
    if "role" in data:
        user.is_staff = data["role"] == "admin"
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    with transaction.atomic():
        user.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        if "full_name" in data:
            profile.full_name = str(data["full_name"])[:120]
        if "phone" in data:
            profile.phone = normalize_digits(data["phone"])[:20]
        if "national_code" in data:
            profile.national_code = normalize_digits(data["national_code"])[:10]
        profile.save()


@admin_required
@require_http_methods(["GET", "POST"])
def users_list(request):
    if request.method == "GET":
        qs = User.objects.select_related("profile").order_by("-date_joined")
        return JsonResponse({"items": [user_dict(u) for u in qs]})
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    user = User()
    try:
        _apply_user(user, data, creating=True)
    except ValidationError as e:
        return validation_response(e)
    return JsonResponse(user_dict(user), status=201)


@admin_required
@require_http_methods(["GET", "PUT", "PATCH", "DELETE"])
def users_detail(request, pk):
    try:
        user = User.objects.select_related("profile").get(pk=pk)
    except User.DoesNotExist:
        return err("یافت نشد.", 404)
    if request.method == "GET":
        return JsonResponse(user_dict(user))
    if user.pk == request.user.pk and request.method == "DELETE":
        return err("حساب خودتان را نمی‌توانید حذف کنید.", 400)
    if request.method == "DELETE":
        user.delete()
        return JsonResponse({"ok": True})
    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    if user.pk == request.user.pk:
        data = {k: v for k, v in data.items() if k not in ("role", "is_active")}
    try:
        _apply_user(user, data, creating=False)
    except ValidationError as e:
        return validation_response(e)
    return JsonResponse(user_dict(user))


# ───────────────────────── enrollments & attendance ─────────────────────────

@admin_required
@require_http_methods(["GET", "PUT"])
def course_enrollments(request, pk):
    try:
        course = Course.objects.get(pk=pk)
    except Course.DoesNotExist:
        return err("دوره پیدا نشد.", 404)
    if request.method == "GET":
        ids = list(course.enrollments.exclude(status="rejected").values_list("student_id", flat=True))
        return JsonResponse({"student_ids": ids})
    data = body_of(request)
    ids = data.get("student_ids") if data else None
    if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
        return err("فهرست دانش‌آموزان نامعتبر است.")
    ids = set(ids)
    if len(ids) > course.capacity:
        return err(f"ظرفیت دوره ({course.capacity} نفر) تکمیل است.")
    valid_users = User.objects.filter(pk__in=ids).select_related("profile")
    valid = {u.pk: u for u in valid_users}
    today = timezone.localdate()
    with transaction.atomic():
        course.enrollments.exclude(student_id__in=valid.keys()).delete()
        existing = set(course.enrollments.values_list("student_id", flat=True))
        for uid in set(valid.keys()) - existing:
            u = valid[uid]
            p = getattr(u, "profile", None)
            Enrollment.objects.create(
                course=course,
                student_id=uid,
                full_name=p.full_name if p else "",
                phone=p.phone if p else "",
                national_code=getattr(p, "national_code", "") if p else "",
                status="approved",
            )
            Attendance.objects.get_or_create(
                course=course,
                student_id=uid,
                date=today,
                defaults={"status": "present"},
            )
    return JsonResponse({"student_ids": sorted(valid.keys())})


@admin_required
@require_http_methods(["GET", "POST"])
def attendance_view(request):
    if request.method == "GET":
        course_id, day = request.GET.get("course"), parse_date(normalize_digits(request.GET.get("date", "")))
        if not course_id or not day:
            return err("دوره و تاریخ لازم است.")
        try:
            course = Course.objects.get(pk=int(course_id))
        except (Course.DoesNotExist, ValueError):
            return err("دوره پیدا نشد.", 404)
        saved = dict(
            Attendance.objects.filter(course=course, date=day)
            .values_list("student_id", "status")
        )
        enrollments = (
            Enrollment.objects.filter(course=course)
            .exclude(status="rejected")
            .select_related("student", "student__profile")
        )
        records = []
        for enr in enrollments:
            s = enr.student
            p = getattr(s, "profile", None) if s else None
            u_info = user_dict(s) if s else {}
            name = enr.full_name or u_info.get("full_name") or (s.username if s else "")
            national_code = enr.national_code or (getattr(p, "national_code", "") if p else "")
            phone = enr.phone or (p.phone if p else "")
            records.append({
                "student": s.id,
                "enrollment_id": enr.id,
                "name": name,
                "full_name": name,
                "national_code": national_code,
                "phone": phone,
                "grade": enr.grade or "",
                "school_name": enr.school_name or "",
                "note": enr.note or "",
                "enrolled_at": enr.created_at.date().isoformat() if enr.created_at else "",
                "status": saved.get(s.id, "present"),
            })
        records.sort(key=lambda r: r["name"])
        return JsonResponse({"records": records})

    data = body_of(request)
    if data is None:
        return err("درخواست نامعتبر است.")
    day = parse_date(normalize_digits(str(data.get("date", ""))))
    records = data.get("records")
    if not day or not isinstance(records, list):
        return err("اطلاعات نامعتبر است.")
    try:
        course = Course.objects.get(pk=int(data.get("course")))
    except (Course.DoesNotExist, TypeError, ValueError):
        return err("دوره پیدا نشد.", 404)
    allowed = {s for s, _ in Attendance.STATUSES}
    enrolled = set(course.enrollments.exclude(status="rejected").values_list("student_id", flat=True))
    with transaction.atomic():
        for r in records:
            if (not isinstance(r, dict) or r.get("status") not in allowed
                    or r.get("student") not in enrolled):
                continue
            Attendance.objects.update_or_create(
                course=course,
                student_id=r["student"],
                date=day,
                defaults={"status": r["status"]},
            )
    return JsonResponse({"ok": True})


# ───────────────────────────── گزارشات ─────────────────────────────

@admin_required
@require_http_methods(["GET"])
def reports(request):
    ensure_default_accommodations()
    today = timezone.localdate()
    present_q = Q(attendance__status__in=("present", "late"))
    courses = []
    for c in Course.objects.annotate(
        enrolled=Count("enrollments", filter=~Q(enrollments__status="rejected"), distinct=True),
        marks=Count("attendance", distinct=True),
        came=Count("attendance", filter=present_q, distinct=True),
    ):
        courses.append({
            "id": c.id,
            "title": c.title,
            "capacity": c.capacity,
            "enrolled": c.enrolled,
            "attendance_rate": round(c.came * 100 / c.marks) if c.marks else None,
        })

    daily = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        qs = Attendance.objects.filter(date=d)
        total = qs.count()
        came = qs.filter(status__in=("present", "late")).count()
        daily.append({
            "date": d.isoformat(),
            "rate": round(came * 100 / total) if total else None,
        })

    acc_cap = sum(Accommodation.objects.filter(is_active=True).values_list("capacity", flat=True))
    acc_occ = (
        Stay.objects.filter(
            status__in=["pending", "approved"],
            check_in__lte=today,
            check_out__gte=today,
        ).aggregate(total=Coalesce(Sum("guests_count"), 0))["total"]
        or 0
    )
    return JsonResponse({
        "totals": {
            "students": User.objects.filter(is_staff=False).count(),
            "courses": Course.objects.filter(is_active=True).count(),
            "instructors": Instructor.objects.filter(is_active=True).count(),
            "accommodation_capacity": acc_cap,
            "accommodation_occupied": acc_occ,
            "enrollments": Enrollment.objects.exclude(status="rejected").count(),
            "pending_stays": Stay.objects.filter(status="pending").count(),
            "pending_bookings": HallBooking.objects.filter(status="pending").count(),
        },
        "courses": courses,
        "daily_attendance": daily,
    })
