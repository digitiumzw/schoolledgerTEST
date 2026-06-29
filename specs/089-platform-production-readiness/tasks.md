# Tasks: Platform Production Readiness

**Input**: Design documents from `/specs/089-platform-production-readiness/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Verify active production configurations and environment variables are documented in `backend/.env.example`
- [ ] T002 Audit target server database connection configurations in `backend/app/Config/Database.php`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T003 Create database migration file for uncaught error logs table in `backend/app/Database/Migrations/2026-06-15-000001_CreateSystemErrorLogs.php`
- [ ] T004 Apply database migration using command line terminal tool: `php spark migrate`
- [ ] T005 Create active model for system logs in `backend/app/Models/SystemErrorLogModel.php`
- [ ] T006 Create custom centralized ExceptionHandler utility helper in `backend/app/Libraries/ExceptionHandler.php`
- [ ] T007 Register centralized exception library mappings in configuration file `backend/app/Config/Exceptions.php`
- [ ] T008 Create cache-backed API RateLimiter tracker class in `backend/app/Libraries/RateLimiter.php`
- [ ] T009 Create custom RateLimiterFilter middleware class in `backend/app/Filters/RateLimiterFilter.php`
- [ ] T010 Map RateLimiterFilter into global filter registry pipe in `backend/app/Config/Filters.php`

---

## Phase 3: User Story 1 - Fast and Responsive Large-Scale Tenant Dashboard (Priority: P1) 🎯 MVP

**Goal**: High-speed multi-tenant list, detail, and aggregate queries.

**Independent Test**: Seed tenant with 10k students and verify that student lists load in under 500ms using explain-plan verified indexes.

### Validation for User Story 1
- [ ] T011 [P] [US1] Curl validation for paginated list load speeds and response envelopes under `/api/students?page=1&limit=50`

### Implementation for User Story 1
- [ ] T012 [P] [US1] Create multi-tenant composite indexes database migration in `backend/app/Database/Migrations/2026-06-15-000002_AddPlatformProductionIndexes.php`
- [ ] T013 [US1] Apply composite indexes database migration using CLI terminal: `php spark migrate`
- [ ] T014 [US1] Refactor data mapping layers to enforce SQL JOINs instead of lazy N+1 queries inside loops in `backend/app/Models/StudentModel.php`
- [ ] T015 [US1] Enforce batch subquery computations (`preloadLedgerBalances` and `getAllBalances`) across ledger queries in `backend/app/Services/LedgerService.php`
- [ ] T016 [US1] Implement PHP generator yield streaming for high-volume file and CSV imports in `backend/app/Services/StudentImportService.php`
- [ ] T017 [US1] Standardize server-side pagination headers and complete paginated data metadata envelopes in `backend/app/Controllers/Api/StudentController.php`

---

## Phase 4: User Story 2 - Resilient Transaction Management and Graceful Error Recovery (Priority: P2)

**Goal**: Complete transaction boundaries for financial and state mutations, masking code-level errors from clients.

**Independent Test**: Force an exception during payment processing, confirm full rollback, and verify HTTP 500 response contains a Correlation ID.

### Validation for User Story 2
- [ ] T018 [P] [US2] Curl validation for transaction integrity rollbacks and custom Correlation ID exception handling checks

### Implementation for User Story 2
- [ ] T019 [US2] Integrate transactional scopes (`transStart`, `transCommit`, `transRollback`) across all student billing run loops in `backend/app/Services/FeeRuleBillingService.php`
- [ ] T020 [US2] Wrap campaign payments and split allocation queries in database transaction blocks in `backend/app/Services/FeeCampaignService.php`
- [ ] T021 [US2] Map structured JSON logs containing active user session context, tenant scope, and Correlation IDs in `backend/app/Libraries/ExceptionHandler.php`
- [ ] T022 [P] [US2] Create React ErrorBoundary component matching SchoolLedger design system in `frontend/src/components/feedback/ErrorBoundaryWithCorrelation.tsx`
- [ ] T023 [US2] Configure global Axios request error interceptor to handle HTTP 500 responses and mask schema traces in `frontend/src/api/api.ts`

---

## Phase 5: User Story 3 - Secure Resource Protection & Rate Limiting (Priority: P3)

**Goal**: Secure endpoints with unauthenticated IP blocks and authenticated session rate-limiting thresholds.

**Independent Test**: Perform automated loop requests to login route, verify subsequent requests are blocked with HTTP 429 and `Retry-After` headers.

### Validation for User Story 3
- [ ] T024 [P] [US3] Curl validation for unauthenticated and authenticated rate limiting block thresholds and response headers

### Implementation for User Story 3
- [ ] T025 [P] [US3] Implement Token Bucket algorithms utilizing local cache adapters in `backend/app/Libraries/RateLimiter.php`
- [ ] T026 [US3] Configure `RateLimiterFilter` middleware to read user sessions and JWT identity payload contexts in `backend/app/Filters/RateLimiterFilter.php`
- [ ] T027 [US3] Define unauthenticated (60 req/min) and authenticated (120 req/min) thresholds in `backend/app/Config/Filters.php`
- [ ] T028 [US3] Formulate HTTP 429 response payloads containing standard rate limit metadata in `backend/app/Filters/RateLimiterFilter.php`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Global enhancements, cleanup, and validation compliance checks

- [ ] T029 Verify that all mutation actions (Record Payment, Staff update) display loading feedback and disable action controls in `frontend/src/components/modals/RecordPaymentModal.tsx` and `frontend/src/components/modals/StaffFormModal.tsx`
- [ ] T030 Ensure complete TanStack React Query cache invalidation and queries syncing in student profiles in `frontend/src/pages/Students.tsx`
- [ ] T031 Execute local test suites using script parameters specified in `quickstart.md`
- [ ] T032 Strip experimental debugging comments and custom testing override routes across codebase

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all subsequent user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User Story 1 (P1) is the MVP and should be prioritised.
  - User Stories 2 and 3 can be developed sequentially or in parallel.
- **Polish (Final Phase)**: Depends on all user stories being complete.

### Parallel Opportunities

- **Setup Phase**: T001 and T002 are independent.
- **Foundational Phase**: Error schema work (T003-T005) and rate-limiter setup (T008-T010) are independent and can be worked on in parallel.
- **User Story 1**: Database indexing (T012-T013) can run in parallel with data modeling optimizations (T014-T015).
- **User Story 2**: Frontend UI components (T022) can be built in parallel with backend ExceptionHandler refactoring (T021).
- **User Story 3**: RateLimiter token bucket helpers (T025) can be developed in parallel with middleware logic checks (T026-T028).

---

## Parallel Example: User Story 2

```bash
# Developer A builds the frontend React component:
Task: "Create React ErrorBoundary component matching SchoolLedger design system in frontend/src/components/feedback/ErrorBoundaryWithCorrelation.tsx"

# Developer B modifies the backend log handler:
Task: "Map structured JSON logs containing active user session context, tenant scope, and Correlation IDs in backend/app/Libraries/ExceptionHandler.php"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup tasks.
2. Complete Phase 2: Foundational block.
3. Complete Phase 3: User Story 1 (High-Performance Multi-Tenant Retrieval).
4. **STOP and VALIDATE**: Verify page load queries and indexing on seeded database.

### Incremental Delivery

1. Setup + Foundational -> Infrastructure Ready.
2. Add User Story 1 (MVP) -> Full multi-tenant speed optimization complete.
3. Add User Story 2 -> Complete atomic transactional boundaries and correlation diagnostics.
4. Add User Story 3 -> Hardened public route security and system resource throttling.
