# UI Contract: Staff Attendance Summary Table

**Feature**: `033-staff-attendance-summary-columns`

## Desktop Table (AttendanceRecordsTab — Attendance Summary card)

### Column headers (left → right, exact order)

| # | Header text | Alignment | Sortable |
|---|-------------|-----------|----------|
| 1 | Staff Name  | Left      | No       |
| 2 | Present     | Center    | No       |
| 3 | Absent      | Center    | No       |
| 4 | Late        | Center    | No       |
| 5 | Excused     | Center    | No       |
| 6 | Total Days  | Center    | No       |
| 7 | Attendance % | Center   | Yes (click to toggle asc/desc) |

### Row data bindings

| Column | Value |
|--------|-------|
| Staff Name | `summary.staffName` |
| Present | `summary.present` |
| Absent | `summary.absent` |
| Late | `summary.late` |
| Excused | `summary.excused` |
| Total Days | `summary.totalDays` |
| Attendance % | `getPercentageBadge(summary.attendancePercentage)` |

---

## Mobile Card (MobileCard per staff member)

### Fields displayed

| Label | Value binding |
|-------|--------------|
| Present | `summary.present` |
| Absent | `summary.absent` |
| Late | `summary.late` |
| Excused | `summary.excused` |
| Attendance | `getPercentageBadge(summary.attendancePercentage)` |

**"On Leave" label MUST NOT appear** anywhere in the summary section after this change.

---

## Percentage badge colour rules (unchanged)

| Threshold | Badge colour |
|-----------|-------------|
| ≥ 90%     | Green (`bg-green-500`) |
| ≥ 75%     | Yellow (`bg-yellow-500`) |
| < 75%     | Destructive (red) |
