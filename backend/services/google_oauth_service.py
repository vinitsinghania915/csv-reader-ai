"""Google OAuth = sign-in + Sheets/Drive access, in one grant.

We request identity scopes (openid, email) alongside Sheets + Drive at
sign-in. That way we both authenticate the user AND have credentials
ready to read their Google Sheets without a second OAuth round.

Flow:
    1. GET /auth/google/login?next=/workspaces (optional next_url)
    2. 302 → Google consent
    3. Google redirects back with code + state
    4. We exchange code, look up/create a User, store tokens keyed on user_id,
       issue a signed session cookie, 302 → frontend `next_url`.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from exceptions import AppError
from models.oauth import GoogleOAuthToken, OAuthState
from models.user import User
from repos.user_repo import UserRepository
from utils.crypto import decrypt, encrypt

logger = structlog.get_logger()
settings = get_settings()

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


class GoogleOAuthNotConnectedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            message="No Google account connected for this user.",
            code="GOOGLE_OAUTH_NOT_CONNECTED",
            status_code=401,
        )


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.OAUTH_GOOGLE_CLIENT_ID,
            "client_secret": settings.OAUTH_GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.BACKEND_URL + settings.GOOGLE_OAUTH_REDIRECT_PATH],
        }
    }


def _redirect_uri() -> str:
    return settings.BACKEND_URL + settings.GOOGLE_OAUTH_REDIRECT_PATH


async def begin_login(session: AsyncSession, next_url: Optional[str] = None) -> str:
    """Return the Google authorization URL. Persists a CSRF state + next_url."""
    if not settings.OAUTH_GOOGLE_CLIENT_ID or not settings.OAUTH_GOOGLE_CLIENT_SECRET:
        raise AppError(
            message="Google OAuth client credentials not configured on server.",
            code="GOOGLE_OAUTH_NOT_CONFIGURED",
            status_code=500,
        )

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())

    state = secrets.token_urlsafe(32)
    auth_url, _returned_state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        state=state,
    )
    session.add(
        OAuthState(
            state=state,
            code_verifier=getattr(flow, "code_verifier", None),
            next_url=next_url,
        )
    )
    await session.flush()
    return auth_url


async def handle_callback(
    session: AsyncSession, code: str, state: str
) -> tuple[User, Optional[str]]:
    """Exchange code → user+tokens. Returns (user, next_url_from_state)."""
    row = (
        await session.execute(select(OAuthState).where(OAuthState.state == state))
    ).scalar_one_or_none()
    if row is None:
        raise AppError(
            message="Invalid or expired OAuth state.",
            code="OAUTH_STATE_INVALID",
            status_code=400,
        )
    code_verifier = row.code_verifier
    next_url = row.next_url
    await session.execute(delete(OAuthState).where(OAuthState.state == state))

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=_redirect_uri())
    if code_verifier:
        flow.code_verifier = code_verifier
    try:
        flow.fetch_token(code=code)
    except Exception as exc:  # noqa: BLE001
        logger.error("Google token exchange failed", error=str(exc))
        raise AppError(
            message=f"Google token exchange failed: {exc}",
            code="GOOGLE_TOKEN_EXCHANGE_FAILED",
            status_code=502,
        ) from exc

    creds = flow.credentials
    profile = _fetch_profile(creds)
    google_sub = profile.get("id") or profile.get("sub")
    email = profile.get("email")
    if not google_sub or not email:
        raise AppError(
            message="Google did not return an identifiable profile.",
            code="GOOGLE_PROFILE_MISSING",
            status_code=502,
        )

    user_repo = UserRepository(session)
    user = await user_repo.upsert_from_google(
        google_sub=str(google_sub),
        email=email,
        name=profile.get("name"),
        avatar_url=profile.get("picture"),
    )

    await _store_tokens(session, user.id, creds)

    return user, next_url


def _fetch_profile(creds: Credentials) -> dict:
    try:
        from googleapiclient.discovery import build

        svc = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        return svc.userinfo().get().execute()  # type: ignore[no-any-return]
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to fetch Google profile", error=str(exc))
        return {}


async def _store_tokens(session: AsyncSession, user_id, creds: Credentials) -> None:
    """Upsert GoogleOAuthToken row for the user."""
    expires_at = creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else datetime.now(
        timezone.utc
    ) + timedelta(minutes=50)

    existing = (
        await session.execute(
            select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user_id)
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.access_token_encrypted = encrypt(creds.token)
        if creds.refresh_token:
            existing.refresh_token_encrypted = encrypt(creds.refresh_token)
        existing.expires_at = expires_at
        existing.scope = " ".join(creds.scopes or SCOPES)
        await session.flush()
        return

    session.add(
        GoogleOAuthToken(
            user_id=user_id,
            access_token_encrypted=encrypt(creds.token),
            refresh_token_encrypted=encrypt(creds.refresh_token) if creds.refresh_token else None,
            expires_at=expires_at,
            scope=" ".join(creds.scopes or SCOPES),
            google_account_email=None,
        )
    )
    await session.flush()


async def load_credentials(session: AsyncSession, user_id) -> Credentials:
    """Load stored Google creds for a user, refreshing access token if expired."""
    row = (
        await session.execute(
            select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user_id)
        )
    ).scalar_one_or_none()
    if row is None:
        raise GoogleOAuthNotConnectedError()

    creds = Credentials(
        token=decrypt(row.access_token_encrypted),
        refresh_token=decrypt(row.refresh_token_encrypted) if row.refresh_token_encrypted else None,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.OAUTH_GOOGLE_CLIENT_ID,
        client_secret=settings.OAUTH_GOOGLE_CLIENT_SECRET,
        scopes=row.scope.split(),
    )
    expires_at_aware = (
        row.expires_at.replace(tzinfo=timezone.utc)
        if row.expires_at.tzinfo is None
        else row.expires_at
    )
    needs_refresh = expires_at_aware <= datetime.now(timezone.utc) + timedelta(minutes=1)
    if needs_refresh and creds.refresh_token:
        creds.refresh(GoogleAuthRequest())
        row.access_token_encrypted = encrypt(creds.token)
        if creds.expiry:
            row.expires_at = creds.expiry.replace(tzinfo=timezone.utc)
        await session.flush()

    return creds


async def disconnect(session: AsyncSession, user_id) -> bool:
    result = await session.execute(
        delete(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user_id)
    )
    return result.rowcount > 0  # type: ignore[return-value]


async def get_connection_status(session: AsyncSession, user_id) -> Optional[GoogleOAuthToken]:
    return (
        await session.execute(
            select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user_id)
        )
    ).scalar_one_or_none()
