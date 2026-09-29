"""Import exports you are entitled to: LinkedIn and X data exports, listening-tool exports, Slack or
WhatsApp exports of rooms you belong to (with the room's consent), or hand-built CSV/JSON lists.
Each file maps its columns to Horus fields. Floor authors are pseudonymized on import."""
from __future__ import annotations

import csv
import json
import logging
from pathlib import Path

from ..store import Item
from ..util import clean_text, first_line, parse_date, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.csv")
FIELDS = ("title", "text", "url", "date", "author", "community", "replies", "views", "likes")


def read_rows(path: Path) -> list[dict]:
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("items", [])
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def map_row(row: dict, mapping: dict) -> dict:
    get = lambda f: row.get(mapping.get(f, f)) if mapping.get(f, f) in row else None  # noqa: E731
    out = {f: get(f) for f in FIELDS}
    out["ts"] = parse_date(out.pop("date"))
    for k in ("replies", "views", "likes"):
        try:
            out[k] = int(str(out[k]).replace(",", "")) if out[k] not in (None, "") else None
        except ValueError:
            out[k] = None
    out["text"] = clean_text(out["text"], 4000)
    out["title"] = clean_text(out["title"], 300) or first_line(out["text"])
    return out


@register_connector
class CsvImport(Connector):
    kind = "csv_import"
    default_eye = "moon"
    default_lane = "import"

    def missing(self):
        m = [] if self.cfg.get("files") else ["files"]
        for f in self.cfg.get("files", []):
            if not Path(f.get("path", "")).expanduser().exists():
                m.append(f"file not found: {f.get('path')}")
        return m

    def collect(self) -> Stats:
        st = Stats()
        for f in self.cfg.get("files", []):
            path = Path(f.get("path", "")).expanduser()
            eye, lane, platform = f.get("eye", self.eye), f.get("lane", self.lane), f.get("platform", "Import")
            sid = self.register(sha1(str(path)), f"{platform}: {path.name}", platform, eye, lane, platform)
            try:
                n = 0
                for row in read_rows(path):
                    r = map_row(row, f.get("map", {}))
                    if not r["ts"] or not (r["title"] or r["text"]):
                        continue
                    eng = {k: r[k] for k in ("replies", "views", "likes") if r[k] is not None}
                    n += self.emit(Item(id=sha1(self.kind, platform, r["url"] or r["title"], r["ts"]), source_id=sid, kind=self.kind, eye=eye,
                                        lane=lane, platform=platform, community=r["community"] or f.get("community", platform), ts=r["ts"],
                                        title=r["title"], text=r["text"], url=r["url"] or "", author=self.author(r["author"], eye), engagement=eng))
                self.store.source_ok(sid)
                st.items += n
            except Exception as ex:
                self.store.source_error(sid, ex)
                st.errors.append(f"{path.name}: {ex}")
        return st
