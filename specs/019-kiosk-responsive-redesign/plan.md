# Implementation Plan: Kiosk Responsive Redesign

**Branch**: `019-kiosk-responsive-redesign` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-kiosk-responsive-redesign/spec.md`

## Summary

Redesign all three kiosk page flows (Staff Attendance, Student Attendance, Driver) to be fully touch-friendly by enlarging interactive elements to meet the 44×44px minimum tap target standard, increasing typography to kiosk-appropriate sizes, making layouts responsive from 375px to 1920px, and maintaining visual consistency with the existing system styling. This is a **frontend-only** change: 3 page files and 6 component files. No backend, API, or database changes.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: React 18, TailwindCSS (utility-first), shadcn/ui primitives, lucide-react
**Storage**: N/A — no data layer changes
**Testing**: Manual visual testing across viewports (375px, 768px, 1024px, 1280px); Vite dev server hot reload
**Target Platform**: Web browser on kiosk touch-screens (tablets 768–1280px), portrait and landscape
**Project Type**: Web application — frontend-only change
**Performance Goals**: No regression in Vite build size; no added dependencies
**Constraints**: Use existing Tailwind utilities only; do not add CSS libraries; do not modify backend or API; do not change component prop interfaces (callers must remain unchanged)
**Scale/Scope**: 6 kiosk components in `frontend/src/components/kiosk/` + 3 kiosk pages in `frontend/src/pages/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ N/A | No DB queries modified |
| II. API-First Separation | ✅ PASS | Pure presentation changes; no business logic, no direct DB access added |
| III. JWT Auth & Role-Based Access | ✅ N/A | No new routes or JWT changes; kiosk pages are already public (no JWT required) |
| IV. Immutable Migrations | ✅ N/A | No schema changes |
| V. Financial Ledger Integrity | ✅ N/A | No ledger queries touched |
| Tech Stack: TailwindCSS + React 18 | ✅ PASS | Existing stack, no new libraries |
| Tech Stack: No ad-hoc fetch calls | ✅ PASS | No API layer changes; kiosk API calls remain in `api.ts` |

**Gate result**: PASS — no violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/019-kiosk-responsive-redesign/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── ui-components.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/
│   │   ├── KioskPage.tsx               ← Staff Attendance kiosk (modify)
│   │   ├── StudentKioskPage.tsx        ← Student Attendance kiosk (modify)
│   │   └── DriverKioskPage.tsx         ← Driver kiosk (modify)
│   └── components/
│       └── kiosk/
│           ├── KioskIdleScreen.tsx         ← Staff idle/input screen (modify)
│           ├── KioskConfirmation.tsx       ← Staff confirmation screen (modify)
│           ├── StudentKioskIdEntry.tsx     ← Student kiosk ID entry (modify)
│           ├── StudentKioskClassList.tsx   ← Class selection list (modify)
│           ├── StudentKioskAttendance.tsx  ← Per-student attendance marking (modify — highest priority)
│           └── StudentKioskConfirmation.tsx ← Student kiosk confirmation (modify)
```

**Structure Decision**: Web application (Option 2); frontend-only change — no backend directories involved.
