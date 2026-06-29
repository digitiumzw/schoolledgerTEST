# Quickstart: Restrict Tenant Roles and Kiosk-Only Access

## What Changes

This feature has three independent parts that can be tested separately:

1. **Role restriction + account cap** — backend + frontend changes to user management
2. **Driver kiosk** — new public endpoints + new frontend kiosk page
3. **Teacher kiosk** — existing kiosk already works; only cleanup of login accounts needed

---

## Testing Part 1: Role Restriction

1. Run the backend: `php spark serve` (from `backend/`)
2. Log in as an admin: `admin@greenwood.co.zw` / `1234`
3. Go to Settings → User Accounts
4. Verify: role dropdown shows only "Administrator" and "Bursar"
5. Via API: `POST /api/users` with `role: "teacher"` — expect `400`
6. Create 5 accounts, then attempt a 6th — expect `429` or a clear error

## Testing Part 2: Driver Kiosk

1. Ensure a staff record exists with `employment_status = active` and a known `employee_id` (e.g., `DRV001`)
2. Ensure a `transport_routes` row has `driver_staff_id` set to that staff member's `id`
3. Get the tenant's `kiosk_code` from the DB: `SELECT JSON_UNQUOTE(JSON_EXTRACT(settings, '$.kiosk_code')) FROM tenants LIMIT 1;`
4. Navigate to: `http://localhost:5173/kiosk/driver/<kiosk_code>`
5. Enter `DRV001` — expect route list to appear
6. Enter an invalid ID — expect an error message
7. Wait 2 minutes with no interaction — expect the page to return to the ID entry screen

## Testing Part 3: Teacher Account Cleanup

1. Run the migration to deactivate teacher/driver accounts
2. Attempt to log in with a former teacher account — expect "account disabled" or "invalid credentials"
3. Navigate to the student attendance kiosk (`/kiosk/student-attendance/<code>`) and enter a teacher's employee ID — expect attendance marking to still work

---

## Database Setup for Testing

```sql
-- Check existing driver staff records
SELECT id, first_name, last_name, employee_id, employment_status
FROM staff
WHERE employment_status = 'active'
LIMIT 5;

-- Link a route to a driver staff member (after migration adds the column)
UPDATE transport_routes
SET driver_staff_id = '<staff_id>'
WHERE id = '<route_id>';

-- Verify deactivated accounts after migration
SELECT id, email, role, status FROM users
WHERE role IN ('teacher', 'driver');
```

---

## New Route URLs

| URL | Purpose |
|-----|---------|
| `/kiosk/driver/:code` | Driver kiosk — Employee ID entry + My Routes view |
| `/kiosk/student-attendance/:code` | Teacher kiosk — unchanged, already live |
