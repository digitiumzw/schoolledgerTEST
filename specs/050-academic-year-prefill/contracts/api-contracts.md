# API Contracts: Academic Year Auto-Prefill (050)

**Phase 1 output for `/speckit.plan`**

All responses follow the project envelope: `{ "status": "success"|"error", "data": {...}, "message": "..." }`.

---

## New Endpoint

### `GET /api/class-migration/year-prefill`

Returns the server-derived prefill data for the migration form.

**Auth**: `JWTAuthFilter` required. Role: `admin` or `super_admin`.

**Request**: No body or query parameters.

**Success Response** `200 OK`:

```json
{
  "status": "success",
  "data": {
    "currentYear": "2025/2026",
    "nextYear": "2026/2027",
    "nextYearExists": false,
    "availableYears": ["2025/2026", "2024/2025", "2023/2024"],
    "fallbackUsed": false,
    "warning": null
  },
  "message": "Academic year prefill data ready"
}
```

**No-Active-Year Response** `200 OK` (not an error — form handles it):

```json
{
  "status": "success",
  "data": {
    "currentYear": null,
    "nextYear": null,
    "nextYearExists": false,
    "availableYears": ["2024/2025", "2023/2024"],
    "fallbackUsed": false,
    "warning": "No active academic year found. Please configure the current academic year before triggering migration."
  },
  "message": "Academic year prefill data ready"
}
```

**Fallback Response** `200 OK` (date gap — settings fallback used):

```json
{
  "status": "success",
  "data": {
    "currentYear": "2025/2026",
    "nextYear": "2026/2027",
    "nextYearExists": false,
    "availableYears": ["2025/2026", "2024/2025"],
    "fallbackUsed": true,
    "warning": "No year is currently active. Prefilled with the most recent year (2025/2026)."
  },
  "message": "Academic year prefill data ready"
}
```

**Error Response** `401 Unauthorized`:

```json
{
  "status": "error",
  "message": "Unauthorized",
  "errors": {}
}
```

**Error Response** `403 Forbidden` (wrong role):

```json
{
  "status": "error",
  "message": "Forbidden: insufficient role",
  "errors": {}
}
```

---

## Unchanged Existing Endpoints (no contract changes)

The following endpoints remain unchanged. This section documents how the prefill interacts with them.

### `POST /api/class-migration/preview`

**No change to contract.** The `fromAcademicYear` and `toAcademicYear` body fields now receive values populated from the dropdown (previously from free-text inputs), but the shape is identical.

```json
{
  "fromAcademicYear": "2025/2026",
  "toAcademicYear": "2026/2027"
}
```

The server's `validateAcademicYears()` enforces format and consecutive-year constraint. If `fromAcademicYear === toAcademicYear`, validation fails with 400 (same-year is structurally invalid since `toStart` must equal `fromStart + 1`).

### `POST /api/class-migration/run`

**No change to contract.** Same pattern as preview; `confirm: true` still required.

```json
{
  "fromAcademicYear": "2025/2026",
  "toAcademicYear": "2026/2027",
  "confirm": true
}
```

---

## Frontend API Module

New function added to `src/api/api.ts`:

```ts
getAcademicYearPrefill: async (): Promise<AcademicYearPrefillData> => {
  const response = await apiRequest('/class-migration/year-prefill');
  return response.data;
},
```

New type added to `src/api/api.ts`:

```ts
export interface AcademicYearPrefillData {
  currentYear: string | null;
  nextYear: string | null;
  nextYearExists: boolean;
  availableYears: string[];
  fallbackUsed: boolean;
  warning: string | null;
}
```
