from django.contrib import admin

from .models import ReviewLog


@admin.register(ReviewLog)
class ReviewLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "user_word", "rating", "interval_after", "reviewed_at")
    list_filter = ("rating",)
    raw_id_fields = ("user", "user_word")
