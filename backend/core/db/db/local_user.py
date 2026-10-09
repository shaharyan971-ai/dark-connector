from sqlalchemy.orm import Session

from core.db.db.models import User, UserSettings

DEFAULT_USER_ID = "local-user"


def ensure_default_user(db: Session) -> User:
    user = db.get(User, DEFAULT_USER_ID)
    if user is None:
        user = User(
            id=DEFAULT_USER_ID,
            name="DarkConnector User",
            email="user@darkconnector.local",
        )
        db.add(user)

    if db.get(UserSettings, DEFAULT_USER_ID) is None:
        db.add(UserSettings(user_id=DEFAULT_USER_ID))

    db.commit()
    return user