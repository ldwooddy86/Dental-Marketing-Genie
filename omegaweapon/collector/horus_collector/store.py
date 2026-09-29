"""Local SQLite store. Everything stays on this machine. Floor authors are stored only as pseudonyms;
content deleted at the source is purged, not kept."""
from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import dataclass, field

from .util import now

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources(
  id TEXT PRIMARY KEY, kind TEXT, label TEXT, eye TEXT, lane TEXT, platform TEXT, community TEXT,
  added INTEGER, last_ok INTEGER, last_error TEXT);
CREATE TABLE IF NOT EXISTS items(
  id TEXT PRIMARY KEY, source_id TEXT, kind TEXT, eye TEXT, lane TEXT, platform TEXT, community TEXT,
  ts INTEGER, title TEXT, text TEXT, url TEXT, author TEXT, engagement TEXT, raw TEXT,
  fetched INTEGER, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS cursors(source_id TEXT PRIMARY KEY, value TEXT, updated INTEGER);
CREATE INDEX IF NOT EXISTS items_ts ON items(ts);
CREATE INDEX IF NOT EXISTS items_kind ON items(kind, ts);
"""


@dataclass
class Item:
    id: str
    source_id: str
    kind: str
    eye: str
    lane: str
    platform: str
    community: str
    ts: int
    title: str
    text: str = ""
    url: str = ""
    author: str | None = None
    engagement: dict = field(default_factory=dict)
    raw: dict = field(default_factory=dict)


class Store:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.executescript(SCHEMA)

    def upsert_source(self, sid, kind, label, eye, lane, platform, community):
        self.db.execute(
            "INSERT INTO sources(id,kind,label,eye,lane,platform,community,added) VALUES(?,?,?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET label=excluded.label, eye=excluded.eye, lane=excluded.lane, "
            "platform=excluded.platform, community=excluded.community",
            (sid, kind, label, eye, lane, platform, community, now()))

    def source_ok(self, sid):
        self.db.execute("UPDATE sources SET last_ok=?, last_error=NULL WHERE id=?", (now(), sid))

    def source_error(self, sid, err):
        self.db.execute("UPDATE sources SET last_error=? WHERE id=?", (str(err)[:500], sid))

    def add_item(self, it: Item) -> bool:
        cur = self.db.execute(
            "INSERT OR IGNORE INTO items(id,source_id,kind,eye,lane,platform,community,ts,title,text,url,author,engagement,raw,fetched) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (it.id, it.source_id, it.kind, it.eye, it.lane, it.platform, it.community, int(it.ts), it.title, it.text,
             it.url, it.author, json.dumps(it.engagement or {}), json.dumps(it.raw or {}), now()))
        if cur.rowcount == 1:
            return True
        if it.engagement:  # refresh counts on items seen before
            self.db.execute("UPDATE items SET engagement=? WHERE id=? AND deleted=0", (json.dumps(it.engagement), it.id))
        return False

    def cursor(self, sid):
        r = self.db.execute("SELECT value FROM cursors WHERE source_id=?", (sid,)).fetchone()
        return r[0] if r else None

    def set_cursor(self, sid, value):
        self.db.execute("INSERT INTO cursors(source_id,value,updated) VALUES(?,?,?) ON CONFLICT(source_id) DO UPDATE SET value=excluded.value, updated=excluded.updated",
                        (sid, str(value), now()))

    def mark_deleted(self, item_id):
        """Deleted at the source: purge the content, keep only the fact that an item existed."""
        self.db.execute("UPDATE items SET deleted=1, title='[deleted at source]', text='', author=NULL, raw='{}', url='' WHERE id=?", (item_id,))

    def raw_for(self, kind, since_ts):
        return [(r[0], json.loads(r[1] or "{}")) for r in self.db.execute(
            "SELECT id, raw FROM items WHERE kind=? AND ts>=? AND deleted=0", (kind, int(since_ts)))]

    def items(self, since_ts=None, until_ts=None, include_deleted=False):
        q, a = "SELECT id,source_id,kind,eye,lane,platform,community,ts,title,text,url,author,engagement FROM items WHERE 1=1", []
        if since_ts is not None:
            q += " AND ts>=?"; a.append(int(since_ts))
        if until_ts is not None:
            q += " AND ts<=?"; a.append(int(until_ts))
        if not include_deleted:
            q += " AND deleted=0"
        q += " ORDER BY ts"
        cols = ["id", "source_id", "kind", "eye", "lane", "platform", "community", "ts", "title", "text", "url", "author", "engagement"]
        out = []
        for r in self.db.execute(q, a):
            d = dict(zip(cols, r))
            d["engagement"] = json.loads(d["engagement"] or "{}")
            out.append(d)
        return out

    def status(self):
        return self.db.execute(
            "SELECT s.id, s.label, s.eye, s.lane, COUNT(i.id), MAX(i.ts), s.last_ok, s.last_error FROM sources s "
            "LEFT JOIN items i ON i.source_id=s.id AND i.deleted=0 GROUP BY s.id ORDER BY s.eye, s.lane, s.label").fetchall()

    def commit(self):
        self.db.commit()

    def close(self):
        self.db.commit()
        self.db.close()
