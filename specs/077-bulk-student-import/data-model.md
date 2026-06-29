# Data Model: Bulk Student Import (077)

## Overview

This feature does **not** introduce a new database table. All student records are inserted directly into the existing `students` table using the same schema as the single-student creation flow. There is no persistent import batch or job record for v1.

---

## Existing Table Used: `students`

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(36) | Generated via `generateId('s')` |
| `tenant_id` | VARCHAR(36) | Sourced from JWT — never from request |
| `first_name` | VARCHAR(100) | Required |
| `last_name` | VARCHAR(100) | Required |
| `date_of_birth` | DATE | Required, YYYY-MM-DD |
| `gender` | VARCHAR(10) | Required, `male`/`female` |
| `national_id` | VARCHAR(50) | Optional |
| `email` | VARCHAR(255) | Optional |
| `address` | TEXT | Optional |
| `guardian_name` | VARCHAR(100) | Optional |
| `guardian_phone` | VARCHAR(30) | Optional |
| `guardian_relationship` | VARCHAR(50) | Optional |
| `admission_number` | VARCHAR(50) | Auto-generated if not provided; must be unique per tenant |
| `enrollment_date` | DATE | Defaults to import date |
| `status` | VARCHAR(20) | Defaults to `active` |
| `class_id` | VARCHAR(36) | **Left NULL** — assigned later via Classes page |
| `current_enrollment_id` | VARCHAR(36) | Populated after enrollment record created |
| `bursary_status` | VARCHAR(20) | Defaults to `none` |
| `created_at` | DATETIME | Auto-managed |
| `updated_at` | DATETIME | Auto-managed |

### Notes on `class_id`

Bulk-imported students are created without a class assignment (`class_id = NULL`, `current_enrollment_id = NULL`). Class assignment is performed post-import via the existing multi-select assign flow on the Classes page. This is a deliberate design choice — attempting to resolve class names from CSV would require additional columns and validation complexity.

---

## No New Migration Required

The existing `students` table already supports `NULL` for `class_id` and `current_enrollment_id`. No schema change is needed.

---

## In-Memory Validation Structures (Ephemeral — Not Persisted)

### Import Row (runtime PHP array)

Used during validation and execute phases. Not stored in the database.

```
{
  rowNumber:   int          // 1-based CSV row number (after header)
  firstName:   string
  lastName:    string
  dateOfBirth: string       // raw from CSV
  gender:      string       // raw from CSV
  nationalId:  string|null
  email:       string|null
  address:     string|null
  guardianName: string|null
  guardianPhone: string|null
  guardianRelationship: string|null
  admissionNumber: string|null
}
```

### Row Validation Error (runtime — returned in API response)

```
{
  row:     int     // 1-based row number
  field:   string  // e.g. "date_of_birth", "gender", "first_name"
  message: string  // human-readable, e.g. "Invalid date format — expected YYYY-MM-DD"
}
```

### Validate API Response

```json
{
  "status": "success",
  "data": {
    "valid": false,
    "totalRows": 150,
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

When `valid = true`:

```json
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

### Execute API Response

```json
{
  "status": "success",
  "data": {
    "imported": 150,
    "skipped": 0
  },
  "message": "150 students imported successfully"
}
```

---

## Template CSV Column Order

The downloadable template CSV has these columns in this exact order:

```
first_name,last_name,date_of_birth,gender,national_id,email,address,guardian_name,guardian_phone,guardian_relationship,admission_number
```

Example rows included in the template:

```
John,Doe,2010-03-15,male,,,123 Main Street,Jane Doe,+263771234567,Mother,
Mary,Smith,2011-07-22,female,,,,,,,ADM-2024-001
```
