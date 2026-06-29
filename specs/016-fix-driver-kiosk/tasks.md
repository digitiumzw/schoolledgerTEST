# Tasks: Fix Driver Kiosk Bugs and URI Format

**Input**: Design documents from `/specs/016-fix-driver-kiosk/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/frontend-routes.md ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths included in every task description

## Path Conventions

```text
frontend/
├── src/
│   ├── App.tsx
│   └── pages/
│       └── DriverKioskPage.tsx
```

---

## Phase 1: Setup

No project initialization required — this feature modifies two existing files.

---

## Phase 2: Foundational (Blocking Prerequisites)

No foundational infrastructure changes required — the backend API and all shared frontend utilities are unchanged.

**Checkpoint**: All existing kiosk routes continue to work. Implementation of user stories may begin.

---

## Phase 3: User Story 1 — Driver accesses kiosk via consistent URL format (Priority: P1) 🎯 MVP

**Goal**: Change the driver kiosk frontend route from `/kiosk/driver/:code` to `/kiosk/:code/driver` to match the student attendance kiosk URL pattern.

**Independent Test**: Navigate to `/kiosk/VALIDCODE/driver` → driver kiosk loads. Navigate to `/kiosk/driver/VALIDCODE` → 404 page shows.

### Implementation for User Story 1

- [x] T001 [P] [US1] In `frontend/src/App.tsx`, remove the route `<Route path="/kiosk/driver/:code" element={<DriverKioskPage />} />` and add `<Route path="/kiosk/:code/driver" element={<DriverKioskPage />} />` inserted immediately after the `/kiosk/:code/students` route and before the `/kiosk/:code` route, preserving the existing ordering comments.

**Checkpoint**: User Story 1 is complete and independently testable. The old `/kiosk/driver/:code` URL now 404s. The new `/kiosk/:code/driver` URL loads the driver kiosk.

---

## Phase 4: User Story 2 — Driver sees errors when route roster fails to load (Priority: P2)

**Goal**: Add a visible `routeError` state to the routes view so that failures from `handleRouteSelect` are displayed to the driver inline — not silently discarded.

**Independent Test**: Load the routes view with a valid driver session, then simulate a network failure (DevTools → Network → Offline) and tap a route. A clear error message must appear within the routes list panel.

### Implementation for User Story 2

- [x] T002 [US2] In `frontend/src/pages/DriverKioskPage.tsx`, add a `routeError` state variable: `const [routeError, setRouteError] = useState("");` alongside the other state declarations.

- [x] T003 [US2] In `frontend/src/pages/DriverKioskPage.tsx`, update `handleRouteSelect` to: (a) call `setRouteError("")` at the start to clear previous errors, and (b) call `setRouteError((err as Error)?.message || "Unable to load roster")` in the `catch` block instead of `setIdError(...)`.

- [x] T004 [US2] In `frontend/src/pages/DriverKioskPage.tsx`, update `resetToIdle` to include `setRouteError("")` so the error clears when the session resets.

- [x] T005 [US2] In `frontend/src/pages/DriverKioskPage.tsx`, in the routes view JSX (the `view === "routes"` branch), add an inline error banner immediately below the header section and before the routes list or empty state:
  ```tsx
  {routeError && (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {routeError}
    </div>
  )}
  ```

**Checkpoint**: User Story 2 is complete. Route selection errors are now visible in the routes view. User Story 1 continues to work.

---

## Phase 5: User Story 3 — Invalid kiosk code shows error at page load (Priority: P3)

**Goal**: Add a `"loading"` view and an initial kiosk code validation `useEffect` (using the existing `kioskApi.getKioskStatus`) so that invalid codes show an error screen before the employee ID form appears.

**Independent Test**: Navigate to `/kiosk/BADCODE/driver` — the "Kiosk Unavailable" error screen must appear within 5 seconds with no user interaction.

### Implementation for User Story 3

- [x] T006 [US3] In `frontend/src/pages/DriverKioskPage.tsx`, update the `KioskView` type to include `"loading"`: `type KioskView = "loading" | "idle" | "routes" | "roster" | "error";`

- [x] T007 [US3] In `frontend/src/pages/DriverKioskPage.tsx`, add `kioskApi` to the import from `@/api/api` alongside the existing `kioskDriverApi` import.

- [x] T008 [US3] In `frontend/src/pages/DriverKioskPage.tsx`, change the initial `useState` value for `view` from `"idle"` to `"loading"`: `const [view, setView] = useState<KioskView>("loading");`

- [x] T009 [US3] In `frontend/src/pages/DriverKioskPage.tsx`, add a `useEffect` for initial kiosk validation that runs when `code` changes. It must: (a) set `view` to `"error"` with a descriptive message if `code` is absent; (b) call `kioskApi.getKioskStatus(code)` and set `view` to `"error"` if `!data.kioskEnabled`; (c) set `view` to `"idle"` on success; (d) set `view` to `"error"` on exception using the error message. Use a cancellation flag (`let cancelled = false`) to avoid state updates after unmount.

- [x] T010 [US3] In `frontend/src/pages/DriverKioskPage.tsx`, add a loading view render guard before the existing error view guard:
  ```tsx
  if (view === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 px-6">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        <p className="mt-4 text-gray-500 text-lg">Loading kiosk…</p>
      </div>
    );
  }
  ```

**Checkpoint**: All three user stories are complete. Invalid kiosk codes now show an error at load time. User Stories 1 and 2 continue to work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 [P] Run the manual test scenarios from `specs/016-fix-driver-kiosk/quickstart.md` to validate all three user stories end-to-end: (1) new URL `/kiosk/VALIDCODE/driver` loads; (2) old URL `/kiosk/driver/VALIDCODE` returns 404; (3) `/kiosk/BADCODE/driver` shows error on load; (4) network failure on route selection shows inline error.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1–2**: Nothing to do — can start user story phases immediately.
- **Phase 3 (US1)**: No dependencies — modifies `App.tsx` only, independent of all other tasks.
- **Phase 4 (US2)**: No dependencies — modifies `DriverKioskPage.tsx`; can run in parallel with Phase 3.
- **Phase 5 (US3)**: No dependencies — also modifies `DriverKioskPage.tsx`; must complete after Phase 4 if working on the same file sequentially.
- **Phase 6 (Polish)**: Depends on Phases 3, 4, and 5.

### User Story Dependencies

- **US1 (P1)**: Independent — only touches `App.tsx`.
- **US2 (P2)**: Independent — only touches `DriverKioskPage.tsx`.
- **US3 (P3)**: Independent in terms of correctness, but since it modifies the same file as US2, apply after US2 when working sequentially.

### Within Each User Story

- US2: T002 → T003 → T004 → T005 (sequential, same file)
- US3: T006 → T007 → T008 → T009 → T010 (sequential, same file)

### Parallel Opportunities

- T001 (US1, `App.tsx`) can be applied in parallel with T002–T010 (all in `DriverKioskPage.tsx`)

---

## Parallel Example: US1 alongside US2+US3

```text
# These can be applied simultaneously (different files):
Task T001: Update route in frontend/src/App.tsx
Task T002–T010: All DriverKioskPage.tsx changes (US2 then US3, same file)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Apply T001 — route path change in `App.tsx`
2. **VALIDATE**: Old URL 404s, new URL loads the driver kiosk
3. Done — US1 is shippable independently

### Incremental Delivery

1. Apply T001 → validate US1 (URL format)
2. Apply T002–T005 → validate US2 (route error visible)
3. Apply T006–T010 → validate US3 (invalid code detected at load)
4. Apply T011 → run full quickstart validation

---

## Notes

- [P] marks tasks in different files with no inter-task dependencies
- US2 and US3 both modify `DriverKioskPage.tsx` — apply sequentially in the same editing session
- No backend changes, no migrations, no new dependencies
- Commit after each user story phase for clean history
