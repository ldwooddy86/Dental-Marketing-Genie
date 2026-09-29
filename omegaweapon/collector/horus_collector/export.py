"""Export stored items in a date window as raw items for scripts/horus_prefilter.py (JSON Lines).
Floor authors leave only as pseudonyms, so the coder can cap one loud voice without knowing who it is."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from .store import Store
from .util import ts_to_date


def _epoch(day: str, end: bool = False) -> int:
    d = dt.datetime.fromisoformat(day).replace(tzinfo=dt.timezone.utc)
    return int((d + dt.timedelta(days=1) - dt.timedelta(seconds=1)).timestamp()) if end else int(d.timestamp())


def export(store: Store, since: str, until: str, out: Path) -> int:
    rows = store.items(_epoch(since), _epoch(until, end=True))
    with out.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps({
                "id": r["id"], "eye": r["eye"], "lane": r["lane"], "platform": r["platform"], "community": r["community"],
                "date": ts_to_date(r["ts"]), "title": r["title"], "text": r["text"], "url": r["url"],
                "engagement": r["engagement"], "author": r["author"],
            }, ensure_ascii=False) + "\n")
    return len(rows)
