# Tasks: Bulk Student Import

**Input**: Design documents from `/specs/077-bulk-student-import/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/bulk-import-api.md ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register new routes and establish the backend + frontend scaffolding that all user stories depend on.

- [x] T001 Register 3 new import routes in `backend/app/Config/Routes.php` — add `GET students/import/template`, `POST students/import/validate`, `POST students/import/execute` BEFORE the existing `GET students/(:segment)` wildcard line
- [x] T002 [P] Create stub `backend/app/Controllers/Api/StudentImportController.php` extending `BaseApiController` with empty `template()`, `validate()`, `execute()` methods returning `$this->error('Not implemented', 501)`
- [x] T003 [P] Create stub `backend/app/Services/StudentImportService.php` with empty `parseAndValidateCsv()`, `executeBatchImport()`, and `buildTemplateCsv()` methods

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared logic that all three user stories depend on before story-level work can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Implement `StudentImportService::buildTemplateCsv()` in `backend/app/Services/StudentImportService.php` — returns the raw CSV string with header row `first_name,last_name,date_of_birth,gender,national_id,email,address,guardian_name,guardian_phone,guardian_relationship,admission_number` and two example rows as specified in `data-model.md`
- [x] T005 Implement `StudentImportService::parseAndValidateCsv(string $filePath, string $tenantId): array` in `backend/app/Services/StudentImportService.php` — open file with `fgetcsv()` streaming, map header row to column indices, iterate rows, collect `ImportRowError` objects; validate: `first_name` required max 100, `last_name` required max 100, `date_of_birth` required YYYY-MM-DD format not in future, `gender` required `male`|`female` (case-insensitive), `email` optional valid format, `admission_number` optional unique-per-tenant check; detect intra-file duplicates via PHP associative array on `(lower_first, lower_last, dob)` key; detect existing-DB duplicates via single bulk `SELECT first_name, last_name, date_of_birth FROM students WHERE tenant_id = ?` loaded before row iteration; return `['valid' => bool, 'totalRows' => int, 'errorCount' => int, 'errors' => array, 'rows' => array]`
- [x] T006 Implement `StudentImportService::executeBatchImport(array $rows, string $tenantId, object $user): array` in `backend/app/Services/StudentImportService.php` — load `StudentModel`, `EnrollmentModel`, `AcademicSessionService`, `StudentSnapshotService`; iterate validated rows in batches of 250; for each row call `StudentModel::formatFromApi()` with camelCase keys derived from CSV columns, generate ID via `generateId('s')`, auto-generate `admission_number` if blank using `StudentModel::generateAdmissionNumber($tenantId)`; wrap all batch inserts in a single DB transaction with rollback on failure; after inserts, create enrollment record and status history for each student (matching `StudentController::create()` logic); return `['imported' => int, 'skipped' => int]`
- [x] T007 [P] Add `ImportValidationResult` and `ImportExecuteResult` TypeScript interfaces to `frontend/src/types/dashboard.ts`:
  ```ts
  interface ImportRowError { row: number; field: string; message: string; }
  interface ImportValidationResult { valid: boolean; totalRows: number; errorCount: number; errors: ImportRowError[]; }
  interface ImportExecuteResult { imported: number; skipped: number; }
  ```
- [x] T008 [P] Add three API methods to `frontend/src/api/api.ts`: `downloadStudentImportTemplate(): Promise<Blob>` (GET `/students/import/template`, returns blob for file save), `validateStudentImport(file: File): Promise<ImportValidationResult>` (POST `/students/import/validate`, multipart), `executeStudentImport(file: File): Promise<ImportExecuteResult>` (POST `/students/import/execute`, multipart)

**Checkpoint**: Foundation complete — all user story phases can proceed.

---

## Phase 3: User Story 1 — Download CSV Template & Prepare Data (Priority: P1) 🎯 MVP

**Goal**: Admin can download a pre-built CSV template from the Bulk Import Students page.

**Independent Test**: `GET /api/students/import/template` returns HTTP 200 with `Content-Type: text/csv` and correct column headers; unauthenticated request returns 401; bursar returns 403.

- [x] T009 [US1] Implement `StudentImportController::template()` in `backend/app/Controllers/Api/StudentImportController.php` — enforce role guard (admin/super_admin only, else `$this->error('Forbidden', 403)`); call `$this->importService->buildTemplateCsv()`; return raw CSV response with headers `Content-Type: text/csv` and `Content-Disposition: attachment; filename="student_import_template.csv"` using `$this->response->setHeader(...)->setBody(...)`; do NOT use `respondSuccess` wrapper for this download-only endpoint
- [x] T010 [US1] Create `frontend/src/pages/StudentBulkImportPage.tsx` — scaffold the page with: page title "Bulk Import Students", subtitle, a "Download CSV Template" button that calls `api.downloadStudentImportTemplate()` and triggers a browser download using `URL.createObjectURL(blob)` + a temporary `<a>` click; show `Download` icon from lucide-react; wrap in `SubscriptionGuard`
- [x] T011 [US1] Add `/students/import` route to `frontend/src/App.tsx` — add `<Route path="/students/import" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AppLayout><StudentBulkImportPage /></AppLayout></ProtectedRoute>} />` BEFORE the existing `/students/:id` route; import `StudentBulkImportPage`
- [x] T012 [US1] Add "Bulk Import" nav entry to the Students section — in `frontend/src/pages/Students.tsx` add a `<Link to="/students/import">` button (outline variant, `Upload` icon from lucide-react) alongside the existing "Add Student" button in the page header action area

**Checkpoint**: Template download flow fully testable end-to-end.

---

## Phase 4: User Story 2 — Upload, Validate & Import CSV (Priority: P1)

**Goal**: Admin uploads a CSV, sees per-row validation errors or confirms import, students are created in batches.

**Independent Test**: `POST /api/students/import/validate` returns validation errors for bad rows and `valid=true` for a clean file; `POST /api/students/import/execute` creates students and returns `imported` count; 401/403 guards work; subscription limit check works.

- [x] T013 [US2] Implement `StudentImportController::validate()` in `backend/app/Controllers/Api/StudentImportController.php` — enforce role guard; reject non-multipart or missing `file` field with HTTP 400; check file extension and MIME type is CSV (`text/csv`, `application/vnd.ms-excel`, `text/plain`) — reject with 400 if not; check file size ≤ 10 MB — reject with 413 if exceeded; save to temp path; call `$this->importService->parseAndValidateCsv($tmpPath, $tenantId)`; if `totalRows === 0` return 400 "No student records found in the file"; return `$this->success($result, $valid ? 'All N rows are valid and ready to import' : "Validation failed — {$errorCount} row(s) have errors")` with HTTP 200
- [x] T014 [US2] Implement `StudentImportController::execute()` in `backend/app/Controllers/Api/StudentImportController.php` — enforce role guard; same file validation as `validate()` (type, size); subscription plan limit check using the same pattern as `StudentController::create()` — count existing active students + N incoming rows vs `max_students`, return 403 if exceeded; call `parseAndValidateCsv()` again — if any errors exist return HTTP 422 with same error structure as validate endpoint; call `$this->importService->executeBatchImport($result['rows'], $tenantId, $this->getCurrentUser())`; return HTTP 201 `$this->created($importResult, "{$imported} students imported successfully")`
- [x] T015 [US2] Build upload/validate UI state in `frontend/src/pages/StudentBulkImportPage.tsx` — add file input (`accept=".csv"`) with drag-and-drop support (via `onDragOver`/`onDrop` handlers on a styled drop zone card); show selected filename and size; add "Validate" button that calls `api.validateStudentImport(file)` via `useMutation`; while pending show spinner; on success with `valid=false` render a scrollable error table with columns Row / Field / Error message; on success with `valid=true` render a green success alert "All N rows are valid — ready to import" and enable the "Import" button
- [x] T016 [US2] Build import execution UI state in `frontend/src/pages/StudentBulkImportPage.tsx` — "Import" button (disabled until validation passes) calls `api.executeStudentImport(file)` via a second `useMutation`; while pending disable button, show `Loader2` spinner with "Importing students…" label; on error show destructive `Alert` with error message; on success transition to success state (Phase 5 / US3 handled in T018)
- [x] T017 [US2] Create `frontend/src/hooks/useStudentImport.ts` — extract both mutations (`useValidateImport` and `useExecuteImport`) with proper TanStack React Query `useMutation` setup, typed with `ImportValidationResult` and `ImportExecuteResult`; export the hook and consume it in `StudentBulkImportPage.tsx`

**Checkpoint**: Full validate → import pipeline works end-to-end; per-row errors display correctly; batched inserts create students.

---

## Phase 5: User Story 3 — Post-Import Class Assignment Guidance (Priority: P2)

**Goal**: After a successful import the admin sees a success message with the exact prescribed text and a navigable link to the Classes page.

**Independent Test**: After a successful execute response, the page shows "Students imported successfully. Please go to the Classes page to assign students to their respective classes using the multi-select feature." with a clickable link to `/classes`.

- [x] T018 [US3] Implement success state in `frontend/src/pages/StudentBulkImportPage.tsx` — on `executeImport` mutation success: set local `importResult` state; render a full-width success `Alert` (green variant) with: count headline "N students imported successfully", the prescribed guidance paragraph "Students imported successfully. Please go to the Classes page to assign students to their respective classes using the multi-select feature.", a `<Link to="/classes">` button "Go to Classes Page", and a "Import More Students" button that resets the page state back to idle/upload
- [x] T019 [US3] Verify the Classes page link in `frontend/src/pages/StudentBulkImportPage.tsx` navigates correctly — use React Router `<Link to="/classes">` (not `<a href>`) so the SPA router handles navigation without a full page reload

**Checkpoint**: End-to-end US3 testable: successful import shows correct message + link; Classes page opens correctly.

---

## Phase 6: Polish & Validation

**Purpose**: Validation, lint/type-check, and quickstart verification.

- [x] T020 [P] PHP lint for all new/modified backend files: `php -l backend/app/Controllers/Api/StudentImportController.php && php -l backend/app/Services/StudentImportService.php && php -l backend/app/Config/Routes.php`
- [x] T021 [P] Frontend TypeScript check: `node node_modules/typescript/bin/tsc --noEmit --pretty false` from `frontend/` — fix any type errors in `StudentBulkImportPage.tsx`, `useStudentImport.ts`, `api.ts`, `dashboard.ts`
- [ ] T022 [P] Targeted ESLint for new/modified frontend files: `./node_modules/.bin/eslint src/pages/StudentBulkImportPage.tsx src/hooks/useStudentImport.ts` from `frontend/` — fix any errors
- [x] T023 Run curl validation from `specs/077-bulk-student-import/quickstart.md` — execute all 10 test cases (template download, validate valid/errors/empty/non-CSV, execute happy path, execute invalid, unauthenticated, bursar blocked, tenant isolation) and record results in the Validation Results table in `quickstart.md`
- [x] T024 `git diff --check` for all touched files — confirm no whitespace errors or merge conflict markers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** — T001–T003: No dependencies; T002 and T003 parallel.
- **Foundational (Phase 2)** — T004–T008: Depends on Phase 1. T005 depends on T004 (service context). T007 and T008 are parallel with each other and with T004–T006 (different files).
- **US1 (Phase 3)** — T009–T012: Depends on Foundational. T010, T011, T012 are parallel after T009 is done.
- **US2 (Phase 4)** — T013–T017: Depends on Foundational. T013 and T014 sequential (execute reuses validate logic). T015, T016, T017 are frontend tasks that can proceed after T007/T008; T017 should precede T015/T016 to extract hooks first.
- **US3 (Phase 5)** — T018–T019: Depends on US2 (T016 must exist). T019 is trivial follow-up to T018.
- **Polish (Phase 6)** — T020–T024: Depends on all implementation phases complete. T020, T021, T022 parallel.

### User Story Dependencies

- **US1 (P1)**: Independent — can start after Foundational.
- **US2 (P1)**: Independent — can start after Foundational. Does not depend on US1 backend; shares the same page component.
- **US3 (P2)**: Depends on US2 (success state extends the execute result). Minimal — one task.

### Parallel Opportunities

- T002 ∥ T003 (Phase 1 — different new files)
- T004 ∥ T007 ∥ T008 (Phase 2 — backend service vs. frontend types vs. frontend API)
- T009 ∥ T010 ∥ T011 ∥ T012 once Foundational done (Phase 3 — backend endpoint vs. page scaffold vs. route vs. nav link)
- T013 ∥ T017 (Phase 4 — backend vs. frontend hook)
- T020 ∥ T021 ∥ T022 (Phase 6 — independent lint/type-check tools)

---

## Implementation Strategy

### MVP Scope (Phase 1 + Phase 2 + US1 + US2 = T001–T017)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: US1 Template Download (T009–T012)
4. Complete Phase 4: US2 Upload/Validate/Import (T013–T017)
5. **STOP and VALIDATE** using quickstart.md curl tests
6. Deploy/demo: admins can download template, upload, see errors, and import students

### Incremental Delivery

1. Foundation → template download works (US1)
2. Add upload + validate → users see per-row errors (US2 partial)
3. Add execute → students are created in DB (US2 complete)
4. Add success guidance → users know next step (US3)
5. Polish → lint, types, curl validation

### Notes

- `class_id` is intentionally left NULL on import; no enrollment is created until class assignment via Classes page
- Routes T001 must place import sub-paths BEFORE `students/(:segment)` wildcard — critical ordering
- File temp cleanup: use `unlink($tmpPath)` after parsing in both validate and execute controllers
- `StudentImportService::executeBatchImport()` should reuse `EnrollmentModel::enrollStudent()` and `StudentModel::recordStatusHistory()` — do not duplicate that logic
