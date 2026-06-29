# Implementation Plan: Redo Staff Module & Kiosk Attendance Mode

**Branch**: `006-staff-kiosk-attendance` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/006-staff-kiosk-attendance/spec.md`

---

## Summary

Overhaul the staff management module and staff attendance system to fix known bugs (leave type ENUM mismatch, missing duplicate prevention, missing hard-delete guard, raw DB queries in controllers), then add a new **kiosk mode** feature: an admin toggle that activates a public, session-less `/kiosk` page where staff sign in and out by selecting their name and confirming with their employee ID.

---

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL (backend) · Vite · TailwindCSS · shadcn/ui · TanStack React Query · React Hook Form + Zod (frontend)  
**Storage**: MySQL — `staff`, `staff_attendance`, `leave_requests`, `tenants` tables  
**Testing**: Manual integration testing (no automated test framework in repo)  
**Target Platform**: Web (school LAN; SaaS multi-tenant)  
**Project Type**: Web application — React SPA + CodeIgniter 4 REST API  
**Performance Goals**: Kiosk sign-in round-trip < 30 seconds end-to-end; staff search results < 2 seconds  
**Constraints**: Multi-tenant isolation enforced via JWT (Principle I); kiosk endpoints are a justified public exception (see Constitution Check); single unique attendance record per staff per day  
**Scale/Scope**: Typically 10–200 staff per school tenant; single-device kiosk per school

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ Pass | All queries use `tenant_id` from JWT. Kiosk endpoints use `tenant_id` from request but this is validated against the DB — no JWT source needed since the data returned is non-sensitive. |
| II. API-First Separation | ✅ Pass | Frontend communicates only through `/api`. No DB access from frontend. |
| III. JWT Auth & Role-Based Access | ⚠️ **Justified Exception** | `/api/kiosk/status` and `/api/kiosk/action` are public. See Complexity Tracking. |
| IV. Immutable Migrations | ✅ Pass | Two new migration files; existing migrations untouched. |
| V. Financial Ledger Integrity | ✅ N/A | Feature does not touch charges, payments, or balance queries. |

---

## Project Structure

### Documentation (this feature)

```text
specs/006-staff-kiosk-attendance/
├── plan.md              ← this file
├── spec.md              ← feature specification
├── research.md          ← Phase 0 decisions
├── data-model.md        ← Phase 1 schema + entity model
├── contracts/
│   └── api-contracts.md ← Phase 1 API contracts
├── quickstart.md        ← Phase 1 dev setup guide
├── checklists/
│   └── requirements.md  ← spec quality checklist
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
backend/
├── app/
│   ├── Config/
│   │   ├── Routes.php              # Add kiosk public routes
│   │   └── Filters.php             # Add kiosk paths to JWT exclusion
│   ├── Controllers/Api/
│   │   ├── KioskController.php     # NEW
│   │   ├── StaffController.php     # Add hard-delete guard
│   │   ├── AttendanceController.php # Fix duplicate prevention + source column
│   │   ├── LeaveController.php     # Fix leave_type validation
│   │   └── SettingsController.php  # Add kioskModeEnabled
│   └── Database/Migrations/
│       ├── 2026-04-06-001_Add_source_to_staff_attendance.php  # NEW
│       └── 2026-04-06-002_Fix_leave_type_enum.php             # NEW

frontend/
├── src/
│   ├── App.tsx                             # Add /kiosk route
│   ├── pages/
│   │   ├── KioskPage.tsx                   # NEW
│   │   ├── Staff.tsx                       # Hard-delete guard messaging
│   │   └── StaffAttendance.tsx             # Minor fixes
│   ├── components/
│   │   ├── kiosk/
│   │   │   ├── KioskStaffList.tsx          # NEW
│   │   │   ├── KioskActionPanel.tsx        # NEW
│   │   │   └── KioskConfirmation.tsx       # NEW
│   │   └── settings/                       # Add kiosk toggle
│   ├── api/
│   │   └── api.ts                          # Add kiosk API functions
│   ├── hooks/
│   │   └── useStaffAttendanceData.ts       # Fix cache invalidation
│   └── types/
│       └── dashboard.ts                    # Fix LeaveRequest.leaveType union
```

**Structure Decision**: Web application (Option 2). Existing `backend/` and `frontend/` split is preserved. All new files follow established naming conventions and directory layouts.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `/api/kiosk/*` public (Principle III exception) | Kiosk page must be accessible without a staff login session. Individual staff do not have system accounts. | *Kiosk JWT token*: requires token generation, storage, rotation, and expiry management — disproportionate complexity for a shared-device, school-LAN use case. *Admin-login-once kiosk session*: ties kiosk availability to admin JWT expiry; breaks kiosk if admin token expires mid-day. The public-endpoint approach with employee ID confirmation and tenant validation is the minimum viable security model for this deployment context. |

---

## Phase 0 Research Summary

All unknowns resolved. See [research.md](research.md) for full decisions.

| Unknown | Resolution |
|---------|------------|
| Kiosk tenant identification | `tenant_id` passed in request; public endpoint group; employee ID confirms identity for writes |
| `kioskModeEnabled` storage | JSON key in `tenants.settings` — no migration needed |
| Leave type ENUM alignment | Migrate DB to TypeScript set; `vacation/personal → annual` for existing rows |
| Duplicate attendance prevention | Add DB unique constraint `(tenant_id, staff_id, date)`; upsert in controller |
| Attendance source tracking | Add `source ENUM('manual','kiosk','system')` column via new migration |
| Kiosk frontend architecture | Dedicated `/kiosk` route outside `<ProtectedRoute>` with own layout |
| Staff hard-delete guard | Check for rows in `staff_attendance` or `leave_requests` before deleting |

---

## Phase 1 Design Artifacts

- [data-model.md](data-model.md) — Entity schema, state transitions, validation rules  
- [contracts/api-contracts.md](contracts/api-contracts.md) — All new and modified API endpoints  
- [quickstart.md](quickstart.md) — Dev setup, migration steps, kiosk test walkthrough  

---

## Implementation Phases

### Phase A — Database Migrations (Foundation)

1. Create `2026-04-06-001_Add_source_to_staff_attendance.php`:
   - Add `source ENUM('manual','kiosk','system') DEFAULT 'manual'` column to `staff_attendance`
   - Add `UNIQUE KEY uq_staff_date (tenant_id, staff_id, date)` constraint
   - `down()`: drop constraint and column

2. Create `2026-04-06-002_Fix_leave_type_enum.php`:
   - UPDATE rows: `SET leave_type='annual' WHERE leave_type IN ('vacation','personal')`
   - ALTER COLUMN to new ENUM: `('annual','sick','maternity','paternity','study','unpaid','compassionate')`
   - `down()`: revert ENUM (note: migrated rows become 'annual', irreversible for old 'vacation'/'personal' — document in class docblock)

### Phase B — Backend Fixes (Bug Fixes)

3. **StaffController**: Add hard-delete guard — check for attendance/leave records before DELETE; return HTTP 409 with message.

4. **AttendanceController**: 
   - Fix `checkIn()` and `checkOut()` to upsert (check existing record first; INSERT or UPDATE)
   - Add `source` field to all insert/update operations (`'manual'` for admin actions)
   - Fix `recordStaffAttendance()` to set `source = 'manual'`

5. **LeaveController**: Update leave_type validation to use new ENUM values list.

6. **SettingsController**: Add `kioskModeEnabled` to `DEFAULT_SETTINGS`, `index()` response, and `update()` merge.

### Phase C — Kiosk Backend (New Feature)

7. Create `app/Controllers/Api/KioskController.php`:
   - `status(GET)`: validate `tenant_id` param → check `kioskModeEnabled` → return staff list with `kioskState` per member
   - `action(POST)`: validate params → check kiosk enabled → validate employee ID → upsert attendance with `source='kiosk'`

8. **Routes.php**: Add public kiosk route group (`/api/kiosk/status`, `/api/kiosk/action`) before the JWT-filtered group.

9. **Filters.php**: Add `/api/kiosk/*` to JWTAuthFilter exclusion list.

### Phase D — Frontend Fixes (Bug Fixes)

10. **`src/types/dashboard.ts`**: Update `LeaveRequest.leaveType` union to new values.

11. **`src/hooks/useStaffAttendanceData.ts`**: Fix query invalidation after attendance mutations (ensure records list re-fetches after check-in/check-out).

12. **`src/pages/Staff.tsx`**: Add 409-specific error message when delete is blocked by attendance/leave records.

13. **`src/pages/StaffAttendance.tsx`** / **`AttendanceRecordsTab.tsx`**: Verify leave type dropdowns use the updated values; fix any remaining display bugs.

### Phase E — Settings Kiosk Toggle (Admin UX)

14. **`src/api/api.ts`**: Add `kioskModeEnabled` to settings update function.

15. **Settings page / component**: Add kiosk mode toggle (admin only). When enabled, show a "Kiosk URL" display with copy button containing the current tenant's kiosk URL (`/kiosk?tenant_id=<id>`).

### Phase F — Kiosk Frontend (New Feature)

16. **`src/App.tsx`**: Add `/kiosk` route using a `<KioskLayout>` (no auth wrapper, no sidebar).

17. **`src/pages/KioskPage.tsx`**: Main kiosk page component. Reads `tenant_id` from URL query param. Manages view state: `list → action-panel → confirmation → list`.

18. **`src/components/kiosk/KioskStaffList.tsx`**: Displays active staff from `GET /api/kiosk/status`. Shows `kioskState` badge per staff member. Supports name search. On staff select, transitions to action panel.

19. **`src/components/kiosk/KioskActionPanel.tsx`**: Shows selected staff name, correct action (Sign In / Sign Out / Completed), employee ID input, and submit button. On submit, calls `POST /api/kiosk/action`. Shows inline validation errors.

20. **`src/components/kiosk/KioskConfirmation.tsx`**: Displays success confirmation (staff name, action, timestamp). Auto-resets to staff list after 4 seconds with a countdown. Includes a "Done" button for early reset.

21. **`src/api/api.ts`**: Add `getKioskStatus(tenantId)` and `postKioskAction(tenantId, staffId, employeeId, action)` functions using a separate Axios instance (no Authorization header).

---

## Post-Implementation Check

Before raising a PR, verify:

1. ✅ All new `staff_attendance` queries include `tenant_id` filtering (Principle I)
2. ✅ `KioskController` validates `tenant_id` from request against DB (Principle I)
3. ✅ No business logic in frontend components — kiosk logic in `KioskPage.tsx` hooks and `api.ts` (Principle II)
4. ✅ `/api/kiosk/*` public exception documented in Complexity Tracking (Principle III)
5. ✅ Two new migration files created; no existing migrations edited (Principle IV)
6. ✅ No ledger (charges/payments) code touched (Principle V)
