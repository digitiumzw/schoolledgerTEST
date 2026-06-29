# Research: Billing Plans Management

**Branch**: `026-billing-plans-management` | **Date**: 2026-04-12

---

## 1. Free Plan Removal Strategy

**Decision**: Soft-deactivate the `free` plan record via a new data migration (set `is_active = 0`); do not delete the row.

**Rationale**: Existing `school_subscriptions` rows reference `plan_id = 'free'` via a foreign key. Deleting the plan would violate referential integrity or require cascading deletes that destroy historical data. Setting `is_active = 0` makes the plan invisible to the `getActivePlans()` query (which filters `WHERE is_active = 1`) while preserving all historical subscription and transaction records. Schools currently on the free plan retain their history but will see an expired/no-plan state and be prompted to choose a paid plan.

**Alternatives considered**:
- Hard-delete + FK cascade: Rejected — destroys payment and subscription history.
- Rename free plan to Starter: Rejected — the free plan has `monthly_price_cents = 0`; conflating it with the paid Starter plan would corrupt pricing data.

---

## 2. Plan Rename & Re-seeding Strategy

**Decision**: Update `SubscriptionPlanSeeder` to reflect the new three-tier structure. Add a complementary migration to UPDATE existing plan names in `subscription_plans` directly for environments already running the old seeder.

**New plan IDs and names**:

| Old ID | Old Name | New ID | New Name | Student Limit | Notes |
|--------|----------|--------|----------|---------------|-------|
| `free` | Free | `free` | Free | 49 | `is_active = 0` (deactivated) |
| `standard` | Standard | `starter` | Starter | 249 | Renamed |
| `advanced` | Advanced | `growth` | Growth | 349 | Renamed |
| `enterprise` | Enterprise | `enterprise` | Enterprise | unlimited | ID unchanged |

**Rationale**: Changing IDs from `standard`→`starter` and `advanced`→`growth` requires a migration that updates both `subscription_plans.id` and any `school_subscriptions.plan_id` FK references. This is preferable to leaving misleading IDs that contradict the new names shown in the UI.

**Alternatives considered**:
- Keep old IDs, only update `name` column: Simpler migration, but `resolveRecommendedPlan()` in `SubscriptionController` hardcodes old IDs (`'standard'`, `'advanced'`) — both places would need updating, so renaming IDs is cleaner.
- New IDs without migrating FK: Rejected — orphaned FKs break history lookups.

---

## 3. Downgrade Support

**Decision**: Permit downgrades in `SubscriptionController::initiate()` (and `initiateEcocash()`) with a pre-flight student-count check. Replace the current hard-rejection of same-or-lower tier plans with conditional logic.

**Current behaviour**: `initiate()` rejects any plan whose `sort_order` is ≤ the current plan's `sort_order` with "Downgrade is not supported."

**New behaviour**:
1. If target plan's `sort_order` < current plan's `sort_order` → it is a downgrade.
2. Fetch current student count via `TenantModel::getStudentCount()`.
3. If `studentCount > targetPlan.max_students` (and `max_students` is not null) → return HTTP 422 with `{ error: 'downgrade_blocked', studentCount, planLimit }`.
4. Otherwise allow the payment initiation to proceed normally.

**Rationale**: Downgrade is a legitimate operation for schools that have reduced enrolment. The student-count guard is the only safety constraint needed; the payment flow is identical to upgrade.

**Alternatives considered**:
- Allow downgrade without student-count check: Rejected — schools would be silently over-limit after downgrade.
- Require admin to manually reduce students first (block entirely): Already implemented as the FR-005 requirement. The API returns a descriptive error; the UI surfaces the count mismatch.

---

## 4. Invoice Generation

**Decision**: Generate invoices as database records at the point of payment confirmation (webhook or poll callback). Serve PDF downloads via a dedicated endpoint that renders the record server-side.

**Invoice record fields**: `id (UUID)`, `tenant_id`, `subscription_id`, `transaction_id`, `invoice_number (sequential per tenant)`, `school_name`, `plan_name`, `billing_cycle`, `amount_cents`, `currency`, `issued_at`, `pdf_path (nullable — generated on first download)`.

**PDF generation**: Use [mPDF](https://mpdf.github.io/) or [Dompdf](https://github.com/dompdf/dompdf) (both available as Composer packages for PHP 8.1+). PDF is generated on the first download request and cached to `writable/invoices/{tenant_id}/{invoice_id}.pdf`. Subsequent downloads stream the cached file.

**Rationale**: Database record created at payment time ensures the invoice exists even if PDF generation fails. Lazy PDF generation avoids blocking the Paynow webhook callback with a potentially slow render. Constitution Principle V: invoice amount is copied from the transaction record at generation time — it is never recomputed.

**Alternatives considered**:
- Generate PDF eagerly in the webhook handler: Rejected — slow PDF render in a webhook response risks Paynow timeout and duplicate callbacks.
- Store only PDF (no DB record): Rejected — makes invoice listing, search, and re-generation impossible without filesystem scanning.

---

## 5. Billing Events (Condensed History)

**Decision**: Introduce a `billing_events` table. Write events from `SubscriptionController` at the moment each significant action occurs (payment confirmation, activation, upgrade, downgrade, expiry).

**Event types**: `payment_confirmed`, `plan_activated`, `plan_upgraded`, `plan_downgraded`, `subscription_renewed`, `subscription_expired`.

**Rationale**: The existing `history` endpoint returns raw `school_subscriptions` and `subscription_payment_transactions` arrays — these include noise (pending, cancelled, superseded rows that were intermediate states). A dedicated events table with an explicit allowlist of significant types produces a clean history with zero noise, satisfying FR-011 without filtering logic in the frontend.

**Alternatives considered**:
- Filter existing history endpoint on the frontend: Rejected — "cancelled" and "superseded" entries would still leak through unless carefully filtered, and the definition of "important" would be fragile.
- Add an `event_type` column to `school_subscriptions`: Rejected — subscriptions represent periods, not point-in-time events. A separate table is cleaner and queryable independently.

---

## 6. Billing History Pagination

**Decision**: Backend returns paginated billing events with `page` and `perPage` query params (default `perPage=20`). Response includes `{ events, total, page, perPage }`.

**Rationale**: Frontend requests page 1 by default (most recent 20). User can load more via a "Load more" button or page controls. Keeps initial payload small.

**Alternatives considered**:
- Cursor-based pagination: More complex to implement; offset pagination is sufficient at this scale.
- Load all events, paginate client-side: Rejected — unbounded payload growth for long-lived schools.

---

## 7. `resolveRecommendedPlan()` Update

**Decision**: Update `resolveRecommendedPlan()` in `SubscriptionController` to use new plan IDs (`starter`, `growth`, `enterprise`) and remove the `free` branch.

```php
// Before
if ($studentCount < 50)  return 'free';
if ($studentCount < 250) return 'standard';
if ($studentCount < 350) return 'advanced';
return 'enterprise';

// After
if ($studentCount < 250) return 'starter';
if ($studentCount < 350) return 'growth';
return 'enterprise';
```

**Rationale**: Method must reflect new plan IDs. No free plan means any school size maps to a paid plan.

---

## 8. Frontend: Removing Free Plan UI

**Decision**: Remove the `activateFree` path from `Billing.tsx` and `useSubscription.ts`. The `handleSubscribe` guard `if (planId === 'free')` is deleted. The EcoCash panel filter `plans.filter(p => p.id !== 'free')` becomes `plans` (all plans are paid). `PlanSelector` skeleton count drops from 4 to 3 grids.

**Rationale**: The free plan no longer exists in the plan list returned by the API (because `is_active = 0`). Removing the dead code prevents confusion and avoids a broken `activate-free` call path.

---

## 9. PDF Library Choice

**Decision**: Use **Dompdf** (`dompdf/dompdf ^2.0`) as the PDF renderer.

**Rationale**: Already a common choice for CodeIgniter 4 projects; HTML/CSS template input is easy to maintain; supports UTF-8 and table layouts required for invoices; no system binary dependencies (unlike wkhtmltopdf).

**Alternatives considered**:
- mPDF: Also viable; slightly heavier. Dompdf preferred for its simpler API for single-page documents.
- TCPDF: More verbose API; overkill for single-page invoices.
- wkhtmltopdf: Requires system binary; deployment complexity not justified.
