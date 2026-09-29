"""HORUS collector: reads what the Sun eye (broadcast) and the Moon eye (practitioner floor) are saying,
through official APIs and the operator's own accounts, into a local SQLite store. Read-only by design:
it never posts, joins, reacts, votes or follows, and it never scrapes behind a login."""
__version__ = "1.0.0"
