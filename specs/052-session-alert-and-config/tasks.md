# Tasks: Session Alert and Configuration

**Input**: Design documents from `/specs/052-session-alert-and-config/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks grouped by user story (P1 → P2 → P3). Pure frontend — 3 files modified, no backend changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm branch and shared logic before any story work begins.

- [x] T001 Checkout branch `052-session-alert-and-config` and verify all three target files compile cleanly (`frontend/src/components/settings/GeneralSettingsTab.tsx`, `frontend/src/components/settings/AcademicCalendarTab.tsx`, `frontend/src/pages/Classes.tsx`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared infrastructure is needed — this feature builds entirely on existing utilities. The one shared piece to confirm before any story is that `useQueryClient` can be imported where needed.

- [x] T002 Verify `useQueryClient` from `@tanstack/react-query` is importable in `frontend/src/components/settings/GeneralSettingsTab.tsx` (add import; confirm no build errors — this import is required by US1 and US3)

**Checkpoint**: Import confirmed — all three user story phases can now proceed.

---

## Phase 3: User Story 1 — No-Session Alert with Pre-filled Dropdown in General Settings (Priority: P1) 🎯 MVP

**Goal**: Replace the read-only session field in General Settings with an editable `Select` pre-filled with the recommended session, add a "no session configured" alert, and wire a "Save Session" button.

**Independent Test**: Load General Settings with `activeAcademicSession = null` → alert visible, dropdown pre-filled with `YYYY/YYYY+1`, clicking Save Session persists the value and suppresses the alert on reload.

### Implementation for User Story 1

- [x] T003 [US1] In `frontend/src/components/settings/GeneralSettingsTab.tsx`: add `useQueryClient` to the existing `@tanstack/react-query` import (if not done in T002); add `savingSession` (`boolean`) and `activeSessionValue` (`string`) state variables
- [x] T004 [US1] In `frontend/src/components/settings/GeneralSettingsTab.tsx`: compute `recommendedSession` via `useMemo` as `` `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` `` and add a `useEffect` that syncs `activeSessionValue` from `settings.activeAcademicSession ?? recommendedSession` whenever `settings` changes
- [x] T005 [US1] In `frontend/src/components/settings/GeneralSettingsTab.tsx`: implement `handleSaveSession` async function — calls `api.saveSettings({ ...settings, activeAcademicSession: activeSessionValue === "__none__" ? null : activeSessionValue })`, on success updates local `settings` state, invalidates `['settings']` query via `queryClient`, and shows a success toast; wraps in `try/catch` with a destructive toast on error
- [x] T006 [US1] In `frontend/src/components/settings/GeneralSettingsTab.tsx`: replace the read-only `<Input disabled value={settings.activeAcademicSession ?? "Not set"} />` block (and its surrounding `<div>` with the "Read-only" badge) with a `<Select value={activeSessionValue} onValueChange={setActiveSessionValue}>` containing `sessionOptions` entries plus a `"__none__"` "— Not set" item, and a "Save Session" `<Button>` beneath it (disabled when `savingSession` is true or value matches saved session)
- [x] T007 [US1] In `frontend/src/components/settings/GeneralSettingsTab.tsx`: add a `<Alert variant="destructive">` rendered when `settings && !settings.activeAcademicSession` — positioned in the existing calendar-alerts block, stating no session is configured and prompting the admin to set one using the dropdown below

**Checkpoint**: User Story 1 fully functional. Admin can set session from General Settings without visiting Academic Calendar tab.

---

## Phase 4: User Story 2 — Recommended Session Default in Academic Calendar Tab (Priority: P2)

**Goal**: When no session is saved, the session dropdown in the Academic Calendar tab pre-selects the recommended session instead of "— Not set".

**Independent Test**: Navigate to Academic Calendar tab with `activeAcademicSession = null` → session dropdown shows `YYYY/YYYY+1` (not "— Not set"). Clicking Save Session persists the recommended session.

### Implementation for User Story 2

- [x] T008 [P] [US2] In `frontend/src/components/settings/AcademicCalendarTab.tsx`: compute `recommendedSession` via `useMemo` as `` `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` ``
- [x] T009 [US2] In `frontend/src/components/settings/AcademicCalendarTab.tsx`: in `loadCalendar()`, change the `setSelectedSession` fallback from `settingsData.activeAcademicSession ?? "__none__"` to `settingsData.activeAcademicSession ?? recommendedSession`

**Checkpoint**: User Story 2 complete. Academic Calendar tab now shows the recommended session by default when none is configured.

---

## Phase 5: User Story 3 — Class Promotion Blocked with In-context Session Alert (Priority: P3)

**Goal**: Embed an inline session selector (pre-filled dropdown + "Set Session" button) inside the existing "No active session" alert on the Classes page so admins can fix the missing session without navigating away. After saving, the alert dismisses and Promote Students becomes active — no page reload.

**Independent Test**: Visit Classes page with no session set → alert contains a session dropdown pre-filled with `YYYY/YYYY+1` and a "Set Session" button → select a session and click "Set Session" → alert disappears, session badge updates, Promote Students button is clickable.

### Implementation for User Story 3

- [x] T010 [P] [US3] In `frontend/src/pages/Classes.tsx`: add `useQueryClient` to the existing `@tanstack/react-query` import; add `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` to the shadcn/ui imports; add `Label` from `@/components/ui/label`
- [x] T011 [US3] In `frontend/src/pages/Classes.tsx`: compute `recommendedSession` and `inlineSessionOptions` via `useMemo` (same `[-2, -1, 0, 1, 2, 3]` offset pattern used in the settings tabs); add `inlineSession` (`string`) and `savingInlineSession` (`boolean`) state variables; add a `useEffect` that syncs `inlineSession` from `activeSession ?? recommendedSession` when `activeSession` changes
- [x] T012 [US3] In `frontend/src/pages/Classes.tsx`: implement `handleSetInlineSession` async function — fetches current settings via `api.getSettings()`, calls `api.saveSettings({ ...currentSettings, activeAcademicSession: inlineSession })`, on success invalidates `['settings']` query via `queryClient` and shows a success toast; wraps in `try/catch` with a destructive toast on error; uses `savingInlineSession` for loading state
- [x] T013 [US3] In `frontend/src/pages/Classes.tsx`: extend the existing "No active session" `<Alert>` body — beneath the existing `<span>` description, add a `flex-wrap` row containing the `<Select>` dropdown (bound to `inlineSession` / `setInlineSession`, options from `inlineSessionOptions`) and a "Set Session" `<Button>` (calls `handleSetInlineSession`, disabled while `savingInlineSession`)

**Checkpoint**: User Story 3 complete. All three session-configuration surfaces are consistent and functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency pass across all three changed files.

- [x] T014 [P] Verify all three files (`GeneralSettingsTab.tsx`, `AcademicCalendarTab.tsx`, `Classes.tsx`) produce no TypeScript errors (`cd frontend && npx tsc --noEmit`)
- [x] T015 [P] Confirm `sessionOptions` / `inlineSessionOptions` arrays in all three components use the same `[-2, -1, 0, 1, 2, 3]` offset range — refactor to a shared helper in `frontend/src/utils/academicCalendar.ts` if duplication is unacceptable (Principle VII)
- [x] T016 Run all 7 manual verification steps from `specs/052-session-alert-and-config/quickstart.md` against a local dev server and confirm each passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS story phases
- **US1 (Phase 3)**: Depends on Phase 2; `GeneralSettingsTab.tsx` only
- **US2 (Phase 4)**: Depends on Phase 2; `AcademicCalendarTab.tsx` only — **independent of US1**
- **US3 (Phase 5)**: Depends on Phase 2; `Classes.tsx` only — **independent of US1 and US2**
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 or US3 — fully independent file
- **US2 (P2)**: No dependency on US1 or US3 — fully independent file
- **US3 (P3)**: No dependency on US1 or US2 — fully independent file; shares the same React Query `['settings']` invalidation pattern confirmed in research

### Within Each User Story

- State variables (T003, T011) before derived logic (T004)
- Derived logic / `useMemo` before save handler (T005, T012)
- Save handler before UI wiring (T006, T007, T013)

### Parallel Opportunities

- T008 (US2 `recommendedSession` useMemo) can be done in parallel with any US1 task — different file
- T010 (US3 imports) can be done in parallel with any US1 or US2 task — different file
- US2 and US3 phases can be worked in parallel by two developers once Phase 2 is done
- T014 and T015 (Polish) can run in parallel

---

## Parallel Example: US2 + US3 after US1

```text
# After completing US1 (Phase 3), two devs can work simultaneously:

Dev A — Phase 4 (AcademicCalendarTab.tsx):
  T008: Add recommendedSession useMemo
  T009: Change selectedSession fallback

Dev B — Phase 5 (Classes.tsx):
  T010: Add imports
  T011: Add state + useMemo + useEffect
  T012: Implement handleSetInlineSession
  T013: Extend Alert body with inline selector
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003–T007)
4. **STOP and VALIDATE**: Load General Settings with no session — confirm alert + pre-filled dropdown + save works
5. Deploy/demo if ready

### Incremental Delivery

1. T001–T002 → branch confirmed
2. T003–T007 → US1 done → General Settings fully functional (MVP)
3. T008–T009 → US2 done → Academic Calendar tab shows recommended default
4. T010–T013 → US3 done → Classes inline session fixer live
5. T014–T016 → Polish → all verification steps pass

### Parallel Team Strategy

With two developers after Phase 2:
- Developer A: Phase 3 (US1 — `GeneralSettingsTab.tsx`)
- Developer B: Phase 4 + 5 (US2 + US3 — `AcademicCalendarTab.tsx` + `Classes.tsx`)

---

## Notes

- [P] tasks = different files, no shared-state dependencies
- No backend tasks — `PUT /api/settings` is unchanged
- `recommendedSession` = `` `${year}/${year+1}` `` — consider extracting to `frontend/src/utils/academicCalendar.ts` in T015 if the 3-file duplication is flagged during review
- Cache invalidation key is `['settings']` (confirmed from `useActiveSession` hook — `src/hooks/useActiveSession.ts`)
- Verify tests fail before implementing (N/A here — no automated tests added; manual verification via quickstart.md)
- Commit after each user story checkpoint
