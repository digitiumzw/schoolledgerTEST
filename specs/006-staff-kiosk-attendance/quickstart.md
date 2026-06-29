# Quickstart: Redo Staff Module & Kiosk Attendance Mode

**Branch**: `006-staff-kiosk-attendance`

---

## Prerequisites

- Backend running: `cd backend && php spark serve` (port 8080)
- Frontend running: `cd frontend && npm run dev` (port 8080 via Vite proxy, or port 5173)
- MySQL database accessible; migrations up to date: `php spark migrate`
- Default dev credentials: `admin@greenwood.co.zw` / `1234`

---

## Setup Sequence

### 1. Apply the new migrations

```bash
cd backend
php spark migrate
```

This runs:
- `2026-04-06-001_Add_source_to_staff_attendance.php` — adds `source` column and unique constraint
- `2026-04-06-002_Fix_leave_type_enum.php` — fixes `leave_type` ENUM and migrates existing data

### 2. Verify staff have employee IDs

The kiosk requires all staff to have an `employee_id` set. Seed data includes employee IDs. For existing dev data without IDs, use the admin Staff page to add them, or use:

```bash
php spark db:seed SampleDataSeeder
```

---

## Testing the Kiosk Flow

### Step 1 — Enable kiosk mode as admin

1. Log in at `http://localhost:5173` as `admin@greenwood.co.zw` / `1234`
2. Navigate to **Settings** → find the **Kiosk Mode** toggle
3. Enable it and save

### Step 2 — Open the kiosk page

Navigate to `http://localhost:5173/kiosk?tenant_id=<your-tenant-id>`

> The tenant ID is visible in the Settings page URL or API response. Alternatively, after enabling kiosk mode, the Settings page shows a "Copy Kiosk URL" button.

### Step 3 — Sign in as a staff member

1. Find a staff member in the list (or search by name)
2. Tap/click their name
3. Enter their employee ID (e.g., `EMP-001`)
4. Tap **Sign In**
5. Confirmation screen appears; page resets after 3 seconds

### Step 4 — Verify in admin view

1. Log back in as admin
2. Navigate to **Staff Attendance** → **Daily Attendance**
3. The staff member shows as Present/Late with the kiosk check-in time
4. Navigate to **Attendance Records** — the record shows `source: kiosk`

---

## Key Files (Implementation Targets)

### Backend

| File | Change |
|------|--------|
| `app/Config/Routes.php` | Add `/api/kiosk/*` routes (public group) |
| `app/Config/Filters.php` | Add `/api/kiosk/*` to JWTAuthFilter exclusion |
| `app/Controllers/Api/KioskController.php` | **New** — kiosk status and action endpoints |
| `app/Controllers/Api/SettingsController.php` | Add `kioskModeEnabled` read/write |
| `app/Controllers/Api/AttendanceController.php` | Fix duplicate prevention (upsert); add `source` |
| `app/Controllers/Api/LeaveController.php` | Fix leave_type validation against new ENUM |
| `app/Controllers/Api/StaffController.php` | Add hard-delete guard |
| `app/Database/Migrations/2026-04-06-001_Add_source_to_staff_attendance.php` | **New** |
| `app/Database/Migrations/2026-04-06-002_Fix_leave_type_enum.php` | **New** |

### Frontend

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/kiosk` route (outside `<ProtectedRoute>`) |
| `src/pages/KioskPage.tsx` | **New** — kiosk UI (staff list + sign-in form) |
| `src/components/kiosk/KioskStaffList.tsx` | **New** — searchable/scrollable staff list |
| `src/components/kiosk/KioskActionPanel.tsx` | **New** — employee ID entry + sign-in/out button |
| `src/components/kiosk/KioskConfirmation.tsx` | **New** — post-action confirmation with auto-reset |
| `src/api/api.ts` | Add kiosk API functions (no JWT attachment) |
| `src/pages/Staff.tsx` | Hard-delete guard messaging; employee ID display |
| `src/pages/StaffAttendance.tsx` | Minor fixes per bug list |
| `src/components/settings/SettingsPage.tsx` | Add kiosk mode toggle + kiosk URL display |
| `src/hooks/useStaffAttendanceData.ts` | Fix invalidation after upsert |
| `src/types/dashboard.ts` | Update `LeaveRequest.leaveType` union |
