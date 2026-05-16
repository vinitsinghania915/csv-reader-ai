from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class GoogleOAuthToken(Base):
    """Stores encrypted Google OAuth tokens keyed by user.

    One row per user. Sheet-read access is granted once at sign-in (scopes
    include spreadsheets.readonly + drive.readonly alongside identity) and
    reused across all of that user's workspaces.
    """

    __tablename__ = "google_oauth_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    google_account_email: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)


class OAuthState(Base):
    """Short-lived CSRF-protection token for the OAuth login round-trip.

    The `state` param Google echoes back on /callback must match a row here.
    Also holds the PKCE `code_verifier` generated at login time. Consumed on callback.
    """

    __tablename__ = "oauth_states"

    state: Mapped[str] = mapped_column(String(64), primary_key=True)
    code_verifier: Mapped[str] = mapped_column(String(128), nullable=True)
    # `next_url` lets us send the user back to wherever they were in the SPA
    # after sign-in completes. Optional.
    next_url: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
