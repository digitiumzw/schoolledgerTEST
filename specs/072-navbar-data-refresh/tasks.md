# Tasks: Navbar Data Refresh

**Input**: Design documents from `specs/072-navbar-data-refresh/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- All paths are relative to `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New hook scaffolding and shared constants needed by all phases.

- [ ] T001 Create `hooks/useGlobalRefresh.ts` — export `useGlobalRefresh()` returning `{ isRefreshing: boolean; refreshAll: () => void }` using `useQueryClient`, `useIsFetching`, and `refetchQueries({ type: 'active' })`

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: The refresh hook (T001) must exist before the navbar button (US1) or any invalidation wiring (US2) can be completed.

**⚠️ CRITICAL**: T001 must be complete before US1 and US2 tasks begin.

**Checkpoint**: `useGlobalRefresh` hook created and `tsc --noEmit` passes — US1 and US2 can now proceed in parallel.

---

## Phase 3: User Story 1 — Manual Refresh via Navbar Button (Priority: P1) 🎯 MVP

**Goal**: A small refresh button appears in `AppHeader` that spins while active queries re-fetch and is disabled during in-flight requests.

**Independent Test**: Open any authenticated page, click the refresh icon button in the header, observe spinner + disabled state during fetch, then idle again. Verify network requests fire only for the current page's endpoints and no full reload occurs.

### Implementation for User Story 1

- [ ] T002 [US1] Add `RefreshCw` icon refresh button to `components/AppHeader.tsx` — import `useGlobalRefresh`, import `RefreshCw` from `lucide-react`; place button between theme toggle and logout in right-side controls; apply `animate-spin` + `disabled` when `isRefreshing`; add `aria-label` for idle/refreshing states; match existing button style (`variant="ghost"`, `size="icon"`, `className="h-9 w-9"`)

**Checkpoint**: US1 complete — refresh button visible in navbar, spins on click, re-fetches active TanStack Query queries, returns to idle when done.

---

## Phase 4: User Story 2 — Automatic Refresh After Successful Actions (Priority: P2)

**Goal**: Every TanStack Query `useMutation` hook that mutates tenant data calls `queryClient.invalidateQueries` with the correct domain key prefix in its `onSuccess` handler, so the UI auto-updates after any confirmed action without a manual refresh.

**Independent Test**: Record a payment — the payment list and student balance update automatically. Assign a student to a transport route — the route's student list updates automatically. Submit class attendance — the attendance register updates automatically. No manual refresh required after any of these actions.

### Implementation for User Story 2

- [ ] T003 [P] [US2] Add `queryClient.invalidateQueries({ queryKey: ['attendance-today'] })` and `invalidateQueries({ queryKey: ['attendance-summary'] })` to `onSuccess` in `hooks/useUpdateAttendanceStatus.ts` — also add `useQueryClient` import; this hook's mutation currently has no cache invalidation
- [ ] T004 [P] [US2] Audit `hooks/useTransportAssignments.ts` — verify `assignStudent`, `reassignStudent`, `removeStudent` mutations all call `invalidateAll()` in `onSuccess`; confirm `invalidateAll` covers `transport-routes`, `transport-allocations`, `missing-transport-charges`, `student-transport-history` (already present per codebase scan — confirm only, no change needed if correct)
- [ ] T005 [P] [US2] Audit `hooks/useClassAttendance.ts` — verify `useSubmitAttendance` mutation's `onSuccess` invalidates `['class-attendance-register', classId, date]`; add invalidation of `['class-attendance-summary']` if missing
- [ ] T006 [P] [US2] Audit `hooks/useStudentBalance.ts` — confirm `invalidateBalance()` helper is called by payment mutations in `components/modals/RecordPaymentModal.tsx` after successful payment; if not wired, add `onSuccess` call to `invalidateBalance()` in the modal's payment submission handler
- [ ] T007 [P] [US2] Audit `pages/Classes.tsx` inline `invalidateQueries` call — confirm it invalidates `['classes']` after class create/update/delete; add `['dashboard', 'aggregation']` invalidation if missing so dashboard enrollment counts reflect class changes
- [ ] T008 [P] [US2] Audit `pages/RouteDetailPage.tsx` inline `invalidateQueries` call — confirm it covers `['transport-routes']` and `['transport-allocations']` after route-level mutations; add any missing domain keys
- [ ] T009 [P] [US2] Audit `components/staff-attendance/DailyAttendanceTab.tsx` inline `invalidateQueries` — confirm it invalidates `['attendance-today']` after check-in/check-out/status mutations; add `['attendance-summary']` if missing
- [ ] T010 [P] [US2] Audit `hooks/useDashboardAggregation.ts` `refreshMutation` — confirm `onSuccess` calls `invalidateQueries({ queryKey: ['dashboard', 'aggregation'] })`; confirm `useDashboardStats.ts` exposes its `invalidate()` helper; no changes needed if already correct
- [ ] T011 [US2] Audit remaining TanStack Query mutation hooks that lack `onSuccess` invalidation — scan `hooks/useProration.ts`, `components/subscription/PlanChangeModal.tsx`; ensure each calls the appropriate subscription/payments domain key invalidation (`['subscription-current']`, `['payments']` as relevant) after success

**Checkpoint**: US2 complete — performing any create/update/delete/assign action automatically refreshes the relevant data on screen without manual intervention.

---

## Phase 5: User Story 3 — Performance & Large Tenant Optimisation (Priority: P3)

**Goal**: Verify that the refresh mechanism is scoped (active queries only) and does not produce concurrent duplicate requests or blank-flash the UI.

**Independent Test**: Open browser DevTools → Network tab. Click the refresh button rapidly 5 times. Confirm only one batch of requests fires. Verify existing data stays visible (no blank state) during the re-fetch. Confirm the button stays disabled until all requests settle.

### Implementation for User Story 3

- [ ] T012 [US3] Guard against rapid double-click in `hooks/useGlobalRefresh.ts` — confirm `refetchQueries({ type: 'active' })` is not called when `useIsFetching() > 0`; add an explicit early-return guard if not already enforced by the disabled button state alone
- [ ] T013 [US3] Verify TanStack Query `keepPreviousData` / `placeholderData` is in use on high-volume pages (`pages/Payments.tsx`, `pages/Students.tsx`) — these pages already use `placeholderData: keepPreviousData` per prior feature 066; confirm this is present so data does not blank during refresh; no code change if already in place

**Checkpoint**: US3 complete — refresh is efficient, non-duplicating, and seamless.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Run `tsc --noEmit --pretty false` in `frontend/` and fix any type errors introduced by this feature
- [ ] T015 [P] Run `eslint src/hooks/useGlobalRefresh.ts src/components/AppHeader.tsx` and fix any lint issues
- [ ] T016 Run manual verification per `specs/072-navbar-data-refresh/quickstart.md` — US1 button smoke test, US2 post-action auto-refresh, US3 no-duplicate requests; record results in quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)**: No dependencies — start immediately
- **Phase 3 US1 (T002)**: Depends on T001 (hook must exist)
- **Phase 4 US2 (T003–T011)**: Depends on T001 (queryClient pattern established); T003–T011 are all parallel to each other (different files)
- **Phase 5 US3 (T012–T013)**: Depends on T001 and T002; T012 modifies the hook from T001, T013 is audit-only
- **Phase 6 Polish (T014–T016)**: Depends on all implementation tasks

### User Story Dependencies

- **US1 (P1 MVP)**: Depends on T001 only
- **US2 (P2)**: Depends on T001; all US2 tasks (T003–T011) are independent of each other
- **US3 (P3)**: Depends on T001 and T002

### Parallel Opportunities

- T003, T004, T005, T006, T007, T008, T009, T010, T011 — all parallel (different files, all US2)
- T014, T015 — parallel (different tools)
- Once T001 is done: T002 (US1) and T003–T011 (US2) can all begin in parallel

---

## Parallel Example: US2 Audit Tasks

```
All of these can run simultaneously (different files):
  T003: hooks/useUpdateAttendanceStatus.ts
  T004: hooks/useTransportAssignments.ts
  T005: hooks/useClassAttendance.ts
  T006: hooks/useStudentBalance.ts + components/modals/RecordPaymentModal.tsx
  T007: pages/Classes.tsx
  T008: pages/RouteDetailPage.tsx
  T009: components/staff-attendance/DailyAttendanceTab.tsx
  T010: hooks/useDashboardAggregation.ts + hooks/useDashboardStats.ts
  T011: hooks/useProration.ts + components/subscription/PlanChangeModal.tsx
```

---

## Implementation Strategy

### MVP First (US1 Only — 2 tasks)

1. T001: Create `useGlobalRefresh` hook
2. T002: Add refresh button to `AppHeader`
3. **STOP and VALIDATE**: Click button, verify spinner, check network tab for active-only requests

### Incremental Delivery

1. T001 → T002 → MVP deployed (manual refresh works)
2. T003–T011 in parallel → US2 complete (auto-refresh after every action)
3. T012–T013 → US3 complete (performance verified)
4. T014–T016 → Polish and validation complete

---

## Notes

- [P] tasks = different files, no cross-task dependencies
- Audit tasks (T004, T005, T006, T007, T008, T009, T010) may result in "no change needed" — that is a valid outcome; document findings either way
- `useStaffAttendanceData`, `useFeeCampaigns`, `useFeeRules`, `useChargeBatchRollback`, `useFeeStructure`, `useWorkHours` are intentionally out of scope — they use a manual `Map`/`useState` cache outside TanStack Query
- `useStaffAttendanceReport.ts` is also out of scope — it is a read-only report hook with no mutations
- No backend changes, no migrations required
- Total tasks: **16** across 3 user stories + setup + polish
