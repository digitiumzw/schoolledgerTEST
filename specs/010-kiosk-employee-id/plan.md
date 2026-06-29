# Implementation Plan: Kiosk Employee ID & Redesign

**Branch**: `010-kiosk-employee-id` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/010-kiosk-employee-id/spec.md`

## Summary

Five interconnected improvements to the staff attendance kiosk system:

1. **Auto-generate Employee IDs** on staff creation (backend model callback + migration for backfill)
2. **Display Employee ID on Staff Profile** (frontend header card)
3. **Redesign kiosk UX** from "browse staff list → select → enter ID" to "type ID → auto-action → confirmation"
4. **Hide Tenant ID from kiosk URL** using an opaque `kioskCode` stored in tenant settings
5. **Wire Work Hours Configuration** into kiosk UI display and early-departure detection on checkout

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · Vite + TailwindCSS + shadcn/ui + TanStack React Query (frontend)  
**Storage**: MySQL — `staff`, `tenants` (settings JSON), `staff_attendance` tables  
**Testing**: Manual browser + `php spark migrate` for schema verification  
**Target Platform**: Tablet/desktop browser (768px+) for kiosk; admin web app for staff management  
**Project Type**: Web application (separate frontend SPA + backend REST API)  
**Performance Goals**: Kiosk check-in completes in under 20 seconds end-to-end  
**Constraints**: No JWT on kiosk endpoints (documented justified exception); tenant isolation via kiosk code resolution server-side  
**Scale/Scope**: Per-tenant: up to ~200 staff; kiosk used daily by all active staff

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | `kiosk_code → tenant_id` resolved server-side; no tenant_id accepted from kiosk request body. All admin endpoints continue using JWT-sourced `tenant_id`. |
| II. API-First Separation | ✅ PASS | All changes route through `/api/*`. Frontend uses `api.ts` Axios instance. |
| III. JWT Auth & Role-Based Access | ✅ JUSTIFIED EXCEPTION | Kiosk endpoints are already documented exceptions (public endpoints, no JWT). The new opaque `kiosk_code` actually improves security over raw `tenant_id` in URL. Exception documented in Complexity Tracking below. |
| IV. Immutable Migrations | ✅ PASS | New migration file for employee ID backfill. `kiosk_code` stored in existing `tenants.settings` JSON — no schema migration required. |
| V. Financial Ledger Integrity | ✅ N/A | Feature does not touch ledger tables. |

*Post-Phase 1 re-check*: ✅ All contracts maintain server-side `kiosk_code → tenant_id` resolution. `employee_id` field added to `StaffModel::allowedFields` without touching ledger paths.

## Project Structure

### Documentation (this feature)

```text
specs/010-kiosk-employee-id/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   ├── kiosk-api.md     ← Phase 1 output
│   └── staff-api.md     ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   ├── KioskController.php        ← major changes (kiosk_code, new flow)
│   │   ├── StaffController.php        ← add employee_id auto-generation
│   │   └── SettingsController.php     ← add kiosk_code generation
│   ├── Models/
│   │   └── StaffModel.php             ← add employee_id to allowedFields + formatForApi
│   └── Database/Migrations/
│       └── 2026-04-06-200000_Backfill_employee_ids_and_generate_kiosk_codes.php  ← new

frontend/
├── src/
│   ├── pages/
│   │   └── KioskPage.tsx              ← complete redesign (ID-first flow)
│   ├── components/
│   │   ├── kiosk/
│   │   │   ├── KioskIdleScreen.tsx    ← new (replaces KioskStaffList)
│   │   │   ├── KioskIdEntry.tsx       ← new (replaces KioskActionPanel)
│   │   │   └── KioskConfirmation.tsx  ← update (show work hours context)
│   │   └── settings/
│   │       └── GeneralSettingsTab.tsx ← update kiosk URL display
│   ├── App.tsx                        ← change route from /kiosk → /kiosk/:code
│   └── api/
│       └── api.ts                     ← update kiosk API calls (use code, not tenant_id)
```

**Structure Decision**: Web application with separate `frontend/` and `backend/` directories per Option 2 in project conventions.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Kiosk endpoints exempt from JWTAuthFilter (Principle III) | Kiosk is a shared, unattended device. Staff using it have no JWT tokens. Authentication is via Employee ID only. | Requiring staff to log in with a school-issued JWT defeats the purpose of the kiosk (quick, frictionless daily sign-in). This exception was accepted in spec 006 and documented in its plan. |

---

## Phase 0: Research

*Findings for all technical unknowns.*

### research.md

See [research.md](./research.md)

---

## Phase 1: Design

### Key Design Decisions

#### 1. Employee ID Auto-Generation Strategy

**Problem**: `employee_id` exists in the DB but is nullable and NOT in `StaffModel::allowedFields`. `StaffController::create()` never assigns it.

**Decision**: Use a `beforeInsert` callback in `StaffModel` to generate the Employee ID atomically.

**Algorithm** (collision-safe):
```
SELECT MAX(CAST(SUBSTRING(employee_id, 4) AS UNSIGNED)) FROM staff WHERE tenant_id = ?
→ next_num = MAX + 1 (or 1 if no records)
→ employee_id = 'EMP' + LPAD(next_num, 4, '0')
```
Use a DB-level unique constraint (already exists) as the safety net. If two inserts race, the second fails on the unique constraint — retry once with an incremented number.

**Why not a global counter**: SchoolLedger is multi-tenant; IDs are tenant-scoped, meaning EMP0001 can exist in two different tenants without conflict.

**Why not UUID**: The `EMP####` format is human-readable and is communicated verbally to staff for kiosk use.

#### 2. Kiosk Code (Hidden Tenant ID)

**Decision**: Store a random 10-character alphanumeric token (`kiosk_code`) in `tenants.settings` JSON. Generate it lazily: when kiosk mode is enabled for the first time, or when Settings are first saved after this migration.

**URL pattern**: `/kiosk/:code` (frontend route)  
**API resolution**: Backend resolves `kiosk_code → tenant_id` with a DB lookup on every kiosk request.

**Security**: The code is opaque (not the tenant UUID) and not guessable. It is only shared intentionally via the Settings page.

**Legacy support**: `/kiosk?tenant_id=xxx` (old format) — `KioskPage.tsx` detects the query param fallback and still works, but the Settings page now only shows the new-format URL.

#### 3. Kiosk UX Redesign (ID-First Flow)

**Current flow**: Staff list → click own name → enter Employee ID → confirm  
**Problem**: Requires staff to browse the list, exposes all staff names on screen, and has an extra navigation step.

**New flow**:
```
[Idle Screen]
  School name | Current time (live) | Shift: 08:30 – 17:00
  "Enter your Employee ID to sign in or out"
       ↓ staff types ID and presses Enter
[Processing] (300ms spinner)
       ↓ success
[Confirmation Screen]
  "Good morning, Sarah Moyo!"
  Signed in at 08:22 · On Time
  [OR] "Goodbye, Sarah Moyo!"
  Signed out at 16:45 · 7.9 hours worked · Early departure
       ↓ auto-returns to Idle after 10 seconds (with countdown)
```

**Key UX improvements**:
- No staff list visible (privacy)
- Single input field, no navigation
- Live clock on idle screen
- Shift hours displayed
- Countdown timer on confirmation screen
- Error state returns to idle (friendly message, no staff data revealed)

#### 4. Work Hours in Kiosk Status Response

**Addition**: The `GET /api/kiosk/status/:code` response now includes:
```json
{
  "kioskEnabled": true,
  "schoolName": "Greenwood Academy",
  "workHours": { "startTime": "08:30", "endTime": "17:00" },
  "date": "2026-04-06"
}
```
Staff list is removed from the status response (no longer needed in ID-first flow).

#### 5. Early Departure Detection

**Rule**: If checkout time < (configured end time - 30 minutes), flag as `early_departure`.  
**Storage**: New status enum value `early_departure` added to `staff_attendance.status`.  
**Display**: Confirmation shows "Early departure" label; attendance reports already show the status column.

---

*See [data-model.md](./data-model.md) for entity definitions and [contracts/](./contracts/) for API contracts.*
