# Research: Fix Frontend Bugs and UI Inconsistencies

**Phase**: 0 — Research  
**Branch**: `022-fix-frontend-bugs-ui`  
**Date**: 2026-04-09

---

## R-001: React Query Error & Retry Patterns

**Decision**: Use TanStack React Query's built-in `isError`, `error`, and `refetch` return values from `useQuery` / `useMutation`. For imperative fetches (non-React-Query `useEffect` + raw Axios calls), introduce a local `errorMessage` state and expose a `retry` callback.

**Rationale**: The codebase currently mixes React Query (for some data) with `useEffect` + Axios (for most page fetches). The React Query pattern is already present and validated in the constitution. Pages that use raw `useEffect` fetches (`Dashboard.tsx`, `StudentProfile.tsx`, `Payments.tsx`) should continue with the same approach and simply add explicit error state tracking (`const [error, setError] = useState<string | null>(null)`) alongside a retry trigger (`const [retryCount, setRetryCount] = useState(0)`).

**Pattern**:
```typescript
const [error, setError] = useState<string | null>(null);
const [retryCount, setRetryCount] = useState(0);

useEffect(() => {
  setError(null);
  fetchData().catch((err) => setError(err.message ?? 'Failed to load data'));
}, [retryCount]);

// In JSX:
{error && <ErrorState message={error} onRetry={() => setRetryCount(c => c + 1)} />}
```

**Alternatives considered**:
- Migrating all pages to React Query `useQuery` — too broad for a bug-fix cycle; deferred to a future refactor.
- Global error boundary — catches render errors, not fetch errors; not appropriate here.

---

## R-002: Null-Safety Patterns for Optional API Data

**Decision**: Use TypeScript optional chaining (`?.`) throughout. Where a missing value should show an empty UI element rather than crashing, use nullish coalescing (`?? ''` or `?? null`). Do not use non-null assertion (`!`) on API data.

**Rationale**: The crashes in `RecordPaymentModal`, `StudentFormModal`, and `StaffFormModal` all occur when properties of optional nested objects are accessed without guards. Optional chaining already exists in parts of the codebase — the fix is to audit and complete the coverage.

**Pattern for modal pre-population**:
```typescript
// Before (crashes if student.currentEnrollment is null):
const classId = student.currentEnrollment.classId;

// After (safe):
const classId = student?.currentEnrollment?.classId ?? null;
```

**Pattern for guardian**:
```typescript
// Before:
const guardianName = student.guardian.name;

// After:
const guardianName = student?.guardian?.name ?? '';
```

**Alternatives considered**:
- Zod schema parsing of the API response — would be ideal for full type safety but is out of scope for a bug-fix cycle.

---

## R-003: Phone Normalization + Date Validation with Zod

**Decision**: Normalize phone numbers by stripping non-digit characters (except leading `+`) before applying the length check. For dates: reject hire dates in the future; reject dates of birth that imply age < 16 or > 100 for staff.

**Rationale**: The current phone regex `/^\+?[0-9]{10,}$/` fails on inputs like `+263 77 123 4567` or `(263) 771234567`. Stripping whitespace, parentheses, and dashes before validation matches user expectations. Date guards prevent obvious data entry errors.

**Pattern (Zod + React Hook Form)**:
```typescript
const phoneSchema = z.string()
  .transform(val => val.replace(/[\s\-().]/g, ''))  // normalize
  .pipe(z.string().regex(/^\+?[0-9]{10,}$/, 'Enter a valid phone number'));

const hireDateSchema = z.string().refine(val => {
  const d = new Date(val);
  return !isNaN(d.getTime()) && d <= new Date();
}, { message: 'Hire date cannot be in the future' });

const staffDobSchema = z.string().refine(val => {
  const d = new Date(val);
  const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return age >= 16 && age <= 100;
}, { message: 'Date of birth must reflect an age between 16 and 100' });
```

**Alternatives considered**:
- Masking the input field (e.g., react-phone-input-2) — introduces a new dependency; rejected per constraint.

---

## R-004: shadcn/ui Button & Modal Standardization

**Decision**:
- **Primary action buttons** on list pages: `<Button>` with no explicit `variant` prop (defaults to `"default"`, which is the filled primary color) and no explicit `size` prop.
- **Secondary/cancel buttons**: `variant="outline"`.
- **Destructive actions**: `variant="destructive"`.
- **Icon-only buttons** in table rows: `variant="ghost"` + `size="icon"`.
- **Modal width standard**: `max-w-lg` (32rem) for simple single-column forms; `max-w-2xl` (42rem) for multi-section forms. Never use `w-[Xvw]` viewport-width expressions.
- **Modal footer**: always use `<DialogFooter>` with Cancel (left) and Submit (right, primary).

**Rationale**: shadcn/ui's `Button` component already has a well-defined variant/size system. The codebase uses it inconsistently because no written standard existed. Codifying these choices eliminates the inconsistency without any custom CSS.

**Alternatives considered**:
- Creating a `PrimaryButton` wrapper component — unnecessary abstraction; using the existing shadcn props directly is sufficient.

---

## R-005: Tailwind Color Standardization for Financial Balances

**Decision**: Define balance colors using a consistent set of Tailwind semantic classes rather than scattered hardcoded color values:

| State | Class (text) | Usage |
|-------|-------------|-------|
| Credit / Paid in full | `text-green-600 dark:text-green-400` | Balance ≤ 0 (student owes nothing) |
| Partially paid / Warning | `text-amber-600 dark:text-amber-400` | Balance > 0 and < 50% of total charges |
| Overdue / Debit | `text-red-600 dark:text-red-400` | Balance > 0 and ≥ 50% of total charges |
| Zero / Neutral | `text-muted-foreground` | Balance exactly 0 when no charges exist |

These classes will be centralized in `BalanceDisplay.tsx` (the existing shared component) and removed from inline definitions in `StudentProfile.tsx` and any other location that duplicates this logic.

**Rationale**: Color meaning must be consistent to prevent user confusion in a financial context. Using Tailwind's named scales (rather than arbitrary hex values) ensures they degrade correctly in dark mode when the `dark:` prefix is added.

**Alternatives considered**:
- CSS variables in `:root` — adds complexity; Tailwind class approach is already the pattern in this codebase.

---

## R-006: Heading Hierarchy Standard

**Decision**: All pages follow this heading structure:

| Level | Element | Usage |
|-------|---------|-------|
| H1 | `<h1 className="text-2xl font-bold">` | Page title (one per page) |
| H2 | `<h2 className="text-lg font-semibold">` | Named section within a page |
| H3 | `<h3 className="text-base font-medium">` | Subsection within an H2 section |

Cards and panels use `<CardTitle>` (renders as `<h3>` semantically via shadcn). No heading level may be skipped.

**Rationale**: Consistent heading hierarchy improves accessibility (screen readers) and visual predictability. Currently H1 is absent from most pages and H2/H3 are mixed arbitrarily.

**Alternatives considered**:
- Using only size utilities without semantic elements — rejected because it removes accessibility meaning.

---

## Resolved NEEDS CLARIFICATION

None — spec had zero clarification markers. All decisions above are informed by code audit and existing patterns.
