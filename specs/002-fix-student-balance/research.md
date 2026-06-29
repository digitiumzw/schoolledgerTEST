# Research: Fix Student Balance & KPI Accuracy

## Root Cause Analysis

### Finding 1: Balance formula omits approved ledger adjustments

**Decision**: Extend the `getFilteredStudents()` SQL balance expression to include two additional LEFT JOINs for approved `ledger_adjustments` — one for debit adjustments (increase balance) and one for credit adjustments (reduce balance).

**Evidence**: The single-student `getLedgerBalance()` method and the batch `preloadLedgerBalances()` method both already use the full formula:

```
Balance = COALESCE(charges.total, 0)
        + COALESCE(debits.total, 0)
        - COALESCE(payments.total, 0)
        - COALESCE(credits.total, 0)
```

The paginated `getFilteredStudents()` SQL query only uses charges and payments. The same gap exists in the `balanceOnly=true` branch of `getFilteredStudentsCount()`.

**Rationale**: The full formula is already established and proven in the model. The fix is to apply the same pattern to the single SQL query that drives the Students table balance column.

**Alternatives considered**: 
- Computing balance in PHP after fetching paginated rows — rejected because it would cause an N+1 query per student, violating Constitution Principle V.
- Adding a stored balance column — rejected because Constitution Principle V explicitly forbids mutable stored balances.

---

### Finding 2: KPI stats calculated from paginated data only

**Decision**: Add a new `getGlobalStats(string $tenantId): array` method to `StudentModel`. This method executes a single nested-subquery SQL statement that computes all KPI values across the **full tenant population**, unaffected by pagination or active filters. `StudentsOptimizedController` replaces the current `calculateStudentStats($formattedStudents)` call (which operates on the current page only) with a call to `getGlobalStats()`.

**Evidence**: `StudentsOptimizedController::index()` calls `calculateStudentStats($formattedStudents)` at line 69, where `$formattedStudents` is the paginated result (up to 50 students). With 200 active students across 4 pages, every KPI metric is currently understated by a factor of ~4.

**Rationale**: The subquery approach is the established pattern in this codebase (referenced in Constitution Principle V as `getAllBalances()`). A single nested query computes all KPI fields in one round-trip, respecting both the performance constraint and the tenant-isolation requirement.

**Alternatives considered**:
- Running separate COUNT queries per KPI field — rejected because it would require 4–5 queries instead of 1.
- Computing stats from `$formattedStudents` after removing pagination — rejected because it would require loading all students into PHP memory, defeating the pagination optimization.

---

### Finding 3: On Financial Aid KPI shows percentage, spec requires count

**Decision**: Add `studentsOnFinancialAid` (integer count) to the stats API response. Update the frontend "On Financial Aid" card to display the count as the primary number and show the percentage as secondary text. The percentage is derived as `studentsOnFinancialAid / statusCounts.active * 100`.

**Evidence**: Frontend currently displays `stats.bursaryCoveragePercentage` (e.g., "30%") as the headline metric. The specification requires the count of students on financial aid (FR-010). The existing `bursaryCoveragePercentage` field also becomes inaccurate once the stats are paginated — it needs to reflect the full population too.

**Rationale**: Adding a count field is additive and backwards-compatible. The percentage can be computed on the frontend from `studentsOnFinancialAid / statusCounts.active` so no separate field is needed.

**Alternatives considered**:
- Keeping percentage as headline and adding count as sub-text only — rejected because the spec explicitly requires count as the primary display value (FR-010).
- Removing `bursaryCoveragePercentage` from the API — rejected to avoid breaking other consumers; it will remain but computed from full population.

---

### Finding 4: `getFilteredStudentsCount()` balance check also needs updating

**Decision**: The `balanceOnly=true` branch of `getFilteredStudentsCount()` builds a raw SQL string with the simplified balance formula. This inner query must also include the adjustment subqueries so that the paginator's total count matches the corrected balance formula used in `getFilteredStudents()`.

**Evidence**: If `getFilteredStudents()` returns students based on the corrected balance (including adjustments) but `getFilteredStudentsCount()` uses the old formula, the pagination total count will diverge from the actual results, causing pagination to display incorrect page counts.

**Rationale**: Consistency between the data query and the count query is required for correct pagination.

---

## Summary Decision Table

| Issue | Root Location | Fix |
|-------|---------------|-----|
| Balance misses adjustments in Students table | `StudentModel::getFilteredStudents()` SQL | Add debit/credit adjustment LEFT JOINs to SELECT |
| Balance count query inconsistent | `StudentModel::getFilteredStudentsCount()` `balanceOnly` branch | Update inner SQL to include adjustment subqueries |
| KPI stats from paginated data | `StudentsOptimizedController::calculateStudentStats()` | Replace with `StudentModel::getGlobalStats()` returning full-population stats |
| On Financial Aid shows % not count | `Students.tsx` KPI card + API response | Add `studentsOnFinancialAid` count to stats; update card display |
