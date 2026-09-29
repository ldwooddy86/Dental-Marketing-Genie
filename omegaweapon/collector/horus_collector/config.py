"""Config: a TOML file for settings, environment variables for every secret. Secrets never go in the
TOML, the store or an export; the config names the variable (for example token_env = "HORUS_DISCORD_TOKEN")."""
from __future__ import annotations

import os
import tomllib
from pathlib import Path

SECRET_KEYS = ("token", "api_hash", "client_secret", "app_password", "api_key", "password")


def load(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        raise SystemExit(f"no config at {p}. Run: python -m horus_collector init")
    cfg = tomllib.loads(p.read_text(encoding="utf-8"))
    for name, sec in cfg.items():
        if not isinstance(sec, dict):
            continue
        for k in SECRET_KEYS:
            if sec.get(k):
                raise SystemExit(f"[{name}] {k} is set in the TOML. Put it in an environment variable and name it with {k}_env.")
    g = cfg.setdefault("general", {})
    g.setdefault("data_dir", "./horus-data")
    g.setdefault("contact", "")
    g.setdefault("min_interval_seconds", 1.0)
    salt = os.environ.get(g.get("author_salt_env", "HORUS_AUTHOR_SALT"), "")
    if not salt:
        raise SystemExit("set HORUS_AUTHOR_SALT (any long random string, kept stable) so floor authors can be pseudonymized")
    g["_salt"] = salt
    g["data_dir"] = str(Path(g["data_dir"]).expanduser())
    return cfg


def secret(section: dict, key: str) -> str:
    """Read <key>_env from the section and return that environment variable's value ('' if unset)."""
    var = section.get(f"{key}_env", "")
    return os.environ.get(var, "") if var else ""
