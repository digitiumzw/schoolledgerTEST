# Data Model: Academic Year Auto-Prefill (050)

**Phase 1 output for `/speckit.plan`**

---

## No Schema Changes

This feature requires **zero database migrations**. All data needed for prefill exists in the current schema:

| Existing Column | Table | Used For |
|-----------------|-------|----------|
| `academic_calendar` (JSON) | `tenants` | Term date ranges → derive current academic year |
| `settings` (JSON) | `tenants` | Fallback `academicYear` scalar if no term matches today |
| `academic_year` (VARCHAR) | `class_instances` | Source of distinct historical year strings for dropdown |

---

## Derived Data Structures (Runtime-only, not persisted)

### `AcademicYearPrefillResult`

Returned by `AcademicYearPrefillService::getPrefillData()` and serialised to the API response.

```
AcademicYearPrefillResult {
  currentYear:    string|null    // e.g. "2025/2026" — null if no active year detected
  nextYear:       string|null    // e.g. "2026/2027" — null only if currentYear is null
  nextYearExists: bool           // true if "2026/2027" appears in class_instances.academic_year
  availableYears: string[]       // all distinct academic_year values from class_instances, DESC
  fallbackUsed:   bool           // true when term-calendar detection failed; settings fallback used
  warning:        string|null    // human-readable notice for gap / overlap / no-active-year cases
}
```

**Derivation rules**:
1. Read `tenants.academic_calendar` and call `AcademicCalendarService::getCurrentTerm(today)`.
2. If a term is found: extract the start year from `term.start` (`YYYY-MM-DD → YYYY`), set `currentYear = "YYYY/{YYYY+1}"`.
3. If no term found (date gap): read `tenants.settings.academicYear` (a year integer string like `"2025"`), set `currentYear = "2025/2026"`, `fallbackUsed = true`, `warning = "No year is currently active. Prefilled with the most recent year."`.
4. If still null: set `currentYear = null`, `warning = "No active academic year found. Please configure the current academic year before triggering migration."`.
5. Set `nextYear = increment(currentYear)` → `"2026/2027"`.
6. Query `SELECT DISTINCT academic_year FROM class_instances WHERE tenant_id = ? ORDER BY academic_year DESC` → `availableYears`.
7. Set `nextYearExists = in_array(nextYear, availableYears)`.

**Year increment logic** (pure function, no DB):
```
increment("2025/2026") → "2026/2027"
  parts = split("/") → [2025, 2026]
  return (parts[0]+1) + "/" + (parts[1]+1)
```

---

## Affected Services (No New Tables)

### New: `AcademicYearPrefillService`

**File**: `backend/app/Services/AcademicYearPrefillService.php`

```
Class AcademicYearPrefillService {
  + __construct(AcademicCalendarService $calendarService)
  + getPrefillData(string $tenantId): AcademicYearPrefillResult
  - deriveLabelFromTerm(array $term): string
  - deriveLabelFromSettings(array $settings): string|null
  - deriveNextLabel(string $current): string
  - fetchAvailableYears(string $tenantId): string[]
}
```

### Modified: `ClassMigrationController`

New method added:
```
+ prefillYears(): JsonResponse   // GET /api/class-migration/year-prefill
```

No changes to `preview()`, `run()`, or any existing method.

---

## Frontend State Shape

### `useAcademicYearPrefill` hook return type

```ts
interface AcademicYearPrefillData {
  currentYear: string | null;
  nextYear: string | null;
  nextYearExists: boolean;
  availableYears: string[];
  fallbackUsed: boolean;
  warning: string | null;
}

interface UseAcademicYearPrefillResult {
  data: AcademicYearPrefillData | null;
  isLoading: boolean;
  error: string | null;
}
```

### `YearEndMigrationPanel` state changes

| State variable | Before | After |
|----------------|--------|-------|
| `fromYear` | `useState(defaultFromYear())` | Initialised from `prefill.currentYear` once loaded |
| `toYear` | `useState(nextYear(defaultFromYear()))` | Initialised from `prefill.nextYear` once loaded |
| `genAcademicYear` | `useState(nextYear(defaultFromYear()))` | Initialised from `prefill.nextYear` once loaded |
| `availableYears` | N/A (free-text input) | Populated from `prefill.availableYears` |

---

## Validation Rules

| Rule | Where Enforced | Error Message |
|------|---------------|---------------|
| `fromYear !== toYear` | Frontend (Zod) + backend (`validateAcademicYears`) | "The source and destination academic years must be different" |
| `fromYear` matches `YYYY/YYYY+1` | Frontend (regex) + backend | "Year must follow YYYY/YYYY+1 format" |
| `toYear` is exactly one year after `fromYear` | Backend (`validateAcademicYears`) | Already enforced; not relaxed |
| Submit disabled when `currentYear === null` | Frontend only | Warning banner shown instead |
