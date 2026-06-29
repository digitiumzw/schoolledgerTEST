# API Contracts: Student Management

**Base path**: `/api/students`
**Auth**: All endpoints require `Authorization: Bearer <JWT>` (JWTAuthFilter)
**Tenant scope**: `tenant_id` derived from JWT payload — never from request body

---

## GET /api/students

List students with filtering, searching, sorting, and pagination.

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `classId` | string | — | Filter by class ID |
| `status` | string | `active` | `active` \| `inactive` \| `transferred` \| `graduated` \| `dropped_out` \| `all` |
| `search` | string | — | Partial match on first_name, last_name, or **admission_number** |
| `balanceOnly` | boolean | `false` | If true, only return students with outstanding balance > 0 |
| `sortBy` | string | `name` | `name` \| `class` \| `balance` \| `admissionNumber` |
| `sortOrder` | string | `asc` | `asc` \| `desc` |
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `50` | Results per page (max 200) |

### Response 200

```json
{
  "success": true,
  "data": {
    "students": [ /* Student objects (see data-model.md) */ ],
    "pagination": {
      "total": 312,
      "page": 1,
      "limit": 50,
      "pages": 7
    }
  }
}
```

---

## GET /api/students/:id

Fetch a single student by ID.

### Response 200

```json
{
  "success": true,
  "data": { /* Full Student object */ }
}
```

### Response 404

```json
{ "success": false, "message": "Student not found" }
```

---

## GET /api/students/:id/profile

Full student profile: personal info + fee summary + enrollment history + status history.

### Response 200

```json
{
  "success": true,
  "data": {
    "student": { /* Full Student object */ },
    "feesSummary": {
      "totalCharged": 500.00,
      "totalPaid": 350.00,
      "balance": 150.00
    },
    "enrollmentHistory": [ /* Enrollment objects */ ],
    "statusHistory": [ /* StatusHistory objects */ ]
  }
}
```

---

## GET /api/students/:id/status-history

Dedicated endpoint for status change audit trail.

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "previousStatus": null,
      "newStatus": "active",
      "effectiveDate": "2026-01-08",
      "reason": "Initial enrollment",
      "changedByName": "Admin User",
      "createdAt": "2026-01-08T08:00:00Z"
    }
  ]
}
```

---

## POST /api/students

Create (enroll) a new student.

### Request Body

```json
{
  "firstName": "Tafara",
  "lastName": "Moyo",
  "admissionNumber": "2026/001",
  "gender": "male",
  "dateOfBirth": "2012-03-15",
  "nationalId": "63-2145678A21",
  "email": "",
  "address": "12 Main St, Harare",
  "classId": "uuid",
  "enrollmentDate": "2026-01-08",
  "guardian": {
    "name": "Rudo Moyo",
    "phone": "+263771234567",
    "email": "",
    "relationship": "Mother"
  },
  "guardian2": {
    "name": "Chipo Moyo",
    "phone": "+263772345678",
    "relationship": "Father"
  },
  "bursaryStatus": "none",
  "bursaryPercentage": 0,
  "bursaryReason": ""
}
```

**Notes**:
- `admissionNumber` is optional. If omitted or empty, system auto-generates `{YEAR}/{SEQ}`.
- `guardian` is required (name + phone at minimum).
- `guardian2` is optional; omit the key entirely if not applicable.

### Response 201

```json
{
  "success": true,
  "message": "Student enrolled successfully",
  "data": { /* Full Student object with assigned admissionNumber */ }
}
```

### Response 422 — Validation failure

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "admissionNumber": "Admission number 2026/001 is already in use at this school.",
    "guardian.phone": "Phone number format is invalid."
  }
}
```

---

## PUT /api/students/:id

Update an existing student's profile fields. All fields are optional (PATCH semantics via PUT).

### Request Body

Same shape as POST. Only include fields to update.

### Response 200

```json
{
  "success": true,
  "message": "Student updated successfully",
  "data": { /* Updated Student object */ }
}
```

### Response 403 — Non-admin attempt

```json
{ "success": false, "message": "You do not have permission to edit student records." }
```

---

## PUT /api/students/:id/status

Change a student's enrollment status. Creates a `student_status_history` record.

### Request Body

```json
{
  "status": "transferred",
  "effectiveDate": "2026-03-31",
  "reason": "Family relocated to Bulawayo"
}
```

All three fields are required.

### Response 200

```json
{
  "success": true,
  "message": "Student status updated to transferred",
  "data": {
    "student": { /* Updated Student object */ },
    "historyEntry": { /* New StatusHistory object */ }
  }
}
```

---

## PUT /api/students/bulk-status

Bulk status update (e.g., graduate an entire cohort).

### Request Body

```json
{
  "studentIds": ["uuid1", "uuid2", "uuid3"],
  "status": "graduated",
  "effectiveDate": "2026-04-01",
  "reason": "End of academic year graduation"
}
```

### Response 200

```json
{
  "success": true,
  "message": "3 students updated to graduated",
  "data": {
    "updated": 3,
    "failed": []
  }
}
```

---

## DELETE /api/students/:id

Delete a student. Blocked if the student has any charges or payments records.

### Response 200 — No financial records

```json
{ "success": true, "message": "Student deleted successfully" }
```

### Response 422 — Financial records exist

```json
{
  "success": false,
  "message": "Cannot delete a student with financial records. Change the student's status to 'transferred' or 'withdrawn' instead.",
  "code": "FINANCIAL_RECORDS_EXIST"
}
```

---

## GET /api/students/count

Return count of students matching filters. Accepts same query params as `GET /api/students`
except pagination params.

### Response 200

```json
{ "success": true, "data": { "count": 312 } }
```

---

## GET /api/students/search

Quick search returning lightweight student objects for dropdowns and autocomplete.

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | YES | Partial name or exact admission number |
| `classId` | string | NO | Restrict to a specific class |

### Response 200

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "firstName": "Tafara", "lastName": "Moyo", "admissionNumber": "2026/001", "className": "Form 2A" }
  ]
}
```

---

## Unchanged Endpoints (no contract change)

| Endpoint | Notes |
|----------|-------|
| `GET /api/students/:id/balance` | Ledger balance — no change |
| `GET /api/students/:id/fee-statement` | Fee statement — no change |
| `GET /api/students/by-class/:classId` | By class — no change |
| `POST /api/students/promote` | Bulk promote — no change |
| `POST /api/students/:id/promote` | Single promote — no change |
| `POST /api/students/:id/repeat` | Repeat — no change |
| `GET /api/students/migration-preview` | Preview — no change |
