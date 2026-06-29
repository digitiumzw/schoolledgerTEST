# Implementation Tasks: Move Reconciliation Under Payments Submenu

**Feature**: 037-reconciliation-submenu  
**Branch**: `037-reconciliation-submenu`  
**Generated**: 2026-04-17

---

## Phase 1: Setup

> Environment preparation and verification

### Setup Tasks

- [x] T001 Verify development environment is ready (Node.js, npm, dev server working)
- [x] T002 Confirm current branch is `037-reconciliation-submenu`
- [x] T003 Identify existing navigation component location in `frontend/src/components/AppSidebar.tsx`
- [x] T004 Identify existing reconciliation component in `frontend/src/components/settings/ReconciliationTab.tsx`
- [x] T005 Review current route configuration in `frontend/src/App.tsx`

---

## Phase 2: Foundational Tasks (Blocking)

> These tasks establish the base structure that both user stories depend on

### Route Structure Changes

- [x] T006 Update route configuration to add `/payments/reconciliation` path in `frontend/src/App.tsx`
- [x] T007 Add redirect from `/settings/reconciliation` to `/payments/reconciliation` in `frontend/src/App.tsx`
- [x] T008 Create standalone Reconciliation page at `frontend/src/pages/Reconciliation.tsx`

---

## Phase 3: User Story 1 - Navigate to Reconciliation via Payments Submenu (P1)

**Story Goal**: Restructure navigation so Reconciliation appears as a submenu under Payments  
**Independent Test**: Click Payments menu → submenu appears → click Reconciliation → page loads at `/payments/reconciliation`  
**Acceptance Criteria**: FR-001 through FR-007, SC-001, SC-004, SC-005

### Navigation Component Updates

- [x] T009 [P] [US1] Update NavItem interface to support children/submenu in `frontend/src/components/AppSidebar.tsx`
- [x] T010 [US1] Create Submenu using shadcn/ui Collapsible in `frontend/src/components/AppSidebar.tsx`
- [x] T011 [US1] Add ARIA attributes (aria-expanded, aria-haspopup, aria-current) in `frontend/src/components/AppSidebar.tsx`
- [x] T012 [US1] Implement keyboard navigation via CollapsibleTrigger in `frontend/src/components/AppSidebar.tsx`
- [x] T013 [US1] Update Payments menu item to include Reconciliation as first child in `frontend/src/components/AppSidebar.tsx`
- [x] T014 [US1] Add active state indicator for submenu parent when child is active in `frontend/src/components/AppSidebar.tsx`
- [x] T015 [US1] Collapsible handles click-outside via standard behavior in `frontend/src/components/AppSidebar.tsx`

### Mobile Navigation

- [x] T016 [US1] Submenu integrated into AppSidebar with proper touch targets in `frontend/src/components/AppSidebar.tsx`
- [ ] T017 [US1] Test submenu on mobile device/small screen (320px-768px) - MANUAL TESTING REQUIRED

---

## Phase 4: User Story 2 - Use Reconciliation Page on Mobile Devices (P1)

**Story Goal**: Make reconciliation page fully responsive across all device sizes  
**Independent Test**: Open reconciliation page on mobile (<768px), tablet (768-1024px), desktop (>1024px) - all content accessible without horizontal scrolling  
**Acceptance Criteria**: FR-008 through FR-013, SC-002, SC-003

### Responsive Layout Updates

- [x] T018 [P] [US2] Responsive container in standalone page at `frontend/src/pages/Reconciliation.tsx`
- [x] T019 [P] [US2] Add overflow-x-auto wrapper to tables in `frontend/src/components/settings/ReconciliationTab.tsx`
- [x] T020 [P] [US2] Set minimum column widths (min-w-[80px] to min-w-[150px]) on tables in `frontend/src/components/settings/ReconciliationTab.tsx`
- [x] T021 [US2] Tables maintain readable font sizes via existing classes in `frontend/src/components/settings/ReconciliationTab.tsx`
- [x] T022 [P] [US2] Update layout to use responsive breakpoints (sm:, lg:) in `frontend/src/components/settings/ReconciliationTab.tsx`
- [x] T023 [P] [US2] Ensure interactive elements have min-h-[44px] touch targets in `frontend/src/components/settings/ReconciliationTab.tsx`
- [x] T024 [US2] Add responsive padding and gap adjustments in `frontend/src/components/settings/ReconciliationTab.tsx`

### Responsive Testing

- [ ] T025 [US2] Test page at 320px width (small mobile) - verify no horizontal scrolling - MANUAL
- [ ] T026 [US2] Test page at 375px width (iPhone SE) - MANUAL
- [ ] T027 [US2] Test page at 768px width (tablet) - MANUAL
- [ ] T028 [US2] Test page at 1024px width (small laptop) - MANUAL
- [ ] T029 [US2] Test page at 1440px width (desktop) - MANUAL
- [ ] T030 [US2] Test page at 2560px width (large desktop) - MANUAL
- [ ] T031 [US2] Verify smooth transition when resizing browser window - MANUAL

---

## Phase 5: Polish & Cross-Cutting Concerns

> Final integration, testing, and quality checks

### Integration Testing

- [ ] T032 Test complete user flow: Navigate to Reconciliation via Payments submenu on desktop
- [ ] T033 Test complete user flow: Navigate to Reconciliation via Payments submenu on mobile
- [ ] T034 Test legacy URL redirect: `/reconciliation` → `/payments/reconciliation`
- [ ] T035 Test deep linking: Direct access to `/payments/reconciliation`
- [ ] T036 Test keyboard-only navigation to reconciliation
- [ ] T037 Test browser back/forward buttons work correctly with new route

### Accessibility Verification

- [ ] T038 Verify WCAG 2.1 AA color contrast compliance on reconciliation page
- [ ] T039 Verify focus indicators visible on all interactive elements
- [ ] T040 Run axe-core or similar accessibility checker

### Cross-Browser Testing

- [ ] T041 Test in Chrome (latest)
- [ ] T042 Test in Firefox (latest)
- [ ] T043 Test in Safari (latest)
- [ ] T044 Test in Edge (latest)

### Code Quality

- [x] T045 TypeScript check passed with `npx tsc --noEmit` - no errors
- [x] T046 Build production bundle with `npm run build` - SUCCESS
- [ ] T047 Verify no console warnings when navigating to reconciliation - MANUAL

### Documentation

- [ ] T048 Update navigation documentation/comments if applicable
- [ ] T049 Add JSDoc comments to new Submenu component

---

## Dependencies

### User Story Completion Order

```
Phase 2 (Foundational)
    ↓
Phase 3 (US1: Navigation) ──────┐
    ↓                            │
Phase 4 (US2: Responsive) ──────┤ Independent - can be done in parallel
    ↓                            │
Phase 5 (Polish) ←───────────────┘
```

**Notes**:
- **Phase 2 (Routes)** must complete before both user stories
- **US1 and US2 are INDEPENDENT** after Phase 2 - can be developed in parallel
- **Phase 5 (Polish)** requires both US1 and US2 to be complete

### Task Dependencies (Within Stories)

**US1 - Navigation**:
- T009 (interface update) → T010, T011, T012, T013, T014, T015, T016
- Submenu component tasks (T010-T015) can be done together
- T017 (mobile testing) requires T016

**US2 - Responsive**:
- T018 (container wrapper) → T019, T020, T021, T022, T023, T024
- Responsive tasks T018-T024 can be done in parallel (marked with [P])
- T025-T031 (testing) must come after implementation tasks

---

## Parallel Execution Examples

### Maximum Parallelism (2 developers)

**Developer A - Navigation (US1)**:
1. Complete Phase 2 (T006-T008) - shared prerequisite
2. T009 (interface)
3. T010-T016 (Submenu component + mobile) - parallel within this group
4. T017 (testing)

**Developer B - Responsive (US2)**:
1. Wait for Phase 2 completion
2. T018-T024 (responsive implementation) - parallel within this group
3. T025-T031 (responsive testing)

### Single Developer Sequence

1. Phase 1: T001-T005 (setup)
2. Phase 2: T006-T008 (routes) - **BLOCKING**
3. Phase 3: T009-T017 (navigation) OR T018-T031 (responsive) - pick one story
4. Complete remaining story
5. Phase 5: T032-T049 (polish)

---

## MVP Scope

**Minimum Viable Product**: Complete **User Story 1 (Navigation)** only

**MVP Tasks**: T001-T017 + T032-T037 (basic integration tests) + T045-T047 (quality checks)

**Value delivered**: Users can find and navigate to reconciliation via Payments submenu. Page works on desktop; mobile responsive can be Phase 2.

---

## Summary

| Phase | Tasks | Story | Description |
|-------|-------|-------|-------------|
| Phase 1 | T001-T005 | - | Setup and verification |
| Phase 2 | T006-T008 | - | Route structure (blocking) |
| Phase 3 | T009-T017 | US1 | Navigation submenu |
| Phase 4 | T018-T031 | US2 | Responsive design |
| Phase 5 | T032-T049 | - | Polish and testing |

**Total Tasks**: 49  
**Parallel Opportunities**: US1 and US2 can be developed in parallel after Phase 2  
**Estimated MVP**: 26 tasks (Phases 1-3 + basic integration)

---

## Success Criteria Verification

| Criterion | Tasks that verify it |
|-----------|---------------------|
| SC-001: 2-click navigation | T032, T033 |
| SC-002: No horizontal scrolling | T025-T030 |
| SC-003: 44x44px touch targets | T016, T023 |
| SC-004: Keyboard navigation | T012, T036 |
| SC-005: Deep linking | T035 |
| SC-006: Legacy redirect | T034 |
