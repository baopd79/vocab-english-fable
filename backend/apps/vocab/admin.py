"""Admin registrations for vocab models."""

from django.contrib import admin

from .models import Deck, UserWord, WordCache


@admin.register(Deck)
class DeckAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "visibility", "created_at")
    search_fields = ("name", "owner__email")


@admin.register(WordCache)
class WordCacheAdmin(admin.ModelAdmin):
    list_display = ("word", "status", "provider", "model", "updated_at")
    list_filter = ("status",)
    search_fields = ("word",)


@admin.register(UserWord)
class UserWordAdmin(admin.ModelAdmin):
    list_display = ("word_text", "user", "deck", "enrichment_status", "due_at")
    list_filter = ("enrichment_status",)
    search_fields = ("word_text", "user__email")
