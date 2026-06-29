# Quickstart: Fix Dashboard KPIs & Layout

**Branch**: `070-fix-dashboard-kpis` | **Date**: 2026-05-11

## Prerequisites

- Backend running at `http://localhost:8080`
- Frontend running at `http://localhost:5173`
- DB migrated (no new migrations for this feature)
- Admin credentials: `admin@greenwood.co.zw` / `12345678`

## Dev Setup

No new dependencies. No migrations to run.

```bash
# Backend (from /backend)
php spark serve --port=8080

# Frontend (from /frontend)
bun run dev
```

## PHP Lint

```bash
php -l backend/app/Services/DashboardAggregationService.php
```

## TypeScript Check

```bash
cd frontend
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

## ESLint (targeted — avoid pre-existing api.ts errors)

```bash
cd frontend
./node_modules/.bin/eslint \
  src/pages/Dashboard.tsx \
  src/components/dashboard/StudentsAlertsSection.tsx \
  src/components/dashboard/StaffOverviewSection.tsx \
  src/components/dashboard/TransportOverviewSection.tsx \
  src/components/dashboard/QuickActions.tsx \
  src/components/dashboard/FinancialSection.tsx
```

---

## Curl Validation

### 1. Login

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')
echo "Token: $TOKEN"
```

### 2. Get Dashboard Snapshot (force refresh)

```bash
curl -s "http://localhost:8080/api/dashboard?refresh=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.stats'
```

**Expected fields to verify:**
- `collectionRate` — should be term-scoped (0–100 float)
- `totalRevenueThisTerm` — should match eligible payments in current term only
- `totalStaff` — should include ALL staff regardless of status
- `allActiveStaff` — should be ≤ `totalStaff`
- `nonTeachingStaff` — should NOT equal `totalStaff - teachingStaff` if non-active non-teaching staff exist
- `staffAttendanceRate` — should exclude on-leave staff from denominator
- `highOverdueBalances` field absent or 0 (key removed from snapshot)
- `teachingStaffWithClasses` field absent or 0 (key removed from snapshot)

### 3. Verify No `high_overdue_balances` in snapshot keys

```bash
curl -s "http://localhost:8080/api/dashboard?refresh=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.stats | has("highOverdueBalances")'
# Acceptable: true (field present but no longer displayed) or false (removed)
# Must verify UI does NOT render the card
```

### 4. No Active Term Guard

```bash
# Temporarily set academic_calendar to empty in DB or use a tenant with no active term
# dashboard stats should return collectionRate=0, totalRevenueThisTerm=0, currentTermName=null
curl -s "http://localhost:8080/api/dashboard" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.stats.currentTermName'
# Expected: null when no term is active
```

### 5. Staff Attendance Rate — Leave Exclusion

```bash
# Record a check-in for a staff member and approve leave for another
# staffAttendanceRate should = checkedIn / (activeStaff - onLeaveToday) * 100
curl -s "http://localhost:8080/api/dashboard?refresh=true" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.stats | {staffAttendanceRate, staffOnLeaveToday, totalStaff, allActiveStaff}'
```

### 6. Tenant Isolation

```bash
TOKEN2=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"OTHER_TENANT_ADMIN@example.com","password":"12345678"}' \
  | jq -r '.data.token')

curl -s "http://localhost:8080/api/dashboard?refresh=true" \
  -H "Authorization: Bearer $TOKEN2" | jq '.data.stats.totalStudents'
# Should return different value from tenant 1
```

### 7. No Auth Guard

```bash
curl -s "http://localhost:8080/api/dashboard" | jq '.status'
# Expected: "error" with 401
```

---

## UI Verification Checklist

After running the frontend:

- [ ] Refresh KPIs button is absent from the dashboard header
- [ ] Quick Actions buttons are visually compact (smaller than before)
- [ ] Hovering any KPI card shows a tooltip with meaningful description
- [ ] High Overdue Balances card is not visible in Students & Alerts section
- [ ] Teaching w/ Active Classes card is not visible in Staff Overview section
- [ ] Collection Rate label shows current term name (e.g., "Collection Rate (Term 2)")
- [ ] When `currentTermName` is null: term-scoped cards show "No active term" in description
- [ ] Staff Overview shows 6 KPI cards (not 7 — Teaching w/ Active Classes removed)
- [ ] Students & Alerts shows 3 KPI cards (not 4 — High Overdue Balances removed)

---

## Validation Results

- [x] PHP lint: PASS
- [x] TypeScript tsc --noEmit: PASS
- [x] ESLint (targeted): PASS
- [x] curl validation: PASS (2026-05-11)
- [ ] UI verification: pending (requires running frontend)
