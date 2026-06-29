# Tasks: Finance Control Center

**Input**: Design documents from `/specs/080-finance-control-center/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Validation tasks are included because the finance control center touches live platform reporting and the constitution requires curl endpoint validation after implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared finance API shapes and reusable query helpers for the control center.

- [ ] T001 [P] Define the shared finance summary, invoice, export, and chart response interfaces in `frontend/src/api/platform.ts`

**Checkpoint**: Shared data shapes are in place for all finance dashboard work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend and query preparation that all finance user stories rely on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Normalize the platform finance summary and chart payloads in `backend/app/Controllers/Platform/FinanceController.php` and `backend/app/Controllers/Platform/AnalyticsController.php`
- [ ] T003 [P] Centralize finance query and export handling in `frontend/src/admin/hooks/useFinance.ts`

**Checkpoint**: Finance data is ready to be rendered, filtered, and exported by the user stories.

---

## Phase 3: User Story 1 - Executive Finance Overview (Priority: P1) 🎯 MVP

**Goal**: Present actionable finance KPI cards, semantic status colors, readable currency formatting, and monthly trend visualization so the finance page feels like a control center.

**Independent Test**: Open the finance page and confirm the KPI cards, trend indicators, semantic colors, and chart readability improvements without using filters or exports.

### Implementation for User Story 1

- [ ] T004 [P] [US1] Rework `backend/app/Controllers/Platform/FinanceController.php::summary()` to calculate net revenue, failed payments, outstanding invoices, growth rate, and other top-level finance KPIs
- [ ] T005 [P] [US1] Update `frontend/src/admin/components/admin/StatCard.tsx` to support compact currency formatting, delta badges, and positive/warning/neutral semantic tones
- [ ] T006 [US1] Redesign the KPI grid and monthly revenue chart in `frontend/src/admin/pages/Finance.tsx` with clearer axis labels, monthly markers, and stronger spacing between cards and chart
- [ ] T007 [P] [US1] Align `frontend/src/api/platform.ts` and `frontend/src/admin/hooks/useFinance.ts` with the expanded finance summary and chart response shapes

**Checkpoint**: User Story 1 should now deliver a readable executive finance overview on its own.

---

## Phase 4: User Story 2 - Operational Finance Monitoring (Priority: P1)

**Goal**: Surface overdue invoices, recent transactions, payout summaries, subscription revenue breakdowns, and payment health alerts on the finance page.

**Independent Test**: Load the finance page and verify that operational insight sections are visible, meaningful, and rendered with clear empty states when data is missing.

### Implementation for User Story 2

- [ ] T008 [P] [US2] Extend `backend/app/Controllers/Platform/FinanceController.php` to surface overdue invoices, recent transactions, payout summaries, subscription revenue breakdowns, and payment health alerts
- [ ] T009 [P] [US2] Add typed operational insight data access in `frontend/src/api/platform.ts` and `frontend/src/admin/hooks/useFinance.ts`
- [ ] T010 [US2] Build the operational finance insights section in `frontend/src/admin/pages/Finance.tsx` with alert states, summary cards, and empty-state messaging

**Checkpoint**: User Story 2 should now provide operational visibility without depending on filtered reporting.

---

## Phase 5: User Story 3 - Filtered Finance Reporting (Priority: P2)

**Goal**: Let finance users filter by date range and invoice/payment status so they can focus on a reporting window or investigate a payment workflow.

**Independent Test**: Apply a date range and status filter and confirm the KPI area, chart, and invoice rows all update consistently to the selected reporting context.

### Implementation for User Story 3

- [ ] T011 [P] [US3] Add date-range and invoice/payment status filters to `backend/app/Controllers/Platform/FinanceController.php::invoices()` so the list endpoint matches the selected reporting context
- [ ] T012 [P] [US3] Thread finance filter state through `frontend/src/admin/hooks/useFinance.ts` and `frontend/src/api/platform.ts` for summary, chart, and invoice queries
- [ ] T013 [US3] Add finance filter controls and synchronized refresh behavior to `frontend/src/admin/pages/Finance.tsx`

**Checkpoint**: User Story 3 should now allow finance reporting to be narrowed and reset cleanly.

---

## Phase 6: User Story 4 - Exportable Finance Reporting (Priority: P2)

**Goal**: Export the current finance context as a CSV/report snapshot that matches what the user is viewing.

**Independent Test**: Export a filtered report and confirm the downloaded file matches the active date range and invoice/payment status context.

### Implementation for User Story 4

- [ ] T014 [P] [US4] Update `backend/app/Controllers/Platform/FinanceController.php::exportInvoices()` to export the currently filtered finance snapshot as CSV
- [ ] T015 [US4] Wire export actions and download handling into `frontend/src/admin/pages/Finance.tsx` and `frontend/src/admin/hooks/useFinance.ts`

**Checkpoint**: User Story 4 should now export filtered finance data without altering the visible context.

---

## Phase 7: User Story 5 - Navigation Clarity and Hierarchy (Priority: P3)

**Goal**: Make the sidebar active state and finance page spacing feel more like a professional control center.

**Independent Test**: Navigate to the finance page and confirm the sidebar active item is visually prominent and the page hierarchy clearly separates summary, chart, and operational sections.

### Implementation for User Story 5

- [ ] T016 [US5] Increase the finance navigation active-state prominence in `frontend/src/admin/components/admin/AppSidebar.tsx`
- [ ] T017 [US5] Improve spacing and visual hierarchy in `frontend/src/admin/pages/Finance.tsx` so KPI cards, charts, and operational panels read as a finance control center

**Checkpoint**: User Story 5 should now give the finance page a stronger dashboard presence.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the finance control center end-to-end and record verification results.

- [ ] T018 [P] Run curl validation for finance summary, filtered invoices, chart data, and export behavior, then record the results in `specs/080-finance-control-center/quickstart.md`
- [ ] T019 [P] Run frontend validation for the updated finance page and shared finance components, fixing any issues in `frontend/src/admin/pages/Finance.tsx`, `frontend/src/admin/hooks/useFinance.ts`, `frontend/src/api/platform.ts`, `frontend/src/admin/components/admin/StatCard.tsx`, and `frontend/src/admin/components/admin/AppSidebar.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — blocks all user stories.
- **User Stories (Phases 3-7)**: Depend on Foundational completion.
  - Stories can then proceed in priority order or in parallel if staffing allows.
- **Polish (Phase 8)**: Depends on the requested stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories.
- **User Story 2 (P1)**: Can start after Foundational — independent of User Story 1.
- **User Story 3 (P2)**: Can start after Foundational — uses the same finance data context as US1/US2 but remains independently testable.
- **User Story 4 (P2)**: Can start after Foundational — depends on the filtered reporting context from US3 but can still be verified on its own.
- **User Story 5 (P3)**: Can start after Foundational — visual polish only, no functional dependency on later stories.

### Within Each User Story

- Backend response shaping before frontend rendering.
- Shared type updates before component refactors that consume them.
- Validation after the feature slice is implemented.
- Keep story-specific work isolated so each story can be demonstrated independently.

### Parallel Opportunities

- **Setup**: `T001` can run independently.
- **Foundational**: `T002` and `T003` can run in parallel because they touch different files.
- **US1**: `T004`, `T005`, and `T007` can run in parallel; `T006` follows once the KPI and chart payload decisions are settled.
- **US2**: `T008` and `T009` can run in parallel; `T010` follows after the operational data shape is known.
- **US3**: `T011` and `T012` can run in parallel; `T013` follows once filter state and response shapes are available.
- **US4**: `T014` and `T015` can run in parallel once the export contract is stable.
- **US5**: `T016` and `T017` can be worked on together because they touch different UI areas.
- **Polish**: `T018` and `T019` can run in parallel after implementation is complete.

---

## Parallel Example: User Story 1

```bash
# Backend and frontend prep can happen together:
Task: "Rework backend/app/Controllers/Platform/FinanceController.php::summary() to calculate net revenue, failed payments, outstanding invoices, growth rate, and other top-level finance KPIs"
Task: "Update frontend/src/admin/components/admin/StatCard.tsx to support compact currency formatting, delta badges, and semantic tones"
Task: "Align frontend/src/api/platform.ts and frontend/src/admin/hooks/useFinance.ts with the expanded finance summary and chart response shapes"

# Then finalize the finance overview layout:
Task: "Redesign the KPI grid and monthly revenue chart in frontend/src/admin/pages/Finance.tsx with clearer axis labels, monthly markers, and stronger spacing between cards and chart"
```

---

## Parallel Example: User Story 3

```bash
Task: "Add date-range and invoice/payment status filters to backend/app/Controllers/Platform/FinanceController.php::invoices()"
Task: "Thread finance filter state through frontend/src/admin/hooks/useFinance.ts and frontend/src/api/platform.ts for summary, chart, and invoice queries"

# Then connect the filter UI:
Task: "Add finance filter controls and synchronized refresh behavior to frontend/src/admin/pages/Finance.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate the finance overview independently.
5. Demo the upgraded control-center summary before adding supporting operational views.

### Incremental Delivery

1. Setup + Foundational → shared finance data shapes and query handling.
2. User Story 1 → executive finance overview MVP.
3. User Story 2 → operational finance monitoring.
4. User Story 3 → filtered reporting.
5. User Story 4 → exportable finance reporting.
6. User Story 5 → sidebar and hierarchy polish.
7. Polish phase → curl validation and final quickstart notes.

### Parallel Team Strategy

With multiple developers:

1. One developer can handle backend finance summary and chart payload work.
2. Another developer can update `StatCard.tsx` and the finance page layout.
3. Another developer can implement operational insights and filter/export workflows.
4. A final developer can tighten sidebar prominence and polish the page hierarchy.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story is intentionally kept independently testable.
- Validation tasks are included because the feature affects live finance reporting.
- Keep exported data and on-screen data aligned for the same filter context.
