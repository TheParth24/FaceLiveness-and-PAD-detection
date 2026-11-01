from fastapi import Request, HTTPException, status, Depends
from typing import Optional, List, Dict, Any
from .db import validate_auth_session


async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Extracts session from Authorization Bearer header or Cookie.
    """
    token: Optional[str] = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    if not token:
        token = request.cookies.get("pad_session_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session required"
        )

    user_session = validate_auth_session(token)
    if not user_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please log in again."
        )

    return user_session


def require_role(allowed_roles: List[str]):
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)):
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
            )
        return user
    return role_checker


require_admin = require_role(["admin"])
require_supervisor_or_admin = require_role(["admin", "supervisor"])
require_staff = require_role(["admin", "supervisor", "operator"])
