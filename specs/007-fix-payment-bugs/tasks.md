# Tasks: Fix Payment Module Bugs

**Input**: Design documents from `/specs/007-fix-payment-bugs/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: No automated tests requested. Manual verification steps are included at each checkpoint.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/` for PHP controllers and models, `frontend/src/` for React components

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — this is a bug fix to an existing codebase. Verify the current state of affected files before making changes.

- [x] T001 Review current error logs to confirm active bugs in `backend/writable/logs/log-2026-04-*.log`
- [x] T002 [P] Review current state of `backend/app/Controllers/Api/PaymentController.php` lines 126-142 (create method, transaction and find logic)
- [x] T003 [P] Review current state of `backend/app/Models/PaymentModel.php` lines 119-139 (formatForApi method)

---

## Phase 2: User Story 1 - Record Payment Without Errors (Priority: P1) 🎯 MVP

**Goal**: Fix the null pointer exception that crashes the system when a bursar records a payment. After `PaymentModel::insert()` and transaction commit, the `find()` call may return null; passing that null to `formatForApi()` causes a TypeError.

**Independent Test**: Record a payment for any student via the UI or API. The payment should save successfully and return a 201 response with the formatted payment object.

### Implementation for User Story 1

- [x] T004 [US1] Add null-safety check after `$this->paymentModel->find($paymentId)` in `backend/app/Controllers/Api/PaymentController.php` (line 140). If `$saved` is null, log an error with the payment ID and return a server error response instead of passing null to `formatForApi()`. The fix replaces lines 140-141 with: null check → error log → fallback error response → otherwise return `$this->created(...)` as before.

**Checkpoint**: Record a payment via POST `/api/payments` with a valid student, amount, and method. Expect a 201 response with the payment object. Verify no TypeError in `backend/writable/logs/`.

---

## Phase 3: User Story 2 - View Payment Lists Without Month Field Errors (Priority: P1)

**Goal**: Fix the "Undefined array key 'month'" error that crashes all payment list views. The `formatForApi()` method accesses `$payment['month']` directly, but legacy records lack this key. The method already derives `$monthDerived` from the date field but doesn't use it in the return array.

**Independent Test**: Navigate to the Payments page or call GET `/api/payments/recent`. All payments should load without errors, with month values derived from their dates.

### Implementation for User Story 2

- [x] T005 [US2] In `backend/app/Models/PaymentModel.php`, change line 136 in the `formatForApi()` method return array from `'month' => $payment['month']` to `'month' => $monthDerived` to use the already-computed derived value from lines 122-125. This single-line change fixes the undefined array key error for all payment API endpoints. **NOTE**: Already fixed in codebase prior to implementation.

**Checkpoint**: Call GET `/api/payments/recent` and GET `/api/payments/with-students`. Expect 200 responses with all payments containing integer `month` values (1-12) derived from their `date` fields. Verify zero "Undefined array key" errors in `backend/writable/logs/`.

---

## Phase 4: User Story 3 - Reliable Payment Data Retrieval (Priority: P2)

**Goal**: Add defense-in-depth to `formatForApi()` so it handles edge cases gracefully — empty arrays, null/invalid dates, and missing optional fields. This prevents future crashes from unexpected data states.

**Independent Test**: Call all payment API endpoints (index, recent, byStudent, withStudents). All should return properly formatted data without crashes, even for legacy records with missing fields.

### Implementation for User Story 3

- [x] T006 [US3] Add an empty-array guard at the top of `formatForApi()` in `backend/app/Models/PaymentModel.php`. Before the month derivation logic (line 122), add: `if (empty($payment)) { return []; }`. This prevents downstream key-access errors if an empty array is ever passed.
- [x] T007 [US3] Add null-coalescing defaults for optional fields in the `formatForApi()` return array in `backend/app/Models/PaymentModel.php`. Ensure `'category' => $payment['category'] ?? ''` and `'routeId' => $payment['route_id'] ?? null` use the `??` operator for any fields that may be absent in legacy records.

**Checkpoint**: Call all payment API endpoints. Verify all return valid JSON arrays with no null-pointer or undefined-key errors. Check `backend/writable/logs/` for zero payment-related critical errors.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all user stories and log cleanup.

- [x] T008 Verify all payment API endpoints return correct data by testing: GET `/api/payments`, GET `/api/payments/recent`, GET `/api/payments/with-students`, GET `/api/payments/student/{id}`, POST `/api/payments`
- [x] T009 Verify error logs show zero new payment-related critical errors in `backend/writable/logs/log-2026-04-*.log`
- [x] T010 Test end-to-end via the frontend: navigate to Payments page, record a new payment, verify it appears in the list with correct month value

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — review only, can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup review. Fixes PaymentController.php
- **User Story 2 (Phase 3)**: Depends on Setup review. Fixes PaymentModel.php. **Can run in parallel with US1** (different files)
- **User Story 3 (Phase 4)**: Depends on US2 completion (same file: PaymentModel.php)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent — modifies only `PaymentController.php`
- **User Story 2 (P1)**: Independent — modifies only `PaymentModel.php`
- **User Story 3 (P2)**: Depends on US2 (same file, `PaymentModel.php`, must apply after US2's change)

### Within Each User Story

- Single-task stories (US1, US2): No internal dependencies
- US3: T006 before T007 (guard must exist before field defaults are adjusted)

### Parallel Opportunities

- T002 and T003 can run in parallel (different files, review only)
- **US1 (T004) and US2 (T005) can run in parallel** (different files: PaymentController.php vs PaymentModel.php)
- T008, T009, T010 are sequential verification steps

---

## Parallel Example: User Story 1 + User Story 2

```text
# These two stories modify different files and can be implemented simultaneously:
Task T004 [US1]: Fix null check in backend/app/Controllers/Api/PaymentController.php
Task T005 [US2]: Fix month derivation in backend/app/Models/PaymentModel.php
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (review affected files)
2. Complete Phase 2: User Story 1 — fix null pointer in PaymentController (T004)
3. Complete Phase 3: User Story 2 — fix month field in PaymentModel (T005)
4. **STOP and VALIDATE**: Both critical P1 bugs are now fixed
5. Deploy if ready — system is functional

### Incremental Delivery

1. US1 + US2 fix → Critical bugs resolved → System operational (MVP)
2. US3 → Defense-in-depth → System hardened against edge cases
3. Polish → Full verification → Ready for production

### Single Developer Strategy

Since US1 and US2 touch different files, implement both quickly in sequence:

1. T001-T003: Review files (5 minutes)
2. T004: Fix PaymentController.php (5 minutes)
3. T005: Fix PaymentModel.php (2 minutes)
4. Verify both fixes work together (10 minutes)
5. T006-T007: Harden PaymentModel.php (5 minutes)
6. T008-T010: Full verification (15 minutes)

**Estimated total implementation time**: 15 minutes
**Estimated total verification time**: 25 minutes

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are both P1 priority but modify different files — implement in parallel or quick succession
- US3 is P2 defense-in-depth — can be deferred if US1+US2 resolve the immediate crises
- No database migrations needed
- No frontend changes needed
- No new dependencies to install
- Commit after each user story phase for clean git history
