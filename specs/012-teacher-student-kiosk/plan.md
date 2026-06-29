# Implementation Plan: Teacher Student Attendance Kiosk

**Branch**: `012-teacher-student-kiosk` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-teacher-student-kiosk/spec.md`

## Summary

Enable a teacher-facing student attendance kiosk accessible at `/kiosk/:code/students` without requiring login. The teacher enters their Employee ID to authenticate at submission time; every attendance record stores that Employee ID in `recorded_by` for full auditability. The feature reuses the existing `kiosk_code` opaque URL mechanism and the shared `student_attendance` table. **Implementation status: substantially complete** — `StudentKioskController`, `StudentKioskPage`, all sub-components, and API client types were built as part of spec 011. This plan documents what exists and identifies the remaining gaps.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL · React · TanStack Query · TailwindCSS · shadcn/ui · Zod  
**Storage**: MySQL — `student_attendance` table (tenant_id, student_id, class_id, date, status, recorded_by)  
**Testing**: Manual integration testing via browser against local dev stack  
**Target Platform**: Tablet / desktop browser on school internal network  
**Project Type**: Web service (REST API) + React SPA  
**Performance Goals**: Attendance submission for 40 students in < 3 s round-trip  
**Constraints**: No JWT on kiosk endpoints; kiosk_code is the only public-facing tenant identifier  
**Scale/Scope**: Per-tenant; typical class size 20–50 students

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Multi-tenant isolation | ✅ PASS | All queries in `StudentKioskController` filter by `tenant_id` derived from `resolveTenant($code)`, never from request body |
| II — API-first separation | ✅ PASS | Frontend calls exclusively through `studentKioskApi` in `api.ts`; no direct DB access |
| III — JWT auth on protected routes | ✅ JUSTIFIED EXCEPTION | Kiosk endpoints are intentionally public (same pattern as staff kiosk 006/010); teacher identity confirmed by Employee ID at submit; documented in Complexity Tracking below |
| IV — Immutable migrations | ✅ PASS | `student_attendance` table with `recorded_by` already exists in migration `2025-12-28-102246_CreateDBSchemas.php`; no new migrations needed unless `student_kiosk_enabled` flag is separated |
| V — Financial ledger integrity | ✅ N/A | Feature does not touch ledger or payments |

## Project Structure

### Documentation (this feature)

```text
specs/012-teacher-student-kiosk/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── student-kiosk-api.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
└── app/
    ├── Config/
    │   └── Routes.php                          # student kiosk routes already registered
    └── Controllers/Api/
        ├── StudentKioskController.php          # COMPLETE — status, validateTeacher, classStudents, submit
        ├── AttendanceController.php            # NEEDS: recordedBy filter for admin query
        └── SettingsController.php              # NEEDS: student_kiosk_enabled toggle (if separate from kioskModeEnabled)

frontend/
└── src/
    ├── api/
    │   └── api.ts                              # COMPLETE — studentKioskApi + all interfaces
    ├── pages/
    │   └── StudentKioskPage.tsx                # COMPLETE — full state machine (idle → ID → class → attendance → confirm)
    ├── components/kiosk/
    │   ├── StudentKioskIdEntry.tsx             # COMPLETE
    │   ├── StudentKioskClassList.tsx           # COMPLETE
    │   ├── StudentKioskAttendance.tsx          # COMPLETE
    │   └── StudentKioskConfirmation.tsx        # COMPLETE
    ├── components/settings/
    │   └── GeneralSettingsTab.tsx              # NEEDS: student kiosk toggle + URL display (currently only staff kiosk)
    ├── types/
    │   └── dashboard.ts                        # NEEDS: studentKioskEnabled flag on Settings interface
    └── App.tsx                                 # COMPLETE — route /kiosk/:code/students registered
```

**Structure Decision**: Web application (Option 2). All new backend work goes under `backend/app/Controllers/Api/`; all new frontend work under `frontend/src/`. No new directories required.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Principle III — JWT bypass on kiosk endpoints | Kiosk is a shared device with no login session by design; teacher identity is established by Employee ID at submission time, not by a session | Requiring a JWT would force a login step, defeating the purpose of a walk-up kiosk |

## Remaining Work (gaps identified during planning)

The following items are **not yet complete** and must be addressed before this feature is considered delivered:

1. **Settings: `student_kiosk_enabled` toggle** — `GeneralSettingsTab.tsx` and `SettingsController.php` currently only expose a single `kioskModeEnabled` flag (staff). A separate `studentKioskModeEnabled` flag needs to be added to the Settings UI and the backend `SettingsController`. The `StudentKioskController::status()` currently reads `kioskModeEnabled` — this must be updated to read the correct separate flag.

2. **Settings: Student Kiosk URL display** — A second URL display block (mirroring the staff kiosk URL) needs to appear in `GeneralSettingsTab.tsx` when `studentKioskModeEnabled` is true, showing `/kiosk/{code}/students`.

3. **Settings type** — `Settings` interface in `frontend/src/types/dashboard.ts` needs `studentKioskModeEnabled?: boolean`.

4. **Admin attendance filter by `recordedBy`** — `AttendanceController::studentIndex()` does not support filtering by `recorded_by`. A `recordedBy` query param needs to be wired in.

5. **Admin attendance UI: `recordedBy` column + filter** — The `Attendance.tsx` page needs to surface the `recordedBy` field and allow filtering.

6. **`validateTeacher` returns only assigned classes** — Current implementation queries `classes WHERE teacher_id = staff.id`. The spec allows any active class. Decide and document: scope to assigned classes only (current) or all active classes. Assigned-only is simpler and safer; confirm with stakeholder if needed.
