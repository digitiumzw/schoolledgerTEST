# Research: Kiosk Employee ID & Redesign

**Branch**: `010-kiosk-employee-id` | **Date**: 2026-04-06

## R-001: Employee ID Generation Strategy

**Decision**: Generate Employee IDs in a `beforeInsert` callback on `StaffModel`, using a `MAX()+1` query scoped to the tenant, formatted as `EMP` + 4-digit zero-padded number.

**Rationale**:
- IDs must be tenant-scoped (EMP0001 can exist in two different tenants)
- The format must be human-readable and communicable verbally (staff need to remember or write it)
- The DB already has a `UNIQUE` index on `employee_id` (added by migration `2025-12-30-120200`), which serves as the collision-safety net

**Alternatives considered**:
- *Auto-increment column*: Rejected — would need a separate table/sequence per tenant; overly complex
- *UUID*: Rejected — not human-readable; staff cannot type `f3a2b1c4-...` at a kiosk
- *Trigger in DB*: Rejected — CodeIgniter convention is to keep logic in the application layer; triggers are invisible to code review

**Finding from code audit**:
- `StaffModel::allowedFields` does NOT include `employee_id` — it must be added
- `StaffModel::formatForApi()` does NOT return `employee_id` — it must be added
- `StaffController::create()` does NOT generate the ID — auto-generation must be added
- Migration `2025-12-30-120200` backfills existing staff using a pattern based on the `id` string, which may produce non-sequential IDs (e.g., `EMP001` from `st001`). A new migration must normalize all NULL IDs and ensure the format is consistently `EMP####`.

---

## R-002: Kiosk Code (Opaque Tenant Token)

**Decision**: Generate a random 10-character alphanumeric token (`kiosk_code`) stored in `tenants.settings` JSON. Resolve server-side on every kiosk request.

**Rationale**:
- No schema migration required (settings is already a JSON column on `tenants`)
- The code is meaningless without DB access, preventing tenant enumeration
- 10 alphanumeric chars = 62^10 ≈ 839 trillion possibilities — brute-force infeasible

**Generation trigger**: When settings are saved and `kiosk_code` is absent, auto-generate one. This ensures existing tenants get a code on next settings save without requiring a migration.

**URL format**: `/kiosk/{code}` — React Router param `:code`

**Backend resolution**:
```
SELECT id, settings FROM tenants
WHERE JSON_UNQUOTE(JSON_EXTRACT(settings, '$.kiosk_code')) = {code}
```

**Legacy compatibility**: KioskPage continues to accept `?tenant_id=` as a fallback query parameter. The Settings page will show only the new `/kiosk/{code}` URL going forward.

**Alternatives considered**:
- *URL slug based on school name*: Rejected — guessable; leaks school identity
- *Separate `kiosk_tokens` table*: Rejected — overkill; settings JSON is sufficient for a single token per tenant

---

## R-003: Kiosk UX Redesign Approach

**Decision**: Remove the staff-list browsing pattern. Replace with a single Employee ID input field on an idle screen that auto-detects check-in or check-out.

**Rationale**:
- Current flow has 3 screens and requires staff to find their own name in a list
- The Employee ID entry is already required — it can be the first and only step
- Removing the list improves privacy (other staff names/statuses not visible)
- Auto-detecting the action (check_in vs check_out) reduces decision-making by staff

**Component mapping** (current → new):
- `KioskStaffList.tsx` → `KioskIdleScreen.tsx` (school name, live clock, shift hours, ID input)
- `KioskActionPanel.tsx` → removed (merged into idle screen)
- `KioskConfirmation.tsx` → updated (add countdown, work hours context, early departure label)

**Auto-action logic**: The backend determines whether to check_in or check_out based on today's attendance record for the staff member. No `action` field is sent by the frontend.

**Finding from code audit**:
- `KioskPage.tsx` currently has 3 view states: `"list" | "action" | "confirmation"`
- New view states: `"idle" | "processing" | "confirmation" | "error"`
- `KioskConfirmation.tsx` already has the structure for name + time + status — needs work hours context added
- The backend `POST /api/kiosk/action` requires an explicit `action` field — this must be made optional (auto-detected) or a new auto-action endpoint created

---

## R-004: Work Hours in Kiosk Flow

**Decision**: Return `workHours` and `schoolName` in the kiosk status response. Display shift hours on the idle screen. Apply early-departure detection on checkout.

**Finding from code audit**:
- `GET /api/kiosk/status` currently returns: `{ kioskEnabled, date, staff[] }`
- Work hours are already in `tenants.settings.staffWorkHours`
- `KioskController::action()` already reads `staffWorkHours.startTime` for late detection
- No early-departure logic exists yet
- `staff_attendance.status` enum values: `present, absent, late, on_leave` — `early_departure` would be a new value

**Early departure rule**: checkout < (endTime - 30 minutes). This 30-minute grace period prevents flagging staff who leave just a few minutes early.

**Migration needed**: Add `early_departure` to the `status` ENUM in `staff_attendance`. This requires a new migration since the ENUM is a schema constraint.

---

## R-005: `employee_id` in Staff Profile

**Decision**: Add Employee ID display to the profile header card in `StaffProfilePage.tsx`, styled as a badge/chip element. Include a one-click copy-to-clipboard button.

**Finding from code audit**:
- `StaffModel::formatForApi()` does not include `employee_id` — must be added
- `StaffProfilePage.tsx` renders a header card with name, status badge, position, department, and hire date
- The `Staff` TypeScript type (in `src/types/dashboard.ts`) likely does not have an `employeeId` field — must be added

**Placement**: In the profile header card, alongside the employment status badge, before the tab navigation. Visually distinct with a monospace font or "chip" styling (e.g., `bg-slate-100 rounded px-2 py-0.5 font-mono text-sm`).

---

## R-006: Migration Strategy

**Decision**: Single new migration file for all schema changes in this feature.

**Changes required**:
1. Normalize existing `employee_id` values to `EMP####` format (some existing records may have `EMP001` or `EMP12a` from the old backfill logic)
2. Ensure sequential numbering within each tenant
3. Add `early_departure` to `staff_attendance.status` ENUM

**No changes required** to the `tenants` table (kiosk_code goes in the settings JSON column).

**Migration filename**: `2026-04-06-200000_Kiosk_employee_id_improvements.php`
