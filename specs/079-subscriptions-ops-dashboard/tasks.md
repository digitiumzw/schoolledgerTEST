# Tasks: Subscriptions Operations Dashboard

**Input**: Design documents from `/specs/079-subscriptions-ops-dashboard/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Endpoint-level curl validation MUST be run after implementation per Principle X.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Confirm baseline understanding of affected files before any changes.

- [ ] T001 Read and annotate current `backend/app/Controllers/Platform/FinanceController.php` to confirm `summary()` response shape and existing query patterns
- [ ] T002 [P] Read and annotate current `backend/app/Controllers/Platform/SubscriptionsController.php` to confirm `index()` query builder chain, current SELECT fields, and filter pattern
- [ ] T003 [P] Read and annotate current `frontend/src/admin/pages/Subscriptions.tsx` (full file) to confirm existing KPI structure, table columns, filter state, and mutation hooks
- [ ] T004 [P] Read `frontend/src/api/platform.ts` lines covering `getSubscriptions` and `getFinanceSummary` to confirm current param types

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend enrichments that both US1 and US2 frontend work depend on.

**⚠️ CRITICAL**: Both US1 KPI backend fields and US2 subscription row enrichments must be complete before frontend implementation begins.

- [ ] T005 [P] Extend `FinanceController::summary()` in `backend/app/Controllers/Platform/FinanceController.php` to add three new fields: `failed_payments_count` (COUNT of active subscriptions whose most recent `subscription_payment_transactions` row has `status='failed'`), `renewals_due_count` (COUNT of active subscriptions with `expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`), and `monthly_churn_count` (COUNT of subscriptions with `YEAR(cancelled_at)=YEAR(NOW()) AND MONTH(cancelled_at)=MONTH(NOW())`)
- [ ] T006 [P] Extend `SubscriptionsController::index()` in `backend/app/Controllers/Platform/SubscriptionsController.php` to add `sp.max_students` to the SELECT clause and a correlated subquery for `payment_status` (latest `subscription_payment_transactions.status` per subscription ordered by `created_at DESC LIMIT 1`)
- [ ] T007 Extend `SubscriptionsController::index()` in `backend/app/Controllers/Platform/SubscriptionsController.php` to add PHP post-processing that computes `alerts` array per row: `payment_failed` when `payment_status='failed'`; `expiring_soon` when `status='active'` and `expires_at` within 30 days; `trial_ending` when `status IN ('trialing','trial')`
- [ ] T008 Extend `SubscriptionsController::index()` in `backend/app/Controllers/Platform/SubscriptionsController.php` to accept and apply five new `GET` query parameters server-side: `q` (LIKE match on `t.name` and `t.email`), `plan_id` (exact match on `ss.plan_id`), `billing_cycle` (exact match on `ss.billing_cycle`), `payment_status` (match on correlated subquery result), and `expiring_soon` (adds `expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)` when truthy)
- [ ] T009 Run PHP lint on both modified backend files: `php -l backend/app/Controllers/Platform/FinanceController.php && php -l backend/app/Controllers/Platform/SubscriptionsController.php`

**Checkpoint**: Backend enrichments ready — frontend implementation can now begin.

---

## Phase 3: User Story 1 — Operational KPI Overview (Priority: P1) 🎯 MVP

**Goal**: Replace the four generic KPI cards with six operational metrics: Active Schools, MRR, Failed Payments, Renewals Due, Monthly Churn, and Pricing Plans — each with semantic icon, tooltip, and backend-sourced value. All monetary values display with clean formatting (`$25/mo` not `$25.0000/mo`).

**Independent Test**: Load `/platform-control-panel/subscriptions`, verify six KPI cards render with labels, icons, and non-NaN numeric values. Check that MRR shows no trailing zeros past meaningful precision.

### Validation for User Story 1

> **NOTE: Run curl validation AFTER implementation using curl URL requests.**

- [ ] T010 [US1] Curl: verify `GET /api/platform/finance/summary` returns HTTP 200 with all five original fields plus `failed_payments_count`, `renewals_due_count`, `monthly_churn_count` as non-negative integers — record results in `specs/079-subscriptions-ops-dashboard/quickstart.md`

### Implementation for User Story 1

- [ ] T011 [P] [US1] Extend `getFinanceSummary` return type in `frontend/src/api/platform.ts` to include `failed_payments_count: number`, `renewals_due_count: number`, and `monthly_churn_count: number` (add TypeScript interface or inline type extension)
- [ ] T012 [US1] Add `formatPrice` pure utility function inside `frontend/src/admin/pages/Subscriptions.tsx`: accepts `cents: number` and `cycle: 'mo' | 'yr'`, returns `'Free'` when `cents === 0`, otherwise `$X/mo` or `$X/yr` stripping trailing `.00` / `.0000` beyond meaningful precision
- [ ] T013 [US1] Replace the four existing `StatCard` KPI cards in `frontend/src/admin/pages/Subscriptions.tsx` with six cards: Active Schools (`Building2` icon, success tone, value from `financeSummary.active_tenants ?? financeSummary.active_count`), MRR (`TrendingUp` icon, primary tone, `$${formatPrice(mrr_cents,'mo')}` or direct MRR dollar value), Failed Payments (`AlertTriangle` icon, danger tone, `failed_payments_count`), Renewals Due (`CalendarClock` icon, warning tone, `renewals_due_count`), Monthly Churn (`TrendingDown` icon, danger tone, `monthly_churn_count`), Pricing Plans (`Layers` icon, info tone, plan count). Each card receives a `subtitle` tooltip-style description.
- [ ] T014 [US1] Add skeleton loading state for all six KPI cards in `frontend/src/admin/pages/Subscriptions.tsx` that renders when `financeQuery.isLoading` is true, using equal-height placeholder cards to prevent layout shift
- [ ] T015 [US1] Add graceful fallback for KPI cards in `frontend/src/admin/pages/Subscriptions.tsx`: when `financeQuery.isError` or a specific field is `undefined`, display `—` as the value and a muted `"unavailable"` subtitle instead of `0` or `NaN`
- [ ] T016 [US1] Apply clean price formatting via `formatPrice` to all plan price display sites in `frontend/src/admin/pages/Subscriptions.tsx`: plan cards (monthly and annual price lines), plan selector in the "Assign subscription" dialog, and the "Value" column in the subscriptions table

**Checkpoint**: US1 fully functional. Six KPI cards load from backend; prices display cleanly everywhere.

---

## Phase 4: User Story 2 — Search, Filter, and Actionable Rows (Priority: P1)

**Goal**: Add debounced search bar + four filter controls (plan, billing cycle, payment status, expiring soon toggle) to the subscriptions table; enrich each row with renewal date, payment health badge, seat limit, and alert badges; expose a three-dot action menu on every row regardless of status.

**Independent Test**: Type a school name in search, confirm only matching rows show. Open three-dot menu on a cancelled subscription, confirm at least one action is available.

### Validation for User Story 2

> **NOTE: Run curl validation AFTER implementation.**

- [ ] T017 [US2] Curl: verify `GET /api/platform/subscriptions?q=<term>` returns HTTP 200 with only tenant rows matching the search term — record in `specs/079-subscriptions-ops-dashboard/quickstart.md`
- [ ] T018 [P] [US2] Curl: verify `GET /api/platform/subscriptions?plan_id=<id>&billing_cycle=annual&payment_status=failed&expiring_soon=1` each independently filter results correctly — record in `specs/079-subscriptions-ops-dashboard/quickstart.md`

### Implementation for User Story 2

- [ ] T019 [P] [US2] Extend `getSubscriptions` param type in `frontend/src/api/platform.ts` to include `q?: string`, `plan_id?: string`, `billing_cycle?: string`, `payment_status?: string`, `expiring_soon?: boolean`
- [ ] T020 [US2] Add filter state variables to `frontend/src/admin/pages/Subscriptions.tsx`: `search: string` (raw input), `debouncedSearch: string` (via `useDebounce(search, 400)` — import from `frontend/src/hooks/useDebounce.ts`), `planFilter: string`, `cycleFilter: string`, `paymentStatusFilter: string`, `expiringSoon: boolean`. Reset `page` to 1 whenever any filter changes.
- [ ] T021 [US2] Update the `getSubscriptions` React Query call in `frontend/src/admin/pages/Subscriptions.tsx` to include all filter state in the query key `["platform-subscriptions", page, statusFilter, debouncedSearch, planFilter, cycleFilter, paymentStatusFilter, expiringSoon]` and pass them as params
- [ ] T022 [US2] Add search bar and filter row UI above the subscriptions table in `frontend/src/admin/pages/Subscriptions.tsx`: `Input` with search icon for school name/email, `Select` for plan (populated from plans query), `Select` for billing cycle (`monthly`/`annual`), `Select` for payment status (`paid`/`past_due`/`failed`/`pending`), and a `Switch` or `Badge`-style toggle for "Expiring Soon (30 days)". Include a "Clear filters" button that resets all filter state.
- [ ] T023 [US2] Add empty-state row to the subscriptions table in `frontend/src/admin/pages/Subscriptions.tsx` that renders when `subscriptions.length === 0` and at least one filter is active: shows "No subscriptions match your filters" message and a "Clear filters" link
- [ ] T024 [US2] Extend the `Subscription` TypeScript type in `frontend/src/admin/pages/Subscriptions.tsx` to include `max_students: number | null`, `payment_status: string | null`, and `alerts: string[]`
- [ ] T025 [US2] Add four new columns to the subscriptions table in `frontend/src/admin/pages/Subscriptions.tsx`: Renewal/Expiry date (with amber visual urgency styling when ≤30 days away and "No expiry" fallback when `expires_at` is null), Payment Health (`StatusBadge` using `payment_status`), Seats (`max_students` formatted as number or "Unlimited"), and Alerts (inline `StatusBadge`-style chips for each alert code in the `alerts` array: `payment_failed`→"Payment Failed", `expiring_soon`→"Expiring Soon", `trial_ending`→"Trial Ending")
- [ ] T026 [US2] Move the three-dot `DropdownMenu` action column in `frontend/src/admin/pages/Subscriptions.tsx` outside the `s.status === 'active'` guard so it renders on every row. Scope actions contextually: active rows get "Cancel subscription" (destructive); all rows get "Assign / Reassign Plan" (opens assign modal pre-populated with `tenant_id`); cancelled/expired/superseded rows get "Re-activate" (opens assign modal).

**Checkpoint**: US2 fully functional. Search, filters, enriched rows, and universal action menus all working.

---

## Phase 5: User Story 3 — Semantic Badges and Visual Rhythm (Priority: P2)

**Goal**: Confirm status badges use correct semantic colors across all statuses; add clear visual separation between page sections; make active sidebar link visually prominent.

**Independent Test**: Load the subscriptions table with mixed-status rows. Identify active (green), trial (blue), past_due (amber), cancelled (grey), failed (red) badges by color alone without reading text. Confirm sidebar Subscriptions link is visually heavier than inactive links.

### Validation for User Story 3

- [ ] T027 [US3] Visual verification: load the page, confirm `StatusBadge` renders correctly for `active`, `trial`, `past_due`, `cancelled`, `expired`, `failed` statuses — compare against semantic color spec in `frontend/src/admin/components/admin/StatusBadge.tsx` variants map

### Implementation for User Story 3

- [ ] T028 [US3] Review `frontend/src/admin/components/admin/StatusBadge.tsx` variants map against the spec's semantic color requirements; add any missing status keys (`superseded`, `past_due` already present as `past_due` — confirm `superseded` is handled by fallback or add explicit entry with grey styling)
- [ ] T029 [US3] Improve visual spacing in `frontend/src/admin/pages/Subscriptions.tsx`: add `mb-6` or `space-y-6` gap between the KPI bar and the tab strip, and `mt-4` between the tab strip and the card body so each section feels clearly separated
- [ ] T030 [US3] Strengthen active sidebar link styling in `frontend/src/admin/components/admin/AppSidebar.tsx`: when `isActive(item.url)` is true, apply additional classes to the `SidebarMenuButton` or its child `NavLink` to produce a visually prominent active state — `border-l-2 border-primary font-semibold` with a slightly stronger background tint using `cn()` conditional class application

**Checkpoint**: US3 complete. Semantic color scanning confirmed; page spacing improved; sidebar active state prominent.

---

## Phase 6: User Story 4 — Plan Card Price Display Cleanup (Priority: P2)

**Goal**: Every plan price on the Pricing Plans tab and in the Assign Subscription dialog renders as clean currency (`$25/mo`, `$9.99/mo`, `$240/yr`, `Free`) with no trailing zeros.

**Independent Test**: Open Pricing Plans tab — inspect each plan card price. Open Assign Subscription dialog — inspect plan selector. No price ends in `.00`, `.0000`, or any trailing zero beyond meaningful precision.

### Implementation for User Story 4

- [ ] T031 [US4] Apply `formatPrice` (from T012) to all plan price display sites in the Pricing Plans tab card grid in `frontend/src/admin/pages/Subscriptions.tsx`: replace direct `$${plan.monthly_price}/mo` and `$${plan.annual_price}/yr` string interpolation with `formatPrice(plan.monthly_price_cents ?? plan.monthly_price * 100, 'mo')` — or adapt based on actual field names (may be direct dollar values from API, in which case formatter should accept dollars and detect if cents conversion needed)
- [ ] T032 [US4] Apply `formatPrice` to the plan option labels in the "Assign subscription" dialog's plan `<Select>` in `frontend/src/admin/pages/Subscriptions.tsx` so each `<SelectItem>` shows e.g. "Pro — $25/mo or $240/yr"
- [ ] T033 [US4] Verify annual discount annotation `(X% off)` is displayed inline on plan cards in `frontend/src/admin/pages/Subscriptions.tsx` when `annual_discount_pct` is available and > 0, with no trailing zeros on the percentage

**Checkpoint**: US4 complete. All price strings are human-readable throughout the page.

---

## Phase 7: Polish & Validation

**Purpose**: TypeScript type-check, ESLint, constitutional compliance review, and curl quickstart completion.

- [ ] T034 Run `./node_modules/.bin/tsc --noEmit --pretty false` in `frontend/` — fix any type errors introduced by new fields (`max_students`, `payment_status`, `alerts`, new finance summary fields)
- [ ] T035 [P] Run targeted ESLint on modified frontend files: `npx eslint frontend/src/admin/pages/Subscriptions.tsx frontend/src/admin/components/admin/AppSidebar.tsx frontend/src/api/platform.ts --max-warnings=0` (warnings only from pre-existing debt are acceptable; no new errors)
- [ ] T036 [P] Run `php -l` on all modified backend PHP files: `php -l backend/app/Controllers/Platform/FinanceController.php && php -l backend/app/Controllers/Platform/SubscriptionsController.php`
- [ ] T037 Run `git diff --check` to confirm no trailing whitespace or merge-conflict markers in modified files
- [ ] T038 Complete all 11 curl validation steps in `specs/079-subscriptions-ops-dashboard/quickstart.md` against the running server and record actual results in the Validation Results table
- [ ] T039 Verify frontend constitutional compliance in `frontend/src/admin/pages/Subscriptions.tsx`: (a) confirm no client-side filtering, sorting, or aggregation logic remains — all filter params passed to backend; (b) confirm all mutation actions (cancel, assign, change-plan) show loading indicators and disable controls during in-flight requests; (c) confirm `queryClient.invalidateQueries` is called after each mutation; (d) confirm no stale data can flash post-mutation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all T001–T004 can start immediately in parallel
- **Foundational (Phase 2)**: Depends on Phase 1 read tasks — BLOCKS all user story frontend work
- **US1 (Phase 3)**: Depends on T005 (finance summary backend); T011–T016 can start after T005
- **US2 (Phase 4)**: Depends on T006–T008 (subscriptions backend); T019–T026 can start after T006–T008
- **US3 (Phase 5)**: Depends on US1+US2 frontend for visual verification (T027–T030 touch separate files from US2)
- **US4 (Phase 6)**: Depends on T012 (formatPrice utility) — T031–T033 are frontend-only edits
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Backend T005 → Frontend T011–T016
- **US2 (P1)**: Backend T006–T008 → Frontend T019–T026; T020 depends on T019; T021 depends on T020; T022–T026 depend on T021
- **US3 (P2)**: Independent of US1/US2 (different files: StatusBadge, AppSidebar, spacing tweaks)
- **US4 (P2)**: Depends on T012 (formatPrice) from US1

### Parallel Opportunities

- T001–T004 (setup reads) all parallel
- T005 (finance backend) and T006–T008 (subscriptions backend) can run in parallel
- T011 (platform.ts finance types) and T019 (platform.ts subscriptions types) are different additions to the same file — do sequentially or carefully merge
- T028 (StatusBadge review) and T030 (AppSidebar) are in different files — parallel
- T034–T037 (validation) are independent — parallel

---

## Parallel Example: US1 + US2 Backend

```bash
# Can run simultaneously after Phase 1:
Task T005: Extend FinanceController::summary() in backend/.../FinanceController.php
Task T006: Extend SubscriptionsController::index() SELECT clause in backend/.../SubscriptionsController.php
Task T007: Add alerts[] PHP computation in backend/.../SubscriptionsController.php  (sequential after T006)
Task T008: Add filter params in backend/.../SubscriptionsController.php             (sequential after T007)
```

---

## Implementation Strategy

### MVP First (US1 + US2, P1 Stories)

1. Complete Phase 1 (Setup — read files)
2. Complete Phase 2 (Foundational backend — T005–T009)
3. Complete Phase 3 (US1 KPI cards — T010–T016)
4. **STOP and VALIDATE**: Six KPI cards load correctly
5. Complete Phase 4 (US2 Search/Filter/Rows — T017–T026)
6. **STOP and VALIDATE**: Search, filters, enriched rows, action menus working

### Incremental Delivery

1. Setup + Foundational → Backend ready
2. US1 → Operational KPI bar live
3. US2 → Full search/filter/actions live → **Full P1 MVP delivered**
4. US3 → Visual polish (badges, spacing, sidebar)
5. US4 → Price formatting cleanup
6. Polish → TypeScript/ESLint/curl validation complete

### Suggested MVP Scope

**Phases 1–4 (T001–T026)**: Delivers the core operational dashboard transformation — enriched KPIs, search/filter, enriched rows, and universal action menus. US3 and US4 are P2 polish and can follow in a second pass.

---

## Notes

- `formatPrice` in T012 is shared by US1 (KPI formatting) and US4 (plan cards) — implement in US1, reuse in US4
- `useDebounce` hook already exists at `frontend/src/hooks/useDebounce.ts` — import, do not recreate
- `StatusBadge` already has semantically correct colors for all key statuses — T028 is verification only, likely no changes needed
- The `subscription_payment_transactions` correlated subquery in T006 uses `subscription_id` column — verify column name against actual schema before writing the query; fall back to invoice JOIN if needed
- `platform.ts` changes in T011 and T019 both touch the same file — apply sequentially to avoid conflicts
- All curl validation steps reference `specs/079-subscriptions-ops-dashboard/quickstart.md`
