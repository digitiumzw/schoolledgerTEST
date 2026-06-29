# Quickstart: School Creation & Admin Onboarding

**Feature**: `043-school-creation-onboarding`  
**Branch**: `043-school-creation-onboarding`

---

## What This Feature Adds

1. **Platform super-admin** creates a school with just a name and admin email → welcome email auto-sent
2. **Admin** logs in with temporary credentials → redirected to onboarding wizard
3. **Admin** completes 5-step wizard (password, profile, contact, work hours, academic calendar, fee structure)
4. On completion → school activates + 3-month unlimited-students trial auto-enrolled + dashboard unlocked

---

## Running Migrations

```bash
cd backend
php spark migrate
```

Three new migrations will run:

| Migration | What it does |
|-----------|--------------|
| `2026-04-27-100000_Add_pending_status_to_tenants` | Adds `'pending'` to `tenants.status` ENUM |
| `2026-04-27-100001_Add_credential_flags_to_users` | Adds `is_temp_password`, `onboarding_complete` to `users` |
| `2026-04-27-100002_Create_onboarding_progress_table` | Creates `onboarding_progress` table |

---

## Verify the Unlimited Trial Plan Exists

The free trial enrollment queries for a plan with `max_students IS NULL`. Confirm one exists:

```sql
SELECT id, name, max_students, is_active
FROM subscription_plans
WHERE max_students IS NULL AND is_active = 1;
```

If no row is returned, insert the plan before testing:

```sql
INSERT INTO subscription_plans (id, name, max_students, monthly_price_cents, annual_price_cents, currency, is_active, sort_order, created_at, updated_at)
VALUES ('unlimited', 'Unlimited', NULL, 0, 0, 'USD', 1, 0, NOW(), NOW());
```

---

## Dev Credentials

- **Platform login**: Use the existing platform admin credentials (see `backend/README.md` or seed data)
- **School admin login**: Generated at school creation — check welcome email or the `users` table for the provisioned record

To manually inspect the provisioned user:

```sql
SELECT id, tenant_id, email, name, role, is_temp_password, onboarding_complete, status
FROM users
WHERE role = 'admin' AND is_temp_password = 1
ORDER BY created_at DESC
LIMIT 5;
```

---

## Testing the Full Flow

### 1. Create a school (as platform super-admin)

```bash
curl -X POST http://localhost:8080/api/platform/tenants \
  -H "Authorization: Bearer <platform_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Academy", "email": "testadmin@example.com"}'
```

Expected: `201` with `status: "pending"`, welcome email sent (check backend logs in dev).

### 2. Log in as the provisioned admin

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "testadmin@example.com", "password": "<temp_password_from_email>"}'
```

Expected: `200` with `is_temp_password: true`, `onboarding_complete: false`.

### 3. Fetch onboarding progress

```bash
curl http://localhost:8080/api/onboarding/progress \
  -H "Authorization: Bearer <admin_token>"
```

Expected: `current_step: "password"`, `completed_steps: []`, pre-filled `school_name` and `admin_email`.

### 4. Save each onboarding step

```bash
# Step: profile
curl -X POST http://localhost:8080/api/onboarding/progress \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"step": "profile", "data": {"admin_name": "Test Admin"}}'

# Step: contact
curl -X POST http://localhost:8080/api/onboarding/progress \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"step": "contact", "data": {"contact_email": "info@test.com", "address": "1 Test St"}}'

# (repeat for work-hours, academic-calendar, fee-structure)
```

### 5. Complete onboarding

```bash
curl -X POST http://localhost:8080/api/onboarding/complete \
  -H "Authorization: Bearer <admin_token>"
```

Expected: `200` with `tenant_status: "trialing"`, `subscription.expires_at` ~3 months from now, `onboarding_complete: true`.

### 6. Verify trial enrollment

```sql
SELECT ss.status, ss.starts_at, ss.expires_at, sp.name AS plan_name
FROM school_subscriptions ss
JOIN subscription_plans sp ON sp.id = ss.plan_id
WHERE ss.tenant_id = '<tenant_id>';
```

Expected: one row with `status = 'active'`, `plan_name = 'Unlimited'`, `expires_at` ≈ 3 months from now.

---

## Running Integration Tests

```bash
cd backend
composer test -- --filter SchoolProvisioningTest
```

Test cases covered:

| Test | Scenario |
|------|----------|
| `testCreateSchoolSuccess` | Happy path — tenant + user created, email sent |
| `testCreateSchoolDuplicateEmail` | 409 returned, no records created |
| `testCreateSchoolValidationErrors` | 422 returned for blank name / invalid email |
| `testOnboardingCompleteActivatesTenant` | Tenant status → `trialing`, trial subscription created |
| `testOnboardingIncompleteStepsBlocked` | 422 returned if mandatory steps missing |
| `testDashboardGuardRedirectsPendingAdmin` | Admin with `onboarding_complete = 0` redirected |
| `testTenantIsolationOnOnboardingEndpoints` | Admin cannot read/write another tenant's progress |

---

## Frontend Dev

```bash
cd frontend
npm run dev
```

New routes:
- `/onboarding` — wizard (school-side, admin only, shown pre-activation)
- Platform `Schools` page — "Create School" button now opens a 2-field modal (name + email)

To test the dashboard guard locally: log in as a provisioned admin with `onboarding_complete = false` and attempt to navigate to `/dashboard` — should redirect to `/onboarding`.
