# Tasks: Role-Based Help Page

**Input**: Design documents from `/specs/088-role-based-help-page/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No backend curl tests required — this is a frontend-only feature with no new API endpoints. Validation is UI-based per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and TypeScript types for help content entities.

- [x] T001 Create `frontend/src/types/help.ts` with `HelpStep`, `HelpTopic`, `HelpSection`, `ContextualHelpMapping`, and `HelpContentBundle` interfaces
- [x] T002 [P] Create `frontend/src/components/help/` directory for help-specific UI components
- [x] T003 [P] Create `frontend/src/hooks/useHelpSearch.ts` file stub with hook signature
- [x] T004 [P] Create `frontend/src/hooks/useActiveSection.ts` file stub with hook signature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Static help content data structure, filtering hooks, and reusable components that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Create `frontend/src/lib/helpContent.ts` with empty `HelpContentBundle` scaffold and export; add role-filtering utility `getSectionsForRole(sections, role)`
- [x] T006 [P] Implement `useHelpSearch(sections, userRole)` hook in `frontend/src/hooks/useHelpSearch.ts` — derives a flat search index, returns `filteredSections`, `searchQuery`, `setSearchQuery`, `hasResults`
- [x] T007 [P] Implement `useActiveSection(sectionIds)` hook in `frontend/src/hooks/useActiveSection.ts` — uses `IntersectionObserver` with threshold 0.3 and rootMargin; returns `activeSectionId`
- [x] T008 [P] Create `frontend/src/components/help/ScreenshotPlaceholder.tsx` — styled dashed-border placeholder with `Image` Lucide icon and caption prop; uses existing design system tokens

**Checkpoint**: Foundation ready — types, data scaffold, hooks, and placeholder component exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Admin Comprehensive Help Guide (Priority: P1) 🎯 MVP

**Goal**: A complete Help page with all admin-visible sections, table of contents, search, scroll-spy, step-by-step guides, and screenshot placeholders.

**Independent Test**: Log in as admin, open `/help`, verify all 13 sections are visible in TOC, search filters correctly, clicking TOC scrolls to section, scrolling updates active TOC item, each topic shows ordered steps.

### Implementation for User Story 1

- [x] T009 [P] [US1] Populate admin-scoped help content in `frontend/src/lib/helpContent.ts` — add all 13 admin sections with topics, steps, and screenshot captions: Dashboard Overview, School Setup, Academic Year & Term Management, Class & Student Management, Fee Structure, Transport Configuration, Billing Workflow, Payment Recording, User & Role Management, Reports & Analytics, System Settings, Best Practices, Troubleshooting
- [x] T010 [P] [US1] Create `frontend/src/components/help/HelpTableOfContents.tsx` — accepts `sections`, `activeSectionId`, `onSectionClick`, `searchQuery`, `onSearchChange`; renders sticky sidebar with search input, section list with icons, active highlight; uses shadcn Card and existing spacing tokens
- [x] T011 [P] [US1] Create `frontend/src/components/help/HelpSection.tsx` — accepts `section`, `isVisible`, `searchQuery`; renders `<section id={section.id}>` with H2 heading, optional description, and renders child `HelpTopic` components
- [x] T012 [P] [US1] Create `frontend/src/components/help/HelpTopic.tsx` — accepts `topic`, `isVisible`, `searchQuery`; renders `<div id={topic.id}>` with H3 title, ordered `<ol>` of steps (with `{{organizationName}}` placeholder replacement from `AuthContext`), optional tip callout, and `ScreenshotPlaceholder` when `screenshotCaption` is present
- [x] T013 [US1] Rewrite `frontend/src/pages/Help.tsx` — complete replacement of placeholder; uses `useAuth()` for role, `useHelpSearch` for filtering, `useActiveSection` for scroll-spy; renders two-column layout (TOC left, content right); handles `?section=` and `?topic=` query params for contextual navigation; applies role filter so only `super_admin`/`admin` see full content

**Checkpoint**: At this point, the Help page is fully functional for admin users with all core features: TOC, search, scroll-spy, step-by-step content, and placeholders.

---

## Phase 4: User Story 2 - Bursar Role-Limited Help Guide (Priority: P1)

**Goal**: Bursar users see only bursar-visible sections; admin-only sections are hidden.

**Independent Test**: Log in as bursar, open `/help`, verify only bursar sections appear; search for "add user" returns no results.

### Implementation for User Story 2

- [x] T014 [US2] Add bursar-scoped help sections and topics to `frontend/src/lib/helpContent.ts` — Dashboard Overview, Viewing Students and Balances, Fee Structures (view-only context), Billing and Invoice Processing, Recording Payments, Managing Receipts, Monitoring Outstanding Balances, Financial Reports, Daily Reconciliation, Bursar Troubleshooting; ensure `roleVisibility` arrays correctly exclude bursar from admin-only content
- [x] T015 [US2] Verify `frontend/src/pages/Help.tsx` correctly filters content for `bursar` role — no admin-only sections (User Management, System Settings, Academic Year, Transport) are rendered

**Checkpoint**: Bursar Help page works independently with scoped content.

---

## Phase 5: User Story 3 - Teacher Role-Limited Help Guide (Priority: P1)

**Goal**: Teacher users see only teacher-visible sections; all admin/financial sections are hidden.

**Independent Test**: Log in as teacher, open `/help`, verify only teacher sections appear; search for "payment" or "fee" returns no results.

### Implementation for User Story 3

- [x] T016 [US3] Add teacher-scoped help sections and topics to `frontend/src/lib/helpContent.ts` — Dashboard Overview, Marking Student Attendance, Viewing Class Rosters, Teacher Troubleshooting; ensure `roleVisibility` arrays correctly scope to `teacher` only
- [x] T017 [US3] Verify `frontend/src/pages/Help.tsx` correctly filters content for `teacher` role — no financial or administrative sections are rendered

**Checkpoint**: Teacher Help page works independently with scoped content.

---

## Phase 6: User Story 4 - Search Help Content by Keyword (Priority: P2)

**Goal**: Real-time search filters help topics by keyword across titles, headings, and step descriptions, scoped to the user's role.

**Independent Test**: Type "invoice" in search on each role's Help page; verify role-scoped results only.

### Implementation for User Story 4

- [x] T018 [US4] Create `frontend/src/components/help/HelpSearch.tsx` — search input with Search icon, Clear button, and debounced `onChange` (150ms); uses existing shadcn Input component
- [x] T019 [US4] Integrate `HelpSearch` into `frontend/src/pages/Help.tsx` — wire `searchQuery` and `setSearchQuery` to `useHelpSearch`; display "No results" empty state when `hasResults` is false; ensure search highlighting (bold matching text) in `HelpTopic` component

**Checkpoint**: Search works across all roles with correct scoping.

---

## Phase 7: User Story 5 - Launch Contextual Help from a Module (Priority: P2)

**Goal**: Users can click a help icon on module pages to open the Help page pre-scrolled to the relevant section.

**Independent Test**: Click help icon on `/payments` as bursar, verify navigation to `/help?section=recording-payments` with auto-scroll.

### Implementation for User Story 5

- [x] T020 [P] [US5] Create `frontend/src/components/help/ContextualHelpLink.tsx` — accepts `sectionId` and optional `label`; renders `CircleHelp` icon button with Tooltip; uses `useNavigate` to route to `/help?section={sectionId}`; only renders if user's role has visibility to the target section (checked via `isVisibleToRole` utility)
- [x] T021 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Payments.tsx` page header — target: `recording-payments`, visible to admin/super_admin/bursar
- [x] T022 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Settings.tsx` page header — target: `system-settings`, visible to admin/super_admin
- [x] T023 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Classes.tsx` page header — target: `class-management`, visible to admin/super_admin
- [x] T024 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Students.tsx` page header — target: `student-management`, visible to admin/super_admin/bursar
- [x] T025 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Billing.tsx` page header — target: `billing-workflow`, visible to admin/super_admin/bursar
- [x] T026 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Staff.tsx` page header — target: `user-role-management`, visible to admin/super_admin
- [x] T027 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/StaffAttendance.tsx` page header — target: `staff-attendance`, visible to admin/super_admin
- [x] T028 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/Transport.tsx` page header — target: `transport-configuration`, visible to admin/super_admin
- [x] T029 [P] [US5] Add `ContextualHelpLink` to `frontend/src/pages/FeeCampaigns.tsx` page header — target: `fee-campaigns`, visible to admin/super_admin/bursar
- [x] T030 [US5] Update `frontend/src/pages/Help.tsx` to read `?section=` and `?topic=` from `useSearchParams` on mount and auto-scroll to the target element using `document.getElementById().scrollIntoView({ behavior: 'smooth' })`

**Checkpoint**: Contextual help links are present on all primary module pages and correctly route to scoped help sections.

---

## Phase 8: User Story 6 - Navigate via Table of Contents (Priority: P2)

**Goal**: Persistent TOC with smooth scroll and scroll-spy active section highlighting.

**Independent Test**: Click TOC item → page scrolls to section; scroll manually → active TOC item updates.

### Implementation for User Story 6

- [x] T031 [US6] Verify smooth scroll behavior in `HelpTableOfContents` — clicking a TOC item calls `document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth', block: 'start' })`
- [x] T032 [US6] Verify scroll-spy integration in `frontend/src/pages/Help.tsx` — `useActiveSection` is wired to `HelpTableOfContents`'s `activeSectionId` prop; active item receives visual highlight (border-left primary + semibold text)
- [x] T033 [US6] Ensure TOC remains accessible on long pages — sticky positioning on desktop (`position: sticky; top: 5rem`), collapsible/mobile-friendly on smaller viewports

**Checkpoint**: TOC navigation is fully interactive with smooth scroll and scroll-spy.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, validation, and responsive verification across all user stories.

- [x] T034 [P] Run `npx tsc --noEmit --pretty false` in `frontend/` — verify zero TypeScript errors for all new/modified files
- [x] T035 [P] Run targeted ESLint on all new/modified frontend files: `frontend/src/pages/Help.tsx`, `frontend/src/components/help/*`, `frontend/src/lib/helpContent.ts`, `frontend/src/types/help.ts`, `frontend/src/hooks/useHelpSearch.ts`, `frontend/src/hooks/useActiveSection.ts`
- [x] T036 [P] Verify responsive behavior: desktop (>=1024px) two-column layout, tablet (768-1023px) two-column with narrower TOC, mobile (<768px) single-column with collapsible TOC
- [x] T037 [P] Verify `git diff --check` is clean (no trailing whitespace, no missing newlines)
- [x] T038 Verify no unauthorized content leaks: log in as each role (admin, bursar, teacher) and confirm zero exposure of help topics outside role scope
- [x] T039 Verify contextual help links only render for permitted roles: check that bursar does not see links to admin-only modules, teacher does not see financial module links
- [x] T040 Update `specs/088-role-based-help-page/quickstart.md` with final validation results and any deviations found during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational phase completion
  - US1 (Phase 3) must complete before US2/US3 content additions (T014–T017) because the page structure and filtering mechanism must exist first
  - US4 (Phase 6) search integration depends on US1 page structure
  - US5 (Phase 7) contextual links can start in parallel with US4/US6 once US1 is done
  - US6 (Phase 8) TOC polish depends on US1 TOC component
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories; delivers the MVP
- **User Story 2 (P1)**: Can start after US1 — adds bursar content to existing page structure
- **User Story 3 (P1)**: Can start after US1 — adds teacher content to existing page structure; can run in parallel with US2
- **User Story 4 (P2)**: Depends on US1 page structure — adds search UI
- **User Story 5 (P2)**: Can start after US1 — adds contextual links on module pages; no direct dependency on US2–US4
- **User Story 6 (P2)**: Depends on US1 TOC component — adds scroll-spy polish

### Within Each User Story

- Content population (lib/helpContent.ts) before page verification
- Component creation before page integration
- Core implementation before contextual/link integration

### Parallel Opportunities

- **Phase 1**: All setup tasks (T001–T004) can run in parallel (different files, no dependencies)
- **Phase 2**: T006, T007, T008 can run in parallel (different hooks/components)
- **Phase 3 (US1)**: T009 (content), T010 (TOC), T011 (Section), T012 (Topic) can run in parallel; T013 (page integration) depends on T010–T012
- **Phase 4 (US2) + Phase 5 (US3)**: T014 and T016 can run in parallel (different content additions to same file)
- **Phase 7 (US5)**: T021–T029 (contextual links on different pages) can all run in parallel
- **Phase 9**: T034, T035, T036, T037 can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Foundational phase is complete, launch US1 implementation tasks in parallel:
Task T009: "Populate admin-scoped help content in frontend/src/lib/helpContent.ts"
Task T010: "Create HelpTableOfContents component"
Task T011: "Create HelpSection component"
Task T012: "Create HelpTopic component"

# Once T010–T012 complete, integrate:
Task T013: "Rewrite Help.tsx page with full layout"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 — Admin Help Page with full UI (TOC, search, scroll-spy, content)
4. **STOP and VALIDATE**: Test as admin — verify all sections visible, search works, TOC scrolls, scroll-spy highlights
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test as admin → Deploy/Demo (MVP!)
3. Add User Story 2 + 3 → Test as bursar and teacher → Deploy/Demo
4. Add User Story 4 + 6 → Test search and TOC polish → Deploy/Demo
5. Add User Story 5 → Test contextual links on module pages → Deploy/Demo
6. Run Phase 9 polish → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 — Core Help Page (TOC, sections, topics, page layout)
   - Developer B: US1 — Content writing (all admin help text in helpContent.ts)
3. After US1 merges:
   - Developer A: US2 + US3 — Bursar and teacher content additions
   - Developer B: US5 — Contextual help links across module pages
   - Developer C: US4 + US6 — Search polish and TOC scroll-spy refinement
4. Stories complete and integrate independently

---

## Task Summary

| Phase | Tasks | Story | Description |
|-------|-------|-------|-------------|
| Setup | T001–T004 | — | Types, directories, hook stubs |
| Foundational | T005–T008 | — | Content data, hooks, placeholder |
| US1 (P1 MVP) | T009–T013 | Admin | Full Help page with admin content |
| US2 (P1) | T014–T015 | Bursar | Bursar content + verification |
| US3 (P1) | T016–T017 | Teacher | Teacher content + verification |
| US4 (P2) | T018–T019 | Search | Search component + integration |
| US5 (P2) | T020–T030 | Contextual | ContextualHelpLink + module integration |
| US6 (P2) | T031–T033 | TOC | Smooth scroll + scroll-spy polish |
| Polish | T034–T040 | — | TypeScript, ESLint, responsive, validation |

**Total tasks**: 40
**MVP scope**: Phase 1 + Phase 2 + US1 (T001–T013, 13 tasks)
**Parallel opportunities**: T001–T004, T006–T008, T009–T012, T014+T016, T021–T029, T034–T037
