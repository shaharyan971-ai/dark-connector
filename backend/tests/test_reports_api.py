import os
import unittest
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

_test_database_directory = Path(__file__).with_name(".test-databases")
_test_database_directory.mkdir(exist_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{(_test_database_directory / 'reports-test.db').as_posix()}"
os.environ["CHROME_EXTENSION_IDS"] = '["abcdefghijklmnopabcdefghijklmnop"]'

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from core.auth import get_current_user, verify_supabase_token
from core.config import settings
from core.db.db.models import Alert, Report, SiteScore, User, UserSettings
from core.db.database import Base, SessionLocal, engine, get_db
from main import app

USER_ID = "025d31c6-5371-4e8d-a552-daf47313b44a"
OTHER_USER_ID = "3b8094b4-efb5-4323-b6bd-2e4035e76d0d"


class ReportApiTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        for path in _test_database_directory.glob("*"):
            path.unlink(missing_ok=True)
        _test_database_directory.rmdir()

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.session = SessionLocal()
        self.session.add_all([
            User(id=USER_ID, name="Test User", email="test@example.com"),
            User(id=OTHER_USER_ID, name="Other User", email="other@example.com"),
            UserSettings(user_id=USER_ID, analytics_consent=True),
            UserSettings(user_id=OTHER_USER_ID),
        ])
        self.session.commit()

        def override_get_db():
            yield self.session

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: {"sub": USER_ID, "email": "test@example.com"}
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
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

        site = self.session.get(SiteScore, (USER_ID, "fresh.example"))
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
        self.assertIsNone(self.session.get(SiteScore, (USER_ID, "failed.example")))

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

    def test_api_data_is_scoped_to_authenticated_user_and_same_domain_is_unique_per_tenant(self):
        response = self.client.post(
            "/api/report",
            json={
                "site_url": "https://shared.example",
                "patterns": [{"pattern_type": "fake_urgency", "confidence": 0.9}],
                "confirmed": True,
            },
        )
        self.assertEqual(response.status_code, 200)

        self.session.add(Report(
            user_id=OTHER_USER_ID,
            site_url="https://shared.example",
            pattern_type="hidden_costs",
            confidence=0.8,
            confirmed=True,
        ))
        self.session.add(SiteScore(
            user_id=OTHER_USER_ID,
            domain="shared.example",
            total_flags=1,
            confirmed_flags=1,
            score=6,
        ))
        private_alert = Alert(
            user_id=OTHER_USER_ID,
            site_url="https://shared.example",
            pattern_type="hidden_costs",
            severity="high",
            message="Private alert",
        )
        self.session.add(private_alert)
        self.session.commit()

        self.assertEqual(self.session.query(SiteScore).filter_by(domain="shared.example").count(), 2)
        self.assertEqual(self.client.get("/api/report").json()["sites"], [{
            "domain": "shared.example",
            "score": 6,
            "total_flags": 1,
            "confirmed_flags": 1,
        }])
        self.assertEqual(self.client.get("/api/alerts").json()["alerts"], [])
        self.assertEqual(
            self.client.patch(f"/api/alerts/{private_alert.id}/read").status_code,
            404,
        )
        self.assertEqual(self.client.get("/api/patterns").json()["patterns"][0]["pattern_type"], "fake_urgency")

    def test_protected_api_requires_bearer_token(self):
        app.dependency_overrides.pop(get_current_user, None)
        response = self.client.get("/api/overview")
        self.assertEqual(response.status_code, 401)

    def test_profile_update_changes_name_not_supabase_email(self):
        response = self.client.put(
            "/api/profile",
            json={"name": "New Name", "email": "new-login@example.com"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "New Name")
        self.assertEqual(response.json()["email"], "test@example.com")
        self.assertTrue(response.json()["email_change_requires_supabase_confirmation"])
        self.assertEqual(self.session.get(User, USER_ID).email, "test@example.com")

    def test_report_post_requires_analytics_consent_but_get_does_not(self):
        self.session.get(UserSettings, USER_ID).analytics_consent = False
        self.session.add(SiteScore(
            user_id=USER_ID,
            domain="existing.example",
            total_flags=1,
            confirmed_flags=0,
            score=1,
        ))
        self.session.add(Report(
            user_id=USER_ID,
            site_url="https://existing.example",
            pattern_type="fake_urgency",
            confidence=0.8,
            confirmed=False,
        ))
        self.session.commit()

        rejected = self.client.post(
            "/api/report",
            json={
                "site_url": "https://new.example",
                "patterns": [{"pattern_type": "fake_urgency", "confidence": 0.8}],
            },
        )
        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(self.session.query(Report).count(), 1)

        self.assertEqual(self.client.get("/api/report").status_code, 200)
        self.assertEqual(self.client.get("/api/overview").json()["total_patterns"], 1)

    def test_bearer_authorization_header_is_passed_to_jwt_verifier(self):
        app.dependency_overrides.pop(get_current_user, None)
        with patch("core.auth.verify_supabase_token", return_value={"sub": USER_ID} ) as verify:
            response = self.client.get(
                "/api/profile",
                headers={"Authorization": "Bearer access-token"},
            )
        self.assertEqual(response.status_code, 200)
        verify.assert_called_once_with("access-token")


class SupabaseJwtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.public_key = cls.private_key.public_key()
        cls.now = datetime.now(timezone.utc)
        cls.previous_settings = (
            settings.SUPABASE_URL,
            settings.SUPABASE_JWKS_URL,
            settings.SUPABASE_JWT_ISSUER,
            settings.SUPABASE_JWT_AUDIENCE,
        )
        settings.SUPABASE_URL = "https://project.example"
        settings.SUPABASE_JWKS_URL = None
        settings.SUPABASE_JWT_ISSUER = None
        settings.SUPABASE_JWT_AUDIENCE = "authenticated"

    @classmethod
    def tearDownClass(cls):
        (
            settings.SUPABASE_URL,
            settings.SUPABASE_JWKS_URL,
            settings.SUPABASE_JWT_ISSUER,
            settings.SUPABASE_JWT_AUDIENCE,
        ) = cls.previous_settings

    def encode(self, **overrides):
        claims = {
            "sub": USER_ID,
            "iss": f"{settings.SUPABASE_URL}/auth/v1",
            "aud": settings.SUPABASE_JWT_AUDIENCE or "authenticated",
            "iat": self.now,
            "exp": self.now + timedelta(minutes=5),
        }
        claims.update(overrides)
        return jwt.encode(claims, self.private_key, algorithm="RS256", headers={"kid": "test-key"})

    def verify_with_key(self, token, key=None):
        signing_key = key or self.public_key
        client = SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=signing_key)
        )
        with patch("core.auth._jwks_client", return_value=client):
            return verify_supabase_token(token)

    def test_valid_supabase_access_token_verifies(self):
        self.assertEqual(self.verify_with_key(self.encode())["sub"], USER_ID)

    def test_wrong_issuer_audience_and_signature_are_rejected(self):
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key()
        for token, key in (
            (self.encode(iss="https://attacker.example"), self.public_key),
            (self.encode(aud="other"), self.public_key),
            (self.encode(), other_key),
        ):
            with self.subTest(token_claims=token[:12]):
                with self.assertRaises(Exception):
                    self.verify_with_key(token, key)
        symmetric_token = jwt.encode(
            {"sub": USER_ID, "iss": f"{settings.SUPABASE_URL}/auth/v1", "aud": "authenticated"},
            "not-a-valid-supabase-signing-key",
            algorithm="HS256",
            headers={"kid": "test-key"},
        )
        with self.assertRaises(Exception):
            self.verify_with_key(symmetric_token)


if __name__ == "__main__":
    unittest.main()