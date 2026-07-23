"""
Shared pagination for public list endpoints.

Matches the response shape the library and payment-history endpoints already
return, so every paginated list in the API looks the same:

    {
      "results": [...],
      "pagination": {
        "page": 1, "page_size": 24, "total_items": 130,
        "total_pages": 6, "has_next": true, "has_previous": false
      }
    }
"""

from collections import OrderedDict

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = 'page_size'
    # Cap it: page_size is caller-supplied, and without a ceiling anyone can
    # ask for the whole table in one request.
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(OrderedDict([
            ('results', data),
            ('pagination', OrderedDict([
                ('page', self.page.number),
                ('page_size', self.get_page_size(self.request)),
                ('total_items', self.page.paginator.count),
                ('total_pages', self.page.paginator.num_pages),
                ('has_next', self.page.has_next()),
                ('has_previous', self.page.has_previous()),
            ])),
        ]))


def paginate_list(request, items, serialize=None, default_page_size=24, max_page_size=100):
    """
    Same shape, for plain APIViews that build their own data.

    `items` may be a queryset or a list. `serialize` maps one item to its
    output dict; omit it if the items are already serialisable.
    """
    try:
        page = max(1, int(request.GET.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.GET.get('page_size', default_page_size))
    except (TypeError, ValueError):
        page_size = default_page_size
    page_size = max(1, min(page_size, max_page_size))

    total_items = items.count() if hasattr(items, 'count') else len(items)
    total_pages = max(1, (total_items + page_size - 1) // page_size)
    offset = (page - 1) * page_size

    window = items[offset:offset + page_size]
    results = [serialize(i) for i in window] if serialize else list(window)

    return {
        'results': results,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_items': total_items,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_previous': page > 1,
        },
    }
