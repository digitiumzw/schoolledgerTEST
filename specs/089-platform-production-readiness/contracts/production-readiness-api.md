# API Contract: Platform Production Readiness & Security Throttling

This document defines the REST API response contracts for system exceptions, rate limiting blocks, and the health status checking endpoint.

---

## 1. Uncaught Runtime Exceptions (HTTP 500)

When an unhandled runtime error or exception occurs anywhere on the backend, the system must intercept it and return a sanitized JSON envelope to protect database schemas and server stack traces.

### HTTP Response Status
`500 Internal Server Error`

### Response Body (JSON Envelope)

```json
{
  "status": "error",
  "message": "An unexpected error occurred. Please contact system administration and quote the reference Correlation ID.",
  "errors": {
    "correlation_id": "ERR-20260615-DE3F9A12",
    "timestamp": "2026-06-15T12:49:00Z"
  }
}
```

---

## 2. API Rate Limiting Blocks (HTTP 429)

When a client IP address (unauthenticated) or user session (authenticated) exceeds the request rate threshold, subsequent requests must be blocked immediately.

### HTTP Response Status
`429 Too Many Requests`

### Response Headers
- `Retry-After`: `12` (Integer number of seconds the client must wait before making another request)
- `X-RateLimit-Limit`: `60` (Total request capacity per minute bucket)
- `X-RateLimit-Remaining`: `0` (Remaining requests left in current bucket)

### Response Body (JSON Envelope)

```json
{
  "status": "error",
  "message": "Too many requests. Please slow down and try again.",
  "errors": {
    "retry_after_seconds": 12,
    "limit_capacity": 60,
    "block_type": "IP_ADDRESS"
  }
}
```

---

## 3. Platform Diagnostics & Health Check

Provides secure health monitoring of database connectivity, cache stores, and isolation namespaces. Restricted strictly to users with the `super_admin` role or authorized status monitors.

### HTTP Request
- **Endpoint**: `/api/health`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`

### HTTP Response Status
`200 OK` (Healthy) or `503 Service Unavailable` (Degraded)

### Success Response Body (JSON)

```json
{
  "status": "success",
  "message": "SchoolLedger Platform is healthy.",
  "data": {
    "environment": "production",
    "timestamp": "2026-06-15T12:49:00Z",
    "services": {
      "database": {
        "status": "online",
        "latency_ms": 1.2
      },
      "cache": {
        "status": "online",
        "provider": "redis"
      },
      "tenant_context": "active"
    }
  }
}
```

### Degraded Service Response Body (JSON)

```json
{
  "status": "error",
  "message": "Platform degradation detected.",
  "errors": {
    "database": {
      "status": "offline",
      "error": "Connection timed out"
    },
    "cache": {
      "status": "online",
      "provider": "redis"
    }
  }
}
```
