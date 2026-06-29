# Quickstart: Teacher Student Attendance Kiosk

**Feature**: `012-teacher-student-kiosk`  
**Date**: 2026-04-07

This guide covers how to test the student attendance kiosk end-to-end and describes the remaining implementation tasks.

---

## What already works (spec 011 implementation)

The core kiosk flow is **fully implemented**. You can test it right now:

1. **Enable kiosk mode** — Go to Settings → Kiosk Mode → toggle ON → Save.
2. **Open the student kiosk** — Navigate to `/kiosk/{your-kiosk-code}/students` in a browser.
3. **Enter a teacher Employee ID** — Use any active, `is_teaching = 1` staff member's Employee ID (e.g. `EMP0001`).
4. **Select a class** — Your assigned classes are listed. Classes that already have attendance today show a badge.
5. **Mark attendance** — Tap each student's status: Present / Absent / Late / Excused.
6. **Submit** — Enter your Employee ID again to confirm. All records are saved with your Employee ID in `recorded_by`.
7. **Confirmation** — Screen shows a summary then auto-resets after 10 seconds.

---

## URL pattern

```
Staff kiosk:   /kiosk/{code}
Student kiosk: /kiosk/{code}/students
```

Both share the same `kiosk_code` from Settings. You can find the code at Settings → Kiosk Mode → Kiosk URL.

---

## Remaining implementation tasks

The following gaps must be closed before this feature is fully deliverable per spec 012:

### Task 1 — Separate `studentKioskModeEnabled` flag (backend)

**File**: `backend/app/Controllers/Api/StudentKioskController.php`

`status()` currently reads `$settings['kioskModeEnabled']` — the **staff** flag. It must read `$settings['studentKioskModeEnabled']` instead.

```php
// Change this:
$kioskEnabled = (bool) ($settings['kioskModeEnabled'] ?? false);

// To this:
$kioskEnabled = (bool) ($settings['studentKioskModeEnabled'] ?? false);
```

Same fix needed in `validateTeacher()`, `classStudents()`, and `submit()` — all four methods currently read `kioskModeEnabled`.

### Task 2 — Settings UI: Student kiosk toggle (frontend)

**File**: `frontend/src/components/settings/GeneralSettingsTab.tsx`

Add a second toggle card beneath the existing staff kiosk card:

- Toggle label: "Enable Student Attendance Kiosk"
- Binds to `settings.studentKioskModeEnabled`
- When ON, shows the student kiosk URL: `{origin}/kiosk/{settings.kioskCode}/students`
- Copy button mirrors the staff kiosk URL copy button

### Task 3 — Settings type update (frontend)

**File**: `frontend/src/types/dashboard.ts`

Add to the `Settings` interface:

```typescript
studentKioskModeEnabled?: boolean;
```

### Task 4 — Admin attendance: `recordedBy` filter (backend)

**File**: `backend/app/Controllers/Api/AttendanceController.php` — `studentIndex()`

Add support for `?recordedBy=` query param:

```php
$recordedBy = $this->request->getGet('recordedBy');
if ($recordedBy) $builder->where('recorded_by', $recordedBy);
```

### Task 5 — Admin attendance UI: `recordedBy` column and filter (frontend)

**File**: `frontend/src/pages/Attendance.tsx`

- Add "Recorded By" column to the student attendance table (displays the `recordedBy` field)
- Add a filter input (or dropdown) so admin can filter by teacher Employee ID
- Wire through `api.getStudentAttendance({ recordedBy: ... })`

---

## Dev environment setup

```bash
# Backend (PHP/CodeIgniter 4)
cd backend
php spark serve --port=8080

# Frontend (React/Vite)
cd frontend
bun run dev
```

Seed data: run `php spark db:seed CompleteDatabaseSeeder` for a tenant with sample classes, students, and staff with Employee IDs.

---

## Key files

| Layer | File | Purpose |
|-------|------|---------|
| Backend controller | `backend/app/Controllers/Api/StudentKioskController.php` | All 4 kiosk endpoints |
| Backend routes | `backend/app/Config/Routes.php` lines 37-40 | Route registration |
| Backend settings | `backend/app/Controllers/Api/SettingsController.php` | Read/write `studentKioskModeEnabled` |
| Backend attendance | `backend/app/Controllers/Api/AttendanceController.php` | `studentIndex()` — needs `recordedBy` filter |
| Frontend page | `frontend/src/pages/StudentKioskPage.tsx` | Full kiosk state machine |
| Frontend components | `frontend/src/components/kiosk/StudentKiosk*.tsx` | ID entry, class list, attendance, confirmation |
| Frontend API client | `frontend/src/api/api.ts` — `studentKioskApi` | Typed kiosk API calls |
| Frontend settings | `frontend/src/components/settings/GeneralSettingsTab.tsx` | Kiosk toggles and URL display |
| Frontend types | `frontend/src/types/dashboard.ts` | `Settings.studentKioskModeEnabled` |
| DB schema | `backend/app/Database/Migrations/2025-12-28-102246_CreateDBSchemas.php` | `student_attendance` table definition |
