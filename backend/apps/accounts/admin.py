"""Admin registrations for account models."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, UserSettings


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "display_name", "is_staff", "date_joined")
    fieldsets = (
        *DjangoUserAdmin.fieldsets,
        ("Google profile", {"fields": ("google_sub", "display_name", "avatar_url")}),
    )
    readonly_fields = ("google_sub",)


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "new_words_per_day", "max_reviews_per_day", "timezone")
