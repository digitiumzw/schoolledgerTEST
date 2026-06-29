# Tasks: Fix Student Balance & KPI Accuracy

**Input**: Design documents from `/specs/002-fix-student-balance/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

**Tests**: Not requested. No test tasks generated.

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1 and touch different files — they can be implemented in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no conflicting dependencies)
- **[Story]**: User story label — US1 through US4

## Path Conventions

- **Backend model**: `backend/app/Models/StudentModel.php`
- **Backend controller**: `backend/app/Controllers/Api/StudentsOptimizedController.php`
- **Frontend page**: `frontend/src/pages/Students.tsx`

---

## Phase 1: Setup

**Purpose**: Confirm the dev environment and working branch before any code changes.

- [x] T001 Verify the active git branch is `002-fix-student-balance` (`git branch --show-current`) and both backend and frontend dev servers start without errors
- [x] T002 Read `specs/002-fix-student-balance/plan.md` in full — understand the 5 implementation steps and the balance formula before touching any code

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared infrastructure changes are required for this bug fix. No migrations, no new routes, no new dependencies. Phase 2 is a no-op — both user story tracks (US1 and US2) can begin immediately after Phase 1.

**⚠️ CRITICAL**: US1 and US2 touch different methods/files and can proceed in parallel.

---

## Phase 3: User Story 1 — Accurate Balance per Student in Table (Priority: P1) 🎯 MVP

**Goal**: Every student's balance column in the Students table reflects the full formula: `SUM(active_charges) + SUM(approved_debits) − SUM(payments) − SUM(approved_credits)`, with voided charges excluded.

**Independent Test**: Pick a student who has at least one payment and one approved ledger adjustment. Compute the expected balance manually from the database. Open the Students page and confirm the displayed balance matches exactly.

### Implementation for User Story 1

- [x] T003 [US1] In `backend/app/Models/StudentModel.php`, method `getFilteredStudents()`: add two LEFT JOIN subqueries for `ledger_adjustments` (one for `adjustment_type = 'debit' AND status = 'approved'`, one for `adjustment_type = 'credit' AND status = 'approved'`), both scoped to `tenant_id = {$escapedTenantId}` and grouped by `student_id`
- [x] T004 [US1] In `backend/app/Models/StudentModel.php`, method `getFilteredStudents()`: update the SELECT balance expression from `COALESCE(charges.total, 0) - COALESCE(payments.total, 0) as balance` to `COALESCE(charges.total, 0) + COALESCE(debits.total, 0) - COALESCE(payments.total, 0) - COALESCE(credits.total, 0) AS balance` — aliases `debits` and `credits` match the new JOINs from T003
- [x] T005 [US1] In `backend/app/Models/StudentModel.php`, method `getFilteredStudentsCount()`, `$balanceOnly = true` branch: add two additional LEFT JOIN subqueries for `ledger_adjustments` (debit and credit, same filters as T003) to the raw SQL string; add two corresponding `$tenantId` entries to `$params`
- [x] T006 [US1] In `backend/app/Models/StudentModel.php`, method `getFilteredStudentsCount()`, `$balanceOnly = true` branch: update the WHERE balance filter from `COALESCE(charges.total, 0) - COALESCE(payments.total, 0)) > 0` to include the adjustment terms: `(COALESCE(charges.total, 0) + COALESCE(debits.total, 0) - COALESCE(payments.total, 0) - COALESCE(credits.total, 0)) > 0`

**Checkpoint**: Open the Students page. For a student with known adjustments, the balance column must now match the full formula. The `balanceOnly` filter must show only students whose corrected balance is > 0.

---

## Phase 4: User Story 2 — Accurate KPI Cards Across All Students (Priority: P1)

*(This phase also delivers User Story 3 — Correct "Owing Fees" Percentage, because both are resolved by the same backend change.)*

**Goal**: All KPI cards (Active Students, Total Across All Statuses, Owing Fees, Total Fees Owed) reflect the full tenant student population, not just the students on the current page.

**Independent Test**: On a tenant with more than one page of students, record all KPI card values on page 1. Navigate to page 2. All KPI values must be identical to page 1.

### Implementation for User Story 2

- [x] T007 [P] [US2] In `backend/app/Models/StudentModel.php`, add a new public method `getGlobalStats(string $tenantId): array` immediately after `getFilteredStudentsCount()`. The method executes a single nested-subquery SQL statement that returns: `total_students`, `active_count`, `inactive_count`, `graduated_count`, `transferred_count`, `dropped_out_count`, `students_with_outstanding_balance`, `total_fees_owed`, `students_on_financial_aid`. The inner subquery computes `balance` using the same four-join formula as T003/T004 (charges + debits − payments − credits, all scoped by `{$escapedTenantId}`). The outer query aggregates with `COUNT(*)`, `SUM(CASE WHEN ...)` expressions. Returns a PHP array matching the shape in `specs/002-fix-student-balance/data-model.md` — including `studentsOnFinancialAid` (integer count) and `bursaryCoveragePercentage` (percentage computed as `studentsOnFinancialAid / active_count × 100`, rounded to one decimal)
- [x] T008 [US2] In `backend/app/Controllers/Api/StudentsOptimizedController.php`, method `index()`: replace line `$stats = $this->calculateStudentStats($formattedStudents);` with `$stats = $this->studentModel->getGlobalStats($tenantId);`
- [x] T009 [US2] In `backend/app/Controllers/Api/StudentsOptimizedController.php`: delete the private `calculateStudentStats(array $students): array` method entirely (it is replaced by `getGlobalStats()` and is no longer called)

**Checkpoint**: With multiple pages of students, all KPI card values must be stable across page navigation. Verify the Owing Fees count and percentage match a direct SQL count of students with corrected balance > 0 across the full tenant.

---

## Phase 5: User Story 4 — On Financial Aid Count Display (Priority: P2)

*(User Story 3 — Correct "Owing Fees" Percentage — is already complete after Phase 4. This phase handles the remaining P2 story: showing financial aid count as the primary KPI value.)*

**Goal**: The "On Financial Aid" KPI card displays the count of students with any bursary status as the headline number, with the percentage shown as secondary text.

**Independent Test**: Count students in the database where `bursary_status != 'none'`. The "On Financial Aid" card headline must show that integer count. The sub-text must show the correct percentage of active students.

### Implementation for User Story 4

- [x] T010 [US4] In `frontend/src/pages/Students.tsx`, update the `stats` initial state object (the `useState` call around line 37) to add `studentsOnFinancialAid: 0` to the initial value, so the new field has a safe default before data loads
- [x] T011 [US4] In `frontend/src/pages/Students.tsx`, update the "On Financial Aid" KPI card body (around line 593): change the headline `<p>` from `{stats.bursaryCoveragePercentage}%` to `{stats.studentsOnFinancialAid ?? 0}` (count as the primary value); update the sub-text `<p>` to `{stats.statusCounts.active > 0 ? \`${stats.bursaryCoveragePercentage}% of active students\` : "—"}` so the percentage remains visible as secondary information

**Checkpoint**: The "On Financial Aid" card headline shows an integer count. The sub-text shows a percentage. Both values match the full tenant population computed in T007.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation against the full verification checklist in `specs/002-fix-student-balance/quickstart.md`.

- [x] T012 [P] Run the backend dev server (`php spark serve` in `backend/`) and the frontend dev server (`npm run dev` in `frontend/`) and confirm both start without errors after all code changes
- [ ] T013 Work through every item in the verification checklist in `specs/002-fix-student-balance/quickstart.md`:
  - A student with charges, payments, and approved adjustments shows the correct net balance
  - A student with a soft-deleted charge does NOT have it counted in their balance
  - Navigating page 1 → page 2 shows identical KPI card values
  - Owing Fees count matches a direct DB count of students with corrected balance > 0
  - Total Fees Owed matches the DB SUM of all positive corrected balances
  - On Financial Aid shows count as headline and correct percentage as sub-text
  - Applying the "balance only" filter changes table rows but NOT the KPI card values

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Empty — no blocking tasks
- **US1 (Phase 3)**: Can start after Phase 1 — independent of Phase 4
- **US2 (Phase 4)**: Can start after Phase 1 — independent of Phase 3
- **US4 (Phase 5)**: Depends on Phase 4 completion (needs `studentsOnFinancialAid` in the API response)
- **Polish (Phase 6)**: Depends on Phases 3, 4, and 5 all complete

### User Story Dependencies

- **US1 (P1)**: Independent — only touches `StudentModel::getFilteredStudents()` and `getFilteredStudentsCount()`
- **US2+US3 (P1)**: Independent — only touches `StudentModel::getGlobalStats()` (new) and `StudentsOptimizedController::index()`
- **US4 (P2)**: Depends on US2/US3 (needs `studentsOnFinancialAid` from the API); touches `Students.tsx` only

### Within Each Phase

- T003 before T004 (JOIN aliases must exist before SELECT references them)
- T005 before T006 (same reason for count query)
- T007 before T008 (method must exist before controller calls it)
- T008 before T009 (confirm controller works before deleting old method)
- T010 before T011 (state shape must be updated before the JSX reads the new field)

### Parallel Opportunities

- **Phase 3 and Phase 4** can run in parallel — they touch different methods/classes
- T003 and T005 can run in parallel (different methods in the same file — coordinate to avoid merge conflicts if pair-programming)
- T007 (new method) and T010 (frontend state init) can run in parallel

---

## Parallel Example: US1 and US2 (simultaneous)

```
Developer A — Phase 3 (US1):
  T003: Add adjustment JOINs to getFilteredStudents()
  T004: Update balance SELECT in getFilteredStudents()
  T005: Add adjustment JOINs to getFilteredStudentsCount() balanceOnly branch
  T006: Update balance WHERE in getFilteredStudentsCount() balanceOnly branch

Developer B — Phase 4 (US2):
  T007: Add getGlobalStats() method to StudentModel
  T008: Update StudentsOptimizedController to call getGlobalStats()
  T009: Delete calculateStudentStats() from controller
```

Both tracks merge cleanly — A edits existing methods; B adds a new method and edits the controller.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Read plan and verify environment
2. Complete Phase 3: Fix balance formula in StudentModel (T003–T006)
3. **STOP and VALIDATE**: Confirm individual student balances are correct
4. This alone fixes the most critical accuracy issue (balance column)

### Full Delivery

1. Phase 1 → Phase 3 (US1) + Phase 4 (US2+US3) in parallel
2. **Checkpoint**: KPI cards now accurate; balance column now accurate
3. Phase 5 (US4): Update On Financial Aid card
4. Phase 6: Full verification checklist

---

## Notes

- No migrations, no new routes, no new dependencies — this is a pure bug fix
- [P] tasks run against different files; coordinate if working in the same file simultaneously
- The `HAVING balance > 0` clause in `getFilteredStudents()` references the alias — it automatically benefits from the corrected formula without any additional change
- `$escapedTenantId` is already set at the top of `getFilteredStudents()` using `$db->escape()` — use the same pattern in `getGlobalStats()` for the inline subqueries
- After T009, run a search for `calculateStudentStats` to confirm no remaining references exist
