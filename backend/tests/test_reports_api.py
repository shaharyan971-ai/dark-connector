import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_test_database_directory = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = (
    f"sqlite:///{Path(_test_database_directory.name, 'reports-test.db').as_posix()}"
)

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from core.db.database import Base, SessionLocal, engine, get_db
from core.db.db.models import Report, SiteScore
from main import app


class ReportApiTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        _test_database_directory.cleanup()

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.session = SessionLocal()

        def override_get_db():
            yield self.session

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.pop(get_db, None)
        self.session.close()

    def test_first_report_creates_initialized_site_score_and_is_listed(self):
        response = self.client.post(
            "/api/report",
            json={
                "site_url": "https://fresh.example/shop",
                "patterns": [{"pattern_type": "fake_urgency", "confidence": 0.82}],
                "confirmed": True,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "saved", "patterns_count": 1})

        site = self.session.get(SiteScore, "fresh.example")
        self.assertIsNotNone(site)
        self.assertEqual(site.total_flags, 1)
        self.assertEqual(site.confirmed_flags, 1)
        self.assertEqual(site.score, 6)
        self.assertEqual(self.session.query(Report).count(), 1)

        list_response = self.client.get("/api/report")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(
            list_response.json(),
            {
                "sites": [
                    {
                        "domain": "fresh.example",
                        "score": 6,
                        "total_flags": 1,
                        "confirmed_flags": 1,
                    }
                ]
            },
        )

    def test_database_failure_rolls_back_and_returns_http_500(self):
        with (
            patch.object(self.session, "commit", side_effect=SQLAlchemyError("simulated failure")),
            patch.object(self.session, "rollback", wraps=self.session.rollback) as rollback,
        ):
            response = self.client.post(
                "/api/report",
                json={
                    "site_url": "https://failed.example",
                    "patterns": [{"pattern_type": "fake_urgency", "confidence": 0.8}],
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Could not save report"})
        rollback.assert_called_once()
        self.assertEqual(self.session.query(Report).count(), 0)
        self.assertIsNone(self.session.get(SiteScore, "failed.example"))

    def test_report_list_is_empty_before_reports_are_created(self):
        response = self.client.get("/api/report")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"sites": []})

    def test_cors_allows_local_dashboard_and_chrome_extensions(self):
        for origin in (
            "http://localhost:3000",
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
        ):
            with self.subTest(origin=origin):
                response = self.client.options(
                    "/api/report",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "POST",
                    },
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.headers.get("access-control-allow-origin"), origin
                )


if __name__ == "__main__":
    unittest.main()