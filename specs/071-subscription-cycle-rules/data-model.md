# Data Model: Subscription Billing Cycle Transition Rules

## Existing Entities

### Subscription (`school_subscriptions`)

Represents a tenant's current or historical SaaS subscription.

**Existing fields relevant to this feature**:

- `id`: Unique subscription identifier.
- `tenant_id`: Tenant that owns the subscription.
- `plan_id`: Current subscription plan.
- `billing_cycle`: `monthly` or `annual`.
- `status`: `pending`, `active`, `expired`, `superseded`, or `cancelled`.
- `starts_at`: Subscription period start timestamp.
- `expires_at`: Subscription renewal/expiration timestamp.
- `amount_paid_cents`: Amount paid for this subscription record.
- `currency`: Subscription currency.
- `activated_at`: Timestamp when payment confirmation activated the subscription.
- `cancelled_at`: Cancellation timestamp.

**Validation rules**:

- Tenant-facing operations MUST resolve active subscription by JWT-derived `tenant_id`.
- Only one active subscription should exist per tenant after activation.
- A tenant with active `billing_cycle=annual` MUST NOT create or change to a monthly subscription.
- Active annual tier changes MUST preserve the previous active subscription `expires_at`.
- Monthly → annual transition is allowed.

**State transitions**:

```text
pending --payment paid--> active
pending --payment failed/cancelled--> cancelled
active --replacement activated--> superseded
active --manual/platform cancel--> cancelled
active --period elapsed--> expired
```

**Billing-cycle transition rules**:

```text
monthly -> monthly: allowed for renewal/new monthly purchase
monthly -> annual: allowed at any time
annual  -> annual: allowed for tier changes and renewal
annual  -> monthly: blocked permanently
```

### Subscription Plan (`subscription_plans`)

Defines available plan tiers and prices.

**Existing fields relevant to this feature**:

- `id`: Unique plan identifier.
- `name`: Plan label such as Basic or Premium.
- `monthly_price_cents`: Monthly price.
- `annual_price_cents`: Annual price.
- `annual_discount_pct`: Discount metadata.
- `max_students`: Optional student limit for tier eligibility.
- `currency`: Plan currency.
- `is_active`: Whether plan can be selected.
- `sort_order`: Relative tier ordering; higher means higher tier.

**Validation rules**:

- Target plan must exist and be active for tenant-facing selection.
- Downgrades to a plan with `max_students` lower than the tenant's current student count must be blocked.
- Tier upgrades/downgrades are determined by comparing `sort_order`.

### Proration Calculation (`proration_calculations`)

Stores a preview/confirmation record for plan changes.

**Existing fields relevant to this feature**:

- `id`: Calculation identifier.
- `tenant_id`: Tenant owner.
- `original_subscription_id`: Active subscription used as calculation source.
- `new_subscription_id`: Subscription created after confirmation.
- `original_plan_id`: Current plan.
- `new_plan_id`: Target plan.
- `billing_cycle`: Billing cycle used for calculation.
- `cycle_start_date`: Current cycle start date.
- `cycle_end_date`: Current cycle end/renewal date.
- `days_in_cycle`: Number of days in subscription cycle.
- `days_remaining`: Remaining days at calculation time.
- `original_plan_price_cents`: Current plan price for the cycle.
- `new_plan_price_cents`: Target plan price for the cycle.
- `unused_value_credit_cents`: Value of current plan for remaining time.
- `prorated_charge_cents`: Value of target plan for remaining time.
- `net_amount_cents`: Amount due; positive for upgrades, zero/negative for downgrades.
- `calculation_formula`: Human-readable formula snapshot.
- `status`: `calculated`, `confirmed`, `failed`, or cancellation state.
- `confirmed_at`, `cancelled_at`: Lifecycle timestamps.

**Validation rules**:

- Calculation must belong to JWT-derived `tenant_id`.
- Calculation must not be expired at confirmation time.
- Calculation must be confirmed only once.
- For active annual subscriptions, `billing_cycle` MUST remain `annual`.
- Annual → monthly calculations MUST NOT be persisted.

**Annual upgrade formula**:

```text
price_difference_cents = target_annual_price_cents - current_annual_price_cents
amount_due_cents = round(price_difference_cents * days_remaining / days_in_cycle)
```

Equivalent existing net formula:

```text
unused_current_value = round(current_annual_price_cents * days_remaining / days_in_cycle)
target_remaining_value = round(target_annual_price_cents * days_remaining / days_in_cycle)
net_amount_cents = target_remaining_value - unused_current_value
```

### Subscription Transaction (`subscription_transactions`)

Represents Paynow-backed payment attempts for subscriptions.

**Fields relevant to this feature**:

- `id`: Transaction identifier.
- `tenant_id`: Tenant owner.
- `subscription_id`: Pending subscription associated with the payment.
- `our_reference`: Internal payment reference.
- `amount_cents`: Amount to charge.
- `currency`: Currency.
- `status`: `initiated`, `paid`, `failed`, `cancelled`, or similar terminal status.
- `paynow_reference`, `paynow_poll_url`, `paynow_status_raw`: Gateway metadata.
- `initiated_at`, `completed_at`: Transaction timestamps.

**Validation rules**:

- Positive annual upgrade prorations require successful payment before activation.
- Failed payment must leave current active subscription unchanged.
- Zero-amount downgrade paths may activate/schedule without gateway payment if policy allows.

### Billing Event (`billing_events`)

Audit stream for subscription lifecycle changes.

**Relevant event types**:

- `plan_activated`
- `subscription_renewed`
- `plan_upgraded`
- `plan_downgraded`
- `payment_confirmed`
- New or reused event for blocked transition attempts, e.g. `billing_cycle_change_blocked`.

**Validation rules**:

- Successful billing-cycle and tier changes should be recorded with plan, billing cycle, amount, subscription, and transaction context.
- Annual → monthly blocked attempts should be logged with tenant, attempted target cycle, active subscription, and user context where available.

## Optional Additive Data Changes

Implementation may avoid schema changes if existing `proration_calculations` and `billing_events` are sufficient. If stronger audit semantics are required, add a new migration only.

### Optional fields for `proration_calculations`

- `change_type`: `monthly_to_annual`, `annual_tier_upgrade`, `annual_tier_downgrade`, `renewal`, or `other`.
- `policy_code`: Stable policy identifier such as `ONE_WAY_ANNUAL_CYCLE`.

### Optional fields for `school_subscriptions`

- `pending_plan_id`: Target plan for scheduled-at-renewal downgrade.
- `pending_change_effective_at`: Renewal date when scheduled downgrade will apply.
- `pending_change_type`: `tier_downgrade` or future supported change type.

## Entity Relationships

```text
tenants 1 ── * school_subscriptions
subscription_plans 1 ── * school_subscriptions
school_subscriptions 1 ── * subscription_transactions
school_subscriptions 1 ── * proration_calculations (as original_subscription_id)
school_subscriptions 1 ── 0..1 proration_calculations (as new_subscription_id)
tenants 1 ── * billing_events
```

## Invariants

- Annual subscriptions cannot become monthly through tenant-facing APIs, platform APIs, pending subscription activation, or direct proration confirmation.
- Annual tier changes must not change `expires_at`.
- Positive proration amount must be paid before feature tier access changes.
- Negative proration amount must not create cash refunds for this feature.
- Platform admin tools must not silently bypass the one-way billing-cycle policy.
