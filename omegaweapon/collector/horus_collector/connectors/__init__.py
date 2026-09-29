"""Importing the modules registers the connectors."""
from . import csv_import, discord_bot, fediverse, hackernews, reddit, rss, telegram, youtube  # noqa: F401
from .base import REGISTRY  # noqa: F401
