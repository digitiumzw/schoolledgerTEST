# Research: Fix Class Promotion Logic

**Branch**: `005-fix-class-promotion` | **Date**: 2026-04-06

## Root Cause Analysis

### The Bug

`ClassModel::isFinalClass()` and `ClassModel::getNextClass()` both treat `empty(next_class_id)` as the single signal for "no next class". This conflates two distinct states:

| State | `next_class_id` | Intended behaviour | Actual behaviour |
|-------|-----------------|-------------------|-----------------|
| Intentional final class (graduation) | NULL | Graduate students | Graduate ✅ |
| Unconfigured class (no chain set yet) | NULL | Skip with error | Graduate ❌ |
| Normal class with chain | set | Promote | Promote ✅ |

Because `isFinalClass()` returns `true` for any NULL `next_class_id`, the skip branch in `promoteStudentsFromClass()` is unreachable — every NULL class graduates its students.

### Affected Code Paths

| File | Location | Issue |
|------|----------|-------|
| `ClassModel.php` | `isFinalClass()` line 93-101 | Returns `empty(next_class_id)` — true for both final and unconfigured |
| `StudentController.php` | `promoteStudentsFromClass()` line 853-899 | Skip branch never reached due to above |
| `StudentController.php` | `promoteStudent()` line 1519-1525 | Single-student auto-promote: returns "No next class" for final-class student instead of graduating |
| `CompleteDatabaseSeeder.php` | lines 223-235 | Seeds `class_005` with `next_class_id = null` but no way to mark it as final |

---

## Decision Log

### Decision 1: Introduce `is_final_class` boolean column

- **Decision**: Add `is_final_class TINYINT(1) NOT NULL DEFAULT 0` to the `classes` table via a new migration.
- **Rationale**: The cleanest way to separate intent (final vs. unconfigured) without breaking the existing null-FK pattern for `next_class_id`. Avoids adding a sentinel value or repurposing other fields.
- **Alternatives considered**:
  - *Use a separate `class_type` enum ('normal', 'final')*: More expressive but adds more complexity for a single boolean distinction. Rejected — overkill.
  - *Treat `next_class_id = NULL` + no students = unconfigured*: Fragile; new classes have no students. Rejected.
  - *Use a special sentinel UUID for `next_class_id`*: Breaks FK integrity and is confusing. Rejected.

### Decision 2: Update `isFinalClass()` to read the new flag

- **Decision**: Change `ClassModel::isFinalClass()` to `return (bool)($class['is_final_class'] ?? false)` instead of checking `empty(next_class_id)`.
- **Rationale**: All call sites already use this method; a single-line change to the method propagates the fix everywhere without touching callers.
- **Alternatives considered**:
  - *Update all call sites directly*: More risky, more change surface. Rejected.

### Decision 3: Fix single-student `promoteStudent()` to handle final classes

- **Decision**: In `StudentController::promoteStudent()`, check `isFinalClass()` before falling through to the "no next class" error; if the student is in a final class, call `graduateStudent()` instead.
- **Rationale**: The single-student endpoint should be consistent with the bulk endpoint.

### Decision 4: Update `setNextClass()` to accept and persist `is_final_class`

- **Decision**: `ClassController::setNextClass()` will also read an optional `isFinalClass` boolean from the request body and update the field. Setting `nextClassId` to a non-null value will automatically set `is_final_class = false`.
- **Rationale**: Allows the admin to mark a class as final without separately calling another endpoint. Keeps the existing UI workflow in `EditClassModal` minimally changed.

### Decision 5: Update seeder

- **Decision**: In `CompleteDatabaseSeeder`, add a follow-up `UPDATE classes SET is_final_class = 1 WHERE id = 'class_005'` after the phase-2 chain setup.
- **Rationale**: The seeder is the only place test data is established. Without this, the seeded data would still not produce a correct graduation scenario.
- **Note**: The `is_final_class` column cannot be set in the initial `insertBatch` because the column does not exist in the schema at that insertion point — the seeder runs after migrations. Actually the column will exist after the new migration runs, so the `insertBatch` can include `'is_final_class' => 0` (or just rely on the default), and the phase-2 update block should add `is_final_class = 1` for `class_005`.

---

## No Unknowns Remaining

All `NEEDS CLARIFICATION` items from the spec were resolved by reading the codebase:
- "Final class" is definitively identified by adding an explicit flag — no other approach fits the existing schema pattern.
- The seeder fix is straightforward.
- No new API routes are needed.
