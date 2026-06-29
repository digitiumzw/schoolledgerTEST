# Quickstart: Subscription Billing Cycle Transition Rules

## Prerequisites

- Backend configured with `.env` and reachable at `http://localhost:8080`.
- Frontend dependencies installed if UI validation is required.
- Database has subscription seed data with at least two active plans, e.g. Basic and Premium.
- Paynow sandbox or existing local development payment behavior is configured.
- Admin credentials are available for a tenant, e.g. `admin@greenwood.co.zw` / `12345678`.
- Platform admin credentials are available for `/api/platform/*` routes.

## Implementation Validation Commands

### Static validation

From `backend/`:

```bash
php -l app/Controllers/Api/SubscriptionController.php
php -l app/Controllers/Platform/SubscriptionsController.php
php -l app/Services/ProrationService.php
php -l app/Models/SchoolSubscriptionModel.php
php -l app/Models/ProrationCalculationModel.php
```

If migrations are added:

```bash
php spark migrate
```

From `frontend/`:

```bash
./node_modules/.bin/tsc --noEmit --pretty false
./node_modules/.bin/eslint src/api/api.ts src/api/platform.ts src/admin/pages/Subscriptions.tsx
```

## Curl Validation

Set API base URL:

```bash
BASE_URL="http://localhost:8080/api"
```

### 1. Tenant login

```bash
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')
```

Expected:

- HTTP 200.
- `TOKEN` is not empty/null.

### 2. Read plans and current subscription

```bash
curl -s "$BASE_URL/subscription/plans" \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "$BASE_URL/subscription/current" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected:

- Plans include at least Basic and Premium or equivalent sorted tiers.
- Current response includes `billingCycle`, `expiresAt`, and optionally transition policy metadata.

### 3. Monthly → annual is allowed

Prepare a tenant with an active monthly subscription. Then initiate annual subscription:

```bash
curl -i -s -X POST "$BASE_URL/subscription/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"planId":"premium","billingCycle":"annual"}'
```

Expected:

- HTTP 201 or payment-initiation success status depending on existing endpoint behavior.
- A pending annual subscription/transaction is created only after validation passes.
- Existing monthly subscription remains active until payment confirmation.

### 4. Annual → monthly is blocked in normal initiation

Prepare a tenant with an active annual subscription. Then attempt monthly initiation:

```bash
curl -i -s -X POST "$BASE_URL/subscription/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"planId":"basic","billingCycle":"monthly"}'
```

Expected:

- HTTP 422.
- Response contains `ANNUAL_TO_MONTHLY_BLOCKED`.
- No pending monthly subscription is created.
- No subscription transaction is created for the blocked attempt.

### 5. Annual → monthly is blocked in EcoCash initiation

```bash
curl -i -s -X POST "$BASE_URL/subscription/initiate-ecocash" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"planId":"basic","billingCycle":"monthly","phone":"0770000000","method":"ecocash"}'
```

Expected:

- HTTP 422.
- Response contains `ANNUAL_TO_MONTHLY_BLOCKED`.
- No pending monthly subscription/transaction rows are created.

### 6. Annual tier upgrade proration preview is allowed

With active annual Basic subscription:

```bash
CALC_RESPONSE=$(curl -s -X POST "$BASE_URL/subscription/calculate-proration" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"targetPlanId":"premium","billingCycle":"annual"}')

echo "$CALC_RESPONSE" | jq
CALC_ID=$(echo "$CALC_RESPONSE" | jq -r '.data.calculationId')
```

Expected:

- HTTP 200.
- `billingCycle` is `annual`.
- `cycleDates.endDate` matches the current subscription renewal date.
- `proration.netAmountCents` is positive for an upgrade.
- Manual formula check matches: `(target annual price - current annual price) * daysRemaining / daysInCycle`, rounded to cents.

### 7. Annual proration cannot request monthly cycle

```bash
curl -i -s -X POST "$BASE_URL/subscription/calculate-proration" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"targetPlanId":"premium","billingCycle":"monthly"}'
```

Expected:

- HTTP 422.
- Response contains `ANNUAL_TO_MONTHLY_BLOCKED`.
- No `proration_calculations` row is persisted for the blocked attempt.

### 8. Confirm annual tier upgrade preserves renewal date

```bash
curl -i -s -X POST "$BASE_URL/subscription/upgrade-with-proration" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"calculationId\":\"$CALC_ID\",\"paymentMethod\":\"paynow\"}"
```

Expected:

- HTTP 201 for positive upgrade amount.
- Pending subscription is annual.
- On payment confirmation/poll success, active subscription plan changes to target plan.
- `expiresAt` equals the original annual renewal date.

### 9. Failed payment does not activate tier upgrade

Use Paynow sandbox behavior or simulate failed/cancelled poll where supported:

```bash
curl -s "$BASE_URL/subscription/poll/<transactionId>" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected:

- Failed/cancelled payment marks pending subscription cancelled.
- Original annual subscription remains active.
- Target tier is not granted.

### 10. Annual downgrade does not refund

With active annual Premium subscription, calculate downgrade to Basic:

```bash
curl -s -X POST "$BASE_URL/subscription/calculate-proration" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"targetPlanId":"basic","billingCycle":"annual"}' | jq
```

Expected:

- Downgrade is allowed only if student count fits target plan limit.
- No cash refund is issued.
- Implementation-specific result is either scheduled at renewal or immediate zero-charge/no-refund downgrade.
- Renewal date remains unchanged.

### 11. Tenant isolation for proration records

Using a second tenant token, attempt to confirm the first tenant's calculation:

```bash
curl -i -s -X POST "$BASE_URL/subscription/upgrade-with-proration" \
  -H "Authorization: Bearer $OTHER_TENANT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"calculationId\":\"$CALC_ID\"}"
```

Expected:

- HTTP 404 or equivalent not found response.
- No subscription state changes occur for either tenant.

### 12. Platform admin annual → monthly guard

Using platform admin token and a tenant with active annual subscription:

```bash
curl -i -s -X POST "$BASE_URL/platform/subscriptions/assign" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":"<tenantId>","plan_id":"basic","billing_cycle":"monthly","starts_at":"2026-06-01","expires_at":"2026-07-01"}'
```

Expected:

- HTTP 422.
- Response contains `ANNUAL_TO_MONTHLY_BLOCKED`.
- Existing annual subscription remains active.

## UI Validation

- Tenant subscription screen hides/disables monthly choice when current cycle is annual.
- Annual upgrade preview shows amount due and unchanged renewal date.
- Annual downgrade flow clearly states no refund and effective timing.
- Platform Subscriptions screen blocks monthly assignment for active annual tenants and surfaces backend errors.

## Completion Criteria

- Static checks pass for touched backend and frontend files.
- Curl validations pass for monthly → annual, annual tier upgrade, annual → monthly block, failed payment no-activation, and tenant isolation.
- Existing subscription history, invoices, and billing events remain readable after changes.

## Validation Results - 2026-05-11

### Completed

- Backend PHP lint passed for:
  - `app/Controllers/Api/SubscriptionController.php`
  - `app/Controllers/Platform/SubscriptionsController.php`
  - `app/Services/ProrationService.php`
  - `app/Services/SubscriptionTransitionPolicy.php`
  - `app/Models/SchoolSubscriptionModel.php`
  - `app/Models/ProrationCalculationModel.php`
  - `app/Models/BillingEventModel.php`
  - `app/Database/Migrations/2026-05-11-000001_AddSubscriptionTransitionAuditFields.php`
- Migration applied successfully with `php spark migrate`.
- Frontend TypeScript passed with `./node_modules/typescript/bin/tsc --noEmit --pretty false`.
- Tenant login succeeded for `admin@greenwood.co.zw`.
- `GET /api/subscription/current` returned transition policy metadata.
- Monthly → annual initiation succeeded for the active monthly tenant:
  - `POST /api/subscription/initiate`
  - Payload: `{"planId":"enterprise","billingCycle":"annual"}`
  - Result: HTTP 201, pending annual subscription and transaction created.
- Paynow poll for the created transaction returned unpaid `created` state, so the original monthly subscription remained active.
- `GET /api/subscription/history` initially exposed a formatter bug for transactions without proration fields; fixed by safely handling missing/null proration metadata, then revalidated successfully.

### Deviations / Pending

- Targeted ESLint did not pass because the project already contains `@typescript-eslint/no-explicit-any` errors in `frontend/src/api/api.ts` and `frontend/src/admin/pages/Subscriptions.tsx`, plus the pre-existing `Infinity` import shadowing error in `Subscriptions.tsx`.
- Annual → monthly block, annual tier proration, payment-failure rollback, tenant isolation for proration records, and platform guard curl scenarios were not fully executable against the current local tenant state because the available tenant is monthly and the Paynow sandbox transaction did not become paid/active annual.
