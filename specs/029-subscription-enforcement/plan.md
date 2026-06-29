# Implementation Plan: Subscription Enforcement & Plan Recommendation

**Branch**: `029-subscription-enforcement` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-subscription-enforcement/spec.md`

## Summary

Introduce a `SubscriptionGuard` component that blocks access to all essential-operations pages when the school has no active subscription, and extend `SubscriptionStatusBanner` with a highest-priority "no active plan" banner. Simultaneously, update `useSubscription` to expose `hasActivePlan` and a student-count-aware `recommendedPlanId` (lowest-tier plan that accommodates current enrollment), overriding the server's current top-always recommendation. No backend changes required — all data is available from existing `GET /api/subscription/current` and `GET /api/subscription/plans` endpoints.

## Technical Context

**Language/Version**: TypeScript 5 · React 18  
**Primary Dependencies**: TanStack React Query v5, TailwindCSS, shadcn/ui (`Alert`, `Card`, `Button`, `Skeleton`), Lucide icons, React Router v6  
**Storage**: N/A (frontend only; data sourced from existing REST API)  
**Testing**: Vitest + React Testing Library (existing frontend test setup)  
**Target Platform**: Web SPA (Vite build, served as static assets)  
**Project Type**: Web application — frontend feature only  
**Performance Goals**: Zero additional API calls; all enforcement derived from cached `subscription-current` and `subscription-plans` queries (staleTime: 2 min)  
**Constraints**: Must not add new backend endpoints; must not break existing banner priority order; must not block Billing, Help, Dashboard, or kiosk routes  
**Scale/Scope**: 1 new component (`SubscriptionGuard`), 2 modified existing files (`useSubscription.ts`, `SubscriptionStatusBanner.tsx`), 11 page files modified to apply the guard

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | No new queries. All data is already tenant-scoped by the backend via JWT-sourced `tenant_id`. The enforcement state is read-only derived data. |
| II. API-First Separation | ✅ PASS | All data comes through the existing `/api/subscription/current` and `/api/subscription/plans` endpoints. The recommendation algorithm runs client-side on the already-fetched plan list — no business logic added to the backend. |
| III. JWT Auth & Role-Based Access | ✅ PASS | `SubscriptionGuard` is applied inside authenticated, role-protected page components. The existing `ProtectedRoute` auth/role gates are unaffected. No new routes added. |
| IV. Immutable Migrations | ✅ PASS | No schema changes. No new migration files. |
| V. Financial Ledger Integrity | ✅ PASS | Feature does not touch ledger queries or balances. |

No violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/029-subscription-enforcement/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── enforcement-ui-contract.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (affected files only)

```text
frontend/src/
├── hooks/
│   └── useSubscription.ts               # MODIFY — add hasActivePlan; replace recommendedPlanId with client algorithm
├── components/subscription/
│   ├── SubscriptionGuard.tsx            # NEW — gate component; blocked state UI
│   └── SubscriptionStatusBanner.tsx     # MODIFY — add !hasActivePlan as highest-priority banner case
└── pages/
    ├── Students.tsx                     # MODIFY — wrap content in SubscriptionGuard
    ├── StudentProfile.tsx               # MODIFY — wrap content in SubscriptionGuard
    ├── Payments.tsx                     # MODIFY — wrap content in SubscriptionGuard
    ├── Classes.tsx                      # MODIFY — wrap content in SubscriptionGuard
    ├── Attendance.tsx                   # MODIFY — wrap content in SubscriptionGuard
    ├── Staff.tsx                        # MODIFY — wrap content in SubscriptionGuard
    ├── StaffProfilePage.tsx             # MODIFY — wrap content in SubscriptionGuard
    ├── StaffAttendance.tsx              # MODIFY — wrap content in SubscriptionGuard
    ├── Transport.tsx                    # MODIFY — wrap content in SubscriptionGuard
    ├── RouteDetailPage.tsx              # MODIFY — wrap content in SubscriptionGuard
    └── Settings.tsx                     # MODIFY — wrap content in SubscriptionGuard
```

**Structure Decision**: Web application layout. Backend is entirely untouched. All changes are confined to the `frontend/src/` tree. A single new reusable `SubscriptionGuard` component centralises the blocked-state UI, keeping each page's modification to a minimal one-line wrapper.
