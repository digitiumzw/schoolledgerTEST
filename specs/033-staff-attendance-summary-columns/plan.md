# Implementation Plan: Staff Attendance Summary — Aligned Column Format

**Branch**: `033-staff-attendance-summary-columns` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)  
**Scope**: Frontend only — single file, two localised changes.

## Summary

The staff attendance summary in `AttendanceRecordsTab.tsx` currently renders an "On Leave" column where the student summary renders "Excused". This plan aligns the two by:
1. Renaming the `onLeave` field in the summary data map to `excused`.
2. Updating the desktop table header and mobile card label from "On Leave" to "Excused".

The aggregation logic (grouping `on_leave` + `half_day` statuses) stays identical — only the internal field name and display label change.

---

## Technical Context

| Item | Detail |
|------|--------|
| Language | TypeScript (React 18, Vite) |
| UI library | shadcn/ui + TailwindCSS |
| State / data | `useMemo` aggregation — client-side only, no API changes |
| Modified files | 1 (`frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`) |
| Backend changes | None |
| Migration needed | No |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ Pass | No data queries modified |
| II. API-First Separation | ✅ Pass | Frontend-only display change; no backend logic added |
| III. JWT / Role-Based Access | ✅ Pass | No route or auth changes |
| IV. Immutable Migrations | ✅ Pass | No schema changes |
| V. Financial Ledger Integrity | ✅ Pass | Attendance, not ledger |

No violations — Complexity Tracking table not required.

---

## Project Structure

### Documentation (this feature)

```text
specs/033-staff-attendance-summary-columns/
├── plan.md              ← this file
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             ← /speckit.tasks output (not yet created)
```

### Source Code (affected file only)

```text
frontend/src/components/staff-attendance/
└── AttendanceRecordsTab.tsx   ← sole file modified
```

---

## Phase 0: Research

No unknowns exist. All decisions are resolved from codebase inspection:

- **Status mapping confirmed**: `on_leave` and `half_day` both increment the `onLeave` counter today (lines 192–193 of `AttendanceRecordsTab.tsx`). Both will increment `excused` after this change.
- **Attendance % formula confirmed**: `(present + late) / totalDays * 100` — not touched.
- **No backend API change required**: aggregation is purely client-side in the `staffSummaryData` `useMemo`.
- **Mobile card confirmed affected**: the `MobileCard` render block (desktop `isMobile` branch) uses the `summary.onLeave` field with the label "On Leave" — both the field reference and label need updating.

*No `research.md` generated — no NEEDS CLARIFICATION items existed.*

---

## Phase 1: Design & Contracts

### Data Model

The internal summary entry shape changes from:

```typescript
{ staffId, staffName, present, absent, late, onLeave, totalDays, attendancePercentage }
```

to:

```typescript
{ staffId, staffName, present, absent, late, excused, totalDays, attendancePercentage }
```

The `excused` field carries the same value as `onLeave` did: the count of `on_leave` + `half_day` records in the period.

### Contracts

No external API surface changes. This is a purely internal UI display change. The REST API responses are not modified.

### Interface Changes (UI)

| Location | Before | After |
|----------|--------|-------|
| Desktop `<TableHead>` | `On Leave` | `Excused` |
| Desktop `<TableCell>` data | `summary.onLeave` | `summary.excused` |
| Mobile card label | `On Leave` | `Excused` |
| Mobile card value | `summary.onLeave` | `summary.excused` |
| `summaryMap` field init | `onLeave: 0` | `excused: 0` |
| `case 'on_leave'` increment | `entry.onLeave++` | `entry.excused++` |
| `case 'half_day'` increment | `entry.onLeave++` | `entry.excused++` |

---

## Phase 2: Implementation Tasks

### Task 1 — Rename `onLeave` → `excused` in `staffSummaryData` useMemo

**File**: `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

**Changes** (lines ~166–203):
- In the `summaryMap` type annotation and `set()` call: rename `onLeave: number` → `excused: number` and `onLeave: 0` → `excused: 0`.
- In the `switch (record.status)` block: change both `case 'on_leave': entry.onLeave++` and `case 'half_day': entry.onLeave++` to `entry.excused++`.

**Risk**: Minimal. The aggregation value is unchanged — only the property name differs.

---

### Task 2 — Update desktop table header and row cells

**File**: `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

**Changes** (lines ~776 and ~800):
- `<TableHead className="text-center">On Leave</TableHead>` → `Excused`
- `<TableCell className="text-center">{summary.onLeave}</TableCell>` → `{summary.excused}`

---

### Task 3 — Update mobile summary card label and value

**File**: `frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx`

**Changes** (lines ~754–758):
- Mobile card `<p className="text-muted-foreground">On Leave</p>` → `Excused`
- Mobile card `<p className="font-medium">{summary.onLeave}</p>` → `{summary.excused}`

---

## Phase 3: Verification Checklist

After implementation, verify:

- [ ] Desktop summary table header reads: Name | Present | Absent | Late | **Excused** | Total Days | Attendance %
- [ ] Staff member with `on_leave` records: their Excused count equals their previous "On Leave" count
- [ ] Staff member with `half_day` records: their Excused count includes those records
- [ ] Staff member with no leave/half-day records: Excused shows 0
- [ ] Attendance % values are unchanged after the rename
- [ ] Date filters, name search, and sort-by-percentage still work
- [ ] Mobile card shows "Excused" label with correct count
- [ ] TypeScript compiles: `npm run build` passes without errors
- [ ] No regressions in other summary fields (Present, Absent, Late, Total Days)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TypeScript type error on `summary.onLeave` references missed | Low | Build fails | Rename all 3 usage sites atomically |
| `filteredSummaryData` or sort comparator references old field | None | None | Neither references `onLeave` — they use `attendancePercentage` |
| Mobile card layout broken by label length change | None | None | "Excused" is same character count as "On Leave" |
