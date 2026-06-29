# API Contract: Bulk Student Import (077)

All endpoints are under `/api` and require `Authorization: Bearer <token>` (JWTAuthFilter).  
All responses use the standard SchoolLedger envelope: `{ "status", "data", "message" }`.  
Roles allowed: `admin`, `super_admin`. `bursar` and `teacher` receive HTTP 403.

---

## 1. Download CSV Template

### `GET /api/students/import/template`

Returns a pre-built CSV file for the user to fill in offline.

**Auth**: Required (admin / super_admin)  
**Response**: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="student_import_template.csv"`

**Response body** (raw CSV):
```
first_name,last_name,date_of_birth,gender,national_id,email,address,guardian_name,guardian_phone,guardian_relationship,admission_number
John,Doe,2010-03-15,male,,,123 Main Street,Jane Doe,+263771234567,Mother,
Mary,Smith,2011-07-22,female,,,,,,,ADM-2024-001
```

**Error responses**:

| Status | Condition |
|---|---|
| 401 | No / invalid token |
| 403 | Role is `teacher` or `bursar` |

---

## 2. Validate CSV Upload

### `POST /api/students/import/validate`

Receives a CSV file, parses and validates every row, returns a full error report. **No database writes occur.**

**Auth**: Required (admin / super_admin)  
**Content-Type**: `multipart/form-data`

**Request**:

| Field | Type | Description |
|---|---|---|
| `file` | File (CSV) | The completed CSV file, max 10 MB |

**Success Response (all rows valid)**:

```json
HTTP 200
{
  "status": "success",
  "data": {
    "valid": true,
    "totalRows": 150,
    "errorCount": 0,
    "errors": []
  },
  "message": "All 150 rows are valid and ready to import"
}
```

**Success Response (rows have errors)**:

```json
HTTP 200
{
  "status": "success",
  "data": {
    "valid": false,
    "totalRows": 50,
    "errorCount": 3,
    "errors": [
      { "row": 4,  "field": "date_of_birth", "message": "Invalid date format — expected YYYY-MM-DD" },
      { "row": 12, "field": "gender",        "message": "Invalid value — must be 'male' or 'female'" },
      { "row": 45, "field": "first_name",    "message": "First name is required" }
    ]
  },
  "message": "Validation failed — 3 row(s) have errors"
}
```

**Error Responses**:

| Status | Condition |
|---|---|
| 400 | No file uploaded, file is empty (header only), missing required `file` field |
| 400 | File is not a CSV (wrong MIME type or extension) |
| 413 | File exceeds 10 MB limit |
| 401 | No / invalid token |
| 403 | Role is `teacher` or `bursar` |
| 500 | Server error during parsing |

**Validation rules applied per row**:

| Field | Rule |
|---|---|
| `first_name` | Required, non-empty, max 100 chars |
| `last_name` | Required, non-empty, max 100 chars |
| `date_of_birth` | Required, YYYY-MM-DD format, not a future date |
| `gender` | Required, value is `male` or `female` (case-insensitive) |
| `email` | Optional — if present, must be valid email format |
| `admission_number` | Optional — if present, must not already exist in `students` for this tenant |
| Intra-file duplicates | Same `(first_name, last_name, date_of_birth)` appears more than once in the file |
| Existing student duplicates | Same `(first_name, last_name, date_of_birth)` already exists for this tenant |

---

## 3. Execute Import

### `POST /api/students/import/execute`

Receives a CSV file, re-validates all rows, then inserts all student records in batches. Returns the count of created students.

**Auth**: Required (admin / super_admin)  
**Content-Type**: `multipart/form-data`

**Request**:

| Field | Type | Description |
|---|---|---|
| `file` | File (CSV) | The same completed CSV file, max 10 MB |

**Success Response**:

```json
HTTP 201
{
  "status": "success",
  "data": {
    "imported": 150,
    "skipped": 0
  },
  "message": "150 students imported successfully"
}
```

**Error Responses**:

| Status | Condition |
|---|---|
| 400 | No file uploaded, file is empty, missing `file` field |
| 400 | File is not a CSV |
| 413 | File exceeds 10 MB |
| 422 | One or more rows still fail validation (same error structure as validate endpoint) |
| 403 | Student limit for current subscription plan would be exceeded |
| 401 | No / invalid token |
| 403 | Role is `teacher` or `bursar` |
| 500 | Database insertion failed (transaction rolled back) |

**Notes**:
- The execute endpoint re-runs full validation internally. If any rows are invalid it returns HTTP 422 with the same error structure as the validate endpoint.
- Subscription plan limit check runs before row-level validation. If importing N rows would exceed `max_students`, returns HTTP 403 with a plan-limit message.
- All students are inserted in a single database transaction (in batches of 250). If any batch fails, the entire import is rolled back.
- Students are created with `class_id = NULL` and `status = active`.
- `admission_number` is auto-generated for any row that does not provide one.
- An enrollment record and status history record are created for each student, matching the single-create flow.

---

## Route Registration (Routes.php)

```php
// Specific sub-paths registered BEFORE (:segment) wildcard
$routes->get('students/import/template', 'StudentImportController::template');
$routes->post('students/import/validate', 'StudentImportController::validate');
$routes->post('students/import/execute',  'StudentImportController::execute');
```

These three routes MUST be registered before the existing `$routes->get('students/(:segment)', ...)` and `$routes->post('students', ...)` wildcard lines.
