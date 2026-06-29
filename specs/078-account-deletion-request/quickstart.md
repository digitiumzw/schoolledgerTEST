# Quickstart: Account Deletion Request

**Feature**: 078-account-deletion-request  
**Date**: 2026-05-19

---

## Prerequisites

- Backend server running on `http://localhost:8080`
- Frontend dev server running (optional, for UI validation)
- Valid tenant admin credentials
- Super Admin credentials (for CLI command testing)

---

## 1. Setup & Migration

### Apply Migrations

```bash
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark migrate
```

**Expected Output:**
```
Migrating to version 2026-05-19-000001_AddDeletionFieldsToTenants... Done
Migrating to version 2026-05-19-000002_CreateDeletionAuditLogTable... Done
```

---

## 2. Authentication

### Login as Tenant Admin

```bash
# Replace with actual credentials
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | \
  jq -r '.data.token')

echo "Token: $ADMIN_TOKEN"
```

**Expected Output:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {...}
  }
}
```

---

## 3. API Validation

### 3.1 Get Deletion Status (Happy Path - Active)

```bash
curl -X GET http://localhost:8080/api/tenant/deletion-status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Expected Response:**
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

---

### 3.2 Request Account Deletion (Happy Path)

```bash
curl -X POST http://localhost:8080/api/tenant/deletion-request \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmDelete":true,"reason":"Testing deletion feature"}' | jq
```

**Expected Response:**
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

**Verify in Database:**
```sql
SELECT id, name, status, deletion_requested_at 
FROM tenants 
WHERE id = 't1234567890';
-- Should show status='pending_deletion' and deletion_requested_at set
```

---

### 3.3 Get Deletion Status (Pending Deletion)

```bash
curl -X GET http://localhost:8080/api/tenant/deletion-status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "tenantId": "t1234567890",
    "tenantName": "Greenwood Primary School",
    "deletionRequested": true,
    "requestedAt": "2026-05-19T14:30:00Z",
    "expiresAt": "2026-05-26T14:30:00Z",
    "remainingDays": 7,
    "canUndo": true,
    "accountStatus": "pending_deletion"
  }
}
```

---

### 3.4 Undo Account Deletion (Happy Path)

```bash
curl -X POST http://localhost:8080/api/tenant/undo-deletion \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmUndo":true}' | jq
```

**Expected Response:**
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

**Verify in Database:**
```sql
SELECT id, name, status, deletion_requested_at 
FROM tenants 
WHERE id = 't1234567890';
-- Should show status='active' and deletion_requested_at is NULL
```

---

### 3.5 Request Deletion - Missing Confirmation (Error)

```bash
curl -X POST http://localhost:8080/api/tenant/deletion-request \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmDelete":false}' | jq
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "confirmDelete must be true",
  "errors": {
    "confirmDelete": "Explicit confirmation is required to request account deletion"
  }
}
```

---

### 3.6 Request Deletion - Duplicate Request (Error)

```bash
# First, request deletion
curl -X POST http://localhost:8080/api/tenant/deletion-request \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmDelete":true}' | jq

# Then try again
curl -X POST http://localhost:8080/api/tenant/deletion-request \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmDelete":true}' | jq
```

**Expected Response (second request):**
```json
{
  "status": "error",
  "message": "Deletion already requested",
  "errors": {
    "deletion": "An account deletion request is already pending for this tenant"
  }
}
```

---

### 3.7 Unauthorized Access (Error)

```bash
# No token
curl -X GET http://localhost:8080/api/tenant/deletion-status | jq
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Authentication required"
}
```

---

### 3.8 Insufficient Permissions (Error)

```bash
# Login as a teacher (non-admin role)
TEACHER_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@greenwood.co.zw","password":"12345678"}' | \
  jq -r '.data.token')

# Try to request deletion
curl -X POST http://localhost:8080/api/tenant/deletion-request \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmDelete":true}' | jq
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Forbidden",
  "errors": {
    "role": "Only tenant admins can request account deletion"
  }
}
```

---

### 3.9 Tenant Isolation (Security Test)

```bash
# Login as admin of a different tenant
OTHER_ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@other-school.co.zw","password":"12345678"}' | \
  jq -r '.data.token')

# Attempt to access first tenant's deletion status
# (Should only see their own tenant status)
curl -X GET http://localhost:8080/api/tenant/deletion-status \
  -H "Authorization: Bearer $OTHER_ADMIN_TOKEN" | jq
```

**Expected Response:**
Returns the OTHER tenant's status, NOT the first tenant's status. Each admin only sees their own tenant.

---

## 4. CLI Command Validation

### 4.1 Run Deletion Processing Command

```bash
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark tenants:process-deletion
```

**Expected Output (no expired deletions):**
```
Tenant Deletion Processing
==========================

Date: 2026-05-19 15:00:00

Reminder Emails Sent:
- Day 4 Reminders: 0 sent
- Day 7 Reminders: 0 sent

Expired Deletions Processed:
- No expired deletion requests found

Summary:
- Total tenants processed: 0
- Execution time: 0.1 seconds

[OK] Deletion processing completed
```

---

### 4.2 Test with Simulated Expired Deletion

**Step 1: Create a test tenant with expired deletion**
```sql
-- Insert test tenant with deletion requested 7+ days ago
UPDATE tenants 
SET status = 'pending_deletion', 
    deletion_requested_at = DATE_SUB(NOW(), INTERVAL 8 DAY)
WHERE id = 'test-tenant-id';
```

**Step 2: Run deletion command**
```bash
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark tenants:process-deletion
```

**Expected Output:**
```
Tenant Deletion Processing
==========================

Date: 2026-05-19 15:00:00

Reminder Emails Sent:
- Day 4 Reminders: 0 sent
- Day 7 Reminders: 0 sent

Expired Deletions Processed:
- Tenant test-tenant-id (Test School) - DELETED
  - Users deleted: 3
  - Students deleted: 50
  - Classes deleted: 5
  - Records removed: 8,500 total

Summary:
- Total tenants processed: 1
- Total records removed: 8,500
- Execution time: 12.3 seconds

[OK] Deletion processing completed
```

**Step 3: Verify deletion in database**
```sql
-- Tenant should be gone
SELECT * FROM tenants WHERE id = 'test-tenant-id';
-- Should return 0 rows

-- Audit log should show completion
SELECT * FROM deletion_audit_log 
WHERE tenant_id = 'test-tenant-id' 
ORDER BY completed_at DESC LIMIT 1;
-- Should show status='completed'
```

---

## 5. Email Testing

### 5.1 Day 4 Reminder Test

**Setup:**
```sql
-- Set a tenant to have requested deletion exactly 3 days ago
UPDATE tenants 
SET status = 'pending_deletion', 
    deletion_requested_at = DATE_SUB(NOW(), INTERVAL 3 DAY)
WHERE id = 'test-reminder-tenant';
```

**Run:**
```bash
php spark tenants:process-deletion
```

**Verify:** Check that email is sent to tenant admin with subject "Account Deletion Reminder - 4 Days Remaining".

---

### 5.2 Day 7 Reminder Test

**Setup:**
```sql
-- Set a tenant to have requested deletion exactly 6 days ago
UPDATE tenants 
SET status = 'pending_deletion', 
    deletion_requested_at = DATE_SUB(NOW(), INTERVAL 6 DAY)
WHERE id = 'test-final-reminder-tenant';
```

**Run:**
```bash
php spark tenants:process-deletion
```

**Verify:** Check that email is sent with subject "FINAL REMINDER: Account Deletion Tomorrow".

---

## 6. UI Testing (Frontend)

### 6.1 Settings Page Account Tab

1. Navigate to `http://localhost:5173/settings` (or your frontend URL)
2. Click on "Account" tab
3. Verify "Request Account Deletion" button is visible
4. Click the button and confirm the confirmation dialog appears

### 6.2 Pending Deletion UI

1. After requesting deletion via API, refresh the settings page
2. Verify warning banner appears with:
   - "Your account is scheduled for deletion" message
   - Remaining days countdown
   - "Undo Account Deletion" button
3. Click "Undo" and confirm
4. Verify UI returns to normal state

---

## 7. Cron Job Setup (Production)

### Add to crontab

```bash
# Edit crontab
crontab -e

# Add line to run every day at 3 AM
0 3 * * * cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend && /usr/bin/php spark tenants:process-deletion >> /var/log/schoolledger-deletion.log 2>&1
```

### Verify cron job works

```bash
# Test manually first
cd /home/jerald-whande/WORKSPACE/DEV_ENVIROMENT/SchoolLedger/backend
php spark tenants:process-deletion --dry-run  # If dry-run option implemented
```

---

## 8. Cleanup

After testing, reset the test tenant:

```sql
-- If you want to restore the test tenant
UPDATE tenants 
SET status = 'active', 
    deletion_requested_at = NULL 
WHERE id = 't1234567890';

-- Clean up audit logs from testing
DELETE FROM deletion_audit_log 
WHERE tenant_id IN ('test-tenant-id', 'test-reminder-tenant', 'test-final-reminder-tenant');
```

---

## Validation Checklist

| Test | Status | Notes |
|------|--------|-------|
| GET /api/tenant/deletion-status (active) | ⬜ | |
| POST /api/tenant/deletion-request | ⬜ | |
| GET /api/tenant/deletion-status (pending) | ⬜ | |
| POST /api/tenant/undo-deletion | ⬜ | |
| Missing confirmation error | ⬜ | |
| Duplicate request error | ⬜ | |
| Unauthorized (no token) | ⬜ | |
| Forbidden (teacher role) | ⬜ | |
| Tenant isolation | ⬜ | |
| CLI command (no expired) | ⬜ | |
| CLI command (with expired) | ⬜ | |
| Day 4 reminder email | ⬜ | |
| Day 7 reminder email | ⬜ | |
| Database verification | ⬜ | |
| UI rendering | ⬜ | |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Migration fails | Check `tenants` table doesn't already have `deletion_requested_at` column |
| Email not sending | Verify CodeIgniter email config in `.env` |
| CLI command not found | Ensure `TenantDeletion.php` is in `app/Commands/` directory |
| Permission denied | Check file permissions on `backend/` directory |
| JWT validation fails | Verify `JWT_SECRET_KEY` in `.env` matches token |
