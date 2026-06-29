---

description: "Task list for Student Management standard SMS redesign"
---

# Tasks: Student Management (Standard SMS Redesign)

**Input**: Design documents from `specs/001-student-management/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story. Backend and frontend tasks within each story are parallelizable where
they touch different files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are relative to the repo root

## Path Conventions

- Backend controllers: `backend/app/Controllers/Api/`
- Backend models: `backend/app/Models/`
- Backend migrations: `backend/app/Database/Migrations/`
- Frontend pages: `frontend/src/pages/`
- Frontend components: `frontend/src/components/`
- Frontend API layer: `frontend/src/api/api.ts`
- Frontend types: `frontend/src/types/dashboard.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema migrations and type system updates that all user stories depend on.

- [x] T001 Create migration `backend/app/Database/Migrations/2026-04-03-100000_Add_student_standard_fields.php` — ALTER TABLE students ADD COLUMNS: `admission_number VARCHAR(50) NOT NULL DEFAULT ''`, `gender ENUM('male','female','other') NULL`, `photo_url VARCHAR(500) NULL`, `national_id VARCHAR(100) NULL`, `guardian2_name VARCHAR(200) NULL`, `guardian2_phone VARCHAR(50) NULL`, `guardian2_relationship VARCHAR(50) NULL`; ADD UNIQUE INDEX `(tenant_id, admission_number)`
- [x] T002 Create migration `backend/app/Database/Migrations/2026-04-03-110000_Add_student_status_history.php` — CREATE TABLE `student_status_history` with columns: `id VARCHAR(50) PK`, `tenant_id VARCHAR(50)`, `student_id VARCHAR(50) FK→students.id ON DELETE CASCADE`, `previous_status ENUM(active,inactive,transferred,dropped_out,graduated) NULL`, `new_status ENUM(active,inactive,transferred,dropped_out,graduated) NOT NULL`, `effective_date DATE NOT NULL`, `reason TEXT NULL`, `changed_by_user_id VARCHAR(50) NOT NULL`, `created_at DATETIME NOT NULL`; indexes on `(tenant_id, student_id)` and `(student_id, created_at DESC)`
- [x] T003 Run migrations to verify they apply cleanly: `cd backend && php spark migrate`
- [x] T004 [P] Update `frontend/src/types/dashboard.ts` — extend `Student` interface with `admissionNumber: string`, `gender?: 'male' | 'female' | 'other'`, `photoUrl?: string`, `nationalId?: string`, `guardian2?: { name: string; phone: string; relationship: string }`; extend `Guardian` interface with optional `relationship` already present — verify; extend `StudentFormData` with `admissionNumber?: string`, `gender?: string`, `nationalId?: string`, `guardian2Name?: string`, `guardian2Phone?: string`, `guardian2Relationship?: string`; add new `StatusHistoryEntry` interface matching the shape in `data-model.md`
- [x] T005 [P] Update `backend/app/Models/StudentModel.php` `$allowedFields` array — add `'admission_number'`, `'gender'`, `'photo_url'`, `'national_id'`, `'guardian2_name'`, `'guardian2_phone'`, `'guardian2_relationship'` to the existing list

**Checkpoint**: Migrations applied; TypeScript types compile; model accepts new fields.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend logic that every user story requires before it can function.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Update `backend/app/Models/StudentModel.php` `formatForApi()` — add new fields to the returned array: `admissionNumber`, `gender`, `photoUrl`, `nationalId`, `guardian2` object (`{ name, phone, relationship }` from `guardian2_name`, `guardian2_phone`, `guardian2_relationship`); return `null` for `guardian2` when all three `guardian2_*` fields are empty
- [x] T007 Update `backend/app/Models/StudentModel.php` `formatFromApi()` — map incoming `admissionNumber→admission_number`, `gender→gender`, `nationalId→national_id`, `photoUrl→photo_url`; map `guardian2.name→guardian2_name`, `guardian2.phone→guardian2_phone`, `guardian2.relationship→guardian2_relationship` (supporting both nested `guardian2` object and flat `guardian2Name/guardian2Phone/guardian2Relationship` keys for backwards compat)
- [x] T008 Add `generateAdmissionNumber(string $tenantId): string` private method to `backend/app/Models/StudentModel.php` — query `MAX(admission_number)` for the tenant where the format matches `{YEAR}/NNN`; increment the sequence; return `{YEAR}/{padded_sequence}` (e.g., `2026/001`); if no existing numbers found start at `{YEAR}/001`
- [x] T009 Update `backend/app/Models/StudentModel.php` `delete()` — before cascade-delete logic, query `charges` and `payments` tables for any record where `student_id = $id`; if any exist throw a new `\RuntimeException` with code `FINANCIAL_RECORDS_EXIST` and message `"Cannot delete a student with financial records. Change the student's status instead."`
- [x] T010 Add `recordStatusHistory(string $tenantId, string $studentId, ?string $previousStatus, string $newStatus, string $effectiveDate, ?string $reason, string $changedByUserId): void` method to `backend/app/Models/StudentModel.php` — inserts a row into `student_status_history`; generates a UUID for `id`; sets `created_at` to NOW()
- [x] T011 Update `frontend/src/api/api.ts` — add `getStudentStatusHistory(studentId: string)` function: `GET /api/students/{id}/status-history`; add `bulkUpdateStudentStatus(studentIds: string[], status: string, effectiveDate: string, reason: string)` function: `PUT /api/students/bulk-status`; update `createStudent` and `updateStudent` call signatures to include new fields from updated `StudentFormData`

**Checkpoint**: Foundation ready — backend model handles new fields; API layer updated; user story implementation can begin.

---

## Phase 3: User Story 1 — Enroll a New Student (Priority: P1) 🎯 MVP

**Goal**: Admin can register a student with all standard SMS fields including admission number,
gender, second guardian, and have it appear in the directory immediately.

**Independent Test**: Enroll one new student via the form, verify admission number is
auto-generated, verify both guardians are saved, verify student appears in directory as Active.

### Implementation for User Story 1

- [x] T012 [P] [US1] Update `backend/app/Controllers/Api/StudentController.php` `create()` method — after `formatFromApi()`, if `admission_number` is empty call `$studentModel->generateAdmissionNumber($tenantId)`; validate that the resolved admission number is unique in `(tenant_id, admission_number)` — if duplicate return HTTP 422 with `errors.admissionNumber` message from contracts; on successful insert call `$studentModel->recordStatusHistory($tenantId, $studentId, null, 'active', $enrollmentDate, 'Initial enrollment', $userId)`; return HTTP 201
- [x] T013 [P] [US1] Update `backend/app/Controllers/Api/StudentController.php` `update()` method — enforce `admin` role check (read `role` from JWT payload; if not `admin` or `super_admin` return HTTP 403 with message from contracts); if `admission_number` is being changed validate uniqueness excluding current student ID; call `formatFromApi()` with new fields; save; return updated student via `formatForApi()`
- [x] T014 [P] [US1] Update `frontend/src/components/modals/StudentFormModal.tsx` — add form fields for: `Admission Number` (optional text input with helper "Leave blank to auto-generate"), `Gender` (select: Male / Female / Other / Prefer not to say), `National ID / Birth Cert No.` (optional text), `Second Guardian Name` (optional text), `Second Guardian Phone` (optional phone), `Second Guardian Relationship` (optional text); wire all fields to React Hook Form with Zod validation rules matching `data-model.md` (guardian2Phone optional but if present must match phone pattern)
- [x] T015 [US1] Remove `frontend/src/components/modals/AddStudentModal.tsx` — consolidate into `StudentFormModal.tsx`; update all imports in `frontend/src/pages/Students.tsx` and any other file that imports `AddStudentModal` to use `StudentFormModal` instead; pass `mode="add"` prop to distinguish create vs edit
- [x] T016 [US1] Update `frontend/src/api/api.ts` `createStudent()` — map new `StudentFormData` fields through to the request body matching the POST contract in `contracts/students-api.md`

**Checkpoint**: User Story 1 fully functional — enroll a student with all new fields; admission number auto-generated; record appears in directory as Active; status history entry created.

---

## Phase 4: User Story 2 — View and Update Student Profile (Priority: P2)

**Goal**: Staff can view all student fields including new ones; admin can edit; non-admin sees
read-only; changes save immediately.

**Independent Test**: Open existing student profile → verify all new fields visible; edit
guardian2 phone as admin → save → change reflected; log in as teacher → confirm no edit controls.

### Implementation for User Story 2

- [x] T017 [P] [US2] Update `frontend/src/pages/StudentProfile.tsx` — in the Overview tab, display: `Admission Number`, `Gender`, `National ID`, `Photo` (if `photoUrl` set, render `<img>`); display second guardian section (`guardian2`) if the object is non-null — show name, phone, relationship; add a **Status History** tab (new tab alongside Overview, Fees, Attendance, Transport); render the status history list fetched from `getStudentStatusHistory(studentId)` using TanStack Query (`useQuery`)
- [x] T018 [P] [US2] Add `useStudentStatusHistory(studentId)` custom hook in `frontend/src/hooks/useStudentStatusHistory.ts` — wraps `useQuery` calling `api.getStudentStatusHistory(studentId)`; returns `{ statusHistory, isLoading, error }`
- [x] T019 [P] [US2] Update `backend/app/Controllers/Api/StudentController.php` — add `getStatusHistory(string $id)` action: validate student belongs to tenant; query `student_status_history` WHERE `student_id = $id AND tenant_id = $tenantId` ORDER BY `created_at DESC`; join `users` table to get `changed_by_name`; return array of status history objects; register route `GET /api/students/(:segment)/status-history` in `backend/app/Config/Routes.php`
- [x] T020 [US2] Update `backend/app/Controllers/Api/StudentController.php` `getProfile()` — include `statusHistory` array in the response (query same as T019); this adds status history to the existing profile endpoint without a breaking change

**Checkpoint**: User Story 2 fully functional — profile shows all new fields; status history tab populated; edit enforces admin-only at API level.

---

## Phase 5: User Story 3 — Search and Browse Student Directory (Priority: P3)

**Goal**: Directory shows admission number; search works by partial name OR exact admission
number; filters work correctly for grade and status.

**Independent Test**: With 2+ students enrolled, search by admission number → single match;
filter by grade → only that grade shown; filter by status Transferred → only transferred shown.

### Implementation for User Story 3

- [x] T021 [P] [US3] Update `backend/app/Models/StudentModel.php` `getFilteredStudents()` and `search()` — in the `LIKE` search group add `->orLike('s.admission_number', $search)` (exact match for admission number using `$search` without wildcards when it matches the pattern `\d{4}/\d+`, else partial match); `SELECT` clause must include `s.admission_number` in the result columns
- [x] T022 [P] [US3] Update `backend/app/Models/StudentModel.php` `formatForApi()` — confirm `admissionNumber` is included in return array (done in T006; this task verifies it flows through `getFilteredStudents()` results as well — the column is selected in the query so it will be present in `$student` array)
- [x] T023 [P] [US3] Update `frontend/src/pages/Students.tsx` — add `Admission No.` column to the student list table (between Name and Class); ensure the column is visible on medium+ screen widths; update the student row component to render `student.admissionNumber`
- [x] T024 [US3] Update `frontend/src/pages/Students.tsx` search behaviour — the existing search input already passes `search` param to the API; no frontend logic change needed beyond ensuring the placeholder text says "Search by name or admission number…"

**Checkpoint**: User Story 3 fully functional — directory shows admission number column; search by admission number returns correct student; all existing filters (grade, status) continue to work.

---

## Phase 6: User Story 4 — Manage Student Status Lifecycle (Priority: P4)

**Goal**: Admin can change status with effective date + reason; history is recorded; inactive
students excluded from billing; bulk graduation supported.

**Independent Test**: Change one student to Transferred → verify excluded from active list → verify status history entry exists → verify financial records still accessible. Bulk-graduate 2 students → both move to Graduated.

### Implementation for User Story 4

- [x] T025 [P] [US4] Update `backend/app/Controllers/Api/StudentController.php` `changeStatus()` — validate request body contains `status`, `effectiveDate`, `reason` (all required; return HTTP 422 if any missing); validate `status` is one of the allowed enum values; update `students.status`; call `$studentModel->recordStatusHistory(...)` with previous and new status, effectiveDate, reason, and `$userId` from JWT; return updated student + new history entry in response matching contracts
- [x] T026 [P] [US4] Add `bulkChangeStatus()` action to `backend/app/Controllers/Api/StudentController.php` — accepts `{ studentIds: string[], status, effectiveDate, reason }`; iterates each ID, validates it belongs to the tenant, updates status, records history; returns `{ updated: N, failed: [] }`; register route `PUT /api/students/bulk-status` in `backend/app/Config/Routes.php` BEFORE the `PUT students/(:segment)` wildcard route to avoid route shadowing
- [x] T027 [P] [US4] Update `frontend/src/components/modals/StatusChangeModal.tsx` — add `Effective Date` date picker field (required, defaulting to today) and `Reason` textarea (required, min 5 chars); wire to React Hook Form + Zod; pass `{ status, effectiveDate, reason }` in the `changeStudentStatus` API call
- [ ] T028 [US4] Add bulk status action to `frontend/src/pages/Students.tsx` — add row checkboxes to the student table; add a "Bulk Actions" dropdown that appears when ≥1 student is selected with option "Graduate selected" and "Mark as Withdrawn"; on action open a confirmation modal capturing `effectiveDate` and `reason`; on confirm call `api.bulkUpdateStudentStatus(selectedIds, status, effectiveDate, reason)`; invalidate the students query on success

**Checkpoint**: User Story 4 fully functional — status change records history and requires date + reason; transferred students excluded from active views; bulk status works end-to-end.

---

## Phase 7: Hard-Delete Protection (Cross-Cutting, Spec FR-010)

**Purpose**: Enforce the constitution's financial ledger integrity principle — students with
financial records cannot be hard-deleted.

- [x] T029 [P] Update `backend/app/Controllers/Api/StudentController.php` `delete()` — wrap the `$studentModel->delete($id)` call in a try/catch for `\RuntimeException` with code `FINANCIAL_RECORDS_EXIST`; if caught return HTTP 422 with `{ success: false, message: "...", code: "FINANCIAL_RECORDS_EXIST" }` per contracts
- [x] T030 [P] Update `frontend/src/components/modals/DeleteStudentModal.tsx` — handle the `FINANCIAL_RECORDS_EXIST` error code from the API response; display a specific message: "This student has financial records and cannot be deleted. To remove them from active lists, change their status to Transferred or Withdrawn instead."; add a "Change Status" button that closes the delete modal and opens the status change modal

**Checkpoint**: Attempting to delete a student with charges or payments returns a clear error; UI guides admin to status change instead.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, UX cleanup, and validation hardening across all stories.

- [x] T031 [P] Update `backend/app/Controllers/Api/StudentController.php` `getProfile()` — ensure `statusHistory` is included in the response (verify T020 result flows through correctly)
- [x] T032 [P] Update `frontend/src/pages/StudentProfile.tsx` — ensure the Status History tab renders gracefully when `statusHistory` is empty (show "No status changes recorded" placeholder); format `effectiveDate` and `createdAt` with locale-aware date display
- [x] T033 [P] Validate `backend/app/Models/StudentModel.php` `search()` — confirm admission number search does not break existing name-based search; test manually with `php spark db:seed SampleDataSeeder` and a curl to `GET /api/students?search=2026`
- [x] T034 [P] Update `frontend/src/lib/studentUtils.ts` — add `formatAdmissionNumber(raw: string): string` helper that returns the value as-is (admission numbers are free-form); add `getGenderLabel(gender: string): string` returning "Male" / "Female" / "Other" / "—" for display
- [ ] T035 Run quickstart.md validation end-to-end: enroll → view profile → search → status change → hard-delete protection → bulk status

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 migrations applied (T003) and types updated (T004, T005)
- **User Stories (Phases 3–6)**: All depend on Foundational phase complete
  - US1 (P3), US2 (P4) can run in parallel after foundation
  - US3 (P3) depends on US1 (directory needs real students to search)
  - US4 (P4) can run in parallel with US2 and US3 after foundation
- **Hard-Delete Protection (Phase 7)**: Depends on T009 (model guard) — can run in parallel with user stories
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundation — no dependency on other stories
- **US2 (P2)**: Can start after Foundation — no dependency on US1 (reads existing students)
- **US3 (P3)**: Can start after Foundation — benefits from US1 being complete for testing, but the directory code change is independent
- **US4 (P4)**: Can start after Foundation — StatusChangeModal update (T027) is independent

### Within Each User Story

- Backend model changes → backend controller changes → frontend type changes → frontend UI changes
- [P]-marked tasks within a story touch different files and can run in parallel

### Parallel Opportunities

```bash
# Phase 1 — run in parallel:
T001  Create Add_student_standard_fields migration
T002  Create Add_student_status_history migration
T004  Update frontend types (dashboard.ts)
T005  Update StudentModel allowedFields

# Phase 2 — run in parallel (after T001–T005 done):
T006  formatForApi new fields
T007  formatFromApi new fields
T008  generateAdmissionNumber method
T009  delete() guard
T010  recordStatusHistory method
T011  Update api.ts new endpoints

# After Foundation — US1 and US2 start in parallel:
# US1: T012 || T013 || T014 (backend create, backend update, frontend form)
# US2: T017 || T018 || T019 (profile page, hook, status-history endpoint)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundation (T006–T011)
3. Complete Phase 3: US1 Enrollment (T012–T016)
4. **STOP and VALIDATE**: Enroll a student end-to-end per quickstart.md Step 1
5. Deploy/demo the MVP

### Incremental Delivery

1. Setup + Foundation → Schema and model ready
2. US1 Enrollment → Test independently → Demo (MVP with admission number, second guardian)
3. US2 Profile View → Test independently → Demo (full profile with history tab)
4. US3 Directory Search → Test independently → Demo (admission number in list + search)
5. US4 Status Lifecycle → Test independently → Demo (bulk actions, audit trail)
6. Phase 7 Hard-Delete → Test → Deploy

---

## Notes

- [P] tasks = different files, no shared write conflicts
- [Story] label maps each task to the user story for traceability
- All migration files MUST be new — never edit `2025-12-28-102246_CreateDBSchemas.php`
- The `getAllBalances()` / `getFilteredStudents()` balance subquery in `StudentModel.php` MUST NOT be modified
- Admission number uniqueness is enforced by a DB index AND at the controller level — both layers required
- `PUT /api/students/bulk-status` route MUST be registered before `PUT /api/students/(:segment)` in Routes.php
- `AddStudentModal.tsx` is removed in T015 — check for any other import sites before deleting
