# Tasks: Driver Kiosk Toggle and Transport Payment Indicators

**Input**: Design documents from `specs/017-driver-kiosk-transport-payment/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths included in all descriptions

## Path Conventions

- Backend: `backend/app/`
- Frontend: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend shared types and API layer — required by both user stories before story work begins.

- [x] T001 [P] Add `driverKioskModeEnabled?: boolean` to `Settings` interface in `frontend/src/types/dashboard.ts`
- [x] T002 [P] Add `paymentStatus?: 'paid' | 'unpaid' | 'no_charge' | 'unknown'` field to `TransportStudent` interface in `frontend/src/types/dashboard.ts`
- [x] T003 [P] Add `RoutePaymentStatusResponse` interface to `frontend/src/api/api.ts` (shape: `{ routeId, month, students: [{ studentId, paymentStatus }] }`)
- [x] T004 Add `getRoutePaymentStatus(routeId: string, month?: string)` function to the `api` object in `frontend/src/api/api.ts` — calls `GET /transport/routes/:routeId/payment-status` (depends on T003)

**Checkpoint**: Shared types and API function ready — both user stories can proceed

---

## Phase 2: User Story 1 — Admin enables driver kiosk from Settings (Priority: P1) 🎯 MVP

**Goal**: Admin can toggle the driver kiosk on/off in Settings and copy the URL `/kiosk/:code/driver`.

**Independent Test**: Navigate to Settings, enable the driver kiosk, verify the URL `http://localhost:8080/kiosk/<code>/driver` appears and is copyable. Open the URL in a new browser tab without a JWT — the driver kiosk loads. Disable the toggle, save, revisit the URL — kiosk responds with unavailable/403.

### Backend — Settings field

- [x] T005 [US1] Add `'driverKioskModeEnabled' => false` to the `DEFAULT_SETTINGS` constant array in `backend/app/Controllers/Api/SettingsController.php`
- [x] T006 [US1] In `SettingsController::index()`, read and return `driverKioskModeEnabled` from the settings JSON (cast to bool), following the same pattern as `kioskModeEnabled` and `studentKioskModeEnabled` — in `backend/app/Controllers/Api/SettingsController.php`
- [x] T007 [US1] In `SettingsController::update()`, accept `driverKioskModeEnabled` from the request body and include it in `$updatedSettings`, following the same pattern as the existing kiosk flags — in `backend/app/Controllers/Api/SettingsController.php`

### Backend — Enforce enabled flag

- [x] T008 [US1] In `DriverKioskController::resolveTenant()`, after fetching the tenant row, decode the `settings` JSON and return `null` if `driverKioskModeEnabled` is falsy — causing all driver kiosk endpoints to return 404/403 when the kiosk is disabled — in `backend/app/Controllers/Api/DriverKioskController.php`

### Frontend — Settings UI

- [x] T009 [US1] In `GeneralSettingsTab.tsx`, add a third kiosk `<Card>` section titled "Driver Kiosk" after the existing "Student Attendance Kiosk" card, using the identical toggle + URL display + Save button pattern; toggle binds to `settings.driverKioskModeEnabled`; URL value: `${window.location.origin}/kiosk/${settings.kioskCode}/driver` — in `frontend/src/components/settings/GeneralSettingsTab.tsx`

**Checkpoint**: Admin can enable/disable the driver kiosk from Settings and copy the URL. Navigating to the URL respects the enabled flag.

---

## Phase 3: User Story 2 — Route students show transport payment status (Priority: P2)

**Goal**: When an admin opens a route detail modal, each student row displays a payment status badge (Paid / Unpaid / No Charge) for the current month.

**Independent Test**: Open the RouteDetailModal for a route that has students. Verify each student row shows a coloured badge. Students with a paid transport charge show a green "Paid" badge; students with an outstanding charge show a red "Unpaid" badge; students with no charge generated show a muted "No Charge" badge. Simulate a failed payment-status fetch (network off) — the modal still renders the student list with a neutral placeholder badge per student.

### Backend — New payment status endpoint

- [x] T010 [US2] Add `getRoutePaymentStatus($routeId)` method to `TransportController` in `backend/app/Controllers/Api/TransportController.php`:
  - Role-gate to `admin`/`super_admin` via `requireRole()`
  - Verify `$routeId` belongs to `$this->getTenantId()` (404 if not found)
  - Accept `month` query param (default: `date('Y-m')`); validate format `YYYY-MM`
  - Single LEFT JOIN subquery: `transport_assignments` → `charges` (type='transport', session=month) → payments subquery grouped by `charge_id`
  - Derive tri-state per student: `no_charge` (no charge row) / `paid` (paid_total >= amount) / `unpaid` (otherwise)
  - Return `{ routeId, month, students: [{ studentId, paymentStatus }] }`

- [x] T011 [US2] Register the new route in `backend/app/Config/Routes.php` — add `$routes->get('transport/routes/(:segment)/payment-status', 'TransportController::getRoutePaymentStatus/$1');` **immediately before** the existing `transport/routes/(:segment)` `getRoute` line to prevent route shadowing

### Frontend — Route detail modal badges

- [x] T012 [US2] In `RouteDetailModal.tsx`, add a `useQuery` call (TanStack React Query) that fetches `api.getRoutePaymentStatus(route.id)` when `open && route !== null`; store the result as a `Map<studentId, paymentStatus>` — in `frontend/src/components/modals/RouteDetailModal.tsx`
- [x] T013 [US2] In `RouteDetailModal.tsx`, render a `<Badge>` in each student row using the payment status map:
  - `paid` → `variant="secondary"` with green text (`text-green-700` or similar)
  - `unpaid` → `variant="destructive"` ("Unpaid")
  - `no_charge` → `variant="outline"` muted ("No Charge")
  - `unknown` (status query loading or errored) → `variant="outline"` muted ("—")
  - While the status query is loading, show a muted skeleton or `"—"` placeholder per row without blocking the modal render
  - in `frontend/src/components/modals/RouteDetailModal.tsx`

**Checkpoint**: Route detail modal shows payment status badges per student. Status fetch failure shows neutral placeholders — the modal never breaks.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final review and consistency checks across both user stories.

- [x] T014 [P] Verify route ordering in `backend/app/Config/Routes.php` — confirm `transport/routes/(:segment)/payment-status` appears before `transport/routes/(:segment)` (no route shadowing)
- [x] T015 [P] Confirm the driver kiosk Card in `GeneralSettingsTab.tsx` matches the visual pattern of the existing two kiosk cards (same spacing, same toggle style, same copy-to-clipboard behaviour)
- [x] T016 Run the quickstart.md testing checklist to validate both user stories end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on T001 (Settings type) from Phase 1 — BLOCKS US1 frontend work
- **Phase 3 (US2)**: Depends on T002, T003, T004 from Phase 1 — BLOCKS US2 frontend work
- **Phase 4 (Polish)**: Depends on Phase 2 and Phase 3 being complete

### User Story Dependencies

- **US1** and **US2** are fully independent — they touch entirely different backend controllers and different frontend components. Both can proceed in parallel after Phase 1 is complete.

### Within Each User Story

- Backend changes (T005–T008 for US1, T010–T011 for US2) have no frontend dependency and can start before Phase 1 completes
- Frontend changes depend on type extensions (T001–T004)
- T013 depends on T012 (badge render requires the query to exist)

### Parallel Opportunities

- T001 and T002 (type extensions in same file, sequential preferred to avoid conflicts)
- T003 and T004 (T004 depends on T003)
- After Phase 1: T005–T009 (US1) and T010–T013 (US2) can proceed in full parallel
- T014 and T015 in Polish phase are independent

---

## Parallel Example: US1 + US2 simultaneously

```
Phase 1 complete →

  Stream A (US1 — Settings toggle):
    T005 → T006 → T007 → T008    (backend, sequential in same file)
    T009                          (frontend settings card)

  Stream B (US2 — Payment status):
    T010                          (backend new method)
    T011                          (backend route registration)
    T012 → T013                   (frontend modal, sequential)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T004)
2. Complete Phase 2 — US1 (T005–T009)
3. **STOP and VALIDATE**: Admin can toggle driver kiosk and use the URL
4. Proceed to Phase 3 (US2) if ready

### Incremental Delivery

1. Phase 1: Types + API function ready
2. Phase 2 (US1): Driver kiosk Settings toggle → testable, deliverable
3. Phase 3 (US2): Route payment status badges → testable, deliverable
4. Phase 4 (Polish): Cross-cut validation

---

## Notes

- No migrations required — `driverKioskModeEnabled` is a new key in the existing `tenants.settings` JSON blob
- Constitution Principle V enforced: payment status uses a single subquery, not N per-student queries (see data-model.md)
- Constitution Principle III: new `getRoutePaymentStatus` endpoint is JWT-gated and role-checked; `DriverKioskController` public exemption is an existing justified exception
- Route registration order in `Routes.php` is critical — new `/payment-status` segment route MUST precede the `(:segment)` wildcard `getRoute` line
