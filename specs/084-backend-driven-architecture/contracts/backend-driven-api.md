# API Contracts: Backend-Driven Architecture (Feature 084)

## Base URL

All endpoints are under `http://localhost:8080/api` (development).

All requests require `Authorization: Bearer <token>` header.

---

## 1. Staff Directory — `GET /api/staff`

### Changes from current

Current endpoint returns all staff with no filtering, sorting, or pagination.
This feature adds full server-side support for all of these.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | LIKE match on full name (`CONCAT(first_name,' ',last_name)`) and email |
| `department` | string | — | Exact match on department; omit for all departments |
| `isTeaching` | `yes` \| `no` | — | Filter by teaching status; omit for all |
| `employmentStatus` | `active` \| `resigned` \| `retired` \| `suspended` | — | Exact match; omit for all |
| `sortBy` | `name` \| `department` \| `employmentStatus` \| `hireDate` \| `createdAt` | `name` | Sort field |
| `sortOrder` | `asc` \| `desc` | `asc` | Sort direction |
| `page` | integer ≥ 1 | `1` | Current page |
| `limit` | integer 1–100 | `20` | Records per page |

### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "st_abc123",
        "tenantId": "t_xyz",
        "firstName": "Alice",
        "lastName": "Moyo",
        "name": "Alice Moyo",
        "email": "alice@school.co.zw",
        "department": "Mathematics",
        "isTeaching": true,
        "employmentStatus": "active",
        "employeeId": "EMP0012",
        "position": "Senior Teacher",
        "hireDate": "2022-01-15",
        "phone": "+263771234567"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 87,
      "totalPages": 5
    },
    "summary": {
      "totalCount": 87,
      "activeCount": 80,
      "teachingCount": 45,
      "departmentBreakdown": {
        "Mathematics": 8,
        "ICT": 5,
        "English": 7
      }
    }
  }
}
```

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | `limit` < 1 or > 100, `page` < 1, invalid `sortBy` value |
| 401 | Missing or invalid JWT |

---

## 2. Fee Campaigns List — `GET /api/fee-campaigns`

### Changes from current

No new parameters; `status` filter already works. This feature:
- Fixes N+1 by computing all campaign summaries in a single batch query
- Adds pagination metadata to the response
- Adds `page`, `limit`, `sortBy`, `sortOrder` params for future scale

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `active` \| `closed` | — | Filter by campaign status; omit for all |
| `page` | integer ≥ 1 | `1` | Current page |
| `limit` | integer 1–100 | `50` | Records per page (higher default — campaigns are few) |
| `sortBy` | `name` \| `dueDate` \| `createdAt` | `createdAt` | Sort field |
| `sortOrder` | `asc` \| `desc` | `desc` | Sort direction |

### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "camp_abc123",
        "tenantId": "t_xyz",
        "name": "School Trip 2026",
        "description": "End of year trip",
        "status": "active",
        "amount": 20.00,
        "dueDate": "2026-06-30",
        "targetScopeType": "school_wide",
        "targetScopeId": null,
        "createdAt": "2026-05-01T08:00:00Z",
        "summary": {
          "totalStudents": 120,
          "totalExpected": 2400.00,
          "totalCollected": 1800.00,
          "totalOutstanding": 600.00,
          "fullyPaidCount": 80,
          "partiallyPaidCount": 10,
          "unpaidCount": 30
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | Invalid pagination params |
| 401 | Missing or invalid JWT |

---

## 3. Transport Routes — `GET /api/transport/routes`

### Changes from current

Adds `page`, `limit`, `sortBy`, `sortOrder` to existing search-capable endpoint.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | LIKE match on `route_name` |
| `page` | integer ≥ 1 | `1` | Current page |
| `limit` | integer 1–100 | `20` | Records per page |
| `sortBy` | `routeName` \| `createdAt` | `routeName` | Sort field |
| `sortOrder` | `asc` \| `desc` | `asc` | Sort direction |

### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "r_abc",
        "routeName": "Harare North",
        "status": "active",
        "stops": [...],
        "currentPeriod": { "vehicleId": "v_x", "vehicleName": "Bus A", ... },
        "students": [...]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

---

## 4. Transport Vehicles — `GET /api/transport/vehicles`

### Changes from current

Adds `page`, `limit`, `sortBy`, `sortOrder` to existing search-capable endpoint.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | LIKE on `name` or `reg_number` |
| `page` | integer ≥ 1 | `1` | Current page |
| `limit` | integer 1–100 | `20` | Records per page |
| `sortBy` | `name` \| `createdAt` | `name` | Sort field |
| `sortOrder` | `asc` \| `desc` | `asc` | Sort direction |

### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "v_abc",
        "name": "Bus A",
        "regNumber": "ABC-1234",
        "type": "minibus",
        "capacity": 25,
        "activeStudentCount": 18
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

## 5. Transport Drivers — `GET /api/transport/drivers`

### Changes from current

Adds `page`, `limit`, `sortBy`, `sortOrder` to existing search-capable endpoint.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | LIKE on `name` or `phone` |
| `page` | integer ≥ 1 | `1` | Current page |
| `limit` | integer 1–100 | `20` | Records per page |
| `sortBy` | `name` \| `createdAt` | `name` | Sort field |
| `sortOrder` | `asc` \| `desc` | `asc` | Sort direction |

### Success Response — HTTP 200

```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "d_abc",
        "name": "John Doe",
        "phone": "+263771234567",
        "licenseNumber": "LIC-9999",
        "status": "active"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 4,
      "totalPages": 1
    }
  }
}
```

---

## 6. React Query Global Polling Configuration

**File**: `frontend/src/App.tsx`

The `QueryClient` default options are updated to add global polling:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 seconds (was 2 minutes)
      gcTime: 5 * 60 * 1000,   // unchanged
      refetchInterval: 30_000,  // NEW: auto-poll every 30s when page is focused
      refetchOnWindowFocus: true, // unchanged
      retry: ...,               // unchanged
    },
    mutations: { retry: false }, // unchanged
  },
});
```

All active React Query subscriptions will refresh every 30 seconds automatically.
Pages NOT using React Query (Staff, FeeCampaigns, Transport before this feature) will not
benefit until their data-fetching is migrated to React Query hooks.

---

## 7. Backward Compatibility

All endpoint changes are **additive only**:
- New query parameters are optional; existing callers without them continue to work
- Response shapes add a `pagination` wrapper — existing `data` array is nested under `data.data`

**Breaking change in fee campaigns response**:
- Current: `GET /api/fee-campaigns` returns `data: [...]` (flat array)
- After: `GET /api/fee-campaigns` returns `data: { data: [...], pagination: {...} }`
- `frontend/src/hooks/useFeeCampaigns.ts` and `frontend/src/api/api.ts` must be updated to unwrap `data.data`

**Breaking change in staff response**:
- Current: `GET /api/staff` returns `data: [...]` (flat array)
- After: `GET /api/staff` returns `data: { data: [...], pagination: {...}, summary: {...} }`
- `frontend/src/api/api.ts` and `Staff.tsx` must be updated to unwrap

**Breaking change in transport responses**:
- Same pagination wrapper as above — transport pages must unwrap `data.data`
