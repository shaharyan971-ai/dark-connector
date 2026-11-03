# DarkConnector dashboard

The dashboard is a Next.js app. Browser requests to the API use the same-origin
`/api/backend` proxy, which keeps Supabase access and refresh tokens in
HttpOnly cookies rather than exposing them to page JavaScript.

## Local setup

1. Copy `env.example` to `.env.local` and set:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project.
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
   - `BACKEND_API_URL=http://localhost:8000`.
2. In Supabase Auth, enable email/password sign-in and allow the dashboard
   callback URL `http://localhost:3000/auth/callback`. Add the production
   dashboard callback URL before deployment.
3. Configure the backend against the migrated PostgreSQL database and allow
   the dashboard origin in `ALLOWED_ORIGINS`. See
   [the backend deployment guide](../backend/README.md).
4. Install and start the dashboard:

   ```powershell
   npm install
   npm run dev
   ```

Open `http://localhost:3000`. New users may need to confirm their email before
signing in. Password recovery and email changes also use Supabase's configured
email templates and redirect allowlist.

## Production configuration

Set the four values from `env.example` in the dashboard hosting environment.
`NEXT_PUBLIC_SITE_URL` must be the exact HTTPS dashboard origin, without a
trailing path. Keep `SUPABASE_ANON_KEY` server-side in this app's environment;
never configure a service-role key here or in a browser bundle. Apply the
backend's PostgreSQL migration before pointing `BACKEND_API_URL` at the
production API. Restrict CORS and Supabase redirect URLs to the actual deployed
origins.

The browser extension is configured separately in `extension/config.js`; it
needs the deployed API URL and Supabase project URL/public anon key at build
time. Only publish an extension after setting those values and configuring its
extension ID in the backend. See the backend deployment guide for the API
trust and migration requirements.
