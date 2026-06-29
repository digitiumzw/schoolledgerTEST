# Quickstart & Integration Validation: Platform Production Readiness

This document provides instructions on how to test and validate the Platform Production Readiness, Security Throttling, and Exception Shielding features on your local development environment.

---

## Prerequisites

Ensure both the backend and frontend dev servers are running:
- **Backend Port**: `8080` (or configured value in backend `.env`)
- **JSON Utility**: `jq` installed on your command line for JSON parsing.

---

## 1. Validating Exception Shielding (Correlation IDs)

We want to trigger a mock backend crash to verify that raw traces are successfully masked and a Correlation ID is returned.

### Step 1: Execute Mock Request
Run a query containing invalid data structures or call a known error-triggering path:

```bash
curl -X POST http://localhost:8080/api/students/import \
  -H "Content-Type: application/json" \
  -d '{"invalid_structure": true}' \
  -i
```

### Step 2: Validate Error Response Envelope
Ensure that the terminal response matches the sanitized, secure JSON contract:
- Assert HTTP response code is `500 Internal Server Error` (or `400` if validation caught).
- Assert JSON contains `"status": "error"`.
- Assert JSON does NOT contain database table structures, raw code files, or file paths.
- Assert JSON includes a valid `correlation_id` string.

---

## 2. Validating API Rate Limiting

We want to send rapid requests to sensitive unauthenticated routes to verify that throttling filters block abuse.

### Step 1: Execute Rapid Login Queries
Simulate a rapid login attempt or brute force cycle:

```bash
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@greenwood.co.zw", "password": "wrong_password"}' \
    -o /dev/null -s -w "%{http_code}\n"
done
```

### Step 2: Verify Rate Limit Response
- Once the request rate threshold (60 requests/minute) is breached, the terminal output must print `429` (HTTP Too Many Requests).
- Inspect the full headers of a blocked request:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@greenwood.co.zw", "password": "wrong_password"}' \
  -i
```

- Confirm the presence of standard headers:
  - `Retry-After: [seconds]`
  - `X-RateLimit-Limit: 60`
  - `X-RateLimit-Remaining: 0`

---

## 3. Database Indexes Validation (Query Optimization)

To verify that multi-tenant optimization is in place and full table scans are avoided:

### Step 1: Open MySQL CLI
Connect to your active local database:

```bash
mysql -u user -p user
```

### Step 2: Run Query Explain Plans
Prepend `EXPLAIN` to multi-tenant filter queries to verify index engagement:

```sql
EXPLAIN SELECT * FROM students WHERE tenant_id = 'tenant_greenwood' AND status = 'active';
```

- **Pass Criteria**: The output `key` column must display `idx_students_tenant_status` (or composite equivalent) instead of `NULL` (which would indicate a slow full table scan).
