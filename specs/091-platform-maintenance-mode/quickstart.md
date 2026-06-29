# Quickstart: Platform Maintenance Mode

**Feature Branch**: `091-platform-maintenance-mode`
**Date**: 2026-06-22

## Prerequisites

- Backend running on `http://localhost:8080`
- Platform admin credentials: `admin@localhost` / `admin123`
- Tenant admin credentials: `admin@greenwood.co.zw` / `12345678`
- `curl` and `jq` installed

## Setup

### 1. Run the migration to seed default maintenance settings

```bash
cd backend
php spark migrate
```

This seeds three rows into `platform_settings`:
- `maintenance_mode` = `false`
- `maintenance_headline` = `"Platform Under Maintenance"`
- `maintenance_message` = `"The platform is currently under maintenance. Service will be restored shortly."`

### 2. Verify the seed

```bash
# Login as platform admin
PLATFORM_TOKEN=$(curl -s -X POST http://localhost:8080/api/platform/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@localhost","password":"admin123"}' | jq -r '.data.token')

# Get settings — verify maintenance keys exist
curl -s http://localhost:8080/api/platform/settings \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq '.data | keys'
```

## Smoke Tests

### Test 1: Public maintenance status endpoint (maintenance off)

```bash
curl -s http://localhost:8080/api/maintenance-status | jq .
# Expected: maintenance_mode: false, headline and message present
```

### Test 2: Enable maintenance mode

```bash
curl -s -X PUT http://localhost:8080/api/platform/settings \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -d '{
    "maintenance_mode": {
      "value": true,
      "type": "boolean",
      "description": "Whether maintenance mode is enabled"
    }
  }' | jq '.data.maintenance_mode'
# Expected: value: true
```

### Test 3: Public maintenance status endpoint (maintenance on)

```bash
curl -s http://localhost:8080/api/maintenance-status | jq '.data.maintenance_mode'
# Expected: true
```

### Test 4: Non-admin tenant API call returns 503

```bash
# Login as tenant admin (or any tenant user)
TENANT_TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')

# This should return 503 if the user is NOT admin/super_admin
# If admin, it should succeed — test with a teacher/bursar user for 503
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TENANT_TOKEN"
# Expected for admin: 200 (admin bypasses maintenance)
# Expected for teacher/bursar: 503
```

### Test 5: Admin bypass — tenant admin API calls succeed

```bash
# Using the tenant admin token from Test 4
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TENANT_TOKEN"
# Expected: 200 (admin role bypasses maintenance mode)
```

### Test 6: Platform admin routes unaffected

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/platform/dashboard/kpis \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
# Expected: 200
```

### Test 7: Public endpoints unaffected

```bash
# Kiosk status should still work
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/kiosk/status
# Expected: 200 or 404 (depending on kiosk code) — NOT 503

# Auth login should still work
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}'
# Expected: 200
```

### Test 8: Update custom headline and message

```bash
curl -s -X PUT http://localhost:8080/api/platform/settings \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -d '{
    "maintenance_headline": {
      "value": "Scheduled Maintenance",
      "type": "string",
      "description": "Custom headline for the maintenance notice"
    },
    "maintenance_message": {
      "value": "We are performing scheduled maintenance. We will be back by 10:00 AM.",
      "type": "string",
      "description": "Custom message body for the maintenance notice"
    }
  }' | jq '.data.maintenance_headline, .data.maintenance_message'

# Verify via public endpoint
curl -s http://localhost:8080/api/maintenance-status | jq '.data.headline, .data.message'
# Expected: "Scheduled Maintenance", "We are performing scheduled maintenance..."
```

### Test 9: Disable maintenance mode

```bash
curl -s -X PUT http://localhost:8080/api/platform/settings \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -d '{
    "maintenance_mode": {
      "value": false,
      "type": "boolean",
      "description": "Whether maintenance mode is enabled"
    }
  }' | jq '.data.maintenance_mode'
# Expected: value: false

# Verify API calls resume
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer $TENANT_TOKEN"
# Expected: 200
```

### Test 10: Audit log entry

```bash
# Check platform audit logs for maintenance settings update
curl -s "http://localhost:8080/api/platform/audit?action=platform.settings.update" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" | jq '.data[:3] | .[] | {action, details, created_at}'
# Expected: entries with action "platform.settings.update" and details containing maintenance keys
```

## Frontend Verification

### Tenant App

1. Open the tenant app in a browser
2. Log in as a teacher or bursar (non-admin)
3. Enable maintenance mode from the Platform Control Panel
4. Within 30 seconds, the tenant app should show the maintenance notice instead of normal content
5. Log in as an admin — the app should work normally
6. Disable maintenance mode — within 30 seconds, the tenant app should return to normal

### Platform Control Panel

1. Navigate to `/platform-control-panel/settings`
2. Click the "Maintenance" tab
3. Toggle the maintenance mode switch on
4. Edit the headline and message
5. Click "Save"
6. Verify the save button shows a loading state during the request
7. Verify the toggle state persists after page refresh
