from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.db.db.models import User, UserSettings


def ensure_authenticated_user(db: Session, claims: dict[str, Any]) -> User:
    user_id = claims.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid access token subject")
    try:
        user_id = str(UUID(user_id))
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Invalid access token subject") from error

    user = db.get(User, user_id)
    changed = False
    if user is None:
        metadata = claims.get("user_metadata")
        metadata = metadata if isinstance(metadata, dict) else {}
        name = metadata.get("full_name") or metadata.get("name") or claims.get("email") or "DarkConnector User"
        user = User(id=user_id, name=str(name)[:120], email=claims.get("email"))
        db.add(user)
        changed = True
    elif claims.get("email") != user.email:
        user.email = claims.get("email")
        changed = True
    if db.get(UserSettings, user_id) is None:
        db.add(UserSettings(user_id=user_id))
        changed = True
    try:
        if changed:
            db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise
    return user
