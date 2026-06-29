# Quickstart: Staff Attendance Tracking (067)

**Branch**: `067-staff-attendance-tracking` | **Date**: 2026-05-08

---

## Prerequisites

- Backend running at `http://localhost:8080`
- Frontend running at `http://localhost:5173`
- MySQL running with migrations applied
- Admin account: `admin@greenwood.co.zw` / `12345678` (or your local dev tenant)

---

## 1. Apply the Migration

```bash
cd backend
php spark migrate
```

Verify the new column and ENUM value were applied:

```bash
php spark db:table staff_attendance
# Confirm: overtime_hours column exists, status includes 'early_departure'
```

Or via MySQL directly:

```sql
DESCRIBE staff_attendance;
-- status ENUM should include 'early_departure'
-- overtime_hours DECIMAL(5,2) should be present
```

---

## 2. Acquire an Auth Token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')

echo "TOKEN: $TOKEN"
```

---

## 3. Smoke Test: Check-In with Late Classification

```bash
# Get a valid staff ID first
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/staff | jq '.data[0].id'

STAFF_ID="<id from above>"

# Check in at 09:10 (after 08:30 start time → expect status=late)
curl -s -X POST http://localhost:8080/api/staff-attendance/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"staffId\":\"$STAFF_ID\",\"checkIn\":\"09:10\",\"date\":\"$(date +%Y-%m-%d)\"}" \
  | jq .
# Expected: { "status": true, "data": { "status": "late", ... } }
```

---

## 4. Smoke Test: Check-Out with Early Departure + Overtime

```bash
# Check out at 15:00 (before 17:00 end time → expect status=early_departure)
curl -s -X POST http://localhost:8080/api/staff-attendance/check-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"staffId\":\"$STAFF_ID\",\"checkOut\":\"15:00\",\"date\":\"$(date +%Y-%m-%d)\"}" \
  | jq .
# Expected: { "data": { "status": "early_departure", "workHours": 5.83, "overtimeHours": 0.00 } }

# Check out at 19:00 (after 17:00 → expect overtime)
curl -s -X POST http://localhost:8080/api/staff-attendance/check-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"staffId\":\"$STAFF_ID\",\"checkOut\":\"19:00\",\"date\":\"$(date +%Y-%m-%d)\"}" \
  | jq .
# Expected: { "data": { "status": "present", "workHours": 9.83, "overtimeHours": 1.33 } }
```

---

## 5. Smoke Test: Leave Approval → Attendance Auto-Sync

```bash
# Create a leave request
LR_ID=$(curl -s -X POST http://localhost:8080/api/leave-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"staffId\":\"$STAFF_ID\",\"leaveType\":\"sick\",\"startDate\":\"2026-06-02\",\"endDate\":\"2026-06-04\",\"days\":3,\"reason\":\"Flu\"}" \
  | jq -r '.data.id')

echo "Leave Request ID: $LR_ID"

# Approve it
curl -s -X PUT http://localhost:8080/api/leave-requests/$LR_ID/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","reviewNotes":"Approved"}' \
  | jq .
# Expected: { "data": { "status": "approved", "syncedAttendanceDays": 3 } }

# Verify attendance rows were created
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/staff-attendance?staffId=$STAFF_ID&start_date=2026-06-02&end_date=2026-06-04" \
  | jq '.data.records[] | {date, status, source}'
# Expected: 3 rows with status=on_leave, source=leave_sync
```

---

## 6. Smoke Test: Period Report

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/staff-attendance/report?start_date=2026-05-01&end_date=2026-05-31" \
  | jq '.data | { workingDays: .period.workingDays, staffCount: (.staff | length) }'
# Expected: period with workingDays count and staff array

# Filter by department
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/staff-attendance/report?start_date=2026-05-01&end_date=2026-05-31&department=Science" \
  | jq '.data.staff[] | {name: (.firstName + " " + .lastName), attendanceRate}'
```

---

## 7. Smoke Test: Department Report

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/staff-attendance/departments?start_date=2026-05-01&end_date=2026-05-31" \
  | jq '.data.departments[] | {department, staffCount, attendanceRate}'
```

---

## 8. Error Path Validation

```bash
# Missing start_date → 400
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/staff-attendance/report?end_date=2026-05-31" \
  | jq '{status, message}'
# Expected: { "status": false, "message": "start_date and end_date are required" }

# check-out before check-in → 400
curl -s -X POST http://localhost:8080/api/staff-attendance/check-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"staffId\":\"$STAFF_ID\",\"checkOut\":\"07:00\",\"date\":\"$(date +%Y-%m-%d)\"}" \
  | jq '{status, message}'
# Expected: { "status": false, "message": "Check-out time must be after check-in time" }

# Missing auth → 401
curl -s "http://localhost:8080/api/staff-attendance/report?start_date=2026-05-01&end_date=2026-05-31" \
  | jq '{status, message}'
# Expected: { "status": false, "message": "..." } with HTTP 401
```

---

## 9. Tenant Isolation Validation

```bash
# Log in as a different tenant's admin
TOKEN2=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@othertenant.co.zw","password":"12345678"}' \
  | jq -r '.data.token')

# Period report with tenant2 token should return empty staff array (not tenant1 data)
curl -s -H "Authorization: Bearer $TOKEN2" \
  "http://localhost:8080/api/staff-attendance/report?start_date=2026-05-01&end_date=2026-05-31" \
  | jq '.data.staff | length'
# Expected: 0 (tenant isolation confirmed)
```

---

## 10. Frontend Verification

1. Open `http://localhost:5173` and navigate to **Staff → Attendance**
2. **Attendance Records tab**: Confirm `Overtime` column is visible
3. **Reports tab** (new): Select a date range + department filter → results table renders
4. **Leave tab**: Approve a leave request → toast confirms sync, attendance rows appear in Records tab for those dates

---

## Development Notes

- `StaffAttendanceService` is in `backend/app/Services/StaffAttendanceService.php`
- Work-hours config falls back to `startTime=08:30, endTime=17:00` when tenant settings not set
- Leave sync skips dates that already have a `manual`-source attendance record (no overwrite)
- `source='leave_sync'` rows are voided (deleted) when a previously-approved leave is rejected
- New routes must be declared before `staff-attendance/(:segment)` wildcard in `Routes.php`
