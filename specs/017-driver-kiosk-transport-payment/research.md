# Research: Driver Kiosk Toggle & Transport Payment Indicators

**Branch**: `017-driver-kiosk-transport-payment`  
**Phase**: 0 — Research  
**Date**: 2026-04-07

---

## Decision 1: Driver kiosk toggle location

**Decision**: Add the driver kiosk toggle as a new Card section inside the existing `GeneralSettingsTab.tsx`, following the pattern of the staff kiosk Card (`kioskModeEnabled`) and the student attendance kiosk Card (`studentKioskModeEnabled`) already present in that file.

**Rationale**: The settings page already has two precedent kiosk toggles. The new driver kiosk toggle should be a third Card in the same file using the identical pattern: toggle → URL display (when enabled) → Save button. No new settings tab or sidebar entry is needed; the feature is minor enough to live alongside the existing kiosk cards.

**Alternatives considered**:
- New "Kiosks" sub-route in Settings sidebar — rejected: overkill for three toggles that are all in the same conceptual group; avoids adding a nav entry for a small UI change.
- Moving all three kiosk cards to a dedicated tab — rejected: out of scope for this feature; would require refactoring existing settings UI.

---

## Decision 2: Backend field name for the driver kiosk enabled flag

**Decision**: Add `driverKioskModeEnabled` as a new boolean field in the tenant `settings` JSON column, mirroring the existing `kioskModeEnabled` (staff) and `studentKioskModeEnabled` (student) fields.

**Rationale**: Follows the exact naming convention already in use. The `SettingsController` stores all kiosk flags together in the `settings` JSON blob on the `tenants` table — no schema migration is needed. The field must be added to `DEFAULT_SETTINGS`, `index()`, and `update()` in `SettingsController`.

**Alternatives considered**:
- A separate database column for each kiosk type — rejected: existing flags use the JSON blob; consistency is more valuable than column-level visibility.

---

## Decision 3: Enforcing driver kiosk enabled state at the backend

**Decision**: Update `DriverKioskController::resolveTenant()` to also verify that `driverKioskModeEnabled` is `true` in the tenant settings. If the driver kiosk is disabled, the resolved tenant is returned as `null` (same as an invalid kiosk code), causing all driver kiosk endpoints to return a 404/403.

**Rationale**: The toggle in settings must be enforced at the API layer, not just the frontend. The existing pattern (e.g., `KioskController::status()` checks `kioskModeEnabled`) confirms this is the right approach. Failing to enforce at the backend would make the frontend toggle purely cosmetic.

**Alternatives considered**:
- A dedicated `GET /api/kiosk/driver/status/:code` endpoint that returns `{ kioskEnabled: false }` — considered, but unnecessary complexity. The existing `validate` and `roster` endpoints already gate access; simply returning null from `resolveTenant()` when disabled achieves the same effect with no new routes.

---

## Decision 4: Payment status endpoint — new vs. extended

**Decision**: Add a new method `getRoutePaymentStatus()` to `TransportController`, registered as `GET /transport/routes/:routeId/payment-status?month=YYYY-MM`.

**Rationale**: The existing `reportPaymentStatus()` private method operates across all routes for a report view. The route detail modal needs per-route, per-student status for the current month. Creating a dedicated endpoint keeps concerns separated, is consistent with the existing `getStudentsWithRouteStatus` endpoint pattern, and avoids changing report output shapes.

The query design follows Constitution Principle V: compute payment status using a single LEFT JOIN subquery rather than N per-student queries. Pattern reference: the existing `reportPaymentStatus()` already does this with a `LEFT JOIN charges ch ON ...`.

**Alternatives considered**:
- Enriching the existing `GET /transport/routes/:id` response with payment fields — rejected: changes the shape of a widely-used endpoint; breaks YAGNI since routes list doesn't need payment status.
- Reusing `GET /transport/reports?type=payment_status` filtered to one route — rejected: returns a different data shape; the route ID filter would require modifying an existing endpoint.

---

## Decision 5: Payment status tri-state definition

**Decision**: Map to three states computed from `charges` and `payments` tables:

| State | Condition |
|-------|-----------|
| `paid` | A transport charge exists for the month AND `SUM(payments) >= charge.amount` |
| `unpaid` | A transport charge exists for the month AND `SUM(payments) < charge.amount` |
| `no_charge` | No transport charge record exists for the student/route/month |

**Rationale**: Matches the three states in the spec (FR-007). The existing `charges` table has `student_id`, `route_id`, `charge_type='transport'`, and `academic_session` (YYYY-MM format). The existing `payments` table links to charges via `charge_id`. This mirrors how `LedgerController::getStudentBalance()` computes balance from source records.

**Alternatives considered**:
- Using `charges.status` column directly — rejected after reading the schema: `charges.status` reflects billing lifecycle, not payment status. Payment completeness must be derived from `SUM(payments) vs charge.amount` per Constitution Principle V.

---

## Decision 6: Frontend display for payment status

**Decision**: Display a colored `Badge` component (from shadcn/ui) inline in each student row in `RouteDetailModal`:
- `paid` → green/success badge (`"Paid"`)
- `unpaid` → destructive/red badge (`"Unpaid"`)  
- `no_charge` → muted/outline badge (`"No Charge"`)

The payment status is fetched via a separate React Query call (`useQuery`) triggered when the modal opens (i.e., when `route` is non-null). The existing `students` array from `route.students` is enriched client-side by merging the payment-status response by `studentId`. If the status fetch fails, the badge falls back to a neutral `"Unknown"` state with muted styling — the modal does not show an error.

**Rationale**: `Badge` is already used in the route detail modal and transport page. React Query is the mandatory state mechanism (constitution). Separate fetch keeps the routes list call unchanged.

**Alternatives considered**:
- Embedding payment status in the existing route fetch — rejected (see Decision 4).
- Showing a loading spinner per row while status loads — over-engineered; a single query for the whole route is fast enough to use a card-level loading state.
