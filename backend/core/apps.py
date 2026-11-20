from django.apps import AppConfig


# تنظیمات اپلیکیشن اصلی (core) که مدل‌ها و API پروژه در آن قرار دارد.
class CoreConfig(AppConfig):

    default_auto_field = "django.db.models.BigAutoField"

    name = "core"

    verbose_name = "کانون دانش‌آموزی"
