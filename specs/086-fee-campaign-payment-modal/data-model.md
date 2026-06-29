# Data Model: Fee Campaign Payment in Record Payment Modal

**Feature**: 086-fee-campaign-payment-modal  
**Date**: 2026-05-30  
**Status**: No schema changes required — leverages existing Feature 059 tables

## Existing Entities (Feature 059)

### fee_campaigns

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | VARCHAR(36) | PK | Campaign identifier |
| tenant_id | VARCHAR(36) | FK, idx | Tenant isolation |
| name | VARCHAR(255) | NOT NULL | Campaign display name |
| description | TEXT | NULL | Optional description |
| amount | DECIMAL(10,2) | NOT NULL | Target/collection amount |
| due_date | DATE | NULL | Payment deadline |
| target_scope_type | ENUM | NOT NULL | `school_wide`, `class`, `students` |
| target_scope_id | TEXT | NULL | JSON-encoded scope identifiers |
| status | ENUM | NOT NULL, idx | `active` or `closed` |
| created_by | VARCHAR(36) | FK | Admin who created it |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

### campaign_students

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | VARCHAR(36) | PK | Membership identifier |
| tenant_id | VARCHAR(36) | FK, idx | Tenant isolation |
| fee_campaign_id | VARCHAR(36) | FK, idx | Links to fee_campaigns |
| student_id | VARCHAR(36) | FK, idx | Links to students |
| expected_amount | DECIMAL(10,2) | NOT NULL | Amount expected from this student |
| paid_amount | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Amount already paid |
| status | ENUM | NOT NULL | `unpaid`, `partially_paid`, `fully_paid` |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

### payments (campaign-aware columns)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | VARCHAR(36) | PK | Payment identifier |
| tenant_id | VARCHAR(36) | FK, idx | Tenant isolation |
| student_id | VARCHAR(36) | FK, idx | Links to students |
| amount | DECIMAL(10,2) | NOT NULL | Payment amount |
| date | DATE | NOT NULL | Payment date |
| method | VARCHAR(50) | NOT NULL | Payment method |
| description | VARCHAR(255) | NULL | Description |
| category | VARCHAR(50) | NOT NULL | Payment category (campaign name for campaign payments) |
| fee_campaign_id | VARCHAR(36) | FK, idx | NULL for standard payments, set for campaign payments |
| receipt_number | VARCHAR(25) | idx | Generated receipt number |
| snapshot | JSON | NULL | Snapshot of student/class/campaign context at time of payment |
| created_at | DATETIME | NOT NULL | Creation timestamp |
| updated_at | DATETIME | NOT NULL | Last update timestamp |

## Entity Relationships

```
Tenant --1:N--> FeeCampaign
Tenant --1:N--> CampaignStudent
Tenant --1:N--> Payment

FeeCampaign --1:N--> CampaignStudent
Student --1:N--> CampaignStudent
Student --1:N--> Payment
FeeCampaign --1:N--> Payment (via fee_campaign_id)
```

## State Transitions

### CampaignStudent Status Flow

```
unpaid --(payment > 0 && < expected)--> partially_paid
unpaid --(payment >= expected)--> fully_paid
partially_paid --(additional payment)--> fully_paid
```

### FeeCampaign Status

```
active --(admin closes)--> closed
```

Campaign payments can only be recorded when `status = 'active'`. Attempting to pay against a closed campaign returns HTTP 409.

## Validation Rules

- **Tenant Isolation**: All queries filter by `tenant_id` from JWT payload.
- **Campaign Status**: Payments only permitted when `fee_campaigns.status = 'active'`.
- **Student Enrollment**: Payment endpoint requires pre-existing `campaign_students` record (frontend handles auto-enrollment via separate call).
- **Amount Bounds**: Payment amount must be > 0 and <= remaining expected amount (`expected_amount - paid_amount`).
- **Duplicate Prevention**: Transaction-safe inserts prevent double-recording of payments.
