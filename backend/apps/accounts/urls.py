from django.urls import path

from .views import GoogleLoginView, LogoutView, MeSettingsView, MeView, RefreshView

urlpatterns = [
    path("auth/google", GoogleLoginView.as_view(), name="auth-google"),
    path("auth/refresh", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("me", MeView.as_view(), name="me"),
    path("me/settings", MeSettingsView.as_view(), name="me-settings"),
]
