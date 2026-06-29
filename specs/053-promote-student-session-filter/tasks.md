# Tasks: Promote Student – Session-Scoped Preview & Filtering

**Input**: Design documents from `/specs/053-promote-student-session-filter/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api.md ✅ · quickstart.md ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: User story this task belongs to
- Paths follow the **Web app** convention: `backend/` and `frontend/`

---

## Phase 1: Setup (No prerequisites)

**Purpose**: Confirm working environment and branch before any code changes.

- [x] T001 Verify feature branch `053-promote-student-session-filter` is checked out and up-to-date with main

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: The one model-layer change that every other task depends on.

**⚠️ CRITICAL**: T002 must be complete before any controller or UI task can be correctly implemented.

- [x] T002 Add optional `?string $academicSession = null` parameter to `ClassModel::getStudentsForPromotion()` in `backend/app/Models/ClassModel.php`; when the parameter is non-null, append `->where('enrollments.academic_session', $academicSession)` to the existing query before `->get()`

**Checkpoint**: `getStudentsForPromotion()` now filters by session when a value is supplied. All existing callers still work because the parameter is optional (default `null`).

---

## Phase 3: User Story 1 – Preview Displays Active-Session Scope Clearly (Priority: P1) 🎯 MVP

**Goal**: The migration preview modal and both preview endpoints only count/list students enrolled in the current academic session.

**Independent Test**: Open the migration preview modal with a mixed-session dataset. Verify students from prior sessions do not appear in any count or student list, and students from the current session do.

### Implementation for User Story 1

- [x] T003 [US1] In `backend/app/Controllers/Api/StudentController.php`, update `migrationPreview()` to pass `$academicSession` to every `$this->classModel->getStudentsForPromotion($class['id'])` call (line ~1122)
- [x] T004 [P] [US1] In `backend/app/Controllers/Api/ClassController.php`, inject `AcademicSessionService` into `ClassController` constructor (if not already present) and assign to `$this->sessionService`
- [x] T005 [US1] In `backend/app/Controllers/Api/ClassController.php`, update `getPromotionPreview()` to resolve the current session via `$this->sessionService->getCurrentSession($tenantId)` and pass it to `$this->classModel->getStudentsForPromotion($class['id'])` (line ~778)
- [x] T006 [US1] In `frontend/src/components/modals/MigrationPreviewModal.tsx`, add a session scope `Alert` (info/default variant) inside `<AlertDialogContent>` immediately before the existing warning banners (after `<AlertDialogHeader>`), shown only when `preview.academicSession` is truthy; text: `"Only students actively enrolled in {preview.academicSession} will be promoted to {preview.nextSession}."`
- [x] T007 [US1] In `frontend/src/components/modals/MigrationPreviewModal.tsx`, update the `AlertDialogDescription` text to remove the now-redundant generic phrasing (replace "This action will promote students to their next academic session and update class assignments." with a shorter confirmation copy)

**Checkpoint**: Preview modal shows the correct session-scoped cohort and a visible session banner. Manually verify with a mixed-session dataset per `quickstart.md`.

---

## Phase 4: User Story 2 – Promotion Engine Filters by Current Session (Priority: P2)

**Goal**: `POST /api/students/promote` (bulk) only promotes students enrolled in the current academic session; the promotion result counts match the preview.

**Independent Test**: Call `POST /api/students/promote` with a mixed-session dataset. Confirm `promoted` count equals only the current-session students and prior-session students are unchanged.

### Implementation for User Story 2

- [x] T008 [US2] In `backend/app/Controllers/Api/StudentController.php`, update `promote()` to pass `$academicSession` to `$this->classModel->getStudentsForPromotion($class['id'])` inside the `$preloadedStudents` snapshot loop (line ~827)
- [x] T009 [US2] In `backend/app/Controllers/Api/StudentController.php`, update `promotionPreview()` to pass `$academicSession` to `$this->classModel->getStudentsForPromotion($class['id'])` (line ~1059) so preview counts stay consistent with the promote endpoint

**Checkpoint**: Bulk promote and preview endpoints return identical session-scoped student sets. Confirm via the mixed-session test scenario in `quickstart.md`.

---

## Phase 5: User Story 3 – Persistent Session Scope Banner in Preview Modal (Priority: P3)

**Goal**: The session scope `Alert` banner is always visible when the preview modal is open and a session is configured, even when zero students are eligible.

**Independent Test**: Open the migration preview with no students enrolled in the current session. The session banner is still displayed and all summary counters show 0.

### Implementation for User Story 3

- [x] T010 [US3] In `frontend/src/components/modals/MigrationPreviewModal.tsx`, confirm the session scope `Alert` added in T006 renders outside any conditional block that depends on `preview.migrations.length > 0` or similar; it must appear for all non-null `preview.academicSession` values regardless of student counts
- [x] T011 [US3] In `frontend/src/components/modals/MigrationPreviewModal.tsx`, add an `Info` icon (from `lucide-react`, already available) to the session scope `Alert` for visual consistency with the rest of the modal's alert pattern

**Checkpoint**: Banner visible even with zero eligible students. Visually matches existing alert styles.

---

## Phase 6: Integration Tests (Constitution Principle X)

**Purpose**: Verify end-to-end behavior across controller → model → database.

- [x] T012 [P] Create `backend/tests/Controllers/Students/PromotionSessionFilterTest.php` with test case `testMigrationPreviewOnlyIncludesCurrentSessionStudents`: seed two students (one enrolled in current session `2026/2027`, one in prior session `2025/2026`), call `GET /api/students/migration-preview`, assert `summary.totalStudents === 1` and the returned student belongs to session `2026/2027`
- [x] T013 [P] In `backend/tests/Controllers/Students/PromotionSessionFilterTest.php`, add test case `testBulkPromoteOnlyProcessesCurrentSessionStudents`: same mixed-session seed, call `POST /api/students/promote`, assert `promoted === 1` and the prior-session student's enrollment is unchanged
- [x] T014 [P] In `backend/tests/Controllers/Students/PromotionSessionFilterTest.php`, add test case `testMigrationPreviewWithNoCurrentSessionStudents`: seed only prior-session students, assert preview returns `totalStudents: 0` and an empty `migrations` array

**Checkpoint**: Run `php spark test --filter PromotionSessionFilterTest` from `backend/`. All 3 tests pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T015 [P] In `backend/app/Models/ClassModel.php`, update the docblock on `getStudentsForPromotion()` to document the new `$academicSession` parameter and its effect
- [x] T016 [P] In `backend/app/Controllers/Api/ClassController.php`, verify `tenant_id` is still the first filter applied in `getStudentsForPromotion` call chain (Constitution Principle I audit)
- [ ] T017 Run the full quickstart.md validation scenario manually: mixed-session seed → open preview modal → verify banner text → confirm migration → verify prior-session student unchanged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS Phases 3, 4, 5, 6**
- **Phase 3 (US1 — Preview)**: Depends on Phase 2
- **Phase 4 (US2 — Engine)**: Depends on Phase 2; can run in parallel with Phase 3 (different files)
- **Phase 5 (US3 — Banner)**: Depends on T006 (Phase 3) being complete
- **Phase 6 (Tests)**: Depends on Phases 3 and 4 being complete
- **Phase 7 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Unblocked after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Unblocked after Phase 2 — can run in parallel with US1 (different controller methods)
- **US3 (P3)**: Depends on T006 from US1 (adds to the same component)

### Parallel Opportunities

- T003 (backend `migrationPreview`) and T004+T005 (backend `ClassController`) operate in different files — can run in parallel after T002
- T003 and T006+T007 (frontend) are in entirely different repos — can run in parallel after T002
- T008 and T009 (US2) touch different methods in the same file — can be done sequentially by one dev or split if both methods are in non-overlapping regions
- T012, T013, T014 (test cases) are independent test methods — can be written in parallel

---

## Parallel Example: User Story 1 + User Story 2

```bash
# After T002 completes, both stories can proceed simultaneously:

# Developer A works on US1 (preview endpoints):
Task T003: backend/app/Controllers/Api/StudentController.php → migrationPreview()
Task T005: backend/app/Controllers/Api/ClassController.php  → getPromotionPreview()
Task T006: frontend/src/components/modals/MigrationPreviewModal.tsx → banner
Task T007: frontend/src/components/modals/MigrationPreviewModal.tsx → description

# Developer B works on US2 (promote engine) simultaneously:
Task T008: backend/app/Controllers/Api/StudentController.php → promote()
Task T009: backend/app/Controllers/Api/StudentController.php → promotionPreview()
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 (Setup)
2. Complete T002 (Foundational — model change)
3. Complete T003–T007 (User Story 1 — preview scope + banner)
4. **STOP and VALIDATE**: Open preview modal with mixed-session data, confirm session banner visible and counts correct
5. Demo to stakeholder

### Incremental Delivery

1. T001 + T002 → Foundation ready
2. T003–T007 → Preview shows correct session scope (MVP ✅)
3. T008–T009 → Bulk promote engine aligned with preview
4. T010–T011 → Banner always visible, with icon
5. T012–T014 → Integration tests added
6. T015–T017 → Polish and final validation

---

## Notes

- **[P]** tasks operate on different files or non-conflicting code regions
- **T002 is the single most critical task** — all backend behaviour changes flow from the model fix
- Individual student promote (`POST /api/students/:id/promote`) is intentionally **not changed** — see `research.md` Decision 5
- No database migration required — `enrollments.academic_session` column already exists
- Run `php spark test --filter PromotionSessionFilterTest` to validate backend changes
