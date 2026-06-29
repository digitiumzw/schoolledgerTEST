# Tasks: Redo Classes Module

**Input**: Design documents from `/specs/004-redo-classes-module/`  
**Prerequisites**: plan.md ✓ · spec.md ✓ · research.md ✓ · data-model.md ✓ · contracts/api-contracts.md ✓

**Organization**: Tasks grouped by user story for independent implementation and testing.  
**No tests requested** in spec — test tasks are omitted.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Maps to user story in spec.md (US1–US5)
- Exact file paths included in all descriptions

## Path Conventions

```text
backend/app/Controllers/Api/   — PHP controllers
backend/app/Models/            — PHP models
frontend/src/api/              — Axios API layer
frontend/src/components/modals/— Modal components
frontend/src/pages/            — Page components
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm dev environment is operational and existing code is read before any changes.

- [x] T001 Start backend dev server (`php spark serve`) and frontend dev server (`npm run dev`) and confirm the Classes page loads without console errors
- [x] T002 [P] Run `php spark migrate` to confirm all migrations are applied and the `grade_levels`, `classes` tables exist with correct columns
- [x] T003 [P] Seed the database with `php spark db:seed CompleteDatabaseSeeder` and verify 5 grade levels and 5 classes appear in the UI

**Checkpoint**: Dev environment is running, data is seeded, Classes page is visible.

---

## Phase 2: Foundational (Constitution Blocker — MUST Complete Before US1)

**Purpose**: Fix the active Constitution Principle II violation in `ArchiveClassModal.tsx`. This is a hard block on merge.

**⚠️ CRITICAL**: This violation (direct `fetch()` call bypassing `api.ts`) must be fixed before any other work is merged.

- [x] T004 In `frontend/src/api/api.ts`, add a `getClassEnrollmentHistory(classId: string)` function that calls `GET /api/classes/:id/enrollment-history` using the existing Axios instance and returns `{ hasHistory: boolean; count: number }`
- [x] T005 In `frontend/src/components/modals/ArchiveClassModal.tsx`, replace the hard-coded `fetch('http://localhost:8080/api/classes/...')` call (line ~45) with `api.getClassEnrollmentHistory(classData.id)` and update the response destructuring to match the `{ hasHistory, count }` shape returned by the new api method (removing the incorrect `data.data?.count` access)

**Checkpoint**: Open the Archive modal for any class — enrollment history check works, no hard-coded URL in source. Constitution Principle II is no longer violated.

---

## Phase 3: User Story 1 — Manage Classes (Create, Edit, Delete) (Priority: P1) 🎯 MVP

**Goal**: Administrators can reliably create, update, and delete classes with proper validation and no silent failures.

**Independent Test**: Navigate to Classes page → create a class with name + grade level → verify it appears in list → edit its stream → verify update → delete it (with no students) → verify it disappears.

- [x] T006 [US1] In `backend/app/Controllers/Api/ClassController.php`, add a uniqueness check in `create()` that queries for an existing class with the same `(tenant_id, grade_level_id, name, stream)` and returns HTTP 409 with message "A class with this name and stream already exists in this grade level" if a duplicate is found
- [x] T007 [US1] In `backend/app/Controllers/Api/ClassController.php`, add the same uniqueness check in `update()`, excluding the current class id from the query so a class can be saved with its own existing values
- [x] T008 [US1] In `backend/app/Controllers/Api/ClassController.php`, remove the `log_message()` debug call inside `getEnrollmentHistory()` (line ~632)
- [x] T009 [P] [US1] In `backend/app/Models/ClassModel.php`, replace every hardcoded `'ACTIVE'` string used in enrollment status comparisons with `\App\Models\EnrollmentModel::STATUS_ACTIVE` constant (affects `getStudentsForPromotion()` and any other method using the literal)
- [x] T010 [P] [US1] In `backend/app/Models/ClassModel.php`, clean up `getFinalClasses()` — remove the `OR next_class_id = ""` clause and rely solely on `IS NULL` to detect final classes, ensuring any empty-string data is addressed via a one-time data fix query in the seeder if needed
- [x] T011 [US1] In `frontend/src/components/modals/AddClassModal.tsx`, refactor the form from ad-hoc controlled state to React Hook Form + Zod: define a Zod schema (`name` required non-empty string, `capacity` positive integer defaulting to 30, all other fields optional), wire it with `useForm`, and replace the current manual `onChange` handlers and inline validation with RHF `register`/`formState.errors`
- [x] T012 [US1] In `frontend/src/components/modals/EditClassModal.tsx`, apply the same RHF + Zod refactor as T011: define the same Zod schema, wire `useForm` with `defaultValues` from `classData`, and replace the `useEffect` state-sync pattern with RHF's `reset(classData)` call when `classData` changes

**Checkpoint**: Create a class with a duplicate name in the same grade+stream — backend returns 409. Create a class with a missing name — frontend shows a Zod field error before submission. Archive a class with a debug payload in the console — no stray `log_message` output appears in backend logs.

---

## Phase 4: User Story 2 — Grade Level Management (Priority: P2)

**Goal**: Administrators can create, rename, and delete grade levels; deletion is blocked when classes are still linked.

**Independent Test**: Create a grade level → verify it appears in the grade level list and as an option in the class form → try to delete a grade level that has classes → verify it is blocked → delete one with no classes → verify it is removed.

- [x] T013 [US2] In `backend/app/Controllers/Api/GradeLevelController.php`, change `delete()` to block deletion when any class still has `grade_level_id` pointing to this grade level: query `classes` table for count of non-archived classes with this `grade_level_id` and `tenant_id`, return HTTP 409 with message "Cannot delete a grade level that still has classes assigned to it. Reassign or remove those classes first." if count > 0. Remove the existing SET NULL cascade behavior from this method (the FK constraint SET NULL on the DB remains as a safety net but should not be relied on as the primary enforcement path)
- [x] T014 [P] [US2] In `frontend/src/api/api.ts`, confirm the `deleteGradeLevel(id)` method handles a 409 response by propagating the error (it should already via Axios interceptors — verify and add explicit error re-throw if not)
- [x] T015 [P] [US2] In `frontend/src/pages/Classes.tsx`, confirm the "Delete Grade Level" UI flow (via `AddGradeLevelModal` or whichever modal handles deletion) displays the 409 error message to the user rather than swallowing it silently

**Checkpoint**: On the Classes page, attempt to delete "Form 1" (which has classes) — UI shows the blocking error message. Delete a freshly created grade level with no classes — it disappears from the list.

---

## Phase 5: User Story 3 — View Class Roster (Priority: P3)

**Goal**: Teachers and admins can open any class and see an accurate, searchable student roster.

**Independent Test**: Open a class detail view for a seeded class (e.g., "7A") — the full list of seeded active students appears with name, admission number, and status. Search for a student by name — the list filters correctly.

- [x] T016 [US3] In `backend/app/Controllers/Api/ClassController.php`, verify `students()` returns each student with at minimum: `id`, `admissionNumber`, `firstName`, `lastName`, `status` — and that the response uses `respondSuccess()` from `BaseApiController`. If any field is missing or response does not use the helper, fix it now
- [x] T017 [US3] In `frontend/src/pages/Classes.tsx`, verify the class roster view (student list within a selected class) correctly fetches from `api.getClassStudents(classId)` and renders an empty-state message (e.g., "No students enrolled yet") when the roster is empty — add the empty-state if missing

**Checkpoint**: Open class "7A" — 5 seeded students visible. Open an empty class — empty-state message shown. Both states render without console errors.

---

## Phase 6: User Story 4 — Assign Students to Classes (Priority: P4)

**Goal**: Administrators can assign and remove students from classes; duplicate assignments and capacity violations are cleanly rejected.

**Independent Test**: In AssignStudentsModal, select a student already enrolled in another class and assign them — they move to the new class. Attempt to assign a student already in this class — the system rejects the duplicate with a clear message.

- [x] T018 [US4] In `backend/app/Controllers/Api/ClassController.php`, review the `assignStudents()` capacity check logic — specifically verify that the count of "students currently in this class" excludes students being re-assigned (who are already in this class), so that re-assigning an existing student does not erroneously consume a capacity slot. Fix the counting logic if it has this edge case
- [x] T019 [US4] In `frontend/src/components/modals/AssignStudentsModal.tsx`, verify the 409 capacity-exceeded error response is correctly parsed and shown to the user with the `availableSlots` count — if the error shape from the backend (`capacity`, `currentCount`, `requestedCount`, `availableSlots`) does not match what the frontend expects, align them

**Checkpoint**: Assign 5 students to a class with 3 available slots — backend returns 409 with slot details, frontend displays the count. Force-assign as admin — succeeds. Re-assign a student already in the class — no duplicate created.

---

## Phase 7: User Story 5 — Assign a Teacher to a Class (Priority: P5)

**Goal**: Administrators can designate a class teacher; the assignment is visible on the class detail view.

**Independent Test**: Edit a class and assign a teacher → save → the class list shows the teacher's name for that class. Reassign to a different teacher → the new teacher appears.

- [x] T020 [US5] In `frontend/src/pages/Classes.tsx`, verify the class list row (desktop) and mobile card display the assigned teacher's name when `teacherId` is set — if teacher name is not currently shown in the list, add the display using the teacher data already available in the class object from the API response (the existing `ClassController::index()` already includes teacher data)

**Checkpoint**: Assign a teacher to "Form 1A" via EditClassModal, save, return to class list — teacher name is visible in the class row without a page reload.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and verification across all stories.

- [x] T021 [P] Re-run `php spark db:seed CompleteDatabaseSeeder` on a fresh DB and verify all 5 grade levels, 5 classes, and 20 students load without errors; confirm the seeder does not use any hardcoded `'ACTIVE'` strings that should be constants
- [x] T022 In `frontend/src/pages/Classes.tsx`, do a full end-to-end walkthrough of all 5 user stories using the seeded data — create a class, edit it, view roster, assign a student, assign a teacher, archive it — and fix any remaining UI glitches or console errors discovered
- [x] T023 [P] Run `npm run lint` in `frontend/` and `composer install` in `backend/` to confirm no lint errors were introduced by the changes in T004–T020

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — **blocks merge until resolved**
- **Phase 3 (US1)**: Depends on Phase 2; T006–T008 depend on each other sequentially within backend; T011–T012 can run in parallel after T004–T005
- **Phase 4 (US2)**: Depends on Phase 1; T013 is the key fix; T014 and T015 can run in parallel
- **Phase 5 (US3)**: Depends on Phase 3 (roster depends on class CRUD working)
- **Phase 6 (US4)**: Depends on Phase 5 (student assignment depends on roster display working)
- **Phase 7 (US5)**: Depends on Phase 3 (teacher assignment uses the same class form)
- **Phase 8 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Must complete after Phase 2 foundation — blocks US3, US5
- **US2 (P2)**: Independent of US1; can run in parallel with US1 after Phase 1
- **US3 (P3)**: Depends on US1 (needs classes to exist and CRUD to work)
- **US4 (P4)**: Depends on US3 (student assignment connects to roster view)
- **US5 (P5)**: Depends on US1 (teacher assignment uses class edit form)

### Within Each Phase

- Backend model tasks before controller tasks (T009, T010 before T006, T007)
- API method (T004) before modal fix (T005)
- RHF+Zod refactors (T011, T012) are independent of backend tasks and can run in parallel

### Parallel Opportunities

**Phase 2**: T004 and T005 are sequential (T005 depends on T004)

**Phase 3**:
- Backend (T006–T010) and frontend (T011–T012) can run in parallel streams
- Within backend: T009 and T010 are parallel; T006 and T007 are sequential (same method pattern, same file)

**Phase 4**: T013 (backend) and T014–T015 (frontend) can run in parallel

---

## Parallel Example: Phase 3 (US1)

```text
Stream A (backend):
  T009 → T010 (parallel with each other)
  T006 → T007 → T008 (sequential)

Stream B (frontend, after Phase 2 complete):
  T011 ‖ T012 (parallel — different files)
```

---

## Implementation Strategy

### MVP First (User Story 1 + Foundation)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation (constitution blocker — required for merge)
3. Complete Phase 3: User Story 1 (class CRUD)
4. **STOP and VALIDATE**: End-to-end class create → edit → archive works, no console errors, no 500s
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Constitution compliant
2. Add Phase 3 (US1) → Class management fully reliable → Demo
3. Add Phase 4 (US2) → Grade level deletion properly guarded
4. Add Phase 5 (US3) → Roster view reliable
5. Add Phase 6 (US4) → Student assignment accurate
6. Add Phase 7 (US5) → Teacher assignment visible
7. Phase 8 → Full polish, lint clean

---

## Notes

- No new migration files are created; all schema is already in place
- Constitution Principle II violation in Phase 2 is a hard merge gate — do not merge without T004+T005
- All backend changes use `respondSuccess()` / `respondError()` from `BaseApiController` — no raw `echo` or custom JSON
- All frontend API calls go through `src/api/api.ts` Axios instance — no raw `fetch()`
- All frontend forms use React Hook Form + Zod (no ad-hoc controlled state for validation)
- Commit after each phase checkpoint to isolate changes
