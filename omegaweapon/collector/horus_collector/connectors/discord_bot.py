"""Discord through a bot token, REST only (login, fetch_channel, history; no gateway connection).

The bot reads only servers whose admins invited it, and only channels where it has View Channel and
Read Message History. Turn on the Message Content intent for the bot in the Discord developer portal
or message text arrives empty. User-account automation ("self-bots") violates Discord's terms and is
deliberately not supported. Authors are pseudonymized."""
from __future__ import annotations

import datetime as dt
import logging

from ..store import Item
from ..util import clean_text, first_line, sha1
from .base import Connector, Stats, register_connector

log = logging.getLogger("horus.discord")


@register_connector
class DiscordBot(Connector):
    kind = "discord"
    platform = "Discord"
    default_eye = "moon"
    default_lane = "discord"
    is_async = True

    def missing(self):
        m = [] if self.secret("token") else ["token_env variable (bot token)"]
        if not self.cfg.get("channel_ids"):
            m.append("channel_ids")
        return m

    async def collect(self) -> Stats:
        st = Stats()
        miss = self.missing()
        if miss:
            st.errors.append("discord not configured: " + ", ".join(miss))
            return st
        try:
            import discord
        except ImportError:
            st.errors.append("discord.py is not installed: pip install discord.py")
            return st
        client = discord.Client(intents=discord.Intents.none())
        try:
            await client.login(self.secret("token"))
            limit = int(self.cfg.get("max_messages_per_channel", 200))
            for cid in self.cfg.get("channel_ids", []):
                cid = str(cid).strip()
                if not cid.isdigit():
                    st.errors.append(f"discord channel id must be numeric: {cid}")
                    continue
                sid = self.register(cid, cid, cid)
                try:
                    ch = await client.fetch_channel(int(cid))
                    guild = getattr(ch, "guild", None)
                    community = f"{getattr(guild, 'name', '') or 'server'} #{getattr(ch, 'name', cid)}"
                    self.store.upsert_source(sid, self.kind, community, self.eye, self.lane, self.platform, community)
                    cur = self.store.cursor(sid)
                    after = dt.datetime.fromtimestamp(int(cur), tz=dt.timezone.utc) if cur else None
                    newest, n = int(cur or 0), 0
                    async for m in ch.history(limit=limit, after=after, oldest_first=True):
                        ts = int(m.created_at.timestamp())
                        newest = max(newest, ts)
                        text = clean_text(m.content or "")
                        if not text or getattr(m.author, "bot", False):
                            continue
                        it = Item(id=sha1(self.kind, cid, m.id), source_id=sid, kind=self.kind, eye=self.eye, lane=self.lane,
                                  platform=self.platform, community=community, ts=ts, title=first_line(text), text=text,
                                  url=f"https://discord.com/channels/{guild.id if guild else '@me'}/{cid}/{m.id}",
                                  author=self.author(m.author.id),
                                  engagement={"reactions": sum(r.count for r in (m.reactions or []))} if m.reactions else {},
                                  raw={"id": str(m.id), "thread": bool(getattr(m, "thread", None))})
                        n += self.emit(it)
                    self.store.set_cursor(sid, newest)
                    self.store.source_ok(sid)
                    st.items += n
                except Exception as ex:
                    self.store.source_error(sid, ex)
                    st.errors.append(f"#{cid}: {ex}")
        except Exception as ex:
            st.errors.append(f"discord login: {ex}")
        finally:
            try:
                await client.close()
            except Exception:
                pass
        return st
