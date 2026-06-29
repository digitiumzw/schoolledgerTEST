# API Contract: Onboarding Guidance

**Feature**: 076-onboarding-guided-tutorial  
**Date**: 2026-05-18

All endpoints are under `/api`, require JWT authentication unless explicitly noted, and use the standard success/error JSON envelopes.

## Updated Existing Endpoints

### GET /api/onboarding/progress

Returns initial onboarding wizard progress.

**Authorization**: `admin` or `super_admin` during onboarding.

**Behavior changes**:

- Must not require or advertise `fee-structure` as an initial onboarding step.
- May return saved `phone_number` in profile/contact step data.

**Success data**:

```json
{
  "current_step": "profile",
  "completed_steps": ["password"],
  "school_name": "Greenwood High",
  "admin_email": "admin@example.com",
  "onboarding_complete": false,
  "step_data": {
    "profile": {
      "admin_name": "School Admin",
      "phone_number": "+263771234567"
    }
  }
}
```

### POST /api/onboarding/progress

Saves one onboarding step.

**Request**:

```json
{
  "step": "profile",
  "data": {
    "admin_name": "School Admin",
    "phone_number": "+263771234567"
  }
}
```

**Validation**:

- `step` must be supported by the updated wizard.
- `phone_number`, when present, must be valid.
- `fee-structure` must not be required for completion.

### POST /api/onboarding/complete

Completes initial onboarding.

**Behavior changes**:

- Completion must not require fee structure or billing settings.
- Successful completion should make setup guide and tutorial available.

**Success data**:

```json
{
  "tenant_id": "tenant_123",
  "tenant_status": "trialing",
  "onboarding_complete": true,
  "show_setup_guide": true,
  "show_tutorial": true
}
```

## New Setup Guide Endpoints

### GET /api/setup-guide

Returns tenant-level recommended setup guide state.

**Authorization**: `admin` or `super_admin`.

**Success data**:

```json
{
  "current_step": "add-staff",
  "completed": false,
  "dismissed": false,
  "steps": [
    {
      "key": "add-staff",
      "label": "Add Staff",
      "status": "active",
      "optional": false,
      "route": "/staff",
      "description": "Add staff members before assigning classes or responsibilities."
    },
    {
      "key": "add-classes",
      "label": "Add Classes",
      "status": "pending",
      "optional": false,
      "route": "/classes"
    },
    {
      "key": "add-students",
      "label": "Add Students",
      "status": "pending",
      "optional": true,
      "route": "/students"
    },
    {
      "key": "configure-billing",
      "label": "Configure Fee Structure and Billing Settings",
      "status": "pending",
      "optional": false,
      "route": "/settings/fee-structure"
    }
  ]
}
```

### PATCH /api/setup-guide/steps/{stepKey}

Updates one setup step status.

**Authorization**: `admin` or `super_admin`.

**Allowed step keys**: `add-staff`, `add-classes`, `add-students`, `configure-billing`.

**Request**:

```json
{
  "status": "completed"
}
```

**Validation**:

- `status` must be `completed` or `skipped`.
- `skipped` is only valid for `add-students`.
- Unknown steps return `404` or `422`.

### POST /api/setup-guide/dismiss

Dismisses the setup guide for the tenant/admin view while preserving progress.

**Authorization**: `admin` or `super_admin`.

**Success data**:

```json
{
  "dismissed": true
}
```

## New Tutorial Endpoints

### GET /api/tutorial

Returns the authenticated user's role-aware tutorial state and visible tutorial modules.

**Authorization**: Any authenticated school user.

**Success data**:

```json
{
  "status": "not_started",
  "should_show": true,
  "last_seen_step": null,
  "modules": [
    {
      "module_key": "dashboard",
      "module_name": "Dashboard",
      "summary": "View school overview and key alerts.",
      "contains": ["KPIs", "quick actions", "recent activity"],
      "primary_actions": ["Review school status", "navigate to priority tasks"],
      "route": "/",
      "order": 1
    }
  ]
}
```

**Filtering rule**: Response must include only modules/features available to the authenticated user's role and permissions.

### PATCH /api/tutorial/progress

Updates authenticated user's tutorial progress.

**Authorization**: Any authenticated school user.

**Request**:

```json
{
  "status": "in_progress",
  "last_seen_step": "dashboard",
  "seen_module_keys": ["dashboard"]
}
```

**Validation**:

- `status` must be `not_started`, `in_progress`, `completed`, or `dismissed`.
- Module keys must be visible to the authenticated user.

### POST /api/tutorial/restart

Restarts the authenticated user's tutorial using current role/permission visibility.

**Authorization**: Any authenticated school user.

**Success data**:

```json
{
  "status": "in_progress",
  "should_show": true
}
```

## Required Error Scenarios

- `401` for unauthenticated access to setup guide/tutorial endpoints.
- `403` when a non-admin attempts to update tenant setup guide state.
- `422` for invalid phone number, invalid tutorial status, invalid setup step status, or skipping a required setup step.
- No response may include modules unauthorized for the current user.

## Tenant Isolation Requirements

- `/api/setup-guide` must only read/write state for the JWT tenant.
- `/api/tutorial` must only read/write progress for the authenticated user and tenant.
- Cross-tenant attempts must return no foreign data.
