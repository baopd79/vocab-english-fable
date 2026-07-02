from config.settings.base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Dev-only: HTML forms when opening endpoints in a browser (manual testing).
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}
