# Quickstart: Staff Attendance Summary — Aligned Column Format

**Feature**: `033-staff-attendance-summary-columns`

## What changes

One file, three edit sites inside `AttendanceRecordsTab.tsx`:

| Site | Location | Change |
|------|----------|--------|
| `summaryMap` initialiser | ~line 166 | `onLeave: 0` → `excused: 0` |
| `switch` increment ×2 | ~lines 192–193 | `entry.onLeave++` → `entry.excused++` (both cases) |
| Desktop `<TableHead>` | ~line 776 | `On Leave` → `Excused` |
| Desktop `<TableCell>` | ~line 800 | `summary.onLeave` → `summary.excused` |
| Mobile card label | ~line 755 | `On Leave` → `Excused` |
| Mobile card value | ~line 757 | `summary.onLeave` → `summary.excused` |

## How to implement

Run `/speckit.tasks` to generate the task list, then `/speckit.implement` to execute.

Or implement manually by following the three tasks in `plan.md § Phase 2`.

## How to verify

1. Start the frontend dev server: `cd frontend && bun run dev` (or `npm run dev`)
2. Navigate to **Staff Attendance → Attendance Records** tab
3. Scroll to the **Attendance Summary** section
4. Confirm the column headers read: Name | Present | Absent | Late | **Excused** | Total Days | Attendance %
5. Confirm staff members with leave/half-day records show a non-zero Excused value
6. Check mobile viewport — summary cards should show "Excused" label
7. Run `bun run build` (or `npm run build`) and confirm TypeScript compiles without errors

## No backend steps required

No migrations, no API changes, no seeder updates needed.
