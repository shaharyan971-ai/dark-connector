from pydantic_settings import BaseSettings, SettingsConfigDict
from urllib.parse import urlsplit


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./darkconnector.db"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://dark-connector.vercel.app",
    ]
    CHROME_EXTENSION_IDS: list[str] = []
    SUPABASE_URL: str | None = None
    SUPABASE_JWKS_URL: str | None = None
    SUPABASE_JWT_ISSUER: str | None = None
    SUPABASE_JWT_AUDIENCE: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()


def jwt_verification_settings() -> tuple[str | None, str | None, str | None]:
    project_url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else None
    jwks_url = settings.SUPABASE_JWKS_URL or (
        f"{project_url}/auth/v1/.well-known/jwks.json" if project_url else None
    )
    issuer = settings.SUPABASE_JWT_ISSUER or (
        f"{project_url}/auth/v1" if project_url else None
    )
    for endpoint in (jwks_url, issuer):
        if endpoint is None:
            continue
        parsed = urlsplit(endpoint)
        local_http = parsed.scheme == "http" and parsed.hostname in {
            "localhost",
            "127.0.0.1",
            "::1",
        }
        if (
            not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.fragment
            or (parsed.scheme != "https" and not local_http)
        ):
            return None, None, None
    return jwks_url, issuer, settings.SUPABASE_JWT_AUDIENCE