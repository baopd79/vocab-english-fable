from config.settings.base import *  # noqa: F403

DEBUG = False

# Nginx terminates TLS and forwards the original scheme (SPEC §13). Django
# must trust this header so request.is_secure() is True behind the proxy —
# it drives the Secure flag on the refresh cookie and CSRF origin checks.
# The http→https redirect itself is Nginx's job (Task 21), not Django's.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Static files exist in prod only for the Django admin (the app UI is Next.js).
# Whitenoise serves them straight from gunicorn, so Nginx needs no static
# block and the files ship inside the image (collectstatic at build time).
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# HSTS is enabled in Task 21 only after certbot + HTTPS are verified live —
# a wrong HSTS header pins browsers to a broken config for its whole max-age.
