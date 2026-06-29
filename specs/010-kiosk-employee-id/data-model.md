# Data Model: Kiosk Employee ID & Redesign

**Branch**: `010-kiosk-employee-id` | **Date**: 2026-04-06

## Entities

---

### Employee ID (field on `staff` table)

| Attribute | Detail |
|-----------|--------|
| Column | `employee_id` VARCHAR(20) NOT NULL (for new records) |
| Constraint | UNIQUE per tenant (unique index already exists globally; tenant-scoped uniqueness enforced in application) |
| Format | `EMP` + 4-digit zero-padded sequential number (e.g., `EMP0001`, `EMP0042`) |
| Generation | Auto-generated in `StaffModel::beforeInsert()` callback using `MAX()+1` per tenant |
| Mutability | Immutable after creation. Not included in update allowed fields. |
| Existing records | Backfilled by migration `2026-04-06-200000` to normalized `EMP####` format |

**Auto-generation algorithm** (in `StaffModel`):
```
1. SELECT MAX(CAST(SUBSTRING(employee_id, 4) AS UNSIGNED))
   FROM staff WHERE tenant_id = :tenant_id AND employee_id LIKE 'EMP%'
2. next_num = result ?? 0 + 1
3. employee_id = 'EMP' + LPAD(next_num, 4, '0')
4. On unique constraint violation (race): retry once with next_num + 1
```

**`StaffModel` changes**:
- Add `employee_id` to `$allowedFields`
- Add `$beforeInsert = ['generateEmployeeId']` callback
- Add `employee_id` to `formatForApi()` return value as `employeeId`
- Do NOT add to `formatFromApi()` (immutable; never accepted from request body)

---

### Kiosk Access Code (field in `tenants.settings` JSON)

| Attribute | Detail |
|-----------|--------|
| Storage | `tenants.settings` JSON — key: `kiosk_code` |
| Format | 10-character alphanumeric string (e.g., `xK3mP9vR2q`) |
| Generation | Auto-generated in `SettingsController` when settings are saved and `kiosk_code` is absent |
| Mutability | Immutable after generation (regeneration not supported in this feature) |
| Exposure | Displayed in Settings page as part of the kiosk URL only |

**Settings JSON structure** (after this feature):
```json
{
  "schoolName": "Greenwood Academy",
  "contactEmail": "...",
  "contactPhone": "...",
  "address": "...",
  "defaultCurrency": "USD",
  "staffWorkHours": { "startTime": "08:30", "endTime": "17:00" },
  "kioskModeEnabled": true,
  "kiosk_code": "xK3mP9vR2q"
}
```

---

### Staff Attendance Record (`staff_attendance` table)

No structural changes, but the `status` ENUM expands:

| Old ENUM | New ENUM |
|----------|----------|
| `present, absent, late, on_leave` | `present, absent, late, on_leave, early_departure` |

**Early departure logic** (in `KioskController::action()` on check_out):
```
end_time_mins = hours(endTime) * 60 + minutes(endTime)
check_out_mins = hours(now) * 60 + minutes(now)
if (end_time_mins - check_out_mins) > 30:
    status = 'early_departure'
else:
    status = existing check_in status (unchanged)
```

The `early_departure` status replaces the `status` field on the existing attendance record (not additive).

---

### TypeScript Type Changes

**`Staff` type** (`src/types/dashboard.ts`):
```typescript
// Add field:
employeeId?: string;
```

**`KioskStatusResponse` type** (`src/api/api.ts`):
```typescript
// Remove:
staff: KioskStaffMember[];

// Add:
schoolName: string;
workHours: { startTime: string; endTime: string };
```

**`KioskActionRequest` type** (new):
```typescript
interface KioskActionRequest {
  kiosk_code: string;
  employee_id: string;
  // action removed — backend auto-detects
}
```

**`KioskActionResult` type** (update):
```typescript
interface KioskActionResult {
  staffName: string;
  action: 'check_in' | 'check_out';
  timestamp: string;
  date: string;
  attendanceStatus: 'present' | 'late' | 'early_departure';
  workHours?: number;          // present on check_out
  earlyDeparture?: boolean;    // present on check_out
}
```

---

## State Transitions

### Kiosk View States (frontend)

```
idle ──[valid employee_id submitted]──► processing
processing ──[success]──► confirmation
processing ──[error]──► idle (with error message, auto-clears after 5s)
confirmation ──[10s countdown expires]──► idle
confirmation ──[user taps "Done"]──► idle
```

### Staff Daily Attendance States

```
(no record) ──[kiosk check_in, on time]──► present
(no record) ──[kiosk check_in, after start_time]──► late
present/late ──[kiosk check_out, ≥ end_time - 30min]──► status unchanged
present/late ──[kiosk check_out, < end_time - 30min]──► early_departure
```
