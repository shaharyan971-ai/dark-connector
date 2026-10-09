import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from core.db.database import Base, create_database_engine
from core.db.db.local_user import DEFAULT_USER_ID
from core.db.db.models import Alert, Report, SiteScore, User, UserSettings


def seed_database(database_path: Path) -> None:
    database_path = database_path.expanduser().resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_database_engine(f"sqlite:///{database_path.as_posix()}")
    Base.metadata.create_all(bind=engine)

    try:
        with engine.begin() as connection:
            existing_reports = connection.execute(select(Report.id).limit(1)).first()
            if existing_reports:
                raise ValueError(f"Refusing to seed non-empty database: {database_path}")

        now = datetime.now(timezone.utc)
        samples = [
            ("booking.com", "fake_urgency", 0.94, True, 2),
            ("booking.com", "confirmshaming", 0.88, True, 4),
            ("booking.com", "hidden_costs", 0.82, False, 6),
            ("flipkart.com", "social_proof_manipulation", 0.86, True, 12),
            ("flipkart.com", "fake_urgency", 0.78, False, 18),
            ("amazon.in", "forced_continuity", 0.81, True, 30),
            ("amazon.in", "hidden_costs", 0.73, False, 48),
            ("example-shop.test", "confirmshaming", 0.69, False, 96),
        ]

        with engine.begin() as connection:
            connection.execute(
                User.__table__.insert(),
                [{
                    "id": DEFAULT_USER_ID,
                    "name": "DarkConnector Demo User",
                    "email": "demo@darkconnector.local",
                }],
            )
            connection.execute(
                UserSettings.__table__.insert(),
                [{"user_id": DEFAULT_USER_ID}],
            )
            connection.execute(
                Report.__table__.insert(),
                [
                    {
                        "site_url": f"https://{domain}/",
                        "pattern_type": pattern_type,
                        "confidence": confidence,
                        "confirmed": confirmed,
                        "created_at": now - timedelta(hours=hours_ago),
                    }
                    for domain, pattern_type, confidence, confirmed, hours_ago in samples
                ],
            )

            totals: dict[str, dict[str, int]] = {}
            for domain, _pattern, _confidence, confirmed, _hours_ago in samples:
                counts = totals.setdefault(domain, {"flags": 0, "confirmed": 0})
                counts["flags"] += 1
                counts["confirmed"] += int(confirmed)

            connection.execute(
                SiteScore.__table__.insert(),
                [
                    {
                        "domain": domain,
                        "total_flags": counts["flags"],
                        "confirmed_flags": counts["confirmed"],
                        "score": min(100, counts["confirmed"] * 5 + counts["flags"]),
                        "last_scanned": now,
                    }
                    for domain, counts in totals.items()
                ],
            )
            connection.execute(
                Alert.__table__.insert(),
                [{
                    "site_url": "https://booking.com/",
                    "pattern_type": "fake_urgency",
                    "severity": "high",
                    "message": "booking.com crossed the configured demo risk threshold.",
                    "created_at": now - timedelta(hours=2),
                    "read": False,
                }],
            )
    finally:
        engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a separate DarkConnector demo database.")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path(__file__).with_name("demo.db"),
        help="SQLite file to seed (defaults to backend/demo.db)",
    )
    args = parser.parse_args()
    seed_database(args.db_path)
    print(f"Seeded demo data into {args.db_path.expanduser().resolve()}")


if __name__ == "__main__":
    main()