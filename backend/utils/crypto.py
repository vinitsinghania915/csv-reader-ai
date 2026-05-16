"""Symmetric encryption helpers for storing third-party tokens at rest.

Wraps cryptography.fernet. The raw `ENCRYPTION_KEY` env value can be
any string — we derive a 32-byte Fernet key from it via SHA-256 + base64.
"""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from config import get_settings


@lru_cache
def _fernet() -> Fernet:
    raw = get_settings().ENCRYPTION_KEY.encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
