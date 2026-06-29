# Research: Promote Student – Session-Scoped Preview & Filtering

**Feature**: `053-promote-student-session-filter`  
**Date**: 2026-04-29

---

## Decision 1: Where does the session filter live?

**Decision**: Add an optional `?string $academicSession = null` parameter to `ClassModel::getStudentsForPromotion()`. When provided, an additional `WHERE enrollments.academic_session = ?` clause is appended to the existing query.

**Rationale**: All four call-sites (`StudentController::promote`, `StudentController::promotionPreview`, `StudentController::migrationPreview`, and `ClassController::getPromotionPreview`) already pass through `getStudentsForPromotion`. Fixing the filter in one method covers all paths with the smallest diff and zero duplication, satisfying Principle VII (DRY).

**Alternatives considered**:
- Adding the filter in each controller separately — rejected: four-way duplication, easy to miss a callsite in future refactors.
- A new dedicated method `getStudentsForPromotionBySession` — rejected: identical query with one extra `WHERE` clause doesn't warrant a separate method; optional param is cleaner.

---

## Decision 2: How does `academicSession` reach `getStudentsForPromotion`?

**Decision**: All four callers already resolve the current academic session via `AcademicSessionService::getCurrentSession($tenantId)` or receive it as request input. The resolved `$academicSession` string is simply threaded down into the model call. No new service calls are needed.

**Rationale**: `AcademicSessionService` is the established single source of truth. Both `StudentController` and `ClassController` already hold `$academicSession` in local scope at the point they call `getStudentsForPromotion`. The change is a one-line addition at each callsite.

---

## Decision 3: What should the migration preview modal say, and where exactly?

**Decision**: Add a session-scope `Alert` (info variant) immediately below the `AlertDialogDescription`, above all other content. Text: `"Only students actively enrolled in [currentSession] will be promoted to [nextSession]."` This replaces the vague existing description on its own.

**Rationale**: The modal's `AlertDialogDescription` currently says "This action will promote students to their next academic session" — it does not name the session or state the enrollment filter. An `Alert` block is visually distinct and consistent with the rest of the modal's warning patterns (drift banner, no-next-class banner). It uses the existing `Alert`/`AlertDescription` shadcn/ui components already imported in the file; no new dependencies.

**Alternatives considered**:
- Modifying only the `AlertDialogDescription` text inline — rejected: too subtle, gets lost in grey description text.
- Adding a badge next to the title — rejected: too compact to convey the filtering rule clearly.

---

## Decision 4: Session-excluded students vs. "skipped" counter

**Decision**: Students excluded solely because their enrollment's `academic_session` does not match the current session are **not counted in `skipped`**. They silently fall out of the eligible set before any class processing loop runs. The `migrationPreview` response already returns only matched students, so the front-end total is naturally correct.

**Rationale**: The `skipped` counter has an established meaning in the codebase: students who could not be promoted due to a missing `next_class_id` configuration. Mixing in session-excluded students would confuse admins. Because the fix is at the query level, session-excluded students simply aren't in the dataset at all — no new counter field is needed.

**Alternatives considered**:
- Adding a `sessionExcludedCount` field — considered and deferred: the preview banner ("only enrolled-in-session students shown") makes the scope self-evident without an extra number, and the spec does not mandate surfacing the excluded count as a number.

---

## Decision 5: Callers that pass explicit `studentIds` (manual single-student promote)

**Decision**: `POST /api/students/:id/promote` (individual student promote) is **not changed**. It already validates `student.status === 'active'` and operates on a single specified student. Applying a session filter here would break legitimate use-cases where an admin manually promotes a student who is on a different session by design (e.g. a transfer). Bulk promotion and preview are the scope of this feature.

**Rationale**: The spec explicitly targets the bulk migration preview and the bulk promote endpoint. Individual promotes are intentional administrative overrides and must remain session-agnostic.

---

## Decision 6: No schema migration needed

**Decision**: No database migration required. The `enrollments.academic_session` column already exists and is populated on every enrollment record. The fix is purely at the query layer.

**Rationale**: `ClassModel::getStudentsForPromotion` already joins the `enrollments` table on `students.current_enrollment_id = enrollments.id`. Adding `WHERE enrollments.academic_session = ?` is a filter on an existing column.

---

## Decision 7: Integration test strategy

**Decision**: Add a test class `PromotionSessionFilterTest` in `backend/tests/`. Two test scenarios:
1. Mixed dataset (students enrolled in current session and a prior session): assert only current-session students appear in the `migrationPreview` response and are promoted.
2. Empty current-session dataset: assert `promoted: 0` and preview `totalStudents: 0`.

These cover the happy path and the zero-eligible edge case, satisfying Principle X.

**Rationale**: The existing test suite in `backend/tests/` provides the scaffolding. No new test framework is introduced.
