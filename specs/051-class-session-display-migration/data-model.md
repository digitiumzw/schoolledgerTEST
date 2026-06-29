# Data Model: Class Page Session Display & Migration Session Awareness (051)

**Phase 1 output for `/speckit.plan`**

---

## No Schema Changes

This feature requires **zero database migrations**. All data is read from existing columns.

| Existing Field | Source | Used For |
|----------------|--------|----------|
| `settings.activeAcademicSession` | `tenants` table (JSON column) | Primary session display value |
| `settings.academicYear` | `tenants` table (JSON column) | Legacy fallback when `activeAcademicSession` absent |

---

## Runtime Data Structures (Frontend-Only, Not Persisted)

### `ActiveSessionResult`

Returned by the new `useActiveSession` hook. Derived from the `GET /api/settings` response.

```typescript
interface ActiveSessionResult {
  activeSession: string | null   // e.g. "2025/2026" — null only if settings fetch errored
  isFallback: boolean            // true when activeAcademicSession was absent; legacy academicYear used
  isLoading: boolean             // true while settings API call is in-flight
  isError: boolean               // true if settings API call failed
}
```

**Derivation rules** (client-side, from settings API response):

1. If `settings.activeAcademicSession` is a non-empty string → `activeSession = settings.activeAcademicSession`, `isFallback = false`.
2. If `settings.activeAcademicSession` is null/undefined but `settings.academicYear` is present → the backend's `AcademicSessionService` has already normalised this to `YYYY/YYYY+1` in the response (confirmed in `SettingsController::index()`); treat the returned value as `activeSession`, `isFallback = true`.
3. If the settings API call errors → `activeSession = null`, `isError = true`.

> **Note**: The backend always normalises the session before returning it. The frontend does not need to perform year arithmetic — it simply reads the `activeAcademicSession` field and checks whether it was explicitly set.

---

### `MigrationPreview` (existing, unchanged)

```typescript
interface MigrationPreview {
  academicSession: string          // e.g. "2025/2026" — source session for migration
  nextSession: string              // e.g. "2026/2027" — target session for migration
  migrations: { ... }[]
  summary: { ... }
  reconciliationNeeded?: number
}
```

Already returned by `GET /api/students/migration-preview`. No changes.

**Consistency constraint**: `MigrationPreview.academicSession` MUST equal `ActiveSessionResult.activeSession` when both are loaded for the same tenant. Both values trace back to `AcademicSessionService::getCurrentSession()` on the backend — they will be identical.

---

## Affected Files (Frontend Only)

### New

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useActiveSession.ts` | React Query hook wrapping `api.getSettings()`, returning `ActiveSessionResult` |

### Modified

| File | Change |
|------|--------|
| `frontend/src/pages/Classes.tsx` | Add `useActiveSession` call; render session badge in page header |

### Verified (No Change Required)

| File | Verified Behaviour |
|------|-------------------|
| `frontend/src/components/modals/MigrationPreviewModal.tsx` | `preview.academicSession` and `preview.nextSession` already rendered in modal title (line 204); "Confirm Migration" already disabled when `reconciliationNeeded > 0`; minor guard added for falsy `academicSession` |

---

## Hook Design

```typescript
// frontend/src/hooks/useActiveSession.ts

function useActiveSession(): ActiveSessionResult {
  // queryKey ['settings'] — shared with AppHeader's api.getSettings() call
  // staleTime: 5 * 60 * 1000 (5 min) — consistent with useGradeLevels pattern
}
```

The hook:
- Uses `useQuery` from TanStack React Query.
- Query key `['settings']` — intentionally matches any other `getSettings` call so the cache is shared.
- Maps `data.activeAcademicSession` to `activeSession` and derives `isFallback`.
- Returns safe defaults (`activeSession: null, isFallback: false`) while loading or on error.
