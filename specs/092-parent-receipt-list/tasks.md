---

description: "Task list for parent receipt list feature"
---

# Tasks: Parent Receipt List

**Input**: Design documents from `/specs/092-parent-receipt-list/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Endpoint-level curl validation MUST be run after implementation for new or changed API behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/`, `frontend/src/`
- Backend: CodeIgniter 4 — controllers in `app/Controllers/Api/`, models in `app/Models/`, routes in `app/Config/Routes.php`
- Frontend: React 18 + TypeScript — pages in `src/pages/`, hooks in `src/hooks/`, API in `src/api/api.ts`

---

## Phase 1: Setup

**Purpose**: No project initialization needed — feature reuses existing project structure, tables, and dependencies. No migrations required.

- [x] T001 Verify no schema changes are needed — confirm existing `payments`, `students`, and `classes` tables have all required fields per data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend model and route infrastructure that MUST be complete before ANY user story frontend work can begin

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Add `getReceiptListForStudent(string $studentId, int $page, int $limit)` method to `backend/app/Models/PaymentModel.php` — reuse `basePaymentHistoryBuilder()` with student_id filter, apply `applyPaymentTransactionDisplayCondition()` for grouped deduplication, apply `applyPaymentOrdering()` with date DESC, return paginated receipt summaries with combined amount/category for grouped payments; also add `getReceiptListCountForStudent(string $studentId)` returning total distinct transaction count
- [x] T003 Add `listByStudent($studentId = null)` method to `backend/app/Controllers/Api/ReceiptController.php` — validate studentId non-empty, resolve student record (404 if not found), call `normalisePaginationParams(defaultLimit=20, maxLimit=100)` (400 on invalid), call PaymentModel methods, fetch student name/admissionNumber/className via join, return `success()` envelope with `{receipts, student, pagination}` per contract
- [x] T004 Add route `GET /receipts/student/(:segment)` to `backend/app/Config/Routes.php` in the public receipts section (before the existing `GET /receipts/(:segment)` route to avoid segment conflict), pointing to `ReceiptController::listByStudent/$1`

**Checkpoint**: Foundation ready — backend endpoint is callable and returns paginated receipt data

---

## Phase 3: User Story 1 - View All Receipts from Individual Receipt (Priority: P1) 🎯 MVP

**Goal**: Parent scans QR code, views individual receipt, clicks "View All Receipts" button, sees paginated list of all receipts for that student sorted by date descending, can click any entry to view the full receipt

**Independent Test**: Scan/view a QR code receipt, click "View All Receipts", verify paginated list appears sorted by date descending, click any entry, verify individual receipt opens

### Validation for User Story 1

> **NOTE: Run endpoint validation AFTER implementation using curl URL requests.**

- [x] T005 [P] [US1] Curl validation for `GET /api/receipts/student/:studentId` — happy path (200 with receipts array, student object, pagination), page 2 pagination, single-receipt student, invalid student ID (404), invalid page param (400), invalid limit param (400), per quickstart.md scenarios 1-6

### Implementation for User Story 1

- [x] T006 [P] [US1] Add `getReceiptList(studentId: string, page?: number, limit?: number)` method to `frontend/src/api/api.ts` — fetches `GET /api/receipts/student/:studentId?page=&limit=`, returns typed `{ receipts: ReceiptListItem[], student: ReceiptListStudent, pagination: PaginationMeta }`
- [x] T007 [P] [US1] Add `ReceiptListItem` and `ReceiptListStudent` interfaces to `frontend/src/api/api.ts` (or `frontend/src/types/dashboard.ts` if preferred) — `ReceiptListItem` has id, amount, date, method, category, description, receiptNumber, isGeneralPayment, paymentGroupId, isVoided, voidedAt, voidReason; `ReceiptListStudent` has id, firstName, lastName, admissionNumber, className
- [x] T008 [P] [US1] Create `frontend/src/hooks/useReceiptList.ts` — React Query hook `useReceiptList(studentId, page, limit)` with `useQuery(['receiptList', studentId, page, limit], ...)`, `keepPreviousData: true`, returns `{ data, isLoading, isFetching, isError }`
- [x] T009 [US1] Create `frontend/src/pages/ReceiptListPage.tsx` — paginated receipt list page: header with student name + total count, scrollable list of receipt cards (date, amount, category, receipt number, method), each card clickable navigating to `/receipt/:id`, pagination controls (Previous/Next + page X of Y), loading skeleton, error state, "Back" button; uses `useReceiptList` hook; design consistent with `ReceiptPage.tsx` (bg-gray-50, max-w container, card-based, TailwindCSS, shadcn/ui Button/Badge/Skeleton)
- [x] T010 [US1] Add "View All Receipts" button to `frontend/src/pages/ReceiptPage.tsx` — visible when `receiptData` is loaded, uses `receiptData.student.id` (or `receiptData.payment.studentId`) to navigate to `/receipts/student/:studentId` via `useNavigate` or `<Link>`; button styled with shadcn/ui Button variant="outline" size="sm", with a List icon from lucide-react; placed in the top bar next to the Print button
- [x] T011 [US1] Add route `<Route path="/receipts/student/:studentId" element={<ReceiptListPage />} />` to `frontend/src/App.tsx` in the public routes section (near the existing `/receipt/:id` route), with lazy import `React.lazy(() => import("./pages/ReceiptListPage"))`

**Checkpoint**: User Story 1 is fully functional — parent can navigate from individual receipt to paginated list and back

---

## Phase 4: User Story 2 - Receipt List Display and Summary (Priority: P2)

**Goal**: List entries show full summary info (date, amount, category, receipt number, method), voided payments have "VOIDED" badge + strikethrough, multi-category grouped payments show combined total, student name + total count in header, scrollable container with smooth pagination

**Independent Test**: Navigate to receipt list for a student with voided and multi-category payments; verify visual treatment and header summary

### Validation for User Story 2

- [x] T012 [P] [US2] Curl validation for voided payment inclusion — verify `GET /api/receipts/student/:studentId?limit=100` returns voided entries with `isVoided: true` and `voidedAt` populated; verify multi-category grouped payments appear as single entries with combined amount and comma-separated categories

### Implementation for User Story 2

- [x] T013 [US2] Add voided payment visual treatment to receipt cards in `frontend/src/pages/ReceiptListPage.tsx` — when `receipt.isVoided` is true: render red "VOIDED" Badge, apply line-through styling on amount, reduce opacity of the card; show `voidedAt` date in small text
- [x] T014 [US2] Add multi-category display to receipt cards in `frontend/src/pages/ReceiptListPage.tsx` — when `receipt.paymentGroupId` is not null and category contains comma: render "Multiple Categories" label with the comma-separated categories listed below in smaller text; show combined amount prominently
- [x] T015 [US2] Add receipt number fallback display in `frontend/src/pages/ReceiptListPage.tsx` — when `receipt.receiptNumber` is null, display the payment `id` as fallback identifier, consistent with `ReceiptDocument.tsx` behavior
- [x] T016 [US2] Add scrollable container styling to the receipt list in `frontend/src/pages/ReceiptListPage.tsx` — list area uses `max-h-[calc(100vh-200px)] overflow-y-auto` or similar bounded scroll area; pagination controls are sticky at the bottom; smooth scroll behavior on page change

**Checkpoint**: User Stories 1 AND 2 both work — list is functional, polished, and visually consistent

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and compliance checks

- [x] T017 [P] PHP lint all modified backend files: `php -l backend/app/Controllers/Api/ReceiptController.php`, `php -l backend/app/Models/PaymentModel.php`, `php -l backend/app/Config/Routes.php`
- [x] T018 [P] Frontend TypeScript check: `cd frontend && npx tsc --noEmit --pretty false`
- [x] T019 [P] Targeted ESLint on new/modified frontend files: `frontend/src/pages/ReceiptListPage.tsx`, `frontend/src/pages/ReceiptPage.tsx`, `frontend/src/hooks/useReceiptList.ts`, `frontend/src/api/api.ts`
- [x] T020 Run `git diff --check` to verify no whitespace errors
- [x] T021 Verify frontend performs no client-side filtering, searching, sorting, pagination, aggregations, or business computations — all data operations are backend-driven via `GET /api/receipts/student/:studentId` with page/limit params
- [x] T022 Verify loading states: receipt list page shows skeleton placeholders during data fetch; pagination button clicks show loading state; no stale data flashes during page transitions (React Query `keepPreviousData`)
- [x] T023 Run full quickstart.md validation — all 10 scenarios (happy path, pagination, single receipt, 404, invalid page, invalid limit, voided inclusion, frontend button, voided visual, pagination controls)
- [x] T024 [P] Update `specs/092-parent-receipt-list/quickstart.md` with actual curl validation results and any deviations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verification only
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (T002, T003, T004 must be complete)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (T009 must exist to enhance)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (enhances the list page created in US1)

### Within Each User Story

- Backend model before controller
- Controller before route registration
- Route registration before curl validation
- API method before hook
- Hook before page component
- Page component before route registration in App.tsx
- Curl validation after all implementation

### Parallel Opportunities

- T002 and T003 can partially overlap (model method before controller, but controller code can be drafted)
- T006, T007, T008 can run in parallel (different concerns in different files)
- T005 curl validation can run in parallel with T006-T008 frontend work (backend is already complete)
- T012 curl validation can run in parallel with T013-T016 frontend enhancement
- T017, T018, T019, T024 are all parallelizable in Polish phase

---

## Parallel Example: User Story 1

```bash
# After Foundational phase (T002-T004) is complete:

# Launch curl validation (backend is ready):
Task: "T005 Curl validation for GET /api/receipts/student/:studentId"

# Launch frontend API + types + hook in parallel (different files):
Task: "T006 Add getReceiptList to frontend/src/api/api.ts"
Task: "T007 Add ReceiptListItem interface to frontend/src/api/api.ts"
Task: "T008 Create frontend/src/hooks/useReceiptList.ts"

# Then sequentially:
Task: "T009 Create frontend/src/pages/ReceiptListPage.tsx"
Task: "T010 Add View All Receipts button to frontend/src/pages/ReceiptPage.tsx"
Task: "T011 Add route to frontend/src/App.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify no migrations needed)
2. Complete Phase 2: Foundational (backend endpoint + route)
3. Complete Phase 3: User Story 1 (frontend list page + button + route)
4. **STOP and VALIDATE**: Test US1 independently — scan QR, click button, see list, click entry, see receipt
5. Deploy/demo if ready

### Incremental Delivery

1. Foundational → Backend endpoint callable via curl
2. Add US1 → Full navigation flow works (receipt → list → receipt)
3. Add US2 → Voided/multi-category visual polish + scrollable container
4. Polish → Lint, type-check, ESLint, quickstart validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No migrations needed — feature reuses existing schema
- Public endpoint — no JWT required, consistent with existing receipts route
