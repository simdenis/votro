"""Paging for PostgREST reads.

Supabase caps every REST response at 1000 rows and silently ignores a bigger
`limit`. A read that outgrows the cap does not fail — it returns a truncated
answer that looks complete, which is how presidential_scraper quietly stopped
checking a couple of hundred laws and how the newsletter's absence ranking
started counting participations that were never fetched. Anything reading a
table that can pass 1000 rows goes through here.

Two entry points, because the scripts talk to Supabase two ways: the
supabase-py client (`fetch_all`) and plain REST through requests (`rest_all`).

Both require an order. PostgREST promises no row order without one, so paging
an unordered set can hand back the same row twice and never show another.
"""
from __future__ import annotations

from typing import Any, Callable

PAGE = 1000


def fetch_all(
    make_query: Callable[[], Any],
    *,
    order_by: str = "id",
    page: int = PAGE,
    total: int | None = None,
) -> list[dict]:
    """Every row of a supabase-py query.

    `make_query` must build a fresh query each call —
    `lambda: db.table("laws").select("id, code").is_("summary", "null")` —
    because a builder keeps the `.range()` from the previous page.

    `total` stops after that many rows. Pass a CLI --limit through it rather
    than as `.limit()`: a `.limit()` above 1000 is clamped, so a batch script
    asking for 2000 laws quietly processes 1000 and reports success.
    """
    out: list[dict] = []
    start = 0
    while True:
        size = page if total is None else min(page, total - len(out))
        if size <= 0:
            return out
        batch = (
            make_query().order(order_by).range(start, start + size - 1).execute().data
            or []
        )
        out.extend(batch)
        if len(batch) < size:
            return out
        start += size


def rest_all(
    get: Callable[..., list[dict]],
    table: str,
    *,
    order: str = "id",
    page: int = PAGE,
    total: int | None = None,
    **params: str,
) -> list[dict]:
    """Every row of a plain-REST query.

    `get(table, **params) -> list[dict]` is the caller's own request wrapper, so
    each script keeps its own headers, timeouts and error handling. `total`
    works as in fetch_all().
    """
    out: list[dict] = []
    offset = 0
    while True:
        size = page if total is None else min(page, total - len(out))
        if size <= 0:
            return out
        batch = get(table, order=order, limit=str(size), offset=str(offset), **params) or []
        out.extend(batch)
        if len(batch) < size:
            return out
        offset += size
