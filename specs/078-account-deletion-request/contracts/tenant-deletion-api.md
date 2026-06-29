# API Contract: Tenant Deletion

**Feature**: 078-account-deletion-request  
**Date**: 2026-05-19

---

## Endpoints

### 1. Get Tenant Deletion Status

Returns the current deletion status for the authenticated tenant.

**Endpoint**: `GET /api/tenant/deletion-status`  
**Authentication**: JWT required (tenant admin or higher)  
**Rate Limit**: Standard API limits

#### Request

```http
GET /api/tenant/deletion-status
Authorization: Bearer <jwt_token>
```

#### Success Response (200)

```json
{
  "status": "success",
  "data": {
    "tenantId": "t1234567890",
    "tenantName": "Greenwood Primary School",
    "deletionRequested": false,
    "requestedAt": null,
    "expiresAt": null,
    "remainingDays": null,
    "canUndo": false,
    "accountStatus": "active"
  }
}
```

#### Success Response (200) - Pending Deletion

```json
{
  "status": "success",
  "data": {
    "tenantId": "t1234567890",
    "tenantName": "Greenwood Primary School",
    "deletionRequested": true,
    "requestedAt": "2026-05-19T14:30:00Z",
    "expiresAt": "2026-05-26T14:30:00Z",
    "remainingDays": 4,
    "canUndo": true,
    "accountStatus": "pending_deletion"
  }
}
```

#### Error Responses

| Status | Code | Message | When |
|--------|------|---------|------|
| 401 | unauthorized | Authentication required | Missing or invalid JWT |
| 403 | forbidden | Insufficient permissions | User is not tenant admin |
| 404 | not_found | Tenant not found | Tenant doesn't exist or was deleted |

---

### 2. Request Account Deletion

Submits a deletion request for the authenticated tenant. Starts the 7-day grace period.

**Endpoint**: `POST /api/tenant/deletion-request`  
**Authentication**: JWT required (tenant admin only)  
**Rate Limit**: Stricter limit (max 3 attempts per hour per tenant)

#### Request

```http
POST /api/tenant/deletion-request
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "confirmDelete": true,
  "reason": "No longer need the service"  // Optional
}
```

#### Validation Rules

- `confirmDelete`: Must be `true` (explicit confirmation required)
- `reason`: Optional string, max 500 characters

#### Success Response (200)

```json
{
  "status": "success",
  "data": {
    "tenantId": "t1234567890",
    "status": "pending_deletion",
    "requestedAt": "2026-05-19T14:30:00Z",
    "expiresAt": "2026-05-26T14:30:00Z",
    "remainingDays": 7,
    "message": "Account deletion requested. You have 7 days to undo this request in Settings → Account."
  },
  "message": "Account deletion requested successfully"
}
```

#### Error Responses

| Status | Code | Message | When |
|--------|------|---------|------|
| 400 | bad_request | confirmDelete must be true | Missing or false confirmation |
| 400 | bad_request | Deletion already requested | Tenant already has pending deletion |
| 401 | unauthorized | Authentication required | Missing or invalid JWT |
| 403 | forbidden | Only tenant admins can request deletion | User lacks admin role |
| 409 | conflict | Deletion already in progress | Duplicate request |

---

### 3. Undo Account Deletion

Cancels a pending deletion request and restores the tenant account to active status.

**Endpoint**: `POST /api/tenant/undo-deletion`  
**Authentication**: JWT required (tenant admin only)  
**Rate Limit**: Standard API limits

#### Request

```http
POST /api/tenant/undo-deletion
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "confirmUndo": true
}
```

#### Validation Rules

- `confirmUndo`: Must be `true` (explicit confirmation required)
- Tenant must have a pending deletion request
- Deletion grace period must not have expired
- Tenant record must still exist (not yet deleted by CLI command)

#### Success Response (200)

```json
{
  "status": "success",
  "data": {
    "tenantId": "t1234567890",
    "status": "active",
    "deletionCanceled": true,
    "restoredAt": "2026-05-20T09:15:00Z",
    "message": "Account deletion has been canceled. Your account is now fully restored."
  },
  "message": "Account deletion canceled successfully"
}
```

#### Error Responses

| Status | Code | Message | When |
|--------|------|---------|------|
| 400 | bad_request | confirmUndo must be true | Missing or false confirmation |
| 400 | bad_request | No pending deletion request | Tenant doesn't have active deletion request |
| 400 | bad_request | Grace period has expired | Deletion already expired (may have been processed) |
| 401 | unauthorized | Authentication required | Missing or invalid JWT |
| 403 | forbidden | Only tenant admins can undo deletion | User lacks admin role |
| 404 | not_found | Tenant not found | Tenant was already deleted by CLI command |

---

## CLI Command Contract

### Tenant Deletion Processing Command

**Command**: `php spark tenants:process-deletion`  
**Execution**: Manual (Super Admin) or via cron job (automated)  
**Role Required**: Super Admin (when run manually)

#### Behavior

1. **Find Expired Deletion Requests**
   - Query: `SELECT * FROM tenants WHERE status = 'pending_deletion' AND deletion_requested_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)`
   
2. **Send Final Reminders** (Day 7)
   - Query: `SELECT * FROM tenants WHERE status = 'pending_deletion' AND DATE(deletion_requested_at) = DATE_SUB(CURDATE(), INTERVAL 6 DAY)`
   - Send "FINAL REMINDER: Account Deletion Tomorrow" email

3. **Send Day 4 Reminders**
   - Query: `SELECT * FROM tenants WHERE status = 'pending_deletion' AND DATE(deletion_requested_at) = DATE_SUB(CURDATE(), INTERVAL 3 DAY)`
   - Send "Account Deletion Reminder - 4 Days Remaining" email

4. **Process Permanent Deletions**
   - For each expired tenant:
     a. Send final notification (optional, since deletion is immediate)
     b. Delete all tenant-scoped data in order (see data-model.md)
     c. Update deletion_audit_log entry to `completed`
     d. Delete tenant record

#### Output

```
Tenant Deletion Processing
==========================

Date: 2026-05-26 03:00:00

Reminder Emails Sent:
- Day 4 Reminders: 2 sent
- Day 7 Reminders: 1 sent

Expired Deletions Processed:
- Tenant t1234567890 (Greenwood Primary School) - DELETED
  - Users deleted: 5
  - Students deleted: 234
  - Classes deleted: 12
  - Records removed: 15,432 total
- Tenant t0987654321 (Riverside Academy) - DELETED
  - Users deleted: 3
  - Students deleted: 89
  - Classes deleted: 6
  - Records removed: 8,765 total

Summary:
- Total tenants processed: 2
- Total records removed: 24,197
- Execution time: 45.2 seconds

[OK] Deletion processing completed
```

#### Error Handling

- If deletion fails mid-process: Log error, skip to next tenant, report failures at end
- Partial failures are logged with tenant_id for manual review
- Command exits with non-zero code if any failures occurred

---

## TypeScript Interfaces

```typescript
// Tenant Deletion Status
interface TenantDeletionStatus {
  tenantId: string;
  tenantName: string;
  deletionRequested: boolean;
  requestedAt: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  canUndo: boolean;
  accountStatus: 'active' | 'pending_deletion';
}

// Deletion Request Input
interface DeletionRequestInput {
  confirmDelete: boolean;
  reason?: string;
}

// Deletion Request Response
interface DeletionRequestResponse {
  tenantId: string;
  status: 'pending_deletion';
  requestedAt: string;
  expiresAt: string;
  remainingDays: number;
  message: string;
}

// Undo Deletion Input
interface UndoDeletionInput {
  confirmUndo: boolean;
}

// Undo Deletion Response
interface UndoDeletionResponse {
  tenantId: string;
  status: 'active';
  deletionCanceled: boolean;
  restoredAt: string;
  message: string;
}
```

---

## Security Considerations

1. **JWT Authentication**: All endpoints require valid JWT token
2. **Role Enforcement**: Tenant admin role required for request/undo endpoints
3. **Super Admin CLI**: Permanent deletion only via CLI (no HTTP endpoint)
4. **Confirmation Required**: Explicit `confirmDelete`/`confirmUndo` flags prevent accidental clicks
5. **Tenant Isolation**: All queries include `tenant_id` from JWT (Principle I)
6. **Rate Limiting**: Deletion request endpoint has stricter rate limits
7. **Audit Logging**: All actions logged to `deletion_audit_log` table
