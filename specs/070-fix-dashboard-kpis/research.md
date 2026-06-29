# Research: Fix Dashboard KPIs & Layout

**Branch**: `070-fix-dashboard-kpis` | **Date**: 2026-05-11

## Key Findings from Codebase Inspection

### 1. Dashboard Architecture

**Decision**: All computation runs inside `DashboardAggregationService::computeMetrics()`, cached in `dashboard_kpi_metrics` table, served via `GET /api/dashboard`. The frontend reads from a single aggregated snapshot via `useDashboardAggregation` hook — no per-section API calls.

**Implication**: All KPI formula corrections go in `DashboardAggregationService.php` only. Frontend section components (`FinancialSection`, `StaffOverviewSection`, etc.) are display-only and read from the `DashboardStats` type already populated from the snapshot.

---

### 2. Financial KPI — Current State vs Required

| KPI | Current Behaviour | Required Behaviour | Fix Location |
|-----|-------------------|-------------------|--------------|
| Total Outstanding | `outstandingPayments()` — sums positive balances of all active students across all time. Already correct. | All-time sum of positive balances, active students only. ✅ No change needed. | — |
| Collection Rate | `paymentCollectionRate()` — **all-time** charges vs **all-time** payments. No eligible-type filter, no term scope. | Payments received **this term** ÷ charges raised **this term** × 100%. | `paymentCollectionRate()` — add term start/end params + eligible type/category filters |
| Paid in Full | `financialStatusCounts()` — uses term-scoped charges vs term-scoped payments. Already correctly term-scoped when a term exists. ✅ | Count of active students with zero balance **this term**. | Verify — already term-scoped. Add no-active-term guard display on frontend. |
| Term Revenue | `paymentsCollected($tenantId, $termStart, $termEnd)` — already term-scoped but **no eligible payment category filter**. | All payments (eligible categories) received within current term date range. | `paymentsCollected()` — add eligible payment category filter |

**Collection Rate fix detail**: Replace `paymentCollectionRate()` to accept `?array $currentTerm` and compute:
```sql
SUM(charges WHERE term_id = currentTerm.id AND eligible types AND not voided/deleted)
vs
SUM(payments WHERE date >= termStart AND date <= termEnd AND eligible categories AND fee_campaign_id IS NULL)
```

---

### 3. Enrolment KPIs — Current State vs Required

| KPI | Current Behaviour | Required |
|-----|-------------------|---------|
| Total Students | `activeStudents()` — `WHERE status='active'`. ✅ | Active only. No change. |
| Total Classes | `classSummary()` — `WHERE archived_at IS NULL`. Missing `status` column check. | Active non-archived. Inspect `classes` table for `status` column. |
| Average Class Size | `round(activeStudents / activeClasses, 1)` — already correct formula. ✅ | Same. No change. |
| On Bursary | `financialStatusCounts()` — `WHERE bursary_status IS NOT NULL AND bursary_status != 'none'`. Already reads `students.bursary_status`. ✅ | Active students with bursary discount. No change. |
| Enrollment by Class | `enrollmentByClass()` — already returns `total`, `male`, `female`, `other` per class with `gender` column. ✅ | Already correct. |

**Classes table**: The `classSummary()` query currently uses only `WHERE archived_at IS NULL`. If a `status` column exists on `classes`, add `AND status = 'active'` guard. Research confirms the `overCapacityClasses()` query also uses only `archived_at IS NULL` — consistent pattern. Add defensive `status` check.

---

### 4. Students & Alerts — Current State vs Required

| KPI | Current | Required |
|-----|---------|---------|
| Low Attendance | `lowAttendanceStudents()` — no term scope; counts all attendance records ever. | Count students below 75% **this term** only. Fix: add `date >= termStart AND date <= termEnd` filter. |
| High Overdue Balances | Present in `StudentsAlertsSection.tsx`. | **Remove entirely** — from both service snapshot list and frontend component. |
| Outstanding Balances | `financial['withOutstanding']` — already counts active students with any positive balance. ✅ | No change. |
| Over-Capacity Classes | Already correct. ✅ | No change. |

---

### 5. Staff Overview — Current State vs Required

| KPI | Current | Required |
|-----|---------|---------|
| Total Staff | `activeStaff()` — `WHERE employment_status='active'`. **Wrong** — spec requires ALL staff regardless of status. | Fix: remove `employment_status` filter. |
| Teaching Staff | `teachingStaff()` — `WHERE is_teaching=true AND employment_status='active'`. ✅ | Active teaching staff only. No change. |
| Non-Teaching Staff | `max(0, totalStaff - teachingStaff)` — currently computed as `activeStaff - teachingStaff`. After fixing Total Staff to all-status, this must be computed independently as non-teaching staff count. | Fix: add `nonTeachingStaff()` method: `WHERE is_teaching=false` (all statuses). |
| All Active Staff | `formatStatsSnapshot()` — `allActiveStaff = totalStaff`. After fix, `totalStaff` will be all-status, so `allActiveStaff` must be computed separately as `activeStaff()`. | Fix: add `all_active_staff` metric key using existing `activeStaff()`. |
| Staff On Leave Today | `staffOnLeaveToday()` — already correct. ✅ | No change. |
| Today's Attendance Rate | `staffAttendanceRate()` — `staffPresentToday / activeStaff`. Missing leave exclusion from denominator. | Fix: denominator = `activeStaff - staffOnLeaveToday`. Return `"N/A"` (or 0 with label override) when denominator = 0. |
| Teaching w/ Active Classes | Present in `StaffOverviewSection.tsx`. | **Remove entirely** — from both service snapshot list and frontend component. |

**Staff roles**: The `staff` table has `is_teaching BOOLEAN` and `employment_status` (values include `'active'`). Confirmed via `teachingStaff()` and `activeStaff()` queries.

---

### 6. UX Changes — Frontend Only

| Change | Location | Approach |
|--------|----------|---------|
| Remove Refresh KPIs button | `Dashboard.tsx` lines 436–439 | Delete the `<Button>` block entirely. Keep `refreshNow`/`isRefreshing` state — not referenced elsewhere but harmless to retain unused. |
| Compact Quick Actions | `QuickActions.tsx` | Change `size="lg"` → `size="sm"` on all buttons; reduce card padding via `py-3` on `CardContent`. |
| Tooltips on every KPI | `StaffOverviewSection.tsx`, `StudentsAlertsSection.tsx`, `TransportOverviewSection.tsx` | `StaffMetricCard` and `AlertCard` components do not use `MetricTile` (which already has `tooltip` prop). Add `tooltip` prop to `StaffMetricCard` and `AlertCard`, render using same shadcn `Tooltip`/`TooltipProvider` pattern. `TransportOverviewSection` uses raw `<Card>` — wrap in `MetricTile`-style tooltip or inline `TooltipProvider`. |

---

### 7. No-Active-Term Guard

When `currentTerm` is `null` (no term configured), term-scoped metrics should display a friendly "No active term" state, not `0` or an error. This is purely a frontend concern:
- `FinancialSection.tsx` already handles `termLabel = null` with a blank suffix — add a explicit `noActiveTerm` flag to `DashboardStats` OR propagate `currentTermName` absence as a guard.
- **Decision**: Reuse existing `currentTermName: string | null` in `DashboardStats`. Frontend shows "No active term" in the description of `collectionRate`, `paidInFull`, and `termRevenue` tiles when `currentTermName` is null. No new backend field needed.

---

### 8. Low Attendance — Term Scoping

The `lowAttendanceStudents()` method uses the `student_attendance_events` or `student_attendance` table. To term-scope it, the current term's `start` and `end` dates need to be passed in. The `computeMetrics()` method already calls `currentTerm()` and stores `termStart`/`termEnd` — just thread them into the `lowAttendanceStudents()` call.

When no active term: return 0 (no term to measure attendance within).

---

### 9. Alternatives Considered

| Decision Point | Chosen | Rejected |
|----------------|--------|---------|
| Collection Rate term scope | Filter charges by `term_id = currentTerm.id`; payments by date range within term | Filter both by date range — rejected because charges don't have a `created_at` that reliably equals billing date; `term_id` is the correct foreign key |
| Staff attendance rate denominator | `activeStaff - staffOnLeaveToday` at compute time | Divide by `activeStaff` alone — rejected per spec requirement |
| Tooltip on non-MetricTile cards | Inline `TooltipProvider` in each card component | Create new shared wrapper component — rejected as over-engineering for ≤4 card components |
| Remove Refresh KPIs | Delete button element only | Remove entire refresh mechanism including backend endpoint — rejected; endpoint kept for programmatic use |
