# DarkConnector browser extension

The extension currently reports heuristic pattern detections only for a
signed-in user who has explicitly enabled analytics sharing. Reports contain
the current site's hostname and detected pattern names/confidence scores; they
do not include page text or the full URL. Detection results are heuristic
signals, not proof of deceptive intent.

## Configure a deployment

Before loading or publishing the extension, set these values in `config.js`:

- `BACKEND_API_URL`: HTTPS base URL for the deployed FastAPI API.
- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_ANON_KEY`: the project's public anon key (never a service-role key).

Add the published Chrome extension ID to the backend's
`CHROME_EXTENSION_IDS`, and allow its `chrome-extension://<extension-id>` origin
in the backend CORS configuration. Configure the Supabase project's email
confirmation/redirect settings for the dashboard URL. The dashboard and API
must already be deployed and configured; see
[`dashboard/README.md`](../dashboard/README.md) and
[`backend/README.md`](../backend/README.md).

Until deployment values are supplied, extension sign-in and reporting are
intentionally unavailable. Do not distribute a build with placeholder values.
