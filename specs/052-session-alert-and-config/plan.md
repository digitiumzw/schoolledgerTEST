# Implementation Plan: Session Alert and Configuration

**Branch**: `052-session-alert-and-config` | **Date**: 2026-04-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/052-session-alert-and-config/spec.md`

## Summary

This is a **pure frontend feature**. No backend changes are required — `activeAcademicSession` is already stored on the `Settings` entity and exposed via `PUT /api/settings`. The work is confined to three UI surfaces:

1. **`GeneralSettingsTab`** — convert the read-only session display into an editable `Select` pre-filled with the recommended session; add a "no session" alert and a "Save Session" button.
2. **`AcademicCalendarTab`** — change the initial `selectedSession` state from `"__none__"` to the recommended session when no session is saved.
3. **`Classes` page** — extend the existing "No active session" alert with an inline compact session dropdown + "Set Session" button that invalidates the `settings` React Query cache on success.

## Technical Context

**Language/Version**: TypeScript 5 · React 18  
**Primary Dependencies**: TanStack React Query v5, shadcn/ui (`Select`, `Alert`, `Button`), TailwindCSS  
**Storage**: N/A (no schema changes; settings are persisted via existing `PUT /api/settings`)  
**Testing**: No dedicated test runner configured for frontend; integration coverage via backend tests in `backend/tests/`  
**Target Platform**: Web (desktop + mobile responsive)  
**Project Type**: Web application (React SPA frontend)  
**Performance Goals**: Alert and dropdown render within 500 ms of settings load; no new network requests introduced beyond existing `GET /api/settings` and `PUT /api/settings`  
**Constraints**: Must not break existing session-save behaviour in `AcademicCalendarTab`; inline Classes widget must not cause a full page reload  
**Scale/Scope**: 3 frontend files modified; no new routes, no new API endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ Pass | No new queries; `tenant_id` filtering unchanged in backend |
| II. API-First Separation | ✅ Pass | All session saves go through `api.saveSettings()` in `api.ts` |
| III. JWT Auth & Role-Based Access | ✅ Pass | No new routes; existing auth guards apply |
| IV. Immutable Migrations | ✅ Pass | No schema changes |
| V. Financial Ledger Integrity | ✅ N/A | No ledger queries touched |
| VI. REST API Standards | ✅ Pass | No new endpoints; existing `PUT /api/settings` used |
| VII. Code Quality | ✅ Pass | Recommended-session logic extracted to a shared `useMemo`; no duplication |
| VIII. Defensive Security | ✅ Pass | Session value is selected from a controlled enum list; no free-text input |
| IX. Error Handling | ✅ Pass | All save paths have `try/catch` with user-facing toast errors |
| X. Integration Testing | ⚠️ Advisory | Pure UI change; backend `PUT /api/settings` already tested. No new backend logic to cover. |
| XI. Performance Discipline | ✅ Pass | `sessionOptions` and recommended session derived via `useMemo`; no unnecessary re-renders |

## Project Structure

### Documentation (this feature)

```text
specs/052-session-alert-and-config/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (files changed by this feature)

```text
frontend/
└── src/
    ├── components/
    │   └── settings/
    │       ├── GeneralSettingsTab.tsx   # MODIFY — session field → editable Select + alert + Save Session button
    │       └── AcademicCalendarTab.tsx  # MODIFY — selectedSession default → recommended session
    └── pages/
        └── Classes.tsx                 # MODIFY — inline session selector embedded in no-session alert
```

**Structure Decision**: Web application (frontend-only). No backend files are modified. All three changed files already exist; no new files are created.

## Complexity Tracking

*No constitution violations. No entries required.*
