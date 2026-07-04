from django.urls import path

from .views import StatsDailyView, StatsOverviewView

urlpatterns = [
    path("stats/overview", StatsOverviewView.as_view(), name="stats-overview"),
    path("stats/daily", StatsDailyView.as_view(), name="stats-daily"),
]
