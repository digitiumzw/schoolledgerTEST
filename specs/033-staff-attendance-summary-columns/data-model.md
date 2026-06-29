# Data Model: Staff Attendance Summary — Aligned Column Format

**Feature**: `033-staff-attendance-summary-columns`  
**Scope**: Client-side shape change only. No database schema change. No migration required.

---

## Affected Shape: Staff Summary Entry

This shape is constructed entirely in the `staffSummaryData` `useMemo` inside
`AttendanceRecordsTab.tsx`. It is never persisted or transmitted over the API.

### Before

```typescript
{
  staffId: string;
  staffName: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;        // ← aggregates on_leave + half_day records
  totalDays: number;
  attendancePercentage: number;
}
```

### After

```typescript
{
  staffId: string;
  staffName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;        // ← same value; renamed to match student summary terminology
  totalDays: number;
  attendancePercentage: number;
}
```

---

## Status → Column Mapping

| Raw attendance status | Summary column |
|-----------------------|----------------|
| `present`             | `present`      |
| `absent`              | `absent`       |
| `late`                | `late`         |
| `on_leave`            | `excused`      |
| `half_day`            | `excused`      |

This mapping is unchanged from the previous implementation — only the destination field name
differs.

---

## Attendance Percentage Formula

```
attendancePercentage = Math.round((present + late) / totalDays * 100)
```

Formula is **not modified** by this feature.

---

## No External Data Model Changes

- No database tables are modified.
- No API request or response payloads are modified.
- No TypeScript interface in `src/types/dashboard.ts` is modified.
  (The summary shape is an inline anonymous object type local to the component.)
