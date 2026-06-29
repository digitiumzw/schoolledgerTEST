# Tasks: Billing Plans Management

**Input**: Design documents from `/specs/026-billing-plans-management/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

## Path Conventions

- **Backend**: `backend/app/` (CodeIgniter 4)
- **Frontend**: `frontend/src/` (React 18 + TypeScript)
- **Migrations**: `backend/app/Database/Migrations/`
- **Seeds**: `backend/app/Database/Seeds/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema, new models, services scaffolding, and plan data migration. Must complete before any user story work begins.

- [x] T001 Create migration `backend/app/Database/Migrations/2026-04-12-100000_Create_subscription_invoices_table.php` — fields: id, tenant_id (FK→tenants), subscription_id (FK→school_subscriptions), transaction_id (FK→subscription_payment_transactions UNIQUE), invoice_number (UNIQUE), school_name, plan_name, billing_cycle ENUM, amount_cents, currency, issued_at, pdf_path nullable, created_at, updated_at; indexes on tenant_id and transaction_id
- [x] T002 Create migration `backend/app/Database/Migrations/2026-04-12-110000_Create_billing_events_table.php` — fields: id, tenant_id (FK→tenants), event_type ENUM('payment_confirmed','plan_activated','plan_upgraded','plan_downgraded','subscription_renewed','subscription_expired'), plan_name nullable, billing_cycle ENUM nullable, amount_cents nullable, currency nullable, subscription_id nullable, transaction_id nullable, occurred_at, created_at, updated_at; composite index on (tenant_id, occurred_at DESC)
- [x] T003 Create data migration `backend/app/Database/Migrations/2026-04-12-120000_Deactivate_free_plan.php` — (1) set is_active=0 for id='free'; (2) UPDATE school_subscriptions SET plan_id='starter' WHERE plan_id='standard'; (3) UPDATE subscription_plans SET id='starter', name='Starter' WHERE id='standard'; (4) UPDATE school_subscriptions SET plan_id='growth' WHERE plan_id='advanced'; (5) UPDATE subscription_plans SET id='growth', name='Growth' WHERE id='advanced'; include down() that reverses all changes
- [x] T004 Update `backend/app/Database/Seeds/SubscriptionPlanSeeder.php` — replace free plan entry with is_active=0 guard; rename 'standard'→'starter' (name='Starter'), 'advanced'→'growth' (name='Growth'); ensure upsert logic handles both old and new IDs gracefully
- [x] T005 [P] Create `backend/app/Models/SubscriptionInvoiceModel.php` — table: subscription_invoices; primaryKey: id; useAutoIncrement: false; allowedFields: all columns from migration; add method `getForTenant(string $tenantId): array` (order by issued_at DESC); add method `findByTransactionId(string $txId): ?array`
- [x] T006 [P] Create `backend/app/Models/BillingEventModel.php` — table: billing_events; primaryKey: id; useAutoIncrement: false; allowedFields: all columns from migration; add method `getPaginatedForTenant(string $tenantId, int $page, int $perPage): array` returning ['events'=>[], 'total'=>0]; filter by allowlisted event_type values; order by occurred_at DESC
- [x] T007 Install Dompdf: add `dompdf/dompdf ^2.0` to `backend/composer.json` and run `composer require dompdf/dompdf "^2.0"` in `backend/`
- [x] T008 [P] Create `backend/app/Services/InvoiceService.php` — method `createInvoice(array $subscription, array $transaction, string $tenantName): array` that (1) generates invoice_number as `INV-{shortTenantId}-{YYYYMM}-{seq}`, (2) inserts into subscription_invoices, (3) returns the created invoice record; method `generatePdf(array $invoice): string` that renders an HTML invoice template via Dompdf, saves to `WRITEPATH . 'invoices/' . $invoice['tenant_id'] . '/' . $invoice['id'] . '.pdf'`, updates pdf_path column, and returns absolute file path
- [x] T009 [P] Create `backend/app/Services/BillingEventService.php` — method `record(string $tenantId, string $eventType, array $context = []): void` that inserts a row into billing_events; $context may include plan_name, billing_cycle, amount_cents, currency, subscription_id, transaction_id; occurred_at set to now()
- [x] T010 Ensure `backend/writable/invoices/` directory exists and is writable (add to .gitignore); document in quickstart.md

---

**Checkpoint**: Schema migrated, models created, services scaffolded. Run `php spark migrate` to verify no errors before proceeding.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update `SubscriptionController` core helpers and routing to support the new plan IDs and remove the free plan path. Required by all user story phases.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T011 Update `resolveRecommendedPlan()` in `backend/app/Controllers/Api/SubscriptionController.php` — remove the `< 50 → 'free'` branch; replace `'standard'` with `'starter'` and `'advanced'` with `'growth'`; new logic: `< 250 → 'starter'`, `< 350 → 'growth'`, else `'enterprise'`
- [x] T012 Remove `POST activate-free` route from `backend/app/Config/Routes.php` — delete the `$routes->post('activate-free', ...)` line inside the subscription group
- [x] T013 Delete `activateFree()` method from `backend/app/Controllers/Api/SubscriptionController.php`
- [x] T014 Add new routes to the subscription group in `backend/app/Config/Routes.php`: `GET invoices` → `SubscriptionController::invoices`; `GET invoices/(:segment)/download` → `SubscriptionController::downloadInvoice/$1`; `GET events` → `SubscriptionController::billingEvents`
- [x] T015 Inject `SubscriptionInvoiceModel`, `BillingEventModel`, `InvoiceService`, and `BillingEventService` into `SubscriptionController` constructor in `backend/app/Controllers/Api/SubscriptionController.php`

**Checkpoint**: Routes registered, controller wired. `GET /api/subscription/plans` should now return only 3 plans (no free).

---

## Phase 3: User Story 1 — View Current Plan and Billing Overview (Priority: P1) 🎯 MVP

**Goal**: School administrator sees live plan overview — name, status (Active/Expiring Soon/Expired), billing cycle, renewal date, student count — immediately on opening the billing section.

**Independent Test**: Log in as a school admin with an active Starter plan. Navigate to `/billing`. Confirm: plan name is "Starter", status badge shows "Active", billing cycle and renewal date are displayed correctly. Expire the subscription manually in the DB and reload — confirm "Expired" status and CTA to renew appears.

### Implementation for User Story 1

- [x] T016 [P] [US1] Update `frontend/src/api/api.ts` — in `SubscriptionPlan` interface change `id` comment to reflect new IDs (starter/growth/enterprise); remove `activateFreeSubscription` function; update `getCurrentSubscription` to ensure `recommendedPlanId` type stays `string`
- [x] T017 [P] [US1] Update `frontend/src/components/subscription/PlanSelector.tsx` — remove the `plans.filter(p => p.id !== 'free')` guard (all returned plans are now paid); update skeleton grid count from 4 to 3 (`sm:grid-cols-3` instead of `lg:grid-cols-4`)
- [x] T018 [US1] Update `frontend/src/pages/Billing.tsx` — remove `activateFree` from `useSubscription` destructure; remove the `handleSubscribe` free-plan branch (`if (planId === 'free') { activateFree(); }`); remove EcoCash panel's `plans.filter(p => p.id !== 'free')` guard; change skeleton grid hint from 4 to 3 columns; ensure the "Current Subscription" card renders plan name, status badge, billing cycle, renewal date, and student count (no layout change needed — already present)
- [x] T019 [US1] Update `frontend/src/hooks/useSubscription.ts` — remove `activateFree` mutation and all references to the free plan activation endpoint

**Checkpoint**: Navigate to `/billing` — 3 plan cards visible, current plan card shows correct data, no free plan reference anywhere.

---

## Phase 4: User Story 2 — Upgrade or Downgrade Subscription Plan (Priority: P2)

**Goal**: School administrator can change plan in either direction. Upgrade proceeds directly to payment. Downgrade is blocked with a clear message if student count exceeds the target plan limit.

**Independent Test**: (a) Upgrade: activate Starter plan, click Change Plan, select Growth, complete Paynow sandbox payment — confirm Growth is now the active plan. (b) Downgrade blocked: activate Growth plan with 280 students, attempt to downgrade to Starter (limit 249) — confirm HTTP 422 with downgrade_blocked error and student count shown in UI. (c) Downgrade allowed: reduce student count below 249, retry — confirm downgrade payment succeeds and Starter is now active.

### Implementation for User Story 2

- [x] T020 [US2] Update `initiate()` in `backend/app/Controllers/Api/SubscriptionController.php` — replace the hard-rejection of same/lower sort_order with downgrade detection: if `$targetPlan['sort_order'] < $currentPlan['sort_order']` fetch `$studentCount = $tenantModel->getStudentCount($tenantId)`; if `$studentCount > $targetPlan['max_students']` (and max_students not null) return `$this->error('Downgrade blocked: student count exceeds target plan limit.', 422, ['downgrade_blocked' => true, 'studentCount' => $studentCount, 'planLimit' => (int)$targetPlan['max_students']])` ; otherwise allow the payment initiation to continue
- [x] T021 [US2] Apply the same downgrade logic update to `initiateEcocash()` in `backend/app/Controllers/Api/SubscriptionController.php` — mirror T020 exactly for the EcoCash path
- [x] T022 [P] [US2] Update `frontend/src/api/api.ts` — extend `initiateSubscription` and `initiateEcocashSubscription` error handling to surface new `downgrade_blocked`, `studentCount`, `planLimit` fields from 422 response; add `DowngradeBlockedError` interface `{ downgrade_blocked: boolean; studentCount: number; planLimit: number }`
- [x] T023 [US2] Update `frontend/src/hooks/useSubscription.ts` — in the `initiatePaidSubscription` mutation's `onError` handler, detect `errors.downgrade_blocked === true` and set a dedicated `downgradeBlockedState` with `{ studentCount, planLimit }`; expose `downgradeBlockedState` and `clearDowngradeBlocked` from the hook
- [x] T024 [US2] Update `frontend/src/components/subscription/PlanCard.tsx` — derive action label from current plan's `sortOrder` vs this plan's `sortOrder`: show "Current Plan" (disabled) when same, "Upgrade" when higher, "Downgrade" when lower; apply distinct styling for downgrade button (outline/secondary variant) vs upgrade (primary)
- [x] T025 [US2] Update `frontend/src/pages/Billing.tsx` — consume `downgradeBlockedState` from `useSubscription`; when set, render an inline Alert above the plan selector showing "Downgrade blocked — your school has {studentCount} students but the selected plan supports up to {planLimit}. Remove {studentCount - planLimit} student(s) to proceed."

**Checkpoint**: Upgrade and downgrade both work end-to-end. Blocked downgrade surfaces a readable message. Allowed downgrade activates the lower plan.

---

## Phase 5: User Story 3 — Download Invoices (Priority: P3)

**Goal**: School administrator sees a list of invoices and can download any as a PDF.

**Independent Test**: Complete at least one Paynow sandbox payment. Navigate to `/billing`. Confirm an invoice row appears with invoice number, plan name, billing cycle, amount, and date. Click Download — confirm a PDF file is downloaded with the correct content.

### Implementation for User Story 3

- [x] T026 [US3] Update `activateSubscription()` helper in `backend/app/Controllers/Api/SubscriptionController.php` — after activating the subscription, (1) fetch tenant name from `TenantModel`, (2) call `$this->invoiceService->createInvoice($sub, $tx, $tenantName)` to generate and persist the invoice record; ensure this runs in both the `webhook()` and `poll()` code paths
- [x] T027 [US3] Add `invoices()` method to `backend/app/Controllers/Api/SubscriptionController.php` — role guard: `admin`, `super_admin`, `bursar`; fetch `$this->invoiceModel->getForTenant($tenantId)`; format each record as `{ id, invoiceNumber, planName, billingCycle, amountCents, currency, issuedAt, downloadUrl: "/api/subscription/invoices/{id}/download" }`; return `$this->success(['invoices' => $formatted])`
- [x] T028 [US3] Add `downloadInvoice(string $invoiceId)` method to `backend/app/Controllers/Api/SubscriptionController.php` — role guard: `admin`, `super_admin`, `bursar`; fetch invoice by id; verify `tenant_id` matches JWT tenant (return 404 if not); if `pdf_path` is null or file missing, call `$this->invoiceService->generatePdf($invoice)`; stream file with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="invoice-{invoiceNumber}.pdf"` headers
- [x] T029 [P] [US3] Add `getInvoices` and `downloadInvoice` to `frontend/src/api/api.ts` — `getInvoices(): Promise<InvoiceListResponse>` calls `GET /subscription/invoices`; `downloadInvoice(invoiceId: string): Promise<Blob>` calls `GET /subscription/invoices/{id}/download` with `responseType: blob` (or fetch with `response.blob()`); add `SubscriptionInvoice` and `InvoiceListResponse` TypeScript interfaces
- [x] T030 [P] [US3] Create `frontend/src/components/subscription/InvoiceList.tsx` — table component accepting `invoices: SubscriptionInvoice[]`; columns: Date (issuedAt formatted), Invoice #, Plan, Billing Cycle, Amount, Download button; Download button triggers `api.downloadInvoice(id)` then creates a temporary `<a>` element to trigger browser download of the blob; show "No invoices yet" empty state
- [x] T031 [US3] Update `frontend/src/pages/Billing.tsx` — add `useQuery` for `['subscription-invoices']` calling `api.getInvoices`; replace the existing "Billing History" transactions table with two separate sections: "Invoices" (renders `<InvoiceList />`) and "Billing History" (now uses `<BillingHistoryList />` from Phase 6 — leave as placeholder skeleton until Phase 6 is done)

**Checkpoint**: At least one invoice appears after completing a sandbox payment. PDF downloads successfully with correct plan details.

---

## Phase 6: User Story 4 — View Condensed Billing History (Priority: P4)

**Goal**: Billing history shows only significant events (payments, activations, upgrades, downgrades, renewals, expirations), paginated at 20 per page, with no noise entries.

**Independent Test**: Perform a subscription activation and an upgrade. Navigate to `/billing`. Confirm the history shows exactly `payment_confirmed`, `plan_activated`, `plan_upgraded` (and `payment_confirmed` again for the upgrade). Confirm no "pending", "cancelled", or "superseded" rows appear.

### Implementation for User Story 6

- [x] T032 [US4] Update `activateSubscription()` helper in `backend/app/Controllers/Api/SubscriptionController.php` — determine event type: compare new plan's sort_order vs superseded plan's sort_order to choose `plan_activated` (no prior active), `plan_upgraded`, `plan_downgraded`, or `subscription_renewed` (same plan_id); call `$this->billingEventService->record($tenantId, 'payment_confirmed', [...])` first, then `$this->billingEventService->record($tenantId, $planEventType, [...])` with plan_name, billing_cycle, amount_cents, currency, subscription_id, transaction_id
- [x] T033 [US4] Add `billingEvents()` method to `backend/app/Controllers/Api/SubscriptionController.php` — role guard: `admin`, `super_admin`, `bursar`; parse `$page = max(1, (int)($this->request->getGet('page') ?? 1))` and `$perPage = min(50, max(1, (int)($this->request->getGet('perPage') ?? 20)))`; call `$this->billingEventModel->getPaginatedForTenant($tenantId, $page, $perPage)`; format events as `{ id, eventType, planName, billingCycle, amountCents, currency, occurredAt }`; return `$this->success(['events' => $formatted, 'total' => $total, 'page' => $page, 'perPage' => $perPage])`
- [x] T034 [US4] Implement `getPaginatedForTenant()` in `backend/app/Models/BillingEventModel.php` — query `WHERE tenant_id = ? ORDER BY occurred_at DESC LIMIT ? OFFSET ?`; also run a COUNT query for `total`; return `['events' => [...], 'total' => $count]`
- [x] T035 [P] [US4] Add `getBillingEvents` to `frontend/src/api/api.ts` — `getBillingEvents(page?: number, perPage?: number): Promise<BillingEventsResponse>` calls `GET /subscription/events?page={page}&perPage={perPage}`; add `BillingEvent` and `BillingEventsResponse` TypeScript interfaces
- [x] T036 [P] [US4] Create `frontend/src/components/subscription/BillingHistoryList.tsx` — accepts `events: BillingEvent[]`, `total: number`, `page: number`, `perPage: number`, `onPageChange: (page: number) => void`; renders a table with columns: Date, Event (human-readable label derived from eventType e.g. "Payment Confirmed", "Plan Upgraded"), Plan, Cycle, Amount; human-readable event label map: `payment_confirmed→"Payment Confirmed"`, `plan_activated→"Plan Activated"`, `plan_upgraded→"Plan Upgraded"`, `plan_downgraded→"Plan Downgraded"`, `subscription_renewed→"Subscription Renewed"`, `subscription_expired→"Subscription Expired"`; show pagination controls (Prev / Next or page numbers) when `total > perPage`; show "No billing history yet." empty state
- [x] T037 [US4] Update `frontend/src/pages/Billing.tsx` — replace the billing history `useQuery` from `api.getSubscriptionHistory` with `api.getBillingEvents(page, perPage)` using `useState` for `page`; wire `<BillingHistoryList />` component with data and `onPageChange`; remove the old transactions table render and the `SubscriptionHistoryResponse` import if no longer used

**Checkpoint**: Billing history shows only labelled significant events. Pagination controls appear when there are more than 20 events.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final wiring, edge cases, and validation across all stories.

- [x] T038 [P] Verify `backend/app/Config/Routes.php` — confirm `activate-free` route is removed and three new routes (`invoices`, `invoices/(:segment)/download`, `events`) are present inside the JWT-protected subscription group
- [x] T039 [P] Verify all new DB queries in `SubscriptionInvoiceModel`, `BillingEventModel`, `InvoiceService`, and `BillingEventService` filter by `tenant_id` sourced from the controller's `$this->getTenantId()` (Constitution Principle I compliance check)
- [x] T040 Add invoice PDF HTML template — create `backend/app/Views/invoices/invoice_template.php` with a clean single-page layout containing: SchoolLedger logo placeholder, school name, invoice number, plan name, billing cycle, amount, payment date, currency; used by `InvoiceService::generatePdf()`
- [x] T041 [P] Update `frontend/src/components/subscription/SubscriptionStatusBanner.tsx` — remove any reference to the free plan or `activate-free` endpoint if present
- [x] T042 [P] Update the EcoCash plan dropdown in `frontend/src/pages/Billing.tsx` — remove the `plans.filter(p => p.id !== 'free')` guard that was retained as a safeguard; now that the API never returns a free plan, this filter is dead code
- [x] T043 Run quickstart.md verification steps (§7a–§7e) and fix any failures found
- [x] T044 [P] Update `specs/026-billing-plans-management/checklists/requirements.md` — mark all items complete; add implementation note referencing key files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T005, T006, T008, T009 are parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user story phases
- **Phase 3 (US1)**: Depends on Phase 2; primarily frontend-only changes
- **Phase 4 (US2)**: Depends on Phase 2; T020–T021 are backend, T022–T025 are frontend — can overlap
- **Phase 5 (US3)**: Depends on Phase 1 (InvoiceService wired) and Phase 2; T026 depends on T008
- **Phase 6 (US4)**: Depends on Phase 1 (BillingEventService wired) and Phase 2; T032 depends on T009
- **Phase 7 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no US dependencies
- **US2 (P2)**: Starts after Phase 2 — no US dependencies; integrates with US1 UI
- **US3 (P3)**: Starts after Phase 1 + Phase 2 — T026 must run after T008 (InvoiceService exists)
- **US4 (P4)**: Starts after Phase 1 + Phase 2 — T032 must run after T009 (BillingEventService exists)

### Within Each Phase

- Models before services (T005/T006 before T008/T009)
- Backend controller changes before frontend API layer changes
- API layer changes before hook/component changes
- Components before page integration

### Parallel Opportunities

- T005, T006, T008, T009 (Phase 1 — different files)
- T011, T012, T013 (Phase 2 — different methods/files)
- T016, T017 (Phase 3 — different files)
- T020, T022 (Phase 4 — backend vs frontend)
- T029, T030 (Phase 5 — api.ts vs component)
- T035, T036 (Phase 6 — api.ts vs component)
- T038, T039, T041, T042, T044 (Phase 7 — independent files)

---

## Parallel Example: Phase 1 Setup

```
Parallel batch A (independent files):
  T005 — SubscriptionInvoiceModel.php
  T006 — BillingEventModel.php
  T008 — InvoiceService.php
  T009 — BillingEventService.php

Sequential:
  T001 → T002 → T003 → T004 (migrations must run in order)
  T007 (composer install — run once)
  T010 (directory setup — run after T008)
```

## Parallel Example: Phase 5 (US3 — Download Invoices)

```
Parallel batch:
  T029 — api.ts additions (getInvoices, downloadInvoice, interfaces)
  T030 — InvoiceList.tsx component

Sequential (after T029 + T030):
  T026 — activateSubscription() invoice creation hook (backend)
  T027 — invoices() endpoint (backend)
  T028 — downloadInvoice() endpoint (backend)
  T031 — Billing.tsx integration (frontend, after T029 + T030)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T010)
2. Complete Phase 2: Foundational (T011–T015)
3. Complete Phase 3: US1 (T016–T019)
4. **STOP and VALIDATE**: 3 plan cards, no free plan, current plan card correct
5. Deploy/demo MVP

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready (free plan gone, new schema live)
2. Phase 3 (US1) → Billing overview works → Demo
3. Phase 4 (US2) → Upgrade/downgrade works → Demo
4. Phase 5 (US3) → Invoice download works → Demo
5. Phase 6 (US4) → Clean billing history → Demo
6. Phase 7 → Polish and sign-off

### Parallel Team Strategy

After Phase 1 + 2 complete:
- **Developer A**: Phase 3 (US1) + Phase 4 backend (T020–T021)
- **Developer B**: Phase 5 (US3) — invoice model, service, endpoint, frontend
- **Developer C**: Phase 6 (US4) — billing events model, service, endpoint, frontend

---

## Notes

- [P] tasks = different files, no blocking dependencies
- [USn] label maps each task to a specific user story for traceability
- Migrations must be applied in filename timestamp order — do not reorder
- `activateSubscription()` is the single activation point for both `webhook()` and `poll()` — T026 and T032 both modify this method; coordinate to avoid conflicts (T026 first, then T032)
- The `writable/invoices/` directory must be git-ignored and created in all environments
- Constitution Principle I: every new query must filter by `tenant_id` from JWT — verify in T039
- Constitution Principle IV: never edit existing migration files — T003 is a new file
