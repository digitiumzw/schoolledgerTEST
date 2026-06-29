# Tasks: Class Page Session Display & Migration Session Awareness (051)

**Input**: Design documents from `/specs/051-class-session-display-migration/`
**Branch**: `051-class-session-display-migration`
**Stack**: TypeScript 5 · React 18 · TanStack React Query v5 · shadcn/ui · TailwindCSS

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm the branch and verify existing API contract before writing any code.

- [ ] T001 Verify `GET /api/settings` returns `activeAcademicSession` field for the active tenant (manual test or curl; confirms contract in `specs/051-class-session-display-migration/contracts/GET_settings.md`)
- [ ] T002 Verify `GET /api/students/migration-preview` returns non-empty `academicSession` and `nextSession` fields (manual test; confirms MigrationPreviewModal already has correct data)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New hook that both US1 and US2 depend on.

**⚠️ CRITICAL**: US1 and US2 cannot be implemented until this phase is complete.

- [ ] T003 Create `useActiveSession` hook in `frontend/src/hooks/useActiveSession.ts` — export `ActiveSessionResult` interface (`activeSession: string | null`, `isFallback: boolean`, `isLoading: boolean`, `isError: boolean`) and `useActiveSession()` function using `useQuery({ queryKey: ['settings'], queryFn: api.getSettings, staleTime: 5 * 60 * 1000 })`; derive `activeSession` from `data?.activeAcademicSession ?? null` and `isFallback` from `data != null && data.activeAcademicSession == null`

**Checkpoint**: `useActiveSession` is importable and returns correct shape — both user story phases can now proceed.

---

## Phase 3: User Story 1 — View Current Academic Session on Classes Page (Priority: P1) 🎯 MVP

**Goal**: Display active academic session badge in the Classes page header. Read-only, visible to all roles, with skeleton loading and error fallback.

**Independent Test**: Navigate to `/classes` with `activeAcademicSession = "2025/2026"` configured → a badge reading "2025/2026" is visible in the page header without any other interaction.

### Implementation for User Story 1

- [ ] T004 [US1] Add `import { useActiveSession } from "@/hooks/useActiveSession"` to `frontend/src/pages/Classes.tsx` (top of file, alongside existing imports)
- [ ] T005 [US1] Add `import { Skeleton } from "@/components/ui/skeleton"` to `frontend/src/pages/Classes.tsx` (top of file, if not already present)
- [ ] T006 [US1] Add `Calendar` icon to the existing `lucide-react` import in `frontend/src/pages/Classes.tsx`
- [ ] T007 [US1] Call `useActiveSession()` hook inside the `Classes()` component in `frontend/src/pages/Classes.tsx` — destructure `{ activeSession, isFallback, isLoading: sessionLoading }` at the top of the component body (after existing state declarations)
- [ ] T008 [US1] Replace the existing subtitle `<p>` in the Classes page header (`frontend/src/pages/Classes.tsx`, inside the `<div>` containing the `<h1>`) with a flex container that renders both the subtitle text and the session badge inline; implement three badge states: (a) `sessionLoading` → `<Skeleton className="h-5 w-28" />`, (b) `activeSession` truthy → `<Badge variant="outline" className="text-xs font-normal gap-1" title={isFallback ? "Session derived from legacy settings. Configure in Settings → General." : undefined}><Calendar className="h-3 w-3" />{activeSession}{isFallback && <span className="text-muted-foreground ml-0.5">(fallback)</span>}</Badge>`, (c) fallback → `<Badge variant="secondary" className="text-xs font-normal">— No session configured</Badge>`
- [ ] T009 [US1] Run TypeScript type-check to confirm no type errors: `cd frontend && npx tsc --noEmit`

**Checkpoint**: Classes page shows session badge. Navigate to `/classes`, verify badge renders in all three states (configured / fallback / error) by temporarily modifying tenant settings.

---

## Phase 4: User Story 2 — Migration Uses Current Session as Source and Auto-Derives Target (Priority: P2)

**Goal**: Ensure the Promote Students modal confirms that it is using the correct session (matching the header badge), and disable "Confirm Migration" if no session is resolved.

**Independent Test**: Open "Promote Students" → preview modal title shows `"2025/2026 → 2026/2027"` (matching the badge) → confirm button is enabled; remove `activeAcademicSession` from settings → confirm button is disabled.

### Implementation for User Story 2

- [ ] T010 [US2] Open `frontend/src/components/modals/MigrationPreviewModal.tsx` and locate the `AlertDialogFooter` confirm button's `disabled` prop (currently: `confirming || reconciling || (preview.reconciliationNeeded ?? 0) > 0`); add `|| !preview.academicSession` to the disabled condition to satisfy FR-008 — this blocks migration when the backend returns no session
- [ ] T011 [US2] Verify in `frontend/src/components/modals/MigrationPreviewModal.tsx` that the modal title already renders `{preview.academicSession} → {preview.nextSession}` (line ~204); if the field is absent from the `MigrationPreview` interface declaration at the top of the file, add `academicSession: string` and `nextSession: string` to the interface
- [ ] T012 [US2] Add an inline `Alert` warning to `frontend/src/components/modals/MigrationPreviewModal.tsx` inside the `<div className="space-y-6 py-4">` section (before the reconciliation warning block) that renders only when `!preview.academicSession`: `<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No Active Session</AlertTitle><AlertDescription>No active academic session is configured. Please set one in Settings → General before running a migration.</AlertDescription></Alert>`; import `AlertCircle` from `lucide-react` and `Alert, AlertTitle, AlertDescription` from `@/components/ui/alert` if not already imported
- [ ] T013 [US2] Run TypeScript type-check: `cd frontend && npx tsc --noEmit`

**Checkpoint**: Open migration preview with no `activeAcademicSession` configured → alert is visible, Confirm button is disabled. With session configured → no alert, button enabled, title shows correct session range.

---

## Phase 5: User Story 3 — Session Badge Configure Affordance (Priority: P3)

**Goal**: When session is fallback-derived (not explicitly set), the badge tooltip points users to Settings → General.

**Independent Test**: Remove `activeAcademicSession` from tenant settings (keep `academicYear`) → Classes page badge shows `"2025/2026 (fallback)"` with a tooltip "Session derived from legacy settings. Configure in Settings → General."

### Implementation for User Story 3

- [ ] T014 [US3] Confirm the `title` attribute on the badge in `frontend/src/pages/Classes.tsx` (added in T008) reads `"Session derived from legacy settings. Configure in Settings → General."` when `isFallback === true`; if the tooltip text needs refinement, update the string in the `title` prop of the `<Badge>` element
- [ ] T015 [US3] Verify visually that the `(fallback)` label renders inside the badge when `isFallback === true` and is absent when `isFallback === false`

**Checkpoint**: All three user stories independently functional. Badge renders correctly in all states. Migration modal is session-aware.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T016 [P] Run full frontend lint: `cd frontend && npx eslint src/hooks/useActiveSession.ts src/pages/Classes.tsx src/components/modals/MigrationPreviewModal.tsx`
- [ ] T017 [P] Run TypeScript type-check across the full frontend: `cd frontend && npx tsc --noEmit`
- [ ] T018 Manually verify the session badge appears on mobile viewport (responsive check): open Classes page at ≤640px width and confirm the badge wraps cleanly below the subtitle without breaking layout
- [ ] T019 Manually verify React Query cache sharing: open browser devtools → Network tab → navigate to Classes page → confirm only one `GET /api/settings` request fires (not two), demonstrating cache re-use between `AppHeader` and `useActiveSession`
- [ ] T020 Update `specs/051-class-session-display-migration/checklists/requirements.md` — mark all checklist items complete and add a "Implemented" note

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — verify contracts before writing code
- **Phase 2 (Foundational)**: Depends on Phase 1 — `useActiveSession` hook blocks US1 and US2
- **Phase 3 (US1)**: Depends on Phase 2 — can start immediately after hook is created
- **Phase 4 (US2)**: Depends on Phase 2 — parallelisable with Phase 3 (different files)
- **Phase 5 (US3)**: Depends on Phase 3 (T008 must exist) — tooltip already wired in T008; Phase 5 is verification only
- **Phase 6 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on `useActiveSession` hook (T003). No dependency on US2 or US3.
- **US2 (P2)**: Depends on `useActiveSession` hook (T003) for consistency verification. `MigrationPreviewModal.tsx` changes are fully independent of `Classes.tsx` changes.
- **US3 (P3)**: Depends on T008 (badge render) being complete. Adds no new code — verification only.

### Parallel Opportunities

- T001 and T002 (Phase 1) can run in parallel.
- T004, T005, T006 (Phase 3 imports) can all run in parallel — different parts of the same import block.
- T009 and T010–T012 can run in parallel once T003 is done (different files: `Classes.tsx` vs `MigrationPreviewModal.tsx`).
- T016 and T017 (Phase 6 lint + type-check) can run in parallel.

---

## Parallel Example: US1 + US2 simultaneously (after T003)

```
After T003 (useActiveSession hook) is complete:

  Developer A — Classes.tsx (US1):
    T004 → T005 → T006 → T007 → T008 → T009

  Developer B — MigrationPreviewModal.tsx (US2):
    T010 → T011 → T012 → T013
```

---

## Implementation Strategy

### MVP (User Story 1 Only — 6 tasks)

1. Complete Phase 1 (T001–T002) — 10 min contract verification
2. Complete Phase 2 (T003) — create `useActiveSession` hook
3. Complete Phase 3 (T004–T009) — add badge to Classes page
4. **STOP and VALIDATE**: Navigate to `/classes`, confirm badge shows active session
5. Ship MVP — users can now see the current session at a glance

### Full Delivery (all stories — 20 tasks)

1. MVP (above) → Phase 4 (T010–T013) → Phase 5 (T014–T015) → Phase 6 (T016–T020)
2. Each phase adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no shared in-progress dependencies
- No backend changes, no database migrations, no new API routes
- `queryKey: ['settings']` is intentional — shares cache with `AppHeader`'s existing `api.getSettings()` call
- Total tasks: **20** (2 setup + 1 foundational + 6 US1 + 4 US2 + 2 US3 + 5 polish)
- MVP scope: T001–T009 (9 tasks, US1 complete)
