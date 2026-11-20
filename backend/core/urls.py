from django.urls import path

from . import views

# مسیرهای API؛ همگی زیر پیشوند /api/ هستند (در nivad/urls.py include شده‌اند).
urlpatterns = [
    # auth (used by the public site, student dashboard, and admin dashboard)
    path("auth/me/", views.me),
    path("auth/login/", views.login_view),
    path("auth/logout/", views.logout_view),
    path("auth/register/", views.register_view),

    # public
    path("public/courses/", views.public_courses),
    path("public/instructors/", views.public_instructors),
    path("public/accommodations/", views.public_accommodations),
    path("public/stays/", views.public_stay_booking),
    path("public/courses/<int:course_id>/enroll/", views.public_enroll),
    path("public/enrollments/", views.public_enroll),
    path("public/bookings/", views.public_hall_booking),

    # student dashboard (used by dashboard-login.html)
    path("student/dashboard/", views.student_dashboard),
    path("student/enroll/", views.student_enroll),

    # dashboard (staff only)
    path("dashboard/users/", views.users_list),
    path("dashboard/users/<int:pk>/", views.users_detail),
    path("dashboard/courses/<int:pk>/enrollments/", views.course_enrollments),
    path("dashboard/attendance/", views.attendance_view),
    path("dashboard/reports/", views.reports),
    path("dashboard/<str:name>/", views.resource_list),
    path("dashboard/<str:name>/<int:pk>/", views.resource_detail),
]
