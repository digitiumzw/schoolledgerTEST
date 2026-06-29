# Contracts: Subscription Billing Cycle Transition Rules

## Response Envelope

All tenant-facing API responses follow the existing SchoolLedger API envelope.

Successful response:

```json
{ "status": "success", "data": {}, "message": "..." }
```

Error response:

```json
{ "status": "error", "message": "...", "errors": {} }
```

Platform responses follow existing platform admin response conventions and must return equivalent status codes and safe error messages.

## Tenant-Facing Subscription APIs

### GET `/api/subscription/current`

Returns current subscription status for the JWT tenant.

**Required behavior changes**:

- Include enough data for the frontend to know whether monthly selection must be hidden/disabled.
- For active annual subscriptions, client state should represent `canSwitchToMonthly=false`.

**Response data additions (optional but recommended)**:

```json
{
  "subscription": {
    "id": "sub_123",
    "planId": "basic",
    "planName": "Basic",
    "billingCycle": "annual",
    "status": "active",
    "startsAt": "2026-01-01 00:00:00",
    "expiresAt": "2027-01-01 00:00:00",
    "amountPaidCents": 120000,
    "currency": "USD",
    "activatedAt": "2026-01-01 00:00:00"
  },
  "transitionPolicy": {
    "canSwitchToAnnual": false,
    "canSwitchToMonthly": false,
    "canChangeTier": true,
    "blockedReason": "Annual subscriptions cannot be converted to monthly. You may change plan tier within the annual cycle."
  }
}
```

### POST `/api/subscription/initiate`

Initiates a Paynow subscription payment for the JWT tenant.

**Request**:

```json
{
  "planId": "premium",
  "billingCycle": "annual"
}
```

**Rules**:

- If active subscription is monthly and `billingCycle=annual`: allow.
- If active subscription is annual and `billingCycle=annual`: allow only when target plan is a valid annual tier operation or renewal path.
- If active subscription is annual and `billingCycle=monthly`: reject before creating pending subscription or transaction.

**Blocked annual → monthly response**:

HTTP `422`

```json
{
  "status": "error",
  "message": "Annual subscriptions cannot be converted to monthly billing.",
  "errors": {
    "code": "ANNUAL_TO_MONTHLY_BLOCKED",
    "billingCycle": "Once a tenant is on annual billing, only annual tier changes are allowed within the active cycle."
  }
}
```

### POST `/api/subscription/initiate-ecocash`

Same transition rules as `/api/subscription/initiate`, with mobile-money-specific payment fields preserved.

**Request**:

```json
{
  "planId": "premium",
  "billingCycle": "annual",
  "phone": "0770000000",
  "method": "ecocash"
}
```

**Rules**:

- Annual → monthly requests must be rejected before pending subscription or transaction rows are created.
- Annual tier upgrades must preserve original `expires_at` when activated after payment.

### POST `/api/subscription/calculate-proration`

Calculates tier-change proration for an active subscription.

**Request**:

```json
{
  "targetPlanId": "premium",
  "billingCycle": "annual"
}
```

**Rules**:

- `targetPlanId` is required and must reference an active plan.
- If active subscription is annual, `billingCycle` must either be omitted or equal `annual`.
- If active subscription is annual and `billingCycle=monthly`, return `ANNUAL_TO_MONTHLY_BLOCKED` and do not persist a calculation.
- Downgrade to a plan whose student limit is below current tenant student count must return existing downgrade blocked error.
- Calculation response must preserve the current cycle end date as the renewal date.

**Success response**:

```json
{
  "status": "success",
  "data": {
    "calculationId": "calc_123",
    "originalPlan": { "id": "basic", "name": "Basic", "priceCents": 120000, "currency": "USD" },
    "newPlan": { "id": "premium", "name": "Premium", "priceCents": 240000, "currency": "USD" },
    "billingCycle": "annual",
    "cycleDates": {
      "startDate": "2026-01-01",
      "endDate": "2027-01-01",
      "daysInCycle": 365,
      "daysRemaining": 180
    },
    "proration": {
      "unusedValueCreditCents": 59178,
      "proratedChargeCents": 118356,
      "netAmountCents": 59178,
      "isUpgrade": true,
      "isDowngrade": false
    },
    "breakdown": {
      "dailyRateOriginalCents": 329,
      "dailyRateNewCents": 658,
      "formula": "(target annual price - current annual price) * remaining days / cycle days"
    }
  },
  "message": "OK"
}
```

### POST `/api/subscription/upgrade-with-proration`

Confirms a previously calculated annual tier change.

**Request**:

```json
{
  "calculationId": "calc_123",
  "paymentMethod": "paynow"
}
```

**Rules**:

- Calculation must belong to JWT tenant.
- Calculation must not be expired.
- Calculation must still be in `calculated` state.
- If calculation belongs to an annual active subscription, resulting subscription must keep `billingCycle=annual` and preserve `cycle_end_date` as `expires_at`.
- Positive `netAmountCents` requires payment initiation and must not activate until payment is confirmed.
- Zero or negative `netAmountCents` must not issue refunds. It may activate immediately with zero charge or schedule downgrade at renewal depending on implementation choice.

**Success response for positive upgrade**:

HTTP `201`

```json
{
  "status": "success",
  "data": {
    "subscriptionId": "sub_pending_123",
    "transactionId": "tx_123",
    "redirectUrl": "https://payment.example/redirect",
    "ourReference": "SUB-tenant-123",
    "activated": false,
    "prorationApplied": {
      "creditUsedCents": 59178,
      "amountToChargeCents": 59178
    }
  },
  "message": "Upgrade initiated"
}
```

### GET `/api/subscription/proration-history`

Returns tenant-scoped calculation history.

**Required behavior**:

- Include annual tier upgrades/downgrades.
- Never return records for other tenants.
- If fields are added, expose `changeType` and `policyCode` for audit clarity.

## Platform Admin APIs

### POST `/api/platform/subscriptions/assign`

Manually assigns a subscription to a tenant.

**Existing request**:

```json
{
  "tenant_id": "tenant_123",
  "plan_id": "premium",
  "billing_cycle": "monthly",
  "starts_at": "2026-01-01",
  "expires_at": "2026-02-01"
}
```

**Required behavior changes**:

- If the tenant has ever had an active annual subscription and business policy is permanent one-way, monthly assignment must be blocked.
- At minimum, if the tenant currently has an active annual subscription, monthly assignment must be blocked.
- Platform admins must receive the same stable error code: `ANNUAL_TO_MONTHLY_BLOCKED`.
- Assignment to annual remains allowed.

### POST `/api/platform/subscriptions/{id}/change-plan`

Changes a subscription plan from the platform admin UI.

**Existing request**:

```json
{ "plan_id": "premium" }
```

**Required behavior changes**:

- Existing endpoint only changes plan ID; for annual subscriptions, it must not reset `expires_at`.
- It must not introduce monthly billing cycle changes.
- If future request supports billing cycle, annual → monthly must be blocked.
- Platform change should record audit context and billing event.

## Frontend Contract Expectations

### Tenant subscription UI

- Hide or disable monthly billing options when current subscription is annual.
- Explain: "Annual subscriptions cannot be converted to monthly. You can change your annual plan tier while keeping your renewal date."
- Show proration preview for annual tier upgrade: amount due, days remaining, original renewal date.
- For downgrades, disclose whether change is immediate with no refund or scheduled at renewal.

### Platform subscription UI

- Prevent monthly selection for tenants with active annual subscriptions.
- If a backend rejection still occurs, display the backend error message directly.
- Show current cycle and expiry date in subscription management rows before assignment/change.
