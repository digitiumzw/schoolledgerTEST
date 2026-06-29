# Quickstart: Testing Staff Attendance Date Filters

**Branch**: `018-staff-attendance-date-filters`

## Prerequisites

- Dev server running: `npm run dev` (frontend) + `php spark serve` (backend)
- Logged in as `admin@greenwood.co.zw` / `1234`
- At least a few weeks of staff attendance data seeded (run `php spark db:seed CompleteDatabaseSeeder` if needed)

---

## Test 1: Preset filter — This Month

1. Navigate to **Staff Attendance → Records** tab.
2. Find the **Date Range** dropdown (next to the Status filter). Default is "All".
3. Select **"This Month"**.
4. Verify: all visible records have dates within the current calendar month.
5. Check the pagination summary at the bottom — the count should reflect only this month's records.

---

## Test 2: Preset filter — Last 7 Days

1. Select **"Last 7 Days"** from the Date Range dropdown.
2. Verify: only records from the past 7 days appear.

---

## Test 3: Custom range

1. Select **"Custom Range"** from the Date Range dropdown.
2. Two date pickers appear (Start date, End date).
3. Pick a start date two weeks ago and an end date one week ago.
4. Verify: table shows only records within that window.

---

## Test 4: Invalid custom range (start after end)

1. Select **"Custom Range"**.
2. Pick a start date *after* the end date.
3. Verify: an inline validation message appears and the table is not filtered (all records still show, or previous valid filter state is preserved).

---

## Test 5: Combined filters

1. Select **"This Month"** from Date Range.
2. Type a staff member's name in the search box.
3. Select **"Absent"** from the Status filter.
4. Verify: only records that match *all three* conditions simultaneously are shown.

---

## Test 6: Pagination resets on filter change

1. Navigate to page 2 of records.
2. Change the Date Range filter to "Last 7 Days".
3. Verify: pagination resets to page 1.

---

## Test 7: Mobile layout

1. Resize browser to mobile width (< 640px) or use device emulation.
2. Verify: the Date Range filter is visible and stacks vertically with the other filters.
3. Run Tests 1–3 on mobile; verify correct results.

---

## Test 8: "All" restores full list

1. Apply any date filter.
2. Select **"All"** from the Date Range dropdown.
3. Verify: all records return and the record count matches the total before any filter was applied.
