# Quickstart: Student Attendance – Class-Linked Event Tracking

**Branch**: `068-student-attendance-classes`  
**Date**: 2026-05-08

---

## Prerequisites

- PHP 8.1+ with the CodeIgniter 4 backend running on `http://localhost:8080`
- MySQL database migrated up to the latest migration
- A tenant with at least one class instance and enrolled students
- Default admin credentials: `admin@greenwood.co.zw` / `12345678`

---

## 1. Apply Migration

```bash
cd backend
php spark migrate
```

Expected output: `Running: 2026-05-08-000002_CreateStudentAttendanceEvents`

Verify table:
```bash
mysql -u root -p schoolledger -e "DESCRIBE student_attendance_events;"
```

---

## 2. Get Auth Token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')
echo $TOKEN
```

---

## 3. Get a Class Instance ID

```bash
curl -s http://localhost:8080/api/class-instances \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0].id'
```

Store as `CLASS_INSTANCE_ID`.

---

## 4. Get Enrolled Students for the Class Instance

```bash
curl -s "http://localhost:8080/api/class-instances/$CLASS_INSTANCE_ID/students" \
  -H "Authorization: Bearer $TOKEN" | jq '[.data[] | .id]'
```

Store two student IDs as `STUDENT_A` and `STUDENT_B`.

---

## 5. Submit Attendance Batch (Happy Path)

```bash
curl -s -X POST http://localhost:8080/api/class-attendance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"classInstanceId\": \"$CLASS_INSTANCE_ID\",
    \"date\": \"$(date +%Y-%m-%d)\",
    \"periodKey\": null,
    \"records\": [
      { \"studentId\": \"$STUDENT_A\", \"status\": \"present\", \"remarks\": \"\" },
      { \"studentId\": \"$STUDENT_B\", \"status\": \"absent\",  \"remarks\": \"Parent notified\" }
    ]
  }" | jq .
```

**Expected**: HTTP 201, `data.saved = 2`, `data.skipped = 0`

---

## 6. Retrieve Effective Attendance for Today

```bash
curl -s "http://localhost:8080/api/class-attendance?classInstanceId=$CLASS_INSTANCE_ID&date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: HTTP 200, `data.records` contains 2 rows, `data.presentCount = 1`, `data.absentCount = 1`

---

## 7. Submit a Correction

Correct STUDENT_B from absent to late:

```bash
curl -s -X POST http://localhost:8080/api/class-attendance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"classInstanceId\": \"$CLASS_INSTANCE_ID\",
    \"date\": \"$(date +%Y-%m-%d)\",
    \"periodKey\": null,
    \"records\": [
      { \"studentId\": \"$STUDENT_B\", \"status\": \"late\", \"remarks\": \"Arrived at 08:30\" }
    ]
  }" | jq .
```

**Expected**: HTTP 201, `data.saved = 1`

Verify effective status:
```bash
curl -s "http://localhost:8080/api/class-attendance?classInstanceId=$CLASS_INSTANCE_ID&date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.records[] | select(.studentId == env.STUDENT_B) | .status'
```

**Expected**: `"late"`

---

## 8. View Audit Log (Both Events Present)

```bash
curl -s "http://localhost:8080/api/class-attendance/audit?studentId=$STUDENT_B&classInstanceId=$CLASS_INSTANCE_ID&date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: `data.events` has 2 items — first `isEffective: false, status: "absent"`, second `isEffective: true, status: "late"`

---

## 9. Per-Student Summary

```bash
curl -s "http://localhost:8080/api/class-attendance/summary/student/$STUDENT_A?sessionId=2025%2F2026" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: HTTP 200, `data.attendanceRate` is a float, `data.present >= 1`

---

## 10. Class Summary

```bash
curl -s "http://localhost:8080/api/class-attendance/summary/class/$CLASS_INSTANCE_ID?startDate=2026-01-01&endDate=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected**: HTTP 200, `data.students` array with per-student breakdowns

---

## 11. Error Validation Tests

```bash
# Future date → 400
curl -s -X POST http://localhost:8080/api/class-attendance \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"classInstanceId\":\"$CLASS_INSTANCE_ID\",\"date\":\"2099-01-01\",\"records\":[{\"studentId\":\"$STUDENT_A\",\"status\":\"present\"}]}" \
  | jq '.status, .message'

# Missing auth → 401
curl -s http://localhost:8080/api/class-attendance?classInstanceId=$CLASS_INSTANCE_ID\&date=$(date +%Y-%m-%d) \
  | jq '.status'

# Wrong tenant → 404
TENANT2_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"other-tenant@example.com","password":"12345678"}' \
  | jq -r '.data.token')
curl -s "http://localhost:8080/api/class-attendance?classInstanceId=$CLASS_INSTANCE_ID&date=$(date +%Y-%m-%d)" \
  -H "Authorization: Bearer $TENANT2_TOKEN" | jq '.status'
```

**Expected**: `400`, `401`, `404` respectively

---

## 12. Per-Period Mode (Optional)

Enable per-period mode via settings:
```bash
curl -s -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"studentAttendanceMode": "per_period"}' | jq .
```

Submit two periods:
```bash
for PERIOD in P1 P2; do
  curl -s -X POST http://localhost:8080/api/class-attendance \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"classInstanceId\":\"$CLASS_INSTANCE_ID\",\"date\":\"$(date +%Y-%m-%d)\",\"periodKey\":\"$PERIOD\",\"records\":[{\"studentId\":\"$STUDENT_A\",\"status\":\"present\"}]}" \
    | jq .saved
done
```

**Expected**: Two separate events exist — both `is_effective = 1` (different period keys)

---

## Validation Checklist

- [ ] Migration applies cleanly: `student_attendance_events` table exists with all columns
- [ ] Batch submit creates immutable events (HTTP 201)
- [ ] Correction creates new effective event; prior event has `is_effective = 0`
- [ ] Audit log returns all events including superseded
- [ ] Per-student summary returns correct counts and percentage
- [ ] Class summary returns all enrolled students
- [ ] Future date rejected (400)
- [ ] Missing auth rejected (401)
- [ ] Cross-tenant class instance returns 404
- [ ] Per-period mode stores and retrieves correctly
- [ ] Non-enrolled student in batch results in `skipped` entry, not error
