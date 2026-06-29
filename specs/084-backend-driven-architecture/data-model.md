# Data Model: Backend-Driven Architecture (Feature 084)

> No new database tables or schema changes are required for this feature.
> All changes are at the query, service, and API layers.

---

## Existing Tables Referenced

### `staff`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | Primary key |
| `tenant_id` | VARCHAR(36) | Multi-tenant isolation; used in all queries |
| `first_name` | VARCHAR(100) | Searchable via LIKE |
| `last_name` | VARCHAR(100) | Searchable via LIKE |
| `email` | VARCHAR(150) | Searchable via LIKE |
| `department` | VARCHAR(100) | Filterable; needs index |
| `employment_status` | ENUM('active','resigned','retired','suspended') | Filterable; needs index |
| `is_teaching` | TINYINT(1) | Filterable; included in composite index |
| `employee_id` | VARCHAR(20) | Display/export only |
| `position` | VARCHAR(100) | Display only |
| `hire_date` | DATE | Sortable |
| `created_at` | DATETIME | Sortable (default sort for new records) |

**New indexes required** (via migration `2026-05-25-000001_AddStaffFilterIndexes.php`):

```sql
-- Composite index for tenant + employment_status filter
ALTER TABLE staff ADD INDEX idx_staff_tenant_status (tenant_id, employment_status);

-- Composite index for tenant + department filter
ALTER TABLE staff ADD INDEX idx_staff_tenant_dept (tenant_id, department);

-- Composite index for tenant + teaching filter
ALTER TABLE staff ADD INDEX idx_staff_tenant_teaching (tenant_id, is_teaching);

-- Index for name search (tenant-scoped LIKE on first_name/last_name)
ALTER TABLE staff ADD INDEX idx_staff_tenant_first (tenant_id, first_name);
ALTER TABLE staff ADD INDEX idx_staff_tenant_last (tenant_id, last_name);
```

**New model method**: `StaffModel::getFiltered(string $tenantId, array $params): array`

Returns: `['data' => [...], 'pagination' => [...], 'summary' => [...]]`

Params accepted:
- `search` — LIKE match on `CONCAT(first_name, ' ', last_name)` and `email`
- `department` — exact match
- `isTeaching` — `'yes'` / `'no'` / omit
- `employmentStatus` — exact match or omit for all
- `sortBy` — `name` | `department` | `employmentStatus` | `hireDate` | `createdAt` (default)
- `sortOrder` — `asc` | `desc` (default: `asc` for name, `desc` for date)
- `page` — integer ≥ 1 (default: 1)
- `limit` — integer 1–100 (default: 20)

---

### `fee_campaigns`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | Primary key |
| `tenant_id` | VARCHAR(36) | Multi-tenant isolation |
| `name` | VARCHAR(200) | Searchable |
| `status` | ENUM('active','closed') | Filterable (already indexed via PK lookup) |
| `amount` | DECIMAL(10,2) | Per-student target amount |
| `due_date` | DATE | Sortable |
| `created_at` | DATETIME | Default sort |

**No new indexes needed** — `tenant_id` + `status` filter on a small table; existing query
is already bounded by tenant_id.

**New model method**: `FeeCampaignModel::getSummariesByCampaignIds(array $ids, string $tenantId): array`

Returns a map keyed by campaign_id:
```php
[
  'camp_xxx' => [
    'totalStudents' => 12,
    'totalExpected' => 240.00,
    'totalCollected' => 150.00,
    'totalOutstanding' => 90.00,
    'fullyPaidCount' => 5,
    'partiallyPaidCount' => 3,
    'unpaidCount' => 4,
  ],
  ...
]
```

SQL pattern:
```sql
SELECT fee_campaign_id,
       COUNT(*) AS total_students,
       COALESCE(SUM(expected_amount), 0) AS total_expected,
       COALESCE(SUM(paid_amount), 0) AS total_collected,
       COALESCE(SUM(expected_amount - paid_amount), 0) AS total_outstanding,
       SUM(CASE WHEN status = 'fully_paid' THEN 1 ELSE 0 END) AS fully_paid_count,
       SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid_count,
       SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_count
FROM campaign_students
WHERE fee_campaign_id IN (?, ?, ...)
  AND tenant_id = ?
GROUP BY fee_campaign_id
```

This replaces N individual `getSummary()` calls with a single query.

---

### `campaign_students`

| Column | Type | Notes |
|--------|------|-------|
| `fee_campaign_id` | VARCHAR(36) | FK to fee_campaigns; used in batch summary query |
| `tenant_id` | VARCHAR(36) | Multi-tenant isolation |
| `student_id` | VARCHAR(36) | FK to students |
| `status` | ENUM('unpaid','partially_paid','fully_paid') | Aggregated in summary |
| `expected_amount` | DECIMAL(10,2) | Target per student |
| `paid_amount` | DECIMAL(10,2) | Running total |

**No new indexes needed** — existing `fee_campaign_id` FK index serves the batch GROUP BY.

---

### `transport_routes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | Primary key |
| `tenant_id` | VARCHAR(36) | Multi-tenant isolation |
| `route_name` | VARCHAR(200) | Searchable via LIKE (already used) |
| `status` | VARCHAR(20) | Display filter |
| `created_at` | DATETIME | Default sort |

**Pagination added**: `LIMIT ? OFFSET ?` applied before stop/period enrichment queries.
The enrichment IN-query naturally covers only paginated route IDs.

**Sort params**: `sortBy` = `routeName` | `createdAt` (default: `routeName`)

---

### `transport_vehicles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | Primary key |
| `tenant_id` | VARCHAR(36) | Multi-tenant isolation |
| `name` | VARCHAR(200) | Searchable |
| `reg_number` | VARCHAR(50) | Searchable |
| `type` | VARCHAR(50) | Display |
| `capacity` | INT | Display |

**Pagination added**: `LIMIT ? OFFSET ?` after primary query; allocation count subquery covers
only the paginated IDs via IN clause.

---

### `transport_drivers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | Primary key |
| `tenant_id` | VARCHAR(36) | Multi-tenant isolation |
| `name` | VARCHAR(200) | Searchable |
| `phone` | VARCHAR(30) | Display |
| `license_number` | VARCHAR(50) | Display |

**Pagination added**: `LIMIT ? OFFSET ?` after primary query.

---

## Query Pattern Reference

### Pagination helper (applied in all three transport controllers and StaffController)

```php
$page  = max(1, (int) ($params['page'] ?? 1));
$limit = min(100, max(1, (int) ($params['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

// Total count (separate COUNT query)
$total = $builder->countAllResults(false);  // false = don't reset builder

// Paginated data
$data = $builder->limit($limit, $offset)->get()->getResultArray();

return [
    'data' => $data,
    'pagination' => [
        'page'       => $page,
        'limit'      => $limit,
        'total'      => $total,
        'totalPages' => (int) ceil($total / $limit),
    ],
];
```

---

## Frontend Data Contracts (TypeScript)

### Staff list response

```ts
interface StaffListResponse {
  data: Staff[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalCount: number;
    activeCount: number;
    teachingCount: number;
    departmentBreakdown: Record<string, number>;
  };
}
```

### Fee Campaigns list response (unchanged shape, N+1 fixed)

```ts
interface FeeCampaignsListResponse {
  data: (FeeCampaign & { summary: CampaignSummary })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Transport list response (routes / vehicles / drivers all follow same shape)

```ts
interface TransportListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## React Query Configuration Change

**File**: `frontend/src/App.tsx`

```ts
// Before
staleTime: 2 * 60 * 1000,   // 2 minutes
// No refetchInterval

// After
staleTime: 30_000,           // 30 seconds (matches polling interval)
refetchInterval: 30_000,     // Poll all active queries every 30s
```

This single change activates real-time polling for all pages already using React Query
(Students, Payments, Classes, Staff Attendance, Dashboard, Analytics) plus the newly
migrated Staff, FeeCampaigns, and Transport pages.
