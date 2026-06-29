# Research: Academic Year Auto-Prefill (050)

**Phase 0 output for `/speckit.plan`**

---

## 1. How the Existing Academic Year / Term Model Works

**Decision**: The current system does NOT have a dedicated `academic_years` table. Academic years are represented as:

1. **A free-text string** (`academic_year` column, e.g. `"2025/2026"`) on `class_instances` and `enrollments`.
2. **A legacy string** (`academic_session`) on `enrollments` (same value, kept for backward compat).
3. **A term-based calendar** stored as a JSON blob in `tenants.academic_calendar` — managed by `AcademicCalendarService`. This tracks terms (start/end dates) within a year, NOT distinct academic year records.
4. **A simple year scalar** (`settings.academicYear`) stored in `tenants.settings` JSON — a single year value (e.g. `"2025"`), not a range.

**Rationale**: The spec assumed a normalised `academic_years` table with `start_date`/`end_date` — this table does NOT exist. The prefill logic must instead:
- Derive the current academic year string from the **term calendar** (current term's year range).
- OR read `settings.academicYear` as a simpler fallback.
- Parse/derive the next year string arithmetically from the current one.

**Alternatives considered**:
- *Create a new `academic_years` table*: Adds schema migration complexity; the spec's Assumptions section explicitly says "existing academic year management system already persists `start_date` and `end_date`" — this is aspirational, not the current state. Given this is a UX-focused feature, adding a new table is out of scope; simpler derivation is sufficient.
- *Use the term calendar's date ranges to detect current year*: The `AcademicCalendarService::getCurrentTerm()` method already does date-based detection on term records inside `tenants.academic_calendar`. The academic year string can be derived from any term's `start` date (e.g. term start 2025-09-01 → year "2025/2026").

---

## 2. How to Derive "Current Academic Year" Without a Dedicated Table

**Decision**: Server-side derivation using the existing tenant calendar + settings:

**Algorithm** (implemented in a new `AcademicYearPrefillService`):

```
1. Read tenants.academic_calendar (JSON) for the requesting tenant.
2. Find the term whose date range contains today (reuse AcademicCalendarService::getCurrentTerm).
3. If found → derive year label from term's start year:
     e.g. term.start = "2025-09-01" → year = "2025/2026"
4. If not found (date gap or no terms) → fall back to tenants.settings.academicYear
     e.g. settings.academicYear = "2025" → year = "2025/2026"
5. If neither found → return null (no active year; form shows warning banner).
6. Derive next year = increment both parts of the label by 1.
     e.g. "2025/2026" → "2026/2027"
```

**Rationale**: Reuses existing infrastructure (`AcademicCalendarService`, `tenants` table) with zero schema changes. Fast (single DB read of `tenants` row). Consistent with how `calendarStatus` endpoint already works.

**Alternatives considered**:
- *Browser-side derivation only*: `YearEndMigrationPanel.tsx` already does this (`defaultFromYear()` uses `new Date().getFullYear()`). This is inaccurate when the school's academic year does not align with the calendar year (e.g. Sept–Aug cycle). Server-side derivation from the actual term calendar is more accurate.

---

## 3. Dropdown Implementation: Replacing Free-Text Inputs

**Decision**: Convert the two `<Input>` fields in `YearEndMigrationPanel.tsx` to `<Select>` dropdowns, populated by a new API endpoint that returns all available year strings + prefill metadata.

**What years appear in the dropdown**:
- All distinct `academic_year` values from `class_instances` for the tenant (existing historical years).
- The current year (from derivation above) — may already be in the list.
- The derived next year — may or may not be in the list (shown as "(To Be Created)" if absent).

**Badge logic (frontend)**:
- `currentYear` label → append `" (Current Active)"` to display text.
- `nextYear` label → append `" (Next)"` or `" (To Be Created)"` if not an existing record.
- All others → no badge.

**Rationale**: `<Select>` prevents free-text typos (a common error source with year strings like `"2025/2026"`). Still allows advanced override: if the user needs a year not in the list, the form retains the old `<Input>` as a fallback or the dropdown includes all known years.

**Alternatives considered**:
- *Keep `<Input>` fields but add a prefill button*: Simpler but doesn't prevent typos; UX is inferior.
- *shadcn/ui `<Combobox>`*: Allows free-text + selection; adds complexity. Plain `<Select>` is sufficient since the year space is small and predictable.

---

## 4. No Schema Migration Needed

**Decision**: This feature requires **zero database migrations**. All data required for prefill already exists in the `tenants` table columns `academic_calendar` and `settings` (JSON blobs). The `class_instances.academic_year` column is used as the source of the historical year list.

**Rationale**: Avoids Principle IV complexity. Clean read-only derivation from existing data.

---

## 5. New Backend Endpoint: `GET /api/class-migration/year-prefill`

**Decision**: Add one new GET endpoint to `ClassMigrationController` that returns:

```json
{
  "currentYear": "2025/2026",
  "nextYear": "2026/2027",
  "nextYearExists": false,
  "availableYears": ["2023/2024", "2024/2025", "2025/2026"],
  "fallbackUsed": false,
  "warning": null
}
```

**Rationale**: Consolidates all prefill logic server-side (satisfies FR-010). Single endpoint call on form load. No polling required. Response is cheap (one `tenants` row read + one distinct query on `class_instances`).

**Alternatives considered**:
- *Embed in the existing `/api/settings` response*: Settings is a general-purpose endpoint; mixing migration prefill data into it violates single-responsibility and couples unrelated concerns.
- *Compute in the existing `calendarStatus` endpoint*: That endpoint is scoped to charge generation; academic year prefill is a different concern.

---

## 6. Frontend Architecture: New Hook `useAcademicYearPrefill`

**Decision**: Create `src/hooks/useAcademicYearPrefill.ts` using TanStack React Query (`useQuery`) to fetch the prefill data on form mount. `YearEndMigrationPanel` consumes this hook to initialise `fromYear`/`toYear` state and build dropdown options.

**Rationale**: Follows the established pattern (`useClassMigration`, etc.). React Query handles caching, loading states, and stale-while-revalidate automatically.

---

## 7. "To Be Created" Year Handling

**Decision**: If `nextYearExists: false` in the prefill response, the "To Be Created" option is shown in the "To Academic Year" dropdown. On form submit (`preview` or `run`), the frontend passes the derived `toYear` string as-is. The backend's existing `ClassMigrationService::validateAcademicYears()` already accepts any valid `YYYY/YYYY+1` string — it does **not** require the year to pre-exist as a database record. Class instances for the target year are auto-created by `ClassInstanceModel::getOrCreate()` during migration.

**Rationale**: No backend changes needed for the "auto-create academic year on submit" behaviour. The existing migration pipeline already handles missing class instances. Simpler than introducing a separate academic year creation step.

**Alternatives considered**:
- *Block migration if nextYear doesn't exist as a DB record*: Unnecessary — the system already handles it gracefully.

---

## 8. Same-Year Validation (FR-009)

**Decision**: Add client-side Zod validation in the form: `fromYear !== toYear`. Also add server-side guard in `ClassMigrationController::preview()` and `::run()` — already partially covered by `validateAcademicYears()` which requires `toStart === fromStart + 1`, making same-year submission mathematically impossible through normal use. The client-side check is the UX guard; the server-side check is the safety net.

---

## 9. Warning Banner (FR-008)

**Decision**: If `currentYear` is null in the prefill response (no active year detected), `YearEndMigrationPanel` renders a `<Alert variant="destructive">` banner and disables the Preview and Run buttons. The warning text matches the spec: "No active academic year found. Please configure the current academic year before triggering migration."

---

## Summary of Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No `academic_years` table; derive from term calendar + settings | Zero schema changes; existing data sufficient |
| 2 | New `GET /api/class-migration/year-prefill` endpoint | Satisfies FR-010 (server-side prefill); single responsibility |
| 3 | `<Select>` dropdowns replace `<Input>` fields | Prevents typos; UX improvement |
| 4 | New `useAcademicYearPrefill` hook (React Query) | Follows established patterns |
| 5 | "To Be Created" year passes through existing migration pipeline | No backend changes for year creation |
| 6 | New `AcademicYearPrefillService` in backend | Single-responsibility service; testable |
| 7 | Client-side + server-side same-year guard | Defense in depth |
