# Tasks: Student Attendance – Class-Linked Event Tracking

**Input**: Design documents from `/specs/068-student-attendance-classes/`  
**Branch**: `068-student-attendance-classes`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and model scaffolding shared by all user stories

- [ ] T001 Create migration `backend/app/Database/Migrations/2026-05-08-000002_CreateStudentAttendanceEvents.php` with `student_attendance_events` table: id VARCHAR(100) PK, tenant_id VARCHAR(50) NOT NULL, student_id VARCHAR(50) NOT NULL, class_instance_id VARCHAR(50) NOT NULL, class_id VARCHAR(50) NOT NULL, academic_session VARCHAR(20) NOT NULL, date DATE NOT NULL, period_key VARCHAR(50) NULL, status ENUM('present','absent','late','excused','half_day') NOT NULL, is_effective TINYINT(1) NOT NULL DEFAULT 1, submitted_by VARCHAR(50) NOT NULL, submitted_at DATETIME NOT NULL, remarks TEXT NULL, created_at DATETIME NULL; indexes: idx_sae_tenant_instance_date(tenant_id,class_instance_id,date), idx_sae_tenant_student_date(tenant_id,student_id,date), idx_sae_tenant_student_instance(tenant_id,student_id,class_instance_id), idx_sae_effective(tenant_id,class_instance_id,date,is_effective); FKs to tenants, students, class_instances; down() drops the table
- [ ] T002 Run `php spark migrate` in `backend/` and verify `student_attendance_events` table exists with all columns
- [ ] T003 Create `backend/app/Models/StudentClassAttendanceModel.php` extending `CodeIgniter\Model` targeting `student_attendance_events`; allowedFields: id, tenant_id, student_id, class_instance_id, class_id, academic_session, date, period_key, status, is_effective, submitted_by, submitted_at, remarks, created_at; useAutoIncrement false; returnType array; add `getEffectiveForClassDate(tenantId, classInstanceId, date, periodKey=null)` query; add `getAuditLog(tenantId, studentId, classInstanceId, date, periodKey=null)` returning all rows ordered by submitted_at ASC; add `cascadeIsEffective(tenantId, studentId, classInstanceId, date, periodKey)` sets is_effective=0 for existing effective row(s)
- [ ] T004 [P] Add `studentAttendanceMode` key (`"per_day"`) to the `DEFAULT_SETTINGS` constant in `backend/app/Controllers/Api/SettingsController.php`; ensure `update()` accepts and casts the new key (string, allowed values `per_day`/`per_period`)

**Checkpoint**: Migration applied, model scaffolded, settings key registered — foundation ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service layer and routes skeleton that all user stories share

- [ ] T005 Create `backend/app/Services/StudentClassAttendanceService.php` with constructor accepting injected `StudentClassAttendanceModel`; add stub public methods: `submitBatch(tenantId, classInstanceId, date, periodKey, records, submittedBy): array`, `getEffectiveRegister(tenantId, classInstanceId, date, periodKey): array`, `getStudentSummary(tenantId, studentId, academicSession, startDate, endDate): array`, `getClassSummary(tenantId, classInstanceId, startDate, endDate, search): array`, `getSessionSummary(tenantId, academicSession): array`, `getAuditLog(tenantId, studentId, classInstanceId, date, periodKey): array`; each stub returns empty array for now
- [ ] T006 Create `backend/app/Controllers/Api/StudentClassAttendanceController.php` extending `BaseApiController`; inject `StudentClassAttendanceService`; add stub action methods: `submit()`, `index()`, `studentSummary($studentId)`, `classSummary($classInstanceId)`, `sessionSummary()`, `auditLog()`; each returns `$this->respondSuccess([])`
- [ ] T007 Register 6 new routes in `backend/app/Config/Routes.php` inside the JWT-protected block, BEFORE any `(:segment)` wildcards: `GET class-attendance/summary/student/(:segment)→studentSummary/$1`, `GET class-attendance/summary/class/(:segment)→classSummary/$1`, `GET class-attendance/summary/session→sessionSummary`, `GET class-attendance/audit→auditLog`, `GET class-attendance→index`, `POST class-attendance→submit`; all routed to `StudentClassAttendanceController`
- [ ] T008 Run `php -l backend/app/Models/StudentClassAttendanceModel.php backend/app/Services/StudentClassAttendanceService.php backend/app/Controllers/Api/StudentClassAttendanceController.php` and confirm no syntax errors

**Checkpoint**: All 6 routes reachable and returning 200 empty success — story implementation can begin

---

## Phase 3: User Story 1 – Daily Class Attendance Recording (Priority: P1) 🎯 MVP

**Goal**: Batch submit attendance for a class instance; each mark stored as an immutable event linked to class_instance_id, session, date. Corrections create new effective events; prior events preserved.

**Independent Test**: POST batch → verify events in DB; resubmit correction → verify is_effective cascade; GET register → verify effective status; verify future date rejected 400; verify missing auth rejected 401.

- [ ] T009 [US1] Implement `StudentClassAttendanceService::submitBatch()` in `backend/app/Services/StudentClassAttendanceService.php`: (1) validate classInstanceId belongs to tenant via DB query on `class_instances`; (2) reject date > today with 400 error; (3) validate `status` values against allowed ENUM; (4) check duplicate studentIds in records array — throw if duplicates; (5) load `studentAttendanceMode` from tenant settings; (6) if mode=`per_day` and periodKey is not null — throw 400; (7) if mode=`per_period` and periodKey is null — throw 400; (8) for each record: query `enrollments` for active enrollment (status=ACTIVE, class_instance_id matches) — if none, add to skipped[]; (9) for eligible records wrap the cascade+insert in a single DB transaction: call `cascadeIsEffective()` then insertBatch; (10) return `{saved: int, skipped: array, date, classInstanceId, periodKey}`
- [ ] T010 [US1] Implement `StudentClassAttendanceController::submit()` in `backend/app/Controllers/Api/StudentClassAttendanceController.php`: require roles admin/super_admin/teacher via `requireRole()`; parse JSON body for classInstanceId, date, periodKey, records; validate required fields; call `service->submitBatch()`; return `respondSuccess($result, 201)` on success; catch and map service exceptions to appropriate HTTP codes (400/403/404/422)
- [ ] T011 [US1] Implement `StudentClassAttendanceService::getEffectiveRegister()` in `backend/app/Services/StudentClassAttendanceService.php`: fetch all rows from `student_attendance_events` WHERE tenant_id=? AND class_instance_id=? AND date=? AND is_effective=1 AND (period_key=? or period_key IS NULL); JOIN to `students` for studentName; join to `class_instances` for className; compute summary counts (presentCount, absentCount, lateCount, excusedCount, halfDayCount, totalStudents); return structured array
- [ ] T012 [US1] Implement `StudentClassAttendanceController::index()` in `backend/app/Controllers/Api/StudentClassAttendanceController.php`: roles admin/super_admin/teacher/bursar; require GET params `classInstanceId` and `date`; optional `periodKey`; validate date format; call `service->getEffectiveRegister()`; `respondSuccess($result)`
- [ ] T013 [US1] Add TypeScript interfaces to `frontend/src/types/dashboard.ts`: `StudentAttendanceEvent { id, studentId, studentName, classInstanceId, academicSession, date, periodKey, status, isEffective, submittedBy, submittedAt, remarks }`; `ClassAttendanceRegister { classInstanceId, date, periodKey, records: StudentAttendanceEvent[], totalStudents, presentCount, absentCount, lateCount, excusedCount, halfDayCount }`; `ClassAttendanceBatchInput { classInstanceId, date, periodKey, records: { studentId, status, remarks }[] }`; `ClassAttendanceBatchResult { saved, skipped, date, classInstanceId, periodKey }`
- [ ] T014 [P] [US1] Add API methods to `frontend/src/api/api.ts`: `submitClassAttendance(input: ClassAttendanceBatchInput): Promise<ClassAttendanceBatchResult>` via POST `/class-attendance`; `getClassAttendanceRegister(classInstanceId, date, periodKey?): Promise<ClassAttendanceRegister>` via GET `/class-attendance`
- [ ] T015 [P] [US1] Create `frontend/src/hooks/useClassAttendance.ts` with: `useClassAttendanceRegister(classInstanceId, date, periodKey?)` using `useQuery`; `useSubmitClassAttendance()` using `useMutation` that invalidates the register query on success
- [ ] T016 [US1] Create `frontend/src/components/attendance/ClassAttendanceSubmitForm.tsx`: class instance selector (Select from loaded class instances), date picker (max = today), student list with status radio/select per row (present/absent/late/excused/half_day), remarks input per student, Submit button calling `useSubmitClassAttendance`; show toast on success/error; show `skipped` students as warning badge if any
- [ ] T017 [US1] Create `frontend/src/components/attendance/ClassAttendanceTab.tsx`: wraps `ClassAttendanceSubmitForm` and a read-only register view using `useClassAttendanceRegister`; show summary stat chips (present/absent/late/excused/half-day counts); show correction note if any student has prior superseded events
- [ ] T018 [US1] Add "Class Attendance" tab to `frontend/src/pages/Attendance.tsx` that renders `ClassAttendanceTab`
- [ ] T019 [US1] Run PHP lint on `StudentClassAttendanceService.php` and `StudentClassAttendanceController.php`; run `node node_modules/typescript/bin/tsc --noEmit --pretty false` in `frontend/`; fix any errors

**Checkpoint**: POST batch → 201; GET register → 200 with effective records; correction → old row is_effective=0; future date → 400; missing auth → 401. US1 fully functional.

---

## Phase 4: User Story 2 – Per-Period Attendance Tracking (Priority: P2)

**Goal**: Schools configured for per-period mode can submit attendance once per period per day. Period entries are stored independently; a derived daily summary aggregates across periods.

**Independent Test**: Set mode to `per_period` via settings; submit P1 and P2 entries for same student+date; verify both stored as separate effective events with different period_keys; verify per-day mode rejects periodKey.

- [ ] T020 [US2] Extend `StudentClassAttendanceService::submitBatch()` already implemented in T009 to handle period-mode validation fully: verify that in `per_period` mode, submitting the same (student, class_instance, date, periodKey) twice within the same batch is rejected as duplicate; verify that in `per_period` mode multiple batches with different periodKeys for the same student+date are each stored with their own `is_effective=1` flag (the cascade only matches rows with the exact same periodKey)
- [ ] T021 [US2] Add `getDailyDerivedStatus(periodRows: array): string` helper method to `StudentClassAttendanceService.php`: given multiple period rows for one student on one date, derive a single daily status using rule: if any row is `absent` → `absent`; else if any is `excused` → `excused`; else if any is `late` → `late`; else if any is `half_day` → `half_day`; else `present`
- [ ] T022 [US2] Extend `StudentClassAttendanceService::getEffectiveRegister()` to return a `dailyStatus` field per student derived via `getDailyDerivedStatus()` when multiple period rows exist for the same student on the given date
- [ ] T023 [US2] Update settings UI: in `frontend/src/components/settings/` add an `AttendanceModeCard` component (Card + Switch + Save, role-aware: admin-only write) inside the appropriate settings tab; wire to existing settings GET/PUT endpoints using the `studentAttendanceMode` key; display current mode label "Per Day" / "Per Period"
- [ ] T024 [US2] Run PHP lint and TypeScript type-check after T020–T023; fix any errors

**Checkpoint**: Per-period mode fully functional; switching modes via settings takes effect for new submissions without corrupting existing records. US2 independently testable.

---

## Phase 5: User Story 3 – Attendance Aggregation and Reporting (Priority: P2)

**Goal**: Administrators can query attendance percentages and counts per student, per class, or per academic session without modifying any source event records.

**Independent Test**: Pre-populate events; query student summary → verify counts and rate; query class summary → verify per-student rows; query session summary → verify class-level rows; empty result set returns 200 not error.

- [ ] T025 [US3] Implement `StudentClassAttendanceService::getStudentSummary()` in `backend/app/Services/StudentClassAttendanceService.php`: query `student_attendance_events` WHERE is_effective=1, tenant_id=?, student_id=?, academic_session=? (optional date range filter on `date`); aggregate counts per status; compute attendanceRate = (present+late) / totalDays * 100; GROUP BY class_instance_id for classBreakdown array; return structured summary including studentName (JOIN to students), classBreakdown array
- [ ] T026 [US3] Implement `StudentClassAttendanceService::getClassSummary()` in `backend/app/Services/StudentClassAttendanceService.php`: query events WHERE is_effective=1, tenant_id=?, class_instance_id=?, date BETWEEN startDate AND endDate; aggregate per-student counts; optional LIKE search on student name; compute classAttendanceRate as average of per-student rates; JOIN to `class_instances` for className + academicYear; return structured result
- [ ] T027 [US3] Implement `StudentClassAttendanceService::getSessionSummary()` in `backend/app/Services/StudentClassAttendanceService.php`: query events WHERE is_effective=1, tenant_id=?, academic_session=?; GROUP BY class_instance_id; aggregate total students (COUNT DISTINCT student_id), totalDaysRecorded, classAttendanceRate per class instance; JOIN to `class_instances` for className
- [ ] T028 [P] [US3] Implement controller actions in `backend/app/Controllers/Api/StudentClassAttendanceController.php`: `studentSummary($studentId)` — roles all authenticated; require `sessionId` GET param; optional `startDate`/`endDate`; call `service->getStudentSummary()`; `classSummary($classInstanceId)` — require `startDate`+`endDate`; optional `search`; call `service->getClassSummary()`; `sessionSummary()` — roles admin/super_admin; require `academicSession` param; call `service->getSessionSummary()`; all use `respondSuccess()`
- [ ] T029 [P] [US3] Add TypeScript interfaces to `frontend/src/types/dashboard.ts`: `StudentAttendanceSummaryNew { studentId, studentName, academicSession, startDate, endDate, totalDays, present, absent, late, excused, halfDay, attendanceRate, classBreakdown[] }`; `ClassAttendanceSummary { classInstanceId, className, academicYear, startDate, endDate, classAttendanceRate, totalStudents, students[] }`; `SessionAttendanceSummary { academicSession, classes[] }`; add API methods to `frontend/src/api/api.ts`: `getStudentAttendanceSummaryNew()`, `getClassAttendanceSummary()`, `getSessionAttendanceSummary()`
- [ ] T030 [US3] Add `useClassAttendanceSummary(classInstanceId, startDate, endDate, search?)` and `useStudentAttendanceSummary(studentId, sessionId)` hooks to `frontend/src/hooks/useClassAttendance.ts`
- [ ] T031 [US3] Create `frontend/src/components/attendance/ClassAttendanceSummaryTable.tsx`: accepts class summary data; renders a table with per-student rows: name, present, absent, late, excused, half-day, attendance rate; color-coded rate badge (green ≥85%, amber ≥70%, red <70%); search input with debounce; class-level overall rate header stat
- [ ] T032 [US3] Add "Summary" sub-tab to `ClassAttendanceTab.tsx` using `ClassAttendanceSummaryTable`; add date-range pickers for start/end date
- [ ] T033 [US3] Run PHP lint and TypeScript type-check; fix any errors

**Checkpoint**: All three aggregation endpoints return correct computed results; empty results return 200 not 404. US3 independently testable.

---

## Phase 6: User Story 4 – Audit Log Access (Priority: P3)

**Goal**: Administrators can query the full immutable event history for any student+date+class combination, including superseded events with submitter identity and timestamps.

**Independent Test**: Submit attendance → resubmit correction → GET audit log → verify both events present with isEffective values; first event isEffective=false, second isEffective=true.

- [ ] T034 [US4] Implement `StudentClassAttendanceService::getAuditLog()` in `backend/app/Services/StudentClassAttendanceService.php`: query ALL rows (both is_effective=0 and is_effective=1) for tenant_id=?, student_id=?, class_instance_id=?, date=?, optional period_key match; order by submitted_at ASC; return array with each row: id, status, isEffective, submittedBy, submittedAt, remarks
- [ ] T035 [US4] Implement `StudentClassAttendanceController::auditLog()` in `backend/app/Controllers/Api/StudentClassAttendanceController.php`: roles admin/super_admin only; require GET params studentId, classInstanceId, date; optional periodKey; validate tenant owns both student and class instance; call `service->getAuditLog()`; `respondSuccess($result)`
- [ ] T036 [P] [US4] Add interface `AttendanceAuditLog { studentId, classInstanceId, date, periodKey, events: { id, status, isEffective, submittedBy, submittedAt, remarks }[] }` to `frontend/src/types/dashboard.ts`; add `getAttendanceAuditLog(studentId, classInstanceId, date, periodKey?)` method to `frontend/src/api/api.ts`
- [ ] T037 [US4] Add `useAttendanceAuditLog(studentId, classInstanceId, date, periodKey?)` hook to `frontend/src/hooks/useClassAttendance.ts`; add an audit log drawer/dialog component inline in `ClassAttendanceTab.tsx` that shows the event history timeline when an admin clicks a "History" icon on a student row
- [ ] T038 [US4] Run PHP lint and TypeScript type-check; fix any errors

**Checkpoint**: Audit log returns all events including superseded; non-admin role gets 403; cross-tenant student returns 404. US4 independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T039 [P] PHP lint final pass on all 4 new/modified backend files: `StudentClassAttendanceModel.php`, `StudentClassAttendanceService.php`, `StudentClassAttendanceController.php`, `Routes.php`, `SettingsController.php`
- [ ] T040 [P] TypeScript type-check: run `node node_modules/typescript/bin/tsc --noEmit --pretty false` in `frontend/`; confirm 0 errors
- [ ] T041 [P] ESLint targeted run on new/modified frontend files: `useClassAttendance.ts`, `ClassAttendanceTab.tsx`, `ClassAttendanceSubmitForm.tsx`, `ClassAttendanceSummaryTable.tsx`, `Attendance.tsx`; fix any errors (skip pre-existing api.ts no-explicit-any)
- [ ] T042 Run curl validation from `specs/068-student-attendance-classes/quickstart.md`: steps 5–11 (batch submit, GET register, correction, audit log, per-student summary, class summary, error tests); record results in `quickstart.md`
- [ ] T043 Verify tenant isolation: use second-tenant token; attempt GET register and POST batch for first-tenant classInstanceId; confirm 404 responses
- [ ] T044 Update `specs/068-student-attendance-classes/tasks.md` marking all completed tasks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001–T004) — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 complete — delivers MVP
- **Phase 4 (US2)**: Depends on Phase 3 (T009 submitBatch must be complete first)
- **Phase 5 (US3)**: Depends on Phase 3 (needs event data); independent of Phase 4
- **Phase 6 (US4)**: Depends on Phase 3 (needs event rows to audit)
- **Phase 7 (Polish)**: Depends on all desired stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — first story after foundation
- **US2 (P2)**: Extends US1's submitBatch; T020 modifies T009's implementation
- **US3 (P2)**: Independent of US2 — reads existing events, no submitBatch dependency
- **US4 (P3)**: Independent of US2 and US3 — queries all event rows

### Parallel Opportunities

- T003 / T004 — parallel (different files)
- T013 / T014 / T015 — parallel (different frontend files)
- T025 / T026 / T027 — parallel (different service methods, no inter-dependency)
- T028 / T029 — parallel (backend controller vs frontend types)
- T036 and T037 — partial parallel (types/api vs hook/UI)
- T039 / T040 / T041 — parallel (different tools)

---

## Parallel Example: User Story 1

```
# Backend + frontend can run concurrently once T005/T006 stubs exist:
T009: Service::submitBatch() implementation
T010: Controller::submit() — depends on T009
T011: Service::getEffectiveRegister()
T012: Controller::index() — depends on T011

# Frontend types + hook can run in parallel with backend:
T013: dashboard.ts interfaces
T014: api.ts methods — depends on T013
T015: useClassAttendance.ts hook — depends on T014
```

---

## Implementation Strategy

### MVP First (US1 only — Phase 1 + 2 + 3)

1. Complete Phase 1: Migration + model + settings key (T001–T004)
2. Complete Phase 2: Service stub + controller stub + routes (T005–T008)
3. Complete Phase 3: Full US1 implementation (T009–T019)
4. **STOP and VALIDATE**: POST batch, GET register, correction workflow, auth/tenant guards
5. Daily attendance recording is fully operational

### Incremental Delivery

1. Phase 1 + 2 + 3 → **MVP: Daily class attendance recording**
2. + Phase 4 → Per-period mode for schools with timetables
3. + Phase 5 → Reporting and aggregation insights
4. + Phase 6 → Audit log access for compliance
5. + Phase 7 → Polish and full validation

---

## Notes

- Migration filename `2026-05-08-000002` — `000001` is already used by feature 067 (same date)
- The existing `student_attendance` table and all kiosk endpoints are **not modified** at any point
- `submitted_by` is always sourced from JWT payload (`$this->getTenantId()` pattern); never from request body
- `is_effective` cascade uses a transaction wrapping both the UPDATE and the INSERT
- `attendanceRate` = (present + late) / totalDays × 100 — late counts as attended
