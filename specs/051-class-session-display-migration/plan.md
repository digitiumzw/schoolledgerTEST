# Implementation Plan: Class Page Session Display & Migration Session Awareness

**Branch**: `051-class-session-display-migration` | **Date**: 2026-04-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/051-class-session-display-migration/spec.md`

## Summary

This is a **frontend-only** feature. It adds a read-only academic session badge to the Classes page header (sourced from the existing `GET /api/settings` response field `activeAcademicSession`) and ensures the migration preview modal and promotion flow derive their session values from that same authoritative source rather than from wall-clock year calculations. No new backend endpoints, database migrations, or backend changes are required.

## Technical Context

**Language/Version**: TypeScript 5 · React 18 (frontend-only change)  
**Primary Dependencies**: TanStack React Query v5, shadcn/ui, TailwindCSS, Zod  
**Storage**: N/A (no schema changes; reads from existing `GET /api/settings` response)  
**Testing**: Vitest + React Testing Library (frontend unit); backend integration tests are N/A because no backend code changes  
**Target Platform**: Browser (desktop + mobile responsive, same as existing Classes page)  
**Project Type**: Web application — React SPA frontend  
**Performance Goals**: Session indicator must resolve within the same render cycle as the page's own loading state (no added waterfall)  
**Constraints**: Must not introduce a new API call that isn't already made by the Classes page or its child components; re-use `GET /api/settings` already called by `AppHeader`  
**Scale/Scope**: Single page modification (`frontend/src/pages/Classes.tsx`) + a new reusable `useActiveSession` hook

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | No new queries. `GET /api/settings` already filters by JWT-sourced `tenant_id` server-side. Frontend reads and displays only. |
| II | API-First Separation of Concerns | ✅ PASS | Session value sourced exclusively from REST API response; no direct DB access or business logic embedded in frontend. |
| III | JWT Authentication & Role-Based Access | ✅ PASS | No new routes. Existing `GET /api/settings` is already behind `JWTAuthFilter`. Classes page is already role-gated. |
| IV | Immutable Migrations | ✅ PASS | No schema changes whatsoever. |
| V | Financial Ledger Integrity | ✅ PASS | Not applicable — no ledger or balance logic touched. |
| VI | REST API Standards | ✅ PASS | No new endpoints. Existing endpoints and response envelopes are unchanged. |
| VII | Code Quality & Maintainability | ✅ PASS | Session-fetch logic extracted to a dedicated `useActiveSession` hook (single responsibility, reusable). |
| VIII | Defensive Security | ✅ PASS | No user input, no secrets. Displayed session value comes from the backend (already sanitised). |
| IX | Error Handling & Observability | ✅ PASS | Graceful degradation required (FR-004): skeleton on load, "—" on error. No internal errors exposed. |
| X | Integration Testing | ✅ PASS | Feature is frontend-only. Unit tests for the new hook cover happy path, error path, and fallback. No new backend integration tests needed. |
| XI | Performance Discipline | ✅ PASS | Settings data re-used via React Query cache (`staleTime: 5 min`). No redundant re-fetches introduced. |

**Pre-design gate: ALL PASS. No violations.**

## Project Structure

### Documentation (this feature)

```text
specs/051-class-session-display-migration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── GET_settings.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── hooks/
│   │   └── useActiveSession.ts       # NEW — fetches + caches active session via React Query
│   ├── pages/
│   │   └── Classes.tsx               # MODIFIED — add SessionBadge to header area
│   └── components/
│       └── modals/
│           └── MigrationPreviewModal.tsx  # VERIFY — academicSession/nextSession already correct
└── (no new test files mandated; hook unit tests recommended)
```

**Structure Decision**: Web application (Option 2). Only the `frontend/` subtree is touched. No `backend/` changes. The new hook lives in `frontend/src/hooks/` following the existing pattern (`useGradeLevels.ts`, `useWorkHours.ts`, etc.).

## Complexity Tracking

> No constitution violations — table not required.
