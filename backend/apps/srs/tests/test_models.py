"""ReviewLog model behaviour (SPEC §5): history survives word deletion."""

import pytest

from apps.srs.factories import ReviewLogFactory
from apps.srs.models import ReviewLog

pytestmark = pytest.mark.django_db


def test_deleting_user_word_nulls_log_but_keeps_it():
    log = ReviewLogFactory()
    log.user_word.delete()
    log.refresh_from_db()
    assert log.user_word is None
    assert ReviewLog.objects.filter(pk=log.pk).exists()


def test_deleting_user_keeps_no_orphan_logs():
    # user FK cascades — a user's own logs go with them.
    log = ReviewLogFactory()
    user = log.user
    user.delete()
    assert not ReviewLog.objects.filter(pk=log.pk).exists()
