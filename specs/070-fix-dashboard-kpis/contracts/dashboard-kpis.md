# Contract: Dashboard KPIs Endpoint

**Branch**: `070-fix-dashboard-kpis` | **Date**: 2026-05-11

## Endpoint: `GET /api/dashboard`

No changes to the endpoint signature, auth requirements, or response envelope. Changes are entirely to the **values** returned for specific keys within `data.stats`.

**Auth**: Bearer JWT required (`JWTAuthFilter`)  
**Roles**: `admin`, `bursar`  
**Query param**: `refresh=true` (optional) — triggers re-aggregation before returning

---

## Response Shape (unchanged)

```json
{
  "status": "success",
  "data": {
    "stats": { ... },
    "enrollmentByClass": [ ... ],
    "lastRefresh": "2026-05-11 19:00:00"
  }
}
```

---

## `data.stats` — Changed Field Semantics

Only the fields listed below have changed definitions. All other fields are unchanged.

### Financial Summary

| Field | Old Computation | New Computation |
|-------|----------------|----------------|
| `collectionRate` | All-time payments ÷ all-time charges | Eligible payments in current term ÷ eligible charges in current term × 100 |
| `totalRevenueThisTerm` | All payments in term date range | Eligible payments (by category) in term date range, `fee_campaign_id IS NULL` |
| `paidInFull` | Already term-scoped ✅ | No change |
| `totalOutstanding` | Already all-time, active students ✅ | No change |

When no active term: `collectionRate = 0`, `totalRevenueThisTerm = 0`, `paidInFull = 0`. Frontend detects no-term via `currentTermName = null`.

### Enrolment & Academics

No field semantic changes. Already correct.

### Students & Alerts

| Field | Old Computation | New Computation |
|-------|----------------|----------------|
| `lowAttendanceStudents` | All-time attendance records | Attendance records within current term date range only |
| `highOverdueBalances` | Students with balance > $100 | **Removed from snapshot — no longer in response stats** |

### Staff Overview

| Field | Old Computation | New Computation |
|-------|----------------|----------------|
| `totalStaff` | `COUNT(staff WHERE employment_status='active')` | `COUNT(staff)` — all statuses |
| `nonTeachingStaff` | `totalStaff - teachingStaff` | `COUNT(staff WHERE is_teaching=0)` — all statuses |
| `allActiveStaff` | Same as `totalStaff` (both were active count) | `COUNT(staff WHERE employment_status='active')` — now correctly distinct from `totalStaff` |
| `staffAttendanceRate` | `staffPresentToday ÷ activeStaff × 100` | `staffPresentToday ÷ (allActiveStaff - staffOnLeaveToday) × 100`; `0` when denominator = 0 |
| `teachingStaffWithClasses` | Teaching staff with assigned non-archived class | **Removed from snapshot — no longer in response stats** |

---

## `data.enrollmentByClass` — No Changes

Already returns `classId`, `className`, `total`, `male`, `female`, `other` per class. No changes.

---

## Frontend UI Contract Changes

### KPI Cards Removed

The following cards will no longer render. Their backing data is not removed from `DashboardStats` type (for safety), but will not be displayed:

- **High Overdue Balances** (in `StudentsAlertsSection`)
- **Teaching w/ Active Classes** (in `StaffOverviewSection`)

### Refresh KPIs Button Removed

The `<Button>` labelled "Refresh KPIs" in `Dashboard.tsx` header will be removed. The `POST /api/dashboard/refresh` endpoint is **not** removed.

### Quick Actions Compact

All action buttons change from `size="lg"` to `size="sm"`. The `CardContent` wrapper gets `py-3` padding class.

### Tooltips Added

All KPI cards that do not currently use `MetricTile` (and therefore lack tooltip support) will be updated:

| Component | Cards gaining tooltips |
|-----------|----------------------|
| `StudentsAlertsSection` | Low Attendance, Outstanding Balances, Over-Capacity Classes |
| `StaffOverviewSection` | All 6 remaining cards (Total Staff, Teaching Staff, Non-Teaching Staff, All Active Staff, Staff On Leave Today, Today's Attendance Rate) |
| `TransportOverviewSection` | Active Routes, Students on Transport |

**Tooltip content spec**: Each tooltip must include (a) what the metric measures and (b) its data scope.

| Card | Tooltip text |
|------|-------------|
| Low Attendance | "Students whose attendance rate is below 75% for the current academic term. Requires active term to be configured." |
| Outstanding Balances | "Students who currently owe any positive amount across all terms. Includes all unpaid charges regardless of term." |
| Over-Capacity Classes | "Active classes where the number of enrolled active students exceeds the configured class capacity limit." |
| Total Staff | "All staff records in the system, regardless of employment status. Includes active, inactive, and on-leave staff." |
| Teaching Staff | "Active staff members with a teaching role designation. Excludes administrative and support staff." |
| Non-Teaching Staff | "All staff members with a non-teaching role designation, including admin and support staff regardless of status." |
| All Active Staff | "Staff members currently marked as active employees. Excludes resigned, on-leave, or inactive staff." |
| Staff On Leave Today | "Staff members on approved leave that covers today's date. These staff are expected to be absent." |
| Today's Attendance Rate | "Percentage of active staff (excluding those on approved leave today) who have checked in today." |
| Active Routes | "Transport routes currently marked as active in the system." |
| Students on Transport | "Active students with an active allocation to at least one active transport route." |
