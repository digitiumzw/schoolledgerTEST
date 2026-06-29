# Quickstart: Onboarding Guided Tutorial

**Feature**: 076-onboarding-guided-tutorial  
**Date**: 2026-05-18

## Prerequisites

- Backend and frontend dependencies installed.
- Local backend API available at `http://localhost:8080/api`.
- Test admin credentials for at least one tenant.
- Test invited users for roles such as `teacher` and `bursar`.
- `jq` available for response checks.

## Implementation Checklist

1. Update initial onboarding backend step definitions:
   - Remove `fee-structure` from onboarding step order.
   - Remove `fee-structure` from required completion checks.
   - Add phone number validation/persistence to onboarding profile/contact data.
2. Update initial onboarding frontend wizard:
   - Remove fee structure step from the wizard/sidebar/body.
   - Add phone number field in the appropriate onboarding step.
   - Ensure completion occurs after the final non-billing onboarding step.
3. Add setup guide persistence and API:
   - Tenant-scoped setup guide progress.
   - Ordered steps: Add Staff, Add Classes, optional Add Students, Configure Fee Structure and Billing Settings.
   - Support complete/skip/dismiss behavior.
4. Add tutorial persistence and API:
   - Per-user tutorial progress.
   - Role-aware module definitions filtered by backend permissions.
   - Complete/dismiss/restart behavior.
5. Add frontend guidance UI:
   - Setup guide card/panel after onboarding.
   - In-app tutorial walkthrough for onboarding admin.
   - First-login tutorial for invited users.
6. Validate with lint/type-check and curl after implementation.

## Curl Validation Plan

Set environment variables:

```bash
BASE_URL="http://localhost:8080/api"
ADMIN_EMAIL="admin@greenwood.co.zw"
ADMIN_PASSWORD="12345678"
```

Login:

```bash
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r '.data.token')
```

### 1. Onboarding progress excludes fee structure

```bash
curl -s "$BASE_URL/onboarding/progress" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Expected after implementation for an onboarding user:

- HTTP 200.
- No required/current step should be `fee-structure`.
- Saved step data can include `phone_number` when entered.

### 2. Save phone number during onboarding

```bash
curl -s -X POST "$BASE_URL/onboarding/progress" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "step": "profile",
    "data": {
      "admin_name": "School Admin",
      "phone_number": "+263771234567"
    }
  }' | jq
```

Expected:

- HTTP 200 for a valid phone number.
- Response advances to the next onboarding step.
- Later progress response includes persisted phone number or profile/contact data source reflects it.

### 3. Invalid phone number is rejected

```bash
curl -s -X POST "$BASE_URL/onboarding/progress" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "step": "profile",
    "data": {
      "admin_name": "School Admin",
      "phone_number": "not-a-phone"
    }
  }' | jq
```

Expected:

- HTTP 422.
- Error response identifies `phone_number`.

### 4. Get setup guide state

```bash
curl -s "$BASE_URL/setup-guide" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Expected:

- HTTP 200.
- Steps appear in this order: `add-staff`, `add-classes`, `add-students`, `configure-billing`.
- `add-students` has `optional: true`.

### 5. Complete setup step

```bash
curl -s -X PATCH "$BASE_URL/setup-guide/steps/add-staff" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"completed"}' | jq
```

Expected:

- HTTP 200.
- Add Staff is completed.
- Current step advances according to required order.

### 6. Skip optional student step

```bash
curl -s -X PATCH "$BASE_URL/setup-guide/steps/add-students" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"skipped"}' | jq
```

Expected:

- HTTP 200.
- Add Students is skipped.
- Current step advances to `configure-billing`.

### 7. Reject skipping required setup step

```bash
curl -s -X PATCH "$BASE_URL/setup-guide/steps/add-classes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"skipped"}' | jq
```

Expected:

- HTTP 422.
- Error explains required steps cannot be skipped.

### 8. Get admin tutorial

```bash
curl -s "$BASE_URL/tutorial" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Expected:

- HTTP 200.
- `should_show` is true for first-time tutorial state.
- Modules include admin-accessible modules only.
- Each module has purpose/summary, contents, and primary actions.

### 9. Update tutorial progress

```bash
curl -s -X PATCH "$BASE_URL/tutorial/progress" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "completed",
    "last_seen_step": "dashboard",
    "seen_module_keys": ["dashboard"]
  }' | jq
```

Expected:

- HTTP 200.
- Later `GET /tutorial` does not automatically require display.

### 10. Invited user role-aware tutorial

Login as an invited `teacher` or `bursar` user and repeat:

```bash
USER_TOKEN="<invited-user-token>"

curl -s "$BASE_URL/tutorial" \
  -H "Authorization: Bearer $USER_TOKEN" | jq
```

Expected:

- HTTP 200.
- Tutorial is shown on first login for that user.
- Response excludes modules that the user cannot access.

### 11. Unauthorized guard

```bash
curl -s "$BASE_URL/tutorial" | jq
curl -s "$BASE_URL/setup-guide" | jq
```

Expected:

- HTTP 401 for both requests.

### 12. Tenant isolation

1. Login to tenant A and update setup guide/tutorial progress.
2. Login to tenant B.
3. Call `/setup-guide` and `/tutorial` using tenant B token.

Expected:

- Tenant B cannot see tenant A setup guide state.
- Tenant B user cannot see tenant A user's tutorial progress.

## Validation Commands

Backend lint examples:

```bash
php -l app/Controllers/Api/OnboardingController.php
php -l app/Controllers/Api/SetupGuideController.php
php -l app/Controllers/Api/TutorialController.php
php -l app/Services/SetupGuideService.php
php -l app/Services/TutorialService.php
```

Frontend checks:

```bash
./node_modules/.bin/tsc --noEmit --pretty false
./node_modules/.bin/eslint src/pages/OnboardingPage.tsx src/hooks/useOnboarding.ts src/hooks/useSetupGuide.ts src/hooks/useTutorial.ts src/components/tutorial
```

Repository hygiene:

```bash
git diff --check
```

## Expected User Experience

- New school admins finish initial onboarding without billing prompts.
- New school admins can enter a phone number during onboarding.
- After onboarding, admins see setup guidance in the requested order.
- Add Students can be skipped without blocking setup.
- Admins receive a module walkthrough after onboarding.
- Invited users receive a first-login walkthrough relevant to their role.

## Validation Results

Validated on 2026-05-18 against `http://localhost:8080/api` after applying migration `2026-05-18-000001_CreateOnboardingGuidanceTables.php`.

- Login with `admin@greenwood.co.zw` / `12345678`: HTTP 200.
- `GET /onboarding/progress`: HTTP 200; response did not advertise `fee-structure` as current/required step.
- `POST /onboarding/progress` with `phone_number: "+263771234567"`: HTTP 200.
- `POST /onboarding/progress` with `phone_number: "not-a-phone"`: HTTP 422 with `phone_number` validation error.
- `GET /setup-guide`: HTTP 200; returned ordered setup guide data. Existing tenant data caused all setup steps to be derived as complete, so `current_step` was `null`.
- `PATCH /setup-guide/steps/add-staff` with `status: "completed"`: HTTP 200.
- `PATCH /setup-guide/steps/add-students` with `status: "skipped"`: HTTP 200.
- `PATCH /setup-guide/steps/add-classes` with `status: "skipped"`: HTTP 422.
- `GET /tutorial` as admin: HTTP 200 with `should_show: true` before completion and admin-accessible modules.
- `PATCH /tutorial/progress` with `status: "completed"` and `seen_module_keys: ["dashboard"]`: HTTP 200; follow-up state had `should_show: false`.
- Unauthenticated `GET /tutorial`: HTTP 401.
- Unauthenticated `GET /setup-guide`: HTTP 401.

Not completed in this validation pass:

- Invited `teacher`/`bursar` tutorial curl validation requires available invited-user credentials.
- Tenant-isolation curl validation requires a second tenant token.
