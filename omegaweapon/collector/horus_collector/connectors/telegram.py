"""Telegram, two read-only lanes.

telegram_user: your own account through Telethon (the official MTProto API). Reads public channels
and chats the account can already read. Never sends, joins, reacts or marks anything read in a way
that posts. Log in once with `python -m horus_collector login telegram`; the session file stays in
data_dir. Channel posts are attributed to the channel (a public room); group members are pseudonymized.

telegram_bot: a bot token through the Bot API. A bot only sees chats it was added to (channel posts
where it is an admin, group messages where privacy mode allows) and only from the moment it joined."""
from __future__ import annotations

import logging
import os

from ..store import Item
from ..util import clean_text, first_line, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.telegram")


@register_connector
class TelegramUser(Connector):
    kind = "telegram"
    platform = "Telegram"
    default_eye = "moon"
    default_lane = "telegram"
    is_async = True

    def missing(self):
        m = []
        if not self.cfg.get("api_id"):
            m.append("api_id (https://my.telegram.org)")
        if not self.secret("api_hash"):
            m.append("api_hash_env variable")
        if not self.cfg.get("channels"):
            m.append("channels")
        return m

    def session_path(self) -> str:
        return os.path.join(self.general["data_dir"], self.cfg.get("session", "horus_user"))

    def client(self):
        try:
            from telethon import TelegramClient
        except ImportError as e:
            raise RuntimeError("telethon is not installed: pip install telethon") from e
        return TelegramClient(self.session_path(), int(self.cfg["api_id"]), self.secret("api_hash"))

    async def login(self) -> None:
        client = self.client()
        await client.start()  # interactive: phone, code, 2FA password
        me = await client.get_me()
        log.info("Telegram session ready for %s", getattr(me, "username", None) or "your account")
        await client.disconnect()

    async def collect(self) -> Stats:
        st = Stats()
        miss = self.missing()
        if miss:
            st.errors.append("telegram not configured: " + ", ".join(miss))
            return st
        client = self.client()
        await client.connect()
        try:
            if not await client.is_user_authorized():
                raise RuntimeError("Telegram session not authorised; run: python -m horus_collector login telegram")
            limit = int(self.cfg.get("max_messages_per_channel", 200))
            for ch in self.cfg.get("channels", []):
                ident = str(ch).strip().lstrip("@")
                sid = self.register(ident.lower(), "@" + ident, "@" + ident)
                try:
                    ent = await client.get_entity(int(ident) if ident.lstrip("-").isdigit() else ident)
                    title = getattr(ent, "title", None) or ident
                    uname = getattr(ent, "username", None)
                    broadcast = bool(getattr(ent, "broadcast", False))
                    community = "@" + uname if uname else title
                    self.store.upsert_source(sid, self.kind, title, self.eye, self.lane, self.platform, community)
                    min_id = int(self.store.cursor(sid) or 0)
                    newest, n = min_id, 0
                    for m in await client.get_messages(ent, limit=limit, min_id=min_id):
                        newest = max(newest, int(m.id))
                        text = clean_text(m.message or "")
                        if not text:
                            continue
                        replies = getattr(getattr(m, "replies", None), "replies", None)
                        eng = {k: v for k, v in (("views", getattr(m, "views", None)), ("replies", replies), ("forwards", getattr(m, "forwards", None))) if v is not None}
                        author = None if broadcast else self.author(getattr(m, "sender_id", None))
                        it = Item(id=sha1(self.kind, ident.lower(), m.id), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                                  platform=self.platform, community=community, ts=int(m.date.timestamp()), title=first_line(text),
                                  text=text, url=f"https://t.me/{uname}/{m.id}" if uname else "", author=author, engagement=eng,
                                  raw={"id": int(m.id), "forwarded": bool(m.fwd_from)})
                        n += self.emit(it)
                    self.store.set_cursor(sid, newest)
                    self.store.source_ok(sid)
                    st.items += n
                except Exception as ex:
                    self.store.source_error(sid, ex)
                    st.errors.append(f"@{ident}: {ex}")
        finally:
            await client.disconnect()
        return st


def parse_updates(payload: dict) -> tuple[list[dict], int | None]:
    """Bot API getUpdates -> ([{chat_id, chat, username, is_channel, message_id, ts, text, sender}], next_offset)."""
    out, last = [], None
    for u in payload.get("result", []):
        last = max(last or 0, int(u["update_id"]) + 1)
        m = u.get("channel_post") or u.get("message")
        if not m:
            continue
        text = clean_text(m.get("text") or m.get("caption") or "")
        if not text:
            continue
        chat = m.get("chat") or {}
        out.append({"chat_id": chat.get("id"), "chat": chat.get("title") or chat.get("username") or str(chat.get("id")),
                    "username": chat.get("username"), "is_channel": chat.get("type") == "channel",
                    "message_id": m.get("message_id"), "ts": int(m.get("date") or 0), "text": text,
                    "sender": (m.get("from") or {}).get("id")})
    return out, last


@register_connector
class TelegramBot(Connector):
    kind = "telegram_bot"
    platform = "Telegram"
    default_eye = "moon"
    default_lane = "telegram"

    def missing(self):
        return [] if self.secret("token") else ["token_env variable (bot token from @BotFather)"]

    def collect(self) -> Stats:
        st = Stats()
        tok = self.secret("token")
        if not tok:
            st.errors.append("telegram_bot not configured: token_env")
            return st
        cur_sid = self.register("updates", "Telegram bot updates", "bot")
        offset = int(self.store.cursor(cur_sid) or 0)
        r = self.http.get_json(f"https://api.telegram.org/bot{tok}/getUpdates",
                               params={"offset": offset, "timeout": 0, "limit": 100, "allowed_updates": '["message","channel_post"]'})
        if not r.get("ok"):
            st.errors.append(f"getUpdates failed: {r.get('description', 'unknown')}")
            return st
        posts, nxt = parse_updates(r)
        for p in posts:
            community = "@" + p["username"] if p["username"] else p["chat"]
            sid = self.register(str(p["chat_id"]), p["chat"], community)
            it = Item(id=sha1(self.kind, p["chat_id"], p["message_id"]), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                      platform=self.platform, community=community, ts=p["ts"], title=first_line(p["text"]), text=p["text"],
                      url=f"https://t.me/{p['username']}/{p['message_id']}" if p["username"] else "",
                      author=None if p["is_channel"] else self.author(p["sender"]), raw={"message_id": p["message_id"]})
            st.items += self.emit(it)
        if nxt:
            self.store.set_cursor(cur_sid, nxt)
        self.store.source_ok(cur_sid)
        return st
