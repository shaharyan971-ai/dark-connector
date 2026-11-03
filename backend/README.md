# DarkConnector backend deployment

The public API uses Supabase Auth access tokens and PostgreSQL. Configure the
backend environment explicitly before exposing it:

```dotenv
DATABASE_URL=postgresql://...
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
ALLOWED_ORIGINS=["http://localhost:3000","https://your-dashboard.example"]
CHROME_EXTENSION_IDS=["your_published_extension_id"]
```

Set `SUPABASE_URL` to the project URL. The backend derives the standard JWKS
URL and issuer from it; optional `SUPABASE_JWKS_URL` and
`SUPABASE_JWT_ISSUER` overrides are available for custom configurations. The
audience must match Supabase's access-token configuration. Only ES256 and RS256 signatures are accepted;
unsigned, symmetric, wrong-issuer, wrong-audience, expired, or incomplete
tokens are rejected. Protected API routes fail closed with HTTP 503 until all
required JWT settings are present. Never put a Supabase service-role key in this
API. Add the dashboard's exact origins and published Chrome extension IDs;
wildcard CORS origins are intentionally disabled.

The dashboard's same-origin BFF must forward the signed-in user's access token
as a Bearer Authorization header containing the signed-in user's access token.
Every profile, settings, overview,
site, pattern, alert, and report route verifies that token and scopes its data
to its UUID subject. Updating `/api/profile` changes only the user's per-user
display name. Email remains sourced from the verified Supabase token; a login
email change must go through Supabase Auth's confirmation flow. When a PUT
requests a different email, the response sets
`email_change_requires_supabase_confirmation: true` and returns the current
token email.

`POST /api/report` additionally requires that user's
`analytics_consent=true`; otherwise it returns HTTP 403. This does not gate
`GET /api/report` or other read APIs, so dashboard access remains available
when consent is false. The current extension has no secure Supabase login or
token-forwarding design. Its anonymous report POST therefore receives HTTP 401
and must remain unavailable until extension authentication and user/report
linking are designed; do not make this endpoint anonymous to restore it.

Run `pip install -r requirements.txt`, then apply
`migrations/001_public_multi_user.sql` once to a PostgreSQL database still using
the pre-multi-user schema. It adds tenant ownership to reports, scores, and
alerts, moves all pre-existing rows to the reserved `legacy-demo` owner, and
changes site-score uniqueness to `(user_id, domain)`. The API accepts only
UUID-shaped Supabase subjects, preventing that reserved demo owner from being
selected by normal logins.

The migration is PostgreSQL-only. Do not run it against
`backend/darkconnector.db`; the existing SQLite file remains untouched and
isolated for local/demo data. Keep it as a separate demo dataset, or make a
separate copy before any future import into PostgreSQL. Startup no longer
creates tables or writes a local default user; deploy only after the database
migration has been applied. Point `DATABASE_URL` to the migrated PostgreSQL
database for public multi-user service.
