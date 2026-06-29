---
description: "Task list for 039-eliminate-legacy-columns"
---

# Tasks: Eliminate Legacy Columns

**Input**: Design documents from `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-changes.md`, `quickstart.md`

**Tests**: Not requested — no automated test tasks are generated. Verification is performed via `quickstart.md` smoke steps and grep sweeps.

**Organization**: Tasks are grouped by the three user stories from `spec.md`. US1 (P1) is the MVP — database schema cleanup. US2 (P2) is codebase dependency cleanup. US3 (P3) is data-integrity verification. Because this is a subtractive refactor, US2 must land **before** US1 (expand/contract: stop reading/writing columns first, then drop them). US3 validates the combined result.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)
- All paths are absolute.

## Path Conventions

- Backend (CodeIgniter): `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/`
- Frontend (React SPA): `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment readiness; no new project scaffolding is needed.

- [ ] T001 Verify backend dev environment: run `php spark list` from `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend` and confirm migrations table is at current `HEAD` (all 64 existing migrations applied)
- [ ] T002 [P] Verify frontend dev environment: run `npm install && npm run lint` from `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/frontend` and confirm clean baseline
- [ ] T003 [P] Snapshot current ledger state for regression check: from repo root run `mysql … -e "SELECT COUNT(*) AS c, SUM(amount) AS total FROM charges WHERE deleted_at IS NULL; SELECT COUNT(*) AS c, SUM(amount) AS total FROM payments;"` and record the four numbers in a scratch file for comparison after T024

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Capture the exact reference surface and confirm no queries or reports outside the audited files depend on the legacy columns.

**⚠️ CRITICAL**: No user-story work may begin until T004 and T005 are complete.

- [ ] T004 Run the full reference grep and confirm it matches the audit in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/research.md:47-82`. Command: `grep -RIn --include='*.php' --include='*.ts' --include='*.tsx' -e 'is_fee_structure' -e 'isFeeStructure' -e 'is_transport' -e 'isTransport' /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/frontend/src`. Any match not listed in research.md §Decision 2 MUST be added before proceeding.
- [ ] T005 Confirm no SQL views, stored procedures, or triggers reference the legacy columns: `mysql … -e "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('is_fee_structure','is_transport') ORDER BY TABLE_NAME;"` — only rows for `charges` and `payments` should appear. Also query `information_schema.VIEWS` and `information_schema.ROUTINES` in the same schema and grep the `VIEW_DEFINITION` / `ROUTINE_DEFINITION` for `is_fee_structure` / `is_transport`; expected: zero rows.

**Checkpoint**: Foundation ready — reference surface is exactly {3 columns, 10 code files}. US2 can begin.

---

## Phase 3: User Story 2 — Clean Codebase Dependencies (Priority: P2) 🎯 MUST-PRECEDE-US1

**Goal**: Remove every read and write of the three legacy columns from the backend and frontend so that the application no longer touches them. After this phase, the columns still exist in the DB but are fully inert.

**Independent Test**: With the DB schema unchanged, restart the backend and run `curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/students/student_001 | jq '.data.payments[0]'` — the response must NOT contain `isFeeStructure`. Ledger and transport-payment endpoints must return 2xx.

**Why this runs before US1**: Expand/contract deploy safety (`@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/research.md:108-126`). Dropping the columns before the code stops referencing them would cause runtime errors.

### Implementation — Seeders & Factories (write sites)

- [ ] T006 [P] [US2] Remove `'is_fee_structure' => 1` / `'is_transport' => 0` from the default row in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Database/Seeds/Factories/ChargeFactory.php:86-87`
- [ ] T007 [P] [US2] Remove `'is_fee_structure' => 1` from the default row in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Database/Seeds/Factories/PaymentFactory.php:64`
- [ ] T008 [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Database/Seeds/CompleteDatabaseSeeder.php`: remove `'is_fee_structure'` / `'is_transport'` keys from the fee-charge insertBatch near line 395, from the transport-charge row near line 429, and from the payment rows near lines 451-453. Verify each row still has `charge_type` (for charges) and `category` (for payments) set correctly.

### Implementation — Controllers (write sites)

- [ ] T009 [US2] Remove the `'is_fee_structure' => 1` key from the three charge-insert payloads in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Controllers/Api/LedgerController.php` at lines 222, 774, and 1294. Each payload already sets `'charge_type' => 'fee_structure'` (or equivalent); no replacement is needed.
- [ ] T010 [US2] Remove the `'is_fee_structure' => 1` key from the opening-balance charge insert in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Controllers/Api/StudentController.php:479`. The adjacent line already sets `'charge_type' => 'fee_structure'`.
- [ ] T011 [US2] Remove `'is_fee_structure' => null` from the transport-payment insert in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Controllers/Api/TransportController.php:964`

### Implementation — Controllers (read sites / API formatters)

- [ ] T012 [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Controllers/Api/StudentController.php:290`, remove the line `'isFeeStructure' => (bool) ($p['is_fee_structure'] ?? false),` from the payment-mapping block inside `getStudent`.
- [ ] T013 [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Controllers/Api/StudentController.php:1675`, remove the line `'isFeeStructure' => (bool) ($c['is_fee_structure'] ?? false),` from the charge-mapping block in the ledger-view response builder.
- [ ] T014 [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Controllers/Api/StudentController.php:1686`, remove the line `'isFeeStructure' => (bool) ($p['is_fee_structure'] ?? false),` from the payment-mapping block in the ledger-view response builder.

### Implementation — Models (`allowedFields`)

- [ ] T015 [P] [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Models/ChargeModel.php:24`, remove `'is_fee_structure', 'is_transport'` from the `$allowedFields` array. Keep `'billing_run_id', 'academic_year'` for now (deferred per `research.md` Decision 5).
- [ ] T016 [P] [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Models/PaymentModel.php:15`, remove `'is_fee_structure'` from the `$allowedFields` array.

### Implementation — Frontend type

- [ ] T017 [P] [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/frontend/src/types/dashboard.ts:95-97`, remove the three-line block containing `// Legacy fields for backward compatibility`, `isFeeStructure?: boolean;`, and `isTransport?: boolean;` from the `Charge` interface.

### Implementation — Stale comments

- [ ] T018 [P] [US2] In `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Models/StudentModel.php:470`, update the comment from `// Get total charges using charge_type ENUM (retiring is_fee_structure/is_transport columns)` to `// Get total charges using charge_type ENUM`. Code below is unchanged.

### Verification for US2

- [ ] T019 [US2] Run `php spark serve` in one terminal; in another run the three smoke curl commands from `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/quickstart.md:30-45`. All must return 2xx and responses must NOT include `isFeeStructure` or `isTransport`.
- [ ] T020 [US2] Re-run the grep from T004. Expected: zero hits in `backend/app/Controllers`, `backend/app/Models`, and `frontend/src`. Hits remaining ONLY in `backend/app/Database/Migrations/*` (historical) are acceptable.
- [ ] T021 [US2] Run `npm run lint && npm run build` from `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/frontend`. Both must pass.

**Checkpoint**: Application no longer touches the legacy columns. DB still has them (inert). Safe to deploy US2 alone if needed.

---

## Phase 4: User Story 1 — Clean Database Schema (Priority: P1) 🎯 MVP

**Goal**: Drop the three legacy columns from the physical database schema with a reversible migration.

**Independent Test**: After `php spark migrate`, `SHOW COLUMNS FROM charges LIKE 'is_%structure'` and `SHOW COLUMNS FROM payments LIKE 'is_fee_structure'` both return zero rows. After `php spark migrate:rollback`, the columns reappear (with NULL values).

**Dependency**: Phase 3 (US2) must be fully deployed and verified. Running this phase before US2 would break the application.

### Implementation — New migration

- [ ] T022 [US1] Create `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend/app/Database/Migrations/2026-04-21-000000_Drop_legacy_charge_and_payment_flags.php` with class `Drop_legacy_charge_and_payment_flags extends Migration`. The `up()` method MUST: (a) guard each drop with `$this->db->fieldExists(...)` for idempotence, (b) call `$this->forge->dropColumn('charges', ['is_fee_structure', 'is_transport'])`, (c) call `$this->forge->dropColumn('payments', 'is_fee_structure')`. The `down()` method MUST re-add all three columns with their original definitions (`charges.is_fee_structure` TINYINT(1) NULL default NULL, `charges.is_transport` BOOLEAN default false, `payments.is_fee_structure` TINYINT(1) NULL default NULL) without data. The class docblock MUST note: *"Data in the dropped columns is discardable because `charge_type` (charges) and `category` (payments) provide the equivalent semantics. See specs/039-eliminate-legacy-columns/research.md Decision 3."*

### Verification for US1

- [ ] T023 [US1] From `/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend` run `php spark migrate`. Expected log line: `Running: App\Database\Migrations\Drop_legacy_charge_and_payment_flags`. No errors.
- [ ] T024 [US1] Confirm the drop with `mysql … -e "SHOW COLUMNS FROM charges LIKE 'is_fee_structure'; SHOW COLUMNS FROM charges LIKE 'is_transport'; SHOW COLUMNS FROM payments LIKE 'is_fee_structure';"` — all three must return zero rows. Then compare charges/payments row counts and total amounts against the snapshot from T003; deltas MUST be zero.
- [ ] T025 [US1] On a scratch database (NOT production), verify reversibility: `php spark migrate:rollback` then re-check the three `SHOW COLUMNS` statements; all three must return one row each. Re-apply with `php spark migrate` and confirm they are gone again.

**Checkpoint**: Schema is clean. Application is fully operational. MVP complete.

---

## Phase 5: User Story 3 — Data Integrity Preservation (Priority: P3)

**Goal**: Prove that after both column removal and code cleanup, active features work correctly and no user-visible data is lost.

**Independent Test**: Full smoke run from `quickstart.md` Steps 4 and 6 passes; balance totals match the pre-change snapshot; no user-facing regressions.

**Dependency**: Phases 3 and 4 complete.

- [ ] T026 [US3] Execute every curl command in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/quickstart.md:49-74` (Step 4, four calls: student list with `balanceOnly`, student detail, transport payment create, charge generation). All must return HTTP 2xx.
- [ ] T027 [US3] Re-run the full balance-regression query from T003 post-change and confirm charges/payments row counts and total amounts are identical to the T003 snapshot (excluding any new rows created by T026). Any drift in totals indicates accidental data loss and MUST block merge.
- [ ] T028 [US3] Manually exercise the frontend pages that render charges and payments (at minimum: Student detail, Ledger, Transport assignments). Confirm no JavaScript console errors referencing `isFeeStructure` or `isTransport` and that all amounts/categories render correctly.
- [ ] T029 [P] [US3] Run the final grep sweep from `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/quickstart.md:104-115`. Only matches in `backend/app/Database/Migrations/*` are acceptable.

**Checkpoint**: All three success criteria groups (SC-001 through SC-006 in `spec.md`) are verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Update `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/CLAUDE.md` "Recent Changes" section with a one-line entry: `039-eliminate-legacy-columns: Dropped charges.is_fee_structure, charges.is_transport, payments.is_fee_structure (superseded by charge_type ENUM). API no longer emits isFeeStructure / isTransport.`
- [ ] T031 Mark `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/spec.md` header `Status` field from `Draft` to `Complete`.
- [ ] T032 Tick all items in `@/home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/specs/039-eliminate-legacy-columns/checklists/requirements.md` that have been verified by Phases 3–5.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies
- **Phase 2 (Foundational)**: depends on Phase 1; BLOCKS US1 and US2
- **Phase 3 (US2 — code cleanup)**: depends on Phase 2; **MUST precede Phase 4**
- **Phase 4 (US1 — schema drop)**: depends on Phase 3 fully merged and deployed
- **Phase 5 (US3 — integrity verification)**: depends on Phases 3 and 4
- **Phase 6 (Polish)**: depends on Phase 5

### Task-level dependencies inside each phase

- T008 depends on T006, T007 only for review consistency (same theme) — can run in parallel if different committers
- T009–T011 are in different files, fully parallel with each other and with T006–T008, T015–T018
- T012–T014 all edit `StudentController.php` and MUST be sequential (same file)
- T019, T020, T021 depend on T006–T018 completing
- T022 is single-file and depends on T019–T021 passing (to guarantee no code still references the columns)
- T023 depends on T022
- T024 depends on T023 and on the T003 snapshot
- T025 requires a scratch DB and depends on T024
- T026–T029 depend on T025
- T030–T032 depend on T029

### Parallel opportunities

```bash
# Phase 1 — run in parallel:
Task: T002  # frontend env check
Task: T003  # DB snapshot

# Phase 3 — these are in different files and can run fully in parallel:
Task: T006  # ChargeFactory.php
Task: T007  # PaymentFactory.php
Task: T009  # LedgerController.php
Task: T011  # TransportController.php
Task: T015  # ChargeModel.php
Task: T016  # PaymentModel.php
Task: T017  # frontend types/dashboard.ts
Task: T018  # StudentModel.php (comment-only edit)

# T012, T013, T014 all touch StudentController.php — MUST be sequential
# T008 touches CompleteDatabaseSeeder.php only — parallel with the set above

# Phase 5 — only T029 is marked [P]; the others must run sequentially after a deploy
```

---

## Implementation Strategy

### MVP scope

This feature is itself a cleanup MVP. The smallest shippable increment is **Phases 1 + 2 + 3 (US2) only** — the database still has the columns but nothing touches them. This can be deployed and validated before committing to Phase 4's destructive migration. Recommended:

1. Complete Phases 1 + 2 + 3 → merge and deploy → validate in production for ≥1 business day.
2. Complete Phase 4 in a scheduled maintenance window → verify with Phase 5.
3. Run Phase 6 polish.

### Incremental delivery

- **Increment A** (Phases 1–3): code stops reading/writing the columns. Reversible by reverting the commit. Low risk.
- **Increment B** (Phase 4): columns dropped. Reversible only by `migrate:rollback` (schema only — data is gone, which is acceptable per research.md).
- **Increment C** (Phases 5–6): verification and docs.

### Single-developer sequential path (no parallelism)

If executed by one developer end-to-end, the path is simply T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032.

---

## Notes

- Only 32 tasks — this is a deliberately small, surgical refactor.
- No test tasks were generated (tests not requested in spec.md; verification is migration-safety + grep sweep based).
- US2 (P2) runs before US1 (P1) because expand/contract deploy order requires code changes to ship first. This is an intentional deviation from default priority-order execution and is documented in `research.md` Decision 4.
- The single `StudentController.php` file accumulates T010, T012, T013, T014 — these MUST stay sequential to avoid merge conflicts.
- Avoid batching T022 with any other task: the migration file is the only destructive change and deserves its own commit.
