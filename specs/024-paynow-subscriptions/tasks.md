# Tasks: Paynow Subscription Packages

**Input**: Design documents from `/specs/024-paynow-subscriptions/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create all new files and configure env before any feature code is written.

- [ ] T001 Add Paynow env variables to `backend/.env.example`: `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PAYNOW_RESULT_URL`, `PAYNOW_RETURN_URL`, `SUBSCRIPTION_CURRENCY`
- [ ] T002 [P] Create stub file `backend/app/Services/PaynowService.php` (namespace + empty class)
- [ ] T003 [P] Create stub file `backend/app/Controllers/Api/SubscriptionController.php` (extends BaseApiController, empty methods: `plans`, `current`, `history`, `activateFree`, `initiate`, `webhook`)
- [ ] T004 [P] Create stub file `backend/app/Models/SubscriptionPlanModel.php` (extend Model, set `$table = 'subscription_plans'`)
- [ ] T005 [P] Create stub file `backend/app/Models/SchoolSubscriptionModel.php` (extend Model, set `$table = 'school_subscriptions'`)
- [ ] T006 [P] Create stub file `backend/app/Models/SubscriptionTransactionModel.php` (extend Model, set `$table = 'subscription_payment_transactions'`)
- [ ] T007 [P] Create stub file `frontend/src/hooks/useSubscription.ts` (export empty hook)
- [ ] T008 [P] Create stub file `frontend/src/pages/Billing.tsx` (export empty page component)
- [ ] T009 [P] Create stub directory and files `frontend/src/components/subscription/PlanCard.tsx`, `PlanSelector.tsx`, `SubscriptionStatusBanner.tsx` (empty exports)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, routing, and filter configuration that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 Create migration `backend/app/Database/Migrations/2026-04-10-100000_Create_subscription_plans_table.php` — columns: `id VARCHAR(50) PK`, `name`, `description`, `max_students INT UNSIGNED NULL`, `monthly_price_cents INT UNSIGNED DEFAULT 0`, `annual_price_cents INT UNSIGNED DEFAULT 0`, `currency VARCHAR(3) DEFAULT 'USD'`, `is_active TINYINT(1) DEFAULT 1`, `sort_order INT DEFAULT 0`, `created_at`, `updated_at`; index on `is_active`
- [ ] T011 Create migration `backend/app/Database/Migrations/2026-04-10-110000_Create_school_subscriptions_table.php` — columns: `id VARCHAR(36) PK`, `tenant_id VARCHAR(36) NOT NULL`, `plan_id VARCHAR(50) NOT NULL`, `billing_cycle ENUM('monthly','annual') NOT NULL`, `status ENUM('pending','active','expired','superseded','cancelled') NOT NULL DEFAULT 'pending'`, `starts_at DATETIME NOT NULL`, `expires_at DATETIME NULL`, `amount_paid_cents INT UNSIGNED DEFAULT 0`, `currency VARCHAR(3) DEFAULT 'USD'`, `activated_at DATETIME NULL`, `cancelled_at DATETIME NULL`, `created_at`, `updated_at`; indexes on `(tenant_id, status)` and `expires_at`; FKs to `tenants.id` and `subscription_plans.id`
- [ ] T012 Create migration `backend/app/Database/Migrations/2026-04-10-120000_Create_subscription_transactions_table.php` — columns: `id VARCHAR(36) PK`, `tenant_id VARCHAR(36) NOT NULL`, `subscription_id VARCHAR(36) NOT NULL`, `paynow_reference VARCHAR(100) NULL`, `paynow_poll_url TEXT NULL`, `our_reference VARCHAR(100) NOT NULL UNIQUE`, `amount_cents INT UNSIGNED NOT NULL`, `currency VARCHAR(3) DEFAULT 'USD'`, `status ENUM('initiated','paid','failed','cancelled','disputed') DEFAULT 'initiated'`, `paynow_status_raw VARCHAR(50) NULL`, `paynow_hash_verified TINYINT(1) DEFAULT 0`, `webhook_payload JSON NULL`, `initiated_at DATETIME NOT NULL`, `completed_at DATETIME NULL`, `created_at`, `updated_at`; indexes on `(tenant_id, status)`, `our_reference` (unique), `paynow_reference`
- [ ] T013 Create database seeder `backend/app/Database/Seeds/SubscriptionPlanSeeder.php` — insert the four plan rows (Free/Standard/Advanced/Enterprise) per seed data in `data-model.md`; add to `CompleteDatabaseSeeder` run list
- [ ] T014 Register all subscription routes in `backend/app/Config/Routes.php` inside the existing `api` group: `GET subscription/plans`, `GET subscription/current`, `GET subscription/history`, `POST subscription/activate-free`, `POST subscription/initiate`; register the public webhook route `POST api/subscription/webhook` outside the JWT-filtered group
- [ ] T015 Exclude the webhook route from JWT auth filter in `backend/app/Config/Filters.php` — add `'except' => ['api/subscription/webhook']` to the `auth` filter's `before` configuration
- [ ] T016 Implement `SubscriptionPlanModel` in `backend/app/Models/SubscriptionPlanModel.php` — `$allowedFields`, `$useTimestamps = true`, method `getActivePlans(): array` (where `is_active = 1` ordered by `sort_order`)
- [ ] T017 Implement `SchoolSubscriptionModel` in `backend/app/Models/SchoolSubscriptionModel.php` — `$allowedFields`, `$useTimestamps = true`; methods: `getActiveForTenant(string $tenantId): ?array`, `getLatestForTenant(string $tenantId): ?array`, `hasActiveSubscription(string $tenantId): bool`, `deactivateAllForTenant(string $tenantId, string $newStatus): void`
- [ ] T018 Implement `SubscriptionTransactionModel` in `backend/app/Models/SubscriptionTransactionModel.php` — `$allowedFields`, `$useTimestamps = true`; methods: `findByOurReference(string $ref): ?array`, `findByPaynowReference(string $ref): ?array`, `getForSubscription(string $subscriptionId): array`
- [ ] T019 Implement `PaynowService` in `backend/app/Services/PaynowService.php` — constructor reads `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PAYNOW_RESULT_URL`, `PAYNOW_RETURN_URL` from env; method `initiate(string $reference, int $amountCents, string $currency, string $email): array` — posts to `https://www.paynow.co.zw/interface/initiatetransaction` via CI4 `CURLRequest`, returns `['success' => bool, 'redirectUrl' => string, 'paynowReference' => string, 'error' => string]`; method `verifyHash(array $fields, string $receivedHash): bool` — recomputes MD5 hash per Paynow spec
- [ ] T020 Add Billing page route to `frontend/src/App.tsx` — import `Billing` from `./pages/Billing`, add `<ProtectedRoute>` wrapping the `/billing` path (roles: `admin`, `super_admin`)
- [ ] T021 Add subscription API methods to `frontend/src/api/api.ts` — `getSubscriptionPlans()`, `getCurrentSubscription()`, `getSubscriptionHistory()`, `activateFreeSubscription()`, `initiateSubscription(planId, billingCycle)` — all call `apiRequest` using the contract shapes from `contracts/subscription-api.md`

**Checkpoint**: Run `php spark migrate` and `php spark db:seed SubscriptionPlanSeeder`. Confirm four plan rows exist and all three tables are created. Confirm routes return 401 (JWT required) and webhook route returns 200 without a token.

---

## Phase 3: User Story 1 — School Selects and Activates a Subscription Plan (Priority: P1) 🎯 MVP

**Goal**: An admin can view all plans, see the recommended one, activate the Free plan with one click, or initiate a paid Paynow payment and have their subscription activated on successful payment.

**Independent Test**: Navigate to `/billing`, confirm plans are displayed with recommended highlighted; activate Free plan for a <50-student tenant; initiate a paid plan, simulate Paynow webhook callback, confirm subscription status changes to `active`.

### Implementation for User Story 1

- [ ] T022 [US1] Implement `SubscriptionController::plans()` in `backend/app/Controllers/Api/SubscriptionController.php` — call `SubscriptionPlanModel::getActivePlans()`, return success response with camelCase plan fields
- [ ] T023 [US1] Implement `SubscriptionController::current()` in `backend/app/Controllers/Api/SubscriptionController.php` — get `tenant_id` from JWT, call `SchoolSubscriptionModel::getActiveForTenant()`, fetch live student count via `TenantModel::getStudentCount()`, compute `recommendedPlanId` by comparing student count to plan `max_students`, return full current-subscription shape from contract
- [ ] T024 [US1] Implement `SubscriptionController::activateFree()` in `backend/app/Controllers/Api/SubscriptionController.php` — enforce role (`admin`/`super_admin`), check student count < 50, check no active subscription exists, insert `school_subscriptions` row with `status='active'`, `billing_cycle='monthly'`, `amount_paid_cents=0`, `expires_at=NULL`; return 201 with subscription ID
- [ ] T025 [US1] Implement `SubscriptionController::initiate()` in `backend/app/Controllers/Api/SubscriptionController.php` — enforce role, validate `planId` (not `free`, must exist) and `billingCycle`, compute `amountCents` from plan row, generate `ourReference` (`SUB-{tenantId}-{timestamp}`), insert pending `school_subscriptions` and `initiated` `subscription_payment_transactions` rows, call `PaynowService::initiate()`, return 201 with `redirectUrl` and IDs; on gateway error return 422
- [ ] T026 [US1] Implement `SubscriptionController::webhook()` in `backend/app/Controllers/Api/SubscriptionController.php` — parse `application/x-www-form-urlencoded` POST body, call `PaynowService::verifyHash()`, reject with plain-text `Invalid hash` (HTTP 400) if invalid, look up transaction by `our_reference`, skip silently if already `paid` (idempotent), on `status=Paid` update transaction to `paid`, set `completed_at`, update linked subscription to `active` with correct `starts_at`/`expires_at` (monthly = +1 month, annual = +12 months), set any prior `active` row to `superseded`; respond with plain-text `Received` (HTTP 200)
- [ ] T027 [P] [US1] Implement `PlanCard.tsx` in `frontend/src/components/subscription/PlanCard.tsx` — props: `plan`, `isRecommended`, `selectedCycle`, `onSelect`; display plan name, student limit, monthly and annual price toggle, highlight if recommended; use shadcn/ui `Card` and `Badge`
- [ ] T028 [P] [US1] Implement `PlanSelector.tsx` in `frontend/src/components/subscription/PlanSelector.tsx` — renders four `PlanCard` components in a grid, monthly/annual toggle at top, `onSubscribe(planId, billingCycle)` callback; show "Activate Free" button for Free plan and "Subscribe" for paid plans
- [ ] T029 [US1] Implement `useSubscription.ts` in `frontend/src/hooks/useSubscription.ts` — use React Query to call `api.getCurrentSubscription()` and `api.getSubscriptionPlans()`; expose: `subscription`, `plans`, `studentCount`, `recommendedPlanId`, `isExpired`, `isOverLimit`, `daysUntilExpiry`, `activateFree` mutation, `initiatePaidSubscription` mutation; handle redirect to Paynow `redirectUrl` on successful initiation
- [ ] T030 [US1] Implement `Billing.tsx` in `frontend/src/pages/Billing.tsx` — use `useSubscription` hook; show current subscription status card at top; render `PlanSelector` below; on Free plan selection call `activateFree`; on paid plan selection call `initiatePaidSubscription` then redirect to Paynow URL; show loading and error states with shadcn/ui `Alert`
- [ ] T031 [US1] Add "Billing" navigation link to sidebar/nav in `frontend/src/App.tsx` or the nav component — visible to `admin` and `super_admin` roles only

**Checkpoint**: Complete end-to-end happy path: admin visits `/billing`, activates Free plan (no payment), or initiates Standard monthly, completes sandbox payment, webhook fires, subscription shows `active`.

---

## Phase 4: User Story 2 — Annual Billing Discount Applied (Priority: P2)

**Goal**: Admin can toggle to annual billing on any paid plan, see the discounted annual price, and the correct amount is charged and recorded with a 12-month expiry.

**Independent Test**: Select Standard plan, toggle to annual billing, confirm price shows annual amount; complete payment via Paynow sandbox; confirm subscription `expires_at` is 12 months from `starts_at` and `amount_paid_cents` matches `annual_price_cents`.

### Implementation for User Story 2

- [ ] T032 [US2] Verify `SubscriptionController::initiate()` (T025) correctly resolves `amountCents` from `annual_price_cents` when `billingCycle='annual'` — add explicit branch in price-resolution logic and confirm `expires_at` = `starts_at + 12 months` in the webhook handler (T026)
- [ ] T033 [US2] Update `PlanSelector.tsx` in `frontend/src/components/subscription/PlanSelector.tsx` — ensure the monthly/annual toggle visually updates all four `PlanCard` prices simultaneously and the toggle state is passed correctly to `onSubscribe`; display the annual saving (difference from 12× monthly) on each paid card when annual is selected
- [ ] T034 [US2] Update `useSubscription.ts` in `frontend/src/hooks/useSubscription.ts` — expose `selectedCycle` state and `setSelectedCycle` so `Billing.tsx` can pass the correct billing cycle to `initiatePaidSubscription`

**Checkpoint**: Toggle annual billing on `/billing`, initiate payment, simulate webhook with annual amount, confirm 12-month expiry stored correctly.

---

## Phase 5: User Story 3 — Subscription Status Enforced on System Access (Priority: P3)

**Goal**: Expired subscriptions and exceeded student limits are detected and surfaced to the admin. The backend blocks new student creation when the limit is reached.

**Independent Test**: (a) Expire a subscription manually in the DB → reload app → expiry banner appears; (b) Set student count to `max_students` for the active plan → attempt to add a student via API → receive 403 with upgrade message.

### Implementation for User Story 3

- [ ] T035 [P] [US3] Add subscription limit check to `StudentController::create()` in `backend/app/Controllers/Api/StudentController.php` — before inserting: get active subscription for tenant, get active student count, if `max_students !== null && activeCount >= max_students` return 403 with message "Student limit reached for your current plan. Please upgrade to add more students."
- [ ] T036 [P] [US3] Add subscription limit check to `StudentController::bulkChangeStatus()` in `backend/app/Controllers/Api/StudentController.php` — when status changes to `active`, check that resulting active count would not exceed plan limit; return 403 with upgrade message if exceeded
- [ ] T037 [US3] Implement `SubscriptionStatusBanner.tsx` in `frontend/src/components/subscription/SubscriptionStatusBanner.tsx` — use `useSubscription` hook; render a sticky `Alert` banner when `isExpired === true` (show "Your subscription has expired — Renew now") or `isOverLimit === true` (show "You've reached your plan's student limit — Upgrade"); include a link to `/billing`; render nothing if subscription is healthy
- [ ] T038 [US3] Mount `SubscriptionStatusBanner` in the app layout in `frontend/src/App.tsx` (or the main authenticated layout component) so it appears on all protected pages for `admin` and `super_admin` roles
- [ ] T039 [US3] Add 7-day expiry warning to `SubscriptionStatusBanner.tsx` — if `daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0` render a warning `Alert` (yellow) with "Your subscription expires in N days — Renew now"

**Checkpoint**: (a) Expire subscription in DB, confirm banner appears on Dashboard. (b) Hit student limit via API, confirm 403. (c) Set `expires_at` to 3 days from now, confirm warning banner.

---

## Phase 6: User Story 4 — Subscription Upgrade (Priority: P4)

**Goal**: An admin on a lower-tier plan can upgrade to a higher tier at any time. A new Paynow payment is initiated; on success the old subscription is superseded and the new plan takes effect immediately.

**Independent Test**: Activate a Standard plan, then initiate an upgrade to Advanced; complete sandbox payment; confirm old subscription status is `superseded`, new subscription status is `active` with Advanced plan.

### Implementation for User Story 4

- [ ] T040 [US4] Update `SubscriptionController::initiate()` in `backend/app/Controllers/Api/SubscriptionController.php` — allow initiation when an active subscription already exists (upgrade scenario); validate that requested plan's `sort_order` is strictly greater than current active plan's `sort_order` (downgrade blocked); remove the "no active subscription" guard that would block upgrades
- [ ] T041 [US4] Update `SubscriptionController::webhook()` in `backend/app/Controllers/Api/SubscriptionController.php` — confirm the existing `deactivateAllForTenant()` call (T026) sets the old active subscription to `superseded` before activating the new one; verify this works when old subscription is paid vs. when it's still in trial/free
- [ ] T042 [US4] Add upgrade affordance to `Billing.tsx` in `frontend/src/pages/Billing.tsx` — when a subscription is already active, show the current plan with an "Upgrade" button on higher-tier plan cards; disable (grey out) lower-tier plan cards with "Downgrade not available" tooltip; re-use `initiatePaidSubscription` from `useSubscription`
- [ ] T043 [US4] Update `useSubscription.ts` in `frontend/src/hooks/useSubscription.ts` — invalidate the `currentSubscription` query after a successful `initiatePaidSubscription` mutation so the UI refreshes on return from Paynow (trigger re-fetch on page focus or after a short polling check on the `/billing` return URL)

**Checkpoint**: Active Standard plan → click Upgrade to Advanced → Paynow sandbox → webhook → old row `superseded`, new row `active`. Confirm plan card for Standard is disabled on the Billing page after upgrade.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final wiring, UX consistency, and cleanup across all user stories.

- [ ] T044 [P] Add `GET /api/subscription/history` implementation to `SubscriptionController::history()` in `backend/app/Controllers/Api/SubscriptionController.php` — fetch all `school_subscriptions` rows for tenant (all statuses) and all linked `subscription_payment_transactions` rows; return history shape from contract
- [ ] T045 [P] Add subscription history section to `Billing.tsx` in `frontend/src/pages/Billing.tsx` — below `PlanSelector`, show a table of past subscription periods and payment transactions using `api.getSubscriptionHistory()`; show "No history yet" if empty
- [ ] T046 [P] Ensure all new backend model queries pass `tenant_id` filter sourced from JWT (Constitution Principle I audit) — review all methods in `SchoolSubscriptionModel`, `SubscriptionTransactionModel`, and `SubscriptionController`
- [ ] T047 [P] Ensure `SubscriptionController` enforces role checks (`admin`/`super_admin`) on all mutating routes (`activate-free`, `initiate`) and read routes allow `bursar` for `history` (Constitution Principle III audit)
- [ ] T048 Run quickstart validation per `quickstart.md` — apply migrations, seed plans, smoke-test all six API endpoints, verify enforcement, verify webhook simulation
- [ ] T049 Update `frontend/src/api/api.ts` TypeScript interfaces — add `SubscriptionPlan`, `SchoolSubscription`, `SubscriptionTransaction`, `CurrentSubscriptionResponse` interface types matching the contract shapes
- [ ] T050 [P] Add `Billing` to the frontend sidebar navigation with an appropriate icon (e.g., Lucide `CreditCard`) visible only to `admin` and `super_admin` roles

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **User Stories (Phases 3–6)**: All depend on Phase 2 completion
  - Phase 3 (US1) → MVP; can be done in isolation
  - Phase 4 (US2) builds on T025/T026 from Phase 3 (billing cycle logic)
  - Phase 5 (US3) builds on T022/T023 from Phase 3 (current subscription data)
  - Phase 6 (US4) builds on T025/T026/T030 from Phase 3 (initiate + UI)
- **Polish (Phase 7)**: Depends on Phases 3–6 complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 foundation — no other story dependency
- **US2 (P2)**: Depends on US1 (T025, T026 billing cycle branches already exist; US2 verifies/extends them)
- **US3 (P3)**: Depends on US1 (T022/T023 provide active subscription data for enforcement)
- **US4 (P4)**: Depends on US1 (T025, T026, T030 provide the initiate + redirect + webhook flow)

### Within Each User Story

- Backend models (Phase 2) before controllers
- Controller methods before frontend hooks
- Hooks before page components
- Core happy path before edge case/upgrade handling

### Parallel Opportunities

- T002–T009 (all stubs): fully parallel
- T010–T013 (migrations + seeder): T010–T012 parallel; T013 after T010
- T014–T015 (routes + filters): parallel to migrations
- T016–T019 (models + PaynowService): parallel after T010–T012
- T027, T028 (PlanCard, PlanSelector): parallel within US1
- T035, T036 (student limit checks): parallel within US3

---

## Parallel Example: User Story 1

```bash
# Backend — launch together (different files):
T022: SubscriptionController::plans()
T023: SubscriptionController::current()
T024: SubscriptionController::activateFree()

# Frontend — launch together (different files):
T027: PlanCard.tsx
T028: PlanSelector.tsx

# Then sequentially (dependencies):
T025: SubscriptionController::initiate()   (needs T022–T024 patterns established)
T026: SubscriptionController::webhook()    (needs T025 transaction creation)
T029: useSubscription.ts                   (needs T021 API methods)
T030: Billing.tsx                          (needs T027–T029)
T031: Nav link                             (needs T030)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T009)
2. Complete Phase 2: Foundational (T010–T021) — run migrations, seed plans
3. Complete Phase 3: User Story 1 (T022–T031)
4. **STOP and VALIDATE**: Activate Free plan, initiate Standard monthly, simulate webhook, confirm active subscription
5. Demo and deploy if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready
2. Phase 3 → Free plan + Paynow initiation + webhook activation working (MVP)
3. Phase 4 → Annual billing correctly priced and stored
4. Phase 5 → Enforcement banners + backend student limit guards
5. Phase 6 → Upgrade flow
6. Phase 7 → History, audit, nav, polish

### Parallel Team Strategy

With two developers:
- **Dev A**: Phases 2–3 backend (T010–T026)
- **Dev B**: Phases 1 + 3 frontend (T001–T009, T027–T031, T021)
- Sync point: Phase 2 backend complete before Dev B connects frontend to real API

---

## Notes

- [P] tasks = different files, no shared state dependencies — safe to parallelize
- [Story] label maps each task to a user story for traceability
- All backend tasks must pass Constitution Check (Principles I, II, III, IV)
- Webhook security: never skip hash verification — reject with 400, log attempt
- Prices are placeholder values; confirm with product owner before go-live
- `expires_at` for the Free plan MUST be NULL — enforce in `activateFree()` and `webhook()` if Free plan is ever paid-activated
- Commit after each phase checkpoint
