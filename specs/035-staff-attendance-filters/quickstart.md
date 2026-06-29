# Quick Start: Staff Attendance Filtering and Alerts

**Feature**: 035-staff-attendance-filters  
**Branch**: `035-staff-attendance-filters`

## Prerequisites

- Backend dependencies installed (`composer install` in `backend/`)
- Frontend dependencies installed (`npm install` in `frontend/`)
- Database migrated to latest version
- JWT authentication configured

## Setup Steps

### 1. Database Migration

Run the new migration to add the comment column:

```bash
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark migrate
```

**Migration file**: `app/Database/Migrations/2026-04-16-AddAttendanceComment.php`

### 2. API Routes Registration

Routes are automatically registered via `app/Config/Routes.php`. Ensure these lines exist:

```php
// Attendance API routes
$routes->get('attendance/summary', 'Api\AttendanceController::summary');
$routes->get('attendance/today', 'Api\AttendanceController::today');
$routes->post('attendance/(:num)/status', 'Api\AttendanceController::updateStatus/$1');
```

### 3. Backend Implementation

Key files to create/modify:

```
backend/app/
├── Controllers/Api/AttendanceController.php    # New methods: summary(), today(), updateStatus()
├── Models/AttendanceModel.php                    # Extend: getMonthlySummary(), getTodayAttendance(), updateStatus()
└── Database/Migrations/2026-04-16-AddAttendanceComment.php  # New migration
```

### 4. Frontend Implementation

Key files to create/modify:

```
frontend/src/
├── api/
│   └── attendance.ts              # API client methods: getSummary(), getToday(), updateStatus()
├── components/
│   ├── MonthFilter.tsx            # New: Month selector with YYYY-MM format
│   ├── AttendanceAlert.tsx        # New: Alert banner for unchecked staff
│   └── AttendanceStatusModal.tsx  # New: Modal for absent/excused + comment
├── hooks/
│   ├── useAttendance.ts             # New: React Query hooks
│   └── useAttendanceFilter.ts       # New: Filter state management
└── pages/
    ├── StaffAttendance.tsx          # Modify: Add MonthFilter + filtered data
    └── TodaysAttendance.tsx         # Modify: Add AttendanceAlert integration
```

### 5. Testing the Feature

#### Test Month Filtering

1. Navigate to **Staff Attendance** page
2. Select a month from the dropdown (defaults to current month)
3. Verify attendance summary updates to show only selected month
4. Test edge cases:
   - Month with no records → should show empty state
   - Future month → should show empty state
   - Month with many records → should load within 2 seconds

#### Test Alert System

1. Ensure some staff have NOT checked in today
2. Navigate to **Today's Attendance** page
3. Verify alert banner shows count of unchecked staff
4. Click on alert to open status confirmation modal
5. Test both actions:
   - Mark as **Absent** (no comment required)
   - Mark as **Excused** (add comment)
6. Verify attendance record created with correct status and comment

#### Test Permission Enforcement

1. Login as admin → verify all features accessible
2. Login as teacher → verify read-only access (if configured)
3. Login as non-admin → verify 403 Forbidden on status updates

## Common Issues

### Issue: Month filter returns 400 error
**Cause**: Invalid month format  
**Fix**: Ensure frontend sends YYYY-MM format (e.g., "2026-04")

### Issue: Comments not saving
**Cause**: Migration not applied  
**Fix**: Run `php spark migrate` in backend directory

### Issue: Alerts not showing unchecked staff
**Cause**: Staff marked as inactive  
**Fix**: Only active staff (status='active') trigger alerts

### Issue: Cannot mark staff as absent/excused
**Cause**: Staff already checked in  
**Fix**: API returns 409 conflict; UI should prevent this action

## Verification Checklist

- [ ] Month filter component renders correctly
- [ ] Attendance summary updates on month change
- [ ] Empty state shown for months with no data
- [ ] Alert displays count of unchecked staff
- [ ] Status modal allows absent/excused selection
- [ ] Comment field optional for absent, can be required for excused
- [ ] Status changes persist and reflect in history
- [ ] All API endpoints enforce JWT authentication
- [ ] All queries filter by tenant_id (Constitution Principle I)
- [ ] Migration file is immutable (Constitution Principle IV)

## Rollback

If issues occur:

```bash
# Rollback database
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark migrate:rollback

# Revert code changes via git
git checkout main
git branch -D 035-staff-attendance-filters
```
