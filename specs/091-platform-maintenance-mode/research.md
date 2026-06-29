# Research: Platform Maintenance Mode

**Feature Branch**: `091-platform-maintenance-mode`
**Date**: 2026-06-22

## Research Tasks

### R1: Where to store the maintenance mode setting

**Decision**: Store as three rows in the existing `platform_settings` key-value table:
- `maintenance_mode` (type: `boolean`, default: `false`)
- `maintenance_headline` (type: `string`, default: `"Platform Under Maintenance"`)
- `maintenance_message` (type: `string`, default: `"The platform is currently under maintenance. Service will be restored shortly."`)

**Rationale**: The `platform_settings` table already exists with a flexible schema (key, value JSON, type ENUM, description). It has an in-process static cache via `PlatformSetting::get()`. Adding new keys requires no schema migration — only a seed migration to insert the default rows. This is consistent with how `support_email`, `default_currency`, and other platform settings are stored.

**Alternatives considered**:
- New dedicated `maintenance_settings` table: Rejected — over-engineered for 3 fields. Adds unnecessary schema when the existing key-value store handles this cleanly.
- Environment variable / `.env` file: Rejected — cannot be toggled at runtime via the UI; requires server restart.
- File-based flag: Rejected — not durable across deployments, hard to update from the admin UI.

### R2: How to intercept tenant API requests during maintenance

**Decision**: Extend `JWTAuthFilter::before()` with a maintenance mode check that runs *after* JWT validation succeeds. The check reads `PlatformSetting::get('maintenance_mode')`. If true and the decoded user's role is not `admin` or `super_admin`, return a 503 JSON response with the maintenance message. Platform routes (`/api/platform/*`) are excluded because they use a separate filter (`PlatformJWTAuthFilter`). Public routes (kiosk, receipts, demo-requests) are excluded because they are in `JWTAuthFilter::PUBLIC_PATHS` and never reach the maintenance check.

**Rationale**: The `JWTAuthFilter` is the single entry point for all tenant API requests (registered as a global `before` filter with `except: ['api/subscription/webhook', 'api/platform/*']`). Adding the check here ensures every authenticated tenant API call is intercepted. Running it after JWT validation means we have the user's role available for the admin bypass. The 503 status code is the HTTP-standard code for service unavailable / maintenance.

**Alternatives considered**:
- New dedicated `MaintenanceFilter`: Rejected — adds another filter to the stack and requires registration in `Filters.php`. The `JWTAuthFilter` already runs on every request and has the decoded user available.
- Controller-level checks in `BaseApiController`: Rejected — would require every controller to call a check method. Easy to forget. The filter approach is centralized and cannot be bypassed.
- Frontend-only check (redirect to maintenance page): Rejected — insecure. API calls would still succeed if made directly (e.g., via curl, Postman, or a compromised client).

### R3: How the tenant frontend detects maintenance mode

**Decision**: Add a public unauthenticated endpoint `GET /api/maintenance-status` that returns `{ status: true, data: { maintenance_mode: bool, headline: string, message: string } }`. The tenant frontend polls this endpoint via a React Query hook with `refetchInterval: 30000` (30 seconds, matching the existing `staleTime` config). When `maintenance_mode` is true and the user is not an admin/super_admin, the `MaintenanceNotice` component is rendered as a full-screen overlay instead of the normal app content.

**Rationale**: The public endpoint allows the frontend to check maintenance state before the user even logs in (so the login page itself can show the maintenance notice). Polling at 30 seconds is consistent with the existing React Query configuration in `App.tsx`. The endpoint is unauthenticated so it works even when the user's session has expired.

**Alternatives considered**:
- Check via the existing `GET /api/auth/me` endpoint: Rejected — requires authentication. A user whose session has expired would get a 401, not the maintenance notice.
- WebSocket / Server-Sent Events for real-time push: Rejected — over-engineered for a simple toggle. Polling at 30 seconds is sufficient (the spec says "within one normal page load").
- Check via a response header on every API call: Rejected — the frontend would need to intercept every response. A dedicated endpoint is simpler and more explicit.

### R4: Admin bypass — which roles retain access

**Decision**: `super_admin` and `admin` roles bypass the maintenance mode check in `JWTAuthFilter`. Platform admin routes (`/api/platform/*`) are entirely unaffected because they use `PlatformJWTAuthFilter`.

**Rationale**: The spec states "Platform and tenant admins retain access during maintenance." In the tenant system, the admin roles are `super_admin` and `admin`. Teachers and bursars are non-admin users who should see the maintenance notice.

**Alternatives considered**:
- Only `super_admin` bypasses: Rejected — the spec explicitly says tenant admins retain access.
- All authenticated users bypass: Rejected — defeats the purpose of maintenance mode.

### R5: How to handle the maintenance toggle in the Platform Control Panel UI

**Decision**: Add a new "Maintenance" tab in the Platform Control Panel Settings page (`frontend/src/admin/pages/Settings.tsx`). The tab contains:
- A toggle switch (shadcn/ui `Switch` component) for enabling/disabling maintenance mode
- Text inputs for the custom headline and message
- A "Save" button that calls `PUT /api/platform/settings` with the three maintenance keys
- A visual indicator showing the current maintenance state

**Rationale**: The existing Settings page already has tabs (Account, Team, Audit Logs, General). Adding a Maintenance tab is consistent with the existing UI pattern. The toggle uses the existing `updateSettings` API function and `useUpdateSettings` hook. The `canManageSettings` policy (Owner + Admin roles) already gates the settings update endpoint.

**Alternatives considered**:
- Separate dedicated page for maintenance: Rejected — maintenance is a settings concern. A tab in the existing Settings page is simpler and consistent.
- Modal dialog: Rejected — maintenance mode is not a transient action; it needs a persistent UI showing the current state.

### R6: Default maintenance message text

**Decision**: Default headline: `"Platform Under Maintenance"`. Default message: `"The platform is currently under maintenance. Service will be restored shortly."`

**Rationale**: The user's original request says "show the platform is under maintenance, the service will be restored shortly." These defaults are seeded into `platform_settings` and can be overridden by the admin via the UI.

**Alternatives considered**:
- Empty defaults: Rejected — the spec says empty values must fall back to sensible defaults.
- Generic "We'll be back soon": Rejected — the user specifically requested the "service will be restored shortly" wording.
