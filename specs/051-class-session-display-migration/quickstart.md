# Quickstart: Class Page Session Display & Migration Session Awareness (051)

**For**: Developers implementing this feature  
**Branch**: `051-class-session-display-migration`

---

## What this feature does

Adds a **read-only academic session badge** to the Classes page header showing the currently active academic session (e.g. "2025/2026"). Ensures the migration flow (Promote Students modal) is visually consistent with this session. No backend changes.

---

## What to build

### 1. New hook — `useActiveSession`

**File**: `frontend/src/hooks/useActiveSession.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';

export interface ActiveSessionResult {
  activeSession: string | null;
  isFallback: boolean;
  isLoading: boolean;
  isError: boolean;
}

export function useActiveSession(): ActiveSessionResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const activeSession = data?.activeAcademicSession ?? null;
  const isFallback = !isLoading && !isError && data != null && data.activeAcademicSession == null;

  return { activeSession, isFallback, isLoading, isError };
}
```

> **Key**: `queryKey: ['settings']` shares the React Query cache with `AppHeader`'s `api.getSettings()` call — zero extra network requests in normal usage.

---

### 2. Session badge in `Classes.tsx`

**File**: `frontend/src/pages/Classes.tsx`

Call the hook at the top of the `Classes()` component:

```typescript
const { activeSession, isFallback, isLoading: sessionLoading } = useActiveSession();
```

In the header section (around line 759, below the title/subtitle), add the badge alongside the existing subtitle text:

```tsx
<div className="flex items-center gap-2 mt-1">
  <p className="text-muted-foreground text-sm">
    {isReadOnly ? "Your assigned classes" : "Manage classes, grade levels, and student placement"}
  </p>
  {sessionLoading ? (
    <Skeleton className="h-5 w-28" />
  ) : activeSession ? (
    <Badge
      variant="outline"
      className="text-xs font-normal gap-1"
      title={isFallback ? "Session derived from legacy settings. Configure in Settings → General." : undefined}
    >
      <Calendar className="h-3 w-3" />
      {activeSession}
      {isFallback && <span className="text-muted-foreground ml-0.5">(fallback)</span>}
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-xs font-normal">
      — No session configured
    </Badge>
  )}
</div>
```

Import additions needed in `Classes.tsx`:
- `import { useActiveSession } from "@/hooks/useActiveSession";`
- `Calendar` icon is already available from `lucide-react` (add to existing import)
- `Skeleton` from `@/components/ui/skeleton`

---

### 3. Verify `MigrationPreviewModal` (no code change expected)

Open `frontend/src/components/modals/MigrationPreviewModal.tsx` and confirm:

1. Line ~204: modal title renders `{preview.academicSession} → {preview.nextSession}` ✓
2. The confirm button disabled condition includes a guard for falsy `academicSession`:

```tsx
disabled={confirming || reconciling || (preview.reconciliationNeeded ?? 0) > 0 || !preview.academicSession}
```

If the `!preview.academicSession` guard is absent, add it. This satisfies FR-008.

---

## Testing checklist

| Scenario | Expected |
|----------|----------|
| `activeAcademicSession = "2025/2026"` in settings | Badge shows "2025/2026", no fallback indicator |
| `activeAcademicSession = null`, `academicYear = "2025"` in settings | Badge shows "2025/2026" with `(fallback)` label and tooltip |
| Settings API call in-flight | Skeleton renders in badge position |
| Settings API call fails | `— No session configured` secondary badge; page content unaffected |
| Migration preview modal opened | Title shows `academicSession → nextSession` matching the header badge value |
| `activeAcademicSession` absent in preview response | Confirm Migration button disabled |

---

## No backend changes

- No new PHP files
- No database migrations
- No new API routes
- No changes to existing API routes or response shapes

---

## Verification commands

```bash
# Type-check frontend
cd frontend && npx tsc --noEmit

# Lint
cd frontend && npx eslint src/hooks/useActiveSession.ts src/pages/Classes.tsx
```
