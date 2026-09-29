"""Shared helpers: hashing, text cleaning, pseudonyms, dates and a polite HTTP client (stdlib only)."""
from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import html
import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request

log = logging.getLogger("horus.http")
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def sha1(*parts) -> str:
    return hashlib.sha1("\x1f".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:16]


def clean_text(s, limit: int = 4000) -> str:
    if not s:
        return ""
    s = WS_RE.sub(" ", html.unescape(TAG_RE.sub(" ", str(s)))).strip()
    return s[:limit]


def first_line(text: str, limit: int = 160) -> str:
    line = (text or "").strip().splitlines()[0] if (text or "").strip() else ""
    return line if len(line) <= limit else line[: limit - 1].rstrip() + "…"


def pseudonym(author, salt: str):
    """Stable, non-reversible pseudonym for a floor author. The raw handle is never stored."""
    if author in (None, "", "[deleted]"):
        return None
    return "p_" + hashlib.sha256((salt + "\x1f" + str(author).lower()).encode("utf-8")).hexdigest()[:10]


def now() -> int:
    return int(time.time())


def ts_to_date(ts) -> str:
    return dt.datetime.fromtimestamp(int(ts), dt.timezone.utc).strftime("%Y-%m-%d")


def parse_date(s):
    """RFC 822 (RSS), ISO 8601 (Atom and most APIs) or epoch seconds -> epoch seconds, UTC."""
    if s is None or s == "":
        return None
    if isinstance(s, (int, float)):
        return int(s)
    s = str(s).strip()
    if s.isdigit():
        return int(s)
    try:
        d = email.utils.parsedate_to_datetime(s)
        if d is not None:
            return int((d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).timestamp())
    except (TypeError, ValueError, IndexError):
        pass
    try:
        d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int((d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).timestamp())
    except ValueError:
        return None


class Http:
    """urllib with a truthful User-Agent, a per-host minimum interval, and backoff on 429 and 5xx
    that honours Retry-After. Request URLs are never logged (some APIs carry tokens in the path)."""

    def __init__(self, user_agent: str, min_interval: float = 1.0, timeout: float = 25, retries: int = 3):
        self.user_agent = user_agent
        self.min_interval = float(min_interval)
        self.timeout = timeout
        self.retries = retries
        self._last: dict[str, float] = {}

    def _wait(self, host: str) -> None:
        gap = time.monotonic() - self._last.get(host, 0.0)
        if gap < self.min_interval:
            time.sleep(self.min_interval - gap)
        self._last[host] = time.monotonic()

    def request(self, url: str, params=None, headers=None, data=None, json_body=None, method=None) -> bytes:
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params, doseq=True)
        host = urllib.parse.urlsplit(url).netloc
        hdrs = {"User-Agent": self.user_agent, "Accept": "application/json, application/rss+xml, application/xml;q=0.9, */*;q=0.5"}
        body = None
        if json_body is not None:
            body = json.dumps(json_body).encode("utf-8")
            hdrs["Content-Type"] = "application/json"
        elif data is not None:
            body = urllib.parse.urlencode(data).encode("utf-8") if isinstance(data, dict) else data
        hdrs.update(headers or {})
        for attempt in range(self.retries + 1):
            self._wait(host)
            req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < self.retries:
                    ra = e.headers.get("Retry-After") if e.headers else None
                    delay = float(ra) if ra and ra.replace(".", "", 1).isdigit() else 2.0 * 2 ** attempt
                    log.warning("HTTP %s from %s; retrying in %.0fs", e.code, host, delay)
                    time.sleep(min(delay, 120))
                    continue
                raise RuntimeError(f"HTTP {e.code} from {host}") from None
            except urllib.error.URLError as e:
                if attempt < self.retries:
                    time.sleep(2.0 * 2 ** attempt)
                    continue
                raise RuntimeError(f"cannot reach {host}: {e.reason}") from None
        raise RuntimeError(f"gave up on {host}")

    def get_json(self, url, params=None, headers=None):
        return json.loads(self.request(url, params=params, headers=headers).decode("utf-8"))

    def get_text(self, url, params=None, headers=None) -> str:
        return self.request(url, params=params, headers=headers).decode("utf-8", "replace")

    def post_json(self, url, data=None, json_body=None, headers=None):
        return json.loads(self.request(url, data=data, json_body=json_body, headers=headers, method="POST").decode("utf-8"))
