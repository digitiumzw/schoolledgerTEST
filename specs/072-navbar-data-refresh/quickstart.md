# Quickstart: Navbar Data Refresh

**Feature**: 072-navbar-data-refresh  
**Date**: 2026-05-13

---

## Prerequisites

- Frontend dev server running (`bun run dev` in `frontend/`)
- Backend running on `http://localhost:8080`
- Logged in as `admin@greenwood.co.zw` / `12345678`

---

## Development Setup

No migrations or backend changes required. This feature is entirely frontend.

```bash
cd frontend
bun run dev
```

---

## Verification Steps (Manual)

### US1 — Manual Refresh Button

1. Log in and navigate to any page (e.g., Students).
2. Verify a small `RefreshCw` icon button appears in the top navbar between the theme toggle and logout buttons.
3. Click the button — it should spin and be disabled while queries refetch, then return to idle.
4. Open browser DevTools → Network tab. Click refresh. Confirm only requests for the current page's endpoints fire (not all API endpoints).
5. Apply a search filter on the Students page, click refresh — filter state must be preserved after refresh.

### US2 — Automatic Post-Action Refresh

1. Navigate to Payments page.
2. Record a new payment for any student.
3. After the modal closes (success response), the payment list and student balance should update automatically without clicking refresh.
4. Navigate to Transport page, assign a student to a route — transport route data should update automatically.

### US3 — No Duplicate Requests

1. Open DevTools → Network tab.
2. Click the refresh button rapidly 3–4 times.
3. Confirm only one set of API requests fires; subsequent clicks are ignored while the first refresh is in-flight.

---

## TypeScript Validation

```bash
cd frontend
./node_modules/.bin/tsc --noEmit --pretty false
```

Expected: 0 errors.

## ESLint

```bash
cd frontend
./node_modules/.bin/eslint src/hooks/useGlobalRefresh.ts src/components/AppHeader.tsx
```

Expected: 0 errors.
