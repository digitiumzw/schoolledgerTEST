# Quickstart & Validation Guide: Bulk Student Import (077)

## Dev Setup

1. Ensure backend is running on `http://localhost:8080`
2. Frontend dev server on `http://localhost:5173`
3. No new migrations to run for this feature (no schema changes)

---

## curl Validation Commands

### 0. Login and capture token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')
echo "TOKEN=$TOKEN"
```

---

### 1. Download CSV Template

```bash
curl -s -o /tmp/student_import_template.csv \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/students/import/template

# Expected: HTTP 200, file saved. Verify headers:
head -2 /tmp/student_import_template.csv
# Expected header line:
# first_name,last_name,date_of_birth,gender,national_id,email,address,guardian_name,guardian_phone,guardian_relationship,admission_number
```

---

### 2. Validate — valid CSV

```bash
cat > /tmp/test_import_valid.csv << 'EOF'
first_name,last_name,date_of_birth,gender,national_id,email,address,guardian_name,guardian_phone,guardian_relationship,admission_number
Alice,Test,2012-05-10,female,,,456 Oak Ave,Bob Test,+263772222222,Father,
Charlie,Sample,2011-08-20,male,,charlie@example.com,789 Pine Rd,,,,ADM-TEST-001
EOF

curl -s -X POST http://localhost:8080/api/students/import/validate \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_import_valid.csv" | jq .
# Expected: HTTP 200, valid=true, errorCount=0, totalRows=2
```

---

### 3. Validate — CSV with errors

```bash
cat > /tmp/test_import_errors.csv << 'EOF'
first_name,last_name,date_of_birth,gender
,Doe,2012-05-10,male
John,Smith,32-13-2012,male
Jane,Brown,2013-01-15,unknown
EOF

curl -s -X POST http://localhost:8080/api/students/import/validate \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_import_errors.csv" | jq .
# Expected: HTTP 200, valid=false, errorCount=3
# Row 1: first_name required
# Row 2: invalid date format
# Row 3: invalid gender
```

---

### 4. Validate — empty CSV (header only)

```bash
cat > /tmp/test_import_empty.csv << 'EOF'
first_name,last_name,date_of_birth,gender
EOF

curl -s -X POST http://localhost:8080/api/students/import/validate \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_import_empty.csv" | jq .
# Expected: HTTP 400, "No student records found in the file"
```

---

### 5. Validate — non-CSV file

```bash
echo "not a csv" > /tmp/test.txt

curl -s -X POST http://localhost:8080/api/students/import/validate \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.txt;type=text/plain" | jq .
# Expected: HTTP 400, "Invalid file type — please upload a CSV file"
```

---

### 6. Execute Import — happy path

```bash
cat > /tmp/test_execute.csv << 'EOF'
first_name,last_name,date_of_birth,gender,national_id,email,address,guardian_name,guardian_phone,guardian_relationship,admission_number
ImportTest,Alpha,2013-04-01,female,,,,,,, 
ImportTest,Beta,2014-06-15,male,,,,,,, 
EOF

curl -s -X POST http://localhost:8080/api/students/import/execute \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_execute.csv" | jq .
# Expected: HTTP 201, imported=2, skipped=0
```

---

### 7. Execute — re-validation blocks invalid file

```bash
curl -s -X POST http://localhost:8080/api/students/import/execute \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_import_errors.csv" | jq .
# Expected: HTTP 422, errors array with row-level detail
```

---

### 8. Unauthenticated access

```bash
curl -s -X POST http://localhost:8080/api/students/import/validate \
  -F "file=@/tmp/test_import_valid.csv" | jq .
# Expected: HTTP 401
```

---

### 9. Bursar role blocked

```bash
BURSAR_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice.cooper@email.com","password":"12345678"}' \
  | jq -r '.data.token')

curl -s -X POST http://localhost:8080/api/students/import/validate \
  -H "Authorization: Bearer $BURSAR_TOKEN" \
  -F "file=@/tmp/test_import_valid.csv" | jq .
# Expected: HTTP 403
```

---

### 10. Tenant isolation — second tenant cannot import into Greenwood

```bash
# Log in as a second-tenant admin and attempt to import
# The tenant_id is sourced from JWT — students will only ever be created under the authenticated tenant
# This test verifies the imported students belong to the correct tenant:

curl -s "http://localhost:8080/api/students?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.students[0].tenantId'
# Expected: matches Greenwood tenant ID, not any other tenant
```

---

## Validation Results

> Fill this section after implementation and curl validation.

| Test | Expected | Actual | Status |
|---|---|---|---|
| Template download | HTTP 200, CSV with correct headers | — | Pending |
| Validate valid CSV | HTTP 200, valid=true | — | Pending |
| Validate with errors | HTTP 200, valid=false, 3 errors | — | Pending |
| Validate empty CSV | HTTP 400 | — | Pending |
| Validate non-CSV | HTTP 400 | — | Pending |
| Execute happy path | HTTP 201, imported=2 | — | Pending |
| Execute invalid file | HTTP 422 with errors | — | Pending |
| Unauthenticated | HTTP 401 | — | Pending |
| Bursar blocked | HTTP 403 | — | Pending |
| Tenant isolation | Students belong to correct tenant | — | Pending |


## Implementation notes

- Static validation passed: PHP lint for `StudentImportController.php`, `StudentImportService.php`, and `Routes.php`.
- Static validation passed: frontend TypeScript `tsc --noEmit --pretty false`.
- `git diff --check` passed.
- Targeted ESLint could not run because `frontend/node_modules/.bin/eslint` is absent in this checkout.
- Live curl validation passed against `http://localhost:8080/api` using `admin@greenwood.co.zw` / `12345678`; happy-path execute created 2 curl test student records.


## Curl validation results - 2026-05-19

| Test | Expected | Actual | Status |
|---|---:|---:|---|
| Admin login | 200 | 200 | PASS |
| Download template | 200 | 200 | PASS |
| Validate valid CSV | 200 | 200 | PASS |
| Validate invalid CSV row errors | 200 | 200 | PASS |
| Validate header-only CSV | 400 | 400 | PASS |
| Reject non-CSV file | 400 | 400 | PASS |
| Reject missing file | 400 | 400 | PASS |
| Execute valid CSV import | 201 | 201 | PASS |
| Validate duplicate CSV after import | 200 | 200 | PASS |
| Execute invalid CSV rejected | 422 | 422 | PASS |
| Template without auth rejected | 401 | 401 | PASS |

Note: Execute valid CSV import created 2 test students with `Curl{timestamp}` names and `CURL-{timestamp}-A/B` admission numbers.
