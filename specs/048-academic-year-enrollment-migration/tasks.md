# Tasks: Academic Year Class Migration via Enrollment History

**Feature**: `048-academic-year-enrollment-migration`  
**Generated**: 2026-04-27  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/api-contracts.md](./contracts/api-contracts.md)  
**Total tasks**: 41 | **Phases**: 7

---

## Implementation Strategy

**MVP = Phase 2 + Phase 3** (database layer + core migration engine + US1 API).  
Phases 4–6 build incrementally on the MVP. Phase 7 (P3 progression mapping UI) is independently deferrable.

Each phase is independently testable before the next phase begins. The existing `POST /api/students/promote` endpoint is untouched throughout.

---

## Phase 1 — Database Layer (Foundational — all phases depend on this)

**Goal**: All four migrations applied and verified. Backfill complete. No application code required yet.

**Independent test**: Run `php spark migrate`; verify via SQL that `class_instances` and `class_progression_mappings` tables exist, `enrollments.class_instance_id` column exists, and all legacy enrollments have a non-null `class_instance_id`.

- [X] T001 Create migration `backend/app/Database/Migrations/2026-04-27-090000_Create_class_instances_table.php` — `class_instances` table with `id`, `tenant_id`, `class_id` FK→classes, `academic_year`, `teacher_id`, `capacity`, `is_final_class`, timestamps; UNIQUE `(tenant_id, class_id, academic_year)`; composite index `(tenant_id, academic_year)`; FK to `tenants` CASCADE and `classes` CASCADE; proper `down()` drops table
- [X] T002 Create migration `backend/app/Database/Migrations/2026-04-27-100000_Add_class_instance_id_to_enrollments.php` — adds nullable `class_instance_id VARCHAR(50)` column to `enrollments` AFTER `class_id`; adds index `idx_enrollments_class_instance_id`; adds FK `fk_enrollments_class_instance` → `class_instances.id` ON DELETE SET NULL; `down()` drops FK then column
- [X] T003 Create migration `backend/app/Database/Migrations/2026-04-27-100001_Create_class_progression_mappings_table.php` — `class_progression_mappings` table with `id`, `tenant_id`, `source_class_id` FK→classes, `stream` NULL, `destination_class_id` FK→classes, timestamps; UNIQUE `(tenant_id, source_class_id, stream)`; index on `tenant_id`; FKs to tenants and classes with CASCADE; `down()` drops table
- [X] T004 Create migration `backend/app/Database/Migrations/2026-04-27-100002_Backfill_class_instances_from_enrollments.php` — Step 1: `INSERT IGNORE INTO class_instances` selecting one row per unique `(tenant_id, class_id, academic_session)` from `enrollments` joined to `classes` (id = `CONCAT('ci_legacy_', MD5(CONCAT(class_id, '_', academic_session)))`); Step 2: `UPDATE enrollments JOIN class_instances SET class_instance_id = ci.id WHERE class_instance_id IS NULL`; `down()` sets `enrollments.class_instance_id = NULL` then deletes legacy instances

---

## Phase 2 — Backend Models (Foundational — Phases 3–7 depend on this)

**Goal**: All three model files exist and are unit-testable. `EnrollmentModel` backward-compatibility preserved.

**Independent test**: Instantiate each model in a test; call `formatForApi()` with a sample row and assert camelCase output; query `getByTenantAndYear()` on seeded data and assert correct rows returned.

- [X] T005 [P] Create `backend/app/Models/ClassInstanceModel.php` — extend `Model`; table `class_instances`; `useAutoIncrement = false`; `allowedFields = ['id','tenant_id','class_id','academic_year','teacher_id','capacity','is_final_class']`; `useTimestamps = true`; methods: `getByTenantAndYear(string $tenantId, string $academicYear): array`, `getOrCreate(string $tenantId, string $classId, string $academicYear, array $defaults): array` (INSERT IGNORE + re-fetch), `formatForApi(array $instance): array` (camelCase: `id`, `tenantId`, `classId`, `className`, `academicYear`, `teacherId`, `capacity`, `isFinalClass`, `studentCount`), `formatFromApi(array $data, string $tenantId): array`
- [X] T006 [P] Create `backend/app/Models/ClassProgressionMappingModel.php` — extend `Model`; table `class_progression_mappings`; `useAutoIncrement = false`; `allowedFields = ['id','tenant_id','source_class_id','stream','destination_class_id']`; `useTimestamps = true`; methods: `getByTenant(string $tenantId): array`, `resolveDestination(string $tenantId, string $sourceClassId, ?string $stream): ?array` (stream-specific match first, then NULL wildcard), `formatForApi(array $mapping): array` (camelCase including `sourceClassName`, `destinationClassName` if joined), `formatFromApi(array $data, string $tenantId): array`
- [X] T007 Modify `backend/app/Models/EnrollmentModel.php` — (a) add `'class_instance_id'` to `$allowedFields`; (b) update `getStudentHistory()` to `LEFT JOIN class_instances ci ON ci.id = enrollments.class_instance_id` and select `COALESCE(ci.academic_year, enrollments.academic_session) AS academic_year_resolved`; (c) add method `getActiveByInstanceId(string $classInstanceId): array` — returns all ACTIVE enrollments for that instance with student name join; (d) update `formatForApi()` to include `classInstanceId` and `academicYear` fields (null-safe)

---

## Phase 3 — Migration Service (US1: Year-End Migration)

**Story**: US1 — Run Year-End Class Migration to Create Next-Year Enrollments  
**Goal**: `ClassMigrationService` implements the full migration decision tree. Dry-run and commit modes work correctly. All edge cases from the spec handled.

**Independent test**: Call `previewMigration($tenantId, '2025/2026', '2026/2027')` with seeded data containing one promotable student, one repeating student, one graduating student, one unconfigured-class student. Assert summary counts and `skippedStudents` array without any DB writes.

- [X] T008 [US1] Create `backend/app/Services/ClassMigrationService.php` — constructor accepts `ClassInstanceModel`, `ClassProgressionMappingModel`, `EnrollmentModel`, `StudentModel`, `ClassModel`; define private method `validateAcademicYears(string $from, string $to): void` — regex validate format `^\d{4}\/\d{4}$`, assert $to year = $from year + 1, throw `\InvalidArgumentException` on failure
- [X] T009 [US1] Add `resolveNextClass(string $tenantId, string $classId, ?string $stream): ?array` to `ClassMigrationService` — (1) query `ClassProgressionMappingModel::resolveDestination()` for stream-specific then wildcard match; (2) fall back to `ClassModel::getNextClass($classId)`; return class row array or null
- [X] T010 [US1] Add `buildMigrationPlan(string $tenantId, string $fromYear): array` to `ClassMigrationService` — fetch all ACTIVE enrollments for tenant+year in one query (join students, class_instances, classes); for each enrollment determine outcome: REPEATED (student.status='repeating'), GRADUATED (class_instance.is_final_class=1), PROMOTED (next class resolved), SKIPPED (no next class); return structured plan array with `summary` counts and `byClass` breakdown and `skippedStudents` list
- [X] T011 [US1] Add `previewMigration(string $tenantId, string $fromYear, string $toYear): array` to `ClassMigrationService` — call `validateAcademicYears`, call `buildMigrationPlan`, return plan without any DB writes; throw `\RuntimeException("No active enrollments found for {$fromYear}")` if plan has zero students
- [X] T012 [US1] Add `runMigration(string $tenantId, string $fromYear, string $toYear): array` to `ClassMigrationService` — (a) call `validateAcademicYears`; (b) idempotency check: if zero ACTIVE enrollments remain for `$fromYear` throw `\RuntimeException("Migration already executed")` with code 409; (c) call `buildMigrationPlan`; (d) wrap all writes in `$db->transStart()` / `$db->transComplete()`; for each PROMOTED student: call `ClassInstanceModel::getOrCreate()` for destination, close enrollment (status=PROMOTED, completion_date=today), `EnrollmentModel::enrollStudent()` with both `class_id` and `class_instance_id` set, update `students.class_id` and `students.current_enrollment_id`; for each REPEATED: same but same class template, status=REPEATED; for each GRADUATED: close enrollment status=GRADUATED, `StudentModel::update()` status='graduated', class_id=null, current_enrollment_id=null; on any exception `$db->transRollback()` and rethrow; return summary
- [X] T013 [US1] Add `generateInstances(string $tenantId, string $academicYear): array` to `ClassMigrationService` — fetch all non-archived classes for tenant; for each call `ClassInstanceModel::getOrCreate()` using class defaults; return `['created' => N, 'existing' => M, 'total' => N+M, 'instances' => [...]]`

---

## Phase 4 — API Controller & Routes (US1 + US3 + US5)

**Story**: US1 (migration endpoints), US2 (template management — reuses existing ClassController), US3 (instance generation), US5 (progression mappings)  
**Goal**: All 8 new endpoints wired and returning correct responses per contracts/api-contracts.md.

**Independent test**: `POST /api/class-instances/generate` with valid JWT returns `status: true` with `created` and `total` counts. `POST /api/class-migration/preview` without `fromAcademicYear` returns `status: false` 400.

- [X] T014 [US1] Create `backend/app/Controllers/Api/ClassMigrationController.php` — extend `BaseApiController`; constructor instantiates `ClassMigrationService`, `ClassInstanceModel`, `ClassProgressionMappingModel`; add role guard helper `requireAdmin()` returning 403 response if role not `admin`/`super_admin`
- [X] T015 [US1] Add `preview()` method to `ClassMigrationController` — read `fromAcademicYear` and `toAcademicYear` from request body; validate both present; call `ClassMigrationService::previewMigration()`; wrap in try/catch: catch `\InvalidArgumentException` → 400, catch `\RuntimeException` with code 409 → 409, catch `\RuntimeException` → 422; return `$this->success($result, 'Preview ready — no changes written')`
- [X] T016 [US1] Add `run()` method to `ClassMigrationController` — require `confirm === true` in body (400 if missing); call `ClassMigrationService::runMigration()`; same catch mapping as preview; return success with summary
- [X] T017 [US3] Add `generateInstances()` method to `ClassMigrationController` — validate `academicYear` present and matches `^\d{4}\/\d{4}$`; validate years consecutive; call `ClassMigrationService::generateInstances()`; return success
- [X] T018 [US3] Add `listInstances()` method to `ClassMigrationController` — read optional `academic_year` and `class_id` query params; query `ClassInstanceModel::getByTenantAndYear()` (or all years if no filter); batch-attach student counts via single GROUP BY query; return formatted array
- [X] T019 [US3] Add `showInstance()` and `instanceStudents()` methods to `ClassMigrationController` — `showInstance($id)`: find by id+tenant, 404 if missing, return `formatForApi`; `instanceStudents($id)`: find instance, call `EnrollmentModel::getActiveByInstanceId()`, return formatted student list; teacher role: verify `class_instances.teacher_id` matches current staff member's id
- [X] T020 [US5] Add `listMappings()`, `createMapping()`, `deleteMapping()` methods to `ClassMigrationController` — `listMappings()`: fetch all for tenant, batch-join class names, return formatted; `createMapping()`: validate `sourceClassId` and `destinationClassId` present and tenant-owned, validate not same ID, call insert, 409 on duplicate; `deleteMapping($id)`: find by id+tenant, delete, return success
- [X] T021 Modify `backend/app/Config/Routes.php` — inside the JWT-protected group add: `$routes->get('class-instances', 'ClassMigrationController::listInstances')`, `$routes->post('class-instances/generate', 'ClassMigrationController::generateInstances')`, `$routes->get('class-instances/(:segment)', 'ClassMigrationController::showInstance/$1')`, `$routes->get('class-instances/(:segment)/students', 'ClassMigrationController::instanceStudents/$1')`, `$routes->post('class-migration/preview', 'ClassMigrationController::preview')`, `$routes->post('class-migration/run', 'ClassMigrationController::run')`, `$routes->get('class-progression-mappings', 'ClassMigrationController::listMappings')`, `$routes->post('class-progression-mappings', 'ClassMigrationController::createMapping')`, `$routes->delete('class-progression-mappings/(:segment)', 'ClassMigrationController::deleteMapping/$1')`

---

## Phase 5 — Integration Tests (US1 + US3 + US5)

**Goal**: All critical paths covered. Tests are independently runnable via `php spark test --filter <ClassName>`.

**Independent test**: `php spark test --filter ClassMigrationRunTest` passes all assertions with a clean database seeded by test setup.

- [X] T022 [P] [US3] Create `backend/tests/Controllers/ClassMigration/ClassInstanceTest.php` — test `POST /api/class-instances/generate`: (a) happy path creates N instances for N active templates; (b) second call returns same instances with `created: 0, existing: N`; (c) archived template produces no instance; (d) instance inherits template's capacity and is_final_class; (e) missing `academicYear` returns 400; (f) non-admin JWT returns 403
- [X] T023 [P] [US1] Create `backend/tests/Controllers/ClassMigration/ClassMigrationPreviewTest.php` — test `POST /api/class-migration/preview`: (a) dry-run returns correct summary counts without writing any rows; (b) skipped student with unconfigured class appears in `skippedStudents`; (c) missing `fromAcademicYear` returns 400; (d) `toAcademicYear` not one year ahead returns 400; (e) no active enrollments for year returns 422; (f) preview result matches subsequent run result exactly (count-for-count)
- [X] T024 [US1] Create `backend/tests/Controllers/ClassMigration/ClassMigrationRunTest.php` — test `POST /api/class-migration/run`: (a) happy path: promoted student has new ACTIVE enrollment, old enrollment is PROMOTED, student.class_id updated; (b) repeating student (status='repeating') gets REPEATED enrollment + new enrollment in same class; (c) graduating student (final class) gets GRADUATED enrollment, student.status='graduated', no new enrollment; (d) confirm=false or missing returns 400; (e) second run returns 409 (no ACTIVE enrollments remain); (f) forced transaction failure (inject bad class_id) rolls back fully — enrollment count unchanged; (g) other-tenant enrollments are untouched after migration
- [X] T025 [P] [US5] Create `backend/tests/Controllers/ClassMigration/ClassProgressionMappingTest.php` — test mapping CRUD: (a) `POST /api/class-progression-mappings` creates mapping; (b) duplicate source+stream returns 409; (c) `GET /api/class-progression-mappings` returns tenant-scoped list; (d) `DELETE /api/class-progression-mappings/:id` removes mapping; (e) when mapping exists for source class, `runMigration` uses destination from mapping rather than `next_class_id`; (f) NULL stream mapping used when no stream-specific match found

---

## Phase 6 — Frontend (US1 + US3 + US4)

**Story**: US1 (migration trigger UI), US3 (instance generation UI), US4 (enrollment history view)  
**Goal**: Admin can trigger a year-end migration from the Classes page — preview then confirm. Existing enrollment history endpoint renders `academicYear` from `class_instance_id` where available.

**Independent test**: Open Classes page → click "Year-End Migration" → verify preview table renders per-class outcome rows → confirm → verify success toast.

- [X] T026 [P] [US1] Create `frontend/src/hooks/useClassMigration.ts` — export `useClassMigration()` returning: `preview(fromYear: string, toYear: string): Promise<MigrationPreviewResult>` (POST `/api/class-migration/preview`), `run(fromYear: string, toYear: string): Promise<MigrationRunResult>` (POST `/api/class-migration/run` with `confirm: true`), `generateInstances(academicYear: string): Promise<GenerateInstancesResult>` (POST `/api/class-instances/generate`), `isLoading`, `error`; use TanStack Query mutation pattern consistent with existing hooks
- [X] T027 [P] [US1] Create `frontend/src/components/classes/MigrationPreviewTable.tsx` — accepts `previewData: MigrationPreviewResult` prop; renders a table with columns: Class Name, Action (promote/graduate/skip badge), Destination Class, Students Promoted, Students Repeated, Students Graduated, Students Skipped; if `skippedStudents.length > 0` renders a collapsible warning section listing each skipped student name and reason; no API calls inside this component (pure display)
- [X] T028 [US1] Create `frontend/src/components/classes/YearEndMigrationPanel.tsx` — collapsible panel/section; contains: `fromAcademicYear` and `toAcademicYear` text inputs (pre-filled from tenant settings); "Preview Migration" button calls `useClassMigration().preview()` and renders `<MigrationPreviewTable>`; "Confirm & Run" button (disabled until preview loaded, enabled only if `summary.skipped === 0` or admin acknowledges skips) calls `run()` with confirmation dialog; shows success summary after run; shows error alert on failure; uses existing shadcn/ui `Button`, `Dialog`, `Badge`, `Alert` components
- [X] T029 [US1] Modify `frontend/src/pages/Classes.tsx` — import `YearEndMigrationPanel`; add an "Academic Year Migration" section (visible to admin role only) above or below the class list; pass no props (panel manages its own state via hook)
- [X] T030 [P] [US3] Add `generateInstances` UI to `YearEndMigrationPanel.tsx` — add a secondary "Generate Class Instances" sub-section with academic year input and button; calls `useClassMigration().generateInstances()`; shows result summary (N created, M existing); renders before the migration trigger section so admin can prepare instances first
- [X] T031 [P] [US4] Add TypeScript types for new API shapes to `frontend/src/types/dashboard.ts` (or create `frontend/src/types/enrollment.ts` if cleaner) — define: `ClassInstance`, `MigrationPreviewResult`, `MigrationRunResult`, `GenerateInstancesResult`, `MigrationByClass`, `SkippedStudent`, `ClassProgressionMapping`; update existing `Enrollment` type to include `classInstanceId?: string` and `academicYear?: string`

---

## Phase 7 — Progression Mappings UI (US5 — P3, independently deferrable)

**Story**: US5 — Configure Progression Mapping for Complex School Structures  
**Goal**: Admin can view and manage `class_progression_mappings` records from a dedicated UI section.

**Independent test**: Create a mapping via the UI for source "Form 2" stream "Science" → destination "Form 3 Science"; verify it appears in the mappings list; delete it and verify it disappears.

- [ ] T032 [US5] Create `frontend/src/hooks/useClassProgressionMappings.ts` — `listMappings()` (GET `/api/class-progression-mappings`), `createMapping(data)` (POST), `deleteMapping(id)` (DELETE); uses TanStack Query with `invalidateQueries` on mutation success
- [ ] T033 [US5] Create `frontend/src/components/classes/ProgressionMappingsTable.tsx` — renders list of mappings with Source Class, Stream, Destination Class columns; per-row Delete button with confirmation; empty state when no mappings
- [ ] T034 [US5] Create `frontend/src/components/classes/AddProgressionMappingModal.tsx` — modal with dropdowns for Source Class (from existing classes API) and Destination Class; optional Stream text input; submit calls `createMapping()`; 409 error displayed inline; uses shadcn/ui `Dialog`, `Select`, `Input`
- [ ] T035 [US5] Integrate progression mapping UI into `frontend/src/pages/Classes.tsx` or `YearEndMigrationPanel.tsx` — add a "Progression Overrides" collapsible section (admin-only) containing `<ProgressionMappingsTable>` and an "Add Override" button that opens `<AddProgressionMappingModal>`

---

## Phase 8 — Polish & Cross-Cutting Concerns

**Goal**: Enrollment history correctly surfaces academic year from class instances. All edge-case guards verified.

- [ ] T036 [P] Verify `GET /api/students/:id/enrollment-history` response — confirm that enrollments with `class_instance_id` set return `classInstanceId` and `academicYear` in API response per contracts; confirm legacy enrollments (null `class_instance_id`) return `classInstanceId: null` and `academicYear` derived from `academic_session` string; update `EnrollmentModel::formatForApi()` to include both new fields
- [ ] T037 [P] Add archived template guard to `ClassMigrationService::generateInstances()` — verify that classes with non-null `archived_at` are excluded from instance generation; add assertion in `ClassInstanceTest.php` that confirms zero instances created for archived templates
- [ ] T038 [P] Add academic year format validation helper `validateAcademicYearFormat(string $year): bool` to `ClassMigrationController` (or BaseApiController) — regex `^\d{4}\/\d{4}$` + assert second part = first part + 1; reuse in both `generateInstances()` and `preview()`/`run()` request validation
- [ ] T039 Verify backward compatibility of existing `POST /api/students/promote` — run existing promotion integration tests (if any) or manual test: promote a student via the old endpoint; assert new enrollment has `class_id` set and `class_instance_id` is NULL (old path does not set it); assert `students.class_id` and `current_enrollment_id` updated correctly; document in `quickstart.md` that both flows coexist
- [ ] T040 Update `backend/app/Database/Seeds/CompleteDatabaseSeeder.php` (or relevant factory) — ensure seeder creates at least one `class_instances` row per seeded class × academic session so integration tests have valid FK targets for `enrollments.class_instance_id`; update any `EnrollmentFactory` to set both `class_id` and `class_instance_id`
- [ ] T041 Final review pass — read through all new PHP files and confirm: every DB query includes `tenant_id` filter; no raw SQL without parameterised values; all new controller methods return via `$this->success()` or `$this->error()`; all migration `down()` methods are complete; `Routes.php` routes are inside the `JWTAuthFilter` group

---

## Dependencies

```
Phase 1 (DB migrations)
  └─ Phase 2 (Models — need tables to exist)
       └─ Phase 3 (Service — needs models)
            └─ Phase 4 (Controller + Routes — needs service)
                 └─ Phase 5 (Integration tests — needs endpoints)
                      └─ Phase 8 (Polish — needs everything working)

Phase 4 ──────────────────────────────── Phase 6 (Frontend — needs API endpoints)
                                              └─ Phase 7 (Mapping UI — needs frontend hook)
```

Phase 5 (tests) and Phase 6 (frontend) can be developed **in parallel** once Phase 4 is complete.  
Phase 7 (P3 mapping UI) is fully independent of Phase 6 and can be deferred indefinitely.

---

## Parallel Execution Opportunities

Within each phase, tasks marked `[P]` can be executed simultaneously:

| Phase | Parallel group |
|-------|---------------|
| Phase 2 | T005 (ClassInstanceModel) ‖ T006 (ClassProgressionMappingModel) — independent files |
| Phase 5 | T022 (ClassInstanceTest) ‖ T023 (ClassMigrationPreviewTest) ‖ T025 (ClassProgressionMappingTest) — separate test files |
| Phase 6 | T026 (hook) ‖ T027 (MigrationPreviewTable) ‖ T031 (types) — independent files |
| Phase 8 | T036 ‖ T037 ‖ T038 — independent guard/verify tasks |

---

## Task Count by User Story

| User Story | Priority | Tasks | Phase |
|------------|----------|-------|-------|
| Foundational (DB + Models) | P0 | T001–T007 | 1–2 |
| US1 – Year-End Migration | P1 | T008–T016, T023–T024, T028–T030 | 3–4, 5, 6 |
| US3 – Generate Class Instances | P2 | T017–T019, T022, T030 | 4–5, 6 |
| US4 – Enrollment History View | P2 | T036 | 8 |
| US5 – Progression Mappings | P3 | T020, T025, T032–T035 | 4–5, 7 |
| Cross-cutting / Polish | — | T021, T037–T041 | 4, 8 |

**MVP scope** (US1 end-to-end working): T001–T016, T021 = 16 tasks covering DB + models + service + controller + routes.
