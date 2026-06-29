# Feature Specification: Refactor Paynow Integration

**Feature Branch**: `025-paynow-refactor`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User description: "Refactor the Paynow integration logic so that it fully follows the official Paynow documentation. Review, correct, and fix any existing logic bugs, and ensure the implementation works correctly and reliably."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Payment Initiation (Priority: P1)

A school administrator selects a subscription plan and billing cycle, clicks "Pay Now", and is reliably redirected to the Paynow payment page. The system stores a pending transaction record before the redirect so that any subsequent status update (webhook or manual poll) can be matched back to this session.

**Why this priority**: Payment initiation is the entry point of the entire billing flow. If it fails silently or produces an incorrect request to Paynow, no subscription can be activated. Fixing the integration here unblocks all downstream scenarios.

**Independent Test**: Can be fully tested by initiating a subscription payment with valid credentials and confirming the redirect URL points to the real Paynow gateway. A transaction record in `initiated` state must exist in the database before the user is redirected.

**Acceptance Scenarios**:

1. **Given** a school admin with valid Paynow credentials configured, **When** they POST `/api/subscription/initiate` with a valid plan and billing cycle, **Then** the system returns a `redirectUrl` pointing to the Paynow payment page, a `transactionId`, and stores the transaction in `initiated` status.
2. **Given** the Paynow gateway returns an error response, **When** the initiation request is sent, **Then** the transaction is marked `failed`, the subscription is cancelled, and the API returns a descriptive error without redirecting the user.
3. **Given** Paynow credentials are missing or are placeholder values, **When** initiation is requested, **Then** the system returns a sandbox redirect URL so the UI flow can be verified locally without a live gateway.

---

### User Story 2 - Trustworthy Webhook Callback Processing (Priority: P1)

When a user completes (or abandons) payment on the Paynow page, Paynow sends a POST callback to the school's result URL. The system must verify the callback's integrity, update the transaction and subscription records correctly, and store the Paynow-assigned reference for future reconciliation.

**Why this priority**: Webhooks are the primary activation path. A bug in hash verification or status handling means subscriptions never activate (or activate when they shouldn't), which is a P0 business risk.

**Independent Test**: Can be fully tested by simulating a Paynow webhook POST (with a correctly signed hash) for each status — `paid`, `failed`, `cancelled` — and asserting the transaction and subscription reach the expected states.

**Acceptance Scenarios**:

1. **Given** a valid signed `paid` webhook for a known reference, **When** it arrives at `/api/subscription/webhook`, **Then** the transaction is marked `paid`, `paynow_reference` is stored, and the corresponding subscription is activated with the correct expiry date.
2. **Given** a webhook with an invalid or tampered hash, **When** it arrives, **Then** the system rejects it with HTTP 400 and makes no database changes.
3. **Given** a `failed` or `cancelled` webhook, **When** it arrives, **Then** the transaction is marked with the corresponding status and the subscription is cancelled.
4. **Given** a duplicate `paid` webhook for an already-paid transaction, **When** it arrives, **Then** the system responds 200 without re-processing or duplicating subscription activation.

---

### User Story 3 - Accurate Transaction Status Polling (Priority: P2)

After being redirected back from Paynow, the frontend polls the server to determine whether payment was confirmed. The poll result must accurately reflect the real Paynow status (or sandbox status when applicable) and trigger subscription activation if the payment is confirmed and has not been activated yet.

**Why this priority**: Polling is the fallback activation path when the webhook is delayed or fails. It must produce the same end-state as the webhook path.

**Independent Test**: Can be fully tested by mocking the Paynow poll URL response and calling `/api/subscription/poll/{transactionId}`, asserting subscription activation occurs exactly once.

**Acceptance Scenarios**:

1. **Given** a pending transaction with a valid poll URL and Paynow returns `paid`, **When** the frontend calls the poll endpoint, **Then** the transaction is marked `paid`, the subscription is activated, and `paid: true` is returned.
2. **Given** a transaction in `paid` status is polled again, **When** the poll endpoint is called, **Then** the subscription is not re-activated and `paid: true` is returned without duplicate DB writes.
3. **Given** a sandbox transaction (no poll URL, sandbox mode active), **When** the poll endpoint is called, **Then** a synthetic `paid` response is returned and the subscription is activated.

---

### Edge Cases

- What happens when the webhook arrives before the browser returns to the poll endpoint? The webhook marks the transaction `paid`; the subsequent poll should detect it is already paid and skip re-activation.
- What happens when Paynow sends a webhook with an unknown reference? The system responds 200 (to prevent retries) but makes no state changes.
- What happens when `paynow_reference` is absent in the webhook payload? The field should remain null; no error should be thrown.
- What happens when the poll URL stored in the database is empty for a non-sandbox transaction? The poll endpoint returns `paid: false` with status `no-poll-url`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST correctly initialize the Paynow SDK with integration ID, integration key, return URL, and result URL in the documented parameter order.
- **FR-002**: System MUST convert the payment amount from integer cents to a two-decimal-place decimal string before passing it to the SDK (e.g., 5000 cents → "50.00").
- **FR-003**: System MUST save the `paynow_reference` returned in the webhook POST body (`paynowreference` field) to the transaction record when a `paid` webhook is received.
- **FR-004**: System MUST verify incoming webhook hash using the exact algorithm expected by Paynow: SHA-512 hash of all non-hash field values concatenated, appended with the integration key (lowercased), then uppercased.
- **FR-005**: System MUST remove the unused `$receivedHash` parameter from `PaynowService::verifyHash()` or reconcile it so the method signature and implementation are consistent and non-misleading.
- **FR-006**: System MUST remove or document the `$currency` parameter in `PaynowService::initiate()` since the Paynow PHP SDK does not accept a per-request currency; the currency is configured on the merchant portal.
- **FR-007**: System MUST handle the case where `$response->success()` is false in `initiate()` by calling `$response->errors()` (which exists via the `CanFail` trait) and returning a user-readable error message.
- **FR-008**: System MUST ensure the sandbox mode fallback is only active when Paynow credentials are empty or set to known placeholder strings, and must never silently bypass the live gateway when valid credentials are present.
- **FR-009**: System MUST NOT re-activate an already-active subscription when a duplicate webhook or duplicate poll call is received for a transaction already in `paid` status.
- **FR-010**: System MUST store the raw webhook payload and mark `paynow_hash_verified = 1` only after the hash has passed verification — not for every webhook that arrives.

### Key Entities

- **SubscriptionTransaction**: Represents a single payment attempt for a subscription. Tracks our reference, Paynow's reference, poll URL, status (initiated → paid/failed/cancelled), raw webhook payload, and hash verification flag.
- **SchoolSubscription**: Represents a subscription period for a tenant. Activated when the associated transaction reaches `paid` status; holds start and expiry dates computed from billing cycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of webhook callbacks with a valid Paynow-signed hash result in the correct transaction and subscription state transition (paid, failed, or cancelled) — verifiable by running a signed simulation of each status.
- **SC-002**: 0% of webhook callbacks with an invalid or tampered hash result in any database state change.
- **SC-003**: A subscription is activated exactly once per `paid` transaction regardless of how many webhook deliveries or poll calls arrive for that transaction.
- **SC-004**: The `paynow_reference` field is populated on every transaction that reaches `paid` status, enabling full reconciliation with Paynow reports.
- **SC-005**: Sandbox mode activates only when credentials are absent or are placeholder strings; live credentials always route to the real Paynow gateway.

## Assumptions

- The Paynow PHP SDK (`paynow/php-sdk`) remains the authoritative implementation layer; the integration must use the SDK's classes rather than raw HTTP calls.
- The Paynow merchant portal is configured for USD; the `$currency` parameter in the current service is not used by the SDK and is decorative only.
- The `paynow_reference` field already exists on the `subscription_transactions` table (added in the current billing system migration).
- Mobile express checkout (`sendMobile`) is out of scope for this refactor; only web payment flow is addressed.
- The backend environment has already run `composer install` and the `paynow/php-sdk` package is present in `vendor/`.
- All callback/webhook URLs are correctly set in the `.env` file for any deployed environment.
