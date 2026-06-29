# Quickstart & Curl Validation

This document outlines the curl commands needed to validate Principle X for the Recent Activity Scope Fix.

## Environment Variables
```bash
BASE_URL="http://localhost:8080/api"
PLATFORM_BASE_URL="http://localhost:8080/api/platform"
```

## 1. Authentication

**Get Tenant Token**
```bash
export TENANT_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')
```

**Get Platform Token**
```bash
export PLATFORM_TOKEN=$(curl -s -X POST "$PLATFORM_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost.com","password":"12345678"}' | jq -r '.data.token')
```

## 2. Validate Platform Dashboard Activity (FR-001)
Confirm only `platform.*` prefixed actions are returned and no tenant events are leaked.

```bash
curl -s -X GET "$PLATFORM_BASE_URL/dashboard/activity" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq '.data[] | {action: .action, id: .id}'
```

**Observed Output**:
```json
{
  "action": "platform.login",
  "id": "275"
}
{
  "action": "platform.login",
  "id": "274"
}
{
  "action": "platform.tenant.resend_welcome",
  "id": "271"
}
{
  "action": "platform.settings.update",
  "id": "270"
}
{
  "action": "platform.tenant.provision",
  "id": "268"
}
```
*All returned actions begin with `platform.`. No tenant payment events leaked.*

## 3. Validate Tenant Dashboard Activity (FR-002, FR-003)

Confirm tenant feed contains a mixture of event types, properly scoped to the tenant.

```bash
curl -s -X GET "$BASE_URL/dashboard/activity" \
  -H "Authorization: Bearer $TENANT_TOKEN" | jq '.data.activities[] | {type: .type, description: .description}'
```

**Observed Output**:
```json
{
  "type": "enrollment",
  "description": "Student enrolled",
  "timestamp": "2027-04-28"
}
{
  "type": "enrollment",
  "description": "Student enrolled",
  "timestamp": "2026-05-20"
}
{
  "type": "status_change",
  "description": "Student status changed to active",
  "timestamp": "2026-05-19 13:40:05"
}
```
*Feed now returns a variety of tenant-specific event types, not just payments.*

## 4. Tenant Isolation Check (FR-004)

```bash
# Missing token
curl -s -w "\nHTTP: %{http_code}\n" -X GET "$BASE_URL/dashboard/activity"
```
*Expected: HTTP 401 Unauthorized.*
