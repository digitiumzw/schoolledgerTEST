# Implementation Plan: Student Capacity Display & Near-Capacity Upgrade Alert

**Branch**: `028-student-capacity-alerts` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-student-capacity-alerts/spec.md`

## Summary

Add a student capacity widget to the Billing page and a near-capacity warning banner (triggered when ≥75% of the plan's `maxStudents` limit is used) to both the Billing page and the global `SubscriptionStatusBanner`. No backend changes are required — all data is already returned by `GET /api/subscription/current` (`studentCount`, `isOverLimit`, `isExpired`) and `GET /api/subscription/plans` (`maxStudents`). The feature is purely frontend: extend `useSubscription`, update `Billing.tsx`, and extend `SubscriptionStatusBanner.tsx`.

## Technical Context

**Language/Version**: TypeScript 5 · React 18  
**Primary Dependencies**: TanStack React Query v5, TailwindCSS, shadcn/ui (`Alert`, `Card`, `Progress`, `Skeleton`), Lucide icons  
**Storage**: N/A (frontend only; data sourced from existing REST API)  
**Testing**: Vitest + React Testing Library (existing frontend test setup)  
**Target Platform**: Web SPA (Vite build, served as static assets)  
**Project Type**: Web application — frontend feature only  
**Performance Goals**: Zero additional API calls; capacity data reuses the `subscription-current` React Query cache (staleTime: 2 min)  
**Constraints**: Must not add new backend endpoints; must not break existing alert priority order (expired > over-limit > near-capacity > expiry-soon)  
**Scale/Scope**: Affects 2 existing frontend files + 1 hook; 1 new component (`StudentCapacityCard`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | No new queries. `studentCount` and `maxStudents` are already scoped to the tenant by the backend via JWT-sourced `tenant_id`. |
| II. API-First Separation | ✅ PASS | All data comes through the existing `/api/subscription/current` and `/api/subscription/plans` endpoints; no direct DB access from frontend. |
| III. JWT Auth & Role-Based Access | ✅ PASS | The Billing page is already behind `ProtectedRoute` for admin/super_admin/bursar; `SubscriptionStatusBanner` only renders meaningful content when `subscription` is present (i.e., authenticated). No new route registration required. |
| IV. Immutable Migrations | ✅ PASS | No schema changes; no new migration files. |
| V. Financial Ledger Integrity | ✅ PASS | Feature does not touch ledger queries or balances. |

No violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/028-student-capacity-alerts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── capacity-api-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (affected files only)

```text
frontend/src/
├── hooks/
│   └── useSubscription.ts          # MODIFY — add maxStudents, isNearCapacity, capacityPercent, remainingSlots
├── components/subscription/
│   ├── StudentCapacityCard.tsx     # NEW — capacity progress widget for Billing page
│   └── SubscriptionStatusBanner.tsx # MODIFY — add near-capacity banner case
└── pages/
    └── Billing.tsx                 # MODIFY — render StudentCapacityCard between status alerts and subscription card
```

**Structure Decision**: Web application layout. Backend is untouched. All changes are confined to the `frontend/src/` tree. A new presentational component `StudentCapacityCard` is introduced to keep `Billing.tsx` clean and the widget independently testable.
