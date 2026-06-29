# Research: Teacher Student Attendance Kiosk

**Feature**: `012-teacher-student-kiosk`  
**Date**: 2026-04-07

---

## 1. Existing Implementation Audit

**Decision**: Confirm what already exists before specifying new work.  
**Finding**: The student attendance kiosk was substantially built as part of spec 011. The following are **already complete and deployed**:

| Artifact | Location | Status |
|----------|----------|--------|
| Backend controller | `StudentKioskController.php` | Complete |
| API routes | `Routes.php` lines 37–40 | Complete |
| Frontend page | `StudentKioskPage.tsx` | Complete |
| ID entry component | `StudentKioskIdEntry.tsx` | Complete |
| Class list component | `StudentKioskClassList.tsx` | Complete |
| Attendance marking component | `StudentKioskAttendance.tsx` | Complete |
| Confirmation component | `StudentKioskConfirmation.tsx` | Complete |
| API client types | `api.ts` — `studentKioskApi` export | Complete |
| Frontend route | `App.tsx` line 344 | Complete |
| DB schema | `student_attendance` table with `recorded_by` | Complete |

---

## 2. URL Pattern Research

**Question**: Should the student kiosk use `/student-kiosk/{code}` or `/kiosk/{code}/students`?

**Decision**: `/kiosk/:code/students` (path sub-segment of the shared kiosk code).  
**Rationale**: Already implemented in `App.tsx` as `/kiosk/:code/students` and backend routes as `/api/kiosk/student-attendance/...`. Changing it would break existing deployments. The existing pattern cleanly namespaces under the same kiosk code, making both kiosks accessible from one shared device URL base.  
**Alternatives considered**: `/student-kiosk/:code` — rejected because it is not how the system was built (spec 011 implementation chose the sub-path approach).

---

## 3. Kiosk Mode Flag — Shared vs. Separate

**Question**: Should `studentKioskModeEnabled` be a separate flag from `kioskModeEnabled` (staff), or the same flag?

**Decision**: **Separate flag** — `studentKioskModeEnabled` independent of `kioskModeEnabled`.  
**Rationale**: The spec explicitly states "the student kiosk mode toggle is independent of the staff kiosk mode toggle." An admin should be able to run staff kiosk only, student kiosk only, both, or neither. The existing `StudentKioskController::status()` currently reads `kioskModeEnabled` — this is a **bug** that must be fixed as part of this spec.  
**Alternatives considered**: Single shared flag — rejected; schools may want staff-only or student-only kiosk operations.

---

## 4. Teacher Class Scope

**Question**: Should `validateTeacher` show only classes assigned to the teacher (`teacher_id = staff.id`) or all active classes for the tenant?

**Decision**: **Assigned classes only** (current implementation).  
**Rationale**: A teacher should only take attendance for their own classes. Showing all 30+ school classes to every teacher creates confusion and a surface for marking other teachers' classes. The current implementation is correct.  
**Alternatives considered**: All active classes — considered if a teacher substitutes; rejected for v1 (substitute scenario is an admin edit, not a kiosk use case).

---

## 5. Kiosk Code Reuse

**Question**: Should the student kiosk use the same `kiosk_code` as the staff kiosk, or a separate code?

**Decision**: **Same code** — reuse `settings.kiosk_code` for both kiosk types.  
**Rationale**: Already implemented this way. One code per tenant simplifies URL management; the sub-path (`/students`) differentiates the two kiosks. Generating a separate code would require a new settings field and migration.  
**Alternatives considered**: Separate `student_kiosk_code` — rejected; unnecessary complexity with no security benefit (both kiosks are equally public).

---

## 6. `recorded_by` Field Type

**Question**: Should `recorded_by` store the Employee ID string or the staff `id` (UUID)?

**Decision**: **Employee ID string** (e.g., `EMP0042`).  
**Rationale**: Already implemented this way in `StudentKioskController::submit()` (`'recorded_by' => $employeeId`). Storing the string makes the audit trail human-readable and resilient to staff record deactivation — the record remains readable even if the staff row is archived. The `AttendanceController::studentIndex()` already returns `recordedBy` from `recorded_by`.  
**Alternatives considered**: Staff UUID — provides a FK relationship but loses readability if staff is deactivated; rejected.

---

## 7. DB Migration Requirement

**Question**: Does this feature require any new migrations?

**Decision**: **No new migrations required** for the core kiosk flow. The `student_attendance` table with `recorded_by` already exists.  
**Note**: The `studentKioskModeEnabled` setting is stored as a JSON key inside `tenants.settings` (same pattern as `kioskModeEnabled`), so no schema change is needed — only the key name changes in the backend settings reader/writer.

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| URL pattern | `/kiosk/:code/students` (already implemented, keep as-is) |
| Kiosk mode flag | Separate `studentKioskModeEnabled` flag (must fix existing bug) |
| Teacher class scope | Assigned classes only |
| Kiosk code | Shared with staff kiosk |
| `recorded_by` storage | Employee ID string |
| New DB migration | Not required |
