# Research: Finance Control Center

**Branch**: `080-finance-control-center`  
**Date**: 2026-05-21

## Decision 1: Reuse the existing finance summary endpoint as the control-center KPI source

**Decision**: Extend the current platform finance summary endpoint rather than introducing a separate KPI service for the finance page.

**Rationale**: The finance page already depends on a single summary call for platform-wide financial health. Keeping net revenue, failed payments, outstanding invoices, growth signals, and operational counters together preserves a single source of truth and avoids duplicated finance logic across multiple endpoints.

**Alternatives considered**:
- Separate KPI endpoint for each card — rejected; unnecessary request fan-out and harder to keep consistent.
- Client-side KPI derivation — rejected; violates backend-driven finance discipline and risks drift.

---

## Decision 2: Keep filtering and export context server-driven

**Decision**: Treat date range and invoice/payment status as backend query parameters that control both the on-screen report and exported files.

**Rationale**: Finance filtering must remain authoritative, especially for operational reporting and audit snapshots. A shared backend filter context guarantees that the displayed figures, chart points, tables, and CSV exports always agree.

**Alternatives considered**:
- Frontend-only filtering — rejected; would require loading too much data and would duplicate reporting logic in the browser.
- Separate endpoints for each filter combination — rejected; too many permutations and inconsistent contract behavior.

---

## Decision 3: Use backend-prepared monthly trend buckets for charts

**Decision**: Return monthly trend buckets from the backend in a chart-friendly shape, then render them with the existing charting library.

**Rationale**: The chart needs explicit month labels, clear axis values, and stable comparisons. Precomputed month buckets keep the frontend thin and make the chart readable without local aggregation or date bucketing logic.

**Alternatives considered**:
- Raw transactions plotted directly in the browser — rejected; too noisy and expensive to group client-side.
- Generic year-to-date totals only — rejected; does not satisfy the need for trend indicators and monthly markers.

---

## Decision 4: Standardize finance formatting helpers

**Decision**: Use a shared formatting approach for currency, percentages, and trend arrows so KPI cards, tables, and reports present values consistently.

**Rationale**: The finance page needs clean readability and clear semantic states. A shared helper prevents card-by-card formatting drift and keeps positive/warning/neutral states visually consistent.

**Alternatives considered**:
- Formatting inline within each component — rejected; harder to maintain and easy to render inconsistently.
- Replacing all values with plain text — rejected; loses the visual clarity needed for a control-center style dashboard.

---

## Decision 5: Export CSV as a filtered snapshot, not a separate report system

**Decision**: Implement export as a snapshot of the currently selected finance context, with CSV as the primary machine-readable format and any human-readable report export derived from the same filtered data.

**Rationale**: Finance users need a snapshot that matches what they are viewing. Keeping exports tied to the selected filters minimizes confusion and ensures exported numbers reconcile with on-screen summaries.

**Alternatives considered**:
- Export unfiltered data only — rejected; not useful for targeted monthly or status-based reviews.
- Build a separate reporting module — rejected; too broad for this feature and would duplicate existing finance reporting behavior.
