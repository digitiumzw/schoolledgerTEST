# Tasks: Generate Payment Financial Report

**Input**: Design documents from `/specs/090-generate-payment-report/`  
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Endpoint-level curl validation per quickstart.md MUST be run after implementation.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new files and scaffold the feature directory structure.

- [x] T001 [P] Create Dompdf HTML report view template at `backend/app/Views/reports/financial_report_template.php` with header (logo, school name, report title), financial summary section, payment method breakdown table, charges summary table, detailed transactions table, and footer with page numbers
- [x] T002 [P] Add `FinancialReportFilterParams` interface and `downloadFinancialReport()` API method to `frontend/src/api/api.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend service and route registration that MUST be complete before ANY user story can be implemented.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Implement `FinancialReportService` in `backend/app/Services/FinancialReportService.php` with the following public methods:
  - `generateReport(string $tenantId, array $filters): string` — resolves period dates, fetches tenant info, queries charges/payments/adjustments via existing models, computes aggregates (total expected fees, total payments, outstanding balance, adjustments, collection rate, method breakdown), renders Dompdf view, and returns PDF bytes
  - `resolvePeriodDates(string $tenantId, ?string $termId, ?int $month, ?int $year): array` — resolves start/end dates from academic calendar or month/year, validates term exists
  - `getMethodBreakdown(array $payments): array` — groups payments by method with count and total
  - `getChargesSummary(array $charges): array` — groups charges by category with total
  - Tenant isolation enforced on all queries via `tenant_id` parameter
  - Uses existing `LedgerService` eligible filters for charge/payment inclusion
- [x] T004 Add `GET /api/payments/report/pdf` route in `backend/app/Config/Routes.php` BEFORE the `payments/(:segment)` wildcard; maps to `PaymentController::generateReportPdf`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Generate Term Financial Report (Priority: P1) 🎯 MVP

**Goal**: An administrator or bursar selects an academic term from a dropdown on the Payments page and clicks Generate Financial Report. The backend compiles all term-scoped financial data into a professionally formatted PDF and streams it for download.

**Independent Test**: Select any term with associated charges and payments, click Generate, and receive a PDF containing accurate summary figures and a transaction breakdown. The PDF must include the school name, report title, selected term label, generation timestamp, financial summary, payment method breakdown, charges summary, and detailed transactions. If the term has no activity, the PDF still renders with zero totals and an empty table message.

### Validation for User Story 1

- [ ] T005 [P] [US1] Curl validation: happy path — `GET /api/payments/report/pdf?termId=term_2_2026` returns `200` with `Content-Type: application/pdf` and a valid PDF file (> 0 bytes)
- [ ] T006 [P] [US1] Curl validation: empty term — `GET /api/payments/report/pdf?termId=term_with_no_activity` returns `200` with valid PDF showing zero totals
- [ ] T007 [P] [US1] Curl validation: missing termId (and no month/year) returns `400` with JSON error
- [ ] T008 [P] [US1] Curl validation: invalid termId returns `404`
- [ ] T009 [P] [US1] Curl validation: unauthorized (no token) returns `401`
- [ ] T010 [P] [US1] Curl validation: teacher role returns `403`
- [ ] T011 [P] [US1] Curl validation: tenant isolation — different-tenant token gets `404` for another tenant's term

### Implementation for User Story 1

- [x] T012 [US1] Implement `PaymentController::generateReportPdf()` in `backend/app/Controllers/Api/PaymentController.php`:
  - Enforces `bursar`/`admin`/`super_admin` role via `requireRole()`
  - Reads `termId`, `month`, `year`, `classId`, `method`, `category` from query params
  - Validates that at least `termId` OR (`month` + `year`) is provided
  - Calls `FinancialReportService::generateReport()` with validated filters
  - Returns binary PDF response with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="financial-report-{label}-{date}.pdf"`
  - Error paths return JSON envelopes via `respondError()`
- [x] T013 [US1] Add frontend "Generate Financial Report" button to `frontend/src/pages/Payments.tsx` near the existing filter bar:
  - Button uses a `FileText` icon from lucide-react
  - Button triggers `downloadFinancialReport()` with currently selected filters (term, month, year, class, method, category)
  - Button shows loading state (spinner) and is disabled during generation
  - On success: creates blob URL, triggers anchor click download, revokes URL
  - On error: displays `toast.error()` with the backend error message
  - Button is only visible when user has `admin` or `bursar` role

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 — Generate Monthly Financial Report (Priority: P1)

**Goal**: An administrator or bursar selects a specific calendar month and year and generates a financial snapshot scoped to that month. Transport fees and ad-hoc payments that align with calendar months are correctly included.

**Independent Test**: Select a specific month with payment activity, generate the report, and verify the PDF contains only charges and payments whose dates fall within that calendar month, with correct monthly totals. Also verify that combining term + month filters works correctly (term as primary scope, month as additional restriction).

### Validation for User Story 2

- [ ] T014 [P] [US2] Curl validation: happy path — `GET /api/payments/report/pdf?month=6&year=2026` returns `200` with valid PDF
- [ ] T015 [P] [US2] Curl validation: invalid month (`month=13`) returns `400`
- [ ] T016 [P] [US2] Curl validation: invalid year (`year=1800`) returns `400`
- [ ] T017 [P] [US2] Curl validation: term + month combined — `GET /api/payments/report/pdf?termId=term_2_2026&month=6&year=2026` returns `200` with valid PDF scoped to term-month intersection
- [ ] T018 [P] [US2] Curl validation: empty month — `GET /api/payments/report/pdf?month=1&year=1900` returns `200` with valid PDF showing zero totals

### Implementation for User Story 2

- [ ] T019 [US2] Update `FinancialReportService::resolvePeriodDates()` to support calendar month/year resolution:
  - When `month` and `year` are provided (and `termId` is not), compute start = `YYYY-MM-01`, end = last day of month
  - When both `termId` and `month`/`year` are provided, intersect the term date range with the calendar month range
  - Return clear validation errors for invalid month/year values
- [ ] T020 [US2] Verify frontend month/year filters in `frontend/src/pages/Payments.tsx` are correctly passed to `downloadFinancialReport()` when the user has selected month/year instead of (or in addition to) a term

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 — Filtered Subset Financial Report (Priority: P2)

**Goal**: An administrator applies pre-generation filters (class, payment method, category) before generating the PDF, producing focused reports such as "Transport fees collected via EcoCash in Term 2."

**Independent Test**: Apply one or more filters (class, method, category) on the Payments page, generate the report, and confirm the PDF reflects only the filtered subset with recalculated totals.

### Validation for User Story 3

- [ ] T021 [P] [US3] Curl validation: class filter — `GET /api/payments/report/pdf?termId=term_2_2026&classId=class_abc123` returns `200` with valid PDF scoped to that class
- [ ] T022 [P] [US3] Curl validation: method filter — `GET /api/payments/report/pdf?termId=term_2_2026&method=Cash` returns `200` with valid PDF scoped to Cash payments
- [ ] T023 [P] [US3] Curl validation: category filter — `GET /api/payments/report/pdf?termId=term_2_2026&category=Transport+Fee` returns `200` with valid PDF scoped to that category
- [ ] T024 [P] [US3] Curl validation: combined filters — `GET /api/payments/report/pdf?termId=term_2_2026&classId=class_abc123&method=Cash&category=Fees` returns `200` with valid PDF scoped to all three filters

### Implementation for User Story 3

- [ ] T025 [US3] Update `FinancialReportService::generateReport()` to apply optional `classId`, `method`, and `category` filters:
  - `classId`: restrict charges and payments to students whose `class_id` matches
  - `method`: restrict payments to those with matching `method`
  - `category`: restrict charges and payments to those with matching `category`
  - All filters are AND-combined with the period filter
  - Method breakdown and charges summary reflect the filtered subset
  - Detailed transactions table only includes matching records
- [ ] T026 [US3] Verify frontend filter state in `frontend/src/pages/Payments.tsx` (existing `filterClass`, `filterMethod`, `filterCategory`) is correctly passed to `downloadFinancialReport()`

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, performance verification, and final validation.

- [x] T027 [P] PHP lint for all modified backend files: `php -l backend/app/Services/FinancialReportService.php`, `php -l backend/app/Controllers/Api/PaymentController.php`, `php -l backend/app/Config/Routes.php`, `php -l backend/app/Views/reports/financial_report_template.php`
- [x] T028 [P] TypeScript type-check: `cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false`
- [x] T029 [P] Targeted ESLint on modified frontend files: `frontend/src/pages/Payments.tsx`, `frontend/src/api/api.ts`
- [x] T030 [P] `git diff --check` — verify no trailing whitespace, no merge conflict markers
- [ ] T031 Verify report financial totals match dashboard figures exactly: compare `totalExpectedFees`, `totalPaymentsReceived`, `outstandingBalance` from PDF against `/api/dashboard/stats` and `/api/payments/with-students` summary for the same period (zero variance = SC-003)
- [ ] T032 Verify no temporary PDF files remain on the server 60 seconds after generation: check `/tmp/` for any orphaned `schoolledger-report-*` or Dompdf temp files; confirm in-memory generation leaves zero artifacts
- [ ] T033 Verify report renders correctly for print: open generated PDF in browser, check page breaks between sections, confirm all tables fit within page margins, verify page numbers increment correctly
- [ ] T034 Verify frontend loading state: during PDF generation, the Generate button shows a spinner and is disabled; the button re-enables after success or error
- [ ] T035 Performance check: time `GET /api/payments/report/pdf` for the current active term; total time must be < 5 seconds for up to 5,000 payment records
- [ ] T036 Update `quickstart.md` with actual curl validation results and any deviations found during testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P1) → US3 (P2) sequential, or parallel if staffed
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories.
- **User Story 2 (P1)**: Can start after Foundational (Phase 2). Depends on US1 only for `resolvePeriodDates()` extension — the core monthly logic is additive.
- **User Story 3 (P2)**: Can start after Foundational (Phase 2). Depends on US1 for the base `generateReport()` method. Filter logic is additive.

### Within Each User Story

- Curl validation tasks MUST run after implementation
- Service layer (FinancialReportService) before controller endpoint
- Controller endpoint before frontend integration
- Core implementation before validation

### Parallel Opportunities

- **Phase 1**: T001 (PDF template) and T002 (frontend API/types) are fully parallel — different directories, no shared dependencies.
- **Phase 2**: T003 (FinancialReportService) must complete before T004 (Routes), but T004 can be drafted in parallel if the method name is agreed.
- **US1 Validation**: T005–T011 can all run in parallel after T012–T013 complete.
- **US2 Validation**: T014–T018 can all run in parallel after T019–T020 complete.
- **US3 Validation**: T021–T024 can all run in parallel after T025–T026 complete.
- **Polish**: T027–T036 are largely independent validation and lint tasks that can run in parallel.

---

## Parallel Example: User Story 1

```bash
# After T003 and T004 (Foundational) are complete, launch US1 implementation in parallel:
Task: "T012 [US1] Implement PaymentController::generateReportPdf()"
Task: "T013 [US1] Add Generate Financial Report button to Payments.tsx"

# After T012 and T013 complete, launch all validation in parallel:
Task: "T005 [P] [US1] Curl happy path"
Task: "T006 [P] [US1] Curl empty term"
Task: "T007 [P] [US1] Curl missing params 400"
Task: "T008 [P] [US1] Curl invalid termId 404"
Task: "T009 [P] [US1] Curl unauthorized 401"
Task: "T010 [P] [US1] Curl teacher role 403"
Task: "T011 [P] [US1] Curl tenant isolation"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003, T004)
3. Complete Phase 3: User Story 1 (T012, T013) + Validation (T005–T011)
4. **STOP and VALIDATE**: Test US1 independently via quickstart.md curl scenarios
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Run Polish phase → Final validation → Merge

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (T012, T013) + Validation
   - Developer B: US2 (T019, T020) + Validation
   - Developer C: US3 (T025, T026) + Validation
3. Stories complete and integrate independently
4. Team converges on Polish phase together

---

## Notes

- Total tasks: 36
- US1 tasks: 9 (T005–T013)
- US2 tasks: 7 (T014–T020)
- US3 tasks: 6 (T021–T026)
- Setup tasks: 2 (T001–T002)
- Foundational tasks: 2 (T003–T004)
- Polish tasks: 10 (T027–T036)
- MVP scope = Phase 1 + Phase 2 + US1 (T001–T013) = 13 tasks
