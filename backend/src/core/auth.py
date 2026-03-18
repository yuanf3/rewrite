"""JWT authentication via Keycloak JWKS."""

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import settings

_bearer = HTTPBearer()

_jwks_url = (
    f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
    "/protocol/openid-connect/certs"
)
_issuer = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
_jwk_client = jwt.PyJWKClient(_jwks_url)


@dataclass
class AuthUser:
    user_id: str
    email: str | None
    username: str | None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> AuthUser:
    token = credentials.credentials
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="account",
            issuer=_issuer,
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )

    return AuthUser(
        user_id=payload["sub"],
        email=payload.get("email"),
        username=payload.get("preferred_username"),
    )
