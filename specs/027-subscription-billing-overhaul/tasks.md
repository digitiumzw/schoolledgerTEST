# Tasks: Subscription Billing Overhaul

**Input**: Design documents from `/specs/027-subscription-billing-overhaul/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: No test tasks — not requested in spec. Manual sandbox testing via quickstart.md.

**Organization**: Tasks grouped by user story (US1–US5) enabling independent implementation and delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[USn]**: Which user story this task belongs to
- All paths are relative to repo root

## Path Conventions

```
backend/app/Controllers/Api/   PHP controllers
backend/app/Config/            Routes, filters, config
backend/app/Services/          Service layer
frontend/src/api/              Axios instance and all API functions
frontend/src/hooks/            React custom hooks
frontend/src/pages/            Page components
frontend/src/components/subscription/  Subscription UI components
```

---

## Phase 1: Setup

**Purpose**: No new dependencies, schema changes, or project initialisation required. Confirm the environment is clean before making changes.

- [x] T001 Confirm both dev servers start cleanly (`php spark serve` and `npm run dev`) and sandbox mode is active (no PAYNOW credentials in `backend/.env` or using placeholder values)

---

## Phase 2: Foundational — Remove EcoCash Feature

**Purpose**: Remove EcoCash / OneMoney from all layers. These shared-file changes are prerequisites for every user story phase.

**⚠️ CRITICAL**: Complete this phase before any user story work begins.

- [x] T002 [P] Remove the `POST /api/subscription/initiate-ecocash` route line from `backend/app/Config/Routes.php`
- [x] T003 [P] Remove `initiateEcocashSubscription()` function and `InitiateEcocashResponse` interface from `frontend/src/api/api.ts`
- [x] T004 [P] Remove `EcocashState` type, `ecocashState`, `ecocashInstructions` state vars, the `initiateEcocash()` method, and all related `pollTimer` interval logic from `frontend/src/hooks/useSubscription.ts`; remove `ecocashState`, `ecocashInstructions`, and `initiateEcocash` from the `UseSubscriptionReturn` interface
- [x] T005 Remove all EcoCash UI state (`showEcocash`, `ecocashPlan`, `ecocashCycle`, `ecocashPhone`, `ecocashMethod`, `ecocashEmail`) and the entire EcoCash form card (the `{!showEcocash ? <button>...</button> : <Card>...</Card>}` block) from `frontend/src/pages/Billing.tsx`

**Checkpoint**: No EcoCash code remains in routes, API layer, hook, or page. Both servers compile without errors.

---

## Phase 3: User Story 1 — Subscribe via Paynow + Confirmation Dialog (Priority: P1) 🎯 MVP

**Goal**: When the user clicks Subscribe/Upgrade/Downgrade, a dialog appears listing Paynow payment methods and confirming the redirect. On successful payment return, the subscription card and banners update immediately.

**Independent Test**: Select any plan → dialog appears with payment methods listed → click "Continue" → sandbox redirects back → "Payment Confirmed" green banner shows → subscription card reflects new plan.

### Implementation for User Story 1

- [x] T006 [US1] Create `frontend/src/components/subscription/SubscribeConfirmDialog.tsx` — a shadcn/ui `Dialog` component that accepts props `open`, `planName`, `price` (pre-formatted string), `cycle`, `actionLabel` ('Subscribe' | 'Upgrade' | 'Downgrade'), `isLoading`, `onConfirm`, `onCancel`; the dialog body must state "You'll be redirected to Paynow to complete your payment" and list the following available payment methods: Visa / Mastercard, EcoCash (web), OneMoney (web), Telecash
- [x] T007 [US1] Add dialog state to `frontend/src/pages/Billing.tsx`: add `pendingPlan` state of type `{ planId: string; cycle: 'monthly' | 'annual'; actionLabel: string; planName: string; price: string } | null` (default null); replace `handleSubscribe` so it sets `pendingPlan` (opening the dialog) instead of immediately calling `initiatePaidSubscription`; derive `actionLabel` by comparing the selected plan's `sortOrder` against the current subscription's plan sort order (same logic as PlanCard)
- [x] T008 [US1] Wire the dialog into `frontend/src/pages/Billing.tsx`: render `<SubscribeConfirmDialog>` using `pendingPlan` state; on `onConfirm` call `initiatePaidSubscription(pendingPlan.planId, pendingPlan.cycle)` then clear `pendingPlan`; on `onCancel` clear `pendingPlan`; pass `loadingPlanId !== null` as `isLoading` to disable the Confirm button during the initiation request

**Checkpoint**: Clicking any plan card opens the dialog. Confirming the dialog redirects to Paynow (sandbox). Returning from sandbox shows the "Payment Confirmed" banner and the subscription card updates.

---

## Phase 4: User Story 2 — Handle Cancelled Payment (Priority: P2)

**Goal**: When the user cancels on Paynow and returns, a "Transaction Cancelled" notice is shown and the subscription status is unchanged.

**Independent Test**: Open Billing page; simulate a cancelled return by directly visiting `?payment=complete&txId=<id-of-a-cancelled-tx>`; see "Transaction Cancelled" banner; subscription card unchanged.

### Implementation for User Story 2

- [x] T009 [P] [US2] Optimise `poll()` in `backend/app/Controllers/Api/SubscriptionController.php`: at the very top of the method (after fetching `$tx`), add a guard that checks if `$tx['status']` is already a terminal state (`'paid'`, `'failed'`, or `'cancelled'`); if so, return immediately with `paid: ($tx['status'] === 'paid')`, `paynowStatus: ($tx['paynow_status_raw'] ?? $tx['status'])`, `subscriptionStatus: ($tx['status'] === 'paid' ? 'active' : $tx['status'])` — skipping the Paynow SDK call entirely
- [x] T010 [US2] Add `'cancelled'` to the `PollState` type in `frontend/src/pages/Billing.tsx`; update the `.then()` callback of `api.pollSubscriptionStatus(txIdParam)` to set `pollState = 'cancelled'` when `result.paid === false && result.paynowStatus?.toLowerCase() === 'cancelled'`; set `pollState = 'pending'` for all other non-paid outcomes
- [x] T011 [US2] Add a "Transaction Cancelled" amber/orange `<Alert>` banner to `frontend/src/pages/Billing.tsx` in the payment return banners section, rendered when `pollState === 'cancelled'`; banner text: "Transaction Cancelled — Your payment was not completed. No changes have been made to your subscription."

**Checkpoint**: With a cancelled txId, the Billing page shows the cancellation banner and no subscription change is visible.

---

## Phase 5: User Story 3 — Upgrade / Downgrade Plan (Priority: P2)

**Goal**: Plan cards correctly show "Upgrade" / "Downgrade" / "Current Plan" / "Subscribe" labels, the confirmation dialog reflects the correct action label, and downgrade blocking works before the dialog opens.

**Independent Test**: Log in with a school on an active Starter plan; plan grid shows "Upgrade" on Growth/Enterprise and "Current Plan" on Starter; clicking Upgrade opens dialog with "Upgrade" label; attempting a downgrade when student count exceeds limit shows the block alert without opening the dialog.

### Implementation for User Story 3

- [x] T012 [US3] Verify that `frontend/src/pages/Billing.tsx`'s `handleSubscribe` (updated in T007) correctly derives `actionLabel` — compute it using the same sort-order comparison PlanCard uses: if no active subscription → `'Subscribe'`; if selected plan sort order > current plan sort order → `'Upgrade'`; if selected plan sort order < current plan sort order → `'Downgrade'`; otherwise `'Subscribe'` (same plan = renewal); pass this label to `pendingPlan` state so the dialog displays it
- [x] T013 [US3] Ensure the downgrade block check fires before the dialog opens: in `handleSubscribe` (in `frontend/src/pages/Billing.tsx`), if the selected plan is a downgrade and `studentCount > selectedPlan.maxStudents` (where `maxStudents` is non-null), set `downgradeBlockedState` via `useSubscription` and return early (do not set `pendingPlan`); the existing `downgradeBlockedState` alert in the JSX will display the block message

**Checkpoint**: Upgrade/Downgrade/Subscribe labels appear correctly in the dialog. Downgrade block alert shows when student count exceeds the plan limit. Valid upgrades and downgrades proceed to Paynow via the dialog.

---

## Phase 6: User Story 4 — Billing History and Invoice Download (Priority: P3)

**Goal**: After a completed payment, the Invoices section and Billing History both refresh automatically. Invoice PDF download works.

**Independent Test**: Complete a sandbox payment → without refreshing, confirm the Invoices table shows a new entry and the Billing History shows `payment_confirmed` + `plan_activated` events → click Download on the invoice → PDF downloads with correct data.

### Implementation for User Story 4

- [x] T014 [P] [US4] Verify that `frontend/src/pages/Billing.tsx`'s payment-complete `useEffect` (for Paynow redirect return) invalidates all four query keys: `subscription-current`, `subscription-history`, `subscription-invoices`, and `subscription-events`; and that `frontend/src/hooks/useSubscription.ts`'s EcoCash polling success path (now removed) no longer needs updating — confirm the four invalidations are present in the Paynow redirect path only
- [x] T015 [US4] Confirm invoice download works end-to-end: after a sandbox payment, open the Invoices section and click "Download" — verify the browser downloads a PDF file named `invoice-INV-*.pdf`; if the download fails with a 401, check that `frontend/src/api/api.ts` `downloadInvoice()` correctly attaches the `Authorization: Bearer <token>` header (it already does this via raw fetch — just verify)

**Checkpoint**: Invoices and Billing History update without a page refresh after payment. Invoice PDF downloads successfully.

---

## Phase 7: User Story 5 — Enterprise Plan as Recommended (Priority: P3)

**Goal**: The Enterprise plan (highest sort_order) always shows the "Recommended" badge, overriding the previous student-count-based logic.

**Independent Test**: Open Billing page with any tenant → Enterprise plan card has the gold star "Recommended" badge → no other plan has the badge.

### Implementation for User Story 5

- [x] T016 [US5] Update `resolveRecommendedPlan()` in `backend/app/Controllers/Api/SubscriptionController.php`: replace the student-count threshold logic with a single DB query — `$topPlan = $this->planModel->where('is_active', 1)->orderBy('sort_order', 'DESC')->first()` — and return `$topPlan['id'] ?? ''`; the frontend already consumes `recommendedPlanId` from the API response and passes it to `PlanSelector`, so no frontend changes are needed

**Checkpoint**: All three plan cards render; only Enterprise has the "Recommended" badge; this holds for tenants with 0, 100, or 500+ students.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and end-to-end smoke test.

- [x] T017 [P] Confirm the sandbox fallback URL in `backend/app/Services/PaynowService.php` `sandboxResponse()` is `http://localhost:8080/billing?payment=complete` (already fixed in previous session — verify it remains correct)
- [x] T018 [P] Remove unused imports from `frontend/src/pages/Billing.tsx` (`Smartphone` icon and any imports only used by EcoCash form) and from `frontend/src/hooks/useSubscription.ts` after EcoCash removal
- [x] T019 Run all 6 quickstart.md test scenarios manually to confirm full end-to-end behaviour: (1) subscribe sandbox flow, (2) cancel flow, (3) upgrade, (4) downgrade with block, (5) enterprise recommended badge, (6) EcoCash UI absent

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US1, P1)**: Depends on Phase 2 — the confirmation dialog is the core MVP
- **Phase 4 (US2, P2)**: Depends on Phase 2; also depends on Phase 3 (poll optimisation is independent, but cancellation banner sits in the same `Billing.tsx` as the dialog)
- **Phase 5 (US3, P2)**: Depends on Phase 3 (T007 must exist before T012 can verify label logic)
- **Phase 6 (US4, P3)**: Depends on Phase 3 (payment flow must work to generate invoices/events)
- **Phase 7 (US5, P3)**: Depends on Phase 2 only — independent backend change
- **Phase 8 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 foundational complete
- **US2 (P2)**: T009 (backend poll) is parallel to US1; T010/T011 (frontend) require US1's Billing.tsx changes to be in place
- **US3 (P2)**: Depends on US1 (T007 must exist); no other story dependencies
- **US4 (P3)**: Depends on US1 (needs a working payment to test invoices)
- **US5 (P3)**: Independent of all other stories — backend-only change

### Parallel Opportunities Within Phases

- **Phase 2**: T002, T003, T004 are all different files — run in parallel
- **Phase 4**: T009 (backend) runs in parallel with T010/T011 (frontend)
- **Phase 8**: T017 and T018 run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```text
# All three can run simultaneously (different files, no shared state):
Task T002: Remove route from backend/app/Config/Routes.php
Task T003: Remove function from frontend/src/api/api.ts
Task T004: Remove hook state from frontend/src/hooks/useSubscription.ts

# T005 follows after T004 is done (removes state vars that came from the hook):
Task T005: Remove EcoCash UI from frontend/src/pages/Billing.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational — EcoCash removal (T002–T005)
3. Complete Phase 3: User Story 1 — dialog + subscribe flow (T006–T008)
4. **STOP and VALIDATE**: Click Subscribe → dialog appears → confirm → sandbox payment → success banner ✅
5. All core payment functionality is working — everything else is incremental

### Incremental Delivery

1. **Phase 1+2** → clean codebase, EcoCash removed
2. **+ Phase 3 (US1)** → subscribe with dialog → MVP deliverable ✅
3. **+ Phase 4 (US2)** → cancellation handling
4. **+ Phase 5 (US3)** → upgrade/downgrade labels verified
5. **+ Phase 7 (US5)** → Enterprise recommended (quick backend change, can do any time after Phase 2)
6. **+ Phase 6 (US4)** → billing history verified
7. **+ Phase 8** → polish and smoke test

### Parallel Team Strategy

With two developers:

- **Developer A**: Phase 2 T002/T003/T004 (backend + api.ts) → Phase 4 T009 (poll optimisation) → Phase 7 T016 (recommended plan)
- **Developer B**: Phase 2 T005 (Billing.tsx EcoCash removal) → Phase 3 T006–T008 (dialog) → Phase 4 T010–T011 (cancellation UI)

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run concurrently
- [USn] maps each task to its user story for traceability
- No database migrations required — no schema changes in this feature
- Commit after each phase checkpoint to keep the branch bisectable
- Stop at Phase 3 checkpoint to demo the MVP before continuing
- The `initiateEcocash()` controller method in `SubscriptionController.php` can remain as dead code (route removed = unreachable); no need to delete it unless desired
