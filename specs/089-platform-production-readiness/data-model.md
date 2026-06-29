# Data Model Specification: Platform Production Readiness

This document specifies the database schemas, indexes, and cache keys required to support production stability, performance, and security auditing for the SchoolLedger platform.

---

## 1. Auditing & Diagnostics Schema

### `system_error_logs` (Audit Log for Uncaught Exceptions)

Used to securely record full exception details mapped to an API Correlation ID without leaking sensitive schema or database structures to frontend clients.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(36) | No | (Primary) | Unique UUID generated for the log record. |
| `correlation_id` | VARCHAR(50) | No | (Unique) | Friendly correlation token returned to the user (e.g. `ERR-20260615-ABC123`). |
| `tenant_id` | VARCHAR(36) | Yes | NULL | Tenant context under which the error occurred. |
| `user_id` | VARCHAR(36) | Yes | NULL | ID of the active user session causing the exception. |
| `exception_class` | VARCHAR(255) | No | - | Full class name of the thrown exception. |
| `message` | TEXT | No | - | Exception message text. |
| `stack_trace` | MEDIUMTEXT | No | - | Safe stringified JSON stack trace representation. |
| `request_uri` | VARCHAR(512) | No | - | HTTP target endpoint (e.g., `/api/students/import`). |
| `request_method` | VARCHAR(10) | No | - | HTTP request verb (GET, POST, etc.). |
| `ip_address` | VARCHAR(45) | No | - | Client IP Address. |
| `created_at` | DATETIME | No | CURRENT_TIMESTAMP | Timestamp when the exception occurred. |

#### Database Indexes
- `PRIMARY KEY` on `id`
- `UNIQUE INDEX uq_error_correlation` on `correlation_id`
- `INDEX idx_error_tenant_created` on `(tenant_id, created_at DESC)` (for platform diagnostics)

---

## 2. API Security & Rate Limiting Schema

### `api_rate_limit_buckets` (Cache & Fallback State Storage)

Used to track client request volumes against API thresholds. While primarily stored in an in-memory cache (e.g., Redis) for sub-millisecond lookups, the schema represents the logical state structure.

#### Logical Fields
- `bucket_key`: Unique string identifier representing the bucket.
  - Format for unauthenticated: `rl:ip:{ip_address}:{endpoint_hash}`
  - Format for authenticated: `rl:user:{user_id}:{endpoint_hash}`
- `tokens`: DECIMAL(10,4) — Number of remaining request tokens available in the bucket.
- `last_updated`: INT — Unix timestamp representing when the bucket was last refilled or accessed.
- `capacity`: INT — Total capacity of the token bucket (maximum burst size).
- `refill_rate`: INT — Number of tokens added back to the bucket per second.

---

## 3. High-Volume Index Optimization (Existing Tables)

To guarantee database responsiveness at scale under heavy multi-tenant concurrency, the following indexes are specified to prevent full table scans:

### A. Students Table
Ensure filtering by status or enrollment history within a tenant remains fast:
- **Index**: `idx_students_tenant_status`
  - Columns: `(tenant_id, status, deleted_at)`

### B. Payments Table
Enhance ledger calculations and payment searches:
- **Index**: `idx_payments_tenant_category`
  - Columns: `(tenant_id, category_id, payment_method, date DESC)`
- **Index**: `idx_payments_group`
  - Columns: `(tenant_id, payment_group_id)`

### C. Charges Table
Optimize billing run generation and unbilled audits:
- **Index**: `idx_charges_tenant_billing_run`
  - Columns: `(tenant_id, billing_run_id, charge_type, amount)`

### D. Staff Attendance Table
Optimize report rendering and daily kiosks:
- **Index**: `idx_staff_attendance_tenant_date`
  - Columns: `(tenant_id, date, status)`
