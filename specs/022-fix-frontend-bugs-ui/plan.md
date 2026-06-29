# Implementation Plan: Fix Frontend Bugs and UI Inconsistencies

**Branch**: `022-fix-frontend-bugs-ui` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/022-fix-frontend-bugs-ui/spec.md`

## Summary

Fix silent API failure states, null-reference crashes in modal components, form validation gaps (phone normalization, implausible date detection), and visual inconsistencies (button variants, modal widths, heading hierarchy, balance color coding) across all 20 pages and 57+ modals of the SchoolLedger React SPA. All changes are frontend-only; no backend or schema modifications are required.

## Technical Context

**Language/Version**: TypeScript 5.x / React 18  
**Primary Dependencies**: TanStack React Query v5, React Hook Form v7 + Zod, shadcn/ui, Axios, Tailwind CSS v3, date-fns, lucide-react  
**Storage**: N/A — frontend-only; no database or migration changes  
**Testing**: No automated test suite in frontend currently  
**Target Platform**: Web browser (Chrome, Firefox, Edge — desktop + mobile responsive via existing Tailwind breakpoints)  
**Project Type**: Web application (React SPA)  
**Performance Goals**: No degradation from changes; error state components must render synchronously without additional API calls  
**Constraints**: No new npm dependencies; all fixes must use existing shadcn/ui primitives, Tailwind CSS classes, and React Query patterns already in the codebase  
**Scale/Scope**: 20 pages, 57+ modals, ~15 feature component groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | N/A | Frontend-only changes; no new queries or `tenant_id` handling |
| II. API-First Separation | PASS | All API calls remain through `src/api/api.ts`; no backend logic embedded in frontend |
| III. JWT Auth & RBAC | PASS | No routing or `ProtectedRoute` changes; existing auth flow unchanged |
| IV. Immutable Migrations | N/A | No schema changes |
| V. Financial Ledger Integrity | PASS | `BalanceDisplay` currency fix is display-only; balance is still computed backend-side via `SUM(charges) - SUM(payments)` |

**Tech Stack Gates:**
- Forms MUST use React Hook Form + Zod — enforced in all validation fixes
- Server state MUST use TanStack React Query — error/loading states derived from `isError`, `isLoading`, `refetch`
- UI components MUST use shadcn/ui primitives — no new raw HTML elements for interactive components
- Complex logic MUST be extracted to `src/hooks/` — shared error/retry patterns extracted as needed

**Gate result: ALL PASS — proceed to research.**

## Project Structure

### Documentation (this feature)

```text
specs/022-fix-frontend-bugs-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── button-standard.md
│   ├── modal-standard.md
│   └── error-state-standard.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/                     # 20 pages — error states, loading states
│   │   ├── Dashboard.tsx          # Silent error fixes (loadClassStudents, loadClassAnalytics)
│   │   ├── Students.tsx           # Null guard on getClassName, differentiated error toasts
│   │   ├── StudentProfile.tsx     # Error UI + retry, nested null-chain fixes
│   │   ├── Payments.tsx           # Per-source error identification in Promise.all
│   │   ├── Transport.tsx          # Error recovery UI
│   │   ├── Staff.tsx              # Button variant standardization
│   │   ├── Classes.tsx            # Heading hierarchy, button standardization
│   │   └── [remaining 13 pages]  # Heading + button consistency pass
│   ├── components/
│   │   ├── modals/
│   │   │   ├── RecordPaymentModal.tsx     # Null guards for student.currentEnrollment
│   │   │   ├── StudentFormModal.tsx       # Guardian null guard, phone validation, date validation
│   │   │   └── StaffFormModal.tsx         # Date validation (future hire, age check)
│   │   ├── BalanceDisplay.tsx             # Remove hardcoded 'USD'; use tenant currency
│   │   └── [other components]             # Color consistency pass
│   └── hooks/
│       └── useErrorRecovery.ts            # Shared error state + retry hook (if pattern repeats 3+)
└── (no test directory currently)
```

**Structure Decision**: Single frontend SPA structure. Backend is unchanged. All source files are within `frontend/src/`.

## Complexity Tracking

> No constitution violations. Section not required.
