# Quickstart: Kiosk Employee ID & Redesign

**Branch**: `010-kiosk-employee-id` | **Date**: 2026-04-06

## Prerequisites

- Branch `010-kiosk-employee-id` checked out
- MySQL running, `schoolledger` database accessible
- Backend: `composer install` done
- Frontend: `npm install` done

## 1. Run the Migration

```bash
cd backend
php spark migrate
```

This migration (`2026-04-06-200000`):
- Normalizes existing `employee_id` values to `EMP####` format
- Backfills NULL employee IDs for any staff without one
- Adds `early_departure` to the `staff_attendance.status` ENUM

## 2. Start the Servers

```bash
# Terminal 1 — backend
cd backend && php spark serve

# Terminal 2 — frontend
cd frontend && npm run dev
```

## 3. Verify Employee ID Auto-Generation

1. Log in at `http://localhost:8080` with `admin@greenwood.co.zw` / `1234`
2. Navigate to **Staff** → **Add Staff Member**
3. Fill in the required fields and save
4. Open the new staff member's profile — the **Employee ID** badge (e.g., `EMP0043`) should appear in the header card

## 4. Test the Redesigned Kiosk

1. Go to **Settings** → **General** → enable **Kiosk Mode**
2. Copy the kiosk URL (now in format `http://localhost:8080/kiosk/abc123xyz`)
3. Open the URL in a new browser tab or incognito window
4. You should see the **idle screen** with: school name, live clock, configured shift hours, and the Employee ID input field
5. Enter a valid Employee ID (check the staff profile for it) and press Enter
6. Confirm the check-in/check-out confirmation screen appears with the staff member's name and status
7. The screen should return to idle automatically after 10 seconds

## 5. Verify Shift Hours Display

1. In **Settings** → **General**, set Work Start Time to `07:30` and Work End Time to `16:00`
2. Reload the kiosk page
3. The idle screen should show "Shift: 07:30 – 16:00"

## 6. Verify Employee ID on Staff Profile

1. Navigate to any staff member's profile
2. The **Employee ID** should appear as a monospace badge in the profile header, above the tabs
3. A copy icon next to the badge should copy the ID to clipboard on click

## Key File Locations

| What | Where |
|------|-------|
| Migration (backfill + early_departure enum) | `backend/app/Database/Migrations/2026-04-06-200000_Kiosk_employee_id_improvements.php` |
| StaffModel (auto-generation callback) | `backend/app/Models/StaffModel.php` |
| KioskController (kiosk_code resolution, auto-action) | `backend/app/Controllers/Api/KioskController.php` |
| SettingsController (kiosk_code generation) | `backend/app/Controllers/Api/SettingsController.php` |
| KioskPage (redesigned, ID-first flow) | `frontend/src/pages/KioskPage.tsx` |
| KioskIdleScreen (new component) | `frontend/src/components/kiosk/KioskIdleScreen.tsx` |
| KioskIdEntry (new component) | `frontend/src/components/kiosk/KioskIdEntry.tsx` |
| KioskConfirmation (updated) | `frontend/src/components/kiosk/KioskConfirmation.tsx` |
| StaffProfilePage (employee ID badge) | `frontend/src/pages/StaffProfilePage.tsx` |
| React Router (kiosk route change) | `frontend/src/App.tsx` |
| API functions | `frontend/src/api/api.ts` |
