from django.conf import settings
from django.contrib import admin
from django.http import Http404
from django.shortcuts import redirect
from django.urls import include, path, re_path
from django.views.static import serve

# پوشه‌هایی که هرگز نباید از طریق وب‌سرور توسعه نمایش داده شوند (کد سرور، گیت و تنظیمات ویرایشگر).
BLOCKED_PREFIXES = ("backend", ".git", ".vscode", ".venv", "venv")

# نگاشت سازگاری برای فایل‌های منتقل‌شده به پوشه‌های استاندارد css/ و js/
LEGACY_ASSET_MAP = {
    "style.css": "css/style.css",
    "Login.css": "css/Login.css",
    "public-pages.css": "css/public-pages.css",
    "css/dashboard-login.css": "dashboard-login.css",
    "main.js": "js/main.js",
    "script.js": "js/script.js",
    "Login.js": "js/Login.js",
    "courses.js": "js/courses.js",
    "public-pages.js": "js/public-pages.js",
    "register.js": "js/register.js",
    "js/dashboard-login.js": "dashboard-login.js",
}


# نمایش فایل‌های سایت و داشبورد از ریشه‌ی پروژه؛ فقط برای توسعه.
def frontend(request, path=""):
    """Development-only: serve the static site and dashboard from the project root."""
    path = path.strip("/")
    first = path.split("/")[0] if path else ""
    if first in BLOCKED_PREFIXES or first.startswith("."):
        raise Http404
    if not path:
        path = "index.html"
    elif path == "dashboard":
        if not request.path.endswith("/"):
            return redirect("/dashboard/")      # keep relative asset links working
        path = "dashboard/index.html"
    elif path in ("user-dashboard", "student-dashboard", "panel"):
        path = "dashboard-login.html"
    elif path in LEGACY_ASSET_MAP:
        path = LEGACY_ASSET_MAP[path]
    return serve(request, path, document_root=settings.FRONTEND_DIR)


# مسیرهای اصلی: پنل ادمین جنگو و API.
urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include("core.urls")),
]

# مسیر فراگیر (catch-all) برای سایت ایستا فقط در حالت توسعه فعال است.
if settings.DEBUG:
    urlpatterns += [
        re_path(r"^(?P<path>.*)$", frontend),
    ]
