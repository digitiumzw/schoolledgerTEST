# Research: Redo Staff Module & Kiosk Attendance Mode

**Branch**: `006-staff-kiosk-attendance`  
**Date**: 2026-04-06

---

## Decision 1: Kiosk Tenant Identification Without a Login Session

**Question**: Kiosk page must be accessible without staff logging in. The backend normally requires a JWT for all `/api/*` routes. How does the kiosk identify the tenant and authorize its requests?

**Decision**: Add `/api/kiosk/*` routes to the JWTAuthFilter exemption list (alongside `/auth/login` and `/auth/register`). These routes accept a `tenant_id` parameter from the request body (POST) or query string (GET) to identify the tenant. They validate that kiosk mode is enabled for that tenant before serving any data or recording any action.

**Rationale**:
- The tenants table uses opaque UUIDs as IDs (VARCHAR 50) — not sequential integers — so exposure via URL is low-risk.
- Kiosk endpoints return only: active staff first/last names (no contact info, no financial data) and a boolean status. The minimal data surface limits exposure risk.
- Employee ID confirmation is required for every write action, mitigating unauthorized attendance recording.
- The kiosk is intended for use on a school-managed device on the school's internal LAN, not on the public internet.
- This is a documented, justified exception to Constitution Principle III, entered in the Complexity Tracking table.

**Alternatives Considered**:
- *Kiosk JWT Token*: Generate a long-lived kiosk-specific JWT when admin enables kiosk mode, store in localStorage. Rejected: adds complexity (token generation, rotation, storage, expiry) for a feature whose security model is already device-trust-based.
- *Admin Login Once to Register Device*: Admin logs in to kiosk page; their JWT stored under `kiosk_session` key; kiosk endpoints validate this JWT. Rejected: ties kiosk availability to admin session validity; if JWT expires, the kiosk page breaks for staff.
- *Per-Device PIN*: Admin sets a device PIN for the kiosk page. Rejected: out of scope for v1; adds UX friction.

---

## Decision 2: Settings Storage for `kioskModeEnabled`

**Question**: Where does the `kioskModeEnabled` flag live? Is a schema migration needed?

**Decision**: Store `kioskModeEnabled` as a key in the existing `tenants.settings` JSON column. No new database column or table is needed. The `SettingsController` is extended to read/write this key, with a default of `false`.

**Rationale**:
- The existing settings architecture already stores `staffWorkHours`, `defaultCurrency`, `schoolName`, etc. as JSON in `tenants.settings`. Adding another key is consistent with the established pattern.
- No migration is required since `tenants.settings` is a JSON column that accepts any structure — the application layer enforces the schema.
- A no-migration approach is preferred when the only change is adding a nullable/defaultable key to an existing JSON blob.

**Alternatives Considered**:
- *Separate `kiosk_enabled` column on tenants*: Would require a migration. Rejected: over-engineered for a single boolean; inconsistent with the established pattern of storing settings in the JSON blob.

---

## Decision 3: Leave Type ENUM Alignment

**Question**: The database `leave_requests.leave_type` ENUM is `('sick', 'vacation', 'personal', 'maternity', 'paternity', 'unpaid')` but the TypeScript types define `('annual', 'sick', 'maternity', 'paternity', 'study', 'unpaid', 'compassionate')`. Which set wins?

**Decision**: Migrate the database to use the TypeScript-defined set: `('annual', 'sick', 'maternity', 'paternity', 'study', 'unpaid', 'compassionate')`. This aligns with standard HR leave categories used in Zimbabwean schools.

**Rationale**:
- 'vacation' and 'personal' are informal US-centric terms; 'annual' (annual leave entitlement) and a distinct 'compassionate' type are more appropriate for a school HR context.
- 'study' leave is relevant for teacher professional development.
- The TypeScript interface was the most recently authored definition (written after the DB migration) and likely reflects intended domain language.
- Existing leave_request rows with old type values must be migrated: `vacation → annual`, `personal → annual` (both map to general annual leave entitlement).

**Migration approach**:
1. New migration updates existing rows: `UPDATE leave_requests SET leave_type = 'annual' WHERE leave_type IN ('vacation', 'personal')`
2. Second step in same migration: `ALTER TABLE leave_requests MODIFY leave_type ENUM(...new values...)`.

---

## Decision 4: Duplicate Attendance Record Prevention

**Question**: Currently there is no unique constraint on `(tenant_id, staff_id, date)` in `staff_attendance`. How should duplicate prevention be enforced?

**Decision**: Add a `UNIQUE KEY` constraint on `(tenant_id, staff_id, date)` via a new migration. The `AttendanceController::checkIn()`, `checkOut()`, and kiosk action endpoints will use INSERT-or-UPDATE (upsert) semantics.

**Rationale**:
- A database-level unique constraint is more reliable than application-level checks; it prevents race conditions and future bypasses.
- Upsert behaviour on the application layer (check if record exists for today, update if so, insert if not) aligns with the spec requirement that a second check-in for the same day updates rather than duplicates.

---

## Decision 5: Attendance Record Source Tracking

**Question**: Should attendance records distinguish between records created by admin (manual) vs. the kiosk?

**Decision**: Add a `source` column to `staff_attendance` (`ENUM('manual', 'kiosk', 'system')`, default `'manual'`). Kiosk-created records use `'kiosk'`; admin-created/edited records use `'manual'`; future automated operations (e.g., auto-mark absent) use `'system'`.

**Rationale**:
- Provides an audit trail for how each record was created.
- Allows admin to filter or review kiosk-sourced records separately.
- Small schema addition with no breaking impact.

---

## Decision 6: Kiosk Page Architecture (Frontend)

**Question**: Is the kiosk page a separate route within the authenticated SPA, or truly separate?

**Decision**: The kiosk page is a dedicated frontend route at `/kiosk` that renders outside the authenticated layout (no sidebar, no top nav, no JWT check in the router). It has its own layout component. The React router's `<ProtectedRoute>` wrapper is NOT applied to this route.

**Rationale**:
- The kiosk page must work with no active login session — wrapping it in `<ProtectedRoute>` would redirect to login.
- A dedicated fullscreen layout (name list + sign-in form) is appropriate for a shared display device.
- The page uses its own React Query context to hit the public `/api/kiosk/*` endpoints, not the standard `api.ts` instance which always attaches the JWT.

---

## Decision 7: Staff Hard-Delete Guard

**Question**: What is the correct check for blocking staff hard-delete?

**Decision**: Before deleting a staff record, the backend checks for any rows in `staff_attendance` or `leave_requests` with matching `staff_id`. If any exist, the delete is rejected with HTTP 409 and a message suggesting status change to "resigned" or "retired."

**Rationale**:
- Consistent with the existing pattern used for students (`hard-delete guard for students with financial records`).
- Preserves historical attendance and leave data integrity.
