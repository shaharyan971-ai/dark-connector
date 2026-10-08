# DarkConnector Dashboard Frontend Integration

## Overview
DarkConnector is a web surveillance dashboard for making deceptive interface patterns visible across monitored sites. This project integrates the supplied DarkConnector dashboard experience into the existing Next.js dashboard application and keeps the frontend entry point compatible with the existing backend and deployment structure.
The dashboard must present the supplied interactive interface at the application root so users can review risk metrics, site activity, and detected pattern information from one usable frontend.

## Goals
- Make the supplied DarkConnector dashboard available from the Next.js dashboard root route.
- Preserve the supplied dashboard's responsive layout and browser-side interactions.
- Keep the existing backend and dashboard project boundaries intact.
- Ensure the dashboard can be built, linted, and served using the scripts already defined in the dashboard package.
- Keep the frontend integration easy to inspect and update as the backend data contract evolves.

## Scope
- Add the supplied `dark_connector_ultimate.html` frontend as a dashboard public asset.
- Route the Next.js dashboard root page to the supplied frontend asset.
- Retain the existing dashboard package, Next.js configuration, and public asset serving behavior.
- Retain the existing API client for future or adjacent data-backed dashboard views.
- Validate the integrated dashboard with the dashboard build and lint commands.

## Non-Goals
- Changing the FastAPI backend endpoints or database schema.
- Replacing the supplied dashboard's visual design with a new component library.
- Adding authentication, user accounts, or role-based access control.
- Reworking the browser extension or its content scanning behavior.
- Adding new analytics, reporting endpoints, or data migrations.

## Success Criteria
- Visiting the dashboard root renders the supplied DarkConnector dashboard instead of the previous dashboard shell.
- The supplied dashboard's search, sorting, responsive layout, and existing interactive controls remain available in a browser.
- `npm run build` completes successfully from the `dashboard` directory.
- `npm run lint` completes successfully from the `dashboard` directory.
- The backend files and API routes remain unchanged by the frontend integration.

## Work Areas

### Frontend Integration
- Add the supplied HTML dashboard to `dashboard/public/dark_connector_ultimate.html`.
- Configure `dashboard/app/page.tsx` to route the root request to the supplied dashboard asset.
- Done criteria:
	- The root dashboard route resolves to the supplied DarkConnector interface.
	- The browser loads the HTML, inline styles, inline scripts, and SVG assets without a missing-file error.
	- The layout remains usable at desktop and mobile viewport widths.
- Validation: run `npm run build` from `dashboard`, then start the app and verify the root route in a browser.

### Dashboard Data Boundary
- Preserve the existing `dashboard/lib/api.ts` API client and its normalized stats and leaderboard types.
- Keep the frontend integration isolated from backend route and database changes.
- Done criteria:
	- Existing API client exports and response normalization remain valid TypeScript.
	- No backend source file or database model is modified for this frontend-only integration.
- Validation: run `npm run build` from `dashboard` and inspect the changed-file list before review.

### Quality Verification
- Verify the integrated dashboard through the package's existing production and lint checks.
- Done criteria:
	- The production build completes without TypeScript or Next.js errors.
	- ESLint completes without errors.
	- The root route and supplied public asset are present in the generated application output.
- Validation: run `npm run build` and `npm run lint` from `dashboard`.

## Sequencing
1. Complete Frontend Integration by placing the supplied asset and routing the dashboard root to it.
2. Verify the Dashboard Data Boundary so the existing API client and backend contract remain isolated from the frontend change.
3. Complete Quality Verification with the production build, lint check, and browser smoke test.
4. Only after all three work areas pass validation should the integration be considered ready for review and deployment.
