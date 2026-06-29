# Quickstart: Fix Student Balance & KPI Accuracy

## What changed

Two backend bugs are fixed and one frontend card is updated:

1. **Balance formula** — the Students table balance column now includes approved ledger adjustments (debits and credits) in addition to charges and payments.
2. **KPI stats** — all summary cards (Active Students, Owing Fees, Total Fees Owed, On Financial Aid) now reflect the full tenant population, not just the students on the currently visible page.
3. **On Financial Aid card** — now shows a student count as the primary value instead of a percentage.

## Verifying the fix

### Balance column
1. Open the Students page.
2. Pick any student who has both payments and ledger adjustments in the database.
3. Manually compute: `SUM(active charges) + SUM(approved debit adjustments) - SUM(payments) - SUM(approved credit adjustments)`.
4. The balance column must match exactly.

### KPI cards (pagination test)
1. Ensure your test tenant has more than one page of students (e.g., > 10 with default page size).
2. Open the Students page — note the KPI values on page 1.
3. Navigate to page 2.
4. Confirm the KPI values are identical to page 1 (they reflect all students, not just the current page).

### On Financial Aid
1. Count students in the database where `bursary_status != 'none'`.
2. Confirm the "On Financial Aid" card shows that count as the headline number.

## Files changed

| Layer | File | Change |
|-------|------|--------|
| Backend model | `backend/app/Models/StudentModel.php` | Updated `getFilteredStudents()` balance SELECT; updated `getFilteredStudentsCount()` balanceOnly SQL; added `getGlobalStats()` |
| Backend controller | `backend/app/Controllers/Api/StudentsOptimizedController.php` | Replaced `calculateStudentStats()` call with `getGlobalStats()`; removed private `calculateStudentStats()` method |
| Frontend page | `frontend/src/pages/Students.tsx` | Updated "On Financial Aid" KPI card to show `studentsOnFinancialAid` count as headline |

## No migrations needed

No schema changes. No seeder changes required.

## Dev credentials

Backend: `admin@greenwood.co.zw` / `1234`  
Backend dev server: `php spark serve` (port 8080)  
Frontend dev server: `npm run dev` (port 8080, configured in `vite.config.ts`)
