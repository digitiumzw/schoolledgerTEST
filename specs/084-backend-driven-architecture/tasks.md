# Tasks: Backend-Driven Architecture

**Input**: Design documents from `specs/084-backend-driven-architecture/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Curl validation tasks run AFTER implementation per Constitution Principle X.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: Shared TypeScript types and migration file that are prerequisites for all user stories.

- [ ] T001 [P] Add `PaginatedResponse<T>` generic interface and `PaginationMeta` type to `frontend/src/types/dashboard.ts`
- [ ] T002 [P] Create staff filter index migration file `backend/app/Database/Migrations/2026-05-25-000001_AddStaffFilterIndexes.php` with indexes on `staff(tenant_id, employment_status)`, `staff(tenant_id, department)`, `staff(tenant_id, is_teaching)`, `staff(tenant_id, first_name)`, `staff(tenant_id, last_name)` and corresponding `down()` method

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by US1, US2, and US3 — must complete before any user story begins.

**⚠️ CRITICAL**: US1–US3 depend on T001 being complete. T002 is independent.

- [ ] T003 Apply the staff filter index migration via `php spark migrate` in `backend/` to make indexes active before query testing
- [ ] T004 [P] Add a reusable `parsePaginationParams(array $params): array` helper method to `backend/app/Controllers/Api/BaseApiController.php` that validates `page` (≥1), `limit` (1–100), `sortBy` (against a provided allowlist), and `sortOrder` (`asc`/`desc`); returns validated values or throws an error response on invalid input
- [ ] T005 [P] Update `frontend/src/api/api.ts` to export a typed `PaginatedResult<T>` alias wrapping the standard API envelope `data` field, so all three modules can import it without duplication

**Checkpoint**: T001–T005 done → user story phases can begin.

---

## Phase 3: User Story 1 — Backend-Driven Staff Directory (Priority: P1) 🎯 MVP

**Goal**: `GET /api/staff` accepts filter, sort, page, limit params; returns paginated staff with summary; `Staff.tsx` uses `useStaffQuery` React Query hook and renders backend-paginated results with no `useMemo` filtering or `Array.slice`.

**Independent Test**: Open Staff page, apply department filter, check network request contains `department=` param, confirm response has `pagination.total` and `summary.departmentBreakdown`.

### Implementation for User Story 1

- [ ] T006 [US1] Add `getFiltered(string $tenantId, array $params): array` method to `backend/app/Models/StaffModel.php`; method accepts `search`, `department`, `isTeaching`, `employmentStatus`, `sortBy`, `sortOrder`, `page`, `limit`; executes one COUNT query and one paginated SELECT; returns `['data' => [...], 'pagination' => [...], 'summary' => [...]]` as specified in `data-model.md`
- [ ] T007 [US1] Refactor `backend/app/Controllers/Api/StaffController.php` `index()` method to extract filter params via `parsePaginationParams()` (T004) and pass them to `StaffModel::getFiltered()`; remove the `formatForApi` loop; return the paginated response using `respondSuccess`
- [ ] T008 [US1] Update `api.getStaff()` function signature in `frontend/src/api/api.ts` to accept `StaffListParams` (search, department, isTeaching, employmentStatus, sortBy, sortOrder, page, limit) and return `PaginatedResult<Staff>`; update the TypeScript `StaffListParams` interface in `frontend/src/types/dashboard.ts`
- [ ] T009 [US1] Create `frontend/src/hooks/useStaffQuery.ts` with a `useStaffQuery(params: StaffListParams)` hook using `useQuery` from React Query; include `placeholderData: keepPreviousData`; expose `data`, `pagination`, `summary`, `isLoading`, `isFetching`
- [ ] T010 [US1] Refactor `frontend/src/pages/Staff.tsx` to use `useStaffQuery`; replace `useState` data + `useEffect` fetch with query params state; remove `useMemo` `filteredStaff` and `paginatedStaff`; replace `Array.slice` pagination with server-side page navigation; wire filter state changes to query params; render `summary.departmentBreakdown` and `pagination` from backend response
- [ ] T011 [US1] Update all `useMutation`-based staff operations (create, update, delete) in `Staff.tsx` and any related hooks to call `queryClient.invalidateQueries({ queryKey: ['staff'] })` after success so the list auto-refreshes; confirm action buttons are disabled via `isPending`

### Validation for User Story 1

- [ ] T012 [US1] Run curl validation from `quickstart.md` Section 2: default pagination (HTTP 200 + pagination object), search filter (only matching names), department filter (summary breakdown), employment status filter, invalid `limit=999` (HTTP 400), invalid `sortBy` (HTTP 400), no auth (HTTP 401), and tenant isolation (second-tenant token sees only own data)

**Checkpoint**: Staff page is fully backend-driven — independently testable and deliverable as MVP.

---

## Phase 4: User Story 2 — Backend-Driven Fee Campaigns (Priority: P1)

**Goal**: `GET /api/fee-campaigns` computes all campaign summaries in a single batch query (no N+1); returns paginated response; `FeeCampaigns.tsx` removes local `.filter()` and uses React Query.

**Independent Test**: Open Fee Campaigns, change status filter, verify network request contains `status=` param and response contains `data.data` array with inline `summary` on each campaign; no client-side filter call in component.

### Implementation for User Story 2

- [ ] T013 [P] [US2] Add `getSummariesByCampaignIds(array $ids, string $tenantId): array` method to `backend/app/Models/FeeCampaignModel.php`; uses single `GROUP BY fee_campaign_id` query as defined in `data-model.md`; returns map keyed by campaign id
- [ ] T014 [US2] Refactor `backend/app/Controllers/Api/FeeCampaignController.php` `index()` method to: (a) use `parsePaginationParams()` (T004) for `page`, `limit`, `sortBy`, `sortOrder`; (b) replace the per-campaign `getSummary()` loop with a single `getSummariesByCampaignIds()` call; (c) wrap response in `{ data: [...], pagination: {...} }` envelope
- [ ] T015 [US2] Update `api.getFeeCampaigns()` in `frontend/src/api/api.ts` to accept `FeeCampaignListParams` (status, page, limit, sortBy, sortOrder) and return `PaginatedResult<FeeCampaign & { summary: CampaignSummary }>`; update types in `frontend/src/types/dashboard.ts`
- [ ] T016 [US2] Refactor `frontend/src/hooks/useFeeCampaigns.ts` to replace `useState` + `useCallback loadCampaigns` with a `useQuery` for the campaigns list and `useMutation` hooks for create, close, record-payment, add/remove-student operations; expose `isPending` from all mutations
- [ ] T017 [US2] Update `frontend/src/pages/FeeCampaigns.tsx` to: (a) remove local `filtered = campaigns.filter(...)` variable; (b) consume the React Query hook from T016; (c) pass `statusFilter` as a query param; (d) call `queryClient.invalidateQueries({ queryKey: ['fee-campaigns'] })` after any mutation; (e) disable action buttons during in-flight mutations via `isPending`

### Validation for User Story 2

- [ ] T018 [US2] Run curl validation from `quickstart.md` Section 3: all-campaigns response with inline summaries (not null), status filter returning only matching campaigns, and verify ≤ 3 SQL queries for a 10-campaign list (check CodeIgniter query log or DB query count)

**Checkpoint**: Fee Campaigns list is N+1-free and fully backend-driven — independently testable.

---

## Phase 5: User Story 3 — Backend-Driven Transport Management (Priority: P1)

**Goal**: `GET /api/transport/routes`, `/vehicles`, `/drivers` all accept `page`, `limit`, `sortBy`, `sortOrder`; return pagination metadata; `Transport.tsx` uses React Query hooks.

**Independent Test**: Open Transport page, search for a route name, navigate to page 2 of routes, verify network request contains `page=2` and response contains `pagination.totalPages > 1`.

### Implementation for User Story 3

- [ ] T019 [P] [US3] Refactor `backend/app/Controllers/Api/TransportController.php` `getRoutes()` to use `parsePaginationParams()` (T004) for `page`, `limit`, `sortBy` (`routeName`|`createdAt`), `sortOrder`; apply `LIMIT/OFFSET` to the primary routes query before the stops/periods IN-query enrichment; return `{ data: [...], pagination: {...} }` envelope via `respondSuccess`
- [ ] T020 [P] [US3] Refactor `backend/app/Controllers/Api/TransportVehicleController.php` `index()` to add `page`, `limit`, `sortBy` (`name`|`createdAt`), `sortOrder` via `parsePaginationParams()`; apply `LIMIT/OFFSET` before allocation-count IN-query; return pagination envelope
- [ ] T021 [P] [US3] Refactor `backend/app/Controllers/Api/TransportDriverController.php` `index()` to add `page`, `limit`, `sortBy` (`name`|`createdAt`), `sortOrder` via `parsePaginationParams()`; apply `LIMIT/OFFSET`; return pagination envelope
- [ ] T022 [US3] Update `api.getRoutes()`, `api.getVehicles()`, `api.getDrivers()` in `frontend/src/api/api.ts` to accept `TransportListParams` (search, page, limit, sortBy, sortOrder) and return `PaginatedResult<TransportRoute>` / `PaginatedResult<TransportVehicle>` / `PaginatedResult<TransportDriver>`; update types in `frontend/src/types/dashboard.ts`
- [ ] T023 [US3] Create `frontend/src/hooks/useTransportCatalogue.ts` with three named hooks: `useRoutesQuery`, `useVehiclesQuery`, `useDriversQuery`; each uses `useQuery` with `placeholderData: keepPreviousData`; expose `data`, `pagination`, `isLoading`, `isFetching`; also export `useMutation` wrappers for create/update/delete operations with `queryClient.invalidateQueries` on success
- [ ] T024 [US3] Refactor `frontend/src/pages/Transport.tsx` to replace `useState` data arrays + `useCallback fetchData` + `useEffect` with `useRoutesQuery`, `useVehiclesQuery`, `useDriversQuery` from T023; add pagination UI controls per tab; remove `filteredRoutes = routes`, `filteredVehicles = vehicles`, `filteredDrivers = drivers` assignments; disable create/edit/delete buttons via mutation `isPending`

### Validation for User Story 3

- [ ] T025 [US3] Run curl validation from `quickstart.md` Section 4: routes pagination (`limit=5`), vehicles pagination, drivers search+pagination; confirm all three endpoints return `pagination` metadata; confirm invalid params return HTTP 400; confirm no-auth returns HTTP 401

**Checkpoint**: Transport page is fully backend-driven — independently testable.

---

## Phase 6: User Story 4 — Automatic Real-Time Data Refresh (Priority: P2)

**Goal**: All React Query queries on active pages auto-refresh every 30 seconds; `staleTime` aligned to 30s; no blank flash during background refetches.

**Independent Test**: Open Payments page in DevTools Network, wait 31s, confirm `GET /api/payments/with-students` fires automatically without user interaction.

### Implementation for User Story 4

- [ ] T026 [US4] Update `frontend/src/App.tsx` `QueryClient` default options: set `staleTime: 30_000` (was `2 * 60 * 1000`) and add `refetchInterval: 30_000`; keep all other existing options (`gcTime`, `retry`, `retryDelay`, `refetchOnWindowFocus`) unchanged
- [ ] T027 [US4] Verify all existing React Query `useQuery` calls that should NOT poll (e.g. static config endpoints, one-time setup data) have `refetchInterval: false` override to opt out of global polling; search `frontend/src/hooks/` and `frontend/src/pages/` for queries that should be excluded
- [ ] T028 [US4] Manual browser verification: open Payments page in two tabs; record payment in tab 1; confirm tab 2 auto-refreshes within ≤35 seconds without any user action; record result in `quickstart.md` validation table

**Checkpoint**: All pages using React Query now poll automatically.

---

## Phase 7: User Story 5 — Performance-Optimized Backend Queries (Priority: P2)

**Goal**: Staff filter indexes active; all three controllers enforce `limit ≤ 100` with HTTP 400; Fee Campaigns confirmed N+1-free; `explain`/query-count evidence documented.

**Independent Test**: Run `GET /api/staff?limit=999` → HTTP 400; run `GET /api/staff?limit=20` with CodeIgniter query log → ≤ 3 queries executed.

### Implementation for User Story 5

- [ ] T029 [US5] Verify `parsePaginationParams()` (T004) is applied in all five controllers (StaffController, FeeCampaignController, TransportController, TransportVehicleController, TransportDriverController) and returns HTTP 400 for `limit > 100`, `page < 1`, invalid `sortBy` values; add any missing validation
- [ ] T030 [US5] Enable CodeIgniter query logging in development (`app/Config/Database.php` `DBDebug`) and verify `GET /api/staff?limit=20` executes ≤ 3 queries (count + data + optional summary) and `GET /api/fee-campaigns` executes ≤ 3 queries (count + campaigns + summaries batch); disable query logging after verification
- [ ] T031 [US5] Run `EXPLAIN SELECT` on the staff `getFiltered()` query with a `department` filter and confirm it uses the `idx_staff_tenant_dept` index (not a full table scan); document result in `quickstart.md` performance section
- [ ] T032 [US5] Run `time curl` performance checks from `quickstart.md` Section 6; confirm staff list responds under 500ms; record timing in validation table

**Checkpoint**: All query optimization targets met and documented.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Lint, type-check, final compliance verification, and validation sign-off.

- [ ] T033 [P] Run PHP lint on all modified backend files: `StaffModel.php`, `FeeCampaignModel.php`, `StaffController.php`, `FeeCampaignController.php`, `TransportController.php`, `TransportVehicleController.php`, `TransportDriverController.php`, `BaseApiController.php`, and the new migration file; fix any errors
- [ ] T034 [P] Run TypeScript type-check `./node_modules/.bin/tsc --noEmit --pretty false` in `frontend/`; fix any type errors introduced by the new `PaginatedResult<T>` types or updated API function signatures
- [ ] T035 [P] Run ESLint on all modified frontend files: `App.tsx`, `api.ts`, `dashboard.ts`, `useStaffQuery.ts`, `useTransportCatalogue.ts`, `useFeeCampaigns.ts`, `Staff.tsx`, `FeeCampaigns.tsx`, `Transport.tsx`; fix any lint errors introduced by this feature
- [ ] T036 Verify no client-side data operations remain: grep `frontend/src/pages/Staff.tsx`, `FeeCampaigns.tsx`, `Transport.tsx` for `useMemo.*filter`, `\.filter(`, `\.sort(`, `\.slice(` patterns — confirm zero data-processing hits (presentation-only useMemo is acceptable)
- [ ] T037 Verify mutation loading-state compliance across all three migrated pages: confirm each create/update/delete/close action (a) shows loading indicator, (b) disables the triggering control via `isPending`, (c) calls `queryClient.invalidateQueries` on success, (d) no stale data flashes on rerender after mutation
- [ ] T038 Run full `quickstart.md` validation: complete all 12 test scenarios in the validation results table; confirm all pass; update the Result and Date columns
- [ ] T039 Run `git diff --check` to confirm no trailing whitespace or merge conflict markers in any modified file

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001 and T002 are parallel
- **Phase 2 (Foundational)**: T003 depends on T002; T004 and T005 can start immediately in parallel
- **Phase 3 (US1)**: Depends on T001, T004, T005 — can begin after Phase 2
- **Phase 4 (US2)**: Depends on T001, T004, T005 — independent of US1; can start in parallel with US1 after Phase 2
- **Phase 5 (US3)**: Depends on T001, T004, T005 — independent of US1 and US2; can start in parallel after Phase 2
- **Phase 6 (US4)**: Depends on US1 (T009), US2 (T016), US3 (T024) being complete so all three pages use React Query before polling is activated
- **Phase 7 (US5)**: Depends on Phase 2 (T003 indexes active) and US1–US3 backend controllers refactored
- **Phase 8 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Phases 1–2 complete. No dependency on US2 or US3.
- **US2 (P1)**: Phases 1–2 complete. No dependency on US1 or US3.
- **US3 (P1)**: Phases 1–2 complete. No dependency on US1 or US2.
- **US4 (P2)**: US1 + US2 + US3 complete (all three pages on React Query before enabling global polling).
- **US5 (P2)**: Phase 2 T003 applied + US1–US3 backend controllers done. Frontend-independent.

### Within Each User Story

- Backend model → backend controller → API function type → frontend hook → frontend page
- Curl validation runs after the full stack for that story is implemented
- Mutation invalidation wired in the same task that migrates the page to React Query

### Parallel Opportunities

- T001 and T002 (Phase 1) in parallel
- T004 and T005 (Phase 2) in parallel
- T013, T019, T020, T021 are all different files and can run in parallel across US2/US3
- T033, T034, T035 (Phase 8 lint) in parallel
- With multiple developers: US1, US2, US3 can all be worked after Phase 2 simultaneously

---

## Parallel Example: US1 + US2 + US3 after Phase 2

```text
After T001–T005 complete:

Developer A → US1 (T006 → T007 → T008 → T009 → T010 → T011 → T012)
Developer B → US2 (T013 → T014 → T015 → T016 → T017 → T018)
Developer C → US3 (T019+T020+T021 in parallel → T022 → T023 → T024 → T025)

All three can merge independently. US4 starts when all three are done.
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only — P1 Stories)

1. Complete Phase 1 (T001–T002)
2. Complete Phase 2 (T003–T005)
3. Complete Phase 3 US1 (T006–T012) → **Staff page fully backend-driven**
4. Complete Phase 4 US2 (T013–T018) → **Fee Campaigns N+1 fixed + React Query**
5. **STOP and validate** both independently using `quickstart.md` Sections 2–3

### Full Delivery (All P1 + P2 Stories)

1. Setup + Foundational
2. US1 → US2 → US3 (P1 stories; can be parallel after Phase 2)
3. US4 (polling; only after all three pages on React Query)
4. US5 (performance verification; parallel with US4)
5. Polish (T033–T039)

---

## Notes

- [P] tasks = different files, no blocking dependencies on incomplete tasks
- US1–US3 are all P1 and truly independent — implement in any order after Phase 2
- US4 (polling) is a one-line change in `App.tsx` but must follow US1–US3 to be meaningful
- US5 is primarily verification/documentation — most work done via T029 (validation logic already in T004) and T031 (EXPLAIN)
- No new database tables required — migration is indexes only
- `parsePaginationParams()` in BaseApiController (T004) is shared by all three story phases; implement before starting any US1–US3 backend task
- The `PaginatedResult<T>` TypeScript type (T001, T005) is shared by all three frontend stories; implement before starting any US1–US3 frontend task
