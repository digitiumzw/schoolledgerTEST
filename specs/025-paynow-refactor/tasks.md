# Tasks: Refactor Paynow Integration

**Input**: Design documents from `/specs/025-paynow-refactor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-contracts.md ✅, quickstart.md ✅

**Tests**: Not explicitly requested. No test tasks generated.

**Organization**: Tasks are grouped by user story. Two backend files change:
- `backend/app/Services/PaynowService.php` (T001, T003, T007)
- `backend/app/Controllers/Api/SubscriptionController.php` (T002, T004, T005, T006)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on in-progress tasks)
- **[Story]**: Which user story this task belongs to

## Path Conventions

Web app layout: `backend/app/` for PHP source.

---

## Phase 1: Setup

**Purpose**: No new project structure, dependencies, or migrations required for this refactor. All infrastructure is in place.

- [x] T001 Confirm `paynow/php-sdk` is present in `backend/vendor/paynow/` and `backend/composer.json` has the dependency

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared foundational work is required. Both service changes (US1, US2) are independent and can proceed directly. Phase 1 is the only prerequisite.

**Checkpoint**: T001 complete → user story phases can begin.

---

## Phase 3: User Story 1 — Reliable Payment Initiation (Priority: P1) 🎯 MVP

**Goal**: Remove the unused `$currency` ghost parameter from `PaynowService::initiate()` and update the single call site in the controller. This eliminates the dead argument and aligns the method signature with the actual Paynow SDK API.

**Independent Test**: Confirm `POST /api/subscription/initiate` still returns a `redirectUrl` and creates a transaction in `initiated` status. No gateway-level behaviour changes.

### Implementation for User Story 1

- [x] T002 [US1] Remove `string $currency` parameter from `PaynowService::initiate()` and delete the dead `$currency` variable in `backend/app/Services/PaynowService.php`
- [x] T003 [US1] Update the `$paynow->initiate()` call in `SubscriptionController::initiate()` — drop the `$currency` argument — in `backend/app/Controllers/Api/SubscriptionController.php`

**Checkpoint**: `PaynowService::initiate()` signature is `initiate(string $reference, int $amountCents, string $email): array`. Call site in controller matches. Sandbox flow testable.

---

## Phase 4: User Story 2 — Trustworthy Webhook Callback Processing (Priority: P1)

**Goal**: Fix hash verification (remove the unused `$receivedHash` parameter from `verifyHash`) and store Paynow's own `paynowreference` value in the transaction record when a `paid` webhook is received. These two changes together ensure webhook integrity and full reconciliation capability.

**Independent Test**: Simulate a signed `paid` webhook (using the hash generation snippet in `quickstart.md`). Confirm: hash-invalid requests are rejected with HTTP 400; hash-valid `paid` callbacks update `status=paid` and populate `paynow_reference`; duplicate callbacks are silently ignored.

### Implementation for User Story 2

- [x] T004 [P] [US2] Fix `PaynowService::verifyHash()` — remove `string $receivedHash` parameter, change guard from `empty($receivedHash) || !isset($post['hash'])` to `empty($post['hash'])` — in `backend/app/Services/PaynowService.php`
- [x] T005 [P] [US2] Update `SubscriptionController::webhook()` — change `$paynow->verifyHash($post, $receivedHash)` call to `$paynow->verifyHash($post)` and remove the now-unused `$receivedHash` local variable — in `backend/app/Controllers/Api/SubscriptionController.php`
- [x] T006 [US2] Add `'paynow_reference' => $post['paynowreference'] ?? null` to the `paid`-status transaction update block inside `SubscriptionController::webhook()` in `backend/app/Controllers/Api/SubscriptionController.php`

> T004 and T005 touch different files — both can start immediately after Phase 3. T006 depends on T005 (same file).

**Checkpoint**: Webhook correctly rejects tampered hashes, stores `paynow_reference` on paid callbacks, and is idempotent for duplicate deliveries.

---

## Phase 5: User Story 3 — Accurate Transaction Status Polling (Priority: P2)

**Goal**: Verify that `SubscriptionController::poll()` correctly handles the already-paid idempotency case. No code changes are expected; this phase is a read-and-confirm task.

**Independent Test**: Poll a transaction already in `paid` status. Confirm the subscription is not re-activated (no duplicate `deactivateAllForTenant` call), and `paid: true` is still returned.

### Implementation for User Story 3

- [x] T007 [US3] Review `SubscriptionController::poll()` in `backend/app/Controllers/Api/SubscriptionController.php` — confirm the guard `if ($result['paid'] && $tx['status'] !== 'paid')` prevents re-activation; if a code defect is found, fix it in the same task

**Checkpoint**: Poll endpoint is idempotent. A second poll for an already-paid transaction returns `paid: true` without touching subscription state.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten docblocks and validate the end-to-end flow via the documented simulation.

- [x] T008 [P] Update PHPDoc on `PaynowService::initiate()` — remove `@param string $currency` line from the docblock — in `backend/app/Services/PaynowService.php`
- [x] T009 [P] Update PHPDoc on `PaynowService::verifyHash()` — update `@param` annotation to reflect the single `array $post` parameter and document the hash algorithm used — in `backend/app/Services/PaynowService.php`
- [x] T010 Run the webhook simulation from `specs/025-paynow-refactor/quickstart.md` and confirm HTTP 200 `Received`, `status=paid`, and `paynow_reference` populated in the database

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 3)**: Depends on T001 only
- **US2 (Phase 4)**: Depends on T001 only — can start in parallel with US1 after T001
- **US3 (Phase 5)**: Depends on US1 and US2 completion (poll behaviour depends on correct service state)
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Independent — touches `PaynowService::initiate()` and controller call site
- **US2 (P1)**: Independent of US1 — touches `PaynowService::verifyHash()`, controller webhook handler
- **US3 (P2)**: Read-only verification, no conflict; best done after US1+US2 to validate full flow

### Within Each User Story

- US1: T002 → T003 (service signature first, then update call site)
- US2: T004 ∥ T005 (different files) → T006 (depends on T005, same file)
- US3: T007 (standalone read-and-confirm)

### Parallel Opportunities

- T004 (PaynowService) and T005 (SubscriptionController) are in different files — can run in parallel
- T008 and T009 are both docblock-only edits in the same file but non-overlapping — can be batched in one edit
- US1 and US2 phases can proceed in parallel (different logical changes, same files must be serialised per-file)

---

## Parallel Example: User Story 2

```
# T004 and T005 can be dispatched together:
Task: "Fix PaynowService::verifyHash() signature in backend/app/Services/PaynowService.php"
Task: "Update verifyHash call site in SubscriptionController::webhook() in backend/app/Controllers/Api/SubscriptionController.php"

# T006 starts after T005 completes:
Task: "Add paynow_reference storage to paid webhook block in backend/app/Controllers/Api/SubscriptionController.php"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete T001: Confirm SDK present
2. Complete Phase 3 (T002, T003): Fix initiation signature
3. Complete Phase 4 (T004 → T005 → T006): Fix webhook processing
4. **STOP and VALIDATE**: Run webhook simulation from quickstart.md
5. Both P1 stories are complete and independently testable

### Incremental Delivery

1. T001 → setup confirmed
2. T002, T003 → payment initiation clean (US1 done)
3. T004, T005, T006 → webhook reliable (US2 done)
4. T007 → polling confirmed idempotent (US3 done)
5. T008, T009, T010 → polished, validated

---

## Notes

- [P] tasks = different files, no dependency conflicts
- [Story] label maps each task to its user story for traceability
- No new files to create — all changes are edits to existing files
- No migrations to run — schema is already correct
- US3 (T007) is a verification task; only write code if a defect is discovered
- Run `php spark serve` in `backend/` before executing T010 (webhook simulation)
