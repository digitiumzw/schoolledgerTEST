# Research: Paynow Subscription Packages

**Feature**: `024-paynow-subscriptions`  
**Phase**: 0 — Unknowns resolved before design  
**Date**: 2026-04-10

---

## 1. Paynow Gateway Integration

### Decision
Use the **Paynow REST API directly via cURL** (CodeIgniter's built-in `CURLRequest` service) rather than pulling in a third-party Paynow PHP SDK.

### Rationale
- The project already uses CodeIgniter's `CURLRequest` service (evident in `app/Config/CURLRequest.php` and the transport module).
- The Paynow web-payments REST API is straightforward: initiate → redirect → webhook callback. A thin `PaynowService` wrapper is sufficient and avoids adding a Composer dependency that may lag behind the gateway's API changes.
- The SDK (paynow/php-sdk) wraps the same REST calls and adds no meaningful value over a direct service class in this context.

### Paynow Flow (Web Payments)
1. Backend calls `POST https://www.paynow.co.zw/interface/initiatetransaction` with merchant credentials, amount, reference, and `resulturl`/`returnurl`.
2. Paynow returns a redirect URL. Backend stores a **pending** transaction record and returns the redirect URL to the frontend.
3. User completes payment in the Paynow-hosted flow and is redirected back to `returnurl`.
4. Paynow posts a status update to `resulturl` (the webhook). The backend verifies the Paynow hash, updates the transaction status, and activates the subscription if `status=Paid`.

### Alternatives Considered
- **Paynow PHP SDK**: Rejected — adds a dependency with no significant reduction in complexity for this simple flow.
- **Mobile money direct API (EcoCash/OneMoney)**: Rejected — handled by Paynow as a payment method; no separate integration needed.

---

## 2. Subscription Tier Boundaries

### Decision
Tier boundaries are implemented as **exclusive upper limits** on the `max_students` field in the `subscription_plans` table:

| Tier | `name` | `max_students` | Notes |
|------|--------|---------------|-------|
| Free | `free` | 49 | Schools with ≤ 49 students |
| Standard | `standard` | 249 | Schools with 50–249 students |
| Advanced | `advanced` | 349 | Schools with 250–349 students |
| Enterprise | `enterprise` | NULL | Schools with 350+ students (no upper limit) |

`NULL` on `max_students` means unlimited. The enforcement logic is: `if ($plan->max_students !== null && $currentStudentCount >= $plan->max_students) → block`.

### Rationale
Storing the boundary in the DB row (rather than hardcoding in PHP) makes tiers configurable without code changes.

### Boundary Condition Decision (from spec edge case)
- A school with **exactly 50 students** is on Standard (50 is within 50–249). The Free plan's limit of 49 means the 50th student triggers an upgrade prompt.
- A school with **exactly 250 students** triggers an Advanced-plan prompt if they are on Standard.
- A school with **exactly 350 students** is on Enterprise (350 is ≥ 350).

---

## 3. Pricing Amounts

### Decision
Pricing amounts are stored in the `subscription_plans` table as `monthly_price_cents` and `annual_price_cents` (integer, cents in ZWL or USD — currency configured via `.env`). **Placeholder values** will be seeded for development; final amounts are a product-owner decision before go-live.

Placeholder seed values (USD cents):

| Tier | Monthly (cents) | Annual (cents) | Monthly equiv. | Annual saving |
|------|----------------|----------------|----------------|---------------|
| Free | 0 | 0 | $0 | — |
| Standard | 1500 | 15000 | $15 | $3 (vs $180/yr) |
| Advanced | 2500 | 25000 | $25 | $5 (vs $300/yr) |
| Enterprise | 4000 | 40000 | $40 | $8 (vs $480/yr) |

### Rationale
Integer cents avoid floating-point rounding errors in financial calculations. A single `CURRENCY` env variable (`USD` by default) avoids hardcoding currency.

### Alternatives Considered
- JSON pricing blob (as in the previous removed schema): Rejected — integer columns are typed, indexable, and prevent schema-less pricing drift.

---

## 4. Billing Cycle & Expiry Logic

### Decision
- **Monthly**: `expires_at = start_date + 1 month` (using PHP `DateTimeImmutable::modify('+1 month')`)
- **Annual**: `expires_at = start_date + 12 months`
- Renewal is **manual** in v1 (administrator re-initiates a new payment). No auto-renewal.
- On upgrade: the old subscription's status is set to `superseded` and a new `school_subscriptions` row is inserted starting immediately.

### Rationale
Manual renewal is simpler to implement correctly and avoids complexities around stored card details / recurring billing mandates.

---

## 5. Webhook Security (Paynow Hash Verification)

### Decision
The Paynow webhook endpoint verifies the posted data by recomputing the Paynow hash:  
`hash = strtoupper(md5(implode('', $fields) . $integrationKey))`  
If the hash does not match, the request is rejected with HTTP 400. No JWT is used for this endpoint (justified exception documented in `plan.md` Complexity Tracking).

### Rationale
This is Paynow's documented security mechanism. It is equivalent in security to a webhook signature (cf. Stripe's `Stripe-Signature` header).

---

## 6. Subscription Status Enforcement

### Decision
Enforcement happens at **two layers**:

1. **Backend API gate (student creation)**: `StudentController::create` and `StudentController::bulkChangeStatus` will check active subscription + student count before accepting new active students.
2. **Frontend soft gate**: The `useSubscription` hook exposes `isOverLimit` and `isExpired` flags. The `SubscriptionStatusBanner` renders a blocking overlay when either flag is true.

The backend gate is the authoritative enforcement layer (Principle III / defense-in-depth).

### Rationale
Frontend-only enforcement can be bypassed via direct API calls. Backend enforcement ensures correctness even if the UI is bypassed.

---

## 7. Previous Subscription Schema (Removed 2025-12-31)

### Finding
Migration `2025-12-31-111920_RemoveSubscriptionFields.php` deliberately dropped:
- `tenants.subscription_plan_id`
- `tenants.subscription_status`
- `tenants.current_period_end`
- The `subscription_plans` table

### Decision
The new design uses **dedicated, normalized tables** (`subscription_plans`, `school_subscriptions`, `subscription_payment_transactions`) rather than denormalized columns on `tenants`. This avoids repeating the previous mistake of coupling subscription state to the tenant row, and allows a full audit trail of past subscriptions and payments.

---

## 8. CodeIgniter 4 Route — Webhook Public Exception

### Decision
The webhook route is excluded from the global `auth` filter by adding it to the filter's `except` list in `Filters.php`:

```php
'auth' => [
    'before' => ['api/*'],
    'except' => ['api/subscription/webhook'],
],
```

Alternatively, the route can be declared **before** the `api/*` group as a top-level public route. Both approaches are valid; the `except` list approach is preferred to keep all subscription routes co-located in the `api/subscription` group.

---

## Summary of Decisions

| Area | Decision |
|------|----------|
| Payment gateway integration | Direct cURL via `CURLRequest` + thin `PaynowService` |
| Tier boundaries | Stored in DB as `max_students` integer (NULL = unlimited) |
| Pricing storage | Integer cents columns (`monthly_price_cents`, `annual_price_cents`) |
| Currency | Configured via `.env` `SUBSCRIPTION_CURRENCY` |
| Billing cycle | Monthly (+1 month) / Annual (+12 months); manual renewal in v1 |
| Webhook security | Paynow hash verification (MD5 of fields + integration key) |
| Enforcement | Backend (authoritative) + frontend (UX layer) |
| Prior schema | New dedicated tables; no re-use of removed columns on `tenants` |
| Webhook auth exception | `Filters.php` `except` list for `api/subscription/webhook` |
