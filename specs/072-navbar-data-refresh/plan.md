# Implementation Plan: Navbar Data Refresh

**Branch**: `072-navbar-data-refresh` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/072-navbar-data-refresh/spec.md`

## Summary

Add a small refresh button to `AppHeader` that triggers a re-fetch of all currently mounted TanStack Query queries without a full page reload, and ensure all existing TanStack Query mutation hooks (`useMutation`) call `queryClient.invalidateQueries` with domain-scoped query keys in their `onSuccess` handlers so the UI auto-updates after every successful action. No backend changes. No new migrations. Entirely frontend.

**Technical approach**: New `useGlobalRefresh` hook uses `queryClient.refetchQueries({ type: 'active' })` for the button and `useIsFetching()` for the spinner/disabled state. Automatic invalidation is wired into existing `useMutation` `onSuccess` handlers using established domain query key prefixes. Manual `useState`-based hooks are out of scope (see research.md Decision 6).

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: React 18, TanStack React Query v5 (`@tanstack/react-query`), Lucide React (icons), shadcn/ui (Button), TailwindCSS  
**Storage**: N/A — no database changes  
**Testing**: Manual browser verification + `tsc --noEmit` + ESLint  
**Target Platform**: Web SPA (Vite + React 18)  
**Project Type**: Web application — frontend-only change  
**Performance Goals**: Refresh completes within the same time as a normal page load; no simultaneous mass re-fetch; no full page reload  
**Constraints**: Must not blank existing data during refresh; button disabled during in-flight; no full `queryClient.clear()`  
**Scale/Scope**: Affects all ~25 TanStack Query hooks in the tenant frontend; 6 manual-cache hooks are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | No new backend queries; all existing queries already scoped by JWT tenant_id |
| II. API-First Separation | ✅ PASS | Frontend-only change; no business logic added to frontend |
| III. JWT Authentication & Role-Based Access | ✅ PASS | Refresh button only renders on authenticated pages; no new routes or role checks needed |
| IV. Immutable Migrations | ✅ PASS | No database migrations |
| V. Financial Ledger Integrity | ✅ PASS | No ledger query changes; refresh re-fetches existing correct queries |
| VI. REST API Standards | ✅ PASS | No new API endpoints |
| VII. Code Quality & Maintainability | ✅ PASS | Logic extracted to `useGlobalRefresh` hook; single responsibility |
| VIII. Defensive Security | ✅ PASS | No user input; no secrets; no new API surface |
| IX. Error Handling & Observability | ✅ PASS | Refresh errors shown via toast; existing data preserved on failure |
| X. API Endpoint Testing | ✅ PASS | No new backend endpoints; manual browser smoke tests documented in quickstart.md |
| XI. Performance Discipline | ✅ PASS | `refetchQueries({ type: 'active' })` only refetches mounted queries; no speculative cache clears |

No violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/072-navbar-data-refresh/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── refresh-hook-and-ui.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (affected files)

```text
frontend/
└── src/
    ├── hooks/
    │   └── useGlobalRefresh.ts          ← NEW: global refresh hook
    ├── components/
    │   └── AppHeader.tsx                ← MODIFIED: add refresh button
    ├── hooks/
    │   ├── useTransportAssignments.ts   ← AUDIT: already has invalidation ✓
    │   ├── useClassAttendance.ts        ← AUDIT: already has invalidation ✓
    │   ├── useStudentBalance.ts         ← AUDIT: has invalidateBalance helper ✓
    │   ├── useUpdateAttendanceStatus.ts ← AUDIT: check/add invalidation
    │   ├── useOnboarding.ts             ← AUDIT: check/add invalidation
    │   ├── useStaffAttendanceReport.ts  ← AUDIT: check/add invalidation
    │   ├── useSubscription.ts           ← AUDIT: already invalidates ✓
    │   └── useDashboardAggregation.ts   ← AUDIT: already invalidates ✓
    └── pages/
        ├── Students.tsx                 ← AUDIT: inline mutations → add invalidation
        ├── Payments.tsx                 ← AUDIT: inline mutations → add invalidation
        └── (other pages with inline mutations)
```

## Architecture Decisions

1. **`useGlobalRefresh` hook** — wraps `queryClient.refetchQueries({ type: 'active' })` and `useIsFetching()`. Lives in `src/hooks/useGlobalRefresh.ts`.
2. **Navbar button** — added to `AppHeader.tsx` right-side control group; uses `RefreshCw` icon from Lucide; spins + disabled when `isRefreshing`.
3. **Domain invalidation** — all `useMutation` `onSuccess` handlers in TanStack Query hooks must include `queryClient.invalidateQueries` with correct domain key prefix. See `contracts/refresh-hook-and-ui.md` for the full mapping table.
4. **Manual-cache hooks out of scope** — `useStaffAttendanceData`, `useFeeCampaigns`, `useFeeRules`, `useChargeBatchRollback`, `useFeeStructure`, `useWorkHours` use internal `Map`/`useState` caches and are not connected to the query client. They remain unchanged.

## Complexity Tracking

> No Constitution violations — table not required.
