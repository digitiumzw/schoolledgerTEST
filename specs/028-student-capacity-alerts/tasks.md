# Tasks: Student Capacity Display & Near-Capacity Upgrade Alert

**Input**: Design documents from `/specs/028-student-capacity-alerts/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- No test tasks generated (not requested in spec)

## Path Conventions

```
frontend/src/hooks/useSubscription.ts
frontend/src/components/subscription/StudentCapacityCard.tsx   ← new file
frontend/src/components/subscription/SubscriptionStatusBanner.tsx
frontend/src/pages/Billing.tsx
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify shadcn/ui `Progress` component is available; no new dependencies expected since TailwindCSS + shadcn/ui are already installed.

- [x] T001 Confirm `Progress` component from shadcn/ui is present in `frontend/src/components/ui/progress.tsx`; if missing, add it via `npx shadcn-ui@latest add progress` from `frontend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend `useSubscription` hook with the four derived capacity values that ALL three user stories depend on.

**⚠️ CRITICAL**: US1, US2, and US3 all depend on these values — no user story work can begin until T002 is complete.

- [x] T002 Extend `UseSubscriptionReturn` interface and `useSubscription` hook in `frontend/src/hooks/useSubscription.ts` to derive and return four new fields:
  - `maxStudents: number | null` — resolved via `plans.find(p => p.id === subscription?.planId)?.maxStudents ?? null`
  - `capacityPercent: number | null` — `maxStudents !== null ? Math.round((studentCount / maxStudents) * 100) : null`
  - `remainingSlots: number | null` — `maxStudents !== null ? maxStudents - studentCount : null`
  - `isNearCapacity: boolean` — `capacityPercent !== null && capacityPercent >= 75 && !isOverLimit && !isExpired`

**Checkpoint**: `useSubscription` now exposes capacity state — user story phases can begin.

---

## Phase 3: User Story 1 — View Student Capacity on Billing Page (Priority: P1) 🎯 MVP

**Goal**: An admin/bursar sees a capacity widget on the Billing page showing enrolled count, plan limit, and remaining slots.

**Independent Test**: Log in as admin, navigate to `/billing` with an active finite-limit plan. Verify the card shows correct enrolled count, plan max, remaining slots, and a progress bar. Verify Enterprise plan shows enrolled count only with "No limit" label.

### Implementation for User Story 1

- [x] T003 [US1] Create `frontend/src/components/subscription/StudentCapacityCard.tsx` — a Card component that accepts props `{ studentCount, maxStudents, capacityPercent, remainingSlots, isLoading }` and renders:
  - Loading skeleton (when `isLoading`)
  - If `maxStudents === null`: enrolled count + "No student limit on this plan" label
  - If `maxStudents !== null`: enrolled count, plan limit, remaining slots, and a `Progress` bar coloured by usage (`< 50%` → default, `50–74%` → amber/yellow, `≥ 75%` → red/destructive)
- [x] T004 [US1] Update `frontend/src/pages/Billing.tsx` to:
  - Destructure `maxStudents`, `capacityPercent`, `remainingSlots` from `useSubscription()`
  - Import and render `<StudentCapacityCard>` between the status alerts block and the "Current Subscription" Card, passing all four props plus `isLoading={isLoadingCurrent}`
  - Only render the card when `subscription !== null || isLoadingCurrent` (hide when no subscription at all)

**Checkpoint**: User Story 1 is fully functional — capacity widget visible on Billing page.

---

## Phase 4: User Story 2 — Near-Capacity Warning on Billing Page (Priority: P2)

**Goal**: A warning banner appears on the Billing page when ≥ 75% of the plan limit is used, directing the user to upgrade.

**Independent Test**: With a finite-plan school at ≥ 75% capacity, navigate to `/billing`. Verify warning banner appears with upgrade CTA. Verify at 74% it does not appear. Verify it is suppressed when `isOverLimit` or `isExpired` is true.

### Implementation for User Story 2

- [x] T005 [US2] Update `frontend/src/pages/Billing.tsx` — inside the "Subscription status alerts" block, add a new `isNearCapacity` alert **after** the `isOverLimit` alert and **before** the `daysUntilExpiry` alert:
  - Destructure `isNearCapacity` from `useSubscription()`
  - Condition: `!isExpired && !isOverLimit && isNearCapacity`
  - Use amber/yellow `Alert` styling consistent with the existing expiry-soon alert
  - Icon: `AlertTriangle` from lucide-react (or reuse `AlertCircle`)
  - Title: "Approaching Student Capacity"
  - Description: "You are using {capacityPercent}% of your plan's student limit ({studentCount} of {maxStudents}). Upgrade your plan to avoid disruption."
  - Include a `<button>` or `<a>` scroll-to / anchor link to the "Choose a Plan" section (`#plan-selector` or equivalent)

**Checkpoint**: User Stories 1 and 2 complete — capacity widget shown, near-capacity warning fires correctly on Billing page.

---

## Phase 5: User Story 3 — Global Near-Capacity Banner in App Shell (Priority: P3)

**Goal**: The near-capacity warning also appears in `SubscriptionStatusBanner` so admins are alerted app-wide, not just on the Billing page.

**Independent Test**: With a finite-plan school at ≥ 75% capacity, navigate to any non-Billing page (e.g., Dashboard). Verify the `SubscriptionStatusBanner` shows the near-capacity warning. Verify the expiry banner takes priority over it. Verify no duplicate banners are shown.

### Implementation for User Story 3

- [x] T006 [US3] Update `frontend/src/components/subscription/SubscriptionStatusBanner.tsx`:
  - Destructure `isNearCapacity`, `capacityPercent`, `studentCount`, `maxStudents` from `useSubscription()`
  - Add a fourth banner case, inserted between the `isOverLimit` case and the `daysUntilExpiry <= 7` case:
    ```
    if (!isExpired && !isOverLimit && isNearCapacity) { return <Alert ... /> }
    ```
  - Message: "You are approaching your student limit ({studentCount}/{maxStudents} used). Upgrade your plan soon."
  - Include a `<Link to="/billing">` labelled "Upgrade plan"
  - Use amber/yellow styling (matching the existing expiry-soon banner style)
  - Import `TrendingUp` or `AlertTriangle` from lucide-react for the icon

**Checkpoint**: All three user stories complete — capacity visible on Billing page, near-capacity warning fires on Billing page and in global app shell.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T007 [P] Audit alert priority order across both `Billing.tsx` and `SubscriptionStatusBanner.tsx` to confirm: expired → over-limit → near-capacity → expiry-soon (no duplicates, correct suppressions)
- [x] T008 [P] Verify Enterprise plan (`maxStudents === null`) renders correctly in both `StudentCapacityCard` and `SubscriptionStatusBanner` — no capacity widget, no warning
- [x] T009 [P] Verify zero-student edge case: `studentCount = 0` with finite plan shows 0% progress bar and no near-capacity warning
- [x] T010 Run quickstart.md validation: start dev server, log in as admin, navigate to `/billing`, confirm capacity card and alerts render as specified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user story phases
- **Phase 3 (US1)**: Depends on Phase 2 (T002)
- **Phase 4 (US2)**: Depends on Phase 2 (T002) — can run in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 2 (T002) — can run in parallel with Phases 3 & 4
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5

### User Story Dependencies

- **US1 (P1)**: Depends only on T002 — no dependency on US2 or US3
- **US2 (P2)**: Depends only on T002 — no dependency on US1 or US3
- **US3 (P3)**: Depends only on T002 — no dependency on US1 or US2

### Within Each User Story

- T002 (hook extension) must complete before any US task
- US1: T003 (new component) before T004 (Billing page render)
- US2: T005 is a single self-contained change to Billing.tsx
- US3: T006 is a single self-contained change to SubscriptionStatusBanner.tsx

### Parallel Opportunities

- T003 and T005 can run in parallel (different files: new component vs Billing.tsx alert block)
- T003 and T006 can run in parallel (different files: new component vs SubscriptionStatusBanner.tsx)
- T005 and T006 can run in parallel (different files)
- T007, T008, T009 all run in parallel (review/verification tasks, no file conflicts)

---

## Parallel Example: After T002 completes

```
Parallel track A: T003 → T004   (US1 — new component + Billing page render)
Parallel track B: T005           (US2 — Billing page near-capacity alert)
Parallel track C: T006           (US3 — SubscriptionStatusBanner extension)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (verify Progress component)
2. Complete Phase 2: T002 (extend `useSubscription`)
3. Complete Phase 3: T003 → T004
4. **STOP and VALIDATE**: Visit `/billing` — capacity widget is visible and correct
5. Merge / demo as incremental value

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. Phase 3 (T003, T004) → Capacity widget on Billing page ✅ (MVP)
3. Phase 4 (T005) → Near-capacity warning on Billing page ✅
4. Phase 5 (T006) → Global banner in app shell ✅
5. Phase 6 (T007–T010) → Polish & verify ✅

---

## Notes

- [P] tasks = different files, no dependencies — safe to parallelize
- [Story] label maps each task to its user story for traceability
- No new backend endpoints required — all data flows from existing API cache
- No test tasks generated (not requested in spec); add them if TDD is desired
- Commit after each phase checkpoint to keep changes reviewable
