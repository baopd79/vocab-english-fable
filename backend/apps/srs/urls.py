from django.urls import path

from .views import ReviewAnswerView, ReviewQueueView

urlpatterns = [
    path("review/queue", ReviewQueueView.as_view(), name="review-queue"),
    path("review/answer", ReviewAnswerView.as_view(), name="review-answer"),
]
