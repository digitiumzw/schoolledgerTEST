# Quickstart: Student Identity Layer

## Purpose

Validate that the Students module behaves as the central identity layer: the core student record remains stable, related modules reference the same student ID, and academic/admin changes are preserved as history rather than overwritten.

## Prerequisites

- Backend dependencies installed in `backend/`.
- Frontend dependencies installed in `frontend/`.
- Database configured from backend `.env`.
- JWT secret configured in backend `.env`.
- A tenant with at least one admin/super_admin user.
- Existing class, transport route/stop, and payment category data available for validation.

## Implementation Outline

1. Add an immutable migration for `student_profile_history`.
2. Add `StudentProfileHistoryModel`.
3. Add `StudentIdentityService` for tenant-scoped identity lookup, profile history mutation, and timeline assembly.
4. Update `StudentController` with identity, timeline, and profile-history endpoints.
5. Update `Routes.php` with new student sub-resource routes before wildcard student routes.
6. Update frontend API types and methods.
7. Update Student Profile UI to distinguish stable identity, current snapshots, and historical timeline/profile changes.
8. Validate through curl only after implementation is complete.

## Suggested Backend Validation Commands

From `backend/`:

```bash
php spark migrate
php -l app/Controllers/Api/StudentController.php
php -l app/Models/StudentModel.php
php -l app/Models/StudentProfileHistoryModel.php
php -l app/Services/StudentIdentityService.php
```

## Suggested Frontend Validation Commands

From `frontend/`:

```bash
./node_modules/.bin/tsc --noEmit --pretty false
./node_modules/.bin/eslint src/pages/StudentProfile.tsx src/api/api.ts src/types/dashboard.ts
```

## Post-Implementation Curl Validation

Set variables:

```bash
API_BASE="http://localhost:8080/api"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="password"
STUDENT_ID="s_example"
OTHER_TENANT_TOKEN="replace-with-other-tenant-token"
```

Login:

```bash
TOKEN=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r '.data.token')
```

### 1. Retrieve stable identity

```bash
curl -i "$API_BASE/students/$STUDENT_ID/identity" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- HTTP 200.
- Response uses success envelope.
- `data.student.id` equals `STUDENT_ID`.
- Summary includes related record counts.

### 2. Record profile/contact history

```bash
curl -i -X POST "$API_BASE/students/$STUDENT_ID/profile-history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "address",
    "newValue": "New validated address",
    "changeType": "historical_change",
    "effectiveDate": "2026-05-06",
    "reason": "Family moved residence"
  }'
```

Expected:
- HTTP 201.
- Response includes `historyRecord.previousValue` and `historyRecord.newValue`.
- Current student address is updated.

### 3. Retrieve profile history

```bash
curl -i "$API_BASE/students/$STUDENT_ID/profile-history?fieldName=address" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- HTTP 200.
- History includes the address change from step 2.

### 4. Retrieve consolidated timeline

```bash
curl -i "$API_BASE/students/$STUDENT_ID/timeline?from=2026-01-01&to=2026-12-31&types=profile_change,enrollment,transport_assignment,charge,payment" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- HTTP 200.
- Timeline contains profile-history event from step 2.
- Existing enrollment, transport, charge, and payment events appear when source records exist in the selected period.

### 5. Validate invalid field rejection

```bash
curl -i -X POST "$API_BASE/students/$STUDENT_ID/profile-history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "class_id",
    "newValue": "class_other",
    "changeType": "historical_change",
    "effectiveDate": "2026-05-06",
    "reason": "Attempt direct class overwrite"
  }'
```

Expected:
- HTTP 400 or 422.
- Error explains that academic placement must be handled through enrollment workflows.

### 6. Validate date filter errors

```bash
curl -i "$API_BASE/students/$STUDENT_ID/timeline?from=not-a-date" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- HTTP 400.
- Error response uses standard error envelope.

### 7. Validate tenant isolation

```bash
curl -i "$API_BASE/students/$STUDENT_ID/identity" \
  -H "Authorization: Bearer $OTHER_TENANT_TOKEN"
```

Expected:
- HTTP 404 or 403.
- No student data from the original tenant is exposed.

### 8. Validate existing source-of-truth workflows still work

Run existing workflows after implementation:

- Promote or transfer a student through student/class workflow.
- Assign and deactivate transport through transport workflow.
- Generate or record charges/payments through billing/payment workflow.

Then confirm:

```bash
curl -i "$API_BASE/students/$STUDENT_ID/timeline" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- Timeline reflects the source records.
- Previous enrollment/transport/financial records remain available.
- Ledger balances still match existing `/students/{id}/balance` and `/students/{id}/fee-statement` behavior.

## Manual UI Verification

1. Open the student profile page.
2. Confirm stable identity details are visually separate from current academic/transport/financial summaries.
3. Confirm history/timeline sections show profile changes, enrollment history, transport history, and financial events.
4. Confirm editing mutable profile/contact fields asks for effective date, reason, and change type.
5. Confirm class placement changes are not presented as direct core-profile edits.

## Rollback Considerations

- The new profile-history table is additive.
- Existing student, enrollment, transport, charge, and payment data should remain unchanged except for current-value updates made through profile-history workflows.
- If rollback is required, remove or disable new endpoints/UI while preserving created history records unless a deliberate data cleanup is approved.

## Validation Results: 2026-05-06

Tested against `http://localhost:8080/api` using `admin@greenwood.co.zw` / `12345678`.

- Login: HTTP 200, token acquired.
- Test student: `s1777990152_30442e02`.
- `GET /students/{id}/identity`: HTTP 200, returned stable student identity and summary counts.
- `POST /students/{id}/profile-history`: HTTP 201, created address profile-history record `sph_1778065918_00aefaaa`.
- `GET /students/{id}/profile-history?fieldName=address`: HTTP 200, returned the created address history row.
- `GET /students/{id}/timeline?from=2026-01-01&to=2026-12-31&types=profile_change,enrollment,transport_assignment,charge,payment&limit=100`: HTTP 200, returned 8 events including the created profile-change event.
- Invalid profile-history field `class_id`: HTTP 422 with message `This field cannot be changed through profile history`.
- Invalid timeline date `from=not-a-date`: HTTP 400 with message `from must be a valid YYYY-MM-DD date`.
- Missing authentication on identity endpoint: HTTP 401 with message `No authentication token provided.`
- Missing student identity lookup: HTTP 404 with message `Student not found`.
- Direct class overwrite through `PUT /students/{id}`: HTTP 409 with message `Class placement changes must use enrollment, promotion, transfer, or class assignment workflows`.
- Ledger consistency: `/students/{id}/balance` and `/students/{id}/fee-statement` both returned HTTP 200 and matched for `balance=167.00`, `totalCharged=172.00`, `totalPaid=5.00`, `feeBalance=167.00`, `transportBalance=0.00`.
- Second-tenant admin login using `curliso_1778043246@example.test` / `12345678`: HTTP 200, token acquired.
- Same-tenant bursar login using `alice.cooper@email.com` / `12345678`: HTTP 200, token acquired.
- Cross-tenant `GET /students/{id}/identity`: HTTP 404 with message `Student not found`.
- Cross-tenant `GET /students/{id}/timeline`: HTTP 404 with message `Student not found`.
- Cross-tenant `GET /students/{id}/profile-history`: HTTP 404 with message `Student not found`.
- Cross-tenant `POST /students/{id}/profile-history`: HTTP 404 with message `Student not found`.
- Unauthorized same-tenant bursar `POST /students/{id}/profile-history`: HTTP 403 with message `You do not have permission to perform this action`.
