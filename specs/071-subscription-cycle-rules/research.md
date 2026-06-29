# Research: Subscription Billing Cycle Transition Rules

## Decision: Centralize subscription transition validation in backend policy logic

**Decision**: Add or extend backend-side subscription policy validation so all subscription mutation paths evaluate the same billing-cycle transition rules before creating calculations, subscriptions, transactions, or platform overrides.

**Rationale**: The rule must be authoritative and consistent across tenant-facing endpoints (`/api/subscription/*`), Paynow-backed initiation, proration flows, and platform-admin manual assignment/change operations. Frontend hiding of monthly options is useful UX but insufficient for security and consistency.

**Alternatives considered**:

- Frontend-only blocking: rejected because API consumers could still submit annual → monthly requests.
- Duplicate validation in each controller method: rejected because it risks drift between tenant and platform flows.
- Database constraint only: rejected because transition validity depends on previous active subscription state and target operation semantics.

## Decision: Treat annual → monthly as permanently blocked for active annual subscriptions

**Decision**: When a tenant has an active annual subscription, attempts to create a monthly subscription, calculate a monthly proration, or platform-change the active subscription to monthly must be rejected with a stable error code such as `ANNUAL_TO_MONTHLY_BLOCKED`.

**Rationale**: This directly implements the business requirement: annual commitments must not be converted back to monthly because doing so creates revenue predictability issues and refund/credit complexity.

**Alternatives considered**:

- Allow monthly at next renewal: rejected because the requested rule says once on annual, tenants cannot switch back to monthly.
- Allow platform admins to override silently: rejected because this undermines the billing policy; if an exception is ever required, it should be a separate explicit governance feature.
- Convert annual to monthly with credits: rejected because the feature explicitly avoids unused annual-time credits/refunds.

## Decision: Preserve renewal date for annual in-cycle tier changes

**Decision**: Annual plan upgrades and downgrades must preserve the existing active annual subscription `expires_at` value. The new active subscription created by a tier change should inherit the current annual cycle end date.

**Rationale**: The renewal date is the customer’s annual commitment boundary. Changing it during tier changes would effectively create a new billing cycle and make proration/audit harder to explain.

**Alternatives considered**:

- Reset renewal to 12 months from upgrade date: rejected because it breaks the original annual cycle and contradicts the spec.
- Extend renewal by unused value: rejected because it introduces credit/refund-like complexity.

## Decision: Use price-difference proration for annual upgrades

**Decision**: For annual upgrades, calculate the amount due as the difference between target annual price and current annual price multiplied by remaining days over days in the current annual cycle, rounded to cents.

**Rationale**: This matches the requested behavior: charge only the price difference for the remaining subscription period. Existing `ProrationService` already calculates original unused value, target prorated value, and net amount, which is equivalent to price-difference proration when billing cycle and period are unchanged.

**Alternatives considered**:

- Charge full annual target price: rejected because it overcharges during an active annual period.
- Charge monthly delta times remaining calendar months: rejected because exact day-based calculation is more accurate and already supported by the existing service.

## Decision: Annual downgrades are allowed but do not produce refunds

**Decision**: Annual tier downgrades should be allowed only within the annual billing cycle, preserve the renewal date, and avoid cash refunds. Implementation should choose one explicit policy during tasks: immediate downgrade with no refund/credit, or scheduled downgrade at renewal. The preferred MVP is scheduled downgrade at renewal if existing UI can represent pending changes; otherwise immediate downgrade with no refund and zero charge is acceptable if clearly disclosed.

**Rationale**: The specification allows downgrades but rejects refund complexity. Scheduling at renewal best protects customer value, while immediate no-refund downgrade is simpler but can feel punitive.

**Alternatives considered**:

- Create subscription credits for downgrades: rejected for this feature because the user explicitly wants to avoid credits/refunds for unused annual time.
- Block downgrades entirely: rejected because the spec says tenants can upgrade or downgrade tiers while annual.

## Decision: Monthly → annual transition uses standard annual purchase flow

**Decision**: A tenant on monthly billing may initiate an annual subscription at any time. The system should permit `billingCycle=annual` from a monthly active subscription and activate the annual plan once payment succeeds. The annual renewal date should be based on annual activation/period rules, not on the old monthly renewal date, unless a later clarification explicitly requires monthly unused-time credit.

**Rationale**: The core requirement is to encourage monthly-to-annual upgrades. The spec mentions "any necessary adjustments" but the strict user input emphasized annual upgrade flexibility and avoided annual refunds. Existing payment/subscription initiation already handles annual purchases and activation.

**Alternatives considered**:

- Credit unused monthly days toward annual: deferred because it introduces credit behavior not present in the original request and should be clarified before implementation if required.
- Force users to wait until monthly renewal: rejected because the feature requires monthly → annual at any time.

## Decision: Keep student financial ledger isolated from SaaS subscription billing

**Decision**: Do not use student `charges`, `payments`, or `LedgerService` for subscription plan charges. Continue using subscription transaction/invoice tables and Paynow integration.

**Rationale**: SchoolLedger has two separate billing domains: school fees/transport ledger for students and SaaS tenant subscription billing. Mixing them would violate existing architecture and risk corrupting student balance behavior.

**Alternatives considered**:

- Record subscription charges in student ledger tables: rejected because subscription billing is tenant-level platform revenue, not a student account charge.

## Decision: Curl validation must cover tenant and platform paths

**Decision**: Post-implementation validation must include curl tests for tenant-facing proration/initiation, annual-to-monthly blocking, successful annual tier upgrade preserving `expires_at`, payment failure/no-activation behavior where feasible, and platform admin manual subscription assignment/change safeguards.

**Rationale**: The constitution requires endpoint-level curl validation after implementation, including happy paths, error paths, and tenant isolation for tenant-owned data.

**Alternatives considered**:

- PHPUnit-only validation: rejected because constitution requires curl URL requests after implementation.
