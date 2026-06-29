# Tasks: Receipt Search and Cancel

**Input**: Design documents from `/specs/085-receipt-search-cancel/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Endpoint-level curl validation MUST be run after implementation for new or changed API behavior per Constitution Principle X.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure; no new schema needed.

- [ ] T001 Verify existing void fields (`voided_at`, `void_reason`, `voided_by`) and receipt indexes are present on `payments` table per `research.md`; document confirmation — no migration required

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core changes that MUST be complete before ANY user story can be fully validated.

**⚠️ CRITICAL**: No user story work can be considered complete until this phase is done.

- [ ] T002 [P] `backend/app/Services/LedgerService.php` — add `voided_at IS NULL` filter to all payment subqueries in `getStudentBalance()` and `getAllBalances()` so voided payments are excluded from balance calculations
- [ ] T003 [P] `backend/app/Models/PaymentModel.php` — add `isVoided`, `voidedAt`, `voidReason` to `formatForApi()`; ensure `getStatsForTenant()`, `getFilteredSummary()`, `getFilteredCount()`, and all summary builders exclude voided payments (`voided_at IS NULL`)
- [ ] T004 [P] `frontend/src/types/dashboard.ts` — add `isVoided?: boolean`, `voidedAt?: string | null`, `voidReason?: string | null` to `PaymentHistoryRecord` interface
- [ ] T005 [P] `frontend/src/api/api.ts` — add `cancelPayment(paymentId: string, reason: string)` POST method; update `PaymentHistoryRecord` type re-export if needed

**Checkpoint**: Foundation ready — voided payments are excluded from ledger balances and financial totals; frontend types and API stubs exist.

---

## Phase 3: User Story 1 — Search Payments by Receipt Number (Priority: P1) 🎯 MVP

**Goal**: Users can search for payments using a dedicated receipt number field that supports exact and partial matching.

**Independent Test**: Enter a known receipt number into the search field on the Payments page and verify the matching payment appears with student details, amount, and date.

### Validation for User Story 1

- [ ] T006 [P] [US1] Curl validation: receipt search happy path (exact match), partial match (`2026.05`), and not-found empty result against `GET /api/payments/with-students?search={term}`

### Implementation for User Story 1

- [ ] T007 [US1] `frontend/src/pages/Payments.tsx` — add a dedicated receipt search input field (with Receipt icon) above the existing general search; wire it to `debouncedSearchTerm` so it populates the backend `search` param
- [ ] T008 [P] [US1] `frontend/src/pages/Payments.tsx` — render a "Voided" status Badge in payment table rows when `isVoided` is true; gray out or strikethrough the amount for voided rows
- [ ] T009 [US1] `frontend/src/pages/Payments.tsx` — ensure backend-prepared response is rendered without client-side filtering, sorting, or pagination of payment data

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 — Cancel and Void a Receipt (Priority: P1)

**Goal**: Authorized users can cancel a receipt, which soft-voids the associated payment(s), recalculates the student ledger, and displays a success confirmation.

**Independent Test**: Create a payment, note the student's balance, trigger cancel with a reason, and verify the balance increases by the voided amount and the payment shows as voided.

### Validation for User Story 2

- [ ] T010 [P] [US2] Curl validation for `POST /api/payments/:id/void`: happy path, double-void 409, missing reason 400, unauthorized role 403, tenant isolation 404

### Implementation for User Story 2

- [ ] T011 [US2] `backend/app/Controllers/Api/PaymentController.php` — add `void($id)` action: role check (admin/bursar), reason validation, tenant-scoped payment lookup, double-void guard (409 if `voided_at` already set), set `voided_at`/`void_reason`/`voided_by`
- [ ] T012 [P] [US2] `backend/app/Controllers/Api/PaymentController.php` — in `void()`, handle grouped payment atomic void: find all sibling rows by `payment_group_id` and void them together in a transaction; after void, trigger `LedgerService::allocatePaymentToCharges()` and `getStudentBalance()` for the affected student
- [ ] T013 [US2] `backend/app/Config/Routes.php` — add `POST payments/(:segment)/void` route BEFORE the `payments/(:segment)` wildcard to avoid shadowing
- [ ] T014 [P] [US2] `frontend/src/hooks/useCancelReceipt.ts` — create `useCancelReceipt` hook using `useMutation`; expose `isPending`; on success call `queryClient.invalidateQueries({ queryKey: ['payments-with-students'] })` and invalidate affected student balance queries
- [ ] T015 [P] [US2] `frontend/src/components/modals/CancelReceiptModal.tsx` — new modal with reason Textarea (required validation), confirmation warning text, Confirm (destructive) and Cancel buttons; disable Confirm while `isPending`; show loading spinner during mutation
- [ ] T016 [US2] `frontend/src/pages/Payments.tsx` — wire cancel action: show `CancelReceiptModal` on a row action (e.g., dropdown menu item or button); pass payment ID and receipt number; on success show `toast.success`; ensure action control is disabled during `isPending`

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 — View Canceled Receipt with Invalid Indicator (Priority: P2)

**Goal**: The receipt view prominently displays a "CANCELED / INVALID" indicator, void date, and reason for any voided receipt.

**Independent Test**: View a voided receipt by its public URL and confirm the screen shows the canceled banner, void date, and reason with original amounts struck through.

### Validation for User Story 3

- [ ] T017 [P] [US3] Curl validation for `GET /api/receipts/:id` on a voided payment: confirm response includes `isVoided: true`, `voidedAt`, `voidReason`

### Implementation for User Story 3

- [ ] T018 [US3] `backend/app/Controllers/Api/ReceiptController.php` — include `isVoided`, `voidedAt`, `voidReason`, `voidedBy` in the receipt response payload
- [ ] T019 [P] [US3] `frontend/src/components/receipt/ReceiptDocument.tsx` — when `isVoided` is true, render a prominent red "CANCELED / INVALID" banner at the top; display void date and reason below the banner; gray out or apply `line-through` to all monetary amounts and the total
- [ ] T020 [P] [US3] `frontend/src/components/receipt/ReceiptDocument.tsx` — for grouped/multi-category voided receipts, ensure all category lines are shown as voided and the combined total is struck through

**Checkpoint**: All user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, lint, type-check, and documentation.

- [ ] T021 [P] PHP lint: `backend/app/Controllers/Api/PaymentController.php`, `backend/app/Controllers/Api/ReceiptController.php`, `backend/app/Models/PaymentModel.php`, `backend/app/Services/LedgerService.php`, `backend/app/Config/Routes.php`
- [ ] T022 [P] Frontend TypeScript: `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false`
- [ ] T023 git diff --check for all touched files
- [ ] T024 `frontend/src/pages/Payments.tsx` — verify no client-side filtering, searching, sorting, pagination, aggregations, or business computations are performed; all data comes from backend-prepared `useQuery` response
- [ ] T025 `frontend/src/hooks/useCancelReceipt.ts` and `frontend/src/pages/Payments.tsx` — verify all mutation actions show a visible loading indicator; action controls are disabled during in-flight requests; affected React Query caches are invalidated after mutation; no stale data flashes post-mutation
- [ ] T026 Update `specs/085-receipt-search-cancel/quickstart.md` with live curl validation results after running all validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - US1 and US2 are both P1 and can proceed in parallel after Foundational
  - US3 (P2) can also proceed in parallel but depends on US2's void endpoint being available for generating test data
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — no dependencies on US1, but both share Payments.tsx so file-level conflicts possible
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) — depends on US2's void endpoint for creating test data, but can be mocked/stubbed independently

### Within Each User Story

- Curl validation tasks MUST run after implementation
- Backend endpoints before frontend integration
- Core implementation before UI wiring

### Parallel Opportunities

- T002, T003, T004, T005 (Foundational) can all run in parallel
- T007, T008 (US1 frontend) can run in parallel
- T011, T012 (US2 backend) can run in parallel after T009/T010
- T014, T015 (US2 frontend) can run in parallel
- T018, T019 (US3) can run in parallel
- T021, T022, T023 (Polish) can run in parallel
- All curl validation tasks (T006, T010, T017) run after their respective implementation phases

---

## Parallel Example: User Story 2

```bash
# Launch backend void endpoint and hook in parallel:
Task: "backend/app/Controllers/Api/PaymentController.php — add void() action"
Task: "frontend/src/hooks/useCancelReceipt.ts — create useCancelReceipt hook"

# After both complete, wire frontend:
Task: "frontend/src/components/modals/CancelReceiptModal.tsx — new modal"
Task: "frontend/src/pages/Payments.tsx — wire cancel action"

# Finally validate:
Task: "Curl validation for POST /api/payments/:id/void"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — Receipt Search
4. Complete Phase 4: User Story 2 — Cancel/Void
5. **STOP and VALIDATE**: Test US1 and US2 independently via curl
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP search)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP void)
4. Add User Story 3 → Test independently → Deploy/Demo (receipt view enhancement)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (frontend search UI)
   - Developer B: User Story 2 backend (void endpoint) + hook
   - Developer C: User Story 2 frontend (modal) + User Story 3 (receipt view)
3. Stories complete and integrate independently

---

## Task Count Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | 1 | Verify existing schema |
| Phase 2: Foundational | 4 | Ledger void filtering, model void fields, frontend types, API method |
| Phase 3: US1 Search | 4 | Frontend search UI, voided badge, backend-driven check, validation |
| Phase 4: US2 Cancel/Void | 7 | Backend void endpoint + grouped void, route, hook, modal, wiring, validation |
| Phase 5: US3 View Voided | 4 | Receipt controller void fields, CANCELED banner, grouped display, validation |
| Phase 6: Polish | 6 | PHP lint, TS type-check, git diff --check, backend-driven check, loading-state check, quickstart update |
| **Total** | **26** | |

**MVP scope**: Phase 1 + Phase 2 + US1 + US2 (Tasks T001–T016, excluding T017–T020 US3 tasks)
