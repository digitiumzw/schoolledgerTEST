# Quickstart: Promote Student – Session-Scoped Preview & Filtering

**Feature**: `053-promote-student-session-filter`  
**Branch**: `053-promote-student-session-filter`

---

## What This Feature Does

Adds an academic-session scope filter to the Promote Students feature so that:

1. The **migration preview modal** only counts and lists students actively enrolled in the **current academic session** (e.g. 2026/2027).
2. The **bulk promotion engine** only promotes those same students, ensuring the preview and the actual run are identical in scope.
3. The **modal header** shows a persistent banner confirming the session filter in plain language.

---

## Files Changed

### Backend

| File | Change |
|---|---|
| `backend/app/Models/ClassModel.php` | Add optional `?string $academicSession` param to `getStudentsForPromotion()`; apply `WHERE enrollments.academic_session = ?` when provided |
| `backend/app/Controllers/Api/StudentController.php` | Pass `$academicSession` to every `getStudentsForPromotion()` call in `promote()`, `promotionPreview()`, and `migrationPreview()` |
| `backend/app/Controllers/Api/ClassController.php` | Pass `$academicSession` to `getStudentsForPromotion()` call in `getPromotionPreview()`; resolve session via `AcademicSessionService` |

### Frontend

| File | Change |
|---|---|
| `frontend/src/components/modals/MigrationPreviewModal.tsx` | Add session scope `Alert` banner; update `AlertDialogDescription` text |

### Tests

| File | Change |
|---|---|
| `backend/tests/PromotionSessionFilterTest.php` | New integration test: mixed-session dataset + empty-session dataset |

---

## Running the Feature Locally

1. **Ensure an active academic session is set** for your test tenant (e.g. `2026/2027`) via Settings → General → Active Academic Session.

2. **Seed test data with mixed sessions**:
   - Enroll student A with `academic_session = '2026/2027'` (current session).
   - Enroll student B with `academic_session = '2025/2026'` (prior session).

3. **Open the Classes page** and click **Migrate Students**. In the preview modal you should see:
   - A blue info banner: *"Only students actively enrolled in 2026/2027 will be promoted to 2027/2028."*
   - Student A appears in the migration list; student B does not.

4. **Confirm the migration** and verify:
   - Student A has a new enrollment with `academic_session = '2027/2028'`.
   - Student B is unchanged (`enrollment.academic_session` remains `'2025/2026'`).

---

## Running the Tests

```bash
cd backend
php spark test --filter PromotionSessionFilterTest
```

Expected output:
```
OK (2 tests, N assertions)
```

---

## Constitution Compliance

| Principle | Status |
|---|---|
| I. Multi-tenant isolation | ✅ All queries continue to filter by `tenant_id` |
| II. API-first separation | ✅ Filter logic is backend-only; no DB access from frontend |
| III. JWT auth | ✅ No route changes; existing `JWTAuthFilter` covers all affected routes |
| IV. Immutable migrations | ✅ No schema changes |
| V. Financial ledger integrity | ✅ Not touched |
| VI. REST standards | ✅ No new routes; existing envelope used |
| VII. DRY / maintainability | ✅ Single-method change covers all four callsites |
| VIII. Defensive security | ✅ Session param sourced from `AcademicSessionService`, not user input |
| IX. Error handling | ✅ No new error paths; existing handlers unchanged |
| X. Integration tests | ✅ `PromotionSessionFilterTest` covers happy path + empty set |
| XI. Performance | ✅ One extra indexed `WHERE` clause; no N+1 introduced |
