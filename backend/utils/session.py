"""Signed session cookie helpers.

Uses itsdangerous URLSafeTimedSerializer so cookies are integrity-checked
AND carry an issued-at timestamp for expiry. Signed with JWT_SECRET.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from config import get_settings

SESSION_COOKIE_NAME = "csv_reader_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30 days
_SERIALIZER_SALT = "csv-reader-session"


@lru_cache
def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        secret_key=get_settings().JWT_SECRET,
        salt=_SERIALIZER_SALT,
    )


def sign_session(user_id: str) -> str:
    """Return a signed cookie value carrying the user id."""
    return _serializer().dumps({"uid": user_id})


def read_session(cookie_value: Optional[str]) -> Optional[str]:
    """Return user_id from a cookie value, or None if missing/invalid/expired."""
    if not cookie_value:
        return None
    try:
        data = _serializer().loads(cookie_value, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(data, dict):
        return None
    uid = data.get("uid")
    return str(uid) if uid else None
