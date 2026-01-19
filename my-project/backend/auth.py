import os
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", os.getenv("MASTER_PASSWORD", "change-me-in-production"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except JWTError:
        logger.warning("Invalid token")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Dependency to get the current authenticated user from JWT token.
    """
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[Dict[str, Any]]:
    """
    Dependency to get the current user if authenticated, None otherwise.
    """
    if credentials is None:
        return None
    token = credentials.credentials
    payload = verify_token(token)
    return payload


def require_auth(func):
    """
    Decorator to require authentication for an endpoint.
    """
    async def wrapper(*args, **kwargs):
        # This will be handled by the Depends(get_current_user) in the route
        return await func(*args, **kwargs)
    return wrapper
