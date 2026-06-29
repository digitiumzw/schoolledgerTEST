# Contract: GET /api/settings

**Feature consuming this contract**: 051-class-session-display-migration  
**Contract type**: Existing endpoint — read-only consumption, no modifications

---

## Endpoint

```
GET /api/settings
Authorization: Bearer <JWT>
```

## Response (success)

```json
{
  "status": "success",
  "data": {
    "tenantId": "string",
    "schoolName": "string",
    "contactEmail": "string",
    "contactPhone": "string",
    "address": "string",
    "defaultCurrency": "string",
    "academicYear": "string",
    "activeAcademicSession": "string | null",
    "staffWorkHours": { "start": "HH:MM", "end": "HH:MM" },
    "studentWorkHours": { "start": "HH:MM", "end": "HH:MM" },
    "kioskModeEnabled": "boolean",
    "studentKioskModeEnabled": "boolean",
    "driverKioskModeEnabled": "boolean",
    "kioskCode": "string | null"
  },
  "message": "..."
}
```

## Fields consumed by this feature

| Field | Type | Notes |
|-------|------|-------|
| `activeAcademicSession` | `string \| null` | Primary source. Format: `YYYY/YYYY+1`. Null if tenant has never set it explicitly. |
| `academicYear` | `string` | Legacy fallback. Bare year e.g. `"2025"`. Used only to detect `isFallback = true` when `activeAcademicSession` is absent. |

## Backend resolution chain

The backend (`SettingsController::index`) resolves via `AcademicSessionService::getCurrentSession()`:

1. `tenants.settings.activeAcademicSession` — if valid `YYYY/YYYY+1` format → return as-is.
2. `tenants.settings.academicYear` — if valid 4-digit year string → return as `YYYY/YYYY+1`.
3. `date('Y') / date('Y')+1` — last-resort fallback.

The returned `activeAcademicSession` field in the response is always the resolved value from step 1 (what was explicitly stored), not the normalised form. The normalised form is what `getCurrentSession()` returns and is embedded in the `activeAcademicSession` *field value* only when it was explicitly set as a `YYYY/YYYY+1` string.

> **Frontend implication**: Check `data.activeAcademicSession != null` to determine `isFallback`. If null, the `academicYear`-based normalised value was used by the backend and the session is not explicitly configured.

## Response (error)

```json
{
  "status": "error",
  "message": "Unauthenticated",
  "errors": {}
}
```

HTTP 401 if JWT is absent or expired.

## Frontend usage

```typescript
// src/hooks/useActiveSession.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';

export function useActiveSession() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const activeSession: string | null = data?.activeAcademicSession ?? null;
  const isFallback = !isLoading && !isError && data != null && data.activeAcademicSession == null;

  return { activeSession, isFallback, isLoading, isError };
}
```
