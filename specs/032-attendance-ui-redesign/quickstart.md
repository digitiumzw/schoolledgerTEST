# Quickstart: Attendance UI Redesign & Staff Attendance Bug Fixes

**Feature**: `032-attendance-ui-redesign`

---

## Prerequisites

- Node.js ≥18
- PHP 8.1+ with Composer (backend)
- MySQL running with `schoolledger` database seeded

---

## Start Dev Environment

```bash
# Terminal 1 — Backend
cd backend
php spark serve

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Frontend: http://localhost:8080  
Login: `admin@greenwood.co.zw` / `1234`

---

## Files Modified by This Feature

```
frontend/src/
├── lib/
│   └── attendanceStateTransitions.ts        ← BUG-001: staffLeave.leaveType
├── pages/
│   └── Attendance.tsx                       ← Student attendance redesign
└── components/staff-attendance/
    ├── DailyAttendanceTab.tsx               ← BUG-003 + UI polish
    ├── AttendanceRecordsTab.tsx             ← UI polish
    └── LeaveManagementTab.tsx               ← BUG-002: loading fix
```

---

## Navigation to Test Pages

| Page | URL |
|------|-----|
| Student Attendance | `/attendance` |
| Staff Attendance — Daily | `/staff-attendance` (default tab) |
| Staff Attendance — Records | `/staff-attendance` → Records tab |
| Staff Attendance — Leave | `/staff-attendance` → Leave Management tab |

---

## Verify Bug Fixes

### BUG-001 (half-day leave)
Requires a `LeaveRequest` record with `leaveType = 'half_day'` for today's date and status `approved`. Create one via the Leave Management tab or directly in the database.

### BUG-002 (loading spinner)
Open the Leave Management tab on a slow connection (DevTools → Network → Slow 3G). The loading spinner should appear while data fetches.

### BUG-003 (work hours in status panel)
1. Go to Settings → configure Staff work hours to something other than 08:30–17:00
2. Go to Staff Attendance → Daily
3. Click a staff member with "Late" status
4. The StatusReasonPanel should show the configured hours, not the default

---

## Build & Lint

```bash
cd frontend
npm run build   # must produce no TypeScript errors
```

---

## Key Implementation Notes

1. **Bug fixes first** — complete Tasks 1.1–1.3 before any UI work. They are independent single-line changes and should be committed separately.
2. **`excusedDays` column** — the data already exists in `attendanceSummary`. Just add the `<TableHead>` and `<TableCell>` and update `colSpan`.
3. **Search debounce** — use the existing `createDebouncedSearch` utility from `staffAttendanceUtils.ts` or a simple `useEffect` + `setTimeout` pattern. Do NOT install a new debounce library.
4. **Sort state** — keep it local to `Attendance.tsx`. No need to persist to URL params.
5. **Kiosk guard** — before opening a PR, run: `git diff --name-only HEAD` and confirm no file path contains `Kiosk` or `kiosk`.
