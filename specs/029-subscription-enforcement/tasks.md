# Tasks: Subscription Enforcement & Plan Recommendation

**Input**: Design documents from `/specs/029-subscription-enforcement/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- No test tasks generated (not requested in spec)

## Path Conventions

```
frontend/src/hooks/useSubscription.ts
frontend/src/components/subscription/SubscriptionGuard.tsx      ← new file
frontend/src/components/subscription/SubscriptionStatusBanner.tsx
frontend/src/pages/Students.tsx
frontend/src/pages/StudentProfile.tsx
frontend/src/pages/Payments.tsx
frontend/src/pages/Classes.tsx
frontend/src/pages/Attendance.tsx
frontend/src/pages/Staff.tsx
frontend/src/pages/StaffProfilePage.tsx
frontend/src/pages/StaffAttendance.tsx
frontend/src/pages/Transport.tsx
frontend/src/pages/RouteDetailPage.tsx
frontend/src/pages/Settings.tsx
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify no new shadcn/ui components are needed; all required primitives (`Alert`, `Card`, `Button`, `Skeleton`) are already installed.

- [x] T001 Confirm `Alert`, `Card`, `Button`, and `Skeleton` components exist in `frontend/src/components/ui/`; if any are missing, add them via `npx shadcn-ui@latest add <component>` from `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend `useSubscription` with `hasActivePlan` and the updated client-side `recommendedPlanId` algorithm. All three user stories depend on `hasActivePlan`; US3 additionally depends on the updated `recommendedPlanId`.

**⚠️ CRITICAL**: No user story work can begin until T002 is complete.

- [x] T002 Extend `UseSubscriptionReturn` interface and `useSubscription` hook in `frontend/src/hooks/useSubscription.ts` to add and export:
  - `hasActivePlan: boolean` — derived as `subscription !== null && subscription.status === 'active'`
  - Update `recommendedPlanId` computation: sort `plans` ascending by `sortOrder`, then find the first plan where `plan.maxStudents === null || plan.maxStudents > studentCount`; fall back to the last plan in the sorted array if none found; return `''` if `plans` is empty

**Checkpoint**: `useSubscription` now exposes `hasActivePlan` and a student-count-aware `recommendedPlanId` — user story phases can begin.

---

## Phase 3: User Story 1 — Essential Operations Blocked Without Active Subscription (Priority: P1) 🎯 MVP

**Goal**: Every essential-operations page (Students, Payments, Classes, Attendance, Staff, Transport, Settings and their sub-pages) renders a "No Active Subscription" blocked state instead of page content when `hasActivePlan` is false. Billing, Help, Dashboard, and kiosk routes are unaffected.

**Independent Test**: Expire or remove the school's active subscription. Log in as admin. Navigate to `/students` — confirm blocked state is shown with "Subscribe Now" CTA and no student data is visible. Navigate to `/billing` — confirm page loads normally. Restore subscription — confirm blocked state lifts on next render.

### Implementation for User Story 1

- [x] T003 [US1] Create `frontend/src/components/subscription/SubscriptionGuard.tsx` — a wrapper component with props `{ children: React.ReactNode }` that:
  - Calls `useSubscription()` and reads `hasActivePlan` and `isLoadingCurrent`
  - While `isLoadingCurrent` is true: renders a full-width `Skeleton` placeholder (e.g. `<div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>`) — no blocked state flash
  - When `hasActivePlan` is true: returns `<>{children}</>` unchanged
  - When `hasActivePlan` is false: renders the blocked state UI containing:
    - A centered `Card` (or `div`) with a `Ban` icon (lucide-react), headline "No Active Subscription", subtext "Subscribe to a plan to unlock this feature.", and a `Button` (variant `default`) labelled "Subscribe Now" that navigates to `/billing` via `react-router-dom` `Link`
    - The `children` MUST NOT be rendered — zero data leakage
- [x] T004 [US1] Wrap the return value of `frontend/src/pages/Students.tsx` in `<SubscriptionGuard>` — import `SubscriptionGuard` from `@/components/subscription/SubscriptionGuard` and wrap the outermost JSX container
- [x] T005 [P] [US1] Wrap the return value of `frontend/src/pages/StudentProfile.tsx` in `<SubscriptionGuard>`
- [x] T006 [P] [US1] Wrap the return value of `frontend/src/pages/Payments.tsx` in `<SubscriptionGuard>`
- [x] T007 [P] [US1] Wrap the return value of `frontend/src/pages/Classes.tsx` in `<SubscriptionGuard>`
- [x] T008 [P] [US1] Wrap the return value of `frontend/src/pages/Attendance.tsx` in `<SubscriptionGuard>`
- [x] T009 [P] [US1] Wrap the return value of `frontend/src/pages/Staff.tsx` in `<SubscriptionGuard>`
- [x] T010 [P] [US1] Wrap the return value of `frontend/src/pages/StaffProfilePage.tsx` in `<SubscriptionGuard>`
- [x] T011 [P] [US1] Wrap the return value of `frontend/src/pages/StaffAttendance.tsx` in `<SubscriptionGuard>`
- [x] T012 [P] [US1] Wrap the return value of `frontend/src/pages/Transport.tsx` in `<SubscriptionGuard>`
- [x] T013 [P] [US1] Wrap the return value of `frontend/src/pages/RouteDetailPage.tsx` in `<SubscriptionGuard>`
- [x] T014 [P] [US1] Wrap the return value of `frontend/src/pages/Settings.tsx` in `<SubscriptionGuard>`

**Checkpoint**: User Story 1 complete — all essential-operations pages blocked when no active subscription; Billing, Help, and Dashboard unaffected.

---

## Phase 4: User Story 2 — Persistent Subscribe Prompt Across the Application (Priority: P2)

**Goal**: A full-width "no active plan" banner appears at the top of every authenticated page when `hasActivePlan` is false, using the `SubscriptionStatusBanner` already mounted in `AppLayout`. It takes highest priority over all existing banner cases.

**Independent Test**: Expire the school subscription. Navigate to the Dashboard (`/`) — confirm the persistent "no active plan" banner appears at the top. Navigate to `/billing` — confirm the banner still appears (page not blocked but banner visible). Restore subscription — confirm banner disappears.

### Implementation for User Story 2

- [x] T015 [US2] Update `frontend/src/components/subscription/SubscriptionStatusBanner.tsx`:
  - Destructure `hasActivePlan` from `useSubscription()` (in addition to existing destructured values)
  - Replace the current top-level `if (!subscription && !isExpired) return null;` early-return guard with logic that allows the component to render when `!hasActivePlan`
  - Add a new **first** conditional branch (before all existing branches) at the top of the render block:
    ```
    if (!hasActivePlan) { return <Alert variant="destructive" ...> }
    ```
  - Banner content:
    - Icon: `Ban` from lucide-react (or `AlertCircle`)
    - Message: "You don't have an active subscription. Subscribe to unlock all features."
    - Inline link labelled "Subscribe now" navigating to `/billing`
    - Styling: `variant="destructive"`, same `className` pattern as the existing expired banner
  - The existing `isExpired`, `isOverLimit`, `isNearCapacity`, and `daysUntilExpiry` branches remain unchanged and continue to operate when `hasActivePlan` is true

**Checkpoint**: User Stories 1 and 2 complete — pages blocked AND persistent banner visible app-wide when no active plan.

---

## Phase 5: User Story 3 — Student-Count-Based Plan Recommendation (Priority: P3)

**Goal**: The plan card for the lowest-tier subscription plan that accommodates the school's current student count is highlighted with a "Recommended" badge on the Billing page. The recommendation updates dynamically on the next subscription data refresh.

**Independent Test**: With student count at 200, open `/billing` — confirm "Starter" card has the "Recommended" badge and Growth/Enterprise do not. Change student count to 270 — confirm "Growth" is now recommended. Change to 400 — confirm "Enterprise" is recommended. Check with 0 students — confirm "Starter" is recommended.

### Implementation for User Story 3

- [x] T016 [US3] Verify `frontend/src/components/subscription/PlanCard.tsx` already accepts `isRecommended: boolean` prop and renders the "Recommended" badge when true (confirmed present — no change needed); document this as a read-only verification step
- [x] T017 [US3] Verify `frontend/src/components/subscription/PlanSelector.tsx` already passes `isRecommended={plan.id === recommendedPlanId}` to each `PlanCard` (confirmed present — no change needed); document as read-only verification
- [x] T018 [US3] Verify `frontend/src/pages/Billing.tsx` passes `recommendedPlanId` from `useSubscription()` into `<PlanSelector>` (confirmed present — no change needed); document as read-only verification

> **Note**: The T002 foundational change (updated `recommendedPlanId` algorithm in `useSubscription`) is the only code change needed for US3. T016–T018 confirm the propagation chain is already in place. If the chain is broken, fix the specific link identified.

**Checkpoint**: All three user stories complete — enforcement active, persistent banner shown, plan recommendation student-count-aware.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T019 [P] Audit `frontend/src/components/subscription/SubscriptionStatusBanner.tsx` for correct banner priority order: `!hasActivePlan` → `isOverLimit` → `isNearCapacity` → `daysUntilExpiry ≤ 7`; confirm no duplicate or conflicting alerts fire
- [x] T020 [P] Verify `frontend/src/pages/Billing.tsx`, `frontend/src/pages/Index.tsx` (Dashboard), and `frontend/src/pages/Help.tsx` do NOT import or use `SubscriptionGuard` — confirm exempt pages are untouched
- [x] T021 [P] Verify kiosk pages (`frontend/src/pages/KioskPage.tsx`, `StudentKioskPage.tsx`, `DriverKioskPage.tsx`) and `frontend/src/pages/Login.tsx` are NOT wrapped in `SubscriptionGuard`
- [x] T022 [P] Verify loading skeleton in `SubscriptionGuard` prevents flash: throttle network to Slow 3G in browser dev tools, reload app as a subscribed user, confirm no blocked state flashes before data resolves
- [ ] T023 Run quickstart.md manual validation: start `frontend/` dev server (`bun run dev`), perform all four test scenarios from quickstart.md and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user story phases
- **Phase 3 (US1)**: Depends on T002 — T003 must complete before T004–T014; T004–T014 can all run in parallel once T003 exists
- **Phase 4 (US2)**: Depends on T002 — can run in parallel with Phase 3 (different file: `SubscriptionStatusBanner.tsx`)
- **Phase 5 (US3)**: Depends on T002 — can run in parallel with Phases 3 & 4 (verification-only tasks)
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5

### User Story Dependencies

- **US1 (P1)**: Depends only on T002 — no dependency on US2 or US3
- **US2 (P2)**: Depends only on T002 — no dependency on US1 or US3
- **US3 (P3)**: Depends only on T002 — no dependency on US1 or US2

### Within Each User Story

- T002 must complete before any US task begins
- US1: T003 (new `SubscriptionGuard` component) must complete before T004–T014; T004–T014 can all run in parallel
- US2: T015 is a single self-contained change to `SubscriptionStatusBanner.tsx`
- US3: T016–T018 are read-only verification steps; can all run in parallel

### Parallel Opportunities

- T004 through T014 are all parallel (different page files, no inter-dependencies)
- T015 is independent of T004–T014 (different file: `SubscriptionStatusBanner.tsx`)
- T016, T017, T018 are all parallel (read-only verification, no file writes)
- T019, T020, T021, T022 are all parallel (audit/verification tasks)

---

## Parallel Example: After T002 and T003 complete

```
Parallel track A (US1): T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014
                         (all page wraps — one per file, fully independent)
Parallel track B (US2): T015
                         (SubscriptionStatusBanner update)
Parallel track C (US3): T016 → T017 → T018
                         (verification chain — sequential but fast)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (verify UI primitives)
2. Complete Phase 2: T002 (extend `useSubscription`)
3. Complete Phase 3: T003 → T004–T014
4. **STOP and VALIDATE**: Expire subscription, navigate to `/students` — blocked state shown; navigate to `/billing` — loads normally
5. Merge / demo as incremental value

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 (T003–T014) → Essential pages blocked ✅ (MVP)
3. Phase 4 (T015) → Persistent app-shell banner ✅
4. Phase 5 (T016–T018) → Plan recommendation working ✅
5. Phase 6 (T019–T023) → Polish & verify ✅

---

## Notes

- [P] tasks = different files, no dependencies — safe to parallelize
- [Story] label maps each task to its user story for traceability
- No new backend endpoints required — all enforcement derived from existing API cache
- No test tasks generated (not requested in spec); add them if TDD is desired
- T016–T018 (US3) are intentionally verification-only — the actual recommendation logic ships in T002
- Commit after each phase checkpoint to keep changes reviewable
