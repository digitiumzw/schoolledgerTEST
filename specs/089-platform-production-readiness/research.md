# Research Findings: Platform Production Readiness

This document outlines the architectural research, evaluations, and decisions required to establish a highly robust, scalable, and secure platform suitable for high-volume, multi-tenant SaaS operations on SchoolLedger.

---

## 1. Database Indexing Optimization

### A. Decision
All tables containing tenant-owned data must enforce a compound multi-tenant indexing standard. Rather than standard single-column indexes, query filters must utilize composite index keys starting with `tenant_id` followed by the query-filtering or sorting criteria (e.g., `status`, `deleted_at`, `created_at`, or relationship foreign keys).

### B. Rationale
In a multi-tenant shared-schema database, every single operational query is filtered by `tenant_id` (per Principle I). If an index is placed only on `status` or `created_at`, the SQL engine has to perform expensive index intersection or filter scans across all tenants. By creating composite indexes prefixed with `tenant_id`, the engine immediately narrows the scan scope down to that specific tenant's space in $O(\log N)$ time, preventing database sluggishness as tenant count and datasets grow.

### C. Recommended Index Layouts
- `students`: `idx_students_tenant_status` on `(tenant_id, status)`
- `payments`: `idx_payments_tenant_category` on `(tenant_id, category_id, created_at)`
- `charges`: `idx_charges_tenant_term_type` on `(tenant_id, term_id, charge_type)`
- `staff_attendance`: `idx_attendance_tenant_staff_date` on `(tenant_id, staff_id, date)`

---

## 2. Eliminating N+1 Performance Regressions

### A. Decision
Direct MySQL JOIN operations or explicit batched ID mappings must be used instead of executing queries inside PHP loops. 
- For lists that render simple relations (e.g. students and their current class), a single `LEFT JOIN` must be used.
- For financial ledger aggregations, the batch subquery pattern (`getAllBalances()` or `preloadLedgerBalances()`) must be enforced, utilizing a single SQL GROUP BY clause to fetch balances for all listed students in exactly one database round-trip.

### B. Alternatives Evaluated
- **Active Record Lazy Loading**: Highly discouraged in loop scenarios as rendering a directory table of 100 students would result in 101 separate queries.
- **Client-Side Aggregation**: Rejected as it violates Principle XI and requires fetching full historical transaction records, which scales terribly.

---

## 3. Memory-Safe Stream Processing (Bulk Data Operations)

### A. Decision
Bulk operations must adopt streaming structures to keep server memory usage flat ($O(1)$ complexity) regardless of record volume.
- **CSV Imports**: Stream parsed rows using standard filesystem buffers (`fgetcsv`) and execute batched inserts (`insertBatch` of 100 rows) instead of loading the entire CSV into PHP arrays.
- **Billing Run Generation**: Execute student selection via chunked cursors (e.g., fetching 100 students at a time), processing their charges in isolated transaction blocks.

### B. Rationale
Loading tens of thousands of entity records or raw file lines into PHP memory causes catastrophic performance degradation and triggers fatal PHP memory limit exhaustion errors in production. Flat-memory streaming maintains server reliability.

---

## 4. Atomic Transaction Boundaries

### A. Decision
All state-modifying endpoints affecting multiple rows or financial ledgers (such as recording split payments, updating student class enrollments, or running/rolling back billing batches) must run within ACID-compliant database transactions using the InnoDB storage engine.

```php
$db->transStart();
try {
    // Perform mutations...
    $db->transCommit();
} catch (Throwable $e) {
    $db->transRollback();
    throw $e;
}
```

### B. Rationale
Ensures zero data corruption. If a server process terminates midway through a payment allocation, the transaction rollback completely undoes the partial allocations, preserving ledger integrity.

---

## 5. Centralized Exception Shielding & Correlation IDs

### A. Decision
No raw PHP warnings, framework stack traces, or database schema errors may ever leak to the client response (violates Principle IX). A global Exception Handler must intercept all unhandled exceptions and:
1. Generate a unique, structured Correlation ID using a secure random hex prefix: `ERR-[timestamp]-[random_string]`.
2. Write a JSON log file containing: `correlation_id`, `timestamp`, `tenant_id`, `user_id`, `exception_class`, `message`, `stack_trace`, and `request_uri`.
3. Return a clean, user-friendly HTTP 500 error envelope displaying the correlation ID.

### B. Alternatives Evaluated
- **Local try/catch blocks**: Suffer from duplication and risk developer omission. A centralized middleware filter or framework override is much safer.

---

## 6. Defensive Rate Limiting

### A. Decision
Implement token-bucket rate limiting via CodeIgniter filters (`RateLimiterFilter`) targeting sensitive and resource-heavy endpoints.
- **Unauthenticated APIs** (e.g., `/api/auth/login`): Throttle based on Client IP Address (limit 60 requests/minute).
- **Authenticated APIs**: Throttle based on User Session / JWT Identity (limit 120 requests/minute).
- When limits are exceeded, respond immediately with `HTTP 429 Too Many Requests`, returning a `Retry-After` header indicating wait times.

### B. Alternatives Evaluated
- **Database-driven Throttle**: Too heavy as rate limit verification itself creates database write loads.
- **In-Memory Cache (Redis / File-based)**: Selected. Utilizing CodeIgniter's Cache service (Redis or fast local files) minimizes throttling overhead.
