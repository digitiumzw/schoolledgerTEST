# Implementation Plan: Fix Driver Kiosk Bugs and URI Format

**Branch**: `016-fix-driver-kiosk` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/016-fix-driver-kiosk/spec.md`

## Summary

Fix three bugs in the driver kiosk:
1. Change the frontend page URL from `/kiosk/driver/:code` to `/kiosk/:code/driver` to match the student attendance kiosk URL pattern.
2. Add an initial kiosk code validation on page load (using the existing `kioskApi.getKioskStatus` call) so invalid codes show an error immediately.
3. Add a separate `routeError` state rendered in the routes view, fixing the silent error bug when a roster request fails.

No backend changes. No database migrations.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend) · PHP 8.1+ (backend — unchanged)  
**Primary Dependencies**: React 18, React Router v6, TanStack React Query, TailwindCSS (frontend)  
**Storage**: N/A — no schema changes  
**Testing**: Manual browser testing (no automated test suite currently in place for kiosk pages)  
**Target Platform**: Web browser (fixed kiosk terminal — tablet or desktop)  
**Project Type**: Web application (React SPA + CodeIgniter 4 REST API)  
**Performance Goals**: Page load and error display within 3 seconds on a standard school network  
**Constraints**: Public page — no JWT, no authentication. Must not break existing staff or student kiosk routes.  
**Scale/Scope**: Single-file frontend changes (App.tsx + DriverKioskPage.tsx)

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS | No new queries. Backend queries already filter by `tenant_id` sourced from the kiosk code resolution (not from request body). |
| II. API-First Separation | PASS | No business logic added to frontend. All data access continues through `src/api/api.ts`. |
| III. JWT Auth & RBAC | PASS | Driver kiosk routes are intentionally public (Constitution III justified exception — same pattern as specs/006, 010, 011, 015). No new exempt routes added; existing exemptions are unchanged. |
| IV. Immutable Migrations | PASS | No schema changes. No migrations created or modified. |
| V. Financial Ledger Integrity | PASS | No ledger queries touched. |

## Project Structure

### Documentation (this feature)

```text
specs/016-fix-driver-kiosk/
├── plan.md              ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── frontend-routes.md
└── checklists/
    └── requirements.md
```

### Source Code (only files changed)

```text
frontend/
├── src/
│   ├── App.tsx                          ← route path change
│   └── pages/
│       └── DriverKioskPage.tsx          ← loading state + routeError state
```

**Structure Decision**: Web application layout (frontend/backend). Only frontend files are modified.

## Implementation Steps

### Step 1 — Fix URL format in App.tsx

**File**: `frontend/src/App.tsx`

Remove the existing driver kiosk route:
```
<Route path="/kiosk/driver/:code" element={<DriverKioskPage />} />
```

Insert the new route **before** the `/kiosk/:code` route (after `/kiosk/:code/students`):
```
<Route path="/kiosk/:code/driver" element={<DriverKioskPage />} />
```

Final ordering of kiosk routes:
```
<Route path="/kiosk/:code/students" element={<StudentKioskPage />} />
<Route path="/kiosk/:code/driver"   element={<DriverKioskPage />} />   ← new
<Route path="/kiosk/:code"          element={<KioskPage />} />
<Route path="/kiosk"                element={<KioskPage />} />
```

### Step 2 — Add loading state and initial validation in DriverKioskPage.tsx

**File**: `frontend/src/pages/DriverKioskPage.tsx`

**2a. Extend KioskView type**:
```ts
type KioskView = "loading" | "idle" | "routes" | "roster" | "error";
```

**2b. Import `kioskApi`** from `@/api/api`:
```ts
import { kioskDriverApi, kioskApi, DriverKioskRoute, DriverKioskStudent } from "@/api/api";
```

**2c. Set initial view to `"loading"`**:
```ts
const [view, setView] = useState<KioskView>("loading");
```

**2d. Add `useEffect` for initial kiosk status check** (after the existing idle timer effect):
```ts
useEffect(() => {
  if (!code) {
    setErrorMessage("No kiosk code provided in URL.");
    setView("error");
    return;
  }
  let cancelled = false;
  (async () => {
    try {
      const data = await kioskApi.getKioskStatus(code);
      if (cancelled) return;
      if (!data.kioskEnabled) {
        setErrorMessage("Driver kiosk is not enabled for this school.");
        setView("error");
        return;
      }
      setView("idle");
    } catch (err: any) {
      if (cancelled) return;
      setErrorMessage(err?.message || "Unable to connect to kiosk. Please check the URL.");
      setView("error");
    }
  })();
  return () => { cancelled = true; };
}, [code]);
```

**2e. Add loading view render** (before the error view):
```tsx
if (view === "loading") {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 px-6">
      <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-500 text-lg">Loading kiosk…</p>
    </div>
  );
}
```

### Step 3 — Fix route error visibility in DriverKioskPage.tsx

**File**: `frontend/src/pages/DriverKioskPage.tsx`

**3a. Add `routeError` state**:
```ts
const [routeError, setRouteError] = useState("");
```

**3b. Update `resetToIdle`** to clear `routeError`:
```ts
const resetToIdle = useCallback(() => {
  // ... existing resets ...
  setRouteError("");
  setView("idle");
}, []);
```

**3c. Update `handleRouteSelect`** to use `setRouteError` instead of `setIdError`:
```ts
} catch (err: unknown) {
  setRouteError((err as Error)?.message || "Unable to load roster");
} finally {
```

**3d. Clear `routeError` when a route is successfully selected**:
```ts
const handleRouteSelect = useCallback(async (route: DriverKioskRoute) => {
  if (!code) return;
  restartIdleTimer();
  setRouteError("");   // ← clear any previous error
  setIsLoading(true);
  // ...
```

**3e. Render `routeError` in the routes view** — add after the routes list header:
```tsx
{routeError && (
  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
    <AlertTriangle className="h-4 w-4 shrink-0" />
    {routeError}
  </div>
)}
```

Place this block between the driver name header and the routes list (or empty state).
