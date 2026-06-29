# Tasks: Classes Module Redesign

**Input**: Design documents from `/specs/003-redo-classes-module/`
**Branch**: `003-redo-classes-module`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tests**: Not requested in specification — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task

## Path Conventions

- Backend: `backend/app/`
- Frontend: `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Verify branch state and confirm migrations are in place before any code is written.

- [x] T001 Confirm active branch is `003-redo-classes-module` and working tree is clean
- [x] T002 Verify `backend/.env` is configured and `php spark migrate` succeeds on current schema

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema additions and new model/controller skeletons that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Create migration `backend/app/Database/Migrations/2026-04-03-120000_Create_grade_levels_table.php` — table with columns: `id VARCHAR(50) PK`, `tenant_id VARCHAR(50) NOT NULL FK→tenants.id CASCADE`, `name VARCHAR(100) NOT NULL`, `sort_order INT NOT NULL DEFAULT 0`, `created_at DATETIME NULL`, `updated_at DATETIME NULL`; UNIQUE index on `(tenant_id, name)`; `down()` drops the table

- [x] T004 Create migration `backend/app/Database/Migrations/2026-04-03-130000_Add_grade_fields_to_classes.php` — adds nullable `grade_level_id VARCHAR(50)` and nullable `stream VARCHAR(50)` to `classes`; FK `grade_level_id → grade_levels.id SET NULL`; INDEX on `grade_level_id`; `down()` removes both columns; NOTE: do not add a unique index on `(tenant_id, grade_level_id, stream)` at DB level (enforce in application to handle NULL edge cases cleanly)

- [x] T005 Run `php spark migrate` to apply T003 and T004 and confirm no errors

- [x] T006 [P] Create `backend/app/Models/GradeLevelModel.php` — extend `Model`; `$table = 'grade_levels'`; `$allowedFields = ['id','tenant_id','name','sort_order','created_at','updated_at']`; `$useTimestamps = true`; stub out: `getByTenant(string $tenantId): array`, `formatForApi(array $gradeLevel): array`, `formatFromApi(array $data, string $tenantId): array`, `getNextSortOrder(string $tenantId): int`

- [x] T007 [P] Update `backend/app/Models/ClassModel.php` — add `grade_level_id` and `stream` to `$allowedFields`; update `formatForApi()` to include `gradeLevelId`, `stream`, and `gradeLevel` (nullable embedded object); update `formatFromApi()` to map `gradeLevelId → grade_level_id` and `stream → stream`

- [x] T008 Create `backend/app/Controllers/Api/GradeLevelController.php` — extend `BaseApiController`; constructor injects `GradeLevelModel`; stub out methods: `index()`, `show($id)`, `create()`, `update($id)`, `delete($id)`, `reorder()`; each method returns `$this->error('Not implemented', 501)` for now

- [x] T009 Add grade-level routes to `backend/app/Config/Routes.php` inside the existing JWT-filtered route group — add: `GET api/grade-levels`, `GET api/grade-levels/reorder` (must precede segment route), `GET api/grade-levels/(:segment)`, `POST api/grade-levels`, `PUT api/grade-levels/reorder`, `PUT api/grade-levels/(:segment)`, `DELETE api/grade-levels/(:segment)`

- [x] T010 [P] Add grade-level API functions to `frontend/src/api/api.ts` — add: `getGradeLevels(): Promise<GradeLevel[]>`, `getGradeLevelById(id: string)`, `createGradeLevel(data: { name: string; sortOrder?: number })`, `updateGradeLevel(id: string, data: Partial<...>)`, `deleteGradeLevel(id: string)`, `reorderGradeLevels(order: Array<{id: string; sortOrder: number}>)`; add `GradeLevel` TypeScript interface with fields: `id`, `tenantId`, `name`, `sortOrder`, `classCount`

- [x] T011 [P] Add `gradeLevelId`, `stream`, and `gradeLevel` fields to the existing `Class` TypeScript interface in `frontend/src/api/api.ts`; update `createClass` and `updateClass` payloads to include `gradeLevelId` and `stream`

**Checkpoint**: Schema applied, model/controller skeletons exist, routes registered, frontend API functions defined — user story implementation can begin.

---

## Phase 3: User Story 1 — Set Up the School's Class Structure (Priority: P1) 🎯 MVP

**Goal**: Administrators can create grade levels, assign classes to them (with a stream label), and view the class list grouped by grade level.

**Independent Test**: Create two grade levels ("Grade 6", "Grade 7"), add one class under each, view the class list — confirm grade level headers and correct grouping; create a duplicate stream in the same grade and confirm rejection.

### Backend implementation

- [x] T012 [US1] Implement `GradeLevelModel::getByTenant()` in `backend/app/Models/GradeLevelModel.php` — query `grade_levels WHERE tenant_id = ? ORDER BY sort_order ASC`; include `classCount` via a subquery (`SELECT COUNT(*) FROM classes WHERE grade_level_id = grade_levels.id AND archived_at IS NULL`)

- [x] T013 [US1] Implement `GradeLevelModel::formatForApi()` in `backend/app/Models/GradeLevelModel.php` — return camelCase fields: `id`, `tenantId`, `name`, `sortOrder`, `classCount`

- [x] T014 [US1] Implement `GradeLevelModel::formatFromApi()` in `backend/app/Models/GradeLevelModel.php` — map `name`, `sortOrder` (default to `getNextSortOrder()` result)

- [x] T015 [US1] Implement `GradeLevelModel::getNextSortOrder()` in `backend/app/Models/GradeLevelModel.php` — `SELECT MAX(sort_order) + 1 FROM grade_levels WHERE tenant_id = ?`; return 1 if no rows exist

- [x] T016 [US1] Implement `GradeLevelController::index()` in `backend/app/Controllers/Api/GradeLevelController.php` — get `$tenantId` from JWT; call `getByTenant()`; return `$this->success($formatted)`

- [x] T017 [US1] Implement `GradeLevelController::show($id)` in `backend/app/Controllers/Api/GradeLevelController.php` — find by id + tenant_id; 404 if not found; return grade level with its classes (join `classes WHERE grade_level_id = id AND archived_at IS NULL`)

- [x] T018 [US1] Implement `GradeLevelController::create()` in `backend/app/Controllers/Api/GradeLevelController.php` — validate `name` required; check uniqueness `(tenant_id, name)`; generate ID with `$this->generateId('gl')`; insert; return 201

- [x] T019 [US1] Implement `GradeLevelController::update($id)` in `backend/app/Controllers/Api/GradeLevelController.php` — verify ownership; validate name uniqueness excluding self; update; return updated object

- [x] T020 [US1] Implement `GradeLevelController::delete($id)` in `backend/app/Controllers/Api/GradeLevelController.php` — verify ownership; update `classes SET grade_level_id = NULL WHERE grade_level_id = $id`; delete grade level; return success with `affectedClasses` count

- [x] T021 [US1] Implement `GradeLevelController::reorder()` in `backend/app/Controllers/Api/GradeLevelController.php` — accept `order` array of `{id, sortOrder}`; verify all IDs belong to tenant; wrap in `$db->transStart()`; bulk update sort_order; `$db->transComplete()`; return success

- [x] T022 [US1] Update `ClassController::create()` in `backend/app/Controllers/Api/ClassController.php` — validate `grade_level_id` (if provided) belongs to same tenant; validate stream uniqueness within grade (`SELECT COUNT(*) FROM classes WHERE tenant_id=? AND grade_level_id=? AND stream=?`); reject with 400 on duplicate stream

- [x] T023 [US1] Update `ClassController::update()` in `backend/app/Controllers/Api/ClassController.php` — same `grade_level_id` ownership check and stream uniqueness validation as T022, excluding the current class from the uniqueness check

- [x] T024 [US1] Update `ClassController::index()` in `backend/app/Controllers/Api/ClassController.php` — attach `gradeLevel` embedded object to each class response item (resolve from a single batch query: `SELECT * FROM grade_levels WHERE id IN (...)` keyed by id, then map onto each class); support new `?grade_level_id=` query param to filter classes by grade

### Frontend implementation

- [x] T025 [US1] Create `frontend/src/hooks/useGradeLevels.ts` — React Query hook using `useQuery(['grade-levels'], api.getGradeLevels)`; export `useGradeLevels()` returning `{ gradeLevels, isLoading, error }`

- [x] T026 [US1] Create `frontend/src/components/modals/AddGradeLevelModal.tsx` — shadcn Dialog; React Hook Form + Zod schema (`name: z.string().min(1)`, optional `sortOrder: z.number().int().min(0)`); on submit call `api.createGradeLevel()`; invalidate `['grade-levels']` query on success; show toast

- [x] T027 [US1] Update `frontend/src/components/modals/AddClassModal.tsx` — add `gradeLevelId` Select (populated from `useGradeLevels()`; options: ungrouped + each grade level) and `stream` text input; update Zod schema; pass both fields in the `createClass` payload

- [x] T028 [US1] Update `frontend/src/components/modals/EditClassModal.tsx` — same changes as T027 for the edit flow; pre-populate `gradeLevelId` and `stream` from the existing class data

- [x] T029 [US1] Refactor `frontend/src/pages/Classes.tsx` — group the class list by grade level: render a section header for each grade level (sorted by `sortOrder`) followed by its classes; render an "Ungrouped" section at the bottom for classes with no `gradeLevelId`; add "+ Grade Level" button that opens `AddGradeLevelModal`; wire `invalidateQueries(['classes'])` after grade level operations

**Checkpoint**: US1 complete — grade levels can be created, classes assigned to grades, and the class list shows grouped hierarchy. Independently testable without any other user story.

---

## Phase 4: User Story 2 — Manage Student Placement in Classes (Priority: P2)

**Goal**: Capacity is enforced server-side during student assignment; admins can override with explicit confirmation; student transfers are logged.

**Independent Test**: Create a class with capacity 4, attempt to assign 5 students without `force` — confirm 409 response; set `force: true` — confirm all 5 assigned; verify prior enrollment of one student is closed with status TRANSFERRED when assigned to a different class.

### Backend implementation

- [x] T030 [US2] Update `ClassController::assignStudents()` in `backend/app/Controllers/Api/ClassController.php` — before the transaction: (1) count current active enrollments in the class; (2) count how many provided `studentIds` are NOT already in this class; (3) if `(current + new) > capacity` and `force !== true`, return `$this->error('Class capacity exceeded', 409, ['capacity' => ..., 'currentEnrolled' => ..., 'attemptingToAdd' => ..., 'available' => ...])` ; (4) if `force === true` and caller is not admin/super_admin, return `$this->forbidden('Only administrators can override capacity limits')`; existing assignment transaction logic remains unchanged

- [x] T031 [US2] Rename the enrollment `remarks` in `ClassController::assignStudents()` in `backend/app/Controllers/Api/ClassController.php` — when a student is moved from one class to another, set the old enrollment's status to `EnrollmentModel::STATUS_TRANSFERRED` (not `STATUS_PROMOTED`) and remarks to `'Transferred to class via Assign Students modal'` to correctly reflect a mid-year class transfer vs. an end-of-year promotion

### Frontend implementation

- [x] T032 [US2] Update `frontend/src/components/modals/AssignStudentsModal.tsx` — display current enrollment vs. capacity (`X / Y`) when a class is selected; on assignment API call: catch 409 responses; show a confirmation dialog with the capacity details (`"Only N spaces available. Assign anyway?"`); on user confirmation, re-call `api.assignStudentsToClass()` with `force: true` appended to the payload; non-admin users see the warning but the override button is disabled

**Checkpoint**: US2 complete — capacity is enforced end-to-end with admin override. Independently testable without US3/US4/US5.

---

## Phase 5: User Story 3 — End-of-Year Class Progression (Priority: P3)

**Goal**: Bulk promotion respects grade-level structure; repeating students are auto-excluded; final-grade students graduate; a preview is shown before confirmation.

**Independent Test**: Create a class chain (Grade 6A → Grade 7A); add one student flagged `status = 'repeating'` and two `active` students; run `GET /api/classes/promotion-preview` — confirm repeating student is excluded; confirm `POST /api/students/promote` moves the two active students to Grade 7A with status PROMOTED.

### Backend implementation

- [x] T033 [US3] Update `ClassModel::getStudentsForPromotion()` in `backend/app/Models/ClassModel.php` — add `->where('students.status !=', 'repeating')` to the existing query so repeating students are excluded from bulk promotion results

- [x] T034 [US3] Update `ClassController::setNextClass()` in `backend/app/Controllers/Api/ClassController.php` — after the self-link check, add a cycle detection walk: starting from `$nextClassId`, follow `next_class_id` pointers until either reaching NULL (no cycle) or encountering `$id` (cycle detected → return `$this->error('Setting this next class would create a circular promotion chain', 400)`); cap the walk at 50 iterations to guard against any pre-existing partial cycles

- [x] T035 [US3] Update `ClassController::getPromotionPreview()` in `backend/app/Controllers/Api/ClassController.php` — add `gradeLevel` to each class item in the response (resolve via batch lookup as in T024); include individual student names in the preview (currently only count is returned) — add a `students` array per class item: `[{id, firstName, lastName, willGraduate}]`

### Frontend implementation

- [x] T036 [US3] Update `frontend/src/components/modals/MigrationPreviewModal.tsx` — display each class's grade level name next to the class name in the preview table; show "Graduating" badge for students in final-grade classes; display individual student names in the preview (using the updated API response from T035)

**Checkpoint**: US3 complete — promotion excludes repeating students, prevents circular chains, and shows full preview. Independently testable.

---

## Phase 6: User Story 4 — Class Overview and Reporting (Priority: P4)

**Goal**: Teachers see only their assigned classes; bursars see all classes with enrollment counts; the class detail view shows grade level, stream, homeroom teacher, capacity, and enrolled students.

**Independent Test**: Log in as a teacher account linked to a staff member who is homeroom teacher of one class; call `GET /api/classes` — confirm only that one class is returned. Log in as bursar; call `GET /api/classes` — confirm all classes returned with `studentCount` but no embedded `students` array.

### Backend implementation

- [x] T037 [US4] Update `ClassController::index()` in `backend/app/Controllers/Api/ClassController.php` — add role check at the start of the method: if `userHasRole('teacher')`, resolve the caller's staff ID by querying `SELECT id FROM staff WHERE user_id = ? AND tenant_id = ?` using `$this->getCurrentUser()->id`; if staff record found, return `$this->classModel->getByTeacher($staffId, $tenantId)` formatted; if staff record not found, return empty array with a 200

- [x] T038 [US4] Update `ClassController::show($id)` in `backend/app/Controllers/Api/ClassController.php` — for teacher role, verify the class's `teacher_id` matches the caller's staff ID (resolved same way as T037); return 403 if the teacher is not the homeroom teacher of the requested class

### Frontend implementation

- [x] T039 [P] [US4] Update `frontend/src/pages/Classes.tsx` — read the current user's role from `AuthContext`; when role is `'teacher'`, hide the "+ Add Class", "+ Grade Level", archive, and delete action buttons (read-only view); the grouped display from US1 still applies

- [x] T040 [P] [US4] Update `frontend/src/pages/Classes.tsx` — add a class detail panel/drawer that opens on class row click showing: grade level, stream, homeroom teacher name, capacity bar (`enrolled / capacity`), and a list of enrolled students (fetched via `GET /api/classes/:id/students`); bursar role shows the panel with count and capacity but omits the student name list

**Checkpoint**: US4 complete — role scoping enforced at both API and UI layers. Independently verifiable by logging in as each role.

---

## Phase 7: User Story 5 — Archive and Remove Classes (Priority: P5)

**Goal**: Archive/restore/permanent-delete lifecycle works correctly with the new grade-level structure. Archived classes are excluded from grade-level grouping in the main view.

**Independent Test**: Assign a student to a class; attempt archive — confirm error; remove the student; archive — confirm class disappears from main list but appears under "Archived" filter; restore — confirm it reappears in its grade-level group.

### Backend implementation

- [x] T041 [US5] Verify `ClassController::archive()` in `backend/app/Controllers/Api/ClassController.php` — no logic changes needed; confirm the existing check (`active student count > 0 → 400`) still passes correctly after the schema migration; add `grade_level_id` and `stream` to the class object returned in the success response

### Frontend implementation

- [x] T042 [US5] Update `frontend/src/pages/Classes.tsx` — ensure the "Archived" filter view (toggled via existing `includeArchived` param) still works after the grouped display refactor; archived classes should render in their grade-level group with a visual "Archived" badge rather than disappearing from the group entirely (or in a separate "Archived" section at the bottom — use whichever is visually cleaner)

**Checkpoint**: US5 complete — lifecycle operations work with grade-level context.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T043 [P] Update `backend/app/Database/Seeds/SampleDataSeeder.php` (or equivalent seeder) — add at least 2 grade levels for the sample tenant and assign existing sample classes to them so `npm run dev` / `php spark serve` gives a realistic grouped view out of the box

- [x] T044 [P] Add a `gradeLevelId` filter to `GET /api/students/optimized` in `backend/app/Controllers/Api/StudentsOptimizedController.php` if it doesn't already pass through — ensures the "filter students by class → by grade" query path works end-to-end from the frontend

- [ ] T045 Manually verify `quickstart.md` steps end-to-end: run migrations, seed, start backend and frontend, walk through each user story's independent test scenario

- [x] T046 [P] Review all new and modified controllers for any query that touches `grade_levels` or `classes` to confirm every query includes `tenant_id` filter (Constitution I gate check)

- [x] T047 [P] Review `ClassController` and `GradeLevelController` to confirm all write endpoints (`POST`, `PUT`, `DELETE`) call `requireRole('admin', 'super_admin')` or equivalent guard (Constitution III gate check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **User Stories (Phases 3–7)**: All depend on Phase 2 completion
  - US1 (Phase 3) must complete before US4/US5 (grouped display required first)
  - US2, US3, US4, US5 can start after Phase 2 (US1 recommended first for UI continuity)
- **Polish (Phase 8)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — start after Phase 2
- **US2 (P2)**: No dependency on US1 backend; US1 frontend recommended before US2 frontend (modal already exists)
- **US3 (P3)**: No dependency on US1/US2 — promotion logic is independent
- **US4 (P4)**: Depends on US1 frontend (grouped display provides context for the teacher/bursar view)
- **US5 (P5)**: Depends on US1 frontend (archived filter works within grouped display)

### Within Each User Story

- Backend model → backend controller → routes → frontend API → frontend UI
- Models before controllers; controllers before frontend hooks; hooks before UI components

### Parallel Opportunities

- T003 + T004 can run in parallel (different migration files)
- T006 + T007 can run in parallel (different models)
- T010 + T011 can run in parallel (different sections of api.ts — or same file, handle sequentially)
- T025–T029 (US1 frontend) can be split across parallel work once T010–T011 are done
- T039 + T040 (US4 frontend) can run in parallel (same file but different sections)
- T043 + T044 + T046 + T047 (Polish) can all run in parallel

---

## Parallel Example: Phase 2 Foundational

```
# Launch in parallel:
Task T003: Create grade_levels migration
Task T006: Create GradeLevelModel skeleton
Task T007: Update ClassModel allowedFields + formatForApi
Task T008: Create GradeLevelController skeleton
Task T010: Add grade-level API functions to api.ts
Task T011: Update Class TypeScript interface in api.ts

# Then sequentially (depends on T003+T004):
Task T005: Run php spark migrate

# Then sequentially (depends on T008+T009):
Task T009: Add routes to Routes.php
```

## Parallel Example: User Story 1

```
# After Phase 2 complete, launch in parallel:
Backend: T012→T013→T014→T015 (GradeLevelModel methods, sequential)
Backend: T022→T023→T024 (ClassController updates)
Frontend: T025 (useGradeLevels hook)
Frontend: T026 (AddGradeLevelModal)
Frontend: T027 (AddClassModal updates)
Frontend: T028 (EditClassModal updates)

# Then after backend + frontend API are ready:
Task T029: Refactor Classes.tsx for grouped display (depends on hook + modal + API)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (critical — blocks all stories)
3. Complete Phase 3: User Story 1 (grade levels + grouped display)
4. **STOP and VALIDATE**: Grade level creation, class assignment, grouped list render correctly
5. Demo to stakeholders / deploy

### Incremental Delivery

1. Phase 1 + 2 → Schema + skeletons ready
2. Phase 3 (US1) → Grade level hierarchy visible in UI — **MVP**
3. Phase 4 (US2) → Capacity enforcement live
4. Phase 5 (US3) → Promotion workflow upgraded
5. Phase 6 (US4) → Role-scoped views active
6. Phase 7 (US5) → Archive lifecycle works with grade grouping
7. Phase 8 → Polish + seeding + gate checks

### Parallel Team Strategy

With two developers after Phase 2:
- **Dev A**: US1 backend (T012–T024) → US3 backend (T033–T035)
- **Dev B**: US1 frontend (T025–T029) → US2 frontend (T032)

---

## Notes

- [P] tasks operate on different files or independent sections — safe to parallelise
- [Story] label maps each task to its user story for traceability
- Every user story is independently completable and testable — stop at any checkpoint to validate
- Commit after each phase checkpoint
- No test tasks generated (not requested in specification)
- Constitution gate checks (T046, T047) must pass before PR merge
