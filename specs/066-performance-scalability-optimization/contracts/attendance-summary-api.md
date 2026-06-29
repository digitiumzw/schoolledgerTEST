# API Contract: Student Attendance Class Summary

**Route**: `GET /api/student-attendance/class-summary`  
**Controller**: `AttendanceController::classSummary()` (new method)  
**Auth**: JWT required (`admin`, `teacher`, `bursar`)

---

## Query Parameters

| Parameter | Type | Required | Validation | Description |
|---|---|---|---|---|
| `classId` | string | Yes | valid class ID | Class to summarise |
| `startDate` | string | Yes | YYYY-MM-DD | Range start (inclusive) |
| `endDate` | string | Yes | YYYY-MM-DD | Range end (inclusive) |
| `search` | string | No | max 100 chars | Filter by student name |
| `sortBy` | string | No | `name` \| `presentDays` \| `attendancePercentage` | Sort field (default: `name`) |
| `sortOrder` | string | No | `asc` \| `desc` | Sort direction (default: `asc`) |

---

## Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "summary": [
      {
        "studentId": "s_abc",
        "studentName": "Alice Moyo",
        "presentDays": 18,
        "absentDays": 2,
        "lateDays": 1,
        "excusedDays": 0
      }
    ],
    "meta": {
      "classId": "cls_001",
      "startDate": "2026-04-01",
      "endDate": "2026-04-30",
      "total": 40
    }
  }
}
```

## Response — 400 Bad Request

```json
{
  "status": "error",
  "message": "classId, startDate, and endDate are required.",
  "errors": {}
}
```

---

## Notes

- `total` in `meta` is the count of students matching the `search` filter (or all students in class if no search).
- `presentDays`, `absentDays`, `lateDays`, `excusedDays` count only records within the `startDate`–`endDate` range.
- Weekend/holiday exclusion from `totalDays` remains computed on the frontend using the existing `countWeekdays()` helper (unchanged behaviour).
- The route is scoped by `tenant_id` from JWT; the `classId` must belong to the authenticated tenant.
