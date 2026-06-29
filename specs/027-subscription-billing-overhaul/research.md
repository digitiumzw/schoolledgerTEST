# Research: Subscription Billing Overhaul

**Branch**: `027-subscription-billing-overhaul` | **Date**: 2026-04-13

## Decision Log

---

### D-001: Cancellation Detection Strategy

**Decision**: Detect cancellation by inspecting the `paynowStatus` field returned from the poll endpoint. If `result.paid === false` AND `result.paynowStatus` is `'Cancelled'` (case-insensitive), show the cancellation banner. If `result.paid === false` and status is anything else (e.g., `'Sent'`, `'Awaiting Delivery'`), show the "processing" banner.

**Rationale**: Paynow does not append a cancel indicator to the return URL — it simply redirects to the configured RETURN_URL. The only reliable way to distinguish cancellation from pending is to poll and inspect the Paynow status string. The `poll()` endpoint already returns `paynowStatus` from `$result['status']` (the Paynow SDK's status string). When a user cancels on Paynow, the SDK returns `'Cancelled'`.

**Alternatives considered**:
- Adding a second return URL (`PAYNOW_CANCEL_URL`) and detecting via `?payment=cancelled` query param — rejected because it requires an additional env var config and Paynow's PHP SDK does not natively support a separate cancel URL in the same way as some other gateways.
- Frontend timeout approach (assume cancel after N seconds with no success) — rejected as unreliable and creates false positives on slow networks.

---

### D-002: Recommended Plan — Always Enterprise

**Decision**: Change `resolveRecommendedPlan()` in `SubscriptionController` to query the database for the plan with the highest `sort_order` and return its `id`. This ensures the recommendation is always the top-tier plan regardless of plan ID naming conventions.

**Rationale**: The spec requires Enterprise to always be recommended. The current dynamic logic (based on student count thresholds) creates cases where lower plans appear recommended. Querying by highest `sort_order` is robust against plan ID changes and works even if the plan is renamed.

**Alternatives considered**:
- Hardcoding the string `'enterprise'` — rejected because it couples the code to a specific plan ID value that may not match the actual DB record.
- A new `is_recommended` boolean column on `subscription_plans` — rejected because it requires a schema migration for a minimal change, and the "highest sort order = top tier" convention is already established in the codebase.

---

### D-003: EcoCash Endpoint Removal Strategy

**Decision**: Remove the `POST /api/subscription/initiate-ecocash` route from `Routes.php`. The `initiateEcocash()` method in `SubscriptionController` can remain in the file but becomes unreachable. Correspondingly, remove `initiateEcocashSubscription()` from `api.ts` and all EcoCash state and UI from `useSubscription.ts` and `Billing.tsx`.

**Rationale**: Keeping the method in the controller but removing the route prevents any accidental re-exposure while keeping the git diff minimal. The method signature and its Paynow mobile SDK call are non-breaking to leave in place.

**Alternatives considered**:
- Return HTTP 410 Gone from `initiateEcocash()` — adds unnecessary code for a removed feature; silent removal via route deletion is cleaner.
- Leave the route active but hidden in the UI — rejected per spec (FR-001 requires full removal, not just UI hiding).

---

### D-004: Poll Endpoint Optimisation

**Decision**: Add a terminal-state short-circuit at the top of `poll()`: if `$tx['status']` is already `paid`, `failed`, or `cancelled`, return the cached status immediately without calling `paynow->pollTransaction()`.

**Rationale**: The current code always calls the Paynow SDK for every poll, even for already-resolved transactions. The `Billing.tsx` `useEffect` calls poll once on return from Paynow; the EcoCash poller called it every 5 seconds. The short-circuit eliminates unnecessary outbound HTTP calls to Paynow's servers and prevents any race where two near-simultaneous poll calls could both attempt `activateSubscription`. The existing `if ($result['paid'] && $tx['status'] !== 'paid')` guard already prevents double activation, but the short-circuit is a cleaner and more efficient approach.

**Alternatives considered**:
- Database-level locking (SELECT FOR UPDATE before activation) — more robust for high-concurrency, but overkill for a per-tenant billing flow with low concurrent request probability.
- Idempotency key on the subscription record — not needed since a new pending subscription is created per payment attempt and terminal-state check is sufficient.

---

### D-005: Paynow Payment Methods to Display in Dialog

**Decision**: List the following payment methods in the confirmation dialog:
- Visa / Mastercard (card payments)
- EcoCash (web-based, via Paynow portal — distinct from the removed USSD push)
- OneMoney (web-based, via Paynow portal)
- Telecash

**Rationale**: These are the payment methods available on the Paynow merchant portal for Zimbabwe-based merchants. The dialog should enumerate them so users know what to expect before being redirected. "EcoCash web" (paying through the Paynow portal) is different from the removed "EcoCash USSD push" feature and should still be listed as a Paynow option.

**Alternatives considered**:
- Fetching payment methods dynamically from Paynow API — no such endpoint exists in the Paynow PHP SDK; methods are configured at the merchant portal level.
- Showing only a generic "multiple payment methods" message — less informative; users in Zimbabwe specifically need to know EcoCash is available on the Paynow portal.

---

### D-006: Confirmation Dialog Placement

**Decision**: Create a new `SubscribeConfirmDialog.tsx` component in `frontend/src/components/subscription/`. The dialog is opened from `Billing.tsx` when a plan's Subscribe/Upgrade/Downgrade button is clicked. On confirm, `initiatePaidSubscription()` is called (same as before). The dialog receives the selected plan and cycle as props to display price details.

**Rationale**: Extracting to a component keeps `Billing.tsx` clean and makes the dialog independently testable. The `useSubscription` hook API remains unchanged from the caller's perspective — only the trigger point moves from direct click → dialog confirm.

**Alternatives considered**:
- Inline dialog state in `Billing.tsx` — simpler but inflates an already-long page component.
- Using a shadcn/ui `AlertDialog` vs `Dialog` — `Dialog` is preferred because it supports richer content (payment method list); `AlertDialog` is designed for simple yes/no confirmations.
