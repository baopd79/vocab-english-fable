"""Shared pagination defaults."""

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Page-number pagination, 50 items per page (SPEC: deck/word lists)."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100
